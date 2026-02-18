import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

/**
 * POST /api/user/switch-role
 * Switches the active role for a user with dual roles (both parent and caregiver).
 * Only allows switching to a role the user actually has.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication using NextAuth
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { role } = body;

    // Validate the requested role
    if (!role || !['PARENT', 'CAREGIVER'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be PARENT or CAREGIVER.' },
        { status: 400 }
      );
    }

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
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has the requested role
    if (role === 'PARENT' && !user.isParent) {
      return NextResponse.json(
        { error: 'You do not have a parent role. Please complete parent registration first.' },
        { status: 403 }
      );
    }

    if (role === 'CAREGIVER' && !user.isCaregiver) {
      return NextResponse.json(
        { error: 'You do not have a caregiver role. Please complete caregiver registration first.' },
        { status: 403 }
      );
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

    return NextResponse.json({
      success: true,
      message: `Successfully switched to ${role.toLowerCase()} role`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        isParent: updatedUser.isParent,
        isCaregiver: updatedUser.isCaregiver,
        activeRole: updatedUser.activeRole,
      },
    });

  } catch (error) {
    console.error('Error switching role:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
