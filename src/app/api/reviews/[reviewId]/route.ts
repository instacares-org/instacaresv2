import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth-middleware';

// PATCH /api/reviews/[reviewId] - Update review (admin only for moderation)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const { reviewId } = await params;
    const body = await request.json();
    const { isApproved, moderatorNotes } = body;
    
    // Verify admin authentication using withAuth middleware
    const authResult = await withAuth(request, 'ADMIN', false);
    if (!authResult.isAuthorized) {
      console.error('Review PATCH - Auth failed:', { reviewId });
      return authResult.response;
    }
    
    const adminUser = authResult.user!;
    console.log('Review PATCH - Admin authenticated:', {
      userId: adminUser.id,
      email: adminUser.email,
      reviewId
    });
    
    // Find the review (reviewee is the User, not caregiver directly)
    const review = await db.review.findUnique({
      where: { id: reviewId },
      include: { 
        reviewee: {
          include: {
            caregiver: true
          }
        }
      }
    });
    
    if (!review) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }
    
    // Update the review
    const updatedReview = await db.review.update({
      where: { id: reviewId },
      data: {
        isApproved: isApproved !== undefined ? isApproved : review.isApproved,
        moderatorNotes: moderatorNotes || review.moderatorNotes,
        moderatedAt: new Date()
        // Note: moderatedBy field doesn't exist in schema
      }
    });
    
    console.log('Review updated:', { 
      reviewId, 
      isApproved, 
      moderatedBy: adminUser.id 
    });
    
    // Recalculate caregiver's average rating if approval status changed
    if (isApproved !== undefined && isApproved !== review.isApproved && review.reviewee?.caregiver) {
      const caregiverId = review.reviewee.caregiver.id;
      
      const approvedReviews = await db.review.findMany({
        where: {
          revieweeId: review.revieweeId,
          isApproved: true
        }
      });
      
      const avgRating = approvedReviews.length > 0
        ? approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length
        : 0;
      
      await db.caregiver.update({
        where: { id: caregiverId },
        data: {
          averageRating: avgRating,
          // totalReviews field does not exist in schema
        }
      });
      
      console.log('Caregiver rating recalculated:', { 
        caregiverId, 
        avgRating, 
        // totalReviews field does not exist in schema 
      });
    }
    
    return NextResponse.json({
      success: true,
      review: updatedReview
    });
    
  } catch (error) {
    console.error('Error updating review:', error);
    return NextResponse.json(
      { error: 'Failed to update review', details: error instanceof Error ? error.message : 'Unknown error' },
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
    const { reviewId } = await params;
    
    // Verify admin authentication using withAuth middleware
    const authResult = await withAuth(request, 'ADMIN', false);
    if (!authResult.isAuthorized) {
      console.error('Review DELETE - Auth failed:', { reviewId });
      return authResult.response;
    }
    
    const adminUser = authResult.user!;
    console.log('Review DELETE - Admin authenticated:', {
      userId: adminUser.id,
      email: adminUser.email,
      reviewId
    });
    
    // Find the review
    const review = await db.review.findUnique({
      where: { id: reviewId },
      include: { 
        reviewee: {
          include: {
            caregiver: true
          }
        }
      }
    });
    
    if (!review) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }
    
    const caregiverId = review.reviewee?.caregiver?.id;
    
    // Delete the review
    await db.review.delete({
      where: { id: reviewId }
    });
    
    console.log('Review deleted:', { reviewId, deletedBy: adminUser.id });
    
    // Recalculate caregiver's average rating if they exist
    if (caregiverId) {
      const approvedReviews = await db.review.findMany({
        where: {
          revieweeId: review.revieweeId,
          isApproved: true
        }
      });
      
      const avgRating = approvedReviews.length > 0
        ? approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length
        : 0;
      
      await db.caregiver.update({
        where: { id: caregiverId },
        data: {
          averageRating: avgRating,
          // totalReviews field does not exist in schema
        }
      });
      
      console.log('Caregiver rating recalculated after delete:', { 
        caregiverId, 
        avgRating, 
        // totalReviews field does not exist in schema 
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Review deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting review:', error);
    return NextResponse.json(
      { error: 'Failed to delete review', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
