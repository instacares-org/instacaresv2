import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth-middleware';
import { logger, getClientInfo } from '@/lib/logger';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';
import { apiCache, cacheKeys } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    // STEP 1: Require authentication (REMOVE userId query param vulnerability)
    const authResult = await withAuth(request, 'ANY');
    if (!authResult.isAuthorized) {
      const clientInfo = getClientInfo(request);
      logger.security('Unauthorized mark as read attempt', {
        endpoint: '/api/chat/[roomId]/read',
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent
      });
      return authResult.response;
    }

    const user = authResult.user!;
    const { roomId } = await params;

    // STEP 2: Verify user has access to this chat room
    const chatRoom = await db.chatRoom.findFirst({
      where: {
        id: roomId,
        OR: [
          { parentId: user.id },
          { caregiverId: user.id },
        ],
      },
    });

    if (!chatRoom) {
      logger.security('Unauthorized mark as read for chat room', {
        userId: user.id,
        roomId
      });
      return ApiErrors.notFound('Chat room not found or access denied');
    }

    // STEP 3: Mark all unread messages in this room as read for this user
    const result = await db.message.updateMany({
      where: {
        chatRoomId: roomId,
        senderId: { not: user.id }, // Use session user ID
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    // Invalidate chat rooms cache so next fetch reflects updated unread counts
    const userType = user.userType?.toLowerCase() || 'parent';
    await apiCache.delete(cacheKeys.chatRooms(user.id, userType));

    logger.info('Messages marked as read', {
      userId: user.id,
      roomId,
      messagesUpdated: result.count
    });

    return apiSuccess({ messagesUpdated: result.count });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    logger.error('Mark as read error', { error });
    return ApiErrors.internal('Failed to mark messages as read');
  }
}
