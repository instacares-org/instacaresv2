import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';
import { withAuth } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/notification-preferences
 * Fetch the current notification preferences for the authenticated user.
 * Creates default preferences if none exist yet.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, 'ANY');
    if (!auth.isAuthorized) return auth.response;

    const userId = auth.user!.id;

    // Upsert: return existing preferences or create defaults
    const preferences = await prisma.notificationPreferences.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        emailEnabled: true,
        marketingEmails: false,
        smsEnabled: true,
        marketingSms: false,
        bookingUpdates: true,
        paymentAlerts: true,
        reminderAlerts: true,
        securityAlerts: true,
      },
      select: {
        id: true,
        emailEnabled: true,
        marketingEmails: true,
        smsEnabled: true,
        marketingSms: true,
        bookingUpdates: true,
        paymentAlerts: true,
        reminderAlerts: true,
        securityAlerts: true,
        emailConsent: true,
        smsConsent: true,
        updatedAt: true,
      },
    });

    return apiSuccess(preferences);
  } catch (error) {
    console.error('GET /api/user/notification-preferences error:', error);
    return ApiErrors.internal('Failed to fetch notification preferences');
  }
}

/**
 * PATCH /api/user/notification-preferences
 * Update notification preferences for the authenticated user.
 * Only boolean preference fields are accepted; unknown keys are ignored.
 *
 * PIPEDA compliance: records consent timestamps when email/SMS marketing
 * preferences are enabled.
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await withAuth(request, 'ANY');
    if (!auth.isAuthorized) return auth.response;

    const userId = auth.user!.id;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return ApiErrors.badRequest('Invalid JSON body');
    }

    // Whitelist of updatable boolean fields
    const allowedFields = [
      'emailEnabled',
      'marketingEmails',
      'smsEnabled',
      'marketingSms',
      'bookingUpdates',
      'paymentAlerts',
      'reminderAlerts',
      'securityAlerts',
    ] as const;

    type AllowedField = (typeof allowedFields)[number];

    const updateData: Partial<Record<AllowedField, boolean>> & {
      emailConsent?: Date | null;
      smsConsent?: Date | null;
    } = {};

    let hasValidField = false;

    for (const field of allowedFields) {
      if (field in body && typeof body[field] === 'boolean') {
        updateData[field] = body[field] as boolean;
        hasValidField = true;
      }
    }

    if (!hasValidField) {
      return ApiErrors.badRequest(
        'No valid preference fields provided. Accepted fields: ' +
          allowedFields.join(', ')
      );
    }

    // PIPEDA compliance: record consent timestamps for marketing preferences
    const now = new Date();
    if (updateData.marketingEmails === true || updateData.emailEnabled === true) {
      updateData.emailConsent = now;
    }
    if (updateData.marketingSms === true || updateData.smsEnabled === true) {
      updateData.smsConsent = now;
    }
    // When marketing is explicitly disabled, clear the consent timestamp
    if (updateData.marketingEmails === false) {
      updateData.emailConsent = null;
    }
    if (updateData.marketingSms === false) {
      updateData.smsConsent = null;
    }

    // Upsert so this works even when the user has no record yet
    const updated = await prisma.notificationPreferences.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        emailEnabled: true,
        marketingEmails: false,
        smsEnabled: true,
        marketingSms: false,
        bookingUpdates: true,
        paymentAlerts: true,
        reminderAlerts: true,
        securityAlerts: true,
        ...updateData,
      },
      select: {
        id: true,
        emailEnabled: true,
        marketingEmails: true,
        smsEnabled: true,
        marketingSms: true,
        bookingUpdates: true,
        paymentAlerts: true,
        reminderAlerts: true,
        securityAlerts: true,
        emailConsent: true,
        smsConsent: true,
        updatedAt: true,
      },
    });

    return apiSuccess(updated, 'Notification preferences updated');
  } catch (error) {
    console.error('PATCH /api/user/notification-preferences error:', error);
    return ApiErrors.internal('Failed to update notification preferences');
  }
}
