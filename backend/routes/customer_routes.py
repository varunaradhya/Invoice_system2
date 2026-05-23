from flask import Blueprint, request, jsonify
from db import get_db

customer_bp = Blueprint('customer', __name__)

@customer_bp.route('/', methods=['POST'])
def add_customer():
    data = request.json
    db = get_db()
    db.execute("INSERT INTO customers (name, phone, gstin) VALUES (?, ?, ?)",
               (data['name'], data['phone'], data['gstin']))
    db.commit()
    return jsonify({"msg": "Customer added"})

@customer_bp.route('/', methods=['GET'])
def get_customers():
    db = get_db()
    rows = db.execute("SELECT * FROM customers").fetchall()
    return jsonify([dict(r) for r in rows])