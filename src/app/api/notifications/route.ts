import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { logger, getClientInfo } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    return NextResponse.json({
      success: true,
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
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { notificationId, markAllAsRead } = body;

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
      // 🔒 STEP 1: Verify the notification exists
      const notification = await db.notification.findUnique({
        where: {
          id: notificationId,
        },
      });

      if (!notification) {
        return NextResponse.json(
          { error: 'Notification not found' },
          { status: 404 }
        );
      }

      // 🔒 STEP 2: Verify ownership - Only allow marking own notifications
      if (notification.userId !== session.user.id) {
        const clientInfo = getClientInfo(request);
        logger.security('IDOR attempt on notification PATCH', {
          attackerUserId: session.user.id,
          targetNotificationId: notificationId,
          targetUserId: notification.userId,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent
        });
        return NextResponse.json(
          { error: 'Unauthorized - You can only modify your own notifications' },
          { status: 403 }
        );
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
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating notifications:', error);
    logger.error('Error updating notifications', { error });
    return NextResponse.json(
      { error: 'Failed to update notifications' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      // 🔒 STEP 1: Verify the notification exists
      const notification = await db.notification.findUnique({
        where: {
          id: notificationId,
        },
      });

      if (!notification) {
        return NextResponse.json(
          { error: 'Notification not found' },
          { status: 404 }
        );
      }

      // 🔒 STEP 2: Verify ownership - Only allow deleting own notifications
      if (notification.userId !== session.user.id) {
        const clientInfo = getClientInfo(request);
        logger.security('IDOR attempt on notification DELETE', {
          attackerUserId: session.user.id,
          targetNotificationId: notificationId,
          targetUserId: notification.userId,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent
        });
        return NextResponse.json(
          { error: 'Unauthorized - You can only delete your own notifications' },
          { status: 403 }
        );
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
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting notifications:', error);
    logger.error('Error deleting notifications', { error });
    return NextResponse.json(
      { error: 'Failed to delete notifications' },
      { status: 500 }
    );
  }
}
