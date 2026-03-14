import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/adminAuth';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

// GET - List all babysitters for admin review
export async function GET(request: NextRequest) {
  try {
    const permCheck = await requirePermission(request, 'canApproveUsers');
    if (!permCheck.authorized) return permCheck.response!;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // Filter by status

    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }

    const babysitters = await db.babysitter.findMany({
      where,
      include: {
        user: {
          include: {
            profile: true
          }
        },
        references: true,
        availabilitySlots: {
          where: { isActive: true },
          orderBy: { dayOfWeek: 'asc' },
        },
        _count: {
          select: {
            bookings: true,
            reviews: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return apiSuccess({
      babysitters: babysitters.map(b => ({
        id: b.id,
        userId: b.userId,
        email: b.user.email,
        status: b.status,
        profile: {
          firstName: b.user.profile?.firstName,
          lastName: b.user.profile?.lastName,
          phone: b.user.profile?.phone,
          city: b.user.profile?.city,
          state: b.user.profile?.state,
          dateOfBirth: b.user.profile?.dateOfBirth,
        },
        bio: b.bio,
        experienceYears: b.experienceYears,
        experienceSummary: b.experienceSummary,
        hourlyRate: b.hourlyRate,
        // Document status
        documents: {
          governmentIdFront: !!b.governmentIdFront,
          governmentIdBack: !!b.governmentIdBack,
          policeCheck: !!b.policeCheck,
          selfieForMatch: !!b.selfieForMatch,
          cprCertificate: !!b.cprCertificate,
          eceCertificate: !!b.eceCertificate,
        },
        // Document URLs for review
        documentUrls: {
          governmentIdFront: b.governmentIdFront,
          governmentIdBack: b.governmentIdBack,
          policeCheck: b.policeCheck,
          selfieForMatch: b.selfieForMatch,
          cprCertificate: b.cprCertificate,
          eceCertificate: b.eceCertificate,
        },
        verification: {
          phone: b.phoneVerified,
          email: b.emailVerified,
        },
        references: b.references.map(ref => ({
          id: ref.id,
          name: ref.name,
          relationship: ref.relationship,
          contactMethod: ref.contactMethod,
          contactValue: ref.contactValue,
          isVerified: ref.isVerified,
        })),
        stripeOnboarded: b.stripeOnboarded,
        acceptsOnsitePayment: b.acceptsOnsitePayment,
        availability: b.availabilitySlots.map(slot => ({
          id: slot.id,
          recurrenceType: slot.recurrenceType,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          specificDate: slot.specificDate,
          dayOfMonth: slot.dayOfMonth,
          repeatInterval: slot.repeatInterval,
          isRecurring: slot.isRecurring,
        })),
        stats: {
          totalBookings: b._count.bookings,
          totalReviews: b._count.reviews,
          averageRating: b.averageRating,
          totalEarnings: b.totalEarnings / 100, // Convert to dollars
        },
        createdAt: b.createdAt,
        approvedAt: b.approvedAt,
      })),
      counts: {
        total: babysitters.length,
        pending: babysitters.filter(b => b.status === 'PENDING_VERIFICATION').length,
        documentsSubmitted: babysitters.filter(b => b.status === 'DOCUMENTS_SUBMITTED').length,
        approved: babysitters.filter(b => b.status === 'APPROVED').length,
        suspended: babysitters.filter(b => b.status === 'SUSPENDED').length,
        rejected: babysitters.filter(b => b.status === 'REJECTED').length,
      }
    });

  } catch (error) {
    console.error('Admin get babysitters error:', error);
    return ApiErrors.internal('Failed to get babysitters');
  }
}
