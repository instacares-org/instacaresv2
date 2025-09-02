const { createServer } = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const PORT = process.env.WEBSOCKET_PORT || 3007;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET environment variable is required');
  process.exit(1);
}

// Create HTTP server
const httpServer = createServer();

// Create Socket.IO server with CORS configuration
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:3005', 'http://10.0.2.2:3005', 'http://localhost:8081'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Store online users
const onlineUsers = new Map();
const userSockets = new Map(); // Map userId to socket IDs

// Authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      console.log('No token provided - allowing anonymous connection');
      socket.userId = null;
      socket.userType = 'anonymous';
      return next();
    }

    // Verify JWT token
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.userId || decoded.id || decoded.sub;
      socket.userType = decoded.userType || decoded.role || 'user';
      
      console.log(`User ${socket.userId} authenticated with type ${socket.userType}`);
      next();
    } catch (tokenError) {
      console.error('Token verification failed:', tokenError.message);
      // Allow connection but mark as anonymous
      socket.userId = null;
      socket.userType = 'anonymous';
      next();
    }
  } catch (error) {
    console.error('Authentication middleware error:', error.message);
    socket.userId = null;
    socket.userType = 'anonymous';
    next();
  }
});

io.on('connection', (socket) => {
  console.log(`✅ User connected: ${socket.id} (User ID: ${socket.userId})`);
  
  // Store user connection
  if (socket.userId) {
    onlineUsers.set(socket.id, {
      userId: socket.userId,
      userType: socket.userType,
      socketId: socket.id
    });
    
    // Track all sockets for this user (they might have multiple connections)
    if (!userSockets.has(socket.userId)) {
      userSockets.set(socket.userId, new Set());
    }
    userSockets.get(socket.userId).add(socket.id);
    
    // Join user-specific room
    socket.join(`user:${socket.userId}`);
    
    // Broadcast online status
    socket.broadcast.emit('userOnline', {
      userId: socket.userId,
      userType: socket.userType
    });
  }

  // Handle joining rooms
  socket.on('joinRoom', ({ roomId }) => {
    console.log(`User ${socket.userId} joining room ${roomId}`);
    socket.join(`room:${roomId}`);
    socket.emit('joinedRoom', { roomId });
  });

  // Handle leaving rooms
  socket.on('leaveRoom', ({ roomId }) => {
    console.log(`User ${socket.userId} leaving room ${roomId}`);
    socket.leave(`room:${roomId}`);
    socket.emit('leftRoom', { roomId });
  });

  // Handle sending messages
  socket.on('sendMessage', async ({ roomId, message }) => {
    console.log(`Message in room ${roomId} from user ${socket.userId}: ${message}`);
    
    // Broadcast to all users in the room
    io.to(`room:${roomId}`).emit('newMessage', {
      roomId,
      senderId: socket.userId,
      message,
      timestamp: new Date().toISOString()
    });
  });

  // Handle typing indicators
  socket.on('startTyping', ({ roomId }) => {
    socket.to(`room:${roomId}`).emit('userTyping', {
      userId: socket.userId,
      roomId,
      isTyping: true
    });
  });

  socket.on('stopTyping', ({ roomId }) => {
    socket.to(`room:${roomId}`).emit('userStoppedTyping', {
      userId: socket.userId,
      roomId,
      isTyping: false
    });
  });

  // Handle message read receipts
  socket.on('markAsRead', ({ messageId }) => {
    console.log(`Message ${messageId} marked as read by user ${socket.userId}`);
    socket.broadcast.emit('messageRead', {
      messageId,
      readBy: socket.userId,
      timestamp: new Date().toISOString()
    });
  });

  // Handle booking events
  socket.on('requestBooking', (bookingData) => {
    console.log(`Booking request from user ${socket.userId}:`, bookingData);
    
    // Notify the caregiver
    if (bookingData.caregiverId) {
      io.to(`user:${bookingData.caregiverId}`).emit('bookingUpdate', {
        type: 'new_request',
        booking: bookingData,
        fromUserId: socket.userId
      });
    }
  });

  socket.on('confirmBooking', ({ bookingId }) => {
    console.log(`Booking ${bookingId} confirmed by user ${socket.userId}`);
    io.emit('bookingConfirmed', {
      bookingId,
      confirmedBy: socket.userId,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('cancelBooking', ({ bookingId, reason }) => {
    console.log(`Booking ${bookingId} cancelled by user ${socket.userId}`);
    io.emit('bookingCancelled', {
      bookingId,
      cancelledBy: socket.userId,
      reason,
      timestamp: new Date().toISOString()
    });
  });

  // Handle availability updates
  socket.on('updateAvailability', (availability) => {
    console.log(`Availability update from caregiver ${socket.userId}:`, availability);
    
    // Broadcast to all connected clients
    socket.broadcast.emit('availabilityUpdate', {
      caregiverId: socket.userId,
      availability,
      timestamp: new Date().toISOString()
    });
  });

  // Handle caregiver subscriptions
  socket.on('subscribeToCaregiver', ({ caregiverId }) => {
    socket.join(`caregiver:${caregiverId}`);
    console.log(`User ${socket.userId} subscribed to caregiver ${caregiverId}`);
  });

  socket.on('unsubscribeFromCaregiver', ({ caregiverId }) => {
    socket.leave(`caregiver:${caregiverId}`);
    console.log(`User ${socket.userId} unsubscribed from caregiver ${caregiverId}`);
  });

  // Handle user status
  socket.on('setStatus', ({ status }) => {
    console.log(`User ${socket.userId} status changed to ${status}`);
    
    const userInfo = onlineUsers.get(socket.id);
    if (userInfo) {
      userInfo.status = status;
      onlineUsers.set(socket.id, userInfo);
      
      // Broadcast status change
      socket.broadcast.emit('userStatusChanged', {
        userId: socket.userId,
        status,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Handle notifications
  socket.on('sendNotification', ({ targetUserId, notification }) => {
    console.log(`Notification to user ${targetUserId}:`, notification);
    io.to(`user:${targetUserId}`).emit('notification', notification);
  });

  // Handle disconnect
  socket.on('disconnect', (reason) => {
    console.log(`❌ User disconnected: ${socket.id} (User ID: ${socket.userId}) - Reason: ${reason}`);
    
    const userInfo = onlineUsers.get(socket.id);
    if (userInfo) {
      // Remove from online users
      onlineUsers.delete(socket.id);
      
      // Remove socket from user's socket list
      const userSocketSet = userSockets.get(userInfo.userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        
        // If user has no more active sockets, they're offline
        if (userSocketSet.size === 0) {
          userSockets.delete(userInfo.userId);
          
          // Broadcast offline status
          socket.broadcast.emit('userOffline', {
            userId: userInfo.userId,
            userType: userInfo.userType,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error(`Socket error for user ${socket.userId}:`, error);
  });
});

// Start the server
httpServer.listen(PORT, () => {
  console.log(`🚀 WebSocket server running on port ${PORT}`);
  console.log(`🔌 Accepting connections from mobile app and web clients`);
});

// Handle server errors
httpServer.on('error', (error) => {
  console.error('Server error:', error);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  io.close(() => {
    console.log('Socket.IO server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server...');
  io.close(() => {
    console.log('Socket.IO server closed');
    process.exit(0);
  });
});