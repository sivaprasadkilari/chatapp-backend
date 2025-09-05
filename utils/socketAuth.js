const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Socket.IO authentication middleware
 * Authenticates socket connections using JWT tokens
 */
const socketAuth = async (socket, next) => {
  try {
    // Get token from handshake auth or query
    const token = socket.handshake.auth?.token || 
                 socket.handshake.query?.token ||
                 socket.request.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      console.log('Socket connection denied: No token provided');
      return next(new Error('Authentication required'));
    }

    try {
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from database
      const user = await User.findById(decoded.userId).select('-password');
      
      if (!user) {
        console.log('Socket connection denied: User not found');
        return next(new Error('User not found'));
      }

      // Check if user account is active
      if (!user.isActive) {
        console.log('Socket connection denied: Account deactivated');
        return next(new Error('Account deactivated'));
      }

      // Add user data to socket
      socket.userId = user._id.toString();
      socket.user = user;
      
      console.log(`Socket authenticated for user: ${user.username} (${user._id})`);
      next();

    } catch (tokenError) {
      console.log('Socket connection denied: Invalid token -', tokenError.message);
      
      if (tokenError.name === 'TokenExpiredError') {
        return next(new Error('Token expired'));
      } else if (tokenError.name === 'JsonWebTokenError') {
        return next(new Error('Invalid token'));
      } else {
        return next(new Error('Token verification failed'));
      }
    }

  } catch (error) {
    console.error('Socket auth error:', error);
    next(new Error('Authentication failed'));
  }
};

/**
 * Optional socket authentication
 * Authenticates socket if token is provided, but allows connection without token
 */
const optionalSocketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || 
                 socket.handshake.query?.token ||
                 socket.request.headers?.authorization?.replace('Bearer ', '');

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        
        if (user && user.isActive) {
          socket.userId = user._id.toString();
          socket.user = user;
          console.log(`Socket optionally authenticated for user: ${user.username}`);
        }
      } catch (error) {
        console.log('Optional socket auth failed:', error.message);
        // Don't block connection for optional auth failure
      }
    }
    
    next();
  } catch (error) {
    console.error('Optional socket auth error:', error);
    next(); // Allow connection even if optional auth fails
  }
};

/**
 * Socket connection handler utilities
 */
const socketUtils = {
  /**
   * Join user to their personal room
   */
  joinUserRoom: (socket) => {
    if (socket.userId) {
      const userRoom = `user:${socket.userId}`;
      socket.join(userRoom);
      console.log(`User ${socket.userId} joined room: ${userRoom}`);
    }
  },

  /**
   * Leave user from their personal room
   */
  leaveUserRoom: (socket) => {
    if (socket.userId) {
      const userRoom = `user:${socket.userId}`;
      socket.leave(userRoom);
      console.log(`User ${socket.userId} left room: ${userRoom}`);
    }
  },

  /**
   * Join user to a chat room
   */
  joinChatRoom: (socket, roomId) => {
    if (socket.userId && roomId) {
      const chatRoom = `chat:${roomId}`;
      socket.join(chatRoom);
      console.log(`User ${socket.userId} joined chat room: ${chatRoom}`);
      return chatRoom;
    }
    return null;
  },

  /**
   * Leave user from a chat room
   */
  leaveChatRoom: (socket, roomId) => {
    if (socket.userId && roomId) {
      const chatRoom = `chat:${roomId}`;
      socket.leave(chatRoom);
      console.log(`User ${socket.userId} left chat room: ${chatRoom}`);
      return chatRoom;
    }
    return null;
  },

  /**
   * Get all rooms a socket is in
   */
  getSocketRooms: (socket) => {
    return Array.from(socket.rooms);
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated: (socket) => {
    return !!socket.userId;
  },

  /**
   * Get user info from socket
   */
  getSocketUser: (socket) => {
    return socket.user || null;
  },

  /**
   * Emit to user's personal room
   */
  emitToUser: (io, userId, event, data) => {
    const userRoom = `user:${userId}`;
    io.to(userRoom).emit(event, data);
  },

  /**
   * Emit to chat room
   */
  emitToChatRoom: (io, roomId, event, data) => {
    const chatRoom = `chat:${roomId}`;
    io.to(chatRoom).emit(event, data);
  },

  /**
   * Broadcast to all authenticated users except sender
   */
  broadcastToAuthenticated: (socket, event, data) => {
    socket.broadcast.emit(event, data);
  },

  /**
   * Handle socket disconnection cleanup
   */
  handleDisconnection: async (socket, io) => {
    try {
      if (socket.userId) {
        console.log(`User ${socket.userId} disconnected`);
        
        // Update user's last seen and online status
        await User.findByIdAndUpdate(socket.userId, {
          lastSeen: new Date(),
          isOnline: false
        });

        // Notify other users about offline status
        socket.broadcast.emit('user:status', {
          userId: socket.userId,
          status: 'offline',
          lastSeen: new Date()
        });

        // Leave all rooms
        socketUtils.leaveUserRoom(socket);
      }
    } catch (error) {
      console.error('Socket disconnection cleanup error:', error);
    }
  },

  /**
   * Handle user online status
   */
  handleOnlineStatus: async (socket, io) => {
    try {
      if (socket.userId) {
        // Update user's online status
        await User.findByIdAndUpdate(socket.userId, {
          isOnline: true,
          lastSeen: new Date()
        });

        // Join user's personal room
        socketUtils.joinUserRoom(socket);

        // Notify other users about online status
        socket.broadcast.emit('user:status', {
          userId: socket.userId,
          status: 'online'
        });
      }
    } catch (error) {
      console.error('Socket online status error:', error);
    }
  }
};

/**
 * Rate limiting for socket events
 */
const createSocketRateLimit = (maxEvents = 30, windowMs = 60000) => {
  const eventCounts = new Map();
  
  return (socket, next) => {
    const now = Date.now();
    const windowStart = now - windowMs;
    const socketId = socket.id;
    
    // Clean old events
    if (eventCounts.has(socketId)) {
      const events = eventCounts.get(socketId).filter(time => time > windowStart);
      eventCounts.set(socketId, events);
    }
    
    const events = eventCounts.get(socketId) || [];
    
    if (events.length >= maxEvents) {
      console.warn(`Socket ${socketId} rate limited`);
      return next(new Error('Rate limit exceeded'));
    }
    
    events.push(now);
    eventCounts.set(socketId, events);
    
    next();
  };
};

module.exports = {
  socketAuth,
  optionalSocketAuth,
  socketUtils,
  createSocketRateLimit
};
