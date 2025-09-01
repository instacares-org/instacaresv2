import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/caregiver-reviews?caregiverId=xxx - Get all reviews for a caregiver
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const caregiverId = searchParams.get('caregiverId');

    if (!caregiverId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Caregiver ID is required',
        },
        { status: 400 }
      );
    }

    console.log(`🔍 Fetching reviews for caregiver: ${caregiverId}`);

    // Fetch reviews from database
    const reviews = await db.review.findMany({
      where: {
        revieweeId: caregiverId, // revieweeId is the caregiver being reviewed
        isApproved: true, // Only show approved reviews
      },
      include: {
        reviewer: {
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
        booking: {
          select: {
            startTime: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📊 Found ${reviews.length} reviews for caregiver ${caregiverId}`);

    // Transform the data for frontend
    const formattedReviews = reviews.map(review => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      reviewerName: review.reviewer?.profile 
        ? `${review.reviewer.profile.firstName} ${review.reviewer.profile.lastName}`.trim()
        : 'Anonymous',
      reviewerAvatar: review.reviewer?.profile?.avatar,
      createdAt: review.createdAt.toISOString(),
      bookingDate: review.booking?.startTime?.toISOString(),
      serviceType: 'Childcare', // Default service type
    }));

    return NextResponse.json({
      success: true,
      data: formattedReviews,
      total: formattedReviews.length,
    });

  } catch (error) {
    console.error('Error fetching reviews:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch reviews',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}