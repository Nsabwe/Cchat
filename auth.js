from flask import Blueprint, request, jsonify, session
from models import db, User
import os

auth_routes = Blueprint('auth', __name__)

@auth_routes.route('/signup', methods=['POST'])
def signup():
    data = request.form
    file = request.files.get('profile_pic')
    
    filename = None
    if file:
        filename = f"profile_{data['email']}.jpg"
        file.save(os.path.join('uploads', filename))

    user = User(
        name=data['name'],
        email=data['email'],
        password=data['password'],  # plaintext for admin
        profile_pic=filename
    )
    db.session.add(user)
    db.session.commit()
    return jsonify({"message": "User created!"})

@auth_routes.route('/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(email=data['email'], password=data['password']).first()
    if user:
        return jsonify({
            "message": "Login successful",
            "user_id": user.id,
            "is_admin": user.is_admin
        })
    return jsonify({"error": "Invalid credentials"}), 401