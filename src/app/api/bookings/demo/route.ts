import { NextRequest } from 'next/server';
import { bookingOperations } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';

// POST /api/bookings/demo - Create a demo booking without Stripe
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return ApiErrors.unauthorized();
    }

    if (session.user.userType !== 'PARENT') {
      return ApiErrors.forbidden('Only parents can create bookings');
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
      return ApiErrors.badRequest('Missing required fields', {
        missing: {
          caregiverId: !caregiverId,
          date: !date,
          startTime: !startTime,
          endTime: !endTime,
          childrenCount: !childrenCount
        }
      });
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

    return apiSuccess({ bookingId: booking.id }, 'Demo booking created successfully', 201);

  } catch (error) {
    console.error('❌ Error creating demo booking:', error);
    return ApiErrors.internal('Failed to create booking');
  }
}
