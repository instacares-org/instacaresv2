import { NextRequest } from 'next/server';
import { prisma } from '@/lib/database';
import { getAuthenticatedUser, createApiResponse, formatUserInfo } from '@/lib/chatAuth';
import { logger } from '@/lib/logger';

/**
 * GET /api/chat/conversations
 * Get all conversations for the logged-in user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    
    if (!user) {
      return createApiResponse(false, null, 'Authentication required', 401);
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

    return createApiResponse(true, formattedConversations);

  } catch (error) {
    logger.error('Error fetching conversations', error);
    return createApiResponse(false, null, 'Failed to fetch conversations', 500);
  }
}

/**
 * POST /api/chat/conversations
 * Create or get existing conversation between two users for a booking
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    
    if (!user) {
      return createApiResponse(false, null, 'Authentication required', 401);
    }

    const body = await request.json();
    const { bookingId, otherUserId } = body;

    if (!bookingId || !otherUserId) {
      return createApiResponse(false, null, 'Booking ID and other user ID are required', 400);
    }

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
      return createApiResponse(false, null, 'Booking not found', 404);
    }

    // Verify user has access to this booking
    if (booking.parentId !== user.id && booking.caregiverId !== user.id) {
      return createApiResponse(false, null, 'Access denied to this booking', 403);
    }

    // Verify the other user is the correct participant
    const expectedOtherUserId = user.id === booking.parentId ? booking.caregiverId : booking.parentId;
    if (otherUserId !== expectedOtherUserId) {
      return createApiResponse(false, null, 'Invalid participant for this booking', 400);
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

    return createApiResponse(true, formattedConversation);

  } catch (error) {
    logger.error('Error creating/getting conversation', error);
    return createApiResponse(false, null, 'Failed to create/get conversation', 500);
  }
}