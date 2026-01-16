const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  senderName: String,
  senderProfile: String,
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

module.exports = mongoose.model("Message", MessageSchema);