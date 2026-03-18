import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { db } from '@/lib/db';
import { getCommissionRate, DEFAULT_COMMISSION_RATE } from '@/lib/stripe';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMIT_CONFIGS, createRateLimitHeaders } from '@/lib/rate-limit';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

const extendBookingBodySchema = z.object({
  extensionMinutes: z.number()
    .int('Extension minutes must be a whole number')
    .min(30, 'Extension must be at least 30 minutes')
    .max(240, 'Extension must not exceed 240 minutes')
    .refine(val => val % 30 === 0, 'Extension must be in 30-minute increments'),
  reason: z.string().max(1000, 'Reason must not exceed 1000 characters').optional(),
});

// POST: Create a booking extension request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const rateLimitResult = await checkRateLimit(request, RATE_LIMIT_CONFIGS.BOOKING);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { bookingId } = await params;
    const body = await request.json();
    const parsed = extendBookingBodySchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid input', parsed.error.flatten().fieldErrors);
    }
    const { extensionMinutes, reason } = parsed.data;

    // Get the booking
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        parent: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        caregiverProfile: true,
        extensions: {
          where: { status: { in: ['PENDING', 'PAYMENT_PENDING', 'PAID'] } }
        },
        payments: {
          where: { status: 'PAID' },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!booking) {
      return ApiErrors.notFound('Booking not found');
    }

    // Verify the requester is the caregiver for this booking
    if (booking.caregiverId !== session.user.id) {
      return ApiErrors.forbidden('Only the caregiver can request a booking extension');
    }

    // Booking must be IN_PROGRESS to extend
    if (booking.status !== 'IN_PROGRESS') {
      return ApiErrors.badRequest('Booking must be in progress to request an extension');
    }

    // Check for existing pending extensions
    if (booking.extensions.length > 0) {
      const pendingExtension = booking.extensions.find(
        e => e.status === 'PENDING' || e.status === 'PAYMENT_PENDING'
      );
      if (pendingExtension) {
        return ApiErrors.badRequest('There is already a pending extension request for this booking');
      }
    }

    // Calculate the current end time (accounting for previous extensions)
    const paidExtensions = booking.extensions.filter(e => e.status === 'PAID');
    const latestEndTime = paidExtensions.length > 0
      ? new Date(Math.max(...paidExtensions.map(e => e.newEndTime.getTime())))
      : booking.endTime;

    // Calculate new end time
    const newEndTime = new Date(latestEndTime.getTime() + extensionMinutes * 60 * 1000);

    // Calculate extension cost
    const extensionHours = extensionMinutes / 60;
    const extensionSubtotal = Math.round(booking.hourlyRate * extensionHours * 100); // in cents
    const commissionRate = await getCommissionRate();
    const platformFee = Math.round(extensionSubtotal * commissionRate);
    const caregiverPayout = extensionSubtotal - platformFee;
    const extensionAmount = extensionSubtotal; // Total to charge parent

    // Get parent's payment method from original booking payment
    const originalPayment = booking.payments[0];
    if (!originalPayment?.stripePaymentIntentId) {
      return ApiErrors.badRequest('No payment method found for this booking');
    }

    // Create the extension record
    const extension = await db.bookingExtension.create({
      data: {
        bookingId: booking.id,
        requestedBy: 'caregiver',
        extensionMinutes,
        hourlyRate: booking.hourlyRate,
        extensionAmount,
        platformFee,
        caregiverPayout,
        originalEndTime: latestEndTime,
        newEndTime,
        status: 'PENDING',
        reason,
        parentNotifiedAt: new Date(),
      }
    });

    // Notify parent about the extension request
    await db.notification.create({
      data: {
        userId: booking.parentId,
        type: 'BOOKING_EXTENSION',
        title: 'Booking Extension Requested',
        message: `Your caregiver has requested to extend the booking by ${extensionMinutes} minutes. Additional charge: $${(extensionAmount / 100).toFixed(2)}. An admin will review this request.`,
        resourceType: 'booking_extension',
        resourceId: extension.id,
      }
    });

    // Find admin users to notify
    const admins = await db.user.findMany({
      where: { userType: 'ADMIN', isActive: true },
      select: { id: true }
    });

    // Notify all admins
    for (const admin of admins) {
      await db.notification.create({
        data: {
          userId: admin.id,
          type: 'BOOKING_EXTENSION',
          title: 'Extension Awaiting Approval',
          message: `Caregiver requested a ${extensionMinutes}-min extension ($${(extensionAmount / 100).toFixed(2)}) for booking #${booking.id.slice(-8)}. Please review.`,
          resourceType: 'booking_extension',
          resourceId: extension.id,
        }
      });
    }

    console.log(`[Extension] Extension ${extension.id} created as PENDING, awaiting admin approval.`);

    return apiSuccess({
      extension: {
        id: extension.id,
        extensionMinutes,
        extensionAmount,
        newEndTime,
        status: 'PENDING',
      },
    }, 'Extension request submitted. An admin will review and approve it.');

  } catch (error) {
    console.error('Error creating booking extension:', error);
    return ApiErrors.internal('Failed to create booking extension');
  }
}

// GET: Get extensions for a booking
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { bookingId } = await params;

    // Get the booking
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        extensions: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!booking) {
      return ApiErrors.notFound('Booking not found');
    }

    // Verify the requester is part of this booking
    if (booking.caregiverId !== session.user.id && booking.parentId !== session.user.id) {
      return ApiErrors.forbidden();
    }

    return apiSuccess({
      extensions: booking.extensions.map(ext => ({
        id: ext.id,
        extensionMinutes: ext.extensionMinutes,
        extensionAmount: ext.extensionAmount,
        originalEndTime: ext.originalEndTime,
        newEndTime: ext.newEndTime,
        status: ext.status,
        reason: ext.reason,
        paidAt: ext.paidAt,
        createdAt: ext.createdAt,
      }))
    });

  } catch (error) {
    console.error('Error fetching booking extensions:', error);
    return ApiErrors.internal('Failed to fetch booking extensions');
  }
}
