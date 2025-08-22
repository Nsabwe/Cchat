// routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.post('/register', async (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) return res.status(400).json({ msg: 'Invalid data' });
  let user = await User.findOne({ phone });
  if (user) return res.status(400).json({ msg: 'Already registered' });
  user = new User({ name, phone });
  await user.save();
  res.json(user);
});

module.exports = router;
