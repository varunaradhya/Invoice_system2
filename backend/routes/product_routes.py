from flask import Blueprint, request, jsonify
from db import get_db

product_bp = Blueprint('product', __name__)

@product_bp.route('/', methods=['POST'])
def add_product():
    d = request.get_json() or {}
    name = (d.get('name') or '').strip()
    try:
        cost_price = float(d.get('cost_price') or 0)
        price = float(d.get('price'))
        gst_percent = float(d.get('gst_percent') or 0)
        quantity = int(d.get('quantity'))
        low_stock_alert = int(d.get('low_stock_alert') or 5)
    except (TypeError, ValueError):
        return jsonify({"error": "Price, GST percent, and quantity must be valid numbers"}), 400

    if not name:
        return jsonify({"error": "Product name is required"}), 400
    if cost_price < 0 or price < 0 or gst_percent < 0 or quantity < 0 or low_stock_alert < 0:
        return jsonify({"error": "Cost, price, GST percent, quantity, and alert stock cannot be negative"}), 400

    db = get_db()
    db.execute("""
        INSERT INTO products
            (name, category, hsn_code, unit, cost_price, price, gst_percent, quantity, low_stock_alert, photo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        name,
        (d.get('category') or 'General').strip(),
        (d.get('hsn_code') or '').strip(),
        (d.get('unit') or 'PCS').strip().upper(),
        cost_price,
        price,
        gst_percent,
        quantity,
        low_stock_alert,
        d.get('photo') or ''
    ))
    db.commit()
    db.close()
    return jsonify({"msg": "Product added"}), 201

@product_bp.route('/', methods=['GET'])
def get_products():
    db = get_db()
    rows = db.execute("SELECT * FROM products").fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])


@product_bp.route('/<int:product_id>', methods=['DELETE'])
def delete_product(product_id):
    db = get_db()
    try:
        references = db.execute("""
            SELECT
                (SELECT COUNT(*) FROM invoice_items WHERE product_id = ?) +
                (SELECT COUNT(*) FROM quotation_items WHERE product_id = ?) AS count
        """, (product_id, product_id)).fetchone()["count"]
        if references:
            return jsonify({"error": "Product is used in invoices or quotations. Keep it for audit history."}), 400

        result = db.execute("DELETE FROM products WHERE id = ?", (product_id,))
        if result.rowcount == 0:
            return jsonify({"error": "Product not found"}), 404
        db.commit()
        return jsonify({"msg": "Product deleted"})
    finally:
        db.close()
