import { NextRequest, NextResponse } from 'next/server';
import { bookingOperations } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { logger, getClientInfo } from '@/lib/logger';
import { apiCache, cacheKeys } from '@/lib/cache';

// PATCH /api/bookings/[bookingId]/status - Update booking status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await params;
  const clientInfo = getClientInfo(request);
  
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.security('Unauthorized booking status update attempt', {
        bookingId: bookingId,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        error: 'No session'
      });
      
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { status } = await request.json();
    
    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      );
    }

    // Validate status values
    const validStatuses = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Get the booking first to verify permissions
    const booking = await bookingOperations.getBookingById(bookingId);
    
    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Check if user is authorized to update this booking
    const isCaregiver = session.user.userType === 'CAREGIVER' && booking.caregiverId === session.user.id;
    const isParent = session.user.userType === 'PARENT' && booking.parentId === session.user.id;
    const isAdmin = session.user.userType === 'ADMIN';

    if (!isCaregiver && !isParent && !isAdmin) {
      logger.security('Unauthorized booking status update', {
        userId: session.user.id,
        userType: session.user.userType,
        bookingId: bookingId,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent
      });
      
      return NextResponse.json(
        { error: 'You are not authorized to update this booking' },
        { status: 403 }
      );
    }

    // Update the booking status
    const updatedBooking = await bookingOperations.updateBookingStatus(bookingId, status);

    // Invalidate cache for both parent and caregiver bookings
    apiCache.delete(cacheKeys.bookings(booking.parentId));
    apiCache.delete(cacheKeys.bookings(booking.caregiverId));
    
    // Also invalidate chat rooms cache as booking status affects chat
    apiCache.delete(cacheKeys.chatRooms(booking.parentId, 'parent'));
    apiCache.delete(cacheKeys.chatRooms(booking.caregiverId, 'caregiver'));

    logger.info('Booking status updated', {
      bookingId: bookingId,
      oldStatus: booking.status,
      newStatus: status,
      updatedBy: session.user.id,
      userType: session.user.userType
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updatedBooking.id,
        status: updatedBooking.status,
        confirmedAt: updatedBooking.confirmedAt,
        completedAt: updatedBooking.completedAt,
        cancelledAt: updatedBooking.cancelledAt,
      },
      message: 'Booking status updated successfully'
    });

  } catch (error) {
    console.error('Error updating booking status:', error);
    
    logger.error('Booking status update failed', {
      bookingId: bookingId,
      userId: session?.user?.id,
      ip: clientInfo.ip,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update booking status',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}