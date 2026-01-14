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
  mongoose.connection.once("open", () => console.log("✅ MongoDB connected"));
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
  const { senderName, senderProfile, content, type } = req.body;

  const msg = new Message({ senderName, senderProfile, content, type });
  await msg.save();

  // Emit new message to all connected clients
  io.emit("newMessage", msg);

  // Push notifications to other users
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
const userTips = new Map(); // userName -> total tips

io.on("connection", async (socket) => {
  console.log("User connected:", socket.id);

  // User joins
  socket.on("join", async (user) => {
    await User.findOneAndUpdate(
      { name: user.name },
      { profile: user.profile, socketId: socket.id },
      { upsert: true, new: true }
    );

    await emitOnlineUsers();
  });

  // Typing indicator
  socket.on("typing", ({ user }) => {
    typingUsers.set(socket.id, user);
    broadcastTyping();
  });
  socket.on("stopTyping", () => {
    typingUsers.delete(socket.id);
    broadcastTyping();
  });

  // Handle tips
  socket.on("sendTip", ({ to, amount }) => {
    if (!userTips.has(to)) userTips.set(to, 0);
    const total = userTips.get(to) + amount;
    userTips.set(to, total);
    io.emit("tipUpdate", total, to);
  });

  // Handle message sent via socket
  socket.on("messageSent", (msg) => {
    io.emit("newMessage", msg);
  });

  // ===== READ RECEIPTS =====
  socket.on("messageRead", async ({ messageId, reader }) => {
    const msg = await Message.findById(messageId);
    if (!msg) return;

    if (!msg.readBy.includes(reader)) {
      msg.readBy.push(reader);
      await msg.save();
    }

    // Notify all clients (or sender) about read status
    io.emit("messageReadUpdate", { messageId, readBy: msg.readBy });
  });

  // Disconnect
  socket.on("disconnect", async () => {
    typingUsers.delete(socket.id);
    await User.findOneAndUpdate({ socketId: socket.id }, { socketId: null });
    await emitOnlineUsers();
    broadcastTyping();
  });

  // ===== Helper functions =====
  async function emitOnlineUsers() {
    const users = await User.find({ socketId: { $ne: null } });
    io.emit("onlineUsers", users); // online users array
    io.emit("onlineCount", users.length); // online count
  }

  function broadcastTyping() {
    const uniqueTypingUsers = [...new Set(typingUsers.values())];
    io.emit("typingUsers", {
      count: uniqueTypingUsers.length,
      users: uniqueTypingUsers,
    });
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));