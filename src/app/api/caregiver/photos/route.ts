import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/options';
import { prisma } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get caregiver ID from user
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: session.user.id }
    });

    if (!caregiver) {
      return NextResponse.json(
        { error: 'Caregiver profile not found' },
        { status: 404 }
      );
    }

    // Fetch caregiver photos
    const photos = await prisma.caregiverPhoto.findMany({
      where: { caregiverId: caregiver.id },
      orderBy: { sortOrder: 'asc' }
    });

    return NextResponse.json({ photos });

  } catch (error) {
    console.error('Error fetching caregiver photos:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get caregiver ID from user
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: session.user.id }
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
      return NextResponse.json(
        { error: 'Photo URL is required' },
        { status: 400 }
      );
    }

    // Get current photo count for sort order
    const photoCount = await prisma.caregiverPhoto.count({
      where: { caregiverId: caregiver.id }
    });

    // If this is a profile photo, unset existing profile photos
    if (isProfile) {
      await prisma.caregiverPhoto.updateMany({
        where: {
          caregiverId: caregiver.id,
          isProfile: true
        },
        data: { isProfile: false }
      });
    }

    // Create new photo
    const photo = await prisma.caregiverPhoto.create({
      data: {
        caregiverId: caregiver.id,
        url,
        caption: caption || '',
        isProfile,
        sortOrder: photoCount
      }
    });

    return NextResponse.json({ photo });

  } catch (error) {
    console.error('Error creating caregiver photo:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get caregiver ID from user
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: session.user.id }
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
      return NextResponse.json(
        { error: 'Photo ID is required' },
        { status: 400 }
      );
    }

    // Verify photo belongs to this caregiver
    const photo = await prisma.caregiverPhoto.findFirst({
      where: {
        id: photoId,
        caregiverId: caregiver.id
      }
    });

    if (!photo) {
      return NextResponse.json(
        { error: 'Photo not found' },
        { status: 404 }
      );
    }

    // Delete the photo
    await prisma.caregiverPhoto.delete({
      where: { id: photoId }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting caregiver photo:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}