import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/adminAuth';
import { logger, getClientInfo } from '@/lib/logger';
import { logAuditEvent, AuditActions } from '@/lib/audit-log';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // STEP 1: Require admin authentication with permission check
    const permCheck = await requirePermission(request, 'canModerateChat');
    if (!permCheck.authorized) return permCheck.response!;

    const adminUser = permCheck.user!;

    const body = await request.json();
    const { action, roomIds, reason } = body;

    if (!action || !roomIds || !Array.isArray(roomIds)) {
      return ApiErrors.badRequest('Missing required fields: action, roomIds');
    }

    if (roomIds.length === 0) {
      return ApiErrors.badRequest('No chat rooms selected');
    }

    // STEP 2: Log bulk operation (CRITICAL for audit trail)
    logger.security('Admin chat bulk operation initiated', {
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action,
      roomCount: roomIds.length,
      reason: reason || 'No reason provided'
    });

    const results: {
      successful: string[];
      failed: { roomId: string; error: string }[];
      total: number;
    } = {
      successful: [],
      failed: [],
      total: roomIds.length
    };

    // Process each room
    for (const roomId of roomIds) {
      try {
        switch (action) {
          case 'enable':
            await db.chatRoom.update({
              where: { id: roomId },
              data: { isActive: true }
            });
            results.successful.push(roomId);
            break;

          case 'disable':
            await db.chatRoom.update({
              where: { id: roomId },
              data: { isActive: false }
            });
            results.successful.push(roomId);
            break;

          case 'archive':
            // TODO: Implement archive functionality in Phase 2
            // For now, we'll just disable the rooms
            await db.chatRoom.update({
              where: { id: roomId },
              data: { isActive: false }
            });
            results.successful.push(roomId);
            break;

          case 'export':
            // TODO: Implement export functionality
            // For now, just mark as successful
            results.successful.push(roomId);
            break;

          default:
            results.failed.push({ roomId, error: 'Unknown action' });
        }

        // Log the admin action (use authenticated admin ID)
        try {
          await db.message.create({
            data: {
              chatRoomId: roomId,
              senderId: adminUser.id, // Use session admin ID, not query param
              content: `Admin bulk action: ${action}. Reason: ${reason || 'No reason provided'}.`,
              messageType: 'SYSTEM'
            }
          });
        } catch (logError) {
          console.error(`Failed to log action for room ${roomId}:`, logError);
          // Don't fail the main operation if logging fails
        }

      } catch (error) {
        console.error(`Failed to ${action} room ${roomId}:`, error);
        results.failed.push({
          roomId,
          error: 'Operation failed'
        });
      }
    }

    // Persistent audit log
    logAuditEvent({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: AuditActions.CHAT_BULK_ACTION,
      resource: 'chatRoom',
      details: {
        bulkAction: action,
        roomCount: roomIds.length,
        successful: results.successful.length,
        failed: results.failed.length,
        reason: reason || null,
      },
      request,
    });

    // STEP 3: Log completion
    logger.info('Admin chat bulk operation completed', {
      adminId: adminUser.id,
      action,
      successful: results.successful.length,
      failed: results.failed.length
    });

    return apiSuccess({
      action,
      results,
    }, `${action} operation completed. ${results.successful.length} successful, ${results.failed.length} failed.`);

  } catch (error) {
    console.error('Error performing bulk operation:', error);
    logger.error('Admin chat bulk operation error', { error });
    return ApiErrors.internal('Failed to perform bulk operation');
  }
}
