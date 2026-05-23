from flask import Blueprint, request, jsonify

from db import get_db
from utilis import generate_invoice_number

invoice_bp = Blueprint('invoice', __name__)


@invoice_bp.route('/', methods=['GET'])
def get_invoices():
    db = get_db()
    rows = db.execute("""
        SELECT invoices.*, customers.name AS customer_name
        FROM invoices
        JOIN customers ON customers.id = invoices.customer_id
        ORDER BY invoices.created_at DESC, invoices.id DESC
    """).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])


@invoice_bp.route('/', methods=['POST'])
def create_invoice():
    data = request.get_json() or {}

    try:
        customer_id = int(data.get('customer_id'))
    except (TypeError, ValueError):
        return jsonify({"error": "A valid customer is required"}), 400

    items = data.get('items') or []
    if not items:
        return jsonify({"error": "At least one invoice item is required"}), 400

    db = get_db()
    try:
        customer = db.execute("SELECT id FROM customers WHERE id = ?", (customer_id,)).fetchone()
        if not customer:
            return jsonify({"error": "Customer not found"}), 404

        prepared_items = []
        total = 0.0
        gst_total = 0.0

        for item in items:
            try:
                product_id = int(item.get('product_id'))
                quantity = int(item.get('quantity'))
            except (TypeError, ValueError):
                return jsonify({"error": "Each item needs a valid product and quantity"}), 400

            if quantity <= 0:
                return jsonify({"error": "Item quantity must be greater than zero"}), 400

            product = db.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
            if not product:
                return jsonify({"error": f"Product {product_id} not found"}), 404
            if product['quantity'] < quantity:
                return jsonify({"error": f"Not enough stock for {product['name']}"}), 400

            line_total = float(product['price']) * quantity
            line_gst = line_total * float(product['gst_percent']) / 100
            total += line_total
            gst_total += line_gst
            prepared_items.append({
                "product_id": product_id,
                "quantity": quantity,
                "price": float(product['price']),
                "gst_percent": float(product['gst_percent']),
                "line_total": line_total
            })

        final_total = total + gst_total
        invoice_number = generate_invoice_number()

        cursor = db.execute("""
            INSERT INTO invoices (invoice_number, customer_id, total, gst, final_total, payment_status)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (invoice_number, customer_id, total, gst_total, final_total, "Pending"))
        invoice_id = cursor.lastrowid

        for item in prepared_items:
            db.execute("""
                INSERT INTO invoice_items (invoice_id, product_id, quantity, price, gst_percent, line_total)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                invoice_id,
                item["product_id"],
                item["quantity"],
                item["price"],
                item["gst_percent"],
                item["line_total"],
            ))
            db.execute("""
                UPDATE products
                SET quantity = quantity - ?
                WHERE id = ?
            """, (item["quantity"], item["product_id"]))

        db.execute("""
            UPDATE customers
            SET total_amount = total_amount + ?,
                balance = balance + ?
            WHERE id = ?
        """, (final_total, final_total, customer_id))

        db.commit()
        return jsonify({
            "msg": "Invoice created",
            "invoice_id": invoice_id,
            "invoice_number": invoice_number,
            "total": round(total, 2),
            "gst": round(gst_total, 2),
            "final_total": round(final_total, 2),
            "payment_status": "Pending"
        }), 201
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
