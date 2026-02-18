import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/options';
import { prisma } from '@/lib/database';
import { validatePhotoUrl, createFileUploadError } from '@/lib/file-upload-validation';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  let session: any = null;
  try {
    session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get caregiver ID from user
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: session.user.id },
    });

    if (!caregiver) {
      // Return empty array if caregiver profile doesn't exist yet
      return NextResponse.json({ photos: [] });
    }

    // Fetch caregiver photos
    const photos = await prisma.caregiverPhoto.findMany({
      where: { caregiverId: caregiver.id },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ photos });
  } catch (error) {
    logger.error('Error fetching caregiver photos', error, {
      userId: session?.user?.id,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let session: any = null;
  try {
    session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get caregiver ID from user
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: session.user.id },
    });

    if (!caregiver) {
      return NextResponse.json(
        { error: 'Caregiver profile not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { url, caption, isProfile = false } = body;

    if (!url) {
      return createFileUploadError('Photo URL is required');
    }

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

    return NextResponse.json({ photo });
  } catch (error) {
    logger.error('Error creating caregiver photo', error, {
      userId: session?.user?.id,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  let session: any = null;
  try {
    session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get caregiver ID from user
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: session.user.id },
    });

    if (!caregiver) {
      return NextResponse.json(
        { error: 'Caregiver profile not found' },
        { status: 404 }
      );
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
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
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

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting caregiver photo', error, {
      userId: session?.user?.id,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
