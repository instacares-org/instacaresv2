import { NextRequest, NextResponse } from 'next/server';
import { signIn } from 'next-auth/react';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, userType } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        profile: true,
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check user type if specified
    if (userType === 'admin' && user.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Access denied. Admin credentials required.' },
        { status: 403 }
      );
    }

    // Verify password
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: 'Password authentication not configured for this account' },
        { status: 401 }
      );
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check account status
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is deactivated. Please contact support.' },
        { status: 403 }
      );
    }

    if (user.approvalStatus === 'PENDING') {
      return NextResponse.json(
        { error: 'Account is pending approval.' },
        { status: 403 }
      );
    }

    if (user.approvalStatus === 'REJECTED') {
      return NextResponse.json(
        { error: 'Account has been rejected.' },
        { status: 403 }
      );
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Return success with user data
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        userType: user.userType,
        profile: user.profile,
      },
      // Note: Actual session creation should be handled by NextAuth
      // This endpoint is for validation only
      message: 'Authentication successful. Use NextAuth for session management.'
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}