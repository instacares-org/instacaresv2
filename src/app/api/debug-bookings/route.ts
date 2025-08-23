import { NextRequest, NextResponse } from 'next/server';

// Debug endpoint to check actual booking data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const userType = searchParams.get('userType');
    const action = searchParams.get('action'); // 'analyze' or 'cleanup'
    
    if (!userId || !userType) {
      return NextResponse.json({
        error: 'Missing userId or userType parameters'
      }, { status: 400 });
    }
    
    const { db } = await import('@/lib/db');
    
    // Get raw booking data directly from database
    const whereClause = userType === 'parent' ? { parentId: userId } : { caregiverId: userId };
    
    const bookings = await db.booking.findMany({
      where: whereClause,
      include: {
        parent: {
          include: {
            profile: true,
          },
        },
        caregiver: {
          include: {
            profile: true,
          },
        },
        payments: true,
      },
      orderBy: {
        startTime: 'desc',
      },
    });
    
    // Group by startTime and caregiverId to find duplicates
    const bookingGroups = new Map();
    bookings.forEach(booking => {
      const key = `${booking.startTime.toISOString()}-${booking.caregiverId}-${booking.parentId}`;
      if (!bookingGroups.has(key)) {
        bookingGroups.set(key, []);
      }
      bookingGroups.get(key).push(booking);
    });
    
    const duplicates = Array.from(bookingGroups.entries())
      .filter(([key, group]) => group.length > 1)
      .map(([key, group]) => {
        // Sort by creation date to identify which should be kept
        group.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        // Check for date discrepancies
        const dates = group.map(b => b.startTime.toDateString());
        const uniqueDates = [...new Set(dates)];
        const hasDateDiscrepancy = uniqueDates.length > 1;
        
        return {
          key,
          count: group.length,
          hasDateDiscrepancy,
          uniqueDates,
          bookings: group.map((b, index) => ({
            id: b.id,
            startTime: b.startTime,
            endTime: b.endTime,
            status: b.status,
            totalAmount: b.totalAmount,
            createdAt: b.createdAt,
            isNewest: index === 0,
            shouldDelete: index > 0, // Delete all except the newest
            dateString: b.startTime.toDateString(),
            parentName: `${b.parent.profile?.firstName} ${b.parent.profile?.lastName}`,
            caregiverName: `${b.caregiver.profile?.firstName} ${b.caregiver.profile?.lastName}`,
            payments: b.payments.map(p => ({
              id: p.id,
              stripePaymentIntentId: p.stripePaymentIntentId,
              status: p.status,
              amount: p.amount
            }))
          }))
        };
      });
    
    // If action is cleanup, actually delete the duplicates
    let deletedBookings = [];
    let deletedPayments = [];
    
    if (action === 'cleanup' && duplicates.length > 0) {
      for (const group of duplicates) {
        const toDelete = group.bookings.filter(b => b.shouldDelete);
        
        for (const bookingToDelete of toDelete) {
          const fullBooking = bookings.find(b => b.id === bookingToDelete.id);
          if (fullBooking) {
            // Delete payments first
            const paymentIds = fullBooking.payments.map(p => p.id);
            if (paymentIds.length > 0) {
              await db.payment.deleteMany({
                where: { id: { in: paymentIds } }
              });
              deletedPayments.push(...paymentIds);
            }
            
            // Then delete the booking
            await db.booking.delete({
              where: { id: fullBooking.id }
            });
            
            deletedBookings.push(fullBooking.id);
            console.log(`Deleted duplicate booking ${fullBooking.id} (created: ${fullBooking.createdAt})`);
          }
        }
      }
      
      // Clear cache after cleanup
      const { apiCache } = await import('@/lib/cache');
      apiCache.clear();
      console.log('Cache cleared after cleanup');
    }
    
    return NextResponse.json({
      success: true,
      action: action || 'analyze',
      totalBookings: bookings.length,
      duplicateGroups: duplicates.length,
      problematicGroups: duplicates.filter(d => d.hasDateDiscrepancy).length,
      duplicates,
      deletedBookings: deletedBookings.length,
      deletedPayments: deletedPayments.length,
      cleanupPerformed: action === 'cleanup',
      allBookings: bookings.map(b => ({
        id: b.id,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        totalAmount: b.totalAmount,
        createdAt: b.createdAt,
        parentName: `${b.parent.profile?.firstName} ${b.parent.profile?.lastName}`,
        caregiverName: `${b.caregiver.profile?.firstName} ${b.caregiver.profile?.lastName}`,
        paymentCount: b.payments.length
      }))
    });
    
  } catch (error) {
    console.error('Debug bookings error:', error);
    return NextResponse.json({ 
      error: 'Failed to debug bookings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}