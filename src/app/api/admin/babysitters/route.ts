import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { db } from '@/lib/db';

// GET - List all babysitters for admin review
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { userType: true }
    });

    if (user?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

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
        _count: {
          select: {
            bookings: true,
            reviews: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
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
    return NextResponse.json(
      { error: 'Failed to get babysitters' },
      { status: 500 }
    );
  }
}
