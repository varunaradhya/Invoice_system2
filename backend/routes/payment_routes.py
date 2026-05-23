from flask import Blueprint, request, jsonify
from db import get_db

payment_bp = Blueprint('payment', __name__)

@payment_bp.route('/', methods=['POST'])
def add_payment():
    d = request.json
    db = get_db()

    db.execute("INSERT INTO payments (customer_id, invoice_id, amount) VALUES (?, ?, ?)",
               (d['customer_id'], d['invoice_id'], d['amount']))

    db.execute("""
    UPDATE customers SET 
        advance_paid = advance_paid + ?, 
        balance = balance - ?
    WHERE id = ?
    """, (d['amount'], d['amount'], d['customer_id']))

    db.commit()
    return jsonify({"msg": "Payment added"})