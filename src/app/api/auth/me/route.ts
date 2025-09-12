import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthFromRequest } from '@/lib/jwt';
import { prisma } from '@/lib/database';
import { logger, getClientInfo } from '@/lib/logger';
import { getServerSession } from 'next-auth';
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';

// Inline authOptions to avoid circular imports
const authOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  session: {
    strategy: "jwt" as const,
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export async function GET(request: NextRequest) {
  const clientInfo = getClientInfo(request);
  
  try {
    // First, try to get NextAuth session (for Google OAuth users)
    const session = await getServerSession(authOptions);
    
    if (session?.user?.email) {
      // User is authenticated via NextAuth (Google OAuth)
      const currentUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: {
          profile: true,
          caregiver: {
            select: {
              id: true,
              hourlyRate: true,
              averageRating: true,
              isAvailable: true,
              bio: true,
              experienceYears: true,
              stripeAccountId: true,
            }
          },
        }
      });
      
      if (currentUser) {
        // Return user data for OAuth users
        return NextResponse.json({
          success: true,
          user: {
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
              province: currentUser.profile.state,
              postalCode: currentUser.profile.zipCode,
              country: currentUser.profile.country,
              emergencyName: currentUser.profile.emergencyName,
              emergencyPhone: currentUser.profile.emergencyPhone,
              emergencyRelation: currentUser.profile.emergencyRelation,
            } : null,
            caregiver: currentUser.caregiver || null,
          }
        });
      }
    }
    
    // If no NextAuth session, try JWT authentication
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