import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { db } from '@/lib/db';
import { logAuditEvent, AuditActions } from '@/lib/audit-log';

// GET /api/admin/settings - Get current platform settings
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const adminUser = await db.user.findUnique({
      where: { id: session.user.id }
    });

    if (!adminUser || adminUser.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

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

    return NextResponse.json({
      success: true,
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
    return NextResponse.json(
      { error: 'Failed to fetch platform settings' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/settings - Update platform settings
export async function PATCH(request: NextRequest) {
  try {
    // Verify admin authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const adminUser = await db.user.findUnique({
      where: { id: session.user.id }
    });

    if (!adminUser || adminUser.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      platformCommissionRate,
      minimumHourlyRate,
      autoApproveCaregivers,
      autoApproveParents,
      showCaregiverContactInfo
    } = body;

    // Validate commission rate
    if (platformCommissionRate !== undefined) {
      if (typeof platformCommissionRate !== 'number' || platformCommissionRate < 0 || platformCommissionRate > 100) {
        return NextResponse.json(
          { error: 'Platform commission rate must be between 0 and 100' },
          { status: 400 }
        );
      }
    }

    // Validate minimum hourly rate
    if (minimumHourlyRate !== undefined) {
      if (typeof minimumHourlyRate !== 'number' || minimumHourlyRate < 0) {
        return NextResponse.json(
          { error: 'Minimum hourly rate must be a positive number' },
          { status: 400 }
        );
      }
    }

    // Validate boolean fields
    if (autoApproveCaregivers !== undefined && typeof autoApproveCaregivers !== 'boolean') {
      return NextResponse.json(
        { error: 'autoApproveCaregivers must be a boolean' },
        { status: 400 }
      );
    }

    if (autoApproveParents !== undefined && typeof autoApproveParents !== 'boolean') {
      return NextResponse.json(
        { error: 'autoApproveParents must be a boolean' },
        { status: 400 }
      );
    }

    if (showCaregiverContactInfo !== undefined && typeof showCaregiverContactInfo !== 'boolean') {
      return NextResponse.json(
        { error: 'showCaregiverContactInfo must be a boolean' },
        { status: 400 }
      );
    }

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
          updatedBy: adminUser.id,
        }
      });
    } else {
      // Update existing settings
      const updateData: any = {
        updatedBy: adminUser.id,
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
      adminId: adminUser.id,
      adminEmail: adminUser.email,
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

    return NextResponse.json({
      success: true,
      message: 'Platform settings updated successfully',
      settings: {
        platformCommissionRate: settings.platformCommissionRate,
        minimumHourlyRate: settings.minimumHourlyRate,
        autoApproveCaregivers: settings.autoApproveCaregivers,
        autoApproveParents: settings.autoApproveParents,
        showCaregiverContactInfo: settings.showCaregiverContactInfo ?? false,
      }
    });

  } catch (error) {
    console.error('Error updating platform settings:', error);
    return NextResponse.json(
      { error: 'Failed to update platform settings' },
      { status: 500 }
    );
  }
}
