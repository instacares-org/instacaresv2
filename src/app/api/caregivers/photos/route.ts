import { NextRequest } from 'next/server';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';
import { db } from '@/lib/db';
import sharp from 'sharp';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
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
  } catch (error) {
    console.error('[Photos API] Auth error:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const caregiver = await authenticateCaregiver(request);
    if (!caregiver) {
      return ApiErrors.unauthorized();
    }

    const formData = await request.formData();
    const file = formData.get('photo') as File;
    const caption = formData.get('caption') as string;
    const isProfile = formData.get('isProfile') === 'true';

    if (!file) {
      return ApiErrors.badRequest('No file provided');
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return ApiErrors.badRequest('File must be an image');
    }

    // Validate file size (max 50MB - modern phone photos can be very large)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return ApiErrors.badRequest('File size must be less than 50MB');
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'daycare-photos');
    try {
      await mkdir(uploadsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Generate unique filename (always .jpg since Sharp converts to JPEG)
    const timestamp = Date.now();
    const filename = `daycare-${caregiver.id}-${timestamp}.jpg`;
    const filepath = join(uploadsDir, filename);

    // Process and optimize image with Sharp
    const buffer = Buffer.from(await file.arrayBuffer());
    
    const optimizedImageBuffer = await sharp(buffer)
      .resize(1200, 800, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .jpeg({ 
        quality: 85, 
        progressive: true 
      })
      .toBuffer();

    // Save optimized image
    await writeFile(filepath, optimizedImageBuffer);

    // If this is set as profile photo, unset other profile photos
    if (isProfile) {
      await db.caregiverPhoto.updateMany({
        where: { 
          caregiverId: caregiver.id,
          isProfile: true 
        },
        data: { isProfile: false }
      });
    }

    // Get the highest sort order for this caregiver
    const maxSortOrder = await db.caregiverPhoto.findFirst({
      where: { caregiverId: caregiver.id },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true }
    });

    // Save to database
    const photo = await db.caregiverPhoto.create({
      data: {
        caregiverId: caregiver.id,
        url: `/uploads/daycare-photos/${filename}`,
        caption: caption || '',
        isProfile: isProfile || false,
        sortOrder: (maxSortOrder?.sortOrder || 0) + 1
      }
    });

    return apiSuccess({
      photo: {
        id: photo.id,
        url: photo.url,
        caption: photo.caption,
        isProfile: photo.isProfile,
        sortOrder: photo.sortOrder
      }
    });

  } catch (error) {
    console.error('Photo upload error:', error);
    return ApiErrors.internal('Failed to upload photo');
  }
}

export async function GET(request: NextRequest) {
  try {
    const caregiver = await authenticateCaregiver(request);
    if (!caregiver) {
      return ApiErrors.unauthorized();
    }

    const photos = await db.caregiverPhoto.findMany({
      where: { caregiverId: caregiver.id },
      orderBy: { sortOrder: 'asc' }
    });

    return apiSuccess({ photos });

  } catch (error) {
    console.error('Failed to fetch photos:', error);
    return ApiErrors.internal('Failed to fetch photos');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const caregiver = await authenticateCaregiver(request);
    if (!caregiver) {
      return ApiErrors.unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const photoId = searchParams.get('id');

    if (!photoId) {
      return ApiErrors.badRequest('Photo ID required');
    }

    // Verify photo belongs to caregiver
    const photo = await db.caregiverPhoto.findFirst({
      where: { 
        id: photoId,
        caregiverId: caregiver.id 
      }
    });

    if (!photo) {
      return ApiErrors.notFound('Photo not found');
    }

    // Delete from database
    await db.caregiverPhoto.delete({
      where: { id: photoId }
    });

    // Try to delete file (non-blocking)
    try {
      const { unlink } = await import('fs/promises');
      const filepath = join(process.cwd(), 'public', photo.url);
      await unlink(filepath);
    } catch (fileError) {
      console.warn('Could not delete file:', fileError);
    }

    return apiSuccess();

  } catch (error) {
    console.error('Failed to delete photo:', error);
    return ApiErrors.internal('Failed to delete photo');
  }
}