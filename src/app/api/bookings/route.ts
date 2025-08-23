import { NextRequest, NextResponse } from 'next/server';
import { bookingOperations } from '@/lib/db';
import { verifyTokenFromRequest } from '@/lib/jwt';
import { logger, getClientInfo } from '@/lib/logger';
import { apiCache, cacheKeys, cacheTTL } from '@/lib/cache';

// GET /api/bookings - Get user's bookings
export async function GET(request: NextRequest) {
  const clientInfo = getClientInfo(request);
  
  try {
    // Verify authentication
    const tokenResult = verifyTokenFromRequest(request);
    if (!tokenResult.isValid || !tokenResult.user) {
      logger.security('Unauthorized booking access attempt', {
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        error: tokenResult.error
      });
      
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    
    const userId = searchParams.get('userId');
    const userType = searchParams.get('userType') as 'parent' | 'caregiver';
    const status = searchParams.get('status');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    if (!userId || !userType) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameters',
          required: ['userId', 'userType'],
        },
        { status: 400 }
      );
    }

    // Generate cache key for user bookings
    const cacheKey = cacheKeys.bookings(userId, status || undefined);
    
    // Try to get from cache first
    let bookings = apiCache.get(cacheKey);
    
    if (!bookings) {
      // Cache miss - fetch from database
      bookings = await bookingOperations.getUserBookings(userId, userType);
      
      // Cache the results for 1 minute (bookings change frequently)
      apiCache.set(cacheKey, bookings, cacheTTL.bookings);
    }

    // Filter by status if provided
    const filteredBookings = status 
      ? bookings.filter(booking => booking.status === status)
      : bookings;

    // Apply pagination
    const paginatedBookings = filteredBookings
      .slice(offset, offset + limit)
      .map(booking => ({
        id: booking.id,
        parentId: booking.parentId,
        caregiverId: booking.caregiverId,
        parentName: `${booking.parent.profile?.firstName} ${booking.parent.profile?.lastName}`,
        caregiverName: `${booking.caregiver.profile?.firstName} ${booking.caregiver.profile?.lastName}`,
        caregiverRate: booking.caregiverData.hourlyRate,
        parent: {
          id: booking.parent.id,
          email: booking.parent.email,
          profile: booking.parent.profile
        },
        caregiver: {
          id: booking.caregiver.id,
          email: booking.caregiver.email,
          profile: booking.caregiver.profile
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
        payments: booking.payments.map(payment => ({
          id: payment.id,
          amount: payment.amount,
          status: payment.status,
          paidAt: payment.paidAt,
        })),
        reviews: booking.reviews.map(review => ({
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          reviewerName: userType === 'parent' 
            ? `${booking.caregiver.profile?.firstName} ${booking.caregiver.profile?.lastName}`
            : `${booking.parent.profile?.firstName} ${booking.parent.profile?.lastName}`,
          createdAt: review.createdAt,
        })),
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
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch bookings',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// POST /api/bookings - Create new booking
export async function POST(request: NextRequest) {
  const clientInfo = getClientInfo(request);
  
  try {
    // Verify authentication
    const tokenResult = verifyTokenFromRequest(request);
    if (!tokenResult.isValid || !tokenResult.user) {
      logger.security('Unauthorized booking creation attempt', {
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        error: tokenResult.error
      });
      
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify user is a parent
    if (tokenResult.user.userType !== 'PARENT') {
      logger.security('Non-parent user attempted to create booking', {
        userId: tokenResult.user.userId,
        userType: tokenResult.user.userType,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent
      });
      
      return NextResponse.json(
        { error: 'Only parents can create bookings' },
        { status: 403 }
      );
    }

    const body = await request.json();
    
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
    } = body;

    // Validate required fields
    if (!parentId || !caregiverId || !startTime || !endTime || !childrenCount || !address) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          required: ['parentId', 'caregiverId', 'startTime', 'endTime', 'childrenCount', 'address'],
        },
        { status: 400 }
      );
    }

    // Ensure the parentId matches the authenticated user
    if (parentId !== tokenResult.user.userId) {
      logger.security('User attempted to create booking for another parent', {
        userId: tokenResult.user.userId,
        requestedParentId: parentId,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent
      });
      
      return NextResponse.json(
        { error: 'You can only create bookings for yourself' },
        { status: 403 }
      );
    }

    // Get caregiver's hourly rate
    const { caregiverOperations } = await import('@/lib/db');
    const caregiver = await caregiverOperations.findCaregiverByUserId(caregiverId);
    
    if (!caregiver) {
      return NextResponse.json(
        {
          success: false,
          error: 'Caregiver not found',
        },
        { status: 404 }
      );
    }

    // Calculate pricing
    const start = new Date(startTime);
    const end = new Date(endTime);
    const totalHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const hourlyRate = caregiver.hourlyRate;
    const subtotal = Math.round(totalHours * hourlyRate * 100); // in cents
    const platformCommissionRate = parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.15');
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

    return NextResponse.json({
      success: true,
      data: {
        id: booking.id,
        parentId: booking.parentId,
        caregiverId: booking.caregiverId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        totalAmount: booking.totalAmount,
        platformFee: booking.platformFee,
        status: booking.status,
        createdAt: booking.createdAt,
      },
      message: 'Booking created successfully',
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating booking:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create booking',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}