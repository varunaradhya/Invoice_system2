from flask import Blueprint, request, jsonify

from db import get_db

settings_bp = Blueprint('settings', __name__)


@settings_bp.route('/', methods=['GET'])
def get_settings():
    db = get_db()
    row = db.execute("SELECT * FROM company_settings WHERE id = 1").fetchone()
    db.close()
    return jsonify(dict(row))


@settings_bp.route('/', methods=['POST'])
def update_settings():
    data = request.get_json() or {}
    db = get_db()
    db.execute("""
        UPDATE company_settings
        SET company_name = ?, address = ?, gst_number = ?, phone = ?, email = ?, logo = ?
        WHERE id = 1
    """, (
        (data.get("company_name") or "").strip(),
        (data.get("address") or "").strip(),
        (data.get("gst_number") or "").strip(),
        (data.get("phone") or "").strip(),
        (data.get("email") or "").strip(),
        data.get("logo") or ""
    ))
    db.commit()
    db.close()
    return jsonify({"msg": "Company settings saved"})
