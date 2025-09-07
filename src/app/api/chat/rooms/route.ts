import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiCache, cacheKeys, cacheTTL } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const userType = searchParams.get('userType');

    if (!userId || !userType) {
      return NextResponse.json({ error: 'User ID and type are required' }, { status: 400 });
    }

    // Generate cache key for chat rooms
    const cacheKey = cacheKeys.chatRooms(userId, userType);
    
    // Try to get from cache first
    let chatRooms = apiCache.get(cacheKey);
    
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
        apiCache.set(cacheKey, chatRooms, cacheTTL.chatRooms);
      } catch (error) {
        console.error('Error fetching chat rooms with booking data, returning empty array:', error);
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

    return NextResponse.json(formattedRooms);
  } catch (error) {
    console.error('Error fetching chat rooms:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat rooms' },
      { status: 500 }
    );
  }
}