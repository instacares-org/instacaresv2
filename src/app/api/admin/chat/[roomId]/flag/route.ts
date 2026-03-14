import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/adminAuth';
import { logAuditEvent, AuditActions } from '@/lib/audit-log';
import { z } from 'zod';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

const flagBodySchema = z.object({
  reason: z.string().max(1000, 'Reason too long').optional(),
  flaggedBy: z.string().max(200, 'FlaggedBy too long').optional(),
});

// POST - Flag a chat room for review
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

    const body = await req.json();
    const parsed = flagBodySchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid input', parsed.error.flatten().fieldErrors);
    }

    const { reason, flaggedBy } = parsed.data;

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
      return ApiErrors.notFound('Chat room not found');
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
      adminEmail: permCheck.user!.email,
      action: AuditActions.CHAT_FLAGGED,
      resource: 'chatRoom',
      resourceId: roomId,
      details: { reason: reason || 'Flagged for review' },
      request: req,
    });

    return apiSuccess({
      roomId,
      reason: reason || 'Flagged for review',
      flaggedAt: new Date().toISOString()
    }, 'Chat room flagged for review');

  } catch (error) {
    console.error('Error flagging chat room:', error);
    return ApiErrors.internal('Failed to flag chat room');
  }
}
