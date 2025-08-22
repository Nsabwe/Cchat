from app import db

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    email = db.Column(db.String(100), unique=True)
    password = db.Column(db.String(100))  # plaintext for admin access (not secure in real apps)
    is_admin = db.Column(db.Boolean, default=False)
    profile_pic = db.Column(db.String(200))  # filename

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    content = db.Column(db.Text)
    media_type = db.Column(db.String(20))  # text/image/video/voice
    media_file = db.Column(db.String(200))  # filename
    timestamp = db.Column(db.DateTime, server_default=db.func.now())