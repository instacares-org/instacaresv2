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

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let session: any = null;
  try {
    // Verify authentication using NextAuth
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    // Check rate limiting
    const rateLimit = checkUploadRateLimit(session.user.id, 20, 60 * 60 * 1000); // 20 uploads per hour
    if (!rateLimit.allowed) {
      logger.warn('Upload rate limit exceeded', {
        userId: session.user.id,
        email: session.user.email,
      });
      return createFileUploadError(rateLimit.error || 'Rate limit exceeded', 429);
    }

    // Get form data
    const formData = await request.formData();
    const file = formData.get('photo') as File;
    const childId = formData.get('childId') as string;

    if (!file) {
      return createFileUploadError('No file uploaded');
    }

    if (!childId) {
      return createFileUploadError('Child ID is required');
    }

    // Verify child belongs to parent
    const child = await db.child.findFirst({
      where: {
        id: childId,
        parentId: session.user.id
      }
    });

    if (!child) {
      return ApiErrors.notFound('Child not found or unauthorized');
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
    const filename = generateSecureFilename(file.name, session.user.id, 'child');

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'children');
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Process image: resize and optimize with sharp
    const bytes = await file.arrayBuffer();
    const inputBuffer = Buffer.from(bytes);

    const metadata = await sharp(inputBuffer).metadata();
    const { width = 0, height = 0 } = metadata;

    // Resize to max 512x512 (square crop, same as avatar)
    const size = Math.min(width, height);
    const left = Math.floor((width - size) / 2);
    const top = Math.floor((height - size) / 2);

    const processedBuffer = await sharp(inputBuffer)
      .extract({ left, top, width: size, height: size })
      .resize(512, 512, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 85 })
      .toBuffer();

    // Save processed file (change extension to .jpg)
    const jpgFilename = filename.replace(/\.[^.]+$/, '.jpg');
    const filepath = path.join(uploadDir, jpgFilename);
    await writeFile(filepath, processedBuffer);

    // Update child profile with photo URL
    const photoUrl = `/uploads/children/${jpgFilename}`;

    await db.child.update({
      where: { id: childId },
      data: { photoUrl }
    });

    logger.info('Child photo uploaded successfully', {
      userId: session.user.id,
      email: session.user.email,
      childId: childId,
      filename: jpgFilename,
      originalSize: file.size,
      processedSize: processedBuffer.length,
      originalDimensions: `${width}x${height}`,
    });

    return apiSuccess({ photoUrl });
  } catch (error: any) {
    logger.error('Child photo upload failed', error, {
      userId: session?.user?.id,
      email: session?.user?.email,
    });
    return ApiErrors.internal('Failed to upload photo');
  }
}
