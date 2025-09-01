import { NextRequest } from 'next/server';
import { prisma } from '@/lib/database';
import { getAuthenticatedUser, createApiResponse, formatUserInfo } from '@/lib/chatAuth';
import { logger } from '@/lib/logger';

/**
 * POST /api/chat/messages
 * Send a new message in a conversation
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    
    if (!user) {
      return createApiResponse(false, null, 'Authentication required', 401);
    }

    const body = await request.json();
    const { conversationId, content, messageType = 'TEXT' } = body;

    // Validate required fields
    if (!conversationId || !content?.trim()) {
      return createApiResponse(false, null, 'Conversation ID and message content are required', 400);
    }

    // Validate message type
    if (!['TEXT', 'SYSTEM'].includes(messageType)) {
      return createApiResponse(false, null, 'Invalid message type', 400);
    }

    // Validate content length (max 2000 characters)
    if (content.trim().length > 2000) {
      return createApiResponse(false, null, 'Message content too long (max 2000 characters)', 400);
    }

    logger.info('Sending new message', { 
      userId: user.id, 
      conversationId, 
      messageType,
      contentLength: content.trim().length 
    });

    // Verify the conversation exists and user has access
    const chatRoom = await prisma.chatRoom.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        parentId: true,
        caregiverId: true,
        isActive: true,
        bookingId: true,
        booking: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!chatRoom) {
      return createApiResponse(false, null, 'Conversation not found', 404);
    }

    // Verify user has access to this conversation
    if (chatRoom.parentId !== user.id && chatRoom.caregiverId !== user.id) {
      return createApiResponse(false, null, 'Access denied to this conversation', 403);
    }

    if (!chatRoom.isActive) {
      return createApiResponse(false, null, 'Cannot send message to inactive conversation', 410);
    }

    // Only allow SYSTEM messages from ADMIN users
    if (messageType === 'SYSTEM' && user.userType !== 'ADMIN') {
      return createApiResponse(false, null, 'Only administrators can send system messages', 403);
    }

    // Create the message within a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Create the message
      const message = await tx.message.create({
        data: {
          chatRoomId: conversationId,
          senderId: user.id,
          content: content.trim(),
          messageType: messageType as 'TEXT' | 'SYSTEM',
          isRead: false,
        },
        include: {
          sender: {
            select: {
              id: true,
              userType: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
          },
        },
      });

      // Update the chat room's lastMessageAt timestamp
      await tx.chatRoom.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: new Date(),
        },
      });

      return message;
    });

    // Format the response
    const formattedMessage = {
      id: result.id,
      content: result.content,
      messageType: result.messageType,
      isRead: result.isRead,
      readAt: result.readAt,
      createdAt: result.createdAt,
      sender: formatUserInfo({
        id: result.sender.id,
        email: '', // Not needed for message display
        userType: result.sender.userType as 'PARENT' | 'CAREGIVER' | 'ADMIN',
        profile: result.sender.profile ? {
          firstName: result.sender.profile.firstName,
          lastName: result.sender.profile.lastName,
          avatar: result.sender.profile.avatar || undefined,
        } : undefined,
      }),
      isFromCurrentUser: true,
      conversationId: conversationId,
    };

    logger.info('Message sent successfully', { 
      userId: user.id, 
      messageId: result.id,
      conversationId 
    });

    return createApiResponse(true, formattedMessage, undefined, 201);

  } catch (error) {
    logger.error('Error sending message', error);
    
    // Handle specific database errors
    if (error instanceof Error) {
      if (error.message.includes('Foreign key constraint')) {
        return createApiResponse(false, null, 'Invalid conversation or user reference', 400);
      }
      
      if (error.message.includes('Unique constraint')) {
        return createApiResponse(false, null, 'Message already exists', 409);
      }
    }

    return createApiResponse(false, null, 'Failed to send message', 500);
  }
}