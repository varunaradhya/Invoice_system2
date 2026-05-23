from db import get_db


SCHEMA = """
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    gstin TEXT NOT NULL DEFAULT '',
    total_amount REAL NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    advance_paid REAL NOT NULL DEFAULT 0 CHECK (advance_paid >= 0),
    balance REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    hsn_code TEXT NOT NULL DEFAULT '',
    unit TEXT NOT NULL DEFAULT 'PCS',
    cost_price REAL NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
    price REAL NOT NULL CHECK (price >= 0),
    gst_percent REAL NOT NULL DEFAULT 0 CHECK (gst_percent >= 0),
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    low_stock_alert INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_alert >= 0),
    photo TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL,
    total REAL NOT NULL CHECK (total >= 0),
    gst REAL NOT NULL CHECK (gst >= 0),
    final_total REAL NOT NULL CHECK (final_total >= 0),
    amount_paid REAL NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
    payment_status TEXT NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price REAL NOT NULL CHECK (price >= 0),
    gst_percent REAL NOT NULL DEFAULT 0 CHECK (gst_percent >= 0),
    line_total REAL NOT NULL CHECK (line_total >= 0),
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    invoice_id INTEGER NOT NULL,
    amount REAL NOT NULL CHECK (amount > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

CREATE TABLE IF NOT EXISTS quotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quotation_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL,
    generator_name TEXT NOT NULL DEFAULT '',
    total REAL NOT NULL CHECK (total >= 0),
    gst REAL NOT NULL CHECK (gst >= 0),
    final_total REAL NOT NULL CHECK (final_total >= 0),
    status TEXT NOT NULL DEFAULT 'Draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS quotation_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quotation_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price REAL NOT NULL CHECK (price >= 0),
    gst_percent REAL NOT NULL DEFAULT 0 CHECK (gst_percent >= 0),
    line_total REAL NOT NULL CHECK (line_total >= 0),
    FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS company_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    company_name TEXT NOT NULL DEFAULT 'Your Company Name',
    address TEXT NOT NULL DEFAULT '',
    gst_number TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    logo TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager')),
    permissions TEXT NOT NULL DEFAULT 'dashboard,customers,products,quotations,invoices,payments,reports,settings,users'
);
"""


def init_db():
    db = get_db()
    db.executescript(SCHEMA)
    columns = {row["name"] for row in db.execute("PRAGMA table_info(products)").fetchall()}
    if "category" not in columns:
        db.execute("ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT 'General'")
    if "cost_price" not in columns:
        db.execute("ALTER TABLE products ADD COLUMN cost_price REAL NOT NULL DEFAULT 0")
    if "photo" not in columns:
        db.execute("ALTER TABLE products ADD COLUMN photo TEXT NOT NULL DEFAULT ''")
    if "hsn_code" not in columns:
        db.execute("ALTER TABLE products ADD COLUMN hsn_code TEXT NOT NULL DEFAULT ''")
    if "unit" not in columns:
        db.execute("ALTER TABLE products ADD COLUMN unit TEXT NOT NULL DEFAULT 'PCS'")
    if "low_stock_alert" not in columns:
        db.execute("ALTER TABLE products ADD COLUMN low_stock_alert INTEGER NOT NULL DEFAULT 5")
    db.execute("INSERT OR IGNORE INTO company_settings (id) VALUES (1)")
    db.commit()
    db.close()


if __name__ == "__main__":
    init_db()
    print("DB initialized")
