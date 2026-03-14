import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { db } from '@/lib/db';
import { smsService } from '@/lib/notifications/sms.service';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

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
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { phoneNumber } = body;

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return ApiErrors.badRequest('Phone number is required');
    }

    // Basic phone validation - must have at least 10 digits
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length < 10) {
      return ApiErrors.badRequest('Invalid phone number');
    }

    const babysitter = await db.babysitter.findUnique({
      where: { userId: session.user.id },
    });

    if (!babysitter) {
      return ApiErrors.notFound('Babysitter profile not found');
    }

    if (babysitter.phoneVerified) {
      return ApiErrors.badRequest('Phone already verified');
    }

    // Rate limit: max 3 codes per babysitter per 15 minutes
    const key = babysitter.id;
    const existing = verificationCodes.get(key);
    if (existing && Date.now() < existing.expiresAt && existing.attempts >= 3) {
      return ApiErrors.tooManyRequests('Too many attempts. Please wait before requesting a new code.');
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
      return ApiErrors.internal('Failed to send verification code. Please check the phone number and try again.');
    }

    return apiSuccess(undefined, 'Verification code sent');
  } catch (error) {
    console.error('Send phone verification error:', error);
    return ApiErrors.internal('Failed to send verification code');
  }
}

// PUT - Verify the code
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string' || code.length !== 6) {
      return ApiErrors.badRequest('Invalid verification code');
    }

    const babysitter = await db.babysitter.findUnique({
      where: { userId: session.user.id },
    });

    if (!babysitter) {
      return ApiErrors.notFound('Babysitter profile not found');
    }

    if (babysitter.phoneVerified) {
      return ApiErrors.badRequest('Phone already verified');
    }

    const stored = verificationCodes.get(babysitter.id);

    if (!stored) {
      return ApiErrors.badRequest('No verification code found. Please request a new one.');
    }

    if (Date.now() > stored.expiresAt) {
      verificationCodes.delete(babysitter.id);
      return ApiErrors.badRequest('Verification code has expired. Please request a new one.');
    }

    if (stored.code !== code) {
      return ApiErrors.badRequest('Incorrect verification code');
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

    return apiSuccess(undefined, 'Phone number verified successfully');
  } catch (error) {
    console.error('Verify phone code error:', error);
    return ApiErrors.internal('Failed to verify code');
  }
}
