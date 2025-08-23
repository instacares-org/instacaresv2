import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';



// POST /api/reviews - Create a new review
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token.value, process.env.JWT_SECRET!) as { userId: string };
    const body = await request.json();
    
    const { bookingId, revieweeId, rating, comment } = body;

    // Validation
    if (!bookingId || !revieweeId || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    if (!comment || comment.trim().length < 10 || comment.trim().length > 1000) {
      return NextResponse.json({ error: 'Comment must be between 10 and 1000 characters' }, { status: 400 });
    }

    // Check if booking exists and user participated
    const booking = await db.booking.findFirst({
      where: {
        id: bookingId,
        OR: [
          { parentId: decoded.userId },
          { caregiverId: decoded.userId }
        ],
        status: 'COMPLETED'
      },
      include: {
        parent: { include: { profile: true } },
        caregiver: { include: { profile: true } },
        reviews: true
      }
    });

    if (!booking) {
      return NextResponse.json({ 
        error: 'Booking not found or not eligible for review' 
      }, { status: 404 });
    }

    // Check if user already reviewed this booking
    const existingReview = booking.reviews.find(r => r.reviewerId === decoded.userId);
    if (existingReview) {
      return NextResponse.json({ 
        error: 'You have already reviewed this booking' 
      }, { status: 409 });
    }

    // Verify reviewee is the other participant in the booking
    const isParent = booking.parentId === decoded.userId;
    const expectedRevieweeId = isParent ? booking.caregiverId : booking.parentId;
    
    if (revieweeId !== expectedRevieweeId) {
      return NextResponse.json({ 
        error: 'Invalid reviewee' 
      }, { status: 400 });
    }

    // Create review
    const review = await db.review.create({
      data: {
        bookingId,
        reviewerId: decoded.userId,
        revieweeId,
        rating,
        comment: comment.trim(),
        isApproved: false // Pending moderation
      },
      include: {
        reviewer: {
          include: { profile: true }
        },
        reviewee: {
          include: { profile: true }
        },
        booking: true
      }
    });

    // Update caregiver's average rating if reviewing a caregiver
    if (!isParent) { // Parent is reviewing caregiver
      await updateCaregiverRating(revieweeId);
    }

    // Create notification for reviewee
    await db.notification.create({
      data: {
        userId: revieweeId,
        type: 'review_received',
        title: 'New Review Received',
        message: `${review.reviewer.profile?.firstName} ${review.reviewer.profile?.lastName} left you a ${rating}-star review`,
        resourceType: 'review',
        resourceId: review.id
      }
    });

    // Create notification for admin (moderation)
    const adminUsers = await db.user.findMany({
      where: { userType: 'ADMIN' }
    });

    for (const admin of adminUsers) {
      await db.notification.create({
        data: {
          userId: admin.id,
          type: 'review_moderation',
          title: 'Review Pending Approval',
          message: `New review from ${review.reviewer.profile?.firstName} ${review.reviewer.profile?.lastName} needs moderation`,
          resourceType: 'review',
          resourceId: review.id
        }
      });
    }

    return NextResponse.json({
      success: true,
      review: {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        isApproved: review.isApproved,
        createdAt: review.createdAt,
        reviewer: {
          name: `${review.reviewer.profile?.firstName} ${review.reviewer.profile?.lastName}`,
          avatar: review.reviewer.profile?.avatar
        }
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating review:', error);
    return NextResponse.json(
      { error: 'Failed to create review' },
      { status: 500 }
    );
  }
}

// GET /api/reviews - Get reviews (with filtering)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const type = searchParams.get('type'); // 'given' | 'received'
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const approved = searchParams.get('approved');

    const whereClause: any = {};
    
    // If userId is provided, filter by it
    if (userId) {
      if (type === 'given') {
        whereClause.reviewerId = userId;
      } else if (type === 'received') {
        whereClause.revieweeId = userId;
      }
    }
    // If no userId, admin is viewing all reviews

    if (approved === 'true') {
      whereClause.isApproved = true;
    } else if (approved === 'false') {
      whereClause.isApproved = false;
    }

    const [reviews, totalCount] = await Promise.all([
      db.review.findMany({
        where: whereClause,
        include: {
          reviewer: {
            include: { profile: true }
          },
          reviewee: {
            include: { profile: true }
          },
          booking: {
            include: {
              parent: { include: { profile: true } },
              caregiver: { include: { profile: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      db.review.count({ where: whereClause })
    ]);

    const formattedReviews = reviews.map(review => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      isApproved: review.isApproved,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      moderatedAt: review.moderatedAt,
      reviewer: {
        id: review.reviewer.id,
        name: `${review.reviewer.profile?.firstName || ''} ${review.reviewer.profile?.lastName || ''}`.trim(),
        avatar: review.reviewer.profile?.avatar
      },
      reviewee: {
        id: review.reviewee.id,
        name: `${review.reviewee.profile?.firstName || ''} ${review.reviewee.profile?.lastName || ''}`.trim(),
        avatar: review.reviewee.profile?.avatar
      },
      booking: {
        id: review.booking.id,
        startTime: review.booking.startTime,
        endTime: review.booking.endTime,
        status: review.booking.status
      }
    }));

    return NextResponse.json({
      success: true,
      reviews: formattedReviews,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

// Helper function to update caregiver's average rating
async function updateCaregiverRating(caregiverId: string) {
  try {
    // Get all approved reviews for this caregiver
    const reviews = await db.review.findMany({
      where: {
        revieweeId: caregiverId,
        isApproved: true
      }
    });

    if (reviews.length > 0) {
      const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
      
      // Update caregiver's average rating
      await db.caregiver.update({
        where: { userId: caregiverId },
        data: { 
          averageRating: parseFloat(averageRating.toFixed(2))
        }
      });
    }
  } catch (error) {
    console.error('Error updating caregiver rating:', error);
  }
}