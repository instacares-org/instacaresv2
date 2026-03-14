import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/adminAuth';
import { logger, getClientInfo } from '@/lib/logger';
import { z } from 'zod';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

const notificationActionSchema = z.object({
  notificationId: z.string().min(1, 'Notification ID is required'),
  action: z.enum(['retry'], {
    message: 'Invalid action. Must be: retry',
  }),
});

export async function GET(request: NextRequest) {
  try {
    // STEP 1: Require admin authentication with permission check
    const permCheck = await requirePermission(request, 'canManageNotifications');
    if (!permCheck.authorized) return permCheck.response!;

    const adminUser = permCheck.user!;

    // Log admin action for audit trail
    logger.admin('Admin accessed notification history', {
      adminId: adminUser.id,
      adminEmail: adminUser.email
    });

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
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });

    // Get critical notifications
    const criticalAlerts = await prisma.notificationEvent.count({
      where: {
        priority: 'CRITICAL',
        status: 'FAILED',
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000)
        }
      }
    });

    // Calculate success rates
    const successRates = await Promise.all([
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

    return apiSuccess({
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
    });

  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    logger.error('Failed to fetch admin notifications', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return ApiErrors.internal('Failed to fetch notification history');
  }
}

export async function POST(request: NextRequest) {
  try {
    // STEP 1: Require admin authentication with permission check
    const permCheck = await requirePermission(request, 'canManageNotifications');
    if (!permCheck.authorized) return permCheck.response!;

    const adminUser = permCheck.user!;
    const body = await request.json();
    const parsed = notificationActionSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid input', parsed.error.flatten().fieldErrors);
    }

    const { notificationId, action } = parsed.data;

    logger.admin('Admin notification action', {
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action,
      notificationId
    });

    if (action === 'retry') {
      const notification = await prisma.notificationEvent.findUnique({
        where: { id: notificationId }
      });

      if (!notification) {
        return ApiErrors.notFound('Notification not found');
      }

      if (notification.status !== 'FAILED') {
        return ApiErrors.badRequest('Can only retry failed notifications');
      }

      if (notification.retryCount >= notification.maxRetries) {
        return ApiErrors.badRequest('Maximum retry attempts reached');
      }

      await prisma.notificationEvent.update({
        where: { id: notificationId },
        data: {
          status: 'QUEUED',
          retryCount: { increment: 1 },
          nextRetryAt: new Date(Date.now() + 60000),
          errorCode: null,
          errorMessage: null
        }
      });

      await prisma.notificationRetry.create({
        data: {
          notificationId,
          attemptNumber: notification.retryCount + 1,
          status: 'QUEUED'
        }
      });

      return apiSuccess(undefined, 'Notification queued for retry');
    }

    return ApiErrors.badRequest('Invalid action');

  } catch (error) {
    console.error('Failed to process notification action:', error);
    logger.error('Failed to process admin notification action', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return ApiErrors.internal('Failed to process request');
  }
}
