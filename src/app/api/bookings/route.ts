import { NextRequest, NextResponse } from 'next/server';
import { bookingOperations } from '@/lib/db';
import { withAuth } from '@/lib/auth-middleware';
import { logger, getClientInfo } from '@/lib/logger';
import { apiCache, cacheKeys, cacheTTL } from '@/lib/cache';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';
import { DateTime } from 'luxon';
import { getCommissionRate } from '@/lib/stripe';
import { CreateBookingSchema, validateRequest } from '@/lib/api-validation';
import { checkRateLimit, RATE_LIMIT_CONFIGS, createRateLimitHeaders } from '@/lib/rate-limit';

// GET /api/bookings - Get user's bookings
export async function GET(request: NextRequest) {
  const clientInfo = getClientInfo(request);
  
  try {
    // Verify authentication
    const authResult = await withAuth(request, 'ANY');
    if (!authResult.isAuthorized) {
      logger.security('Unauthorized booking access attempt', {
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent
      });
      
      return authResult.response;
    }

    const { searchParams } = new URL(request.url);
    
    const userId = searchParams.get('userId');
    const userType = searchParams.get('userType') as 'parent' | 'caregiver';
    const status = searchParams.get('status');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    if (!userId || !userType) {
      return ApiErrors.badRequest('Missing required fields', {
        required: ['userId', 'userType']
      });
    }

    // SECURITY: Verify the authenticated user can only access their own data
    // Only admins can access other users' bookings
    const user = authResult.user!;
    if (user.id !== userId && user.userType !== 'ADMIN') {
      logger.security('Unauthorized booking access attempt - IDOR attack', {
        requestedUserId: userId,
        authenticatedUserId: user.id,
        authenticatedUserType: user.userType,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        url: request.url
      });
      
      return ApiErrors.forbidden('Insufficient permissions');
    }

    // Generate cache key for user bookings
    const cacheKey = cacheKeys.bookings(userId, status || undefined);

    type BookingResult = Awaited<ReturnType<typeof bookingOperations.getUserBookings>>;

    // Try to get from cache first
    let bookings = await apiCache.get(cacheKey) as BookingResult | undefined;

    if (!bookings) {
      // Cache miss - fetch from database
      bookings = await bookingOperations.getUserBookings(userId, userType);

      // Cache the results for 1 minute (bookings change frequently)
      await apiCache.set(cacheKey, bookings, cacheTTL.bookings);
    }

    // Filter by status if provided
    const filteredBookings = status
      ? bookings.filter((booking: BookingResult[number]) => booking.status === status)
      : bookings;

    // Apply pagination
    const paginatedBookings = filteredBookings
      .slice(offset, offset + limit)
      .map((booking: BookingResult[number]) => ({
        id: booking.id,
        parentId: booking.parentId,
        caregiverId: booking.caregiverId,
        parentName: `${booking.parent.profile?.firstName} ${booking.parent.profile?.lastName}`,
        caregiverName: `${booking.caregiverUser.profile?.firstName} ${booking.caregiverUser.profile?.lastName}`,
        caregiverRate: booking.caregiverProfile.hourlyRate,
        parent: {
          id: booking.parent.id,
          email: booking.parent.email,
          profile: booking.parent.profile
        },
        caregiver: {
          id: booking.caregiverUser.id,
          email: booking.caregiverUser.email,
          profile: booking.caregiverUser.profile,
          averageRating: booking.caregiverProfile?.averageRating || null
        },
        startTime: booking.startTime,
        endTime: booking.endTime,
        childrenCount: booking.childrenCount,
        specialRequests: booking.specialRequests,
        address: booking.address,
        latitude: booking.latitude,
        longitude: booking.longitude,
        hourlyRate: booking.hourlyRate,
        totalHours: booking.totalHours,
        subtotal: booking.subtotal,
        platformFee: booking.platformFee,
        totalAmount: booking.totalAmount,
        status: booking.status,
        requestedAt: booking.requestedAt,
        confirmedAt: booking.confirmedAt,
        completedAt: booking.completedAt,
        cancelledAt: booking.cancelledAt,
        payments: booking.payments.map((payment: BookingResult[number]['payments'][number]) => ({
          id: payment.id,
          amount: payment.amount,
          status: payment.status,
          paidAt: payment.paidAt,
        })),
        reviews: booking.reviews ? [{
          id: booking.reviews.id,
          rating: booking.reviews.rating,
          comment: booking.reviews.comment,
          reviewerName: userType === 'parent' 
            ? `${booking.caregiverUser.profile?.firstName} ${booking.caregiverUser.profile?.lastName}`
            : `${booking.parent.profile?.firstName} ${booking.parent.profile?.lastName}`,
          createdAt: booking.reviews.createdAt,
        }] : [],
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
      }));

    return NextResponse.json({
      success: true,
      data: paginatedBookings,
      pagination: {
        limit,
        offset,
        total: filteredBookings.length,
        hasMore: offset + limit < filteredBookings.length,
      },
    });

  } catch (error) {
    console.error('Error fetching bookings:', error);
    return ApiErrors.internal('Failed to fetch bookings');
  }
}

// POST /api/bookings - Create new booking
export async function POST(request: NextRequest) {
  const clientInfo = getClientInfo(request);

  try {
    const rateLimitResult = await checkRateLimit(request, RATE_LIMIT_CONFIGS.BOOKING);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    // Verify authentication using NextAuth
    const authResult = await withAuth(request, 'PARENT');
    if (!authResult.isAuthorized) {
      logger.security('Unauthorized booking creation attempt', {
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent
      });

      return authResult.response;
    }

    // User type verification is already handled by withAuth('PARENT')
    // No additional user type check needed since withAuth ensures PARENT role

    const body = await request.json();

    // Validate input using Zod schema
    const validation = validateRequest(CreateBookingSchema, body);
    if (!validation.success) {
      return ApiErrors.badRequest('Invalid input', validation.errors);
    }

    const {
      parentId,
      caregiverId,
      startTime,
      endTime,
      childrenCount,
      specialRequests,
      address,
      latitude,
      longitude,
    } = validation.data;

    // Ensure the parentId matches the authenticated user
    const postUser = authResult.user!;
    if (parentId !== postUser.id) {
      logger.security('User attempted to create booking for another parent', {
        userId: postUser.id,
        requestedParentId: parentId,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent
      });
      
      return ApiErrors.forbidden('You can only create bookings for yourself');
    }

    // Get parent's timezone for proper time conversion
    const { prisma } = await import('@/lib/db');
    const parent = await prisma.user.findUnique({
      where: { id: parentId },
      include: { profile: true }
    });

    if (!parent || !parent.profile) {
      return ApiErrors.notFound('Parent profile not found');
    }

    const parentTimezone = parent.profile.timezone || 'America/Toronto';

    // Get caregiver's hourly rate
    const { caregiverOperations } = await import('@/lib/db');
    const caregiver = await caregiverOperations.findCaregiverByUserId(caregiverId);

    if (!caregiver) {
      return ApiErrors.notFound('Caregiver not found');
    }

    // Convert times from parent's timezone to UTC for database storage
    // Frontend sends ISO strings like "2025-11-09T09:00:00" which are in parent's local time
    const startDt = DateTime.fromISO(startTime, { zone: parentTimezone });
    const endDt = DateTime.fromISO(endTime, { zone: parentTimezone });

    if (!startDt.isValid || !endDt.isValid) {
      return ApiErrors.badRequest('Invalid date/time format', {
        startTime: startDt.invalidReason,
        endTime: endDt.invalidReason
      });
    }

    // Convert to UTC for storage
    const startUTC = startDt.toUTC();
    const endUTC = endDt.toUTC();

    // Calculate pricing
    const start = startUTC.toJSDate();
    const end = endUTC.toJSDate();
    const totalHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const hourlyRate = caregiver.hourlyRate;
    const subtotal = Math.round(totalHours * hourlyRate * 100); // in cents
    const platformCommissionRate = await getCommissionRate();
    const platformFee = Math.round(subtotal * platformCommissionRate);
    const totalAmount = subtotal;

    // Create booking
    const booking = await bookingOperations.createBooking({
      parentId,
      caregiverId,
      startTime: start,
      endTime: end,
      childrenCount,
      specialRequests,
      address,
      latitude,
      longitude,
      hourlyRate,
      totalHours,
      subtotal,
      platformFee,
      totalAmount,
    });

    return apiSuccess({
      id: booking.id,
      parentId: booking.parentId,
      caregiverId: booking.caregiverId,
      startTime: booking.startTime,
      endTime: booking.endTime,
      totalAmount: booking.totalAmount,
      platformFee: booking.platformFee,
      status: booking.status,
      createdAt: booking.createdAt,
    }, 'Booking created successfully', 201);

  } catch (error) {
    console.error('Error creating booking:', error);
    return ApiErrors.internal('Failed to create booking');
  }
}