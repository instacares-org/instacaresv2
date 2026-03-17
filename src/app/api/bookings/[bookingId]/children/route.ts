import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { db as prisma } from '@/lib/db';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// GET /api/bookings/[bookingId]/children - Get children for a specific booking
// Caregivers can view children info for bookings they are assigned to
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params;

    // Verify authentication - allow both caregivers and parents
    const authResult = await withAuth(request, 'ANY');
    if (!authResult.isAuthorized) {
      return authResult.response;
    }

    // Get the booking to verify access
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        parentId: true,
        caregiverId: true,
        childrenCount: true,
      }
    });

    if (!booking) {
      return ApiErrors.notFound('Booking not found');
    }

    // Security: Only allow the parent or caregiver of this booking to view children
    const authUser = authResult.user!;
    const isParent = authUser.id === booking.parentId;
    const isCaregiver = authUser.id === booking.caregiverId;
    const isAdmin = authUser.userType === 'ADMIN';

    if (!isParent && !isCaregiver && !isAdmin) {
      return ApiErrors.forbidden('You do not have access to this booking\'s children');
    }

    // Fetch all children for the parent of this booking
    const children = await prisma.child.findMany({
      where: { parentId: booking.parentId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        allergies: true,
        medications: true,
        medicalConditions: true,
        emergencyMedicalInfo: true,
        bloodType: true,
        emergencyContacts: true,
        dietaryRestrictions: true,
        specialInstructions: true,
        pickupInstructions: true,
        photoUrl: true,
      },
      orderBy: { createdAt: 'asc' }
    });

    // Safely coerce Json fields that may be strings into arrays
    const ensureArray = (val: unknown): unknown[] => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        if (!val.trim()) return [];
        try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return [val]; }
      }
      return [];
    };

    // Calculate age and normalize Json fields for each child
    const childrenWithAge = children.map(child => {
      const today = new Date();
      const birthDate = new Date(child.dateOfBirth);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return {
        ...child,
        allergies: ensureArray(child.allergies),
        medications: ensureArray(child.medications),
        medicalConditions: ensureArray(child.medicalConditions),
        dietaryRestrictions: ensureArray(child.dietaryRestrictions),
        emergencyContacts: ensureArray(child.emergencyContacts),
        age,
      };
    });

    return NextResponse.json({
      success: true,
      data: childrenWithAge,
      bookingChildrenCount: booking.childrenCount,
    });

  } catch (error) {
    console.error('Error fetching booking children:', error);
    return ApiErrors.internal('Failed to fetch children');
  }
}
