from flask import Blueprint, request, jsonify
from models import db, User

admin_routes = Blueprint('admin', __name__)

@admin_routes.route('/admin/users', methods=['GET'])
def list_users():
    if request.args.get('admin_key') != 'supersecret':  # simple admin check
        return jsonify({"error": "Not allowed"}), 403
    users = User.query.all()
    return jsonify([{
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "password": u.password,
        "profile_pic": u.profile_pic
    } for u in users])

@admin_routes.route('/admin/delete/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    if request.args.get('admin_key') != 'supersecret':
        return jsonify({"error": "Not allowed"}), 403
    user = User.query.get(user_id)
    if user:
        db.session.delete(user)
        db.session.commit()
        return jsonify({"message": "Deleted"})
    return jsonify({"error": "User not found"})