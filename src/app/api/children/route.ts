import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { db } from '@/lib/db';

// Force dynamic rendering - don't cache this route
export const dynamic = 'force-dynamic';

// GET /api/children - Fetch children for authenticated parent
export async function GET(request: NextRequest) {
  try {
    const authResult = await withAuth(request, 'PARENT');
    if (!authResult.isAuthorized || !authResult.user) {
      return authResult.response;
    }

    const children = await db.child.findMany({
      where: { parentId: authResult.user.id },
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
  // Force log to stderr which PM2 captures
  process.stderr.write(`[POST /api/children] Request received at ${new Date().toISOString()}\n`);
  console.log('[POST /api/children] Request received');
  try {
    process.stderr.write('[POST /api/children] Calling withAuth...\n');
    console.log('[POST /api/children] Calling withAuth...');
    const authResult = await withAuth(request, 'PARENT');
    process.stderr.write(`[POST /api/children] withAuth result: ${JSON.stringify({ isAuthorized: authResult.isAuthorized })}\n`);
    console.log('[POST /api/children] withAuth result:', { isAuthorized: authResult.isAuthorized });
    if (!authResult.isAuthorized || !authResult.user) {
      return authResult.response;
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
        parentId: authResult.user.id,
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