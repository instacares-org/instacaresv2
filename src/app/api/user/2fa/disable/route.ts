import { NextRequest } from 'next/server';
import { verifySync } from 'otplib';
import { withAuth } from '@/lib/auth-middleware';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { decryptField, isEncrypted } from '@/lib/field-encryption';

export const dynamic = 'force-dynamic';

/**
 * POST /api/user/2fa/disable
 *
 * Disables two-factor authentication for the authenticated user.
 * Requires the user to provide a valid TOTP token to confirm the action,
 * preventing unauthorized disabling of 2FA.
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
      return ApiErrors.badRequest('A 6-digit TOTP token is required to disable 2FA');
    }

    // Strip whitespace/dashes and validate format
    const sanitizedToken = token.replace(/[\s-]/g, '');
    if (!/^\d{6}$/.test(sanitizedToken)) {
      return ApiErrors.badRequest('Token must be a 6-digit numeric code');
    }

    // ── Look up user ──────────────────────────────────────────────
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

    if (!user.twoFactorEnabled) {
      return ApiErrors.badRequest('Two-factor authentication is not currently enabled');
    }

    if (!user.twoFactorSecret) {
      // Edge case: enabled flag is true but secret is missing.
      // Clear the inconsistent state.
      await db.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
      });
      return apiSuccess(undefined, 'Two-factor authentication has been disabled.');
    }

    // ── Decrypt the secret ────────────────────────────────────────
    const secret = isEncrypted(user.twoFactorSecret)
      ? decryptField(user.twoFactorSecret)
      : user.twoFactorSecret;

    // ── Verify the TOTP token before disabling ────────────────────
    const otpResult = verifySync({ token: sanitizedToken, secret });

    if (!otpResult.valid) {
      return ApiErrors.badRequest('Invalid verification code. Please enter the current code from your authenticator app.');
    }

    // ── Disable 2FA and clear the secret ──────────────────────────
    await db.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    return apiSuccess(undefined, 'Two-factor authentication has been disabled successfully.');
  } catch (error) {
    console.error('[2fa/disable] Error disabling 2FA:', error);
    return ApiErrors.internal('Failed to disable two-factor authentication.');
  }
}
