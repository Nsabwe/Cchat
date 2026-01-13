require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");
const { User, Message, Tip, mongoose } = require("./db");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));

// ===== Confirm MongoDB connection on server start =====
if (mongoose.connection.readyState === 1) {
    console.log("✅ Connected to MongoDB, server starting...");
} else {
    mongoose.connection.once("open", () => console.log("✅ Connected to MongoDB, server starting..."));
    mongoose.connection.on("error", err => console.error("❌ MongoDB connection error:", err));
}

// ===== REST API =====
app.post("/saveProfileURI", async (req, res) => {
    const { name, profile } = req.body;
    try {
        const user = await User.findOneAndUpdate(
            { name },
            { profile },
            { upsert: true, new: true }
        );
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post("/saveMessageURI", async (req, res) => {
    try {
        const msg = new Message(req.body);
        await msg.save();
        res.json(msg);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/messages", async (req, res) => {
    const messages = await Message.find().sort({ timestamp: 1 });
    res.json(messages);
});

app.delete("/message/:id", async (req, res) => {
    const id = req.params.id;
    await Message.findByIdAndDelete(id);
    io.emit("deleteMessage", id);
    res.json({ success: true });
});

// ===== Socket.IO =====
io.on("connection", async socket => {
    console.log("User connected:", socket.id);

    // Send current online users on connect
    const onlineUsers = await User.find({ socketId: { $ne: null } });
    io.emit("onlineUsers", onlineUsers);

    // Join chat
    socket.on("join", async user => {
        try {
            // Save socketId for online tracking
            await User.findOneAndUpdate(
                { name: user.name },
                { profile: user.profile, socketId: socket.id },
                { upsert: true, new: true }
            );
            const onlineUsers = await User.find({ socketId: { $ne: null } });
            io.emit("onlineUsers", onlineUsers);
        } catch (err) {
            console.error(err);
        }
    });

    // Disconnect
    socket.on("disconnect", async () => {
        await User.findOneAndUpdate({ socketId: socket.id }, { socketId: null });
        const onlineUsers = await User.find({ socketId: { $ne: null } });
        io.emit("onlineUsers", onlineUsers);
    });

    // Chat events
    socket.on("messageSent", msg => io.emit("newMessage", msg));
    socket.on("deleteMessage", async id => {
        await Message.findByIdAndDelete(id);
        io.emit("deleteMessage", id);
    });

    socket.on("typing", data => socket.broadcast.emit("userTyping", data));
    socket.on("stopTyping", data => socket.broadcast.emit("userStopTyping", data));

    socket.on("sendTip", async ({ to, amount }) => {
        const tip = await Tip.findOneAndUpdate(
            { userName: to },
            { $inc: { totalAmount: amount } },
            { upsert: true, new: true }
        );
        io.emit("tipUpdate", tip.totalAmount, to);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));