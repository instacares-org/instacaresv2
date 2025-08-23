import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthFromRequest } from '@/lib/jwt';
import { prisma } from '@/lib/database';
import { logger, getClientInfo } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const clientInfo = getClientInfo(request);
  
  try {
    // Verify authentication
    const authResult = await verifyAuthFromRequest(request);
    
    if (!authResult.isAuthenticated) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { user } = authResult;
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid authentication data' },
        { status: 401 }
      );
    }
    
    // Fetch fresh user data from database
    const currentUser = await prisma.user.findUnique({
      where: { id: user.userId },
      include: {
        profile: true,
        caregiver: user.userType === 'CAREGIVER' ? {
          select: {
            id: true,
            hourlyRate: true,
            averageRating: true,
            isAvailable: true,
            bio: true,
            experienceYears: true,
            stripeAccountId: true,
          }
        } : false,
      }
    });
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Check if account status changed
    if (currentUser.approvalStatus !== user.approvalStatus) {
      return NextResponse.json(
        { 
          error: 'Account status changed. Please login again.',
          statusChanged: true,
          newStatus: currentUser.approvalStatus
        },
        { status: 401 }
      );
    }
    
    // Prepare response data
    const userData = {
      id: currentUser.id,
      email: currentUser.email,
      userType: currentUser.userType,
      approvalStatus: currentUser.approvalStatus,
      isActive: currentUser.isActive,
      emailVerified: currentUser.emailVerified,
      lastLogin: currentUser.lastLogin,
      createdAt: currentUser.createdAt,
      profile: currentUser.profile ? {
        firstName: currentUser.profile.firstName,
        lastName: currentUser.profile.lastName,
        phone: currentUser.profile.phone,
        avatar: currentUser.profile.avatar,
        dateOfBirth: currentUser.profile.dateOfBirth,
        streetAddress: currentUser.profile.streetAddress,
        city: currentUser.profile.city,
        province: currentUser.profile.state, // Map state to province for Canadian terminology
        postalCode: currentUser.profile.zipCode, // Map zipCode to postalCode for Canadian terminology
        country: currentUser.profile.country,
        emergencyName: currentUser.profile.emergencyName,
        emergencyPhone: currentUser.profile.emergencyPhone,
        emergencyRelation: currentUser.profile.emergencyRelation,
      } : null,
      caregiver: currentUser.caregiver || null,
    };
    
    return NextResponse.json({
      success: true,
      user: userData
    });
    
  } catch (error: any) {
    logger.error('Me endpoint error', error, {
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
    });
    
    return NextResponse.json(
      { error: 'Failed to fetch user data' },
      { status: 500 }
    );
  }
}