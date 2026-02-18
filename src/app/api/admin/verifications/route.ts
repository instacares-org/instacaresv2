import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { withAuth } from '@/lib/auth-middleware';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
  try {
    const authResult = await withAuth(request, 'ADMIN', true);
    if (!authResult.isAuthorized) return authResult.response;
    
    const body = await request.json();
    const { caregiverId, verificationType, status, notes } = body;
    
    if (!caregiverId || !verificationType || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    const updateData: any = { updatedAt: new Date() };
    
    switch (verificationType) {
      case 'id':
        updateData.idVerificationStatus = status;
        if (status === 'APPROVED') updateData.idVerifiedAt = new Date();
        if (status === 'APPROVED') updateData.idVerifiedBy = authResult.user?.id;
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
        return NextResponse.json({ error: 'Invalid verification type' }, { status: 400 });
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
      adminId: authResult.user?.id,
      caregiverId,
      verificationType,
      status
    });
    
    return NextResponse.json({ success: true, verification });
  } catch (error) {
    logger.error('Failed to update verification', error);
    return NextResponse.json({ error: 'Failed to update verification' }, { status: 500 });
  }
}
