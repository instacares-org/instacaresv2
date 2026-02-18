import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/database';

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
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Security: Only allow the parent or caregiver of this booking to view children
    const authUser = authResult.user!;
    const isParent = authUser.id === booking.parentId;
    const isCaregiver = authUser.id === booking.caregiverId;
    const isAdmin = authUser.userType === 'ADMIN';

    if (!isParent && !isCaregiver && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'You do not have access to this booking\'s children' },
        { status: 403 }
      );
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

    // Calculate age for each child
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
    return NextResponse.json(
      { success: false, error: 'Failed to fetch children' },
      { status: 500 }
    );
  }
}
