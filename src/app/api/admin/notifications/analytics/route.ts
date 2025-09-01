import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '7d'; // 1h, 24h, 7d, 30d
    const channel = searchParams.get('channel'); // EMAIL, SMS

    // Calculate date range
    const now = new Date();
    let dateFrom: Date;
    
    switch (period) {
      case '1h':
        dateFrom = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        dateFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const whereClause: any = {
      createdAt: {
        gte: dateFrom,
        lte: now
      }
    };

    if (channel) {
      whereClause.channel = channel;
    }

    // Get volume metrics
    const volumeData = await prisma.notificationEvent.groupBy({
      by: ['status', 'channel', 'type'],
      _count: { id: true },
      where: whereClause
    });

    // Get hourly breakdown for the period
    const hourlyData = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('hour', "createdAt") as hour,
        "channel",
        "status",
        COUNT(*) as count
      FROM "notification_events" 
      WHERE "createdAt" >= ${dateFrom} AND "createdAt" <= ${now}
      ${channel ? `AND "channel" = '${channel}'` : ''}
      GROUP BY DATE_TRUNC('hour', "createdAt"), "channel", "status"
      ORDER BY hour DESC
    ` as any[];

    // Get failure analysis
    const failureAnalysis = await prisma.notificationEvent.groupBy({
      by: ['errorCode', 'channel'],
      _count: { id: true },
      where: {
        ...whereClause,
        status: 'FAILED'
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 10
    });

    // Get retry statistics
    const retryStats = await prisma.notificationRetry.groupBy({
      by: ['attemptNumber', 'status'],
      _count: { id: true },
      where: {
        attemptedAt: {
          gte: dateFrom,
          lte: now
        }
      }
    });

    // Get critical notification alerts
    const criticalMetrics = await prisma.notificationEvent.groupBy({
      by: ['type', 'status'],
      _count: { id: true },
      where: {
        ...whereClause,
        priority: 'CRITICAL'
      }
    });

    // Calculate delivery times (for successful notifications)
    const deliveryTimes = await prisma.$queryRaw`
      SELECT 
        "channel",
        AVG(EXTRACT(EPOCH FROM ("deliveredAt" - "sentAt"))) as avg_delivery_time_seconds,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("deliveredAt" - "sentAt"))) as median_delivery_time_seconds,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("deliveredAt" - "sentAt"))) as p95_delivery_time_seconds
      FROM "notification_events"
      WHERE "createdAt" >= ${dateFrom} 
        AND "createdAt" <= ${now}
        AND "deliveredAt" IS NOT NULL 
        AND "sentAt" IS NOT NULL
        ${channel ? `AND "channel" = '${channel}'` : ''}
      GROUP BY "channel"
    ` as any[];

    // Get webhook processing health
    const webhookHealth = await prisma.notificationWebhook.groupBy({
      by: ['provider', 'processed'],
      _count: { id: true },
      where: {
        receivedAt: {
          gte: dateFrom,
          lte: now
        }
      }
    });

    // Top error messages
    const topErrors = await prisma.notificationEvent.groupBy({
      by: ['errorMessage'],
      _count: { id: true },
      where: {
        ...whereClause,
        status: 'FAILED',
        errorMessage: {
          not: null
        }
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 5
    });

    // Legal compliance metrics
    const complianceMetrics = await Promise.all([
      // Unsubscribe rate
      prisma.notificationEvent.count({
        where: {
          ...whereClause,
          deliveryStatus: 'UNSUBSCRIBED'
        }
      }),
      // Bounce rate
      prisma.notificationEvent.count({
        where: {
          ...whereClause,
          deliveryStatus: 'BOUNCED'
        }
      }),
      // Spam reports
      prisma.notificationEvent.count({
        where: {
          ...whereClause,
          deliveryStatus: 'SPAM'
        }
      })
    ]);

    // Format response
    const response = {
      success: true,
      data: {
        period,
        dateRange: {
          from: dateFrom.toISOString(),
          to: now.toISOString()
        },
        volume: {
          total: volumeData.reduce((sum, item) => sum + item._count.id, 0),
          byStatus: volumeData.reduce((acc, item) => {
            acc[item.status] = (acc[item.status] || 0) + item._count.id;
            return acc;
          }, {} as Record<string, number>),
          byChannel: volumeData.reduce((acc, item) => {
            acc[item.channel] = (acc[item.channel] || 0) + item._count.id;
            return acc;
          }, {} as Record<string, number>),
          byType: volumeData.reduce((acc, item) => {
            acc[item.type] = (acc[item.type] || 0) + item._count.id;
            return acc;
          }, {} as Record<string, number>)
        },
        hourlyBreakdown: hourlyData,
        deliveryMetrics: {
          successRate: {
            overall: calculateSuccessRate(volumeData),
            byChannel: calculateSuccessRateByChannel(volumeData)
          },
          averageDeliveryTime: deliveryTimes.reduce((acc, item) => {
            acc[item.channel] = {
              average: Math.round(item.avg_delivery_time_seconds || 0),
              median: Math.round(item.median_delivery_time_seconds || 0),
              p95: Math.round(item.p95_delivery_time_seconds || 0)
            };
            return acc;
          }, {} as Record<string, any>)
        },
        failureAnalysis: {
          topErrorCodes: failureAnalysis,
          topErrorMessages: topErrors,
          retryStats: retryStats.reduce((acc, item) => {
            if (!acc[item.attemptNumber]) acc[item.attemptNumber] = {};
            acc[item.attemptNumber][item.status] = item._count.id;
            return acc;
          }, {} as Record<string, any>)
        },
        criticalAlerts: {
          metrics: criticalMetrics,
          totalFailed: criticalMetrics
            .filter(item => item.status === 'FAILED')
            .reduce((sum, item) => sum + item._count.id, 0)
        },
        systemHealth: {
          webhookProcessing: webhookHealth.reduce((acc, item) => {
            if (!acc[item.provider]) acc[item.provider] = {};
            acc[item.provider][item.processed ? 'processed' : 'pending'] = item._count.id;
            return acc;
          }, {} as Record<string, any>)
        },
        compliance: {
          unsubscribeRate: complianceMetrics[0],
          bounceRate: complianceMetrics[1],
          spamReports: complianceMetrics[2]
        }
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Failed to fetch notification analytics:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch analytics data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function calculateSuccessRate(data: any[]): string {
  const total = data.reduce((sum, item) => sum + item._count.id, 0);
  const successful = data
    .filter(item => ['DELIVERED', 'SENT'].includes(item.status))
    .reduce((sum, item) => sum + item._count.id, 0);
  
  return total > 0 ? ((successful / total) * 100).toFixed(2) : '0.00';
}

function calculateSuccessRateByChannel(data: any[]): Record<string, string> {
  const byChannel = data.reduce((acc, item) => {
    if (!acc[item.channel]) acc[item.channel] = { total: 0, successful: 0 };
    acc[item.channel].total += item._count.id;
    if (['DELIVERED', 'SENT'].includes(item.status)) {
      acc[item.channel].successful += item._count.id;
    }
    return acc;
  }, {} as Record<string, any>);

  return Object.keys(byChannel).reduce((acc, channel) => {
    const { total, successful } = byChannel[channel];
    acc[channel] = total > 0 ? ((successful / total) * 100).toFixed(2) : '0.00';
    return acc;
  }, {} as Record<string, string>);
}