require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const connectDB = require("./db");
const User = require("./models/User");
const Message = require("./models/Message");
const PrivateMessage = require("./models/PrivateMessage"); // NEW

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// ===== FILE UPLOAD =====
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// ===== ROUTES =====
app.post("/user/save", upload.single("profile"), async (req, res) => {
  const userData = {
    name: req.body.name,
    profile: req.file ? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}` : ""
  };

  const user = new User(userData);
  await user.save();
  res.json(user);
});

app.get("/messages", async (req, res) => {
  const messages = await Message.find().sort({ time: 1 });
  res.json(messages);
});

app.post("/upload", upload.single("file"), (req, res) => {
  res.json({ filename: req.file.filename });
});

// ===== SOCKET.IO =====
io.on("connection", socket => {
  // ----- PUBLIC CHAT -----
  socket.on("join", async user => {
    await User.findByIdAndUpdate(user._id, { socketId: socket.id });
    const users = await User.find();
    io.emit("presence", users);
  });

  socket.on("sendMessage", async data => {
    const sender = await User.findOne({ socketId: socket.id });
    if (!sender) return;

    const msg = new Message({
      senderName: sender.name,
      senderProfile: sender.profile,
      content: data.content,
      status: "sent"
    });

    await msg.save();
    io.emit("newMessage", msg);

    setTimeout(() => {
      msg.status = "read";
      msg.save().then(() => io.emit("updateStatus", { id: msg._id, status: "read" }));
    }, 1000);
  });

  socket.on("typing", name => socket.broadcast.emit("typing", name));
  socket.on("stopTyping", () => socket.broadcast.emit("stopTyping"));

  socket.on("deleteMessage", async id => {
    await Message.findByIdAndDelete(id);
    io.emit("messageDeleted", id);
  });

  socket.on("sendTip", () => {
    io.emit("typing", "Someone is tipping 💰");
    setTimeout(() => io.emit("stopTyping"), 1000);
  });

  // ----- PRIVATE CHAT -----
  socket.on("joinPrivate", async ({ me, other }) => {
    const room = [me, other].sort().join("_"); // unique room
    socket.join(room);

    // Load history from DB
    const history = await PrivateMessage.find({ room }).sort({ time: 1 });
    socket.emit("privateHistory", history);

    console.log(`${me} joined private room with ${other} (${room})`);
  });

  socket.on("sendPrivateMessage", async ({ room, content }) => {
    const sender = await User.findOne({ socketId: socket.id });
    if (!sender) return;

    const msg = {
      sender: sender.name,
      content,
      time: new Date(),
      room,
      status: "sent" // initial status
    };

    // Save to DB
    const dbMsg = new PrivateMessage(msg);
    await dbMsg.save();

    io.to(room).emit("newPrivateMessage", dbMsg);

    // Mark as read after 1 second
    setTimeout(async () => {
      dbMsg.status = "read";
      await dbMsg.save();
      io.to(room).emit("updatePrivateStatus", { id: dbMsg._id, status: "read" });
    }, 1000);
  });

  // ----- DISCONNECT -----
  socket.on("disconnect", async () => {
    await User.findOneAndUpdate({ socketId: socket.id }, { socketId: "" });
    const users = await User.find();
    io.emit("presence", users);
  });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 10000;

(async () => {
  const connected = await connectDB(); // Wait for DB connection
  if (connected) {
    console.log("✅ Server connected to MongoDB and starting...");
  } else {
    console.log("⚠️ Server started without MongoDB connection.");
  }

  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
})();