import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import twilio from 'twilio';

// Twilio webhook signature validation
const twilioSignature = process.env.TWILIO_AUTH_TOKEN || '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-twilio-signature');
    const url = request.url;

    // Verify webhook signature for security
    const isValidSignature = twilio.validateRequest(
      twilioSignature,
      signature || '',
      url,
      body
    );

    if (!isValidSignature && process.env.NODE_ENV === 'production') {
      console.error('Invalid Twilio webhook signature');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse form-encoded body
    const params = new URLSearchParams(body);
    const webhookData = {
      messageSid: params.get('MessageSid'),
      messageStatus: params.get('MessageStatus'),
      to: params.get('To'),
      from: params.get('From'),
      errorCode: params.get('ErrorCode'),
      errorMessage: params.get('ErrorMessage'),
      timestamp: new Date()
    };

    console.log('Twilio webhook received:', webhookData);

    // Log webhook event
    const webhook = await prisma.notificationWebhook.create({
      data: {
        provider: 'twilio',
        providerId: webhookData.messageSid || 'unknown',
        eventType: webhookData.messageStatus || 'unknown',
        rawPayload: Object.fromEntries(params.entries()),
        signature: signature || undefined,
        processed: false
      }
    });

    // Find corresponding notification
    const notification = await prisma.notificationEvent.findFirst({
      where: {
        providerId: webhookData.messageSid,
        channel: 'SMS'
      }
    });

    if (notification) {
      // Update notification status based on Twilio status
      let notificationStatus: string | undefined;
      let deliveryStatus: string | undefined;

      switch (webhookData.messageStatus) {
        case 'sent':
          notificationStatus = 'SENT';
          break;
        case 'delivered':
          notificationStatus = 'DELIVERED';
          deliveryStatus = 'DELIVERED';
          break;
        case 'failed':
        case 'undelivered':
          notificationStatus = 'FAILED';
          deliveryStatus = 'FAILED';
          break;
        case 'receiving':
        case 'received':
          // Incoming message, not relevant for our outgoing notifications
          break;
      }

      if (notificationStatus) {
        await prisma.notificationEvent.update({
          where: { id: notification.id },
          data: {
            status: notificationStatus as any,
            deliveryStatus: deliveryStatus as any,
            ...(notificationStatus === 'DELIVERED' && { deliveredAt: new Date() }),
            ...(notificationStatus === 'FAILED' && { 
              failedAt: new Date(),
              errorCode: webhookData.errorCode,
              errorMessage: webhookData.errorMessage
            })
          }
        });

        // Update webhook as processed
        await prisma.notificationWebhook.update({
          where: { id: webhook.id },
          data: { 
            processed: true, 
            processedAt: new Date(),
            notificationId: notification.id
          }
        });

        console.log('Notification updated:', {
          notificationId: notification.id,
          status: notificationStatus,
          deliveryStatus
        });
      }
    } else {
      console.warn('No notification found for Twilio message:', webhookData.messageSid);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Twilio webhook error:', error);
    
    // Try to log the failed webhook
    try {
      await prisma.notificationWebhook.create({
        data: {
          provider: 'twilio',
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