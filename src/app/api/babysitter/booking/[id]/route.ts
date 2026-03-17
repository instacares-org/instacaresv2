import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { db } from '@/lib/db';
import { z } from 'zod';
import { getStripeInstance } from '@/lib/stripe';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';
import { checkRateLimit, RATE_LIMIT_CONFIGS, createRateLimitHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// Validation schema for status update
const statusUpdateSchema = z.object({
  action: z.enum(['confirm', 'decline', 'start', 'complete', 'cancel']),
  reason: z.string().max(500).optional(), // For decline/cancel
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResult = await checkRateLimit(request, RATE_LIMIT_CONFIGS.API_WRITE);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const userId = session.user.id;
    const { id: bookingId } = await params;
    const body = await request.json();

    const validatedData = statusUpdateSchema.parse(body);

    // Get the booking
    const booking = await db.babysitterBooking.findUnique({
      where: { id: bookingId },
      include: {
        babysitter: true,
        parent: true,
      }
    });

    if (!booking) {
      return ApiErrors.notFound('Booking not found');
    }

    const isBabysitter = booking.babysitter.userId === userId;
    const isParent = booking.parentId === userId;

    if (!isBabysitter && !isParent) {
      return ApiErrors.forbidden('You are not authorized to update this booking');
    }

    let updateData: Record<string, unknown> = {};
    let message = '';

    switch (validatedData.action) {
      case 'confirm':
        // Only babysitter can confirm
        if (!isBabysitter) {
          return ApiErrors.forbidden('Only the babysitter can confirm a booking');
        }
        if (booking.status !== 'PENDING') {
          return ApiErrors.badRequest('Can only confirm pending bookings');
        }
        updateData = {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
        };
        message = 'Booking confirmed successfully';
        break;

      case 'decline':
        // Only babysitter can decline
        if (!isBabysitter) {
          return ApiErrors.forbidden('Only the babysitter can decline a booking');
        }
        if (booking.status !== 'PENDING') {
          return ApiErrors.badRequest('Can only decline pending bookings');
        }

        // Refund platform fee if it was charged
        if (booking.platformFeePaymentId) {
          try {
            const stripe = getStripeInstance();
            if (stripe) {
              await stripe.refunds.create({
                payment_intent: booking.platformFeePaymentId,
                reason: 'requested_by_customer',
                metadata: { bookingId, reason: 'Declined by babysitter' },
              });
              console.log(`Refunded platform fee for declined booking ${bookingId}`);
            }
          } catch (refundError) {
            console.error('Failed to refund platform fee on decline:', refundError);
          }
        }

        updateData = {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: 'babysitter',
          cancellationReason: validatedData.reason || 'Declined by babysitter',
        };
        message = 'Booking declined. Platform fee has been refunded.';
        break;

      case 'start':
        // Only babysitter can start
        if (!isBabysitter) {
          return ApiErrors.forbidden('Only the babysitter can start a session');
        }
        if (booking.status !== 'CONFIRMED') {
          return ApiErrors.badRequest('Can only start confirmed bookings');
        }
        updateData = {
          status: 'IN_PROGRESS',
          startedAt: new Date(),
        };
        message = 'Session started';
        break;

      case 'complete':
        // Only babysitter can complete
        if (!isBabysitter) {
          return ApiErrors.forbidden('Only the babysitter can complete a session');
        }
        if (booking.status !== 'IN_PROGRESS') {
          return ApiErrors.badRequest('Can only complete in-progress bookings');
        }
        updateData = {
          status: 'COMPLETED',
          completedAt: new Date(),
        };

        // Update babysitter stats
        await db.babysitter.update({
          where: { id: booking.babysitterId },
          data: {
            totalBookings: { increment: 1 },
            totalEarnings: { increment: booking.babysitterPayout },
          }
        });

        message = 'Session completed successfully';
        break;

      case 'cancel':
        // Both parent and babysitter can cancel
        if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
          return ApiErrors.badRequest('Cannot cancel a booking that is in progress or already completed');
        }

        // Calculate cancellation policy
        const hoursUntilStart = (new Date(booking.startTime).getTime() - Date.now()) / (1000 * 60 * 60);
        let refundNote = '';

        // Refund platform fee if it was charged
        if (booking.platformFeePaymentId) {
          let shouldRefund = false;

          if (isBabysitter) {
            // Babysitter cancels: always refund the parent
            shouldRefund = true;
          } else if (isParent && hoursUntilStart >= 24) {
            // Parent cancels with 24+ hours notice: refund
            shouldRefund = true;
          }
          // Parent cancels with < 24 hours: no refund

          if (shouldRefund) {
            try {
              const stripe = getStripeInstance();
              if (stripe) {
                await stripe.refunds.create({
                  payment_intent: booking.platformFeePaymentId,
                  reason: 'requested_by_customer',
                  metadata: { bookingId, cancelledBy: isBabysitter ? 'babysitter' : 'parent' },
                });
                refundNote = 'Platform fee has been refunded.';
                console.log(`Refunded platform fee for cancelled booking ${bookingId}`);
              }
            } catch (refundError) {
              console.error('Failed to refund platform fee on cancel:', refundError);
              refundNote = 'Refund processing may be delayed.';
            }
          } else if (isParent && hoursUntilStart < 24) {
            refundNote = 'Late cancellation. Platform fee is non-refundable.';
          }
        }

        updateData = {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: isBabysitter ? 'babysitter' : 'parent',
          cancellationReason: validatedData.reason || `Cancelled by ${isBabysitter ? 'babysitter' : 'parent'}`,
        };

        message = `Booking cancelled. ${refundNote}`;
        break;

      default:
        return ApiErrors.badRequest('Invalid action');
    }

    // Update the booking
    const updatedBooking = await db.babysitterBooking.update({
      where: { id: bookingId },
      data: updateData,
    });

    // TODO: Send notification to the other party

    return apiSuccess({
      booking: {
        id: updatedBooking.id,
        status: updatedBooking.status,
      }
    }, message);

  } catch (error) {
    console.error('Update babysitter booking error:', error);

    if (error instanceof z.ZodError) {
      return ApiErrors.badRequest('Validation error', error.issues);
    }

    return ApiErrors.internal('Failed to update booking');
  }
}

// GET - Get specific booking details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const userId = session.user.id;
    const { id: bookingId } = await params;

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
            },
            children: true,
          }
        },
        chatRoom: true,
        review: true,
      }
    });

    if (!booking) {
      return ApiErrors.notFound('Booking not found');
    }

    const isBabysitter = booking.babysitter.userId === userId;

    return apiSuccess({
      booking: {
        id: booking.id,
        status: booking.status,
        startTime: booking.startTime,
        endTime: booking.endTime,
        startedAt: booking.startedAt,
        completedAt: booking.completedAt,
        totalHours: booking.totalHours,
        childrenCount: booking.childrenCount,
        specialRequests: booking.specialRequests,
        // Only show full address to babysitter after confirmation
        address: isBabysitter && ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(booking.status)
          ? booking.address
          : undefined,
        apartment: isBabysitter && ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(booking.status)
          ? booking.apartment
          : undefined,
        city: booking.city,
        state: booking.state,
        zipCode: booking.zipCode,
        hourlyRate: booking.hourlyRate,
        subtotal: booking.subtotal / 100,
        platformFee: booking.platformFee / 100,
        totalAmount: booking.totalAmount / 100,
        babysitterPayout: booking.babysitterPayout / 100,
        paymentMethod: booking.paymentMethod,
        platformFeePaidAt: booking.platformFeePaidAt,
        babysitter: {
          id: booking.babysitter.id,
          firstName: booking.babysitter.user.profile?.firstName,
          lastName: isBabysitter ? booking.babysitter.user.profile?.lastName : booking.babysitter.user.profile?.lastName?.charAt(0) + '.',
          avatar: booking.babysitter.user.profile?.avatar,
          phone: ['CONFIRMED', 'IN_PROGRESS'].includes(booking.status) ? booking.babysitter.user.profile?.phone : undefined,
        },
        parent: {
          firstName: booking.parent.profile?.firstName,
          lastName: booking.parent.profile?.lastName,
          avatar: booking.parent.profile?.avatar,
          phone: isBabysitter && ['CONFIRMED', 'IN_PROGRESS'].includes(booking.status) ? booking.parent.profile?.phone : undefined,
          childrenCount: booking.parent.children?.length || 0,
        },
        chatRoomId: booking.chatRoom?.id,
        hasReview: !!booking.review,
        createdAt: booking.createdAt,
      }
    });

  } catch (error) {
    console.error('Get babysitter booking error:', error);
    return ApiErrors.internal('Failed to get booking');
  }
}
