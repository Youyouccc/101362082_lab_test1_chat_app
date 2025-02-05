require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const Message = require("./models/Message");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose
  .connect('mongodb://localhost:27017/chat_app') //should be connect to the database "chat_app", but dont know why is not working
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Authentication Routes
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { username, firstname, lastname, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, firstname, lastname, password: hashedPassword });
    await newUser.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(400).json({ message: "Error registering user" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.json({ token, username: user.username });
  } catch (error) {
    res.status(400).json({ message: "Error logging in" });
  }
});

// Chat Routes
app.post("/api/chat/send", async (req, res) => {
  try {
    const { from_user, room, message } = req.body;
    const newMessage = new Message({ from_user, room, message, date_sent: new Date() });
    await newMessage.save();
    res.status(201).json({ message: "Message sent" });
  } catch (error) {
    res.status(500).json({ message: "Error sending message" });
  }
});

app.get("/api/chat/messages/:room", async (req, res) => {
  try {
    const messages = await Message.find({ room: req.params.room });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: "Error fetching messages" });
  }
});


// Socket.io Chat Logic
io.on("connection", (socket) => {
  console.log("User connected", socket.id);

  socket.on("joinRoom", (room) => {
    socket.join(room);
    console.log(`User joined room: ${room}`);
  });
  
  socket.on('leaveRoom', (room) => {
    socket.leave(room);
    console.log(`User left room: ${room}`);
  });

  socket.on("chatMessage", async ({ room, message, user }) => {
    io.to(room).emit("message", { user, message });
    await new Message({ from_user: user, room, message, date_sent: new Date() }).save();
  });

  socket.on("typing", ({ room, user }) => {
    socket.to(room).emit("userTyping", user);
  });

  socket.on("logout", () => {
    socket.disconnect();
    console.log("User disconnected");
  });
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});