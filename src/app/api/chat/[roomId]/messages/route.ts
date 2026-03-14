import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth-middleware';
import { logger, getClientInfo } from '@/lib/logger';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

const postMessageSchema = z.object({
  content: z.string().min(1, 'Content is required').max(2000, 'Content must be 2000 characters or less'),
  messageType: z.enum(['TEXT', 'SYSTEM']).default('TEXT'),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    // STEP 1: Require authentication (REMOVE userId query param vulnerability)
    const authResult = await withAuth(request, 'ANY');
    if (!authResult.isAuthorized) {
      const clientInfo = getClientInfo(request);
      logger.security('Unauthorized chat room messages access attempt', {
        endpoint: '/api/chat/[roomId]/messages',
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent
      });
      return authResult.response;
    }

    const user = authResult.user!;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const { roomId } = await params;

    // STEP 2: Verify user has access to this chat room (use session user ID)
    const chatRoom = await db.chatRoom.findFirst({
      where: {
        id: roomId,
        OR: [
          { parentId: user.id },
          { caregiverId: user.id },
        ],
      },
    });

    if (!chatRoom) {
      logger.security('Unauthorized chat room access attempt', {
        userId: user.id,
        roomId
      });
      return ApiErrors.notFound('Chat room not found or access denied');
    }

    // Get messages with pagination
    const skip = (page - 1) * limit;
    const messages = await db.message.findMany({
      where: {
        chatRoomId: roomId,
      },
      include: {
        sender: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      skip,
      take: limit,
    });

    // Format messages for frontend
    const formattedMessages = messages.map((message) => ({
      id: message.id,
      content: message.content,
      messageType: message.messageType,
      sender: {
        id: message.senderId,
        userType: message.sender.userType,
        profile: {
          firstName: message.sender.profile?.firstName || '',
          lastName: message.sender.profile?.lastName || '',
          avatar: message.sender.profile?.avatar,
        },
      },
      isFromMe: message.senderId === user.id, // Use session user ID
      isRead: message.isRead,
      createdAt: message.createdAt,
      readAt: message.readAt,
    }));

    logger.info('Chat room messages fetched', {
      userId: user.id,
      roomId,
      messageCount: formattedMessages.length
    });

    return apiSuccess({
      messages: formattedMessages,
      hasMore: messages.length === limit,
      currentPage: page,
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    logger.error('Chat room messages fetch error', { error });
    return ApiErrors.internal('Failed to fetch messages');
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    // STEP 1: Require authentication
    const authResult = await withAuth(request, 'ANY');
    if (!authResult.isAuthorized) {
      const clientInfo = getClientInfo(request);
      logger.security('Unauthorized message send attempt', {
        endpoint: '/api/chat/[roomId]/messages',
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent
      });
      return authResult.response;
    }

    const user = authResult.user!;
    const body = await request.json();
    const parsed = postMessageSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid input', parsed.error.flatten().fieldErrors);
    }
    const { content, messageType } = parsed.data;

    const { roomId } = await params;

    // STEP 2: Verify user has access to this chat room
    const chatRoom = await db.chatRoom.findFirst({
      where: {
        id: roomId,
        OR: [
          { parentId: user.id },
          { caregiverId: user.id },
        ],
      },
    });

    if (!chatRoom) {
      logger.security('Unauthorized message send to chat room', {
        userId: user.id,
        roomId
      });
      return ApiErrors.notFound('Chat room not found or access denied');
    }

    // STEP 3: Create the message using authenticated user ID
    const message = await db.message.create({
      data: {
        chatRoomId: roomId,
        senderId: user.id, // Use session user ID, not client-provided
        content,
        messageType,
      },
      include: {
        sender: {
          include: {
            profile: true,
          },
        },
      },
    });

    // Update chat room's last message timestamp
    await db.chatRoom.update({
      where: { id: roomId },
      data: { lastMessageAt: new Date() },
    });

    // Create notification for the other user
    const otherUserId = chatRoom.parentId === user.id ? chatRoom.caregiverId : chatRoom.parentId;
    const senderName = `${message.sender.profile?.firstName} ${message.sender.profile?.lastName}`;

    await db.notification.create({
      data: {
        userId: otherUserId,
        type: 'new_message',
        title: 'New Message',
        message: `${senderName} sent you a message: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
        resourceType: 'chat',
        resourceId: roomId,
      },
    });

    logger.info('Message sent successfully', {
      userId: user.id,
      roomId,
      messageId: message.id
    });

    // Format response
    const formattedMessage = {
      id: message.id,
      content: message.content,
      messageType: message.messageType,
      sender: {
        id: message.senderId,
        userType: message.sender.userType,
        profile: {
          firstName: message.sender.profile?.firstName || '',
          lastName: message.sender.profile?.lastName || '',
          avatar: message.sender.profile?.avatar,
        },
      },
      isFromMe: true,
      isRead: message.isRead,
      createdAt: message.createdAt,
      readAt: message.readAt,
    };

    return apiSuccess(formattedMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    logger.error('Message send error', { error });
    return ApiErrors.internal('Failed to send message');
  }
}
