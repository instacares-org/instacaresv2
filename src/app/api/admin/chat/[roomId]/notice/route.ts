import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/adminAuth';
import { logAuditEvent, AuditActions } from '@/lib/audit-log';
import { z } from 'zod';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

const noticeBodySchema = z.object({
  content: z.string().min(1, 'Notice content is required').max(2000, 'Notice content too long').trim(),
  type: z.string().max(50, 'Type too long').optional().default('admin_notice'),
});

// POST - Send an admin notice to a chat room
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;

    // Require admin authentication with permission check
    const permCheck = await requirePermission(req, 'canModerateChat');
    if (!permCheck.authorized) return permCheck.response!;
    const adminUserId = permCheck.user!.id;

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
      return ApiErrors.internal('Admin user not found');
    }

    const body = await req.json();
    const parsed = noticeBodySchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid input', parsed.error.flatten().fieldErrors);
    }

    const { content, type } = parsed.data;

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
      return ApiErrors.notFound('Chat room not found');
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
      adminEmail: permCheck.user!.email,
      action: AuditActions.CHAT_NOTICE_SENT,
      resource: 'chatRoom',
      resourceId: roomId,
      details: { contentLength: content.length },
      request: req,
    });

    return apiSuccess({
      roomId,
      notice: formattedMessage
    }, 'Admin notice sent successfully');

  } catch (error) {
    console.error('Error sending admin notice:', error);
    return ApiErrors.internal('Failed to send admin notice');
  }
}
