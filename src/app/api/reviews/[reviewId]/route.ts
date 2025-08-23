import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';



// GET /api/reviews/[reviewId] - Get specific review
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const { reviewId } = await params;

    const review = await db.review.findUnique({
      where: { id: reviewId },
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
      }
    });

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    const formattedReview = {
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      isApproved: review.isApproved,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      moderatedAt: review.moderatedAt,
      moderatorNotes: review.moderatorNotes,
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
    };

    return NextResponse.json({
      success: true,
      review: formattedReview
    });

  } catch (error) {
    console.error('Error fetching review:', error);
    return NextResponse.json(
      { error: 'Failed to fetch review' },
      { status: 500 }
    );
  }
}

// PATCH /api/reviews/[reviewId] - Update review (edit within time limit)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token');

    console.log('🔍 Review Auth Debug:', {
      hasToken: !!token,
      tokenValue: token?.value ? 'present' : 'missing',
      allCookies: cookieStore.getAll().map(cookie => cookie.name)
    });

    if (!token) {
      console.log('❌ No auth token found in cookies');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token.value, process.env.JWT_SECRET!) as { userId: string };
    console.log('✅ JWT decoded successfully:', { userId: decoded.userId });
    
    const { reviewId } = await params;
    const body = await request.json();

    // Get existing review
    const existingReview = await db.review.findUnique({
      where: { id: reviewId },
      include: {
        reviewer: { include: { profile: true } },
        reviewee: { include: { profile: true } }
      }
    });

    if (!existingReview) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    // Check if user is the reviewer OR an admin
    const user = await db.user.findUnique({
      where: { id: decoded.userId }
    });
    
    const isReviewer = existingReview.reviewerId === decoded.userId;
    const isAdmin = user?.userType === 'ADMIN';
    
    console.log('🔍 User Permission Check:', {
      userId: decoded.userId,
      reviewerId: existingReview.reviewerId,
      userType: user?.userType,
      isReviewer,
      isAdmin,
      hasModeration: body.isApproved !== undefined || body.moderatorNotes !== undefined
    });
    
    if (!isReviewer && !isAdmin) {
      console.log('❌ Access denied - not reviewer and not admin');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if review is within edit window (24 hours) - only for non-admin users
    if (isReviewer && !isAdmin) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (existingReview.createdAt < twentyFourHoursAgo) {
        return NextResponse.json({ 
          error: 'Reviews can only be edited within 24 hours of creation' 
        }, { status: 403 });
      }
    }

    // Validate update data
    const updateData: any = {};
    
    if (body.rating !== undefined) {
      if (body.rating < 1 || body.rating > 5) {
        return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
      }
      updateData.rating = body.rating;
    }

    if (body.comment !== undefined) {
      if (body.comment.trim().length < 10 || body.comment.trim().length > 1000) {
        return NextResponse.json({ 
          error: 'Comment must be between 10 and 1000 characters' 
        }, { status: 400 });
      }
      updateData.comment = body.comment.trim();
    }

    // If this is an admin moderating the review
    if (body.isApproved !== undefined || body.moderatorNotes !== undefined) {
      // Admin status already verified above
      if (!isAdmin) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }

      if (body.isApproved !== undefined) {
        updateData.isApproved = body.isApproved;
        updateData.moderatedAt = new Date();
      }

      if (body.moderatorNotes !== undefined) {
        updateData.moderatorNotes = body.moderatorNotes;
      }
    }

    // Update review
    const updatedReview = await db.review.update({
      where: { id: reviewId },
      data: updateData,
      include: {
        reviewer: { include: { profile: true } },
        reviewee: { include: { profile: true } },
        booking: true
      }
    });

    // If rating changed and this is an approved caregiver review, update average
    if (updateData.rating && existingReview.isApproved) {
      // Check if reviewee is a caregiver
      const caregiver = await db.caregiver.findUnique({
        where: { userId: existingReview.revieweeId }
      });
      
      if (caregiver) {
        await updateCaregiverRating(existingReview.revieweeId);
      }
    }

    // If review was just approved, update caregiver rating and send notification
    if (body.isApproved === true && !existingReview.isApproved) {
      // Check if reviewee is a caregiver
      const caregiver = await db.caregiver.findUnique({
        where: { userId: existingReview.revieweeId }
      });
      
      if (caregiver) {
        await updateCaregiverRating(existingReview.revieweeId);
      }

      // Send approval notification to reviewee
      await db.notification.create({
        data: {
          userId: existingReview.revieweeId,
          type: 'review_approved',
          title: 'Review Approved',
          message: `Your review from ${existingReview.reviewer.profile?.firstName} ${existingReview.reviewer.profile?.lastName} has been approved and is now visible`,
          resourceType: 'review',
          resourceId: reviewId
        }
      });
    }

    return NextResponse.json({
      success: true,
      review: {
        id: updatedReview.id,
        rating: updatedReview.rating,
        comment: updatedReview.comment,
        isApproved: updatedReview.isApproved,
        createdAt: updatedReview.createdAt,
        updatedAt: updatedReview.updatedAt,
        moderatedAt: updatedReview.moderatedAt,
        moderatorNotes: updatedReview.moderatorNotes
      }
    });

  } catch (error) {
    console.error('Error updating review:', error);
    return NextResponse.json(
      { error: 'Failed to update review' },
      { status: 500 }
    );
  }
}

// DELETE /api/reviews/[reviewId] - Delete review (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token.value, process.env.JWT_SECRET!) as { userId: string };
    const { reviewId } = await params;

    // Verify admin status
    const user = await db.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user || user.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get review before deletion for rating recalculation
    const review = await db.review.findUnique({
      where: { id: reviewId }
    });

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    // Delete review
    await db.review.delete({
      where: { id: reviewId }
    });

    // Recalculate caregiver rating if this was an approved review
    if (review.isApproved) {
      const caregiver = await db.caregiver.findUnique({
        where: { userId: review.revieweeId }
      });
      
      if (caregiver) {
        await updateCaregiverRating(review.revieweeId);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Review deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting review:', error);
    return NextResponse.json(
      { error: 'Failed to delete review' },
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
    } else {
      // No reviews, reset to null
      await db.caregiver.update({
        where: { userId: caregiverId },
        data: { averageRating: null }
      });
    }
  } catch (error) {
    console.error('Error updating caregiver rating:', error);
  }
}