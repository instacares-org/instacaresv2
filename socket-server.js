const { createServer } = require('http');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');

// NextAuth JWT decoding
const { decode } = require('next-auth/jwt');

const prisma = new PrismaClient();
const PORT = process.env.PORT || 3006;

// ============================================
// RATE LIMITING CONFIGURATION
// ============================================
const RATE_LIMITS = {
  send_message: {
    maxRequests: 30,      // Max messages per window
    windowMs: 60000,      // 1 minute window
    blockDurationMs: 300000  // 5 minute block if exceeded
  },
  typing: {
    maxRequests: 60,      // Max typing events per window
    windowMs: 60000,      // 1 minute window
    blockDurationMs: 60000   // 1 minute block if exceeded
  },
  join_room: {
    maxRequests: 20,      // Max room joins per window
    windowMs: 60000,      // 1 minute window
    blockDurationMs: 60000   // 1 minute block if exceeded
  }
};

// Rate limit tracking: Map<socketId, Map<action, { count, windowStart, blockedUntil }>>
const rateLimitStore = new Map();

/**
 * Check if action is rate limited for a socket
 * @returns {object} { allowed: boolean, remaining: number, retryAfter?: number }
 */
function checkRateLimit(socketId, action) {
  const config = RATE_LIMITS[action];
  if (!config) return { allowed: true, remaining: Infinity };

  const now = Date.now();

  if (!rateLimitStore.has(socketId)) {
    rateLimitStore.set(socketId, new Map());
  }

  const socketLimits = rateLimitStore.get(socketId);

  if (!socketLimits.has(action)) {
    socketLimits.set(action, { count: 0, windowStart: now, blockedUntil: 0 });
  }

  const limit = socketLimits.get(action);

  // Check if currently blocked
  if (limit.blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((limit.blockedUntil - now) / 1000)
    };
  }

  // Reset window if expired
  if (now - limit.windowStart > config.windowMs) {
    limit.count = 0;
    limit.windowStart = now;
  }

  // Check if at limit
  if (limit.count >= config.maxRequests) {
    limit.blockedUntil = now + config.blockDurationMs;
    console.log(`[RateLimit] Socket ${socketId} blocked for ${action} until ${new Date(limit.blockedUntil).toISOString()}`);
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil(config.blockDurationMs / 1000)
    };
  }

  // Increment and allow
  limit.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - limit.count
  };
}

/**
 * Clean up rate limit data for disconnected socket
 */
function cleanupRateLimits(socketId) {
  rateLimitStore.delete(socketId);
}

// ============================================
// MESSAGE CONTENT VALIDATION
// ============================================
const MESSAGE_LIMITS = {
  maxLength: 5000,        // Max characters per message
  minLength: 1,           // Min characters (after trim)
  maxConsecutiveChars: 50 // Max same character in a row (spam prevention)
};

// Dangerous patterns to sanitize (XSS prevention)
const DANGEROUS_PATTERNS = [
  /<script\b[^>]*>[\s\S]*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,
  /<object\b[^>]*>[\s\S]*?<\/object>/gi,
  /<embed\b[^>]*>/gi,
  /<link\b[^>]*>/gi,
  /data:text\/html/gi
];

/**
 * Validate and sanitize message content
 * @returns {object} { valid: boolean, sanitized?: string, error?: string }
 */
function validateMessageContent(content, messageType = 'TEXT') {
  // Check if content exists
  if (content === null || content === undefined) {
    return { valid: false, error: 'Message content is required' };
  }

  // Convert to string if needed
  let text = String(content);

  // Trim whitespace
  text = text.trim();

  // Check minimum length
  if (text.length < MESSAGE_LIMITS.minLength) {
    return { valid: false, error: 'Message cannot be empty' };
  }

  // Check maximum length
  if (text.length > MESSAGE_LIMITS.maxLength) {
    return { valid: false, error: `Message exceeds maximum length of ${MESSAGE_LIMITS.maxLength} characters` };
  }

  // Check for spam patterns (repeated characters)
  const repeatedCharRegex = new RegExp(`(.)\\1{${MESSAGE_LIMITS.maxConsecutiveChars},}`, 'g');
  if (repeatedCharRegex.test(text)) {
    return { valid: false, error: 'Message contains too many repeated characters' };
  }

  // Sanitize dangerous patterns (XSS prevention)
  let sanitized = text;
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Encode HTML entities for safety
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  // For system messages or special types, allow through with sanitization
  if (messageType === 'SYSTEM') {
    // Admin/system messages may need different handling
    return { valid: true, sanitized: text };
  }

  return { valid: true, sanitized };
}

/**
 * Validate room ID format
 */
function validateRoomId(roomId) {
  if (!roomId || typeof roomId !== 'string') {
    return { valid: false, error: 'Invalid room ID' };
  }
  // CUID format validation (Prisma default)
  if (!/^c[a-z0-9]{24,}$/i.test(roomId)) {
    return { valid: false, error: 'Invalid room ID format' };
  }
  return { valid: true };
}

// Create HTTP server
const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'socket-server' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('InstaCares Socket.IO Server');
});

// Create Socket.IO server
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',')
      : process.env.NODE_ENV === 'production'
        ? ['https://instacares.com', 'https://www.instacares.com']
        : ['http://localhost:3000', 'http://localhost:3005'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  path: '/socket.io/',
  transports: ['websocket', 'polling']
});

// Store online users
const onlineUsers = new Map();

// Parse cookies helper
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  });
  return cookies;
}

// Verify JWT token from NextAuth session
async function verifySocketAuth(cookieHeader) {
  if (!cookieHeader) {
    console.log('[Socket] No cookie header');
    return { isValid: false };
  }

  try {
    const cookies = parseCookies(cookieHeader);
    const sessionToken = cookies['next-auth.session-token'] ||
                        cookies['__Secure-next-auth.session-token'];

    if (!sessionToken) {
      console.log('[Socket] No session token found in cookies');
      return { isValid: false };
    }

    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error('[Socket] NEXTAUTH_SECRET not set');
      return { isValid: false };
    }

    // Use NextAuth's decode function to properly decrypt/verify the token
    const decoded = await decode({
      token: sessionToken,
      secret: secret,
    });

    if (!decoded || !decoded.email) {
      console.log('[Socket] Failed to decode token or missing email');
      return { isValid: false };
    }

    console.log('[Socket] Token decoded successfully for:', decoded.email);

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: decoded.email },
      select: { id: true, email: true, userType: true, isActive: true, approvalStatus: true }
    });

    if (!user || !user.isActive) {
      console.log('[Socket] User not found or inactive');
      return { isValid: false };
    }

    // Match NextAuth's approval checks — reject REJECTED and SUSPENDED users
    if (user.approvalStatus === 'REJECTED' || user.approvalStatus === 'SUSPENDED') {
      console.log('[Socket] User approval status rejected:', user.approvalStatus);
      return { isValid: false };
    }

    return {
      isValid: true,
      userId: user.id,
      userType: user.userType,
      email: user.email
    };
  } catch (error) {
    console.error('[Socket] Auth error:', error.message);
    return { isValid: false };
  }
}

// Authentication middleware
io.use(async (socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    const authResult = await verifySocketAuth(cookieHeader);

    if (!authResult.isValid) {
      console.log('[Socket] Connection rejected - invalid auth');
      return next(new Error('Authentication required'));
    }

    socket.userId = authResult.userId;
    socket.userType = authResult.userType;
    socket.userEmail = authResult.email;

    console.log('[Socket] Connection authenticated:', authResult.userId);
    next();
  } catch (error) {
    console.error('[Socket] Auth middleware error:', error);
    next(new Error('Authentication failed'));
  }
});

// Helper function to get all online user IDs
function getOnlineUserIds() {
  const userIds = new Set();
  onlineUsers.forEach(({ userId }) => userIds.add(userId));
  return Array.from(userIds);
}

// Connection handler
io.on('connection', (socket) => {
  const userId = socket.userId;
  const userType = socket.userType;

  console.log('[Socket] User connected:', userId);

  // Store user info
  onlineUsers.set(socket.id, { userId, userType });

  // Join user-specific room
  socket.join('user:' + userId);

  // Send current online users to the newly connected client
  const currentOnlineUsers = getOnlineUserIds();
  socket.emit('online_users_list', { users: currentOnlineUsers });

  // Broadcast online status to everyone else
  socket.broadcast.emit('user_online', { userId, userType });

  // Handle joining chat rooms
  socket.on('join_room', async ({ roomId }) => {
    try {
      // Rate limit check
      const rateCheck = checkRateLimit(socket.id, 'join_room');
      if (!rateCheck.allowed) {
        socket.emit('error', {
          message: 'Too many room join requests. Please wait.',
          retryAfter: rateCheck.retryAfter
        });
        return;
      }

      // Validate room ID format
      const roomValidation = validateRoomId(roomId);
      if (!roomValidation.valid) {
        socket.emit('error', { message: roomValidation.error });
        return;
      }

      const room = await prisma.chatRoom.findFirst({
        where: {
          id: roomId,
          OR: [
            { parentId: userId },
            { caregiverId: userId }
          ]
        }
      });

      if (!room && userType !== 'ADMIN') {
        socket.emit('error', { message: 'Access denied to this room' });
        return;
      }

      socket.join('room:' + roomId);
      console.log('[Socket] User joined room:', roomId);

      // Notify others in the room that this user joined
      socket.to('room:' + roomId).emit('user_online', { userId, userType });
    } catch (error) {
      console.error('[Socket] Join room error:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Handle leaving rooms
  socket.on('leave_room', ({ roomId }) => {
    socket.leave('room:' + roomId);
  });

  // Handle sending messages
  socket.on('send_message', async ({ roomId, content, messageType = 'TEXT' }) => {
    try {
      const senderId = socket.userId;

      // Rate limit check
      const rateCheck = checkRateLimit(socket.id, 'send_message');
      if (!rateCheck.allowed) {
        socket.emit('message_error', {
          error: 'You are sending messages too quickly. Please wait.',
          retryAfter: rateCheck.retryAfter,
          remaining: 0
        });
        console.log(`[Socket] Rate limited send_message for user ${senderId}`);
        return;
      }

      // Validate room ID format
      const roomValidation = validateRoomId(roomId);
      if (!roomValidation.valid) {
        socket.emit('message_error', { error: roomValidation.error });
        return;
      }

      // Normalize messageType to uppercase enum value
      const normalizedMessageType = (messageType || 'TEXT').toUpperCase();

      // Validate and sanitize message content
      const contentValidation = validateMessageContent(content, normalizedMessageType);
      if (!contentValidation.valid) {
        socket.emit('message_error', { error: contentValidation.error });
        return;
      }

      // Use sanitized content
      const sanitizedContent = contentValidation.sanitized;

      // Verify room access (works for both BOOKING and DIRECT rooms)
      const room = await prisma.chatRoom.findFirst({
        where: {
          id: roomId,
          isActive: true,
          OR: [
            { parentId: senderId },
            { caregiverId: senderId }
          ]
        }
      });

      if (!room) {
        socket.emit('message_error', { error: 'Cannot send message to this room' });
        return;
      }

      // Save message with sanitized content
      const message = await prisma.message.create({
        data: {
          chatRoomId: roomId,
          senderId: senderId,
          content: sanitizedContent,
          messageType: normalizedMessageType,
          isRead: false
        },
        include: {
          sender: {
            include: { profile: true }
          }
        }
      });

      // Update last message timestamp
      await prisma.chatRoom.update({
        where: { id: roomId },
        data: { lastMessageAt: new Date() }
      });

      // Format and broadcast message
      const senderName = (message.sender.profile?.firstName || '') + ' ' + (message.sender.profile?.lastName || '');
      const formattedMessage = {
        id: message.id,
        content: message.content,
        messageType: message.messageType,
        sender: {
          id: message.sender.id,
          name: senderName.trim(),
          userType: message.sender.userType
        },
        createdAt: message.createdAt,
        isRead: message.isRead
      };

      io.to('room:' + roomId).emit('new_message', {
        roomId,
        message: formattedMessage
      });

      // Emit unread count update to the recipient (not the sender)
      const roomData = await prisma.chatRoom.findUnique({
        where: { id: roomId },
        select: { parentId: true, caregiverId: true, bookingId: true }
      });

      if (roomData) {
        const recipientId = roomData.parentId === senderId
          ? roomData.caregiverId
          : roomData.parentId;

        if (recipientId) {
          const unreadCount = await prisma.message.count({
            where: {
              chatRoomId: roomId,
              senderId: { not: recipientId },
              isRead: false
            }
          });

          io.to('user:' + recipientId).emit('unread_count_update', {
            bookingId: roomData.bookingId || null,
            roomId: roomId,
            unreadCount: unreadCount
          });

          console.log('[Socket] Sent unread_count_update to user:', recipientId, 'room:', roomId, 'count:', unreadCount);
        }
      }

    } catch (error) {
      console.error('[Socket] Send message error:', error);
      socket.emit('message_error', { error: 'Failed to send message' });
    }
  });

  // Typing indicators with rate limiting
  socket.on('typing_start', async ({ roomId }) => {
    // Rate limit check for typing events
    const rateCheck = checkRateLimit(socket.id, 'typing');
    if (!rateCheck.allowed) {
      // Silently ignore excessive typing events (don't spam user with errors)
      return;
    }

    // Validate room ID
    const roomValidation = validateRoomId(roomId);
    if (!roomValidation.valid) {
      return; // Silently ignore invalid room IDs for typing
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: socket.userId },
        select: { profile: { select: { firstName: true } } }
      });
      const userName = user?.profile?.firstName || 'User';
      socket.to('room:' + roomId).emit('user_typing', {
        userId: socket.userId,
        userName,
        isTyping: true
      });
    } catch (error) {
      console.error('[Socket] typing_start error:', error);
    }
  });

  socket.on('typing_stop', ({ roomId }) => {
    // Rate limit check for typing events
    const rateCheck = checkRateLimit(socket.id, 'typing');
    if (!rateCheck.allowed) {
      return; // Silently ignore
    }

    // Validate room ID
    const roomValidation = validateRoomId(roomId);
    if (!roomValidation.valid) {
      return;
    }

    socket.to('room:' + roomId).emit('user_typing', {
      userId: socket.userId,
      isTyping: false
    });
  });

  // Read receipts
  socket.on('mark_messages_read', async ({ roomId }) => {
    try {
      await prisma.message.updateMany({
        where: {
          chatRoomId: roomId,
          senderId: { not: socket.userId },
          isRead: false
        },
        data: { isRead: true }
      });

      socket.to('room:' + roomId).emit('messages_read', {
        roomId,
        readBy: socket.userId
      });

      // Also emit unread count update to the current user (now 0)
      const roomData = await prisma.chatRoom.findUnique({
        where: { id: roomId },
        select: { bookingId: true }
      });

      // Emit to self that their unread count is now 0
      io.to('user:' + socket.userId).emit('unread_count_update', {
        bookingId: roomData?.bookingId || null,
        roomId: roomId,
        unreadCount: 0
      });
      console.log('[Socket] Marked messages read, sent unread_count_update to user:', socket.userId, 'room:', roomId, 'count: 0');
    } catch (error) {
      console.error('[Socket] Mark messages read error:', error);
    }
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    console.log('[Socket] User disconnected:', userId);
    const userInfo = onlineUsers.get(socket.id);
    if (userInfo) {
      socket.broadcast.emit('user_offline', {
        userId: userInfo.userId,
        userType: userInfo.userType
      });
      onlineUsers.delete(socket.id);
    }
    // Clean up rate limit data for this socket
    cleanupRateLimits(socket.id);
  });

  // Admin events
  socket.on('admin_join', () => {
    if (socket.userType !== 'ADMIN') {
      socket.emit('error', { message: 'Admin access required' });
      return;
    }
    socket.join('admin_room');
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log('[Socket] Socket.IO server running on port ' + PORT);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Socket] Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});
