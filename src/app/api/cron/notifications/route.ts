import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { enhancedSmsService } from '@/lib/notifications/enhanced-sms.service';

export async function POST(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    
    if (authHeader !== expectedAuth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Starting notification maintenance cron job...');
    
    const results = {
      retriesProcessed: 0,
      expiredCleaned: 0,
      webhooksProcessed: 0,
      complianceActions: 0
    };

    // 1. Process pending SMS retries
    await enhancedSmsService.processRetries();
    
    // Count retries processed
    const retriesProcessed = await prisma.notificationRetry.count({
      where: {
        attemptedAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        },
        status: {
          in: ['SENT', 'FAILED']
        }
      }
    });
    results.retriesProcessed = retriesProcessed;

    // 2. Clean up expired notifications (older than retention period)
    const retentionDays = 365; // Default retention period
    const expiredDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    
    const expiredNotifications = await prisma.notificationEvent.deleteMany({
      where: {
        createdAt: {
          lt: expiredDate
        },
        status: {
          in: ['DELIVERED', 'FAILED', 'CANCELLED']
        }
      }
    });
    results.expiredCleaned = expiredNotifications.count;

    // 3. Process unprocessed webhooks
    const unprocessedWebhooks = await prisma.notificationWebhook.findMany({
      where: {
        processed: false,
        receivedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      take: 100 // Process max 100 at a time
    });

    for (const webhook of unprocessedWebhooks) {
      try {
        // Try to match webhook to notification if not already linked
        if (!webhook.notificationId) {
          let notification = null;
          
          if (webhook.provider === 'twilio' && webhook.providerId !== 'unknown') {
            notification = await prisma.notificationEvent.findFirst({
              where: {
                providerId: webhook.providerId,
                channel: 'SMS'
              }
            });
          } else if (webhook.provider === 'resend' && webhook.providerId !== 'unknown') {
            notification = await prisma.notificationEvent.findFirst({
              where: {
                providerId: webhook.providerId,
                channel: 'EMAIL'
              }
            });
          }
          
          if (notification) {
            // Update notification status based on webhook event
            let updateData: any = {};
            
            if (webhook.provider === 'twilio') {
              switch (webhook.eventType) {
                case 'delivered':
                  updateData = { 
                    status: 'DELIVERED', 
                    deliveryStatus: 'DELIVERED',
                    deliveredAt: webhook.receivedAt
                  };
                  break;
                case 'failed':
                case 'undelivered':
                  updateData = { 
                    status: 'FAILED', 
                    deliveryStatus: 'FAILED',
                    failedAt: webhook.receivedAt
                  };
                  break;
              }
            } else if (webhook.provider === 'resend') {
              switch (webhook.eventType) {
                case 'email.delivered':
                  updateData = { 
                    status: 'DELIVERED', 
                    deliveryStatus: 'DELIVERED',
                    deliveredAt: webhook.receivedAt
                  };
                  break;
                case 'email.bounced':
                  updateData = { 
                    status: 'FAILED', 
                    deliveryStatus: 'BOUNCED',
                    failedAt: webhook.receivedAt
                  };
                  break;
                case 'email.complained':
                  updateData = { 
                    deliveryStatus: 'SPAM' 
                  };
                  break;
                case 'email.opened':
                  updateData = { 
                    deliveryStatus: 'OPENED',
                    openedAt: webhook.receivedAt
                  };
                  break;
                case 'email.clicked':
                  updateData = { 
                    deliveryStatus: 'CLICKED',
                    clickedAt: webhook.receivedAt
                  };
                  break;
              }
            }
            
            if (Object.keys(updateData).length > 0) {
              await prisma.notificationEvent.update({
                where: { id: notification.id },
                data: updateData as any
              });
            }
            
            // Link webhook to notification
            await prisma.notificationWebhook.update({
              where: { id: webhook.id },
              data: {
                processed: true,
                processedAt: new Date(),
                notificationId: notification.id
              }
            });
            
            results.webhooksProcessed++;
          }
        }
      } catch (error) {
        console.error('Error processing webhook:', webhook.id, error);
        
        // Mark as processed with error
        await prisma.notificationWebhook.update({
          where: { id: webhook.id },
          data: {
            processed: false, // Keep as unprocessed to retry later
            processingError: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    }

    // 4. Legal compliance checks
    
    // Check for excessive bounce rates (>10% in last 24h)
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [totalEmails, bouncedEmails] = await Promise.all([
      prisma.notificationEvent.count({
        where: {
          channel: 'EMAIL',
          createdAt: { gte: last24h },
          status: { in: ['SENT', 'DELIVERED', 'FAILED'] }
        }
      }),
      prisma.notificationEvent.count({
        where: {
          channel: 'EMAIL',
          createdAt: { gte: last24h },
          deliveryStatus: 'BOUNCED'
        }
      })
    ]);

    const bounceRate = totalEmails > 0 ? (bouncedEmails / totalEmails) * 100 : 0;
    
    if (bounceRate > 10) {
      console.warn(`High bounce rate detected: ${bounceRate.toFixed(2)}%`);
      results.complianceActions++;
      
      // Log compliance alert
      await prisma.notificationEvent.create({
        data: {
          type: 'SYSTEM_MAINTENANCE',
          channel: 'IN_APP',
          templateId: 'compliance_alert',
          priority: 'HIGH',
          content: `High email bounce rate detected: ${bounceRate.toFixed(2)}%. Review sending practices.`,
          status: 'DELIVERED',
          isTransactional: true,
          triggeredBy: 'system-compliance-check',
          deliveredAt: new Date()
        }
      });
    }

    // Check for spam complaints (>1% in last 7 days)
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [totalEmailsWeek, spamComplaints] = await Promise.all([
      prisma.notificationEvent.count({
        where: {
          channel: 'EMAIL',
          createdAt: { gte: last7d },
          status: { in: ['SENT', 'DELIVERED', 'FAILED'] }
        }
      }),
      prisma.notificationEvent.count({
        where: {
          channel: 'EMAIL',
          createdAt: { gte: last7d },
          deliveryStatus: 'SPAM'
        }
      })
    ]);

    const spamRate = totalEmailsWeek > 0 ? (spamComplaints / totalEmailsWeek) * 100 : 0;
    
    if (spamRate > 1) {
      console.warn(`High spam complaint rate detected: ${spamRate.toFixed(2)}%`);
      results.complianceActions++;
      
      // Log compliance alert
      await prisma.notificationEvent.create({
        data: {
          type: 'SYSTEM_MAINTENANCE',
          channel: 'IN_APP',
          templateId: 'compliance_alert',
          priority: 'HIGH',
          content: `High spam complaint rate detected: ${spamRate.toFixed(2)}%. Review email content and targeting.`,
          status: 'DELIVERED',
          isTransactional: true,
          triggeredBy: 'system-compliance-check',
          deliveredAt: new Date()
        }
      });
    }

    // 5. Clean up old webhook logs (older than 90 days)
    const oldWebhookDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    await prisma.notificationWebhook.deleteMany({
      where: {
        receivedAt: { lt: oldWebhookDate },
        processed: true
      }
    });

    // 6. Update system health metrics
    const healthMetrics = await prisma.$queryRaw`
      SELECT 
        'EMAIL' as channel,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END) as delivered,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed
      FROM "notification_events" 
      WHERE "createdAt" >= ${last24h}
        AND "channel" = 'EMAIL'
      UNION ALL
      SELECT 
        'SMS' as channel,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END) as delivered,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed
      FROM "notification_events" 
      WHERE "createdAt" >= ${last24h}
        AND "channel" = 'SMS'
    ` as any[];

    console.log('Notification maintenance completed:', results);
    console.log('Health metrics:', healthMetrics);

    return NextResponse.json({
      success: true,
      results,
      healthMetrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Notification maintenance cron error:', error);
    return NextResponse.json(
      { 
        error: 'Cron job failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}