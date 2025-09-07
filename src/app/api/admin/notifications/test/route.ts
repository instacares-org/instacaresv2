import { NextRequest, NextResponse } from 'next/server';
import { unifiedNotificationService } from '@/lib/notifications/unified-notification.service';

// Prevent pre-rendering during build time
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, recipient, subject, message, priority } = body;

    if (!type || !recipient || !message) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: type, recipient, or message' 
        },
        { status: 400 }
      );
    }

    let result;

    if (type === 'email') {
      // Send test email
      result = await unifiedNotificationService.send({
        email: recipient,
        name: 'Test Recipient',
        type: 'SYSTEM_MAINTENANCE',
        subject: subject || 'Instacares Test Email',
        content: message,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Instacares</h1>
              <p style="color: #f0f0f0; margin: 10px 0 0 0; font-size: 16px;">Notification System Test</p>
            </div>
            
            <div style="padding: 40px 20px; background-color: #f8f9fa;">
              <h2 style="color: #333; margin-top: 0;">Test Message</h2>
              <p style="color: #555; line-height: 1.6; font-size: 16px;">${message}</p>
              
              <div style="margin: 30px 0; padding: 20px; background-color: #e3f2fd; border-left: 4px solid #2196f3; border-radius: 4px;">
                <p style="margin: 0; color: #1565c0; font-weight: 500;">
                  ✅ This is a test email from the Instacares admin panel.
                </p>
                <p style="margin: 5px 0 0 0; color: #1976d2; font-size: 14px;">
                  If you received this message, your email notification system is working correctly!
                </p>
              </div>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                <p style="color: #666; font-size: 14px; margin: 0;">
                  <strong>Test Details:</strong><br>
                  Priority: ${priority || 'NORMAL'}<br>
                  Timestamp: ${new Date().toLocaleString()}<br>
                  Channel: EMAIL
                </p>
              </div>
            </div>
            
            <div style="background-color: #263238; padding: 20px; text-align: center;">
              <p style="color: #b0bec5; margin: 0; font-size: 14px;">
                © 2025 Instacares - Childcare Platform
              </p>
            </div>
          </div>
        `,
        channels: ['EMAIL'],
        priority: (priority || 'NORMAL') as any,
        templateId: 'admin_test_email',
        contextType: 'admin_test',
        contextId: 'test-' + Date.now()
      });

    } else if (type === 'sms') {
      // Send test SMS
      result = await unifiedNotificationService.send({
        phone: recipient,
        name: 'Test Recipient',
        type: 'SYSTEM_MAINTENANCE',
        content: `[INSTACARES TEST] ${message} - This test SMS confirms your notification system is working. Priority: ${priority || 'NORMAL'}. Time: ${new Date().toLocaleString()}`,
        channels: ['SMS'],
        priority: (priority || 'NORMAL') as any,
        templateId: 'admin_test_sms',
        contextType: 'admin_test',
        contextId: 'test-' + Date.now()
      });

    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid notification type. Must be "email" or "sms"' 
        },
        { status: 400 }
      );
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Test ${type} sent successfully`,
        notificationId: result.notificationIds[0],
        details: {
          recipient,
          type,
          priority: priority || 'NORMAL',
          timestamp: new Date().toISOString()
        }
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.errors.length > 0 ? result.errors[0] : 'Failed to send test notification',
          details: result.errors
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Test notification error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}