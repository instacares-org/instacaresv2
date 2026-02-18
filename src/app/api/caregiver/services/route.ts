import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { withAuth } from '@/lib/auth-middleware';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET - Fetch caregiver's services
export async function GET(request: NextRequest) {
  try {
    const authResult = await withAuth(request, 'CAREGIVER', false);
    if (!authResult.isAuthorized || !authResult.user) {
      return authResult.response;
    }

    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: authResult.user.id },
      include: { services: true }
    });

    if (!caregiver) {
      return NextResponse.json({ error: 'Caregiver not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      services: caregiver.services
    });
  } catch (error) {
    logger.error('Failed to fetch caregiver services', error);
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 });
  }
}

// POST - Save caregiver's services
export async function POST(request: NextRequest) {
  try {
    const authResult = await withAuth(request, 'CAREGIVER', false);
    if (!authResult.isAuthorized || !authResult.user) {
      return authResult.response;
    }

    const body = await request.json();
    const { caregiverId, services } = body;

    if (!caregiverId || !Array.isArray(services)) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    // Verify ownership
    const caregiver = await prisma.caregiver.findUnique({
      where: { id: caregiverId },
      select: { userId: true }
    });

    if (!caregiver || caregiver.userId !== authResult.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Valid service types
    const validServiceTypes = [
      'BABYSITTING',
      'NANNY',
      'DAYCARE',
      'AFTER_SCHOOL',
      'OVERNIGHT',
      'SPECIAL_NEEDS',
      'TUTORING'
    ];

    // Filter to only valid service types
    const validServices = services.filter((s: string) => validServiceTypes.includes(s));

    // Delete existing services for this caregiver
    await prisma.caregiverService.deleteMany({
      where: { caregiverId }
    });

    // Create new services
    if (validServices.length > 0) {
      await prisma.caregiverService.createMany({
        data: validServices.map((serviceType: string) => ({
          caregiverId,
          serviceType: serviceType as any,
          isOffered: true
        }))
      });
    }

    // Fetch updated services
    const updatedServices = await prisma.caregiverService.findMany({
      where: { caregiverId }
    });

    logger.info('Caregiver services updated', {
      caregiverId,
      serviceCount: validServices.length
    });

    return NextResponse.json({
      success: true,
      services: updatedServices
    });
  } catch (error) {
    logger.error('Failed to save caregiver services', error);
    return NextResponse.json({ error: 'Failed to save services' }, { status: 500 });
  }
}
