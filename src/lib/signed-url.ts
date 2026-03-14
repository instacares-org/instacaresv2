/**
 * Signed URL utility for email download links.
 * Generates time-limited HMAC tokens so email links work without session auth.
 */
import crypto from 'crypto';

const ALGORITHM = 'sha256';
const DEFAULT_EXPIRY_HOURS = 72; // Links valid for 3 days

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET not configured');
  return secret;
}

/**
 * Generate a signed token for a download link.
 * Encodes: bookingId, type (parent/caregiver), expiry timestamp.
 */
export function generateDownloadToken(
  bookingId: string,
  type: 'parent' | 'caregiver',
  expiryHours: number = DEFAULT_EXPIRY_HOURS
): string {
  const expires = Date.now() + expiryHours * 60 * 60 * 1000;
  const payload = `${bookingId}:${type}:${expires}`;
  const signature = crypto
    .createHmac(ALGORITHM, getSecret())
    .update(payload)
    .digest('hex');

  // URL-safe base64 of payload:signature
  return Buffer.from(`${payload}:${signature}`).toString('base64url');
}

/**
 * Verify a signed download token.
 * Returns the decoded payload if valid, null if invalid or expired.
 */
export function verifyDownloadToken(
  token: string
): { bookingId: string; type: 'parent' | 'caregiver' } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 4) return null;

    const [bookingId, type, expiresStr, signature] = parts;

    // Verify type
    if (type !== 'parent' && type !== 'caregiver') return null;

    // Check expiry
    const expires = parseInt(expiresStr, 10);
    if (isNaN(expires) || Date.now() > expires) return null;

    // Verify signature
    const payload = `${bookingId}:${type}:${expiresStr}`;
    const expectedSignature = crypto
      .createHmac(ALGORITHM, getSecret())
      .update(payload)
      .digest('hex');

    if (!crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )) {
      return null;
    }

    return { bookingId, type: type as 'parent' | 'caregiver' };
  } catch {
    return null;
  }
}
