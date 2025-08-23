const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// 🔹 Middleware to parse JSON request bodies
app.use(express.json());

// 🔹 Serve static files (HTML, CSS, JS)
app.use(express.static(__dirname));

// 🔹 In-memory store (for demo purposes)
const messages = [];

// 🔹 Backend route to receive messages
app.post("/api/message", (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  messages.push(message); // save the message (in-memory)
  console.log("Message received:", message);
  res.status(200).json({ success: true, message: "Message saved!" });
});

// 🔹 Fallback for SPA routing
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// 🔹 Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});