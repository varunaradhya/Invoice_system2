from flask import Blueprint, jsonify
from db import get_db

analytics_bp = Blueprint('analytics', __name__)

@analytics_bp.route('/')
def dashboard():
    db = get_db()

    total_sales = db.execute("SELECT SUM(final_total) as t FROM invoices").fetchone()['t']
    pending = db.execute("SELECT SUM(balance) as b FROM customers").fetchone()['b']

    return jsonify({
        "total_sales": total_sales or 0,
        "pending": pending or 0
    })