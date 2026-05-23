from flask import Blueprint, request, jsonify
from db import get_db

product_bp = Blueprint('product', __name__)

@product_bp.route('/', methods=['POST'])
def add_product():
    d = request.get_json() or {}
    name = (d.get('name') or '').strip()
    try:
        price = float(d.get('price'))
        gst_percent = float(d.get('gst_percent') or 0)
        quantity = int(d.get('quantity'))
    except (TypeError, ValueError):
        return jsonify({"error": "Price, GST percent, and quantity must be valid numbers"}), 400

    if not name:
        return jsonify({"error": "Product name is required"}), 400
    if price < 0 or gst_percent < 0 or quantity < 0:
        return jsonify({"error": "Price, GST percent, and quantity cannot be negative"}), 400

    db = get_db()
    db.execute("INSERT INTO products (name, price, gst_percent, quantity) VALUES (?, ?, ?, ?)",
               (name, price, gst_percent, quantity))
    db.commit()
    db.close()
    return jsonify({"msg": "Product added"}), 201

@product_bp.route('/', methods=['GET'])
def get_products():
    db = get_db()
    rows = db.execute("SELECT * FROM products").fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])
