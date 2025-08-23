import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

    const results = {
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

        // Log the admin action
        try {
          await db.message.create({
            data: {
              chatRoomId: roomId,
              senderId: adminUserId,
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

    return NextResponse.json({
      success: true,
      action,
      results,
      message: `${action} operation completed. ${results.successful.length} successful, ${results.failed.length} failed.`
    });

  } catch (error) {
    console.error('Error performing bulk operation:', error);
    return NextResponse.json(
      { error: 'Failed to perform bulk operation' },
      { status: 500 }
    );
  }
}