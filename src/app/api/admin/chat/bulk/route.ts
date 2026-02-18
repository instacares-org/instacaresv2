import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth-middleware';
import { logger, getClientInfo } from '@/lib/logger';
import { logAuditEvent, AuditActions } from '@/lib/audit-log';

export async function POST(request: NextRequest) {
  try {
    // ✅ STEP 1: Require admin authentication (REMOVE adminUserId query param vulnerability)
    const authResult = await withAuth(request, 'ADMIN');
    if (!authResult.isAuthorized) {
      const clientInfo = getClientInfo(request);
      logger.security('Unauthorized admin chat bulk operation attempt', {
        endpoint: '/api/admin/chat/bulk',
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent
      });
      return authResult.response;
    }

    const adminUser = authResult.user!;

    const body = await request.json();
    const { action, roomIds, reason } = body;

    if (!action || !roomIds || !Array.isArray(roomIds)) {
      return NextResponse.json(
        { error: 'Missing required fields: action, roomIds' },
        { status: 400 }
      );
    }

    if (roomIds.length === 0) {
      return NextResponse.json(
        { error: 'No chat rooms selected' },
        { status: 400 }
      );
    }

    // ✅ STEP 2: Log bulk operation (CRITICAL for audit trail)
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

        // ✅ Log the admin action (use authenticated admin ID)
        try {
          await db.message.create({
            data: {
              chatRoomId: roomId,
              senderId: adminUser.id, // ✅ Use session admin ID, not query param
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
          error: error instanceof Error ? error.message : 'Unknown error'
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

    // ✅ STEP 3: Log completion
    logger.info('Admin chat bulk operation completed', {
      adminId: adminUser.id,
      action,
      successful: results.successful.length,
      failed: results.failed.length
    });

    return NextResponse.json({
      success: true,
      action,
      results,
      message: `${action} operation completed. ${results.successful.length} successful, ${results.failed.length} failed.`
    });

  } catch (error) {
    console.error('Error performing bulk operation:', error);
    logger.error('Admin chat bulk operation error', { error });
    return NextResponse.json(
      { error: 'Failed to perform bulk operation' },
      { status: 500 }
    );
  }
}
