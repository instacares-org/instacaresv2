import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    // CRITICAL: Require admin authentication
    const authResult = await withAuth(request, 'ADMIN', true);
    if (!authResult.isAuthorized) {
      return authResult.response;
    }

    const pendingUsers = await db.user.findMany({
      where: {
        approvalStatus: 'PENDING'
      },
      include: {
        profile: true,
        caregiver: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ users: pendingUsers });
  } catch (error) {
    console.error('Error fetching pending users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending users' },
      { status: 500 }
    );
  }
}