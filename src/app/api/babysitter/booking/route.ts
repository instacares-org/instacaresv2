import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { getCommissionRate, getStripeInstance } from '@/lib/stripe';
import { requireAuth, apiSuccess, ApiErrors } from '@/lib/api-utils';
import { checkRateLimit, RATE_LIMIT_CONFIGS, createRateLimitHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// Validation schema for booking
const bookingSchema = z.object({
  babysitterId: z.string().min(1, 'Babysitter ID is required'),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  childrenCount: z.number().min(1).max(6),
  specialRequests: z.string().max(500).optional(),
  address: z.string().min(5, 'Address is required'),
  apartment: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State/Province is required'),
  zipCode: z.string().min(3, 'Postal code is required'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  paymentMethod: z.enum(['ONSITE', 'PLATFORM']).default('ONSITE'),
  paymentIntentId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await checkRateLimit(request, RATE_LIMIT_CONFIGS.BOOKING);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    const { user, error: authError } = await requireAuth('PARENT');
    if (authError) return authError;

    const parentId = user.id;
    const body = await request.json();

    // Validate input
    const validatedData = bookingSchema.parse(body);

    // Can't book yourself
    const babysitter = await db.babysitter.findUnique({
      where: { id: validatedData.babysitterId },
      include: {
        user: true
      }
    });

    if (!babysitter) {
      return ApiErrors.notFound('Babysitter not found');
    }

    if (babysitter.userId === parentId) {
      return ApiErrors.badRequest('You cannot book yourself');
    }

    if (babysitter.status !== 'APPROVED') {
      return ApiErrors.badRequest('This babysitter is not currently accepting bookings');
    }

    if (!babysitter.isAvailable) {
      return ApiErrors.badRequest('This babysitter is currently unavailable');
    }

    // Validate payment method
    if (validatedData.paymentMethod === 'PLATFORM' && !babysitter.stripeOnboarded) {
      return ApiErrors.badRequest('This babysitter does not accept platform payments. Please use on-site payment.');
    }

    // Calculate pricing
    const startTime = new Date(validatedData.startTime);
    const endTime = new Date(validatedData.endTime);
    const totalHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

    if (totalHours <= 0) {
      return ApiErrors.badRequest('End time must be after start time');
    }

    if (totalHours < 2) {
      return ApiErrors.badRequest('Minimum booking is 2 hours');
    }

    const hourlyRate = babysitter.hourlyRate;
    const commissionRate = await getCommissionRate(); // Admin-configured rate
    const subtotal = Math.round(hourlyRate * totalHours * 100); // In cents
    const platformFee = Math.round(subtotal * commissionRate);
    const totalAmount = subtotal + platformFee;
    const babysitterPayout = subtotal; // Babysitter gets full subtotal (platform fee paid separately by parent)

    // Check for conflicting bookings
    const conflictingBooking = await db.babysitterBooking.findFirst({
      where: {
        babysitterId: validatedData.babysitterId,
        status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
        OR: [
          {
            AND: [
              { startTime: { lte: startTime } },
              { endTime: { gt: startTime } }
            ]
          },
          {
            AND: [
              { startTime: { lt: endTime } },
              { endTime: { gte: endTime } }
            ]
          },
          {
            AND: [
              { startTime: { gte: startTime } },
              { endTime: { lte: endTime } }
            ]
          }
        ]
      }
    });

    if (conflictingBooking) {
      // If payment was already made, refund it
      if (validatedData.paymentIntentId) {
        try {
          const stripe = getStripeInstance();
          if (stripe) await stripe.refunds.create({ payment_intent: validatedData.paymentIntentId });
        } catch (refundErr) {
          console.error('Failed to refund platform fee after conflict:', refundErr);
        }
      }
      return ApiErrors.conflict('This babysitter is already booked during this time');
    }

    // Verify platform fee payment for ONSITE bookings
    let platformFeePaymentId: string | null = null;
    let platformFeePaidAt: Date | null = null;

    if (validatedData.paymentMethod === 'ONSITE') {
      if (!validatedData.paymentIntentId) {
        return ApiErrors.badRequest('Platform fee payment is required for on-site bookings');
      }

      const stripe = getStripeInstance();
      if (!stripe) {
        return ApiErrors.internal('Payment service unavailable');
      }
      const paymentIntent = await stripe.paymentIntents.retrieve(validatedData.paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        return ApiErrors.badRequest('Platform fee payment has not been completed');
      }

      platformFeePaymentId = validatedData.paymentIntentId;
      platformFeePaidAt = new Date();
    }

    // Create booking
    const booking = await db.babysitterBooking.create({
      data: {
        babysitterId: validatedData.babysitterId,
        parentId,
        startTime,
        endTime,
        childrenCount: validatedData.childrenCount,
        specialRequests: validatedData.specialRequests,
        address: validatedData.address,
        apartment: validatedData.apartment,
        city: validatedData.city,
        state: validatedData.state,
        zipCode: validatedData.zipCode,
        latitude: validatedData.latitude,
        longitude: validatedData.longitude,
        hourlyRate,
        totalHours,
        subtotal,
        platformFee,
        totalAmount,
        babysitterPayout,
        paymentMethod: validatedData.paymentMethod,
        platformFeePaymentId,
        platformFeePaidAt,
        status: 'PENDING',
      }
    });

    // Create chat room for the booking
    await db.babysitterChatRoom.create({
      data: {
        bookingId: booking.id,
        parentId,
        babysitterId: validatedData.babysitterId,
      }
    });

    // TODO: Send notification to babysitter about new booking request

    const bookingMessage = validatedData.paymentMethod === 'ONSITE'
      ? 'Booking request sent! Platform fee of $' + (booking.platformFee / 100).toFixed(2) + ' has been charged. You will pay the babysitter $' + (booking.subtotal / 100).toFixed(2) + ' directly at the end of the session.'
      : 'Booking request sent. Full payment will be processed when the babysitter confirms.';

    return apiSuccess({
      booking: {
        id: booking.id,
        status: booking.status,
        startTime: booking.startTime,
        endTime: booking.endTime,
        totalHours: booking.totalHours,
        subtotal: booking.subtotal / 100,
        platformFee: booking.platformFee / 100,
        totalAmount: booking.totalAmount / 100,
        babysitterPayout: booking.babysitterPayout / 100,
        paymentMethod: booking.paymentMethod,
      },
    }, bookingMessage);

  } catch (error) {
    console.error('Create babysitter booking error:', error);

    if (error instanceof z.ZodError) {
      return ApiErrors.badRequest('Validation error', error.issues);
    }

    return ApiErrors.internal('Failed to create booking');
  }
}

// GET - Get bookings (for parent or babysitter)
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const userId = user.id;
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role') || 'parent'; // parent or babysitter
    const status = searchParams.get('status'); // filter by status
    const bookingId = searchParams.get('id'); // get specific booking

    // Get specific booking
    if (bookingId) {
      const booking = await db.babysitterBooking.findFirst({
        where: {
          id: bookingId,
          OR: [
            { parentId: userId },
            { babysitter: { userId } }
          ]
        },
        include: {
          babysitter: {
            include: {
              user: {
                include: {
                  profile: {
                    select: {
                      firstName: true,
                      lastName: true,
                      avatar: true,
                      phone: true,
                    }
                  }
                }
              }
            }
          },
          parent: {
            include: {
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                  avatar: true,
                  phone: true,
                }
              }
            }
          },
          chatRoom: true,
          review: true,
        }
      });

      if (!booking) {
        return ApiErrors.notFound('Booking not found');
      }

      return apiSuccess({ booking });
    }

    // Build where clause based on role
    const where: Record<string, unknown> = {};

    if (role === 'babysitter') {
      const babysitter = await db.babysitter.findUnique({
        where: { userId }
      });

      if (!babysitter) {
        return ApiErrors.forbidden('You are not registered as a babysitter');
      }

      where.babysitterId = babysitter.id;
    } else {
      where.parentId = userId;
    }

    if (status) {
      where.status = status;
    }

    const bookings = await db.babysitterBooking.findMany({
      where,
      include: {
        babysitter: {
          include: {
            user: {
              include: {
                profile: {
                  select: {
                    firstName: true,
                    lastName: true,
                    avatar: true,
                  }
                }
              }
            }
          }
        },
        parent: {
          include: {
            profile: {
              select: {
                firstName: true,
                lastName: true,
                avatar: true,
              }
            }
          }
        },
      },
      orderBy: { startTime: 'desc' },
    });

    return apiSuccess({
      bookings: bookings.map(b => ({
        id: b.id,
        status: b.status,
        startTime: b.startTime,
        endTime: b.endTime,
        totalHours: b.totalHours,
        subtotal: b.subtotal / 100,
        platformFee: b.platformFee / 100,
        totalAmount: b.totalAmount / 100,
        paymentMethod: b.paymentMethod,
        childrenCount: b.childrenCount,
        address: role === 'babysitter' && b.status === 'CONFIRMED' ? b.address : undefined,
        city: b.city,
        babysitter: role === 'parent' ? {
          firstName: b.babysitter.user.profile?.firstName,
          lastName: b.babysitter.user.profile?.lastName?.charAt(0) + '.',
          avatar: b.babysitter.user.profile?.avatar,
        } : undefined,
        parent: role === 'babysitter' ? {
          firstName: b.parent.profile?.firstName,
          lastName: b.parent.profile?.lastName,
          avatar: b.parent.profile?.avatar,
        } : undefined,
        createdAt: b.createdAt,
      }))
    });

  } catch (error) {
    console.error('Get babysitter bookings error:', error);
    return ApiErrors.internal('Failed to get bookings');
  }
}
