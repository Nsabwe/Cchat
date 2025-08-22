from flask import Blueprint, request, jsonify
from models import db, Message, User
import os

chat_routes = Blueprint('chat', __name__)

@chat_routes.route('/send', methods=['POST'])
def send_message():
    user_id = request.form['user_id']
    content = request.form.get('content')
    media_type = request.form.get('media_type')
    file = request.files.get('media_file')

    filename = None
    if file:
        filename = f"msg_{user_id}_{file.filename}"
        file.save(os.path.join('uploads', filename))

    msg = Message(
        sender_id=user_id,
        content=content,
        media_type=media_type,
        media_file=filename
    )
    db.session.add(msg)
    db.session.commit()
    return jsonify({"message": "Sent!"})

@chat_routes.route('/messages', methods=['GET'])
def get_messages():
    messages = Message.query.order_by(Message.timestamp.desc()).limit(50).all()
    output = []
    for m in messages:
        output.append({
            "id": m.id,
            "sender_id": m.sender_id,
            "content": m.content,
            "media_type": m.media_type,
            "media_file": m.media_file,
            "timestamp": m.timestamp
        })
    return jsonify(output)