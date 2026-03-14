import { NextRequest } from 'next/server';
import { verifySync } from 'otplib';
import { withAuth } from '@/lib/auth-middleware';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { decryptField, isEncrypted } from '@/lib/field-encryption';

export const dynamic = 'force-dynamic';

/**
 * POST /api/user/2fa/verify
 *
 * Accepts a TOTP token from the user's authenticator app and, if valid,
 * enables two-factor authentication on their account.
 *
 * This endpoint is called AFTER /api/user/2fa/setup, once the user has
 * scanned the QR code and is confirming their first code.
 *
 * Body: { token: string }
 */
export async function POST(request: NextRequest) {
  try {
    // ── Authentication ────────────────────────────────────────────
    const authResult = await withAuth(request, 'ANY');
    if (!authResult.isAuthorized || !authResult.user) {
      return authResult.response || ApiErrors.unauthorized();
    }
    const userId = authResult.user.id;

    // ── Parse request body ────────────────────────────────────────
    let body: { token?: string };
    try {
      body = await request.json();
    } catch {
      return ApiErrors.badRequest('Invalid JSON body');
    }

    const { token } = body;

    if (!token || typeof token !== 'string') {
      return ApiErrors.badRequest('A 6-digit TOTP token is required');
    }

    // Strip whitespace/dashes and validate format
    const sanitizedToken = token.replace(/[\s-]/g, '');
    if (!/^\d{6}$/.test(sanitizedToken)) {
      return ApiErrors.badRequest('Token must be a 6-digit numeric code');
    }

    // ── Look up user and their stored secret ──────────────────────
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        twoFactorSecret: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      return ApiErrors.notFound('User not found');
    }

    if (user.twoFactorEnabled) {
      return ApiErrors.conflict('Two-factor authentication is already enabled');
    }

    if (!user.twoFactorSecret) {
      return ApiErrors.badRequest(
        'No TOTP secret found. Please call /api/user/2fa/setup first.'
      );
    }

    // ── Decrypt the secret ────────────────────────────────────────
    const secret = isEncrypted(user.twoFactorSecret)
      ? decryptField(user.twoFactorSecret)
      : user.twoFactorSecret;

    // ── Verify the TOTP token ─────────────────────────────────────
    const otpResult = verifySync({ token: sanitizedToken, secret });

    if (!otpResult.valid) {
      return ApiErrors.badRequest('Invalid verification code. Please try again.');
    }

    // ── Enable 2FA ────────────────────────────────────────────────
    await db.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    return apiSuccess(undefined, 'Two-factor authentication has been enabled successfully.');
  } catch (error) {
    console.error('[2fa/verify] Error verifying TOTP token:', error);
    return ApiErrors.internal('Failed to verify two-factor authentication code.');
  }
}
