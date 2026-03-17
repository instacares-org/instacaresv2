import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/adminAuth';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // CRITICAL: Require admin authentication
    const permCheck = await requirePermission(request, 'canManageUsers');
    if (!permCheck.authorized) return permCheck.response!;

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

    return apiSuccess({ users: pendingUsers });
  } catch (error) {
    console.error('Error fetching pending users:', error);
    return ApiErrors.internal('Failed to fetch pending users');
  }
}