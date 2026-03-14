import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import sharp from 'sharp';
import {
  validateFileUpload,
  generateSecureFilename,
  createFileUploadError,
  checkUploadRateLimit,
} from '@/lib/file-upload-validation';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  let session: any = null;
  
  try {
    // Verify authentication using NextAuth
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    // Check rate limiting
    const rateLimit = checkUploadRateLimit(session.user.id, 10, 60 * 60 * 1000); // 10 uploads per hour
    if (!rateLimit.allowed) {
      logger.warn('Upload rate limit exceeded', {
        userId: session.user.id,
        email: session.user.email,
      });
      return createFileUploadError(rateLimit.error || 'Rate limit exceeded', 429);
    }

    // Get form data
    const formData = await request.formData();
    const file = formData.get('avatar') as File;

    if (!file) {
      return createFileUploadError('No file uploaded');
    }

    // Validate file upload with comprehensive security checks
    const validation = await validateFileUpload(file, {
      allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      maxSizeBytes: 50 * 1024 * 1024, // 50MB - modern phone photos can be very large
      checkMagicBytes: true, // Verify file content matches declared type
    });

    if (!validation.valid) {
      logger.warn('Invalid file upload attempt', {
        userId: session.user.id,
        email: session.user.email,
        error: validation.error,
        fileType: file.type,
        fileSize: file.size,
      });
      return createFileUploadError(validation.error || 'Invalid file');
    }

    // Generate secure unique filename
    const filename = generateSecureFilename(file.name, session.user.id, 'avatar');

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Process image: crop to square and resize
    const bytes = await file.arrayBuffer();
    const inputBuffer = Buffer.from(bytes);
    
    // Get image metadata
    const metadata = await sharp(inputBuffer).metadata();
    const { width = 0, height = 0 } = metadata;
    
    // Calculate crop dimensions for square (center crop)
    const size = Math.min(width, height);
    const left = Math.floor((width - size) / 2);
    const top = Math.floor((height - size) / 2);
    
    // Process image: extract square region and resize to 512x512
    const processedBuffer = await sharp(inputBuffer)
      .extract({ left, top, width: size, height: size })
      .resize(512, 512, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    // Save processed file (change extension to .jpg)
    const jpgFilename = filename.replace(/\.[^.]+$/, '.jpg');
    const filepath = path.join(uploadDir, jpgFilename);
    await writeFile(filepath, processedBuffer);

    // Update user profile with avatar URL
    const avatarUrl = `/uploads/avatars/${jpgFilename}`;

    await db.userProfile.upsert({
      where: { userId: session.user.id },
      update: { avatar: avatarUrl },
      create: {
        userId: session.user.id,
        avatar: avatarUrl,
        firstName: session.user.name?.split(' ')[0] || '',
        lastName: session.user.name?.split(' ').slice(1).join(' ') || '',
      },
    });

    logger.info('Avatar uploaded successfully', {
      userId: session.user.id,
      email: session.user.email,
      filename: jpgFilename,
      originalSize: file.size,
      processedSize: processedBuffer.length,
      originalDimensions: `${width}x${height}`,
    });

    // Fetch updated user data
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: {
        profile: true,
        caregiver:
          session.user.userType === 'CAREGIVER'
            ? {
                select: {
                  id: true,
                  hourlyRate: true,
                  averageRating: true,
                  isAvailable: true,
                  bio: true,
                  experienceYears: true,
                  stripeAccountId: true,
                },
              }
            : false,
      },
    });

    return apiSuccess({
      avatarUrl,
      user: {
        id: user!.id,
        email: user!.email,
        userType: user!.userType,
        approvalStatus: user!.approvalStatus,
        profile: user!.profile,
        caregiver: user!.caregiver,
      },
    });
  } catch (error: any) {
    logger.error('Avatar upload failed', error, {
      userId: session?.user?.id,
      email: session?.user?.email,
    });
    return ApiErrors.internal('Failed to upload avatar');
  }
}
