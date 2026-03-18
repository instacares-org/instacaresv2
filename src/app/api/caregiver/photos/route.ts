import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/options';
import { prisma } from '@/lib/db';
import { validatePhotoUrl, createFileUploadError } from '@/lib/file-upload-validation';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const addPhotoSchema = z.object({
  url: z.string().min(1, 'Photo URL is required').url('Must be a valid URL'),
  caption: z.string().max(500, 'Caption must be 500 characters or less').optional().default(''),
  isProfile: z.boolean().optional().default(false),
});

export async function GET(request: NextRequest) {
  let session: any = null;
  try {
    session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    // Get caregiver ID from user
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: session.user.id },
    });

    if (!caregiver) {
      // Return empty array if caregiver profile doesn't exist yet
      return apiSuccess({ photos: [] });
    }

    // Fetch caregiver photos
    const photos = await prisma.caregiverPhoto.findMany({
      where: { caregiverId: caregiver.id },
      orderBy: { sortOrder: 'asc' },
    });

    return apiSuccess({ photos });
  } catch (error) {
    logger.error('Error fetching caregiver photos', error, {
      userId: session?.user?.id,
    });
    return ApiErrors.internal();
  }
}

export async function POST(request: NextRequest) {
  let session: any = null;
  try {
    session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    // Get caregiver ID from user
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: session.user.id },
    });

    if (!caregiver) {
      return ApiErrors.notFound('Caregiver profile not found');
    }

    const body = await request.json();
    const parsed = addPhotoSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid input', parsed.error.flatten().fieldErrors);
    }
    const { url, caption, isProfile } = parsed.data;

    // Validate photo URL to prevent SSRF attacks
    const urlValidation = validatePhotoUrl(url);
    if (!urlValidation.valid) {
      logger.warn('Invalid photo URL attempt', {
        userId: session.user.id,
        email: session.user.email,
        url: url,
        error: urlValidation.error,
      });
      return createFileUploadError(urlValidation.error || 'Invalid photo URL');
    }

    // Get current photo count for sort order
    const photoCount = await prisma.caregiverPhoto.count({
      where: { caregiverId: caregiver.id },
    });

    // Limit maximum number of photos
    if (photoCount >= 10) {
      return createFileUploadError('Maximum of 10 photos allowed');
    }

    // If this is a profile photo, unset existing profile photos
    if (isProfile) {
      await prisma.caregiverPhoto.updateMany({
        where: {
          caregiverId: caregiver.id,
          isProfile: true,
        },
        data: { isProfile: false },
      });
    }

    // Create new photo
    const photo = await prisma.caregiverPhoto.create({
      data: {
        caregiverId: caregiver.id,
        url,
        caption: caption || '',
        isProfile,
        sortOrder: photoCount,
      },
    });

    logger.info('Caregiver photo added', {
      userId: session.user.id,
      caregiverId: caregiver.id,
      photoId: photo.id,
      isProfile,
    });

    return apiSuccess({ photo });
  } catch (error) {
    logger.error('Error creating caregiver photo', error, {
      userId: session?.user?.id,
    });
    return ApiErrors.internal();
  }
}

export async function DELETE(request: NextRequest) {
  let session: any = null;
  try {
    session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    // Get caregiver ID from user
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: session.user.id },
    });

    if (!caregiver) {
      return ApiErrors.notFound('Caregiver profile not found');
    }

    const { searchParams } = new URL(request.url);
    const photoId = searchParams.get('id');

    if (!photoId) {
      return createFileUploadError('Photo ID is required');
    }

    // Verify photo belongs to this caregiver
    const photo = await prisma.caregiverPhoto.findFirst({
      where: {
        id: photoId,
        caregiverId: caregiver.id,
      },
    });

    if (!photo) {
      return ApiErrors.notFound('Photo not found');
    }

    // Delete the photo
    await prisma.caregiverPhoto.delete({
      where: { id: photoId },
    });

    logger.info('Caregiver photo deleted', {
      userId: session.user.id,
      caregiverId: caregiver.id,
      photoId: photoId,
    });

    return apiSuccess();
  } catch (error) {
    logger.error('Error deleting caregiver photo', error, {
      userId: session?.user?.id,
    });
    return ApiErrors.internal();
  }
}
