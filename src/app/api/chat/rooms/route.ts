import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiCache, cacheKeys, cacheTTL } from '@/lib/cache';
import { withAuth } from '@/lib/auth-middleware';
import { logger, getClientInfo } from '@/lib/logger';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    // STEP 1: Require authentication (REMOVE userId/userType query param vulnerability)
    const authResult = await withAuth(request, 'ANY');
    if (!authResult.isAuthorized) {
      const clientInfo = getClientInfo(request);
      logger.security('Unauthorized chat rooms access attempt', {
        endpoint: '/api/chat/rooms',
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent
      });
      return authResult.response;
    }

    const user = authResult.user!;

    // Use authenticated user ID and type (not query params)
    const userId = user.id;
    const userType = user.userType.toLowerCase();

    // Generate cache key for chat rooms
    const cacheKey = cacheKeys.chatRooms(userId, userType);

    // Try to get from cache first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chatRooms: any[] | null = await apiCache.get<any[]>(cacheKey);

    if (!chatRooms) {
      // Cache miss - fetch from database
      const whereClause = userType === 'parent'
        ? { parentId: userId }
        : { caregiverId: userId };

      try {
        chatRooms = await db.chatRoom.findMany({
        where: {
          ...whereClause,
          isActive: true,
        },
      include: {
        booking: {
          include: {
            parent: {
              include: {
                profile: true,
              },
            },
            caregiverUser: {
              include: {
                profile: true,
              },
            },
          },
        },
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1, // Get the latest message
          include: {
            sender: {
              include: {
                profile: true,
              },
            },
          },
        },
        _count: {
          select: {
            messages: {
              where: {
                senderId: { not: userId },
                isRead: false,
              },
            },
          },
        },
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
    });

        // Cache the results for 2 minutes
        await apiCache.set(cacheKey, chatRooms, cacheTTL.chatRooms);
      } catch (error) {
        console.error('Error fetching chat rooms with booking data, returning empty array:', error);
        logger.error('Chat rooms fetch error', { error, userId });
        chatRooms = []; // Return empty array if there are database consistency issues
      }
    }

    // Filter out chat rooms without bookings and transform the data for the frontend
    const validRooms = chatRooms.filter(room => room.booking !== null);
    const formattedRooms = validRooms.map((room) => ({
      id: room.id,
      booking: {
        id: room.booking.id,
        startTime: room.booking.startTime,
        endTime: room.booking.endTime,
        status: room.booking.status,
        address: room.booking.address,
        childrenCount: room.booking.childrenCount,
        parent: {
          id: room.booking.parent.id,
          email: room.booking.parent.email,
          profile: {
            firstName: room.booking.parent.profile?.firstName || '',
            lastName: room.booking.parent.profile?.lastName || '',
            phone: room.booking.parent.profile?.phone,
            avatar: room.booking.parent.profile?.avatar,
          },
        },
        caregiver: {
          id: room.booking.caregiverUser.id,
          email: room.booking.caregiverUser.email,
          profile: {
            firstName: room.booking.caregiverUser.profile?.firstName || '',
            lastName: room.booking.caregiverUser.profile?.lastName || '',
            phone: room.booking.caregiverUser.profile?.phone,
            avatar: room.booking.caregiverUser.profile?.avatar,
          },
        },
      },
      lastMessage: room.messages[0] ? {
        id: room.messages[0].id,
        content: room.messages[0].content,
        createdAt: room.messages[0].createdAt,
        sender: {
          id: room.messages[0].senderId,
          userType: room.messages[0].sender.userType,
        },
      } : null,
      unreadCount: room._count.messages,
      lastMessageAt: room.lastMessageAt,
      isActive: room.isActive,
    }));

    logger.info('Chat rooms fetched successfully', {
      userId,
      userType,
      roomCount: formattedRooms.length
    });

    return apiSuccess(formattedRooms);
  } catch (error) {
    console.error('Error fetching chat rooms:', error);
    logger.error('Chat rooms error', { error });
    return ApiErrors.internal('Failed to fetch chat rooms');
  }
}
