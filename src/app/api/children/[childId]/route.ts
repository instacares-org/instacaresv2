import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { db } from '@/lib/db';

// DELETE /api/children/[childId] - Delete a specific child profile
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify user is a parent
    if (session.user.userType !== 'PARENT') {
      return NextResponse.json(
        { error: 'Only parents can delete child profiles' },
        { status: 403 }
      );
    }

    const { childId } = await params;

    // Verify child exists and belongs to the authenticated parent
    const child = await db.child.findFirst({
      where: {
        id: childId,
        parentId: session.user.id
      }
    });

    if (!child) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Child profile not found or access denied' 
        },
        { status: 404 }
      );
    }

    // Check if child has any active bookings or check-ins
    const activeBookings = await db.booking.count({
      where: {
        parentId: session.user.id,
        status: {
          in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS']
        }
      }
    });

    const activeCheckIns = await db.checkInOut.count({
      where: {
        childId: childId,
        status: {
          in: ['PENDING', 'CHECKED_IN']
        }
      }
    });

    if (activeBookings > 0 || activeCheckIns > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cannot delete child profile with active bookings or check-ins. Please complete or cancel them first.' 
        },
        { status: 400 }
      );
    }

    // Delete the child profile
    await db.child.delete({
      where: { id: childId }
    });

    return NextResponse.json({
      success: true,
      message: 'Child profile deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting child profile:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete child profile' 
      },
      { status: 500 }
    );
  }
}

// PUT /api/children/[childId] - Update a specific child profile
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify user is a parent
    if (session.user.userType !== 'PARENT') {
      return NextResponse.json(
        { error: 'Only parents can update child profiles' },
        { status: 403 }
      );
    }

    const { childId } = await params;
    const body = await request.json();

    // Verify child exists and belongs to the authenticated parent
    const existingChild = await db.child.findFirst({
      where: {
        id: childId,
        parentId: session.user.id
      }
    });

    if (!existingChild) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Child profile not found or access denied' 
        },
        { status: 404 }
      );
    }

    const {
      firstName,
      lastName,
      dateOfBirth,
      gender,
      allergies,
      medications,
      medicalConditions,
      emergencyMedicalInfo,
      bloodType,
      emergencyContacts,
      dietaryRestrictions,
      specialInstructions,
      pickupInstructions,
      photoUrl
    } = body;

    // Update child profile
    const updatedChild = await db.child.update({
      where: { id: childId },
      data: {
        firstName: firstName || existingChild.firstName,
        lastName: lastName || existingChild.lastName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : existingChild.dateOfBirth,
        gender: gender !== undefined ? gender : existingChild.gender,
        allergies: allergies !== undefined ? allergies : existingChild.allergies,
        medications: medications !== undefined ? medications : existingChild.medications,
        medicalConditions: medicalConditions !== undefined ? medicalConditions : existingChild.medicalConditions,
        emergencyMedicalInfo: emergencyMedicalInfo !== undefined ? emergencyMedicalInfo : existingChild.emergencyMedicalInfo,
        bloodType: bloodType !== undefined ? bloodType : existingChild.bloodType,
        emergencyContacts: emergencyContacts !== undefined ? emergencyContacts : existingChild.emergencyContacts,
        dietaryRestrictions: dietaryRestrictions !== undefined ? dietaryRestrictions : existingChild.dietaryRestrictions,
        specialInstructions: specialInstructions !== undefined ? specialInstructions : existingChild.specialInstructions,
        pickupInstructions: pickupInstructions !== undefined ? pickupInstructions : existingChild.pickupInstructions,
        photoUrl: photoUrl !== undefined ? photoUrl : existingChild.photoUrl,
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedChild,
      message: 'Child profile updated successfully'
    });

  } catch (error) {
    console.error('Error updating child profile:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update child profile' 
      },
      { status: 500 }
    );
  }
}

// GET /api/children/[childId] - Get a specific child profile
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify user is a parent
    if (session.user.userType !== 'PARENT') {
      return NextResponse.json(
        { error: 'Only parents can access child profiles' },
        { status: 403 }
      );
    }

    const { childId } = await params;

    // Get child profile
    const child = await db.child.findFirst({
      where: {
        id: childId,
        parentId: session.user.id
      }
    });

    if (!child) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Child profile not found or access denied' 
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: child
    });

  } catch (error) {
    console.error('Error fetching child profile:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch child profile' 
      },
      { status: 500 }
    );
  }
}