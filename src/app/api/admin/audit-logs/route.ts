import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/adminAuth';
import { purgeOldAuditLogs, logAuditEvent, AuditActions } from '@/lib/audit-log';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const permCheck = await requirePermission(request, 'canViewAuditLogs');
    if (!permCheck.authorized) return permCheck.response!;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || '';
    const resource = searchParams.get('resource') || '';
    const adminId = searchParams.get('adminId') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = {};

    if (action) {
      where.action = action;
    }
    if (resource) {
      where.resource = resource;
    }
    if (adminId) {
      where.adminId = adminId;
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.auditLog.count({ where }),
    ]);

    return apiSuccess({
      logs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return ApiErrors.internal('Failed to fetch audit logs');
  }
}

// DELETE - Purge old audit logs (retention policy)
export async function DELETE(request: NextRequest) {
  try {
    const permCheck = await requirePermission(request, 'canViewAuditLogs');
    if (!permCheck.authorized) return permCheck.response!;

    const { searchParams } = new URL(request.url);
    const retentionDays = Math.max(90, parseInt(searchParams.get('retentionDays') || '365'));

    const purgedCount = await purgeOldAuditLogs(retentionDays);

    logAuditEvent({
      adminId: permCheck.user!.id,
      adminEmail: permCheck.user!.email,
      action: 'AUDIT_LOGS_PURGED',
      resource: 'auditLog',
      details: { retentionDays, purgedCount },
      request,
    });

    return apiSuccess({
      purgedCount,
    }, `Purged ${purgedCount} audit log entries older than ${retentionDays} days`);
  } catch (error) {
    console.error('Error purging audit logs:', error);
    return ApiErrors.internal('Failed to purge audit logs');
  }
}
