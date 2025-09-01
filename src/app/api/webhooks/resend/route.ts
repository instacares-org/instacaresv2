import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const signature = request.headers.get('svix-signature');
    
    console.log('Resend webhook received:', body);

    // Basic webhook data validation
    if (!body.type || !body.data) {
      return NextResponse.json(
        { error: 'Invalid webhook payload' },
        { status: 400 }
      );
    }

    // Log webhook event
    const webhook = await prisma.notificationWebhook.create({
      data: {
        provider: 'resend',
        providerId: body.data.email_id || body.data.id || 'unknown',
        eventType: body.type,
        rawPayload: body,
        signature: signature || undefined,
        processed: false
      }
    });

    // Find corresponding notification by email and approximate time
    let notification = null;
    
    if (body.data.email_id) {
      notification = await prisma.notificationEvent.findFirst({
        where: {
          providerId: body.data.email_id,
          channel: 'EMAIL'
        }
      });
    } else if (body.data.to && body.data.subject) {
      // Fallback: try to match by recipient and subject
      notification = await prisma.notificationEvent.findFirst({
        where: {
          channel: 'EMAIL',
          recipientEmail: Array.isArray(body.data.to) ? body.data.to[0] : body.data.to,
          subject: body.data.subject,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (notification) {
      let notificationStatus: string | undefined;
      let deliveryStatus: string | undefined;

      // Map Resend webhook events to our status system
      switch (body.type) {
        case 'email.sent':
          notificationStatus = 'SENT';
          break;
        case 'email.delivered':
          notificationStatus = 'DELIVERED';
          deliveryStatus = 'DELIVERED';
          break;
        case 'email.bounced':
          notificationStatus = 'FAILED';
          deliveryStatus = 'BOUNCED';
          break;
        case 'email.complained':
          deliveryStatus = 'SPAM';
          break;
        case 'email.opened':
          deliveryStatus = 'OPENED';
          break;
        case 'email.clicked':
          deliveryStatus = 'CLICKED';
          break;
        case 'email.delivery_delayed':
          // Keep current status, just log the delay
          break;
        case 'email.failed':
          notificationStatus = 'FAILED';
          deliveryStatus = 'FAILED';
          break;
      }

      // Prepare update data
      const updateData: any = {};
      
      if (notificationStatus) {
        updateData.status = notificationStatus;
      }
      
      if (deliveryStatus) {
        updateData.deliveryStatus = deliveryStatus;
      }

      // Set timestamps based on event
      switch (body.type) {
        case 'email.sent':
          updateData.sentAt = new Date();
          break;
        case 'email.delivered':
          updateData.deliveredAt = new Date();
          break;
        case 'email.opened':
          updateData.openedAt = new Date();
          break;
        case 'email.clicked':
          updateData.clickedAt = new Date();
          break;
        case 'email.bounced':
        case 'email.failed':
          updateData.failedAt = new Date();
          if (body.data.error) {
            updateData.errorMessage = body.data.error;
          }
          break;
      }

      // Update notification if we have changes
      if (Object.keys(updateData).length > 0) {
        await prisma.notificationEvent.update({
          where: { id: notification.id },
          data: updateData as any
        });

        console.log('Email notification updated:', {
          notificationId: notification.id,
          eventType: body.type,
          status: notificationStatus,
          deliveryStatus
        });
      }

      // Mark webhook as processed and link to notification
      await prisma.notificationWebhook.update({
        where: { id: webhook.id },
        data: { 
          processed: true, 
          processedAt: new Date(),
          notificationId: notification.id
        }
      });

    } else {
      console.warn('No notification found for email webhook:', {
        emailId: body.data.email_id,
        to: body.data.to,
        subject: body.data.subject,
        type: body.type
      });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Resend webhook error:', error);
    
    // Try to log the failed webhook
    try {
      await prisma.notificationWebhook.create({
        data: {
          provider: 'resend',
          providerId: 'webhook-error',
          eventType: 'processing_error',
          rawPayload: { error: error instanceof Error ? error.message : 'Unknown error' },
          processed: false,
          processingError: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    } catch (dbError) {
      console.error('Failed to log webhook error:', dbError);
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}