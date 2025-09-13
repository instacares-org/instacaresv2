import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
// import { verifyToken } from '@/lib/jwt';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get form data
    const formData = await request.formData();
    const file = formData.get('avatar') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPG, PNG, and WebP are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    // Create unique filename
    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const filename = `avatar-${decoded.userId}-${timestamp}.${extension}`;
    
    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filepath = path.join(uploadDir, filename);
    await writeFile(filepath, buffer);

    // Update user profile with avatar URL
    const avatarUrl = `/uploads/avatars/${filename}`;
    
    await db.userProfile.update({
      where: { userId: decoded.userId },
      data: { avatar: avatarUrl }
    });

    // Fetch updated user data
    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      include: {
        profile: true,
        caregiver: decoded.userType === 'CAREGIVER' ? {
          select: {
            id: true,
            hourlyRate: true,
            averageRating: true,
            isAvailable: true,
            bio: true,
            experienceYears: true,
            stripeAccountId: true,
          }
        } : false
      }
    });

    return NextResponse.json({
      success: true,
      avatarUrl,
      user: {
        id: user!.id,
        email: user!.email,
        userType: user!.userType,
        approvalStatus: user!.approvalStatus,
        profile: user!.profile,
        caregiver: user!.caregiver
      }
    });

  } catch (error: any) {
    console.error('Avatar upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload avatar' },
      { status: 500 }
    );
  }
}