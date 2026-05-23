from flask import Blueprint, request, jsonify
from db import get_db

product_bp = Blueprint('product', __name__)

@product_bp.route('/', methods=['POST'])
def add_product():
    d = request.json
    db = get_db()
    db.execute("INSERT INTO products (name, price, gst_percent, quantity) VALUES (?, ?, ?, ?)",
               (d['name'], d['price'], d['gst_percent'], d['quantity']))
    db.commit()
    return jsonify({"msg": "Product added"})

@product_bp.route('/', methods=['GET'])
def get_products():
    db = get_db()
    rows = db.execute("SELECT * FROM products").fetchall()
    return jsonify([dict(r) for r in rows])