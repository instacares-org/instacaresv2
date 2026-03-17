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
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

const ALLOWED_DOCUMENT_TYPES = [
  'governmentIdFront',
  'governmentIdBack',
  'policeCheck',
  'selfieForMatch',
  'cprCertificate',
  'eceCertificate',
] as const;

type DocumentType = typeof ALLOWED_DOCUMENT_TYPES[number];

export async function POST(request: NextRequest) {
  let session: any = null;

  try {
    session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    // Check rate limiting
    const rateLimit = checkUploadRateLimit(session.user.id, 20, 60 * 60 * 1000); // 20 uploads per hour
    if (!rateLimit.allowed) {
      logger.warn('Document upload rate limit exceeded', {
        userId: session.user.id,
        email: session.user.email,
      });
      return createFileUploadError(rateLimit.error || 'Rate limit exceeded', 429);
    }

    // Get form data
    const formData = await request.formData();
    const file = formData.get('document') as File;
    const documentType = formData.get('documentType') as string;

    if (!file) {
      return createFileUploadError('No file uploaded');
    }

    if (!documentType || !ALLOWED_DOCUMENT_TYPES.includes(documentType as DocumentType)) {
      return createFileUploadError('Invalid document type');
    }

    // Validate file upload with comprehensive security checks
    const validation = await validateFileUpload(file, {
      allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'],
      maxSizeBytes: 50 * 1024 * 1024, // 50MB - modern phone photos can be very large
      checkMagicBytes: true,
    });

    if (!validation.valid) {
      logger.warn('Invalid document upload attempt', {
        userId: session.user.id,
        email: session.user.email,
        error: validation.error,
        fileType: file.type,
        fileSize: file.size,
        documentType,
      });
      return createFileUploadError(validation.error || 'Invalid file');
    }

    // Get babysitter profile
    const babysitter = await db.babysitter.findUnique({
      where: { userId: session.user.id }
    });

    if (!babysitter) {
      return ApiErrors.notFound('Babysitter profile not found. Please complete registration first.');
    }

    // Generate secure unique filename
    const filename = generateSecureFilename(file.name, session.user.id, `babysitter-${documentType}`);

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'babysitter-documents');
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const bytes = await file.arrayBuffer();
    const inputBuffer = Buffer.from(bytes) as Buffer<ArrayBuffer>;

    let finalFilename = filename;
    let processedBuffer: Buffer<ArrayBuffer> = inputBuffer;

    // Process images (not PDFs)
    if (file.type.startsWith('image/')) {
      // Get image metadata
      const metadata = await sharp(inputBuffer).metadata();
      const { width = 0, height = 0 } = metadata;

      // Resize large images while maintaining aspect ratio
      const maxDimension = 2000;
      if (width > maxDimension || height > maxDimension) {
        processedBuffer = await sharp(inputBuffer)
          .resize(maxDimension, maxDimension, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: 90 })
          .toBuffer() as Buffer<ArrayBuffer>;
        finalFilename = filename.replace(/\.[^.]+$/, '.jpg');
      } else {
        // Convert to JPEG for consistency
        processedBuffer = await sharp(inputBuffer)
          .jpeg({ quality: 90 })
          .toBuffer() as Buffer<ArrayBuffer>;
        finalFilename = filename.replace(/\.[^.]+$/, '.jpg');
      }
    }

    // Save file
    const filepath = path.join(uploadDir, finalFilename);
    await writeFile(filepath, processedBuffer);

    // Generate URL
    const documentUrl = `/uploads/babysitter-documents/${finalFilename}`;

    // Update babysitter profile with document URL
    const updateData: Record<string, string> = {};
    updateData[documentType] = documentUrl;

    const updatedBabysitter = await db.babysitter.update({
      where: { id: babysitter.id },
      data: updateData,
      select: {
        governmentIdFront: true,
        governmentIdBack: true,
        policeCheck: true,
        selfieForMatch: true,
        cprCertificate: true,
        eceCertificate: true,
        status: true,
      }
    });

    // Check if all required documents are now uploaded
    const hasRequiredDocs =
      updatedBabysitter.governmentIdFront &&
      updatedBabysitter.governmentIdBack &&
      updatedBabysitter.policeCheck &&
      updatedBabysitter.selfieForMatch;

    // Update status if needed
    if (hasRequiredDocs && updatedBabysitter.status === 'PENDING_VERIFICATION') {
      await db.babysitter.update({
        where: { id: babysitter.id },
        data: { status: 'DOCUMENTS_SUBMITTED' }
      });
    }

    logger.info('Babysitter document uploaded successfully', {
      userId: session.user.id,
      email: session.user.email,
      documentType,
      filename: finalFilename,
      originalSize: file.size,
      processedSize: processedBuffer.length,
    });

    return apiSuccess({
      documentType,
      documentUrl,
      hasRequiredDocs,
      documents: {
        governmentIdFront: !!updatedBabysitter.governmentIdFront,
        governmentIdBack: !!updatedBabysitter.governmentIdBack,
        policeCheck: !!updatedBabysitter.policeCheck,
        selfieForMatch: !!updatedBabysitter.selfieForMatch,
        cprCertificate: !!updatedBabysitter.cprCertificate,
        eceCertificate: !!updatedBabysitter.eceCertificate,
      }
    });

  } catch (error: any) {
    logger.error('Babysitter document upload failed', error, {
      userId: session?.user?.id,
      email: session?.user?.email,
    });
    return ApiErrors.internal('Failed to upload document');
  }
}
