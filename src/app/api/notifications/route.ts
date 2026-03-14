import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { logger, getClientInfo } from '@/lib/logger';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

const patchNotificationSchema = z.object({
  notificationId: z.string().min(1, 'Notification ID is required').optional(),
  markAllAsRead: z.boolean().optional(),
}).refine(
  (data) => data.markAllAsRead || data.notificationId,
  { message: 'Either notificationId or markAllAsRead must be provided' }
);

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const notifications = await db.notification.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // Limit to 50 recent notifications
    });

    return apiSuccess({
      notifications: notifications.map(notification => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        isRead: notification.isRead,
        resourceType: notification.resourceType,
        resourceId: notification.resourceId,
        timestamp: notification.createdAt,
        readAt: notification.readAt,
      }))
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    logger.error('Error fetching notifications', { error });
    return ApiErrors.internal('Failed to fetch notifications');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const parsed = patchNotificationSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid input', parsed.error.flatten().fieldErrors);
    }
    const { notificationId, markAllAsRead } = parsed.data;

    if (markAllAsRead) {
      // Mark all notifications as read for this user
      await db.notification.updateMany({
        where: {
          userId: session.user.id,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      logger.info('All notifications marked as read', {
        userId: session.user.id
      });
    } else if (notificationId) {
      // STEP 1: Verify the notification exists
      const notification = await db.notification.findUnique({
        where: {
          id: notificationId,
        },
      });

      if (!notification) {
        return ApiErrors.notFound('Notification not found');
      }

      // STEP 2: Verify ownership - Only allow marking own notifications
      if (notification.userId !== session.user.id) {
        const clientInfo = getClientInfo(request);
        logger.security('IDOR attempt on notification PATCH', {
          attackerUserId: session.user.id,
          targetNotificationId: notificationId,
          targetUserId: notification.userId,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent
        });
        return ApiErrors.forbidden('Unauthorized - You can only modify your own notifications');
      }

      // Mark specific notification as read
      await db.notification.update({
        where: {
          id: notificationId,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      logger.info('Notification marked as read', {
        userId: session.user.id,
        notificationId
      });
    } else {
      return ApiErrors.badRequest('Invalid request');
    }

    return apiSuccess();
  } catch (error) {
    console.error('Error updating notifications:', error);
    logger.error('Error updating notifications', { error });
    return ApiErrors.internal('Failed to update notifications');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const url = new URL(request.url);
    const notificationId = url.searchParams.get('id');
    const deleteAll = url.searchParams.get('deleteAll') === 'true';

    if (deleteAll) {
      // Delete all notifications for the user
      await db.notification.deleteMany({
        where: {
          userId: session.user.id,
        },
      });

      logger.info('All notifications deleted', {
        userId: session.user.id
      });
    } else if (notificationId) {
      // STEP 1: Verify the notification exists
      const notification = await db.notification.findUnique({
        where: {
          id: notificationId,
        },
      });

      if (!notification) {
        return ApiErrors.notFound('Notification not found');
      }

      // STEP 2: Verify ownership - Only allow deleting own notifications
      if (notification.userId !== session.user.id) {
        const clientInfo = getClientInfo(request);
        logger.security('IDOR attempt on notification DELETE', {
          attackerUserId: session.user.id,
          targetNotificationId: notificationId,
          targetUserId: notification.userId,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent
        });
        return ApiErrors.forbidden('Unauthorized - You can only delete your own notifications');
      }

      // Delete specific notification
      await db.notification.delete({
        where: {
          id: notificationId,
        },
      });

      logger.info('Notification deleted', {
        userId: session.user.id,
        notificationId
      });
    } else {
      return ApiErrors.badRequest('Invalid request');
    }

    return apiSuccess();
  } catch (error) {
    console.error('Error deleting notifications:', error);
    logger.error('Error deleting notifications', { error });
    return ApiErrors.internal('Failed to delete notifications');
  }
}
