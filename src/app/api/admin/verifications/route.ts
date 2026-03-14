import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/adminAuth';
import { logger } from '@/lib/logger';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
  try {
    const permCheck = await requirePermission(request, 'canApproveUsers');
    if (!permCheck.authorized) return permCheck.response!;
    
    const body = await request.json();
    const { caregiverId, verificationType, status, notes } = body;
    
    if (!caregiverId || !verificationType || !status) {
      return ApiErrors.badRequest('Missing required fields');
    }
    
    const updateData: any = { updatedAt: new Date() };
    
    switch (verificationType) {
      case 'id':
        updateData.idVerificationStatus = status;
        if (status === 'APPROVED') updateData.idVerifiedAt = new Date();
        if (status === 'APPROVED') updateData.idVerifiedBy = permCheck.user!.id;
        break;
      case 'backgroundCheck':
        updateData.backgroundCheckStatus = status;
        if (status === 'APPROVED') updateData.backgroundCheckDate = new Date();
        break;
      case 'insurance':
        updateData.insuranceStatus = status;
        break;
      case 'references':
        updateData.referencesStatus = status;
        break;
      default:
        return ApiErrors.badRequest('Invalid verification type');
    }
    
    const verification = await prisma.caregiverVerification.upsert({
      where: { caregiverId },
      update: updateData,
      create: {
        caregiverId,
        ...updateData
      }
    });
    
    logger.info('Admin updated verification status', {
      adminId: permCheck.user!.id,
      caregiverId,
      verificationType,
      status
    });
    
    return apiSuccess({ verification });
  } catch (error) {
    logger.error('Failed to update verification', error);
    return ApiErrors.internal('Failed to update verification');
  }
}
