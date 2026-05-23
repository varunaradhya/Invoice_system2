from flask import Blueprint, jsonify
from db import get_db

analytics_bp = Blueprint('analytics', __name__)

@analytics_bp.route('/')
def dashboard():
    db = get_db()

    total_sales = db.execute("SELECT SUM(final_total) as t FROM invoices").fetchone()['t']
    pending = db.execute("SELECT SUM(balance) as b FROM customers").fetchone()['b']
    paid = db.execute("SELECT SUM(amount_paid) as p FROM invoices").fetchone()['p']
    invoice_count = db.execute("SELECT COUNT(*) as c FROM invoices").fetchone()['c']
    inventory_value = db.execute("SELECT SUM(cost_price * quantity) as v FROM products").fetchone()['v']
    profit = db.execute("""
        SELECT SUM((invoice_items.price - products.cost_price) * invoice_items.quantity) AS p
        FROM invoice_items
        JOIN products ON products.id = invoice_items.product_id
    """).fetchone()['p']
    low_stock = db.execute("""
        SELECT COUNT(*) AS c FROM products WHERE quantity <= low_stock_alert
    """).fetchone()['c']
    products = db.execute("SELECT COUNT(*) AS c FROM products").fetchone()['c']
    customers = db.execute("SELECT COUNT(*) AS c FROM customers").fetchone()['c']
    db.close()

    return jsonify({
        "total_sales": total_sales or 0,
        "pending": pending or 0,
        "paid": paid or 0,
        "invoice_count": invoice_count or 0,
        "inventory_value": inventory_value or 0,
        "profit": profit or 0,
        "low_stock": low_stock or 0,
        "products": products or 0,
        "customers": customers or 0
    })
