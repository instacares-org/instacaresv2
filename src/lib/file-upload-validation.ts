/**
 * File Upload Security Validation Utility
 *
 * This module provides secure file upload validation including:
 * - MIME type verification
 * - File extension validation
 * - Magic bytes (file signature) verification
 * - File size limits
 * - Filename sanitization
 */

import { NextResponse } from 'next/server';

// Supported image types with their magic bytes (file signatures)
const IMAGE_SIGNATURES: Record<string, number[][]> = {
  'image/jpeg': [
    [0xFF, 0xD8, 0xFF, 0xE0], // JPEG JFIF
    [0xFF, 0xD8, 0xFF, 0xE1], // JPEG EXIF
    [0xFF, 0xD8, 0xFF, 0xE2], // JPEG
    [0xFF, 0xD8, 0xFF, 0xE3], // JPEG
  ],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif': [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
  ],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF (WebP starts with RIFF)
};

interface FileValidationOptions {
  allowedTypes?: string[];
  maxSizeBytes?: number;
  checkMagicBytes?: boolean;
}

interface FileValidationResult {
  valid: boolean;
  error?: string;
  sanitizedFilename?: string;
}

/**
 * Validates file upload security
 */
export async function validateFileUpload(
  file: File,
  options: FileValidationOptions = {}
): Promise<FileValidationResult> {
  const {
    allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    maxSizeBytes = 5 * 1024 * 1024, // 5MB default
    checkMagicBytes = true,
  } = options;

  // 1. Check if file exists
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // 2. Validate MIME type
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
    };
  }

  // 3. Validate file size
  if (file.size > maxSizeBytes) {
    const maxSizeMB = (maxSizeBytes / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File too large. Maximum size is ${maxSizeMB}MB`,
    };
  }

  // 4. Validate file extension
  const filename = file.name.toLowerCase();
  const allowedExtensions = allowedTypes.map((type) => {
    switch (type) {
      case 'image/jpeg':
      case 'image/jpg':
        return '.jpg';
      case 'image/png':
        return '.png';
      case 'image/webp':
        return '.webp';
      case 'image/gif':
        return '.gif';
      default:
        return '';
    }
  });

  const hasValidExtension = allowedExtensions.some((ext) =>
    filename.endsWith(ext)
  );
  if (!hasValidExtension) {
    return {
      valid: false,
      error: `Invalid file extension. Allowed: ${allowedExtensions.join(', ')}`,
    };
  }

  // 5. Check magic bytes (file signature) to prevent MIME type spoofing
  if (checkMagicBytes) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const signatures = IMAGE_SIGNATURES[file.type];

    if (signatures) {
      const isValidSignature = signatures.some((signature) =>
        signature.every((byte, index) => bytes[index] === byte)
      );

      if (!isValidSignature) {
        return {
          valid: false,
          error: 'File content does not match declared type (possible spoofing)',
        };
      }
    }
  }

  // 6. Sanitize filename
  const sanitizedFilename = sanitizeFilename(file.name);

  return {
    valid: true,
    sanitizedFilename,
  };
}

/**
 * Sanitizes filename to prevent directory traversal and other attacks
 */
export function sanitizeFilename(filename: string): string {
  let clean = filename.replace(/^.*[\\\/]/, '');
  clean = clean.replace(/[^a-zA-Z0-9._-]/g, '_');
  clean = clean.replace(/\.{2,}/g, '.');

  if (!clean || clean === '' || clean === '.') {
    clean = 'file_' + Date.now();
  }

  if (clean.length > 255) {
    const ext = clean.substring(clean.lastIndexOf('.'));
    const name = clean.substring(0, 200);
    clean = name + ext;
  }

  return clean;
}

/**
 * Generates a secure unique filename
 */
export function generateSecureFilename(
  originalFilename: string,
  userId: string,
  prefix: string = 'upload'
): string {
  const extension = originalFilename.split('.').pop()?.toLowerCase() || 'jpg';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${userId}-${timestamp}-${random}.${extension}`;
}

/**
 * Creates a standardized file upload error response
 */
export function createFileUploadError(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Validates URL for photo endpoints (prevents SSRF)
 */
export function validatePhotoUrl(url: string): FileValidationResult {
  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTPS URLs are allowed' };
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    const privatePatterns = [
      /^localhost$/i,
      /^127\.\d+\.\d+\.\d+$/,
      /^10\.\d+\.\d+\.\d+$/,
      /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
      /^192\.168\.\d+\.\d+$/,
      /^0\.0\.0\.0$/,
      /^\[::\]$/,
      /^\[?::1\]?$/,
    ];

    if (privatePatterns.some((pattern) => pattern.test(hostname))) {
      return { valid: false, error: 'Private IP addresses are not allowed' };
    }

    const path = parsedUrl.pathname.toLowerCase();
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const hasImageExtension = imageExtensions.some((ext) => path.endsWith(ext));

    if (!hasImageExtension && !path.includes('image')) {
      return { valid: false, error: 'URL does not appear to be an image' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

const uploadAttempts = new Map<string, { count: number; resetTime: number }>();

export function checkUploadRateLimit(
  userId: string,
  maxUploads: number = 10,
  windowMs: number = 60 * 60 * 1000
): { allowed: boolean; error?: string } {
  const now = Date.now();
  const userKey = `upload_${userId}`;
  const current = uploadAttempts.get(userKey);

  if (current && now > current.resetTime) {
    uploadAttempts.delete(userKey);
  }

  const limit = uploadAttempts.get(userKey);

  if (!limit) {
    uploadAttempts.set(userKey, { count: 1, resetTime: now + windowMs });
    return { allowed: true };
  }

  if (limit.count >= maxUploads) {
    const resetMinutes = Math.ceil((limit.resetTime - now) / 60000);
    return {
      allowed: false,
      error: `Upload limit exceeded. Try again in ${resetMinutes} minutes.`,
    };
  }

  limit.count++;
  uploadAttempts.set(userKey, limit);
  return { allowed: true };
}
