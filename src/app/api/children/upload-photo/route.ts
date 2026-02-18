import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import {
  validateFileUpload,
  generateSecureFilename,
  createFileUploadError,
  checkUploadRateLimit,
} from '@/lib/file-upload-validation';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  let session: any = null;
  try {
    // Verify authentication using NextAuth
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json({ error: 'Child not found or unauthorized' }, { status: 404 });
    }

    // Validate file upload with comprehensive security checks
    const validation = await validateFileUpload(file, {
      allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      maxSizeBytes: 5 * 1024 * 1024, // 5MB
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

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filepath = path.join(uploadDir, filename);
    await writeFile(filepath, buffer);

    // Update child profile with photo URL
    const photoUrl = `/uploads/children/${filename}`;

    await db.child.update({
      where: { id: childId },
      data: { photoUrl }
    });

    logger.info('Child photo uploaded successfully', {
      userId: session.user.id,
      email: session.user.email,
      childId: childId,
      filename: filename,
      fileSize: file.size,
    });

    return NextResponse.json({
      success: true,
      photoUrl
    });
  } catch (error: any) {
    logger.error('Child photo upload failed', error, {
      userId: session?.user?.id,
      email: session?.user?.email,
    });
    return NextResponse.json(
      { error: 'Failed to upload photo' },
      { status: 500 }
    );
  }
}
