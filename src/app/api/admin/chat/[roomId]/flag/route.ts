import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { logAuditEvent, AuditActions } from '@/lib/audit-log';

// POST - Flag a chat room for review
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;

    // Verify admin authentication via session (not query params)
    const authResult = await verifyAdminAuth(req);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error || 'Admin authentication required' }, { status: 401 });
    }
    const adminUserId = authResult.user!.id;

    const body = await req.json();
    const { reason, flaggedBy } = body;

    // Get the chat room
    const chatRoom = await db.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        booking: {
          select: {
            id: true,
            parent: {
              select: {
                id: true,
                email: true,
                profile: {
                  select: {
                    firstName: true,
                    lastName: true
                  }
                }
              }
            },
            caregiverUser: {
              select: {
                id: true,
                email: true,
                profile: {
                  select: {
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!chatRoom) {
      return NextResponse.json({ error: 'Chat room not found' }, { status: 404 });
    }

    // Create a system message to log the flag action in the chat
    await db.message.create({
      data: {
        chatRoomId: roomId,
        senderId: adminUserId,
        content: `[System] This chat has been flagged for review by an administrator. Reason: ${reason || 'No reason provided'}`,
        messageType: 'SYSTEM',
        isRead: false
      }
    });

    // Update chat room's last message timestamp
    await db.chatRoom.update({
      where: { id: roomId },
      data: { lastMessageAt: new Date() }
    });

    // Persistent audit log
    logAuditEvent({
      adminId: adminUserId,
      adminEmail: authResult.user!.email,
      action: AuditActions.CHAT_FLAGGED,
      resource: 'chatRoom',
      resourceId: roomId,
      details: { reason: reason || 'Flagged for review' },
      request: req,
    });

    return NextResponse.json({
      success: true,
      message: 'Chat room flagged for review',
      roomId,
      reason: reason || 'Flagged for review',
      flaggedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error flagging chat room:', error);
    return NextResponse.json(
      { error: 'Failed to flag chat room' },
      { status: 500 }
    );
  }
}
