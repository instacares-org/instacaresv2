import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import sharp from 'sharp';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { headers } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

interface JWTPayload {
  userId: string;
  userType: string;
}

async function authenticateCaregiver(request: NextRequest) {
  const headersList = await headers();
  const cookieHeader = headersList.get('cookie');
  
  if (!cookieHeader) {
    return null;
  }
  
  const tokenMatch = cookieHeader.match(/auth-token=([^;]+)/);
  if (!tokenMatch) {
    return null;
  }
  
  try {
    const payload = jwt.verify(tokenMatch[1], JWT_SECRET) as JWTPayload;
    if (payload.userType !== 'CAREGIVER') {
      return null;
    }
    
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      include: { caregiver: true }
    });
    
    return user?.caregiver || null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const caregiver = await authenticateCaregiver(request);
    if (!caregiver) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('photo') as File;
    const caption = formData.get('caption') as string;
    const isProfile = formData.get('isProfile') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 });
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'daycare-photos');
    try {
      await mkdir(uploadsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const filename = `daycare-${caregiver.id}-${timestamp}.${fileExtension}`;
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

    return NextResponse.json({
      success: true,
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
    return NextResponse.json({ 
      error: 'Failed to upload photo' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const caregiver = await authenticateCaregiver(request);
    if (!caregiver) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const photos = await db.caregiverPhoto.findMany({
      where: { caregiverId: caregiver.id },
      orderBy: { sortOrder: 'asc' }
    });

    return NextResponse.json({ photos });

  } catch (error) {
    console.error('Failed to fetch photos:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch photos' 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const caregiver = await authenticateCaregiver(request);
    if (!caregiver) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const photoId = searchParams.get('id');

    if (!photoId) {
      return NextResponse.json({ error: 'Photo ID required' }, { status: 400 });
    }

    // Verify photo belongs to caregiver
    const photo = await db.caregiverPhoto.findFirst({
      where: { 
        id: photoId,
        caregiverId: caregiver.id 
      }
    });

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
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

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Failed to delete photo:', error);
    return NextResponse.json({ 
      error: 'Failed to delete photo' 
    }, { status: 500 });
  }
}