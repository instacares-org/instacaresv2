import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth-middleware';
import { logger, getClientInfo } from '@/lib/logger';

// GET /api/reviews - Get reviews with authentication and authorization
export async function GET(request: NextRequest) {
  try {
    // STEP 1: Verify authentication
    const authResult = await withAuth(request, 'ANY');
    if (!authResult.isAuthorized) {
      const clientInfo = getClientInfo(request);
      logger.security('Unauthorized reviews access attempt', {
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        url: request.url
      });
      return authResult.response;
    }

    const authenticatedUser = authResult.user;
    if (!authenticatedUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const approved = searchParams.get('approved');
    const revieweeId = searchParams.get('revieweeId');
    const userId = searchParams.get('userId');
    const type = searchParams.get('type'); // 'given' or 'received'

    const skip = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = {};

    // STEP 2: Authorization - Filter based on user role
    if (authenticatedUser.userType === 'ADMIN') {
      // Admins can see all reviews (no additional filtering)
    } else if (authenticatedUser.userType === 'PARENT') {
      // Parents can only see reviews they wrote
      if (userId && userId !== authenticatedUser.id) {
        logger.security('Parent attempted to access other user reviews', {
          attackerUserId: authenticatedUser.id,
          requestedUserId: userId,
          ip: getClientInfo(request).ip
        });
        return NextResponse.json(
          { error: 'Unauthorized - You can only view your own reviews' },
          { status: 403 }
        );
      }

      if (type === 'given' || !type) {
        where.reviewerId = authenticatedUser.id;
      }
    } else if (authenticatedUser.userType === 'CAREGIVER') {
      // Caregivers can only see reviews about them
      const caregiver = await db.caregiver.findFirst({
        where: { userId: authenticatedUser.id }
      });

      if (!caregiver) {
        return NextResponse.json(
          { error: 'Caregiver profile not found' },
          { status: 404 }
        );
      }

      if (userId && userId !== authenticatedUser.id) {
        logger.security('Caregiver attempted to access other user reviews', {
          attackerUserId: authenticatedUser.id,
          requestedUserId: userId,
          ip: getClientInfo(request).ip
        });
        return NextResponse.json(
          { error: 'Unauthorized - You can only view reviews about you' },
          { status: 403 }
        );
      }

      where.revieweeId = authenticatedUser.id;
    }

    // Filter by approval status if specified
    if (approved !== null && approved !== undefined) {
      where.isApproved = approved === 'true';
    }

    // Filter by reviewee (caregiver) if specified
    if (revieweeId) {
      // Authorization check: Can this user view this caregiver's reviews?
      if (authenticatedUser.userType !== 'ADMIN') {
        // Non-admins can only view approved reviews for other caregivers
        where.isApproved = true;
      }
      where.revieweeId = revieweeId;
    }

    // Get reviews with related data
    const [reviews, total] = await Promise.all([
      db.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          reviewer: {
            include: {
              profile: true
            }
          },
          reviewee: {
            include: {
              profile: true
            }
          },
          booking: {
            select: {
              id: true,
              startTime: true,
              endTime: true,
              status: true
            }
          }
        }
      }),
      db.review.count({ where })
    ]);

    // Format reviews for response
    const formattedReviews = reviews.map(review => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      isApproved: review.isApproved,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
      moderatedAt: review.moderatedAt?.toISOString() || null,
      moderatorNotes: review.moderatorNotes || null,
      reviewer: {
        id: review.reviewer.id,
        name: `${review.reviewer.profile?.firstName || ''} ${review.reviewer.profile?.lastName || ''}`.trim() || 'Anonymous',
        avatar: review.reviewer.profile?.avatar || null
      },
      reviewee: {
        id: review.reviewee.id,
        name: `${review.reviewee.profile?.firstName || ''} ${review.reviewee.profile?.lastName || ''}`.trim() || 'Reviewee',
        avatar: review.reviewee.profile?.avatar || null
      },
      booking: review.booking ? {
        id: review.booking.id,
        startTime: review.booking.startTime.toISOString(),
        endTime: review.booking.endTime.toISOString(),
        status: review.booking.status
      } : null
    }));

    logger.info('Reviews fetched successfully', {
      userId: authenticatedUser.id,
      userType: authenticatedUser.userType,
      reviewCount: formattedReviews.length
    });

    return NextResponse.json({
      reviews: formattedReviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching reviews:', error);
    logger.error('Error fetching reviews', { error });
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

// POST /api/reviews - Create a new review (requires authentication)
export async function POST(request: NextRequest) {
  try {
    // STEP 1: Verify authentication
    const authResult = await withAuth(request, 'PARENT');
    if (!authResult.isAuthorized) {
      const clientInfo = getClientInfo(request);
      logger.security('Unauthorized review creation attempt', {
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent
      });
      return authResult.response;
    }

    const authenticatedUser = authResult.user;
    if (!authenticatedUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { bookingId, caregiverId, parentId, rating, comment } = body;

    if (!bookingId || !caregiverId || !parentId || !rating) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // STEP 2: Authorization - Ensure user can only create reviews for themselves
    if (parentId !== authenticatedUser.id) {
      logger.security('Parent attempted to create review for another user', {
        attackerUserId: authenticatedUser.id,
        targetParentId: parentId,
        ip: getClientInfo(request).ip
      });
      return NextResponse.json(
        { error: 'Unauthorized - You can only create reviews for yourself' },
        { status: 403 }
      );
    }

    // Verify the booking exists and belongs to the parent
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: { parent: true }
    });

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    if (booking.parentId !== parentId) {
      logger.security('Parent attempted to review unauthorized booking', {
        userId: authenticatedUser.id,
        bookingId,
        bookingParentId: booking.parentId,
        ip: getClientInfo(request).ip
      });
      return NextResponse.json(
        { error: 'Unauthorized to review this booking' },
        { status: 403 }
      );
    }

    // Check if review already exists for this booking
    const existingReview = await db.review.findFirst({
      where: {
        bookingId,
        reviewerId: parentId,
        revieweeId: caregiverId
      }
    });

    if (existingReview) {
      return NextResponse.json(
        { error: 'Review already exists for this booking' },
        { status: 400 }
      );
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    // Create the review
    const review = await db.review.create({
      data: {
        bookingId,
        reviewerId: parentId,
        revieweeId: caregiverId,
        rating,
        comment: comment || '',
        isApproved: false // Reviews need admin approval
      },
      include: {
        reviewer: {
          include: { profile: true }
        },
        reviewee: {
          include: {
            profile: true
          }
        }
      }
    });

    // Update caregiver's average rating (only approved reviews)
    const approvedReviews = await db.review.findMany({
      where: {
        revieweeId: caregiverId,
        isApproved: true
      }
    });

    if (approvedReviews.length > 0) {
      const avgRating = approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length;

      // Find caregiver by userId to update averageRating
      const caregiverProfile = await db.caregiver.findFirst({
        where: { userId: caregiverId }
      });

      if (caregiverProfile) {
        await db.caregiver.update({
          where: { id: caregiverProfile.id },
          data: {
            averageRating: avgRating
          }
        });
      }
    }

    logger.info('Review created successfully', {
      reviewId: review.id,
      userId: authenticatedUser.id,
      caregiverId,
      rating
    });

    return NextResponse.json({
      success: true,
      review: {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        isApproved: review.isApproved,
        createdAt: review.createdAt.toISOString()
      }
    });

  } catch (error) {
    console.error('Error creating review:', error);
    logger.error('Error creating review', { error });
    return NextResponse.json(
      { error: 'Failed to create review' },
      { status: 500 }
    );
  }
}
