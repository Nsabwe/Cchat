// server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve frontend files
app.use(express.static('public'));
app.use(express.json());

// Setup storage for image/video uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
});

const upload = multer({ storage: storage });

// In-memory "database"
let chatMessages = [];

// API to send a message
app.post('/api/send-message', (req, res) => {
  const { message, sender = 'Anonymous' } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  const msg = { sender, message, timestamp: new Date().toISOString() };
  chatMessages.push(msg);
  res.json({ success: true, msg });
});

// API to get chat messages
app.get('/api/messages', (req, res) => {
  res.json(chatMessages);
});

// Upload image/video/audio
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ filePath: `/uploads/${req.file.filename}` });
});

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});