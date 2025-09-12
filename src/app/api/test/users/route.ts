import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

// Simple endpoint to check users in database (for testing only)
export async function GET(request: NextRequest) {
  try {
    // Get basic user info (no sensitive data)
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        userType: true,
        approvalStatus: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10 // Limit to 10 users
    });

    return NextResponse.json({
      success: true,
      count: users.length,
      users: users.map(user => ({
        id: user.id.substring(0, 8) + '...',
        email: user.email,
        userType: user.userType,
        approvalStatus: user.approvalStatus,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        name: user.profile ? `${user.profile.firstName} ${user.profile.lastName}` : null,
        createdAt: user.createdAt,
      }))
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}