import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

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
      return ApiErrors.badRequest('Caregiver ID is required');
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
      return ApiErrors.notFound('Caregiver not found or not verified');
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

    return apiSuccess({
      caregiver: {
        name: `${caregiver.user.profile?.firstName} ${caregiver.user.profile?.lastName}`,
        photos: photos
      },
      total: photos.length
    });

  } catch (error) {
    console.error('Error fetching caregiver photos:', error);
    return ApiErrors.internal('Failed to fetch photos');
  }
}