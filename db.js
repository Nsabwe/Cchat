const mongoose = require("mongoose");

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const userSchema = new mongoose.Schema({
    name: String,
    profile: String,
    socketId: String,
});

const messageSchema = new mongoose.Schema({
    senderName: String,
    senderProfile: String,
    content: String,
    timestamp: { type: Date, default: Date.now },
});

const notificationSubscriptionSchema = new mongoose.Schema({
    userName: { type: String, required: true, unique: true },
    subscription: { type: Object, required: true },
});

const User = mongoose.model("User", userSchema);
const Message = mongoose.model("Message", messageSchema);
const NotificationSubscription = mongoose.model(
    "NotificationSubscription",
    notificationSubscriptionSchema
);

module.exports = { User, Message, NotificationSubscription, mongoose };