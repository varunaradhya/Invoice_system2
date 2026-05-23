import hashlib

from flask import Blueprint, request, jsonify

from db import get_db

user_bp = Blueprint('users', __name__)


def hash_password(password):
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def ensure_admin_user(db):
    existing = db.execute("SELECT id FROM users WHERE username = 'admin'").fetchone()
    if not existing:
        db.execute("""
            INSERT INTO users (name, username, password_hash, role, permissions)
            VALUES (?, ?, ?, ?, ?)
        """, (
            "Administrator",
            "admin",
            hash_password("admin123"),
            "admin",
            "dashboard,customers,products,quotations,invoices,payments,reports,settings,users"
        ))
        db.commit()


@user_bp.route('/', methods=['GET'])
def list_users():
    db = get_db()
    ensure_admin_user(db)
    rows = db.execute("SELECT id, name, username, role, permissions FROM users ORDER BY id").fetchall()
    db.close()
    return jsonify([dict(row) for row in rows])


@user_bp.route('/', methods=['POST'])
def add_user():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    username = (data.get("username") or "").strip()
    password = data.get("password") or "manager123"
    role = data.get("role") if data.get("role") in ("admin", "manager") else "manager"
    permissions = data.get("permissions") or "dashboard,customers,products,quotations,invoices,payments,reports"

    if not name or not username:
        return jsonify({"error": "Name and username are required"}), 400

    db = get_db()
    ensure_admin_user(db)
    try:
        db.execute("""
            INSERT INTO users (name, username, password_hash, role, permissions)
            VALUES (?, ?, ?, ?, ?)
        """, (name, username, hash_password(password), role, permissions))
        db.commit()
    except Exception:
        db.rollback()
        db.close()
        return jsonify({"error": "Username already exists"}), 400
    db.close()
    return jsonify({"msg": "User added"}), 201


@user_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    db = get_db()
    ensure_admin_user(db)
    row = db.execute("""
        SELECT id, name, username, role, permissions
        FROM users
        WHERE username = ? AND password_hash = ?
    """, ((data.get("username") or "").strip(), hash_password(data.get("password") or ""))).fetchone()
    db.close()
    if not row:
        return jsonify({"error": "Invalid username or password"}), 401
    return jsonify(dict(row))
