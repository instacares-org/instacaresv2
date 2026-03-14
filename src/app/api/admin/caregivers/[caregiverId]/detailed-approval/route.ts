import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/adminAuth';
import { logger, getClientInfo } from '@/lib/logger';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caregiverId: string }> }
) {
  const clientInfo = getClientInfo(request);
  try {
    const permCheck = await requirePermission(request, 'canApproveUsers');
    if (!permCheck.authorized) return permCheck.response!;

    const { caregiverId } = await params;
    const caregiver = await prisma.caregiver.findUnique({
      where: { id: caregiverId },
      include: {
        user: {
          include: {
            profile: true,
            emergencyContacts: true,
            receivedReviews: { take: 10, orderBy: { createdAt: 'desc' } },
            _count: { select: { receivedReviews: true } }
          }
        },
        certifications: true,
        photos: true,
        availabilitySlots: true
      }
    });

    if (!caregiver) {
      return ApiErrors.notFound('Caregiver not found');
    }

    const verification = await prisma.caregiverVerification.findUnique({
      where: { caregiverId }
    });

    const profile = caregiver.user.profile;
    const checklist = {
      profileComplete: !!(profile?.firstName && profile?.lastName && profile?.phone && profile?.streetAddress && caregiver.bio),
      profilePhotoUploaded: !!profile?.avatar,
      addressVerified: !!(profile?.latitude && profile?.longitude && profile?.country === 'CA'),
      idVerified: verification?.idVerificationStatus === 'APPROVED',
      backgroundCheckPassed: verification?.backgroundCheckStatus === 'APPROVED',
      insuranceValid: verification?.insuranceStatus === 'APPROVED',
      referencesVerified: verification?.referencesStatus === 'APPROVED',
      hasCertifications: caregiver.certifications.length > 0,
      certificationsVerified: caregiver.certifications.every((cert: any) => cert.isVerified),
      hasEmergencyContact: caregiver.user.emergencyContacts.length > 0,
      stripeOnboarded: caregiver.stripeOnboarded
    };

    let riskScore = 0;
    if (!checklist.profileComplete) riskScore += 15;
    if (!checklist.idVerified) riskScore += 25;
    if (!checklist.backgroundCheckPassed) riskScore += 30;
    if (!checklist.insuranceValid) riskScore += 10;
    if (!checklist.referencesVerified) riskScore += 10;
    if (!checklist.addressVerified) riskScore += 5;

    const riskLevel = riskScore <= 20 ? 'LOW' : riskScore <= 50 ? 'MEDIUM' : 'HIGH';
    const readyForApproval = checklist.profileComplete && checklist.idVerified && checklist.backgroundCheckPassed && riskScore <= 30;

    return apiSuccess({
      caregiver,
      user: caregiver.user,
      profile,
      certifications: caregiver.certifications,
      photos: caregiver.photos,
      emergencyContacts: caregiver.user.emergencyContacts,
      availabilitySlots: caregiver.availabilitySlots,
      reviews: caregiver.user.receivedReviews,
      verification: verification || {
        idVerificationStatus: 'PENDING',
        backgroundCheckStatus: 'PENDING',
        insuranceStatus: 'PENDING',
        referencesStatus: 'PENDING'
      },
      approvalData: {
        checklist,
        riskScore,
        riskLevel,
        readyForApproval,
        missingItems: Object.entries(checklist).filter(([k, v]) => !v).map(([k]) => k)
      }
    });
  } catch (error) {
    logger.error('Failed to fetch detailed caregiver data', error);
    return ApiErrors.internal('Failed to fetch caregiver data');
  }
}
