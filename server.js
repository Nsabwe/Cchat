require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// ===== MongoDB Connection =====
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/chatapp", {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log("✅ MongoDB connected");
    return true;
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    return false;
  }
};

// ===== Schemas =====
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  profile: { type: String, default: "" },
  socketId: { type: String, default: "" },
  online: { type: Boolean, default: false },
  pushSubscription: { type: Object, default: null }
}, { timestamps: true });

const MessageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  senderName: String,
  senderProfile: String,
  content: String,
  type: { type: String, enum: ["text", "image", "document"], default: "text" },
  history: [{ content: String, editedAt: { type: Date, default: Date.now } }],
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  status: { type: String, enum: ["sent", "delivered", "read"], default: "sent" }
}, { timestamps: true });

const PrivateMessageSchema = new mongoose.Schema({
  room: { type: String, index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  senderName: String,
  content: String,
  history: [{ content: String, editedAt: { type: Date, default: Date.now } }],
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  status: { type: String, enum: ["sent", "delivered", "read"], default: "sent" }
}, { timestamps: true });

const User = mongoose.model("User", UserSchema);
const Message = mongoose.model("Message", MessageSchema);
const PrivateMessage = mongoose.model("PrivateMessage", PrivateMessageSchema);

// ===== File Upload (optional, using multer) =====
const storage = multer.memoryStorage(); // Can change to diskStorage or Cloudinary
const upload = multer({ storage });

// ===== Routes =====

// Save user profile
app.post("/saveProfileURI", async (req, res) => {
  const { name, profile } = req.body;
  const user = new User({ name, profile, online: true });
  await user.save();
  res.json(user);
});

// Save public message
app.post("/saveMessageURI", async (req, res) => {
  const msg = new Message(req.body);
  await msg.save();
  io.emit("newMessage", msg);
  res.json(msg);
});

// Get all messages
app.get("/messages", async (req, res) => {
  const messages = await Message.find().sort({ createdAt: 1 });
  res.json(messages);
});

// Delete a message (soft delete)
app.delete("/message/:id", async (req, res) => {
  const id = req.params.id;
  // Optionally, you can implement per-user soft delete:
  // await Message.findByIdAndUpdate(id, { $push: { deletedFor: userId } });
  await Message.findByIdAndDelete(id);
  io.emit("deleteMessage", id);
  res.json({ success: true });
});

// ===== Socket.IO =====
io.on("connection", socket => {
  console.log("🔵 New socket connected:", socket.id);

  // Join public chat
  socket.on("join", async user => {
    await User.findOneAndUpdate({ name: user.name }, { socketId: socket.id, online: true });
    const users = await User.find({ online: true });
    io.emit("onlineUsers", users);
  });

  // Typing indicators
  socket.on("typing", name => socket.broadcast.emit("typing", name));
  socket.on("stopTyping", () => socket.broadcast.emit("stopTyping"));

  // Delete message
  socket.on("deleteMessage", id => io.emit("deleteMessage", id));

  // Send tip (example)
  socket.on("sendTip", ({ to, amount }) => {
    io.emit("tipUpdate", amount, to);
  });

  // Disconnect
  socket.on("disconnect", async () => {
    await User.findOneAndUpdate({ socketId: socket.id }, { online: false, socketId: "" });
    const users = await User.find({ online: true });
    io.emit("onlineUsers", users);
    console.log("🔴 Socket disconnected:", socket.id);
  });
});

// ===== Start Server =====
const PORT = process.env.PORT || 10000;
(async () => {
  const connected = await connectDB();
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
})();