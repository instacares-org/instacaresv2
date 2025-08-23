import { NextRequest, NextResponse } from 'next/server';

// Cleanup endpoint to remove test bookings
export async function POST(request: NextRequest) {
  try {
    const { db } = await import('@/lib/db');
    
    // Find all payments with test payment intent IDs
    const testPayments = await db.payment.findMany({
      where: {
        OR: [
          { stripePaymentIntentId: { startsWith: 'pi_test_manual_booking_' } },
          { stripePaymentIntentId: { startsWith: 'pi_test_booking_' } }
        ]
      },
      include: {
        booking: true
      }
    });
    
    console.log(`Found ${testPayments.length} test payments to clean up`);
    
    // Delete associated bookings and payments
    const bookingIds = testPayments.map(p => p.bookingId);
    const paymentIds = testPayments.map(p => p.id);
    
    // Delete in correct order (payments first, then bookings)
    if (paymentIds.length > 0) {
      await db.payment.deleteMany({
        where: { id: { in: paymentIds } }
      });
      console.log(`Deleted ${paymentIds.length} test payments`);
    }
    
    if (bookingIds.length > 0) {
      await db.booking.deleteMany({
        where: { id: { in: bookingIds } }
      });
      console.log(`Deleted ${bookingIds.length} test bookings`);
    }
    
    // Clear cache
    const { apiCache } = await import('@/lib/cache');
    apiCache.clear();
    console.log('Cache cleared');
    
    return NextResponse.json({
      success: true,
      message: 'Test bookings cleaned up successfully',
      deletedPayments: paymentIds.length,
      deletedBookings: bookingIds.length,
      testPayments: testPayments.map(p => ({
        id: p.id,
        stripePaymentIntentId: p.stripePaymentIntentId,
        bookingId: p.bookingId,
        booking: {
          startTime: p.booking?.startTime,
          endTime: p.booking?.endTime,
          parentId: p.booking?.parentId,
          caregiverId: p.booking?.caregiverId
        }
      }))
    });
    
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ 
      error: 'Failed to cleanup test bookings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}