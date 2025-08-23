import { NextRequest } from 'next/server';
import { Server } from 'socket.io';
import { db } from '@/lib/db';

// Global variable to store the Socket.IO server
let io: Server;

export async function GET(req: NextRequest) {
  if (!io) {
    // Create Socket.IO server on first request
    const { res } = req as any;
    
    io = new Server(res.socket.server, {
      path: '/api/socket',
      addTrailingSlash: false,
      cors: {
        origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:3000',
        methods: ['GET', 'POST']
      }
    });

    // Store online users
    const onlineUsers = new Map();

    io.on('connection', (socket) => {
      console.log(`User connected: ${socket.id}`);

      // Handle user joining
      socket.on('join', ({ userId, userType }) => {
        console.log(`User ${userId} (${userType}) joined`);
        
        // Store user info
        onlineUsers.set(socket.id, { userId, userType });
        socket.userId = userId;
        socket.userType = userType;

        // Join user-specific room
        socket.join(`user:${userId}`);

        // Broadcast online status
        socket.broadcast.emit('user_online', { userId, userType });
      });

      // Handle joining chat rooms
      socket.on('join_room', ({ roomId, userId }) => {
        console.log(`User ${userId} joined room ${roomId}`);
        socket.join(`room:${roomId}`);
      });

      // Handle leaving chat rooms
      socket.on('leave_room', ({ roomId, userId }) => {
        console.log(`User ${userId} left room ${roomId}`);
        socket.leave(`room:${roomId}`);
      });

      // Handle new messages
      socket.on('send_message', async ({ roomId, content, senderId, messageType = 'text' }) => {
        try {
          // Save message to database
          const message = await db.message.create({
            data: {
              chatRoomId: roomId,
              senderId: senderId,
              content: content,
              messageType: messageType,
              isRead: false
            },
            include: {
              sender: {
                include: {
                  profile: true
                }
              }
            }
          });

          // Update chat room's last message timestamp
          await db.chatRoom.update({
            where: { id: roomId },
            data: { lastMessageAt: new Date() }
          });

          // Format message for broadcast
          const formattedMessage = {
            id: message.id,
            content: message.content,
            messageType: message.messageType,
            sender: {
              id: message.sender.id,
              name: `${message.sender.profile?.firstName || ''} ${message.sender.profile?.lastName || ''}`.trim(),
              userType: message.sender.userType
            },
            createdAt: message.createdAt,
            isRead: message.isRead
          };

          // Broadcast message to all users in the room
          io.to(`room:${roomId}`).emit('new_message', {
            roomId,
            message: formattedMessage
          });

          console.log(`Message sent in room ${roomId} by user ${senderId}`);

        } catch (error) {
          console.error('Error sending message:', error);
          socket.emit('message_error', { error: 'Failed to send message' });
        }
      });

      // Handle typing indicators
      socket.on('typing_start', ({ roomId, userId, userName }) => {
        socket.to(`room:${roomId}`).emit('user_typing', { userId, userName, isTyping: true });
      });

      socket.on('typing_stop', ({ roomId, userId }) => {
        socket.to(`room:${roomId}`).emit('user_typing', { userId, isTyping: false });
      });

      // Handle message read receipts
      socket.on('mark_messages_read', async ({ roomId, userId }) => {
        try {
          // Mark all unread messages in the room as read for this user
          await db.message.updateMany({
            where: {
              chatRoomId: roomId,
              senderId: { not: userId },
              isRead: false
            },
            data: { isRead: true }
          });

          // Broadcast read receipt
          socket.to(`room:${roomId}`).emit('messages_read', { roomId, readBy: userId });
          
        } catch (error) {
          console.error('Error marking messages as read:', error);
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        
        const userInfo = onlineUsers.get(socket.id);
        if (userInfo) {
          // Broadcast offline status
          socket.broadcast.emit('user_offline', { 
            userId: userInfo.userId, 
            userType: userInfo.userType 
          });
          onlineUsers.delete(socket.id);
        }
      });

      // Admin events
      socket.on('admin_join', ({ adminId }) => {
        socket.join('admin_room');
        console.log(`Admin ${adminId} joined admin room`);
      });

      socket.on('admin_monitor_room', ({ roomId, adminId }) => {
        socket.join(`admin:${roomId}`);
        console.log(`Admin ${adminId} monitoring room ${roomId}`);
      });

      // Handle admin actions
      socket.on('admin_action', async ({ action, roomId, adminId, reason }) => {
        try {
          if (action === 'disable' || action === 'enable') {
            const isActive = action === 'enable';
            
            await db.chatRoom.update({
              where: { id: roomId },
              data: { isActive }
            });

            // Notify users in the room
            io.to(`room:${roomId}`).emit('room_status_changed', {
              roomId,
              isActive,
              reason: reason || `Chat ${action}d by admin`
            });

            // Notify admin room
            io.to('admin_room').emit('room_action_completed', {
              roomId,
              action,
              adminId,
              reason
            });
          }
        } catch (error) {
          console.error('Error performing admin action:', error);
          socket.emit('admin_action_error', { error: 'Failed to perform action' });
        }
      });
    });

    res.socket.server.io = io;
  }

  return new Response('Socket.IO server started', { status: 200 });
}