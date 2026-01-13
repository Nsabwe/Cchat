// db.js
const mongoose = require("mongoose");

// Connect to MongoDB using environment variable or fallback
const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chatapp";

mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("MongoDB connected"))
.catch(err => console.error("MongoDB connection error:", err));

// ===== Schemas =====
const userSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    profile: { type: String, default: "" },
    socketId: { type: String, default: null }
});

const messageSchema = new mongoose.Schema({
    sender: String,
    content: String,
    timestamp: { type: Date, default: Date.now }
});

const tipSchema = new mongoose.Schema({
    userName: { type: String, required: true, unique: true },
    totalAmount: { type: Number, default: 0 }
});

// ===== Models =====
const User = mongoose.model("User", userSchema);
const Message = mongoose.model("Message", messageSchema);
const Tip = mongoose.model("Tip", tipSchema);

// Export models and mongoose
module.exports = { User, Message, Tip, mongoose };