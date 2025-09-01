import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/notifications/email.service';

// Example endpoint to test notifications
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { testEmail } = body;

    if (!testEmail) {
      return NextResponse.json(
        { error: 'Email address is required' },
        { status: 400 }
      );
    }

    // Send test booking confirmation email directly
    const result = await emailService.sendBookingConfirmation(
      testEmail,
      {
        id: 'BOOK123',
        caregiverName: 'Jane Smith',
        parentName: 'Test User',
        date: 'January 25, 2025',
        time: '2:00 PM',
        duration: 4,
        totalAmount: 120,
      }
    );

    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        message: 'Test email sent successfully!',
        to: testEmail
      });
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to send email' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Test notification error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send test notification' },
      { status: 500 }
    );
  }
}