import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caregiver = await authenticateCaregiver(request);
    if (!caregiver) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
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

    return NextResponse.json({
      success: true,
      photo: updatedPhoto
    });

  } catch (error) {
    console.error('Photo update error:', error);
    return NextResponse.json({ 
      error: 'Failed to update photo' 
    }, { status: 500 });
  }
}