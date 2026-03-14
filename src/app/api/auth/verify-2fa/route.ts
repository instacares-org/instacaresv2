import { NextRequest } from 'next/server';
import { verifySync } from 'otplib';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { decryptField, isEncrypted } from '@/lib/field-encryption';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/verify-2fa
 *
 * Verifies a TOTP code during the login flow.
 *
 * This is an UNAUTHENTICATED endpoint (no session required) because it is
 * called between the password check and the final session creation.
 *
 * Flow:
 *   1. User enters email + password on the login form.
 *   2. NextAuth authorize() validates credentials but detects twoFactorEnabled.
 *   3. authorize() throws "2FA_REQUIRED" so the frontend knows to prompt.
 *   4. Frontend calls THIS endpoint with { email, token }.
 *   5. If valid, frontend calls signIn() again with the twoFactorToken credential.
 *
 * Body: { email: string, token: string }
 */
export async function POST(request: NextRequest) {
  try {
    // ── Parse request body ────────────────────────────────────────
    let body: { email?: string; token?: string };
    try {
      body = await request.json();
    } catch {
      return ApiErrors.badRequest('Invalid JSON body');
    }

    const { email, token } = body;

    if (!email || typeof email !== 'string') {
      return ApiErrors.badRequest('Email is required');
    }

    if (!token || typeof token !== 'string') {
      return ApiErrors.badRequest('A 6-digit TOTP token is required');
    }

    // Normalize and validate
    const normalizedEmail = email.toLowerCase().trim();
    const sanitizedToken = token.replace(/[\s-]/g, '');

    if (!/^\d{6}$/.test(sanitizedToken)) {
      return ApiErrors.badRequest('Token must be a 6-digit numeric code');
    }

    // ── Look up user by email ─────────────────────────────────────
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        twoFactorSecret: true,
        twoFactorEnabled: true,
        isActive: true,
      },
    });

    if (!user) {
      // Use a generic message to avoid leaking whether the email exists
      return ApiErrors.badRequest('Invalid verification code');
    }

    if (!user.isActive) {
      return ApiErrors.forbidden('Account is inactive');
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return ApiErrors.badRequest('Two-factor authentication is not enabled for this account');
    }

    // ── Decrypt the secret ────────────────────────────────────────
    const secret = isEncrypted(user.twoFactorSecret)
      ? decryptField(user.twoFactorSecret)
      : user.twoFactorSecret;

    // ── Verify the TOTP token ─────────────────────────────────────
    const otpResult = verifySync({ token: sanitizedToken, secret });

    if (!otpResult.valid) {
      return ApiErrors.badRequest('Invalid verification code');
    }

    // ── Success ───────────────────────────────────────────────────
    // The frontend will now call signIn() again with twoFactorToken
    return apiSuccess(
      { verified: true },
      'Two-factor authentication verified'
    );
  } catch (error) {
    console.error('[auth/verify-2fa] Error verifying 2FA during login:', error);
    return ApiErrors.internal('Failed to verify two-factor authentication code');
  }
}
