import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/adminAuth';
import { logger, getClientInfo } from '@/lib/logger';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

// Get detailed chat room info for admin
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    // STEP 1: Require admin authentication with permission check
    const permCheck = await requirePermission(request, 'canModerateChat');
    if (!permCheck.authorized) return permCheck.response!;

    const adminUser = permCheck.user!;
    const { roomId } = await params;

    // Log admin action for audit trail
    logger.audit('Admin accessed chat room details', {
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      roomId
    });

    // Get detailed chat room information
    console.log('Fetching chat room:', roomId);

    const chatRoom = await db.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        booking: true,
        messages: {
          include: {
            sender: { include: { profile: true } }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!chatRoom) {
      console.log('Chat room not found');
      logger.security('Admin attempted to access non-existent chat room', {
        adminId: adminUser.id,
        roomId
      });
      return ApiErrors.notFound('Chat room not found');
    }

    console.log('Chat room found, fetching participants...');

    // Fetch parent and caregiver separately
    const [parent, caregiver] = await Promise.all([
      db.user.findUnique({
        where: { id: chatRoom.booking.parentId },
        include: { profile: true }
      }),
      db.user.findUnique({
        where: { id: chatRoom.booking.caregiverId },
        include: { profile: true }
      })
    ]);

    if (!parent || !caregiver) {
      console.log('Missing participants:', { parent: !!parent, caregiver: !!caregiver });
      return ApiErrors.notFound('Participants not found');
    }

    console.log('All data fetched, formatting response...');

    // Format for admin view
    const adminView = {
      id: chatRoom.id,
      booking: {
        id: chatRoom.booking.id,
        status: chatRoom.booking.status,
        startTime: chatRoom.booking.startTime,
        endTime: chatRoom.booking.endTime,
        totalAmount: chatRoom.booking.totalAmount,
        address: chatRoom.booking.address
      },
      participants: {
        parent: {
          id: parent.id,
          name: `${parent.profile?.firstName} ${parent.profile?.lastName}`,
          email: parent.email,
          phone: parent.profile?.phone
        },
        caregiver: {
          id: caregiver.id,
          name: `${caregiver.profile?.firstName} ${caregiver.profile?.lastName}`,
          email: caregiver.email,
          phone: caregiver.profile?.phone
        }
      },
      chatMetadata: {
        isActive: chatRoom.isActive,
        createdAt: chatRoom.createdAt,
        lastMessageAt: chatRoom.lastMessageAt,
        messageCount: chatRoom.messages.length
      },
      messages: chatRoom.messages.map(message => ({
        id: message.id,
        content: message.content,
        messageType: message.messageType,
        sender: {
          id: message.sender.id,
          name: `${message.sender.profile?.firstName} ${message.sender.profile?.lastName}`,
          userType: message.sender.userType
        },
        createdAt: message.createdAt,
        isRead: message.isRead
      }))
    };

    return apiSuccess(adminView);
  } catch (error) {
    console.error('Error fetching admin chat details:', error);
    logger.error('Failed to fetch admin chat room details', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return ApiErrors.internal('Failed to fetch chat details');
  }
}

// Admin actions on chat room
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    // STEP 1: Require admin authentication with permission check
    const permCheck = await requirePermission(request, 'canModerateChat');
    if (!permCheck.authorized) return permCheck.response!;

    const adminUser = permCheck.user!;
    const body = await request.json();
    const { roomId } = await params;
    const { action, reason } = body;

    // Log admin action for audit trail
    logger.audit('Admin chat room action', {
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action,
      roomId,
      reason
    });

    switch (action) {
      case 'disable':
        await db.chatRoom.update({
          where: { id: roomId },
          data: { isActive: false }
        });

        // Create audit log using session admin ID
        await db.notification.create({
          data: {
            userId: adminUser.id, // Use session admin ID, not client-provided
            type: 'admin_action',
            title: 'Chat Room Disabled',
            message: `Chat room ${roomId} disabled by admin. Reason: ${reason || 'No reason provided'}`,
            resourceType: 'chat',
            resourceId: roomId
          }
        });
        break;

      case 'enable':
        await db.chatRoom.update({
          where: { id: roomId },
          data: { isActive: true }
        });

        await db.notification.create({
          data: {
            userId: adminUser.id, // Use session admin ID, not client-provided
            type: 'admin_action',
            title: 'Chat Room Enabled',
            message: `Chat room ${roomId} enabled by admin. Reason: ${reason || 'No reason provided'}`,
            resourceType: 'chat',
            resourceId: roomId
          }
        });
        break;

      default:
        return ApiErrors.badRequest('Invalid action');
    }

    return apiSuccess({ action, roomId });
  } catch (error) {
    console.error('Error performing admin action:', error);
    logger.error('Failed to perform admin chat room action', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return ApiErrors.internal('Failed to perform admin action');
  }
}
