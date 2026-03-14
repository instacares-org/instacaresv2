import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: {
        profile: true,
        caregiver: {
          include: {
            certifications: true,
            services: true,
            photos: true,
          }
        }
      }
    });

    if (!user || (!user.isCaregiver && user.userType !== 'CAREGIVER')) {
      return ApiErrors.forbidden('Not a caregiver account');
    }

    const completedItems: string[] = [];
    const missingItems: string[] = [];

    if (user.profile) {
      completedItems.push('Basic profile information');
    } else {
      missingItems.push('Complete basic profile information');
    }

    if (user.caregiver) {
      if (user.caregiver.bio && user.caregiver.bio.length >= 50) {
        completedItems.push('Bio/Introduction');
      } else {
        missingItems.push('Add a detailed bio (minimum 50 characters)');
      }

      if (user.caregiver.hourlyRate > 0) {
        completedItems.push('Hourly rate');
      } else {
        missingItems.push('Set your hourly rate');
      }

      if (user.caregiver.experienceYears > 0) {
        completedItems.push('Years of experience');
      } else {
        missingItems.push('Add years of experience');
      }

      if (user.caregiver.photos && user.caregiver.photos.length > 0) {
        completedItems.push(`Profile photos (${user.caregiver.photos.length})`);
      } else {
        missingItems.push('Upload at least one profile photo');
      }

      if (user.caregiver.services && user.caregiver.services.length > 0) {
        completedItems.push(`Services offered (${user.caregiver.services.length})`);
      } else {
        missingItems.push('Add services you offer');
      }

      if (user.caregiver.certifications && user.caregiver.certifications.length > 0) {
        completedItems.push(`Certifications (${user.caregiver.certifications.length})`);
      }

      const hasAvailability = await db.availabilitySlot.count({
        where: {
          caregiverId: user.caregiver.id,
          date: { gte: new Date() }
        }
      });

      if (hasAvailability > 0) {
        completedItems.push('Availability schedule set');
      } else {
        missingItems.push('Set your availability schedule');
      }
    } else {
      missingItems.push('Complete caregiver profile setup');
    }

    const totalItems = completedItems.length + missingItems.length;
    const completionPercentage = totalItems > 0 
      ? Math.round((completedItems.length / totalItems) * 100) 
      : 0;

    const isComplete = missingItems.length === 0 && completionPercentage >= 80;

    return apiSuccess({
      isComplete,
      approvalStatus: user.approvalStatus,
      completionPercentage,
      completedItems,
      missingItems
    });

  } catch (error) {
    console.error('Error checking profile completion:', error);
    return ApiErrors.internal('Failed to check profile completion');
  }
}
