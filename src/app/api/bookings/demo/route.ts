import { NextRequest, NextResponse } from 'next/server';
import { bookingOperations } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

// POST /api/bookings/demo - Create a demo booking without Stripe
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (session.user.userType !== 'PARENT') {
      return NextResponse.json(
        { error: 'Only parents can create bookings' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      caregiverId,
      date,
      startTime,
      endTime,
      childrenCount,
      specialRequests,
      address,
      latitude,
      longitude,
      totalAmount,
      slotId
    } = body;

    console.log('📥 Demo booking request received:', {
      caregiverId,
      date,
      startTime,
      endTime,
      childrenCount,
      hasAddress: !!address,
      totalAmount
    });

    // Validate required fields
    if (!caregiverId || !date || !startTime || !endTime || !childrenCount) {
      console.error('❌ Missing required fields:', {
        hasCaregiverId: !!caregiverId,
        hasDate: !!date,
        hasStartTime: !!startTime,
        hasEndTime: !!endTime,
        hasChildrenCount: !!childrenCount,
        receivedBody: body
      });
      return NextResponse.json(
        {
          error: 'Missing required fields',
          missing: {
            caregiverId: !caregiverId,
            date: !date,
            startTime: !startTime,
            endTime: !endTime,
            childrenCount: !childrenCount
          }
        },
        { status: 400 }
      );
    }

    // Create full datetime objects
    const startDateTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(`${date}T${endTime}:00`);

    // Calculate duration and pricing
    const totalHours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
    const amountInCents = totalAmount || 2500; // Default to $25
    const hourlyRate = Math.round(amountInCents / (totalHours * 100));
    const platformCommissionRate = 0.15;
    const platformFee = Math.round(amountInCents * platformCommissionRate);

    // Create the booking
    const booking = await bookingOperations.createBooking({
      parentId: session.user.id,
      caregiverId: caregiverId,
      startTime: startDateTime,
      endTime: endDateTime,
      childrenCount: childrenCount,
      specialRequests: specialRequests || '',
      address: address || 'Demo address',
      latitude: latitude,
      longitude: longitude,
      hourlyRate: hourlyRate,
      totalHours: totalHours,
      subtotal: amountInCents - platformFee,
      platformFee: platformFee,
      totalAmount: amountInCents,
      slotId: slotId
    });

    console.log('✅ Demo booking created successfully:', booking.id);

    return NextResponse.json({
      success: true,
      bookingId: booking.id,
      message: 'Demo booking created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('❌ Error creating demo booking:', error);
    return NextResponse.json(
      {
        error: 'Failed to create booking',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}
