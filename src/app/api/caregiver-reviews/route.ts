import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';
import { db } from '@/lib/db';

// GET /api/caregiver-reviews?caregiverId=xxx - Get all reviews for a caregiver
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const caregiverId = searchParams.get('caregiverId');

    if (!caregiverId) {
      return ApiErrors.badRequest('Caregiver ID is required');
    }

    console.log(`🔍 Fetching reviews for caregiver: ${caregiverId}`);

    // First, try to find the caregiver record to get the user ID
    let userId = caregiverId;
    
    // Check if caregiverId is a caregiver record ID (starts with 'cm')
    if (caregiverId.startsWith('cm')) {
      const caregiverRecord = await db.caregiver.findUnique({
        where: { id: caregiverId },
        select: { userId: true }
      });
      
      if (caregiverRecord) {
        userId = caregiverRecord.userId;
        console.log(`🔄 Converted caregiver ID ${caregiverId} to user ID ${userId}`);
      }
    }

    // Fetch reviews from database using the user ID
    const reviews = await db.review.findMany({
      where: {
        revieweeId: userId, // revieweeId is the user ID of the caregiver being reviewed
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

    return apiSuccess({
      reviews: formattedReviews,
      total: formattedReviews.length,
    });

  } catch (error) {
    console.error('Error fetching reviews:', error);
    return ApiErrors.internal('Failed to fetch reviews');
  }
}