from db import get_db
from init_db import init_db
from utilis import generate_invoice_number


CUSTOMERS = [
    ("Aarav Textiles", "9876543210", "29AARCT1021F1Z7"),
    ("Nila Interiors", "9988776655", "29NILIN4588P1Z4"),
    ("Urban Bakehouse", "9123456780", "29URBBA2201L1Z2"),
]

PRODUCTS = [
    ("Premium Cotton Roll", "Textiles", "5208", "MTR", 890.00, 1250.00, 5.0, 80, 10),
    ("Oak Wall Panel", "Interior", "4418", "PCS", 2500.00, 3400.00, 18.0, 35, 6),
    ("Commercial Oven Tray", "Bakery", "7323", "PCS", 520.00, 780.00, 12.0, 120, 15),
    ("Packaging Labels", "Packaging", "4821", "PCS", 1.75, 3.50, 5.0, 2000, 200),
]

INVOICES = [
    (0, [(0, 4), (3, 250)], 2500.00),
    (1, [(1, 3), (3, 400)], 0.00),
    (2, [(2, 12), (3, 150)], 4200.00),
]


def seed_demo_data():
    init_db()
    db = get_db()

    existing = db.execute("SELECT COUNT(*) AS count FROM customers").fetchone()["count"]
    if existing:
        db.close()
        return {
            "created": False,
            "msg": "Demo data already exists. Delete backend/erp.db and seed again for a fresh demo."
        }

    customer_ids = []
    product_ids = []

    for name, phone, gstin in CUSTOMERS:
        cursor = db.execute(
            "INSERT INTO customers (name, phone, gstin) VALUES (?, ?, ?)",
            (name, phone, gstin)
        )
        customer_ids.append(cursor.lastrowid)

    for name, category, hsn_code, unit, cost_price, price, gst_percent, quantity, low_stock_alert in PRODUCTS:
        cursor = db.execute(
            """
            INSERT INTO products
                (name, category, hsn_code, unit, cost_price, price, gst_percent, quantity, low_stock_alert)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (name, category, hsn_code, unit, cost_price, price, gst_percent, quantity, low_stock_alert)
        )
        product_ids.append(cursor.lastrowid)

    for customer_index, items, payment_amount in INVOICES:
        customer_id = customer_ids[customer_index]
        total = 0.0
        gst_total = 0.0
        prepared_items = []

        for product_index, quantity in items:
            product_id = product_ids[product_index]
            product = db.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
            line_total = float(product["price"]) * quantity
            line_gst = line_total * float(product["gst_percent"]) / 100
            total += line_total
            gst_total += line_gst
            prepared_items.append((product_id, quantity, product["price"], product["gst_percent"], line_total))

        final_total = total + gst_total
        amount_paid = min(payment_amount, final_total)
        if amount_paid == 0:
            status = "Pending"
        elif amount_paid >= final_total:
            status = "Paid"
        else:
            status = "Partially Paid"

        cursor = db.execute("""
            INSERT INTO invoices
                (invoice_number, customer_id, total, gst, final_total, amount_paid, payment_status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (generate_invoice_number(), customer_id, total, gst_total, final_total, amount_paid, status))
        invoice_id = cursor.lastrowid

        for product_id, quantity, price, gst_percent, line_total in prepared_items:
            db.execute("""
                INSERT INTO invoice_items
                    (invoice_id, product_id, quantity, price, gst_percent, line_total)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (invoice_id, product_id, quantity, price, gst_percent, line_total))
            db.execute("UPDATE products SET quantity = quantity - ? WHERE id = ?", (quantity, product_id))

        if amount_paid:
            db.execute(
                "INSERT INTO payments (customer_id, invoice_id, amount) VALUES (?, ?, ?)",
                (customer_id, invoice_id, amount_paid)
            )

        db.execute("""
            UPDATE customers
            SET total_amount = total_amount + ?,
                advance_paid = advance_paid + ?,
                balance = balance + ? - ?
            WHERE id = ?
        """, (final_total, amount_paid, final_total, amount_paid, customer_id))

    db.commit()
    db.close()
    return {"created": True, "msg": "Demo data added"}


if __name__ == "__main__":
    print(seed_demo_data()["msg"])
