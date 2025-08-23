// routes/chat.js
const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const upload = require('../uploadMiddleware');

// Get all messages
router.get('/', async (req, res) => {
  const msgs = await Message.find().populate('user');
  res.json(msgs);
});

// Send message (text + optional media)
router.post('/send', upload.single('media'), async (req, res) => {
  const { userId, content } = req.body;
  const user = await User.findById(userId);
  if (!user) return res.status(400).json({ msg: 'Invalid user' });
  const msg = new Message({
    user: userId,
    content,
    media: req.file ? req.file.filename : undefined,
  });
  await msg.save();
  res.json(msg);
});

module.exports = router;