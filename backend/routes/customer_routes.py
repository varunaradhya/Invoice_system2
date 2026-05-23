from flask import Blueprint, request, jsonify
from db import get_db

customer_bp = Blueprint('customer', __name__)

@customer_bp.route('/', methods=['POST'])
def add_customer():
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({"error": "Customer name is required"}), 400

    db = get_db()
    db.execute("INSERT INTO customers (name, phone, gstin) VALUES (?, ?, ?)",
               (name, (data.get('phone') or '').strip(), (data.get('gstin') or '').strip()))
    db.commit()
    db.close()
    return jsonify({"msg": "Customer added"}), 201

@customer_bp.route('/', methods=['GET'])
def get_customers():
    db = get_db()
    rows = db.execute("SELECT * FROM customers").fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])
