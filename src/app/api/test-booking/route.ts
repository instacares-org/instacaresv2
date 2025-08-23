import { NextRequest, NextResponse } from 'next/server';

// Test route to simulate webhook and create a booking manually
export async function POST(request: NextRequest) {
  try {
    const { userOperations, bookingOperations, paymentOperations } = await import('@/lib/db');
    
    // Simulate payment intent metadata
    const mockPaymentIntent = {
      id: 'pi_test_booking_123',
      amount: 10000, // $100.00
      application_fee_amount: 1500, // $15.00
      metadata: {
        caregiverId: 'cmegiz8mu0000wm8o9mb8jfln', // Fazila's user ID
        parentEmail: 'caserpent007@hotmail.com',
        bookingDate: '2025-08-25',
        isMultiDay: 'false',
        startTime: '12:00',
        endTime: '16:00',
        childrenCount: '1',
        specialRequests: 'Test booking',
        address: 'Test Address',
        latitude: '40.7128',
        longitude: '-74.0060',
        caregiverName: 'Fazila Noorzad'
      }
    };
    
    const metadata = mockPaymentIntent.metadata;
    
    // Find parent user by email
    const parent = await userOperations.findUserByEmail(metadata.parentEmail);
    
    if (!parent) {
      return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
    }
    
    // Create booking dates
    const startDateTime = new Date(`${metadata.bookingDate}T${metadata.startTime}:00`);
    const endDateTime = new Date(`${metadata.bookingDate}T${metadata.endTime}:00`);
    
    // Calculate totals
    const totalHours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
    const platformCommission = mockPaymentIntent.application_fee_amount;
    const caregiverPayout = mockPaymentIntent.amount - platformCommission;
    const hourlyRate = Math.round((mockPaymentIntent.amount / 100) / totalHours);
    
    console.log('Test booking creation:', {
      parentId: parent.id,
      caregiverId: metadata.caregiverId,
      startTime: startDateTime,
      endTime: endDateTime,
      totalHours,
      hourlyRate,
      totalAmount: mockPaymentIntent.amount,
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
      subtotal: mockPaymentIntent.amount,
      platformFee: platformCommission,
      totalAmount: mockPaymentIntent.amount,
    });
    
    console.log('✅ Test booking created:', booking.id);
    
    // Create payment record
    const payment = await paymentOperations.createPayment({
      bookingId: booking.id,
      stripePaymentIntentId: mockPaymentIntent.id,
      amount: mockPaymentIntent.amount,
      platformFee: platformCommission,
      caregiverPayout: caregiverPayout,
      status: 'PAID'
    });
    
    console.log('✅ Test payment record created:', payment.id);
    
    // Update booking status to confirmed
    await bookingOperations.updateBookingStatus(booking.id, 'CONFIRMED');
    
    return NextResponse.json({
      success: true,
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
      }
    });
    
  } catch (error) {
    console.error('Test booking creation error:', error);
    return NextResponse.json({ 
      error: 'Failed to create test booking',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}