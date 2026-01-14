require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const bodyParser = require("body-parser");
const webpush = require("web-push");
const {
    User,
    Message,
    NotificationSubscription,
    mongoose,
} = require("./db");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(express.static("public")); // for sw.js

// ===== MongoDB =====
if (mongoose.connection.readyState === 1) {
    console.log("✅ MongoDB connected");
} else {
    mongoose.connection.once("open", () =>
        console.log("✅ MongoDB connected")
    );
}

// ===== Web Push Setup =====
webpush.setVapidDetails(
    "mailto:your-email@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

// ===== REST API =====

// Save/update user profile
app.post("/saveProfileURI", async (req, res) => {
    const { name, profile } = req.body;
    const user = await User.findOneAndUpdate(
        { name },
        { profile },
        { upsert: true, new: true }
    );
    res.json(user);
});

// Subscribe to push notifications
app.post("/subscribe", async (req, res) => {
    const { userName, subscription } = req.body;
    await NotificationSubscription.findOneAndUpdate(
        { userName },
        { subscription },
        { upsert: true, new: true }
    );
    res.status(201).json({ message: "Subscribed successfully" });
});

// Save message and notify users
app.post("/saveMessageURI", async (req, res) => {
    const { senderName, senderProfile, content } = req.body;

    const msg = new Message({ senderName, senderProfile, content });
    await msg.save();

    // Emit new message to all connected clients
    io.emit("newMessage", msg);

    // Push notifications to all other users
    const subscriptions = await NotificationSubscription.find({
        userName: { $ne: senderName },
    });
    subscriptions.forEach((sub) => {
        webpush
            .sendNotification(
                sub.subscription,
                JSON.stringify({
                    title: "New Message",
                    body: `${senderName} sent you a message`,
                    icon: "/icon.png",
                    tag: "chat-message",
                    renotify: true,
                })
            )
            .catch((err) => console.error("Push error:", err));
    });

    res.json(msg);
});

// Get all messages
app.get("/messages", async (req, res) => {
    const messages = await Message.find().sort({ timestamp: 1 });
    res.json(messages);
});

// Delete message
app.delete("/message/:id", async (req, res) => {
    await Message.findByIdAndDelete(req.params.id);
    io.emit("deleteMessage", req.params.id);
    res.json({ success: true });
});

// ===== SOCKET.IO =====
const typingUsers = new Map(); // socket.id -> userName

io.on("connection", async (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join", async (user) => {
        await User.findOneAndUpdate(
            { name: user.name },
            { profile: user.profile, socketId: socket.id },
            { upsert: true, new: true }
        );
        const users = await User.find({ socketId: { $ne: null } });
        io.emit("onlineUsers", users);
    });

    socket.on("typing", ({ user }) => {
        typingUsers.set(socket.id, user);
        io.emit("typingUsers", [...new Set(typingUsers.values())]);
    });

    socket.on("stopTyping", () => {
        typingUsers.delete(socket.id);
        io.emit("typingUsers", [...new Set(typingUsers.values())]);
    });

    socket.on("disconnect", async () => {
        typingUsers.delete(socket.id);
        await User.findOneAndUpdate(
            { socketId: socket.id },
            { socketId: null }
        );
        const users = await User.find({ socketId: { $ne: null } });
        io.emit("onlineUsers", users);
        io.emit("typingUsers", [...new Set(typingUsers.values())]);
    });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
    console.log(`🚀 Server running on port ${PORT}`)
);