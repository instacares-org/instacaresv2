import { NextRequest } from 'next/server';
import { prisma } from '@/lib/database';
import { getAuthenticatedUser, createApiResponse, formatUserInfo } from '@/lib/chatAuth';
import { logger } from '@/lib/logger';

interface RouteContext {
  params: {
    conversationId: string;
  };
}

/**
 * GET /api/chat/conversations/[conversationId]/messages
 * Get messages for a specific conversation with pagination
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser(request);
    
    if (!user) {
      return createApiResponse(false, null, 'Authentication required', 401);
    }

    const { conversationId } = context.params;
    const { searchParams } = new URL(request.url);
    
    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100); // Max 100 messages per request
    const skip = (page - 1) * limit;

    logger.info('Fetching messages for conversation', { 
      userId: user.id, 
      conversationId, 
      page, 
      limit 
    });

    // First, verify the user has access to this conversation
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
            startTime: true,
            endTime: true,
            status: true,
            address: true,
            childrenCount: true,
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
      return createApiResponse(false, null, 'Conversation is no longer active', 410);
    }

    // Get messages with pagination
    const [messages, totalCount] = await Promise.all([
      prisma.message.findMany({
        where: {
          chatRoomId: conversationId,
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
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.message.count({
        where: {
          chatRoomId: conversationId,
        },
      }),
    ]);

    // Mark messages as read for the current user (only unread messages from other users)
    const unreadMessageIds = messages
      .filter(msg => msg.senderId !== user.id && !msg.isRead)
      .map(msg => msg.id);

    if (unreadMessageIds.length > 0) {
      await prisma.message.updateMany({
        where: {
          id: { in: unreadMessageIds },
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      logger.info('Marked messages as read', { 
        userId: user.id, 
        conversationId, 
        messageCount: unreadMessageIds.length 
      });
    }

    // Format messages for response (reverse to show oldest first)
    const formattedMessages = messages.reverse().map((message) => ({
      id: message.id,
      content: message.content,
      messageType: message.messageType,
      isRead: message.isRead,
      readAt: message.readAt,
      createdAt: message.createdAt,
      sender: formatUserInfo({
        id: message.sender.id,
        email: '', // Not needed for message display
        userType: message.sender.userType as 'PARENT' | 'CAREGIVER' | 'ADMIN',
        profile: message.sender.profile ? {
          firstName: message.sender.profile.firstName,
          lastName: message.sender.profile.lastName,
          avatar: message.sender.profile.avatar || undefined,
        } : undefined,
      }),
      isFromCurrentUser: message.senderId === user.id,
    }));

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    const responseData = {
      messages: formattedMessages,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage,
        hasPreviousPage,
      },
      conversation: {
        id: chatRoom.id,
        bookingId: chatRoom.bookingId,
        booking: chatRoom.booking,
        isActive: chatRoom.isActive,
      },
    };

    logger.info('Successfully fetched messages', { 
      userId: user.id, 
      conversationId, 
      messageCount: formattedMessages.length,
      totalCount,
      page 
    });

    return createApiResponse(true, responseData);

  } catch (error) {
    logger.error('Error fetching messages', error);
    return createApiResponse(false, null, 'Failed to fetch messages', 500);
  }
}