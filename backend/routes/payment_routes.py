from flask import Blueprint, request, jsonify
from db import get_db

payment_bp = Blueprint('payment', __name__)

@payment_bp.route('/', methods=['POST'])
def add_payment():
    d = request.get_json() or {}
    try:
        customer_id = int(d.get('customer_id'))
        invoice_id = int(d.get('invoice_id'))
        amount = float(d.get('amount'))
    except (TypeError, ValueError):
        return jsonify({"error": "Customer, invoice, and amount must be valid"}), 400

    if amount <= 0:
        return jsonify({"error": "Payment amount must be greater than zero"}), 400

    db = get_db()
    try:
        invoice = db.execute("""
            SELECT id, customer_id, final_total, amount_paid
            FROM invoices
            WHERE id = ?
        """, (invoice_id,)).fetchone()

        if not invoice:
            return jsonify({"error": "Invoice not found"}), 404
        if invoice['customer_id'] != customer_id:
            return jsonify({"error": "Invoice does not belong to this customer"}), 400

        remaining = float(invoice['final_total']) - float(invoice['amount_paid'])
        if amount > remaining:
            return jsonify({"error": f"Payment exceeds remaining balance of {remaining:.2f}"}), 400

        new_paid = float(invoice['amount_paid']) + amount
        new_status = "Paid" if new_paid >= float(invoice['final_total']) else "Partially Paid"

        db.execute("INSERT INTO payments (customer_id, invoice_id, amount) VALUES (?, ?, ?)",
                   (customer_id, invoice_id, amount))

        db.execute("""
            UPDATE invoices
            SET amount_paid = ?,
                payment_status = ?
            WHERE id = ?
        """, (new_paid, new_status, invoice_id))

        db.execute("""
            UPDATE customers
            SET advance_paid = advance_paid + ?,
                balance = balance - ?
            WHERE id = ?
        """, (amount, amount, customer_id))

        db.commit()
        return jsonify({"msg": "Payment added", "payment_status": new_status}), 201
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
