import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenFromRequest } from '@/lib/jwt';
import { db } from '@/lib/db';

// GET /api/children - Fetch children for authenticated parent
export async function GET(request: NextRequest) {
  try {
    const tokenResult = verifyTokenFromRequest(request);
    if (!tokenResult.isValid || !tokenResult.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify user is a parent
    if (tokenResult.user.userType !== 'PARENT') {
      return NextResponse.json(
        { error: 'Only parents can access child profiles' },
        { status: 403 }
      );
    }

    const children = await db.child.findMany({
      where: { parentId: tokenResult.user.userId },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      data: children
    });

  } catch (error) {
    console.error('Error fetching children:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch children profiles' 
      },
      { status: 500 }
    );
  }
}

// POST /api/children - Create new child profile
export async function POST(request: NextRequest) {
  try {
    const tokenResult = verifyTokenFromRequest(request);
    if (!tokenResult.isValid || !tokenResult.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify user is a parent
    if (tokenResult.user.userType !== 'PARENT') {
      return NextResponse.json(
        { error: 'Only parents can create child profiles' },
        { status: 403 }
      );
    }

    const body = await request.json();
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

    // Validate required fields
    if (!firstName || !lastName || !dateOfBirth) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'First name, last name, and date of birth are required' 
        },
        { status: 400 }
      );
    }

    const child = await db.child.create({
      data: {
        parentId: tokenResult.user.userId,
        firstName,
        lastName,
        dateOfBirth: new Date(dateOfBirth),
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
      }
    });

    return NextResponse.json({
      success: true,
      data: child,
      message: 'Child profile created successfully'
    });

  } catch (error) {
    console.error('Error creating child profile:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create child profile' 
      },
      { status: 500 }
    );
  }
}