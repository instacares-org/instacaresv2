import { NextRequest } from 'next/server';
import { generateSecret, generateURI } from 'otplib';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';
import { withAuth } from '@/lib/auth-middleware';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';
import { db } from '@/lib/db';
import { encryptField } from '@/lib/field-encryption';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * POST /api/user/2fa/setup
 *
 * Generates a new TOTP secret for the authenticated user.
 * The secret is encrypted and stored in the database but 2FA is NOT
 * enabled until the user verifies a code via /api/user/2fa/verify.
 *
 * Returns the secret, an otpauth:// URI, a QR code data URI, and
 * a set of one-time recovery codes.
 */
export async function POST(request: NextRequest) {
  try {
    // ── Authentication ────────────────────────────────────────────
    const authResult = await withAuth(request, 'ANY');
    if (!authResult.isAuthorized || !authResult.user) {
      return authResult.response || ApiErrors.unauthorized();
    }
    const userId = authResult.user.id;
    const userEmail = authResult.user.email;

    // ── Check if 2FA is already enabled ───────────────────────────
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true },
    });

    if (!user) {
      return ApiErrors.notFound('User not found');
    }

    if (user.twoFactorEnabled) {
      return ApiErrors.conflict('Two-factor authentication is already enabled. Disable it first to reconfigure.');
    }

    // ── Generate TOTP secret ──────────────────────────────────────
    const secret = generateSecret();

    // Build the otpauth:// URL that authenticator apps understand
    const appName = process.env.NEXT_PUBLIC_APP_NAME || 'InstaCares';
    const otpauthUrl = generateURI({
      label: userEmail,
      issuer: appName,
      secret,
    });

    // Generate a QR code as a data URI so the frontend can render it directly
    const qrCodeDataUri = await QRCode.toDataURL(otpauthUrl, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    // ── Generate recovery codes ───────────────────────────────────
    // 8 single-use recovery codes, each 8 hex characters
    const recoveryCodes: string[] = [];
    for (let i = 0; i < 8; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      // Format as XXXX-XXXX for readability
      recoveryCodes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }

    // ── Hash and store recovery codes ─────────────────────────────
    // Delete any existing recovery codes for this user before creating new ones
    await db.recoveryCode.deleteMany({ where: { userId } });

    // Hash each recovery code with bcrypt before storing
    const hashedCodes = await Promise.all(
      recoveryCodes.map(async (code) => ({
        userId,
        codeHash: await bcrypt.hash(code, 10),
      }))
    );

    await db.recoveryCode.createMany({ data: hashedCodes });

    // ── Store encrypted secret (2FA remains disabled until verify) ─
    // Encrypt the secret before persisting to protect it at rest
    const encryptedSecret = encryptField(secret);

    await db.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: encryptedSecret,
        // twoFactorEnabled intentionally left as false
      },
    });

    // ── Response ──────────────────────────────────────────────────
    return apiSuccess(
      {
        secret,
        otpauthUrl,
        qrCode: qrCodeDataUri,
        recoveryCodes,
      },
      'TOTP secret generated. Verify a code to enable 2FA.'
    );
  } catch (error) {
    console.error('[2fa/setup] Error generating TOTP secret:', error);
    return ApiErrors.internal('Failed to set up two-factor authentication. Please try again.');
  }
}
