require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { socketAuth } = require('./utils/socketAuth');
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const userRoutes = require('./routes/users');
const Message = require('./models/Message');
const User = require('./models/User');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Basic CORS middleware (without external package)
app.use((req, res, next) => {
  const origin = process.env.CLIENT_URL || "http://localhost:3000";
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);

io.use(socketAuth);

io.on('connection', (socket) => {
  console.log(`User ${socket.userId} connected`);
  
  socket.join(socket.userId);
  
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    socket.emit('joined-room', roomId);
  });
  
  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
    socket.emit('left-room', roomId);
  });
  
  socket.on('send-message', async (data) => {
    try {
      const message = new Message({
        sender: socket.userId,
        recipient: data.recipient,
        content: data.content,
        messageType: data.messageType || 'text'
      });
      
      const savedMessage = await message.save();
      const populatedMessage = await Message.findById(savedMessage._id)
        .populate('sender', 'username email')
        .populate('recipient', 'username email');
      
      socket.to(data.recipient).emit('receive-message', populatedMessage);
      socket.emit('message-sent', populatedMessage);
      
      await User.findByIdAndUpdate(socket.userId, {
        lastSeen: new Date()
      });
      
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('message-error', { error: 'Failed to send message' });
    }
  });
  
  socket.on('typing', (data) => {
    socket.to(data.recipient).emit('user-typing', {
      userId: socket.userId,
      isTyping: data.isTyping
    });
  });
  
  socket.on('disconnect', async () => {
    try {
      await User.findByIdAndUpdate(socket.userId, {
        lastSeen: new Date(),
        isOnline: false
      });
      
      socket.broadcast.emit('user-offline', socket.userId);
      console.log(`User ${socket.userId} disconnected`);
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
