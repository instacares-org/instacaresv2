import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser, formatUserInfo } from '@/lib/chatAuth';
import { logger } from '@/lib/logger';
import { checkRateLimit, RATE_LIMIT_CONFIGS, createRateLimitHeaders } from '@/lib/rate-limit';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

const createConversationSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  otherUserId: z.string().min(1, 'Other user ID is required'),
});

/**
 * GET /api/chat/conversations
 * Get all conversations for the logged-in user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return ApiErrors.unauthorized();
    }

    logger.info('Fetching conversations for user', { userId: user.id, userType: user.userType });

    // Determine query based on user type
    const whereClause = user.userType === 'PARENT'
      ? { parentId: user.id }
      : { caregiverId: user.id };

    const chatRooms = await prisma.chatRoom.findMany({
      where: {
        ...whereClause,
        isActive: true,
      },
      include: {
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
        parent: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        caregiver: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          select: {
            id: true,
            content: true,
            messageType: true,
            createdAt: true,
            senderId: true,
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
        },
        _count: {
          select: {
            messages: {
              where: {
                senderId: { not: user.id },
                isRead: false,
              },
            },
          },
        },
      },
      orderBy: [
        {
          lastMessageAt: { sort: 'desc', nulls: 'last' },
        },
        {
          createdAt: 'desc',
        },
      ],
    });

    const formattedConversations = chatRooms.map((room) => {
      const otherUser = user.userType === 'PARENT' ? room.caregiver : room.parent;
      const lastMessage = room.messages[0];

      return {
        id: room.id,
        bookingId: room.bookingId,
        booking: room.booking,
        otherUser: {
          id: otherUser.id,
          firstName: otherUser.profile?.firstName || '',
          lastName: otherUser.profile?.lastName || '',
          profileImage: otherUser.profile?.avatar
            ? (otherUser.profile.avatar.startsWith('http')
                ? otherUser.profile.avatar
                : `${process.env.NEXT_PUBLIC_BASE_URL || ''}/uploads/avatars/${otherUser.profile.avatar}`)
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(
                `${otherUser.profile?.firstName || ''} ${otherUser.profile?.lastName || ''}`.trim() || otherUser.id.slice(0, 2).toUpperCase()
              )}&size=128&background=6366f1&color=ffffff&bold=true`,
          userType: user.userType === 'PARENT' ? 'CAREGIVER' : 'PARENT',
        },
        lastMessage: lastMessage ? {
          id: lastMessage.id,
          content: lastMessage.content,
          messageType: lastMessage.messageType,
          createdAt: lastMessage.createdAt,
          sender: formatUserInfo({
            id: lastMessage.sender.id,
            email: '', // Not needed for message display
            userType: lastMessage.sender.userType as 'PARENT' | 'CAREGIVER' | 'ADMIN',
            profile: lastMessage.sender.profile ? {
              firstName: lastMessage.sender.profile.firstName,
              lastName: lastMessage.sender.profile.lastName,
              avatar: lastMessage.sender.profile.avatar || undefined,
            } : undefined,
          }),
          isFromCurrentUser: lastMessage.senderId === user.id,
        } : null,
        unreadCount: room._count.messages,
        lastMessageAt: room.lastMessageAt,
        isActive: room.isActive,
      };
    });

    logger.info('Successfully fetched conversations', {
      userId: user.id,
      conversationCount: formattedConversations.length
    });

    return apiSuccess(formattedConversations);

  } catch (error) {
    logger.error('Error fetching conversations', error);
    return ApiErrors.internal('Failed to fetch conversations');
  }
}

/**
 * POST /api/chat/conversations
 * Create or get existing conversation between two users for a booking
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
    const parsed = createConversationSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid input');
    }
    const { bookingId, otherUserId } = parsed.data;

    logger.info('Creating or getting conversation', {
      userId: user.id,
      otherUserId,
      bookingId
    });

    // Verify the booking exists and user has access to it
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        parentId: true,
        caregiverId: true,
        status: true,
      },
    });

    if (!booking) {
      return ApiErrors.notFound('Booking not found');
    }

    // Verify user has access to this booking
    if (booking.parentId !== user.id && booking.caregiverId !== user.id) {
      return ApiErrors.forbidden('Access denied to this booking');
    }

    // Verify the other user is the correct participant
    const expectedOtherUserId = user.id === booking.parentId ? booking.caregiverId : booking.parentId;
    if (otherUserId !== expectedOtherUserId) {
      return ApiErrors.badRequest('Invalid participant for this booking');
    }

    // Check if conversation already exists
    let chatRoom = await prisma.chatRoom.findUnique({
      where: { bookingId },
      include: {
        parent: {
          select: {
            id: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        caregiver: {
          select: {
            id: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
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
      // Create new conversation
      chatRoom = await prisma.chatRoom.create({
        data: {
          bookingId,
          parentId: booking.parentId,
          caregiverId: booking.caregiverId,
          isActive: true,
        },
        include: {
          parent: {
            select: {
              id: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
          },
          caregiver: {
            select: {
              id: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
          },
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

      logger.info('Created new conversation', {
        chatRoomId: chatRoom.id,
        bookingId
      });
    } else {
      logger.info('Found existing conversation', {
        chatRoomId: chatRoom.id,
        bookingId
      });
    }

    const otherUser = user.id === chatRoom.parentId ? chatRoom.caregiver : chatRoom.parent;

    const formattedConversation = {
      id: chatRoom.id,
      bookingId: chatRoom.bookingId,
      booking: chatRoom.booking,
      otherUser: {
        id: otherUser.id,
        firstName: otherUser.profile?.firstName || '',
        lastName: otherUser.profile?.lastName || '',
        profileImage: otherUser.profile?.avatar
          ? (otherUser.profile.avatar.startsWith('http')
              ? otherUser.profile.avatar
              : `${process.env.NEXT_PUBLIC_BASE_URL || ''}/uploads/avatars/${otherUser.profile.avatar}`)
          : `https://ui-avatars.com/api/?name=${encodeURIComponent(
              `${otherUser.profile?.firstName || ''} ${otherUser.profile?.lastName || ''}`.trim() || otherUser.id.slice(0, 2).toUpperCase()
            )}&size=128&background=6366f1&color=ffffff&bold=true`,
        userType: user.id === chatRoom.parentId ? 'CAREGIVER' : 'PARENT',
      },
      lastMessage: null,
      unreadCount: 0,
      lastMessageAt: chatRoom.lastMessageAt,
      isActive: chatRoom.isActive,
    };

    return apiSuccess(formattedConversation);

  } catch (error) {
    logger.error('Error creating/getting conversation', error);
    return ApiErrors.internal('Failed to create/get conversation');
  }
}
