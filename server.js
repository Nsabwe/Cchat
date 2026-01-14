require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const bodyParser = require("body-parser");
const webpush = require("web-push");
const multer = require("multer");
const path = require("path");
const sharp = require("sharp");

const {
  User,
  Message,
  NotificationSubscription,
  mongoose,
} = require("./db");

const app = express();

/* ===================== SERVER (HTTP ONLY) ===================== */
/* Render / Railway / Heroku handle HTTPS for us */
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

/* ===================== UPLOAD HANDLING ===================== */
const upload = multer({ dest: "uploads/" });
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ===================== MIDDLEWARE ===================== */
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));

/* ===================== MONGODB ===================== */
if (mongoose.connection.readyState === 1) {
  console.log("✅ MongoDB connected");
} else {
  mongoose.connection.once("open", () =>
    console.log("✅ MongoDB connected")
  );
}

/* ===================== WEB PUSH ===================== */
webpush.setVapidDetails(
  "mailto:your-email@example.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/* ===================== REST API ===================== */

// Save / update profile
app.post("/saveProfileURI", async (req, res) => {
  const { name, profile } = req.body;
  const user = await User.findOneAndUpdate(
    { name },
    { profile },
    { upsert: true, new: true }
  );
  res.json(user);
});

// Subscribe push notifications
app.post("/subscribe", async (req, res) => {
  const { userName, subscription } = req.body;
  await NotificationSubscription.findOneAndUpdate(
    { userName },
    { subscription },
    { upsert: true, new: true }
  );
  res.status(201).json({ message: "Subscribed successfully" });
});

// Save message (text, image, document)
app.post("/saveMessageURI", upload.single("file"), async (req, res) => {
  const { senderName, senderProfile, content, type } = req.body;
  let fileURL = null;

  if (req.file) {
    const ext = path.extname(req.file.originalname);
    const newFilename = `${req.file.filename}${ext}`;
    const outputPath = path.join(__dirname, "uploads", newFilename);

    if (type === "image") {
      await sharp(req.file.path)
        .resize({ width: 600, height: 600, fit: "inside" })
        .toFile(outputPath);
    } else {
      await fs.promises.rename(req.file.path, outputPath);
    }

    await fs.promises.unlink(req.file.path).catch(() => {});
    fileURL = `/uploads/${newFilename}`;
  }

  const msg = new Message({
    senderName,
    senderProfile,
    content,
    type,
    fileURL,
  });

  await msg.save();
  io.emit("newMessage", msg);

  // Push notifications
  const subscriptions = await NotificationSubscription.find({
    userName: { $ne: senderName },
  });

  subscriptions.forEach((sub) => {
    webpush
      .sendNotification(
        sub.subscription,
        JSON.stringify({
          title: "New Message",
          body:
            type === "text"
              ? content
              : `${senderName} sent a ${type}`,
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

/* ===================== SOCKET.IO ===================== */
const typingUsers = new Map();
const userTips = new Map();

io.on("connection", async (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", async (user) => {
    await User.findOneAndUpdate(
      { name: user.name },
      { profile: user.profile, socketId: socket.id },
      { upsert: true, new: true }
    );
    await emitOnlineUsers();
  });

  socket.on("typing", ({ user }) => {
    typingUsers.set(socket.id, user);
    broadcastTyping();
  });

  socket.on("stopTyping", () => {
    typingUsers.delete(socket.id);
    broadcastTyping();
  });

  socket.on("sendTip", ({ to, amount }) => {
    userTips.set(to, (userTips.get(to) || 0) + amount);
    io.emit("tipUpdate", userTips.get(to), to);
  });

  socket.on("messageRead", async ({ messageId, reader }) => {
    const msg = await Message.findById(messageId);
    if (!msg) return;

    if (!msg.readBy.includes(reader)) {
      msg.readBy.push(reader);
      await msg.save();
    }

    io.emit("messageReadUpdate", {
      messageId,
      readBy: msg.readBy,
    });
  });

  socket.on("disconnect", async () => {
    typingUsers.delete(socket.id);
    await User.findOneAndUpdate(
      { socketId: socket.id },
      { socketId: null }
    );
    await emitOnlineUsers();
    broadcastTyping();
  });

  async function emitOnlineUsers() {
    const users = await User.find({ socketId: { $ne: null } });
    io.emit("onlineUsers", users);
    io.emit("onlineCount", users.length);
    io.emit("messageCount", await Message.countDocuments());
  }

  function broadcastTyping() {
    const users = [...new Set(typingUsers.values())];
    io.emit("typingUsers", { count: users.length, users });
  }
});

/* ===================== START SERVER ===================== */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} (HTTPS via Render)`);
});