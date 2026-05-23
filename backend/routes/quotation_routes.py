from flask import Blueprint, request, jsonify

from db import get_db
from utilis import generate_invoice_number, generate_quotation_number

quotation_bp = Blueprint('quotations', __name__)


def serialize_quotation(db, quotation_id):
    quote = db.execute("""
        SELECT quotations.*, customers.name AS customer_name, customers.phone AS customer_phone,
               customers.gstin AS customer_gstin
        FROM quotations
        JOIN customers ON customers.id = quotations.customer_id
        WHERE quotations.id = ?
    """, (quotation_id,)).fetchone()
    if not quote:
        return None
    items = db.execute("""
        SELECT quotation_items.*, products.name AS product_name, products.category
        FROM quotation_items
        JOIN products ON products.id = quotation_items.product_id
        WHERE quotation_id = ?
    """, (quotation_id,)).fetchall()
    data = dict(quote)
    data["items"] = [dict(item) for item in items]
    return data


@quotation_bp.route('/', methods=['GET'])
def get_quotations():
    db = get_db()
    rows = db.execute("""
        SELECT quotations.*, customers.name AS customer_name
        FROM quotations
        JOIN customers ON customers.id = quotations.customer_id
        ORDER BY quotations.created_at DESC, quotations.id DESC
    """).fetchall()
    db.close()
    return jsonify([dict(row) for row in rows])


@quotation_bp.route('/<int:quotation_id>', methods=['GET'])
def get_quotation(quotation_id):
    db = get_db()
    quote = serialize_quotation(db, quotation_id)
    db.close()
    if not quote:
        return jsonify({"error": "Quotation not found"}), 404
    return jsonify(quote)


def save_items(db, quotation_id, items):
    total = 0.0
    gst_total = 0.0
    prepared = []
    for item in items:
        product_id = int(item.get("product_id"))
        quantity = int(item.get("quantity"))
        if quantity <= 0:
            raise ValueError("Item quantity must be greater than zero")
        product = db.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
        if not product:
            raise ValueError(f"Product {product_id} not found")
        price = float(item.get("price") or product["price"])
        gst_percent = float(item.get("gst_percent") or product["gst_percent"])
        line_total = price * quantity
        total += line_total
        gst_total += line_total * gst_percent / 100
        prepared.append((quotation_id, product_id, quantity, price, gst_percent, line_total))

    db.executemany("""
        INSERT INTO quotation_items (quotation_id, product_id, quantity, price, gst_percent, line_total)
        VALUES (?, ?, ?, ?, ?, ?)
    """, prepared)
    final_total = total + gst_total
    db.execute("""
        UPDATE quotations SET total = ?, gst = ?, final_total = ? WHERE id = ?
    """, (total, gst_total, final_total, quotation_id))


@quotation_bp.route('/', methods=['POST'])
def create_quotation():
    data = request.get_json() or {}
    items = data.get("items") or []
    if not items:
        return jsonify({"error": "At least one quotation item is required"}), 400
    db = get_db()
    try:
        customer_id = int(data.get("customer_id"))
        if not db.execute("SELECT id FROM customers WHERE id = ?", (customer_id,)).fetchone():
            return jsonify({"error": "Customer not found"}), 404
        cursor = db.execute("""
            INSERT INTO quotations (quotation_number, customer_id, generator_name, total, gst, final_total, status)
            VALUES (?, ?, ?, 0, 0, 0, 'Draft')
        """, (generate_quotation_number(), customer_id, (data.get("generator_name") or "").strip()))
        quotation_id = cursor.lastrowid
        save_items(db, quotation_id, items)
        db.commit()
        quote = serialize_quotation(db, quotation_id)
    except (TypeError, ValueError) as exc:
        db.rollback()
        return jsonify({"error": str(exc)}), 400
    finally:
        db.close()
    return jsonify(quote), 201


@quotation_bp.route('/<int:quotation_id>', methods=['PUT'])
def update_quotation(quotation_id):
    data = request.get_json() or {}
    items = data.get("items") or []
    if not items:
        return jsonify({"error": "At least one quotation item is required"}), 400
    db = get_db()
    try:
        if not db.execute("SELECT id FROM quotations WHERE id = ?", (quotation_id,)).fetchone():
            return jsonify({"error": "Quotation not found"}), 404
        db.execute("""
            UPDATE quotations SET customer_id = ?, generator_name = ?, status = 'Draft'
            WHERE id = ?
        """, (int(data.get("customer_id")), (data.get("generator_name") or "").strip(), quotation_id))
        db.execute("DELETE FROM quotation_items WHERE quotation_id = ?", (quotation_id,))
        save_items(db, quotation_id, items)
        db.commit()
        quote = serialize_quotation(db, quotation_id)
    except (TypeError, ValueError) as exc:
        db.rollback()
        return jsonify({"error": str(exc)}), 400
    finally:
        db.close()
    return jsonify(quote)


@quotation_bp.route('/<int:quotation_id>/convert', methods=['POST'])
def convert_to_invoice(quotation_id):
    db = get_db()
    try:
        quote = serialize_quotation(db, quotation_id)
        if not quote:
            return jsonify({"error": "Quotation not found"}), 404
        cursor = db.execute("""
            INSERT INTO invoices (invoice_number, customer_id, total, gst, final_total, payment_status)
            VALUES (?, ?, ?, ?, ?, 'Pending')
        """, (generate_invoice_number(), quote["customer_id"], quote["total"], quote["gst"], quote["final_total"]))
        invoice_id = cursor.lastrowid
        for item in quote["items"]:
            product = db.execute("SELECT quantity FROM products WHERE id = ?", (item["product_id"],)).fetchone()
            if product["quantity"] < item["quantity"]:
                raise ValueError(f"Not enough stock for {item['product_name']}")
            db.execute("""
                INSERT INTO invoice_items (invoice_id, product_id, quantity, price, gst_percent, line_total)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (invoice_id, item["product_id"], item["quantity"], item["price"], item["gst_percent"], item["line_total"]))
            db.execute("UPDATE products SET quantity = quantity - ? WHERE id = ?", (item["quantity"], item["product_id"]))
        db.execute("""
            UPDATE customers SET total_amount = total_amount + ?, balance = balance + ? WHERE id = ?
        """, (quote["final_total"], quote["final_total"], quote["customer_id"]))
        db.execute("UPDATE quotations SET status = 'Converted' WHERE id = ?", (quotation_id,))
        db.commit()
        invoice = db.execute("SELECT * FROM invoices WHERE id = ?", (invoice_id,)).fetchone()
    except ValueError as exc:
        db.rollback()
        return jsonify({"error": str(exc)}), 400
    finally:
        db.close()
    return jsonify(dict(invoice)), 201


@quotation_bp.route('/<int:quotation_id>', methods=['DELETE'])
def delete_quotation(quotation_id):
    db = get_db()
    try:
        if not db.execute("SELECT id FROM quotations WHERE id = ?", (quotation_id,)).fetchone():
            return jsonify({"error": "Quotation not found"}), 404
        db.execute("DELETE FROM quotation_items WHERE quotation_id = ?", (quotation_id,))
        db.execute("DELETE FROM quotations WHERE id = ?", (quotation_id,))
        db.commit()
        return jsonify({"msg": "Quotation deleted"})
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
