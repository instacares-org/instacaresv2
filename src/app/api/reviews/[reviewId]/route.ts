import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyTokenFromRequest } from '@/lib/jwt';

// PATCH /api/reviews/[reviewId] - Update review (admin only for moderation)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { reviewId: string } }
) {
  try {
    const { reviewId } = params;
    const body = await request.json();
    const { isApproved, moderatorNotes } = body;
    
    // Verify admin authentication
    const tokenResult = verifyTokenFromRequest(request);
    if (!tokenResult.isValid || !tokenResult.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Check if user is admin
    const adminUser = await db.user.findUnique({
      where: { id: tokenResult.user.userId }
    });
    
    if (!adminUser || adminUser.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }
    
    // Find the review
    const review = await db.review.findUnique({
      where: { id: reviewId },
      include: { caregiver: true }
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
        moderatedAt: new Date(),
        moderatedBy: adminUser.id
      }
    });
    
    // Recalculate caregiver's average rating if approval status changed
    if (isApproved !== undefined && isApproved !== review.isApproved) {
      const approvedReviews = await db.review.findMany({
        where: {
          caregiverId: review.caregiverId,
          isApproved: true
        }
      });
      
      const avgRating = approvedReviews.length > 0
        ? approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length
        : 0;
      
      await db.caregiver.update({
        where: { id: review.caregiverId },
        data: {
          averageRating: avgRating,
          totalReviews: approvedReviews.length
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      review: updatedReview
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
  { params }: { params: { reviewId: string } }
) {
  try {
    const { reviewId } = params;
    
    // Verify admin authentication
    const tokenResult = verifyTokenFromRequest(request);
    if (!tokenResult.isValid || !tokenResult.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Check if user is admin
    const adminUser = await db.user.findUnique({
      where: { id: tokenResult.user.userId }
    });
    
    if (!adminUser || adminUser.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }
    
    // Find the review
    const review = await db.review.findUnique({
      where: { id: reviewId }
    });
    
    if (!review) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }
    
    // Delete the review
    await db.review.delete({
      where: { id: reviewId }
    });
    
    // Recalculate caregiver's average rating
    const approvedReviews = await db.review.findMany({
      where: {
        caregiverId: review.caregiverId,
        isApproved: true
      }
    });
    
    const avgRating = approvedReviews.length > 0
      ? approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length
      : 0;
    
    await db.caregiver.update({
      where: { id: review.caregiverId },
      data: {
        averageRating: avgRating,
        totalReviews: approvedReviews.length
      }
    });
    
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