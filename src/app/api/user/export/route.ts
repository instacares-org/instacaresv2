import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { ApiErrors } from '@/lib/api-utils';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/export
 *
 * PIPEDA-compliant personal data export endpoint.
 * Returns ALL personal data associated with the authenticated user as a
 * downloadable JSON file. Sensitive fields (password hashes, session tokens,
 * OAuth tokens) are stripped before delivery.
 */
export async function GET(request: NextRequest) {
  try {
    // ── Authentication ──────────────────────────────────────────────
    const authResult = await withAuth(request, 'ANY');
    if (!authResult.isAuthorized || !authResult.user) {
      return authResult.response || ApiErrors.unauthorized();
    }
    const userId = authResult.user.id;

    // ── Fetch all user-related data ─────────────────────────────────
    const userData = await db.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        children: true,
        emergencyContacts: true,
        caregiver: {
          include: {
            certifications: true,
            services: true,
            photos: true,
            verification: true,
            availabilitySlots: true,
            warnings: true,
          },
        },
        babysitter: {
          include: {
            references: true,
            availabilitySlots: true,
            reviews: true,
          },
        },
        parentBookings: {
          include: {
            payments: true,
            invoices: true,
            reviews: true,
            extensions: true,
            checkInOuts: true,
          },
        },
        caregiverBookings: {
          include: {
            payments: true,
            invoices: true,
            reviews: true,
            extensions: true,
            checkInOuts: true,
          },
        },
        parentBabysitterBookings: {
          include: {
            review: true,
          },
        },
        parentChatRooms: {
          include: { messages: true },
        },
        caregiverChatRooms: {
          include: { messages: true },
        },
        notifications: true,
        notificationPreferences: true,
        sentMessages: true,
        givenReviews: true,
        receivedReviews: true,
        supportTickets: {
          include: { responses: true },
        },
        reservations: true,
        manualPayouts: true,
        accounts: true,
        sessions: true,
        supervisorPermission: true,
      },
    });

    if (!userData) {
      return ApiErrors.notFound('User not found');
    }

    // ── Sanitize sensitive fields ───────────────────────────────────
    const sanitized = sanitizeUserData(userData);

    // ── Build export envelope ───────────────────────────────────────
    const exportData = {
      exportMetadata: {
        exportDate: new Date().toISOString(),
        userId,
        format: 'PIPEDA Personal Data Export',
        version: '1.0',
        description:
          'This file contains all personal data associated with your InstaCares account, ' +
          'provided in compliance with the Personal Information Protection and Electronic ' +
          'Documents Act (PIPEDA).',
      },
      userData: sanitized,
    };

    // ── Return as downloadable JSON ─────────────────────────────────
    const dateStamp = new Date().toISOString().split('T')[0];

    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="instacares-data-export-${dateStamp}.json"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[user/export] Failed to export user data:', error);
    return ApiErrors.internal('Failed to export user data. Please try again later.');
  }
}

// ── Sanitization helpers ──────────────────────────────────────────────

/**
 * Fields that must be removed from the export because they contain
 * secrets, internal tokens, or hashed credentials.
 */
const SENSITIVE_FIELDS = new Set([
  'passwordHash',
  // Session tokens
  'sessionToken',
  // OAuth / Account tokens
  'access_token',
  'refresh_token',
  'id_token',
  'session_state',
  // Stripe identifiers (internal platform secrets)
  'stripeAccountId',
  'stripeConnectId',
  'stripePaymentIntentId',
  'stripeChargeId',
  'stripeRefundId',
  'stripeCustomerId',
  'platformFeePaymentId',
  'fullPaymentId',
  // Notification internals
  'unsubscribeToken',
]);

/**
 * Recursively walk a value and strip any keys listed in SENSITIVE_FIELDS.
 * Returns a new object/array; the original is never mutated.
 */
function stripSensitiveFields(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(stripSensitiveFields);
  }

  if (typeof value === 'object' && value !== null) {
    // Handle Date objects - serialize to ISO string
    if (value instanceof Date) {
      return value.toISOString();
    }

    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_FIELDS.has(key)) {
        continue;
      }
      cleaned[key] = stripSensitiveFields(val);
    }
    return cleaned;
  }

  return value;
}

/**
 * Top-level sanitizer that strips sensitive data and removes the
 * sessions array entirely (it only contains tokens).
 */
function sanitizeUserData(data: Record<string, unknown>): Record<string, unknown> {
  // Deep-clone and strip sensitive fields
  const sanitized = stripSensitiveFields(data) as Record<string, unknown>;

  // Sessions are entirely token-based and carry no user-meaningful data.
  // Remove the whole array rather than returning empty shells.
  delete sanitized.sessions;

  // Accounts: keep provider info but tokens are already stripped above.
  // The remaining fields (provider, providerAccountId, type) are useful
  // for the user to know which OAuth providers are linked.

  return sanitized;
}
