import { NextRequest, NextResponse } from 'next/server';

// Test route to manually trigger webhook handling
export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  try {
    // Import the webhook handler function directly
    const webhookModule = await import('../stripe/webhooks/route');
    
    // Create a mock payment intent that succeeded (with unique timestamp to avoid duplicates)
    const timestamp = Date.now();
    const mockWebhookEvent = {
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: `pi_test_manual_booking_${timestamp}`,
          amount: 10000, // $100.00
          application_fee_amount: 1500, // $15.00 commission
          metadata: {
            caregiverId: 'cmegiz8mu0000wm8o9mb8jfln', // Fazila's user ID
            parentEmail: 'caserpent007@hotmail.com',
            bookingDate: '2025-08-20',
            isMultiDay: 'false',
            startTime: '12:00',
            endTime: '16:00',
            childrenCount: '1',
            specialRequests: 'Manual test booking',
            address: 'Test Address, Test City',
            latitude: '40.7128',
            longitude: '-74.0060',
            caregiverName: 'Fazila Noorzad'
          }
        }
      }
    };
    
    // Process the mock payment directly (copy of handleSuccessfulPayment logic)
    const paymentIntent = mockWebhookEvent.data.object;
    const metadata = paymentIntent.metadata;
    
    console.log('Processing test payment:', {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      applicationFeeAmount: paymentIntent.application_fee_amount,
      metadata: paymentIntent.metadata,
    });
    
    // Find parent user by email
    const { userOperations, bookingOperations, paymentOperations } = await import('@/lib/db');
    const parent = await userOperations.findUserByEmail(metadata.parentEmail);
    
    if (!parent) {
      throw new Error('Parent not found for email: ' + metadata.parentEmail);
    }
    
    // Create booking dates with proper timezone handling
    // Parse date manually to avoid timezone issues
    const [year, month, day] = metadata.bookingDate.split('-').map(Number);
    const [startHour, startMinute] = metadata.startTime.split(':').map(Number);
    const [endHour, endMinute] = metadata.endTime.split(':').map(Number);
    
    const startDateTime = new Date(year, month - 1, day, startHour, startMinute);
    const endDateTime = new Date(year, month - 1, day, endHour, endMinute);
    
    console.log('🔍 Creating test booking with timezone fix:', {
      originalDate: metadata.bookingDate,
      originalTime: `${metadata.startTime} - ${metadata.endTime}`,
      parsedComponents: { year, month: month-1, day, startHour, startMinute },
      parsedStartTime: startDateTime.toISOString(),
      parsedEndTime: endDateTime.toISOString(),
      localDate: startDateTime.toLocaleDateString(),
      localTime: `${startDateTime.toLocaleTimeString()} - ${endDateTime.toLocaleTimeString()}`,
      actualDateCheck: `Expected: Aug 20, 2025, Got: ${startDateTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`
    });
    
    // Calculate totals
    const totalHours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
    const platformCommission = paymentIntent.application_fee_amount;
    const caregiverPayout = paymentIntent.amount - platformCommission;
    const hourlyRate = Math.round((paymentIntent.amount / 100) / totalHours);
    
    console.log('Creating test booking with details:', {
      parentId: parent.id,
      caregiverId: metadata.caregiverId,
      startTime: startDateTime,
      endTime: endDateTime,
      totalHours,
      hourlyRate,
      totalAmount: paymentIntent.amount,
      platformFee: platformCommission
    });
    
    // Create booking record
    const booking = await bookingOperations.createBooking({
      parentId: parent.id,
      caregiverId: metadata.caregiverId,
      startTime: startDateTime,
      endTime: endDateTime,
      childrenCount: parseInt(metadata.childrenCount),
      specialRequests: metadata.specialRequests,
      address: metadata.address,
      latitude: parseFloat(metadata.latitude),
      longitude: parseFloat(metadata.longitude),
      hourlyRate,
      totalHours,
      subtotal: paymentIntent.amount,
      platformFee: platformCommission,
      totalAmount: paymentIntent.amount,
    });
    
    console.log('✅ Test booking created:', booking.id);
    
    // Create payment record
    const payment = await paymentOperations.createPayment({
      bookingId: booking.id,
      stripePaymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      platformFee: platformCommission,
      caregiverPayout: caregiverPayout,
      status: 'PAID'
    });
    
    console.log('✅ Test payment record created:', payment.id);
    
    // Update booking status to confirmed
    await bookingOperations.updateBookingStatus(booking.id, 'CONFIRMED');
    
    return NextResponse.json({
      success: true,
      message: 'Test booking created successfully',
      booking: {
        id: booking.id,
        parentId: booking.parentId,
        caregiverId: booking.caregiverId,
        status: 'CONFIRMED',
        startTime: booking.startTime,
        endTime: booking.endTime,
        totalAmount: booking.totalAmount
      },
      payment: {
        id: payment.id,
        status: payment.status
      },
      paymentIntentId: mockWebhookEvent.data.object.id
    });
    
  } catch (error) {
    console.error('Webhook test error:', error);
    return NextResponse.json({ 
      error: 'Failed to process webhook test',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}