import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

export async function POST(request: NextRequest) {
  // Constant-time delay to prevent timing-based email enumeration
  const start = Date.now();
  const MIN_RESPONSE_MS = 300;

  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if user already exists (case-insensitive)
    const existingUser = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase()
      },
      select: { id: true } // Only select id, don't leak any user data
    });

    // Enforce constant response time to prevent timing attacks
    const elapsed = Date.now() - start;
    if (elapsed < MIN_RESPONSE_MS) {
      await new Promise(resolve => setTimeout(resolve, MIN_RESPONSE_MS - elapsed));
    }

    return NextResponse.json({
      exists: !!existingUser
    });

  } catch (error) {
    console.error('Email check error:', error);

    // Enforce constant response time even on errors
    const elapsed = Date.now() - start;
    if (elapsed < MIN_RESPONSE_MS) {
      await new Promise(resolve => setTimeout(resolve, MIN_RESPONSE_MS - elapsed));
    }

    return NextResponse.json(
      { error: 'Unable to check email availability' },
      { status: 500 }
    );
  }
}
