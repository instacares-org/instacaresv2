import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/reviews - Get all reviews (admin only) or caregiver reviews
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const approved = searchParams.get('approved');
    const revieweeId = searchParams.get('revieweeId');
    
    const skip = (page - 1) * limit;
    
    const where: any = {};
    
    // Filter by approval status if specified
    if (approved !== null && approved !== undefined) {
      where.isApproved = approved === 'true';
    }
    
    // Filter by reviewee (caregiver) if specified
    if (revieweeId) {
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
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

// POST /api/reviews - Create a new review
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookingId, caregiverId, parentId, rating, comment } = body;
    
    if (!bookingId || !caregiverId || !parentId || !rating) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
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
      return NextResponse.json(
        { error: 'Unauthorized to review this booking' },
        { status: 403 }
      );
    }
    
    // Check if review already exists for this booking
    const existingReview = await db.review.findFirst({
      where: {
        bookingId,
        parentId,
        caregiverId
      }
    });
    
    if (existingReview) {
      return NextResponse.json(
        { error: 'Review already exists for this booking' },
        { status: 400 }
      );
    }
    
    // Create the review
    const review = await db.review.create({
      data: {
        bookingId,
        caregiverId,
        parentId,
        rating,
        comment: comment || '',
        isApproved: false // Reviews need admin approval
      },
      include: {
        parent: {
          include: { profile: true }
        },
        caregiver: {
          include: {
            user: {
              include: { profile: true }
            }
          }
        }
      }
    });
    
    // Update caregiver's average rating (only approved reviews)
    const approvedReviews = await db.review.findMany({
      where: {
        caregiverId,
        isApproved: true
      }
    });
    
    if (approvedReviews.length > 0) {
      const avgRating = approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length;
      
      await db.caregiver.update({
        where: { id: caregiverId },
        data: { 
          averageRating: avgRating,
          totalReviews: approvedReviews.length
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
        createdAt: review.createdAt.toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error creating review:', error);
    return NextResponse.json(
      { error: 'Failed to create review' },
      { status: 500 }
    );
  }
}