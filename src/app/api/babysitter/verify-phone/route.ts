import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { db } from '@/lib/db';
import { smsService } from '@/lib/notifications/sms.service';

// In-memory store for verification codes (TTL: 10 minutes)
const verificationCodes = new Map<string, { code: string; expiresAt: number; attempts: number }>();

// Clean up expired codes periodically
function cleanExpiredCodes() {
  const now = Date.now();
  for (const [key, value] of verificationCodes) {
    if (now > value.expiresAt) {
      verificationCodes.delete(key);
    }
  }
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST - Send verification code
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { phoneNumber } = body;

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // Basic phone validation - must have at least 10 digits
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length < 10) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }

    const babysitter = await db.babysitter.findUnique({
      where: { userId: session.user.id },
    });

    if (!babysitter) {
      return NextResponse.json({ error: 'Babysitter profile not found' }, { status: 404 });
    }

    if (babysitter.phoneVerified) {
      return NextResponse.json({ error: 'Phone already verified' }, { status: 400 });
    }

    // Rate limit: max 3 codes per babysitter per 15 minutes
    const key = babysitter.id;
    const existing = verificationCodes.get(key);
    if (existing && Date.now() < existing.expiresAt && existing.attempts >= 3) {
      return NextResponse.json(
        { error: 'Too many attempts. Please wait before requesting a new code.' },
        { status: 429 }
      );
    }

    cleanExpiredCodes();

    const code = generateCode();
    verificationCodes.set(key, {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      attempts: (existing && Date.now() < existing.expiresAt ? existing.attempts : 0) + 1,
    });

    // Save phone number to user profile
    await db.userProfile.update({
      where: { userId: session.user.id },
      data: { phone: phoneNumber },
    });

    // Send SMS
    const result = await smsService.sendVerificationCode(phoneNumber, code);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to send verification code. Please check the phone number and try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent',
    });
  } catch (error) {
    console.error('Send phone verification error:', error);
    return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 });
  }
}

// PUT - Verify the code
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string' || code.length !== 6) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    const babysitter = await db.babysitter.findUnique({
      where: { userId: session.user.id },
    });

    if (!babysitter) {
      return NextResponse.json({ error: 'Babysitter profile not found' }, { status: 404 });
    }

    if (babysitter.phoneVerified) {
      return NextResponse.json({ error: 'Phone already verified' }, { status: 400 });
    }

    const stored = verificationCodes.get(babysitter.id);

    if (!stored) {
      return NextResponse.json(
        { error: 'No verification code found. Please request a new one.' },
        { status: 400 }
      );
    }

    if (Date.now() > stored.expiresAt) {
      verificationCodes.delete(babysitter.id);
      return NextResponse.json(
        { error: 'Verification code has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    if (stored.code !== code) {
      return NextResponse.json({ error: 'Incorrect verification code' }, { status: 400 });
    }

    // Code is correct - mark phone as verified
    await db.babysitter.update({
      where: { id: babysitter.id },
      data: { phoneVerified: true },
    });

    // Also mark user-level phone verification
    await db.user.update({
      where: { id: session.user.id },
      data: { phoneVerified: true },
    });

    verificationCodes.delete(babysitter.id);

    return NextResponse.json({
      success: true,
      message: 'Phone number verified successfully',
    });
  } catch (error) {
    console.error('Verify phone code error:', error);
    return NextResponse.json({ error: 'Failed to verify code' }, { status: 500 });
  }
}
