import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/adminAuth';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Require admin authentication with permission check
    const permCheck = await requirePermission(request, 'canModerateChat');
    if (!permCheck.authorized) return permCheck.response!;

    const { searchParams } = new URL(request.url);

    // Enhanced filtering parameters
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';
    const bookingStatus = searchParams.get('bookingStatus') || 'all';
    const messageCount = searchParams.get('messageCount') || 'all';
    const dateRange = searchParams.get('dateRange') || 'all';
    const participants = searchParams.get('participants') || '';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

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
              caregiverUser: {
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
              caregiverUser: { include: { profile: true } },
              caregiverProfile: true
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
        caregiverName: `${room.booking.caregiverUser.profile?.firstName} ${room.booking.caregiverUser.profile?.lastName}`,
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

    return apiSuccess(overview);
  } catch (error) {
    console.error('Error fetching chat overview:', error);
    return ApiErrors.internal('Failed to fetch chat overview');
  }
}
