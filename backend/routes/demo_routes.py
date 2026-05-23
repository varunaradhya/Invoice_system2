from flask import Blueprint, jsonify

from seed_demo import seed_demo_data

demo_bp = Blueprint('demo', __name__)


@demo_bp.route('/seed', methods=['POST'])
def seed_demo():
    result = seed_demo_data()
    status = 201 if result["created"] else 200
    return jsonify(result), status
