// models/PrivateMessage.js
const mongoose = require("mongoose");

const privateMessageSchema = new mongoose.Schema({
  room: { type: String, required: true },       // Unique private room identifier
  sender: { type: String, required: true },     // Name of sender
  content: { type: String, required: true },
  status: { type: String, enum: ["sent", "read"], default: "sent" },
  time: { type: Date, default: Date.now }
});

module.exports = mongoose.model("PrivateMessage", privateMessageSchema);