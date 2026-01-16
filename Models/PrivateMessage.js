const mongoose = require("mongoose");

const PrivateMessageSchema = new mongoose.Schema({
  room: { type: String, index: true }, // unique room ID for two users

  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  senderName: String,

  content: String,

  history: [
    {
      content: String,
      editedAt: { type: Date, default: Date.now }
    }
  ],

  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  status: {
    type: String,
    enum: ["sent", "delivered", "read"],
    default: "sent"
  }

}, { timestamps: true });

module.exports = mongoose.model("PrivateMessage", PrivateMessageSchema);