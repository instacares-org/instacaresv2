import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser, formatUserInfo } from '@/lib/chatAuth';
import { logger } from '@/lib/logger';
import { checkRateLimit, RATE_LIMIT_CONFIGS, createRateLimitHeaders } from '@/lib/rate-limit';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';

const sendMessageSchema = z.object({
  conversationId: z.string().min(1, 'Conversation ID is required'),
  content: z.string().min(1, 'Message content is required').max(2000, 'Message content too long (max 2000 characters)'),
  messageType: z.enum(['TEXT', 'SYSTEM']).default('TEXT'),
});

/**
 * POST /api/chat/messages
 * Send a new message in a conversation
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await checkRateLimit(request, RATE_LIMIT_CONFIGS.API_WRITE);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    const user = await getAuthenticatedUser(request);

    if (!user) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const parsed = sendMessageSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid input');
    }
    const { conversationId, content, messageType } = parsed.data;

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
      return ApiErrors.notFound('Conversation not found');
    }

    // Verify user has access to this conversation
    if (chatRoom.parentId !== user.id && chatRoom.caregiverId !== user.id) {
      return ApiErrors.forbidden('Access denied to this conversation');
    }

    if (!chatRoom.isActive) {
      return apiError('Cannot send message to inactive conversation', 410);
    }

    // Only allow SYSTEM messages from ADMIN users
    if (messageType === 'SYSTEM' && user.userType !== 'ADMIN') {
      return ApiErrors.forbidden('Only administrators can send system messages');
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

    return apiSuccess(formattedMessage, 'Created', 201);

  } catch (error) {
    logger.error('Error sending message', error);

    // Handle specific database errors
    if (error instanceof Error) {
      if (error.message.includes('Foreign key constraint')) {
        return ApiErrors.badRequest('Invalid conversation or user reference');
      }

      if (error.message.includes('Unique constraint')) {
        return ApiErrors.conflict('Message already exists');
      }
    }

    return ApiErrors.internal('Failed to send message');
  }
}
