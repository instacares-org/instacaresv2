import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/caregiver/[caregiverId]/photos - Get public daycare photos for a caregiver
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caregiverId: string }> }
) {
  try {
    console.log('📸 Photos API called');
    const { caregiverId } = await params;
    console.log('📸 Caregiver ID:', caregiverId);

    if (!caregiverId) {
      return NextResponse.json(
        { error: 'Caregiver ID is required' },
        { status: 400 }
      );
    }

    // Verify caregiver exists and is verified
    const caregiver = await db.caregiver.findUnique({
      where: { 
        id: caregiverId,
        isVerified: true,
        user: {
          isActive: true,
          approvalStatus: 'APPROVED'
        }
      },
      include: {
        user: {
          include: {
            profile: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    if (!caregiver) {
      return NextResponse.json(
        { error: 'Caregiver not found or not verified' },
        { status: 404 }
      );
    }

    console.log('📸 Caregiver found:', caregiver?.id);

    // Fetch public daycare photos
    const photos = await db.caregiverPhoto.findMany({
      where: { 
        caregiverId: caregiverId,
        // Only return photos that have been uploaded (non-empty url)
        url: {
          not: ''
        }
      },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        url: true,
        caption: true,
        isProfile: true,
        createdAt: true
      }
    });

    console.log(`📸 Found ${photos.length} photos for caregiver ${caregiverId}`);

    return NextResponse.json({
      success: true,
      caregiver: {
        name: `${caregiver.user.profile?.firstName} ${caregiver.user.profile?.lastName}`,
        photos: photos
      },
      total: photos.length
    });

  } catch (error) {
    console.error('Error fetching caregiver photos:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch photos',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}