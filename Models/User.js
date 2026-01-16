const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  profile: { type: String, default: "" },

  socketId: { type: String, default: "" },
  online: { type: Boolean, default: false },

  // For Web Push notifications
  pushSubscription: { type: Object, default: null },

}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);