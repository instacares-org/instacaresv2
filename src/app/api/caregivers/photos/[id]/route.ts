import { NextRequest } from 'next/server';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { getToken } from 'next-auth/jwt';

export const dynamic = 'force-dynamic';

async function authenticateCaregiver(request: NextRequest) {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: process.env.NODE_ENV === 'production',
    });

    if (!token) {
      return null;
    }

    const userId = (token.userId as string) || token.sub;
    if (!userId) {
      return null;
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      include: { caregiver: true }
    });

    if (!user || (!user.isCaregiver && user.userType !== 'CAREGIVER')) {
      return null;
    }

    return user.caregiver || null;
  } catch {
    return null;
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caregiver = await authenticateCaregiver(request);
    if (!caregiver) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    const formData = await request.formData();
    const caption = formData.get('caption') as string;
    const isProfile = formData.get('isProfile') === 'true';

    // Verify photo belongs to caregiver
    const photo = await db.caregiverPhoto.findFirst({
      where: {
        id,
        caregiverId: caregiver.id
      }
    });

    if (!photo) {
      return ApiErrors.notFound('Photo not found');
    }

    // If setting as profile photo, unset other profile photos
    if (isProfile) {
      await db.caregiverPhoto.updateMany({
        where: {
          caregiverId: caregiver.id,
          isProfile: true,
          id: { not: id }
        },
        data: { isProfile: false }
      });
    }

    // Update the photo
    const updatedPhoto = await db.caregiverPhoto.update({
      where: { id },
      data: {
        ...(caption !== undefined && { caption }),
        ...(isProfile !== undefined && { isProfile })
      }
    });

    return apiSuccess({ photo: updatedPhoto });

  } catch (error) {
    console.error('Photo update error:', error);
    return ApiErrors.internal('Failed to update photo');
  }
}
