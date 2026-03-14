import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/auth-middleware';
import { logger } from '@/lib/logger';

const validServiceTypes = [
  'BABYSITTING',
  'NANNY',
  'DAYCARE',
  'AFTER_SCHOOL',
  'OVERNIGHT',
  'SPECIAL_NEEDS',
  'TUTORING',
] as const;

const saveServicesSchema = z.object({
  caregiverId: z.string().min(1, 'Caregiver ID is required'),
  services: z.array(z.enum(validServiceTypes)).min(0),
});

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
      return ApiErrors.notFound('Caregiver not found');
    }

    return apiSuccess({ services: caregiver.services });
  } catch (error) {
    logger.error('Failed to fetch caregiver services', error);
    return ApiErrors.internal('Failed to fetch services');
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
    const parsed = saveServicesSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid input', parsed.error.flatten().fieldErrors);
    }
    const { caregiverId, services } = parsed.data;

    // Verify ownership
    const caregiver = await prisma.caregiver.findUnique({
      where: { id: caregiverId },
      select: { userId: true }
    });

    if (!caregiver || caregiver.userId !== authResult.user.id) {
      return ApiErrors.forbidden('Unauthorized');
    }

    // Services are already validated by Zod enum
    const validServices = services;

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

    return apiSuccess({ services: updatedServices });
  } catch (error) {
    logger.error('Failed to save caregiver services', error);
    return ApiErrors.internal('Failed to save services');
  }
}
