import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminUserId = searchParams.get('adminUserId');

    // Enhanced filtering parameters
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';
    const bookingStatus = searchParams.get('bookingStatus') || 'all';
    const messageCount = searchParams.get('messageCount') || 'all';
    const dateRange = searchParams.get('dateRange') || 'all';
    const participants = searchParams.get('participants') || '';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!adminUserId) {
      return NextResponse.json({ error: 'Admin authentication required' }, { status: 401 });
    }

    // Verify admin user
    const adminUser = await db.user.findFirst({
      where: { id: adminUserId, userType: 'ADMIN' }
    });

    if (!adminUser) {
      return NextResponse.json({ error: 'Admin access denied' }, { status: 403 });
    }

    // Build dynamic where clause for filtering
    const buildWhereClause = () => {
      const where: any = {};

      // Status filter
      if (status === 'active') {
        where.isActive = true;
      } else if (status === 'inactive') {
        where.isActive = false;
      }

      // Date range filter
      if (dateRange !== 'all') {
        const now = new Date();
        let dateThreshold: Date;
        
        switch (dateRange) {
          case 'today':
            dateThreshold = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case 'quarter':
            dateThreshold = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          default:
            dateThreshold = new Date(0);
        }
        
        where.lastMessageAt = { gte: dateThreshold };
      }

      // Booking status filter
      if (bookingStatus !== 'all') {
        where.booking = {
          status: bookingStatus.toUpperCase()
        };
      }

      // Search filters (participants, booking ID)
      if (search || participants) {
        const searchTerm = search || participants;
        where.OR = [
          {
            booking: {
              parent: {
                profile: {
                  OR: [
                    { firstName: { contains: searchTerm } },
                    { lastName: { contains: searchTerm } }
                  ]
                }
              }
            }
          },
          {
            booking: {
              caregiver: {
                profile: {
                  OR: [
                    { firstName: { contains: searchTerm } },
                    { lastName: { contains: searchTerm } }
                  ]
                }
              }
            }
          },
          {
            bookingId: { contains: searchTerm }
          }
        ];
      }

      return where;
    };

    // Get chat statistics
    const [
      totalChatRooms,
      activeChatRooms,
      totalMessages,
      messagesLast24h,
      flaggedChats,
      filteredChatRooms
    ] = await Promise.all([
      // Total chat rooms
      db.chatRoom.count(),
      
      // Active chat rooms (with messages in last 7 days)
      db.chatRoom.count({
        where: {
          lastMessageAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      
      // Total messages
      db.message.count(),
      
      // Messages in last 24 hours
      db.message.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }),
      
      // Flagged chats (inactive chats)
      db.chatRoom.count({
        where: {
          isActive: false
        }
      }),
      
      // Filtered chat rooms based on search criteria
      db.chatRoom.findMany({
        where: buildWhereClause(),
        include: {
          booking: {
            include: {
              parent: { include: { profile: true } },
              caregiver: { include: { profile: true } }
            }
          },
          _count: {
            select: { messages: true }
          }
        },
        orderBy: {
          lastMessageAt: 'desc'
        },
        take: limit,
        skip: offset
      })
    ]);

    // Apply message count filter on the results (since it's complex to do in SQL)
    const finalFilteredRooms = filteredChatRooms.filter(room => {
      if (messageCount === 'all') return true;
      
      const count = room._count.messages;
      switch (messageCount) {
        case 'high':
          return count >= 50;
        case 'medium':
          return count >= 10 && count < 50;
        case 'low':
          return count > 0 && count < 10;
        case 'none':
          return count === 0;
        default:
          return true;
      }
    });

    const overview = {
      statistics: {
        totalChatRooms,
        activeChatRooms,
        totalMessages,
        messagesLast24h,
        flaggedChats,
        activeRate: totalChatRooms > 0 ? Math.round((activeChatRooms / totalChatRooms) * 100) : 0,
        filteredCount: finalFilteredRooms.length
      },
      recentActivity: finalFilteredRooms.map(room => ({
        id: room.id,
        bookingId: room.bookingId,
        parentName: `${room.booking.parent.profile?.firstName} ${room.booking.parent.profile?.lastName}`,
        caregiverName: `${room.booking.caregiver.profile?.firstName} ${room.booking.caregiver.profile?.lastName}`,
        messageCount: room._count.messages,
        lastActivity: room.lastMessageAt,
        isActive: room.isActive,
        bookingStatus: room.booking.status
      })),
      pagination: {
        total: finalFilteredRooms.length,
        limit,
        offset,
        hasMore: finalFilteredRooms.length === limit
      },
      appliedFilters: {
        search,
        status,
        bookingStatus,
        messageCount,
        dateRange,
        participants
      }
    };

    return NextResponse.json(overview);
  } catch (error) {
    console.error('Error fetching chat overview:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat overview' },
      { status: 500 }
    );
  }
}