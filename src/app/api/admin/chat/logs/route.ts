import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminUserId = searchParams.get('adminUserId');
    const roomId = searchParams.get('roomId');
    const action = searchParams.get('action');
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

    // Build where clause
    const where: any = {};
    if (roomId) where.roomId = roomId;
    if (action) where.action = action;

    // Get moderation logs from database (using Message table for now)
    // In Phase 2, we'll create a proper ModerationLog table
    const logs = await db.message.findMany({
      where: {
        messageType: 'SYSTEM',
        content: {
          contains: 'Admin action'
        }
      },
      include: {
        chatRoom: {
          include: {
            booking: {
              include: {
                parent: { include: { profile: true } },
                caregiver: { include: { profile: true } }
              }
            }
          }
        },
        sender: {
          include: { profile: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset
    });

    const formattedLogs = logs.map(log => ({
      id: log.id,
      roomId: log.chatRoomId,
      action: log.content.includes('disable') ? 'disable' : 
              log.content.includes('enable') ? 'enable' : 'unknown',
      reason: log.content,
      adminId: log.senderId,
      adminName: `${log.sender.profile?.firstName} ${log.sender.profile?.lastName}`,
      roomInfo: {
        parentName: `${log.chatRoom.booking.parent.profile?.firstName} ${log.chatRoom.booking.parent.profile?.lastName}`,
        caregiverName: `${log.chatRoom.booking.caregiver.profile?.firstName} ${log.chatRoom.booking.caregiver.profile?.lastName}`,
        bookingId: log.chatRoom.bookingId
      },
      timestamp: log.createdAt
    }));

    return NextResponse.json({
      success: true,
      logs: formattedLogs,
      pagination: {
        total: formattedLogs.length,
        limit,
        offset,
        hasMore: formattedLogs.length === limit
      }
    });

  } catch (error) {
    console.error('Error fetching moderation logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch moderation logs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminUserId = searchParams.get('adminUserId');

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

    const body = await request.json();
    const { roomId, action, reason, metadata } = body;

    if (!roomId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: roomId, action' },
        { status: 400 }
      );
    }

    // Create a system message in the chat room for logging
    // In Phase 2, we'll use a dedicated moderation log table
    const logMessage = await db.message.create({
      data: {
        chatRoomId: roomId,
        senderId: adminUserId,
        content: `Admin action: ${action}. Reason: ${reason || 'No reason provided'}. Metadata: ${JSON.stringify(metadata || {})}`,
        messageType: 'SYSTEM'
      }
    });

    // Also update the chat room's lastMessageAt
    await db.chatRoom.update({
      where: { id: roomId },
      data: { lastMessageAt: new Date() }
    });

    return NextResponse.json({
      success: true,
      logId: logMessage.id,
      message: 'Moderation action logged successfully'
    });

  } catch (error) {
    console.error('Error logging moderation action:', error);
    return NextResponse.json(
      { error: 'Failed to log moderation action' },
      { status: 500 }
    );
  }
}