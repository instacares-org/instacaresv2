import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { logAuditEvent, AuditActions } from '@/lib/audit-log';

// POST - Send an admin notice to a chat room
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

    // Fetch admin profile for the notice
    const admin = await db.user.findUnique({
      where: { id: adminUserId },
      select: {
        id: true,
        userType: true,
        profile: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!admin) {
      return NextResponse.json({ error: 'Admin user not found' }, { status: 500 });
    }

    const body = await req.json();
    const { content, type = 'admin_notice' } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Notice content is required' }, { status: 400 });
    }

    // Verify chat room exists
    const chatRoom = await db.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        booking: {
          select: {
            id: true,
            parentId: true,
            caregiverId: true
          }
        }
      }
    });

    if (!chatRoom) {
      return NextResponse.json({ error: 'Chat room not found' }, { status: 404 });
    }

    // Create a system message in the chat room for the admin notice
    const message = await db.message.create({
      data: {
        chatRoomId: roomId,
        senderId: adminUserId,
        content: `[Admin Notice] ${content}`,
        messageType: 'SYSTEM',
        isRead: false
      },
      include: {
        sender: {
          include: {
            profile: true
          }
        }
      }
    });

    // Update chat room's last message timestamp
    await db.chatRoom.update({
      where: { id: roomId },
      data: { lastMessageAt: new Date() }
    });

    // Format message for response
    const formattedMessage = {
      id: message.id,
      content: message.content,
      messageType: message.messageType,
      sender: {
        id: message.sender.id,
        name: `Admin ${admin.profile?.firstName || ''}`.trim(),
        userType: 'ADMIN'
      },
      createdAt: message.createdAt,
      isRead: message.isRead
    };

    // Persistent audit log
    logAuditEvent({
      adminId: adminUserId,
      adminEmail: authResult.user!.email,
      action: AuditActions.CHAT_NOTICE_SENT,
      resource: 'chatRoom',
      resourceId: roomId,
      details: { contentLength: content.length },
      request: req,
    });

    return NextResponse.json({
      success: true,
      message: 'Admin notice sent successfully',
      roomId,
      notice: formattedMessage
    });

  } catch (error) {
    console.error('Error sending admin notice:', error);
    return NextResponse.json(
      { error: 'Failed to send admin notice' },
      { status: 500 }
    );
  }
}
