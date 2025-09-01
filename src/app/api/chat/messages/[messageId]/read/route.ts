import { NextRequest } from 'next/server';
import { prisma } from '@/lib/database';
import { getAuthenticatedUser, createApiResponse } from '@/lib/chatAuth';
import { logger } from '@/lib/logger';

interface RouteContext {
  params: Promise<{
    messageId: string;
  }>;
}

/**
 * PATCH /api/chat/messages/[messageId]/read
 * Mark a specific message as read
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser(request);
    
    if (!user) {
      return createApiResponse(false, null, 'Authentication required', 401);
    }

    const params = await context.params;
    const { messageId } = params;

    logger.info('Marking message as read', { 
      userId: user.id, 
      messageId 
    });

    // First, verify the message exists and get conversation info
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        senderId: true,
        isRead: true,
        readAt: true,
        chatRoom: {
          select: {
            id: true,
            parentId: true,
            caregiverId: true,
            isActive: true,
          },
        },
      },
    });

    if (!message) {
      return createApiResponse(false, null, 'Message not found', 404);
    }

    // Verify user has access to this conversation
    if (message.chatRoom.parentId !== user.id && message.chatRoom.caregiverId !== user.id) {
      return createApiResponse(false, null, 'Access denied to this message', 403);
    }

    // Users can only mark messages as read if they are not the sender
    if (message.senderId === user.id) {
      return createApiResponse(false, null, 'Cannot mark your own message as read', 400);
    }

    // Check if message is already marked as read
    if (message.isRead) {
      logger.info('Message already marked as read', { 
        userId: user.id, 
        messageId,
        readAt: message.readAt 
      });
      
      return createApiResponse(true, {
        messageId: message.id,
        isRead: true,
        readAt: message.readAt,
        alreadyRead: true,
      });
    }

    // Mark the message as read
    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
      select: {
        id: true,
        isRead: true,
        readAt: true,
      },
    });

    logger.info('Message marked as read successfully', { 
      userId: user.id, 
      messageId: updatedMessage.id,
      readAt: updatedMessage.readAt 
    });

    return createApiResponse(true, {
      messageId: updatedMessage.id,
      isRead: updatedMessage.isRead,
      readAt: updatedMessage.readAt,
      alreadyRead: false,
    });

  } catch (error) {
    logger.error('Error marking message as read', error);
    
    // Handle specific database errors
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return createApiResponse(false, null, 'Message read status conflict', 409);
      }
      
      if (error.message.includes('Foreign key constraint')) {
        return createApiResponse(false, null, 'Invalid message reference', 400);
      }
    }

    return createApiResponse(false, null, 'Failed to mark message as read', 500);
  }
}

/**
 * PUT /api/chat/messages/[messageId]/read
 * Legacy endpoint for marking message as read (for compatibility)
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  // Delegate to PATCH handler for consistency
  return PATCH(request, context);
}