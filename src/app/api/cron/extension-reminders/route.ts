import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// Reminder thresholds in hours — a reminder is sent once per threshold
const REMINDER_THRESHOLDS = [
  { hours: 24, label: '24 hours' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: '7 days' },
];

// After 14 days unpaid, auto-cancel the extension
const AUTO_CANCEL_HOURS = 336; // 14 days

// =============================================================================
// POST /api/cron/extension-reminders
// Sends payment reminders for PAYMENT_PENDING / FAILED booking extensions.
// Secured via CRON_SECRET Bearer token (same pattern as /api/cron/notifications).
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    // -----------------------------------------------------------------------
    // 1. Authenticate — only accept requests with valid CRON_SECRET
    // -----------------------------------------------------------------------
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('[ExtensionReminders] CRON_SECRET not configured');
      return ApiErrors.internal('Cron secret not configured');
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[ExtensionReminders] Unauthorized cron request');
      return ApiErrors.unauthorized();
    }

    console.log('[ExtensionReminders] Starting extension reminder cron job...');

    const results = {
      remindersSent: 0,
      extensionsCancelled: 0,
      adminAlerts: 0,
      errors: 0,
    };

    // -----------------------------------------------------------------------
    // 2. Find all unpaid extensions (PAYMENT_PENDING or FAILED)
    // -----------------------------------------------------------------------
    const unpaidExtensions = await db.bookingExtension.findMany({
      where: {
        status: { in: ['PAYMENT_PENDING', 'FAILED'] },
      },
      include: {
        booking: {
          include: {
            parent: {
              select: {
                id: true,
                email: true,
                profile: { select: { firstName: true, lastName: true } },
              },
            },
            caregiverUser: {
              select: {
                id: true,
                profile: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });

    console.log(`[ExtensionReminders] Found ${unpaidExtensions.length} unpaid extensions`);

    const now = new Date();

    for (const ext of unpaidExtensions) {
      try {
        const ageMs = now.getTime() - new Date(ext.createdAt).getTime();
        const ageHours = ageMs / (1000 * 60 * 60);

        const parentName = [
          ext.booking.parent.profile?.firstName,
          ext.booking.parent.profile?.lastName,
        ]
          .filter(Boolean)
          .join(' ') || 'Parent';

        const caregiverName = [
          ext.booking.caregiverUser.profile?.firstName,
          ext.booking.caregiverUser.profile?.lastName,
        ]
          .filter(Boolean)
          .join(' ') || 'your caregiver';

        const amountFormatted = `$${(ext.extensionAmount / 100).toFixed(2)}`;

        // -----------------------------------------------------------------
        // 3a. Auto-cancel extensions older than 14 days
        // -----------------------------------------------------------------
        if (ageHours >= AUTO_CANCEL_HOURS) {
          await db.bookingExtension.update({
            where: { id: ext.id },
            data: { status: 'CANCELLED' },
          });

          // Notify parent
          await db.notification.create({
            data: {
              userId: ext.booking.parentId,
              type: 'BOOKING_UPDATE',
              title: 'Extension Cancelled \u2014 Payment Not Received',
              message: `The ${ext.extensionMinutes}-minute extension (${amountFormatted}) for your booking with ${caregiverName} has been automatically cancelled after 14 days without payment.`,
              resourceType: 'booking_extension',
              resourceId: ext.id,
            },
          });

          // Notify caregiver
          await db.notification.create({
            data: {
              userId: ext.booking.caregiverId,
              type: 'BOOKING_UPDATE',
              title: 'Extension Cancelled',
              message: `The ${ext.extensionMinutes}-minute extension request has been cancelled due to non-payment after 14 days.`,
              resourceType: 'booking_extension',
              resourceId: ext.id,
            },
          });

          results.extensionsCancelled++;
          console.log(`[ExtensionReminders] Auto-cancelled extension ${ext.id} (${Math.round(ageHours)}h old)`);
          continue;
        }

        // -----------------------------------------------------------------
        // 3b. Determine which reminder threshold to send
        // -----------------------------------------------------------------
        const currentReminderCount = ext.reminderCount ?? 0;

        // Find the next threshold that hasn't been sent yet
        const nextThreshold = REMINDER_THRESHOLDS[currentReminderCount];

        // Skip if all reminders already sent, or not old enough for the next one
        if (!nextThreshold || ageHours < nextThreshold.hours) {
          continue;
        }

        // -----------------------------------------------------------------
        // 3c. Send reminder notification to parent
        // -----------------------------------------------------------------
        const isUrgent = currentReminderCount >= 2; // 3rd reminder = urgent

        await db.notification.create({
          data: {
            userId: ext.booking.parentId,
            type: 'PAYMENT_FAILED',
            title: isUrgent
              ? 'Urgent: Extension Payment Overdue'
              : 'Reminder: Extension Payment Required',
            message: isUrgent
              ? `Your ${ext.extensionMinutes}-minute extension (${amountFormatted}) with ${caregiverName} is overdue. Please visit your dashboard to complete payment immediately to avoid cancellation.`
              : `Reminder: Your ${ext.extensionMinutes}-minute extension (${amountFormatted}) with ${caregiverName} is awaiting payment. Please visit your dashboard to complete payment.`,
            resourceType: 'booking_extension',
            resourceId: ext.id,
          },
        });

        // Update reminder tracking
        await db.bookingExtension.update({
          where: { id: ext.id },
          data: {
            lastReminderSentAt: now,
            reminderCount: currentReminderCount + 1,
          },
        });

        results.remindersSent++;
        console.log(
          `[ExtensionReminders] Sent reminder #${currentReminderCount + 1} (${nextThreshold.label}) for extension ${ext.id} to parent ${ext.booking.parentId}`
        );

        // -----------------------------------------------------------------
        // 3d. After the 3rd reminder, alert admins
        // -----------------------------------------------------------------
        if (currentReminderCount + 1 >= REMINDER_THRESHOLDS.length) {
          // Find admin users to notify
          const admins = await db.user.findMany({
            where: { userType: 'ADMIN', isActive: true },
            select: { id: true },
          });

          for (const admin of admins) {
            await db.notification.create({
              data: {
                userId: admin.id,
                type: 'PAYMENT_FAILED',
                title: 'Overdue Extension Payment \u2014 Admin Action Required',
                message: `Extension ${ext.id} (${amountFormatted}, ${ext.extensionMinutes} min) for parent ${parentName} has been unpaid for over ${nextThreshold.label}. All automated reminders exhausted. Manual follow-up required.`,
                resourceType: 'booking_extension',
                resourceId: ext.id,
              },
            });
          }

          results.adminAlerts += admins.length;
          console.log(
            `[ExtensionReminders] Alerted ${admins.length} admin(s) about overdue extension ${ext.id}`
          );
        }
      } catch (extError) {
        results.errors++;
        console.error(
          `[ExtensionReminders] Error processing extension ${ext.id}:`,
          extError instanceof Error ? extError.message : String(extError)
        );
        // Continue processing other extensions
      }
    }

    console.log('[ExtensionReminders] Cron job completed:', results);

    return apiSuccess({
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ExtensionReminders] Cron job error:', error);
    return ApiErrors.internal('Extension reminders cron job failed');
  }
}
