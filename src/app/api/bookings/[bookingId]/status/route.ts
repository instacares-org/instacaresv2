import { NextRequest, NextResponse } from 'next/server';
import { bookingOperations } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { logger, getClientInfo } from '@/lib/logger';
import { apiCache, cacheKeys } from '@/lib/cache';
import { metrics } from '@/lib/metrics';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMIT_CONFIGS, createRateLimitHeaders } from '@/lib/rate-limit';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

const updateBookingStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], {
    message: 'Invalid status. Must be one of: PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED',
  }),
});

// PATCH /api/bookings/[bookingId]/status - Update booking status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await params;
  const clientInfo = getClientInfo(request);

  console.log('🚀 PATCH booking status endpoint hit:', { bookingId, ip: clientInfo.ip });

  try {
    const rateLimitResult = await checkRateLimit(request, RATE_LIMIT_CONFIGS.API_WRITE);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.security('Unauthorized booking status update attempt', {
        bookingId: bookingId,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        error: 'No session'
      });

      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const parsed = updateBookingStatusSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid input', parsed.error.flatten().fieldErrors);
    }
    const { status } = parsed.data;

    // Get the booking first to verify permissions
    console.log('🔍 Getting booking by ID:', bookingId);
    const booking = await bookingOperations.getBookingById(bookingId);
    console.log('📋 Booking found:', !!booking);

    if (!booking) {
      console.log('❌ Booking not found:', bookingId);
      return ApiErrors.notFound('Booking not found');
    }

    // Check if user is authorized to update this booking
    console.log('🔍 Authorization Debug:', {
      sessionUserId: session.user.id,
      sessionUserType: session.user.userType,
      bookingParentId: booking.parentId,
      bookingCaregiverId: booking.caregiverId,
      bookingId: bookingId
    });

    const isCaregiver = session.user.userType === 'CAREGIVER' && booking.caregiverId === session.user.id;
    const isParent = session.user.userType === 'PARENT' && booking.parentId === session.user.id;
    const isAdmin = session.user.userType === 'ADMIN';

    console.log('🔍 Authorization Results:', {
      isCaregiver,
      isParent,
      isAdmin,
      authorized: isCaregiver || isParent || isAdmin
    });

    if (!isCaregiver && !isParent && !isAdmin) {
      logger.security('Unauthorized booking status update', {
        userId: session.user.id,
        userType: session.user.userType,
        bookingId: bookingId,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent
      });
      
      return ApiErrors.forbidden('You are not authorized to update this booking');
    }

    // Update the booking status
    const updatedBooking = await bookingOperations.updateBookingStatus(bookingId, status);
    
    // Track booking status changes
    if (status === "CONFIRMED") metrics.bookingConfirmed();
    if (status === "CANCELLED") metrics.bookingCancelled();
    if (status === "COMPLETED") metrics.bookingCompleted();

    // Invalidate cache for both parent and caregiver bookings
    await apiCache.delete(cacheKeys.bookings(booking.parentId));
    await apiCache.delete(cacheKeys.bookings(booking.caregiverId));

    // Also invalidate chat rooms cache as booking status affects chat
    await apiCache.delete(cacheKeys.chatRooms(booking.parentId, 'parent'));
    await apiCache.delete(cacheKeys.chatRooms(booking.caregiverId, 'caregiver'));

    logger.info('Booking status updated', {
      bookingId: bookingId,
      oldStatus: booking.status,
      newStatus: status,
      updatedBy: session.user.id,
      userType: session.user.userType
    });

    return apiSuccess({
      id: updatedBooking.id,
      status: updatedBooking.status,
      confirmedAt: updatedBooking.confirmedAt,
      completedAt: updatedBooking.completedAt,
      cancelledAt: updatedBooking.cancelledAt,
    }, 'Booking status updated successfully');

  } catch (error) {
    console.error('Error updating booking status:', error);

    logger.error('Booking status update failed', {
      bookingId: bookingId,
      userId: 'unknown',
      ip: clientInfo.ip,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return ApiErrors.internal('Failed to update booking status');
  }
}