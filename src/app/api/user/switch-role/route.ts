import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMIT_CONFIGS, createRateLimitHeaders } from '@/lib/rate-limit';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

const switchRoleSchema = z.object({
  role: z.enum(['PARENT', 'CAREGIVER'], {
    message: 'Invalid role. Must be PARENT or CAREGIVER.',
  }),
});

/**
 * POST /api/user/switch-role
 * Switches the active role for a user with dual roles (both parent and caregiver).
 * Only allows switching to a role the user actually has.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await checkRateLimit(request, RATE_LIMIT_CONFIGS.API_WRITE);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    // Verify authentication using NextAuth
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const userId = session.user.id;
    const body = await request.json();
    const parsed = switchRoleSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid input', parsed.error.flatten().fieldErrors);
    }

    const { role } = parsed.data;

    // Get current user to check their roles
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isParent: true,
        isCaregiver: true,
        activeRole: true,
      },
    });

    if (!user) {
      return ApiErrors.notFound('User not found');
    }

    // Check if user has the requested role
    if (role === 'PARENT' && !user.isParent) {
      return ApiErrors.forbidden('You do not have a parent role. Please complete parent registration first.');
    }

    if (role === 'CAREGIVER' && !user.isCaregiver) {
      return ApiErrors.forbidden('You do not have a caregiver role. Please complete caregiver registration first.');
    }

    // Update the active role
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        activeRole: role,
        userType: role, // Also update legacy userType for backward compatibility
      },
      select: {
        id: true,
        email: true,
        isParent: true,
        isCaregiver: true,
        activeRole: true,
        userType: true,
      },
    });

    console.log(`[switch-role] User ${userId} switched to ${role} role`);

    return apiSuccess({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        isParent: updatedUser.isParent,
        isCaregiver: updatedUser.isCaregiver,
        activeRole: updatedUser.activeRole,
      },
    }, `Successfully switched to ${role.toLowerCase()} role`);

  } catch (error) {
    console.error('Error switching role:', error);
    return ApiErrors.internal('Failed to switch role');
  }
}
