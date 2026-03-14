import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/adminAuth';
import { logAuditEvent, AuditActions } from '@/lib/audit-log';
import { z } from 'zod';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

const settingsBodySchema = z.object({
  platformCommissionRate: z.number()
    .min(0, 'Platform commission rate must be at least 0')
    .max(100, 'Platform commission rate must be at most 100')
    .optional(),
  minimumHourlyRate: z.number()
    .min(0, 'Minimum hourly rate must be a positive number')
    .optional(),
  autoApproveCaregivers: z.boolean({ error: 'autoApproveCaregivers must be a boolean' }).optional(),
  autoApproveParents: z.boolean({ error: 'autoApproveParents must be a boolean' }).optional(),
  showCaregiverContactInfo: z.boolean({ error: 'showCaregiverContactInfo must be a boolean' }).optional(),
});

// GET /api/admin/settings - Get current platform settings
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication and permission
    const permCheck = await requirePermission(request, 'canManageSettings');
    if (!permCheck.authorized) return permCheck.response!;

    // Fetch or create default settings
    let settings = await db.platformSettings.findFirst();

    if (!settings) {
      // Create default settings if they don't exist
      settings = await db.platformSettings.create({
        data: {
          platformCommissionRate: 15,
          minimumHourlyRate: 15,
          autoApproveCaregivers: false,
          autoApproveParents: false,
          showCaregiverContactInfo: false,
        }
      });
    }

    return apiSuccess({
      settings: {
        platformCommissionRate: settings.platformCommissionRate,
        minimumHourlyRate: settings.minimumHourlyRate,
        autoApproveCaregivers: settings.autoApproveCaregivers,
        autoApproveParents: settings.autoApproveParents,
        showCaregiverContactInfo: settings.showCaregiverContactInfo ?? false,
      }
    });

  } catch (error) {
    console.error('Error fetching platform settings:', error);
    return ApiErrors.internal('Failed to fetch platform settings');
  }
}

// PATCH /api/admin/settings - Update platform settings
export async function PATCH(request: NextRequest) {
  try {
    // Verify admin authentication and permission
    const permCheck = await requirePermission(request, 'canManageSettings');
    if (!permCheck.authorized) return permCheck.response!;

    const body = await request.json();
    const parsed = settingsBodySchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid input', parsed.error.flatten().fieldErrors);
    }

    const {
      platformCommissionRate,
      minimumHourlyRate,
      autoApproveCaregivers,
      autoApproveParents,
      showCaregiverContactInfo
    } = parsed.data;

    // Check if settings exist
    let settings = await db.platformSettings.findFirst();

    if (!settings) {
      // Create new settings
      settings = await db.platformSettings.create({
        data: {
          platformCommissionRate: platformCommissionRate ?? 15,
          minimumHourlyRate: minimumHourlyRate ?? 15,
          autoApproveCaregivers: autoApproveCaregivers ?? false,
          autoApproveParents: autoApproveParents ?? false,
          showCaregiverContactInfo: showCaregiverContactInfo ?? false,
          updatedBy: permCheck.user!.id,
        }
      });
    } else {
      // Update existing settings
      const updateData: any = {
        updatedBy: permCheck.user!.id,
        updatedAt: new Date(),
      };

      if (platformCommissionRate !== undefined) {
        updateData.platformCommissionRate = platformCommissionRate;
      }
      if (minimumHourlyRate !== undefined) {
        updateData.minimumHourlyRate = minimumHourlyRate;
      }
      if (autoApproveCaregivers !== undefined) {
        updateData.autoApproveCaregivers = autoApproveCaregivers;
      }
      if (autoApproveParents !== undefined) {
        updateData.autoApproveParents = autoApproveParents;
      }
      if (showCaregiverContactInfo !== undefined) {
        updateData.showCaregiverContactInfo = showCaregiverContactInfo;
      }

      settings = await db.platformSettings.update({
        where: { id: settings.id },
        data: updateData
      });
    }

    // Persistent audit log
    logAuditEvent({
      adminId: permCheck.user!.id,
      adminEmail: permCheck.user!.email,
      action: AuditActions.SETTINGS_UPDATED,
      resource: 'settings',
      resourceId: settings.id,
      details: {
        platformCommissionRate: settings.platformCommissionRate,
        minimumHourlyRate: settings.minimumHourlyRate,
        autoApproveCaregivers: settings.autoApproveCaregivers,
        autoApproveParents: settings.autoApproveParents,
        showCaregiverContactInfo: settings.showCaregiverContactInfo,
      },
      request,
    });

    return apiSuccess({
      settings: {
        platformCommissionRate: settings.platformCommissionRate,
        minimumHourlyRate: settings.minimumHourlyRate,
        autoApproveCaregivers: settings.autoApproveCaregivers,
        autoApproveParents: settings.autoApproveParents,
        showCaregiverContactInfo: settings.showCaregiverContactInfo ?? false,
      }
    }, 'Platform settings updated successfully');

  } catch (error) {
    console.error('Error updating platform settings:', error);
    return ApiErrors.internal('Failed to update platform settings');
  }
}
