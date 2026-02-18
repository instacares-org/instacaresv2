import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { withAuth } from '@/lib/auth-middleware';
import { logger, getClientInfo } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/rooms/find-or-create
 * Find existing chat room for a booking or create one if it doesn't exist
 * Only allowed for PENDING or CONFIRMED bookings
 */
export async function POST(request: NextRequest) {
  const clientInfo = getClientInfo(request);
  
  try {
    // Authenticate user
    const authResult = await withAuth(request, 'ANY');
    if (!authResult.isAuthorized) {
      logger.security('Unauthorized chat room access attempt', {
        endpoint: '/api/chat/rooms/find-or-create',
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent
      });
      return authResult.response;
    }

    const user = authResult.user!;
    const body = await request.json();
    const { bookingId } = body;

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: 'Booking ID is required' },
        { status: 400 }
      );
    }

    // Get the booking and verify user has access
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        parent: {
          include: {
            profile: true
          }
        },
        caregiverUser: {
          include: {
            profile: true
          }
        }
      }
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Verify user is either the parent or caregiver of this booking
    const isParent = booking.parentId === user.id;
    const isCaregiver = booking.caregiverId === user.id;

    if (!isParent && !isCaregiver) {
      logger.security('Unauthorized booking chat access', {
        userId: user.id,
        bookingId,
        ip: clientInfo.ip
      });
      return NextResponse.json(
        { success: false, error: 'You do not have access to this booking' },
        { status: 403 }
      );
    }

    // Only allow messaging for PENDING, CONFIRMED, IN_PROGRESS, or COMPLETED bookings
    const allowedStatuses = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'];
    if (!allowedStatuses.includes(booking.status)) {
      return NextResponse.json(
        { success: false, error: 'Cannot message for this booking status' },
        { status: 400 }
      );
    }

    // Try to find existing chat room
    let chatRoom = await prisma.chatRoom.findUnique({
      where: { bookingId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              include: {
                profile: true
              }
            }
          }
        },
        _count: {
          select: {
            messages: {
              where: {
                senderId: { not: user.id },
                isRead: false
              }
            }
          }
        }
      }
    });

    // If no chat room exists, create one
    if (!chatRoom) {
      chatRoom = await prisma.chatRoom.create({
        data: {
          bookingId,
          parentId: booking.parentId,
          caregiverId: booking.caregiverId,
          isActive: true
        },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: {
                include: {
                  profile: true
                }
              }
            }
          },
          _count: {
            select: {
              messages: {
                where: {
                  senderId: { not: user.id },
                  isRead: false
                }
              }
            }
          }
        }
      });

      logger.info('Chat room created on demand', {
        chatRoomId: chatRoom.id,
        bookingId,
        createdBy: user.id,
        userType: user.userType
      });
    }

    // Format response
    const otherParty = isParent ? booking.caregiverUser : booking.parent;
    
    const response = {
      success: true,
      chatRoom: {
        id: chatRoom.id,
        bookingId: chatRoom.bookingId,
        isActive: chatRoom.isActive,
        lastMessageAt: chatRoom.lastMessageAt,
        createdAt: chatRoom.createdAt,
        otherParty: {
          id: otherParty.id,
          email: otherParty.email,
          userType: isParent ? 'CAREGIVER' : 'PARENT',
          profile: {
            firstName: otherParty.profile?.firstName || '',
            lastName: otherParty.profile?.lastName || '',
            avatar: otherParty.profile?.avatar
          }
        },
        booking: {
          id: booking.id,
          status: booking.status,
          startTime: booking.startTime,
          endTime: booking.endTime,
          address: booking.address
        },
        lastMessage: chatRoom.messages[0] ? {
          id: chatRoom.messages[0].id,
          content: chatRoom.messages[0].content,
          createdAt: chatRoom.messages[0].createdAt,
          senderId: chatRoom.messages[0].senderId
        } : null,
        unreadCount: chatRoom._count.messages
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Error in find-or-create chat room', error);
    return NextResponse.json(
      { success: false, error: 'Failed to access chat room' },
      { status: 500 }
    );
  }
}
