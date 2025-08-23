import { NextRequest, NextResponse } from 'next/server';

// Enhanced cleanup endpoint to identify and remove duplicate bookings by patterns
export async function POST(request: NextRequest) {
  try {
    const { db } = await import('@/lib/db');
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';
    
    console.log(`Starting duplicate cleanup - Dry run: ${dryRun}`);
    
    // Get all bookings for analysis
    const allBookings = await db.booking.findMany({
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
        createdAt: 'desc',
      },
    });
    
    console.log(`Found ${allBookings.length} total bookings for analysis`);
    
    // Group bookings by similar characteristics to find duplicates
    const bookingGroups = new Map();
    allBookings.forEach(booking => {
      // Create a key based on start time, parent, and caregiver
      const startTimeKey = booking.startTime.toISOString().split('T')[0]; // Just the date part
      const key = `${startTimeKey}-${booking.parentId}-${booking.caregiverId}`;
      
      if (!bookingGroups.has(key)) {
        bookingGroups.set(key, []);
      }
      bookingGroups.get(key).push(booking);
    });
    
    // Find duplicate groups (more than 1 booking with same key)
    const duplicateGroups = Array.from(bookingGroups.entries())
      .filter(([key, group]) => group.length > 1)
      .map(([key, group]) => {
        // Sort by creation date to keep the most recent
        group.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        return {
          key,
          count: group.length,
          bookings: group.map((b, index) => ({
            id: b.id,
            startTime: b.startTime,
            endTime: b.endTime,
            status: b.status,
            totalAmount: b.totalAmount,
            createdAt: b.createdAt,
            isNewest: index === 0, // First in sorted array is newest
            parentName: `${b.parent.profile?.firstName} ${b.parent.profile?.lastName}`,
            caregiverName: `${b.caregiver.profile?.firstName} ${b.caregiver.profile?.lastName}`,
            paymentIntents: b.payments.map(p => p.stripePaymentIntentId)
          }))
        };
      });
    
    console.log(`Found ${duplicateGroups.length} groups with duplicates`);
    
    // Analyze date discrepancies within duplicate groups
    const problematicGroups = duplicateGroups.filter(group => {
      const dates = group.bookings.map(b => b.startTime.toDateString());
      const uniqueDates = [...new Set(dates)];
      
      // Flag groups where bookings have different dates (potential timezone issues)
      return uniqueDates.length > 1;
    });
    
    console.log(`Found ${problematicGroups.length} groups with date discrepancies`);
    
    let deletedBookings = [];
    let deletedPayments = [];
    
    if (!dryRun) {
      // Delete duplicates, keeping only the newest booking in each group
      for (const group of duplicateGroups) {
        const toDelete = group.bookings.filter(b => !b.isNewest);
        
        for (const booking of toDelete) {
          // Delete payments first
          const paymentIds = allBookings
            .find(b => b.id === booking.id)?.payments
            .map(p => p.id) || [];
          
          if (paymentIds.length > 0) {
            await db.payment.deleteMany({
              where: { id: { in: paymentIds } }
            });
            deletedPayments.push(...paymentIds);
          }
          
          // Then delete the booking
          await db.booking.delete({
            where: { id: booking.id }
          });
          
          deletedBookings.push(booking.id);
          console.log(`Deleted duplicate booking ${booking.id} (created: ${booking.createdAt})`);
        }
      }
      
      // Clear cache
      const { apiCache } = await import('@/lib/cache');
      apiCache.clear();
      console.log('Cache cleared');
    }
    
    return NextResponse.json({
      success: true,
      dryRun,
      message: dryRun 
        ? 'Analysis complete - no bookings deleted' 
        : 'Duplicate bookings cleaned up successfully',
      analysis: {
        totalBookings: allBookings.length,
        duplicateGroups: duplicateGroups.length,
        problematicGroups: problematicGroups.length,
        duplicates: duplicateGroups.map(group => ({
          key: group.key,
          count: group.count,
          dateDiscrepancy: group.bookings.map(b => b.startTime.toDateString()).filter((d, i, arr) => arr.indexOf(d) === i).length > 1,
          bookings: group.bookings.map(b => ({
            id: b.id,
            startTime: b.startTime.toISOString(),
            createdAt: b.createdAt,
            isNewest: b.isNewest,
            willBeDeleted: !dryRun && !b.isNewest,
            paymentIntents: b.paymentIntents
          }))
        }))
      },
      deletedBookings: deletedBookings.length,
      deletedPayments: deletedPayments.length
    });
    
  } catch (error) {
    console.error('Enhanced cleanup error:', error);
    return NextResponse.json({ 
      error: 'Failed to cleanup duplicate bookings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // GET request defaults to dry run
  const url = new URL(request.url);
  if (!url.searchParams.has('dryRun')) {
    url.searchParams.set('dryRun', 'true');
  }
  const newRequest = new NextRequest(url, request);
  return POST(newRequest);
}