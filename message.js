// models/Message.js
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  senderName: { type: String, required: true },
  senderProfile: { type: String, default: "" },
  content: { type: String, required: true },
  status: { type: String, enum: ["sent", "read"], default: "sent" },
  time: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Message", messageSchema);