import { NextRequest, NextResponse } from 'next/server';

// API endpoint to verify caregiver accounts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;
    
    if (!email) {
      return NextResponse.json({
        error: 'Email is required'
      }, { status: 400 });
    }
    
    const { db } = await import('@/lib/db');
    
    // Find the user by email
    const user = await db.user.findUnique({
      where: { email },
      include: {
        caregiver: true,
        profile: true
      }
    });
    
    if (!user) {
      return NextResponse.json({
        error: 'User not found'
      }, { status: 404 });
    }
    
    if (!user.caregiver) {
      return NextResponse.json({
        error: 'User is not a caregiver'
      }, { status: 400 });
    }
    
    if (user.caregiver.isVerified) {
      return NextResponse.json({
        success: true,
        message: 'Caregiver is already verified',
        caregiver: {
          email: user.email,
          name: `${user.profile?.firstName} ${user.profile?.lastName}`,
          isVerified: user.caregiver.isVerified
        }
      });
    }
    
    // Update caregiver to verified status
    const updatedCaregiver = await db.caregiver.update({
      where: { userId: user.id },
      data: { isVerified: true },
      include: {
        user: {
          include: {
            profile: true
          }
        }
      }
    });
    
    // Clear cache to refresh search results
    const { apiCache } = await import('@/lib/cache');
    apiCache.clear();
    console.log('Cache cleared after caregiver verification');
    
    return NextResponse.json({
      success: true,
      message: 'Caregiver verified successfully',
      caregiver: {
        email: updatedCaregiver.user.email,
        name: `${updatedCaregiver.user.profile?.firstName} ${updatedCaregiver.user.profile?.lastName}`,
        isVerified: updatedCaregiver.isVerified,
        verifiedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Verify caregiver error:', error);
    return NextResponse.json({ 
      error: 'Failed to verify caregiver',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}