import { NextRequest } from 'next/server';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';
import { requirePermission } from '@/lib/adminAuth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const permCheck = await requirePermission(request, 'canApproveUsers');
    if (!permCheck.authorized) return permCheck.response!;

    const caregivers = await prisma.caregiver.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiSuccess({ caregivers });
  } catch (error) {
    console.error('Error fetching caregivers:', error);
    return ApiErrors.internal('Failed to fetch caregivers');
  }
}
