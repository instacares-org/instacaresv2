import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');
    const channel = searchParams.get('channel');
    const type = searchParams.get('type');
    const recipient = searchParams.get('recipient');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const priority = searchParams.get('priority');

    const offset = (page - 1) * limit;

    // Build filter conditions
    const where: any = {};
    
    if (status) where.status = status;
    if (channel) where.channel = channel;
    if (type) where.type = type;
    if (priority) where.priority = priority;
    
    if (recipient) {
      where.OR = [
        { recipientEmail: { contains: recipient, mode: 'insensitive' } },
        { recipientPhone: { contains: recipient } },
        { recipientName: { contains: recipient, mode: 'insensitive' } }
      ];
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    // Get notifications with relationships
    const [notifications, totalCount] = await Promise.all([
      prisma.notificationEvent.findMany({
        where,
        include: {
          retries: {
            orderBy: { attemptedAt: 'desc' },
            take: 3
          },
          webhooks: {
            orderBy: { receivedAt: 'desc' },
            take: 5
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.notificationEvent.count({ where })
    ]);

    // Get summary statistics
    const stats = await prisma.notificationEvent.groupBy({
      by: ['status', 'channel'],
      _count: { id: true },
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    });

    // Get critical notifications (failed CRITICAL priority)
    const criticalAlerts = await prisma.notificationEvent.count({
      where: {
        priority: 'CRITICAL',
        status: 'FAILED',
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        }
      }
    });

    // Calculate success rates
    const successRates = await Promise.all([
      // Email success rate
      prisma.notificationEvent.groupBy({
        by: ['status'],
        _count: { id: true },
        where: {
          channel: 'EMAIL',
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }),
      // SMS success rate
      prisma.notificationEvent.groupBy({
        by: ['status'],
        _count: { id: true },
        where: {
          channel: 'SMS',
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    const formatSuccessRate = (results: any[]) => {
      const total = results.reduce((sum, r) => sum + r._count.id, 0);
      const successful = results
        .filter(r => ['DELIVERED', 'SENT'].includes(r.status))
        .reduce((sum, r) => sum + r._count.id, 0);
      return total > 0 ? ((successful / total) * 100).toFixed(1) : '0';
    };

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNextPage: page < Math.ceil(totalCount / limit),
          hasPreviousPage: page > 1
        },
        stats: {
          last24h: stats,
          criticalAlerts,
          successRates: {
            email: formatSuccessRate(successRates[0]),
            sms: formatSuccessRate(successRates[1])
          }
        }
      }
    });

  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch notification history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Retry failed notification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { notificationId, action } = body;

    if (action === 'retry') {
      // Get the notification
      const notification = await prisma.notificationEvent.findUnique({
        where: { id: notificationId }
      });

      if (!notification) {
        return NextResponse.json(
          { success: false, error: 'Notification not found' },
          { status: 404 }
        );
      }

      if (notification.status !== 'FAILED') {
        return NextResponse.json(
          { success: false, error: 'Can only retry failed notifications' },
          { status: 400 }
        );
      }

      if (notification.retryCount >= notification.maxRetries) {
        return NextResponse.json(
          { success: false, error: 'Maximum retry attempts reached' },
          { status: 400 }
        );
      }

      // Update notification for retry
      await prisma.notificationEvent.update({
        where: { id: notificationId },
        data: {
          status: 'QUEUED',
          retryCount: { increment: 1 },
          nextRetryAt: new Date(Date.now() + 60000), // Retry in 1 minute
          errorCode: null,
          errorMessage: null
        }
      });

      // Create retry record
      await prisma.notificationRetry.create({
        data: {
          notificationId,
          attemptNumber: notification.retryCount + 1,
          status: 'QUEUED'
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Notification queued for retry'
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Failed to process notification action:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}