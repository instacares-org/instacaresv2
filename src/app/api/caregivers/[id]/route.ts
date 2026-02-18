import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { logger, getClientInfo } from '@/lib/logger';
import { smartCaregiverOperations } from '@/lib/db-fallback';

interface Params {
  id: string;
}

// GET /api/caregivers/[id] - Get caregiver details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const { id } = await params;

    const caregiver = await smartCaregiverOperations.findCaregiverById(id);

    if (!caregiver) {
      return NextResponse.json(
        {
          success: false,
          error: 'Caregiver not found',
        },
        { status: 404 }
      );
    }

    // Format caregiver data for frontend (handle both database and fallback formats)
    let formattedCaregiver;
    
    if ('user' in caregiver && caregiver.user) {
      // Database format
      formattedCaregiver = {
        id: caregiver.id,
        userId: caregiver.userId,
        name: `${caregiver.user.profile?.firstName} ${caregiver.user.profile?.lastName}`,
        // PII (email, phone, street, earnings, stripe) omitted from public endpoint
        hourlyRate: caregiver.hourlyRate,
        experienceYears: caregiver.experienceYears,
        bio: caregiver.bio,
        languages: caregiver.languages as string[] || [],
        ageGroups: caregiver.ageGroups || [],
        specialties: caregiver.specialties || [],
        maxChildren: caregiver.maxChildren,
        minAge: caregiver.minAge,
        maxAge: caregiver.maxAge,
        isVerified: caregiver.isVerified,
        backgroundCheck: caregiver.backgroundCheck,
        canReceivePayments: caregiver.canReceivePayments,
        totalBookings: caregiver.totalBookings,
        averageRating: caregiver.averageRating,
        isAvailable: caregiver.isAvailable,
        lastActiveAt: caregiver.lastActiveAt,
        address: {
          city: caregiver.user.profile?.city,
          province: caregiver.user.profile?.state,
          latitude: caregiver.user.profile?.latitude,
          longitude: caregiver.user.profile?.longitude,
        },
        services: caregiver.services?.map(service => ({
          id: service.id,
          type: service.serviceType,
          rate: service.rate || caregiver.hourlyRate,
          description: service.description,
          isOffered: service.isOffered,
        })) || [],
        certifications: caregiver.certifications?.map(cert => ({
          id: cert.id,
          type: cert.type,
          title: cert.title,
          issuingBody: cert.issuingBody,
          issueDate: cert.issueDate,
          expirationDate: cert.expirationDate,
          isVerified: cert.isVerified,
          certificateUrl: cert.certificateUrl,
        })) || [],
        photos: caregiver.photos?.map(photo => ({
          id: photo.id,
          url: photo.url,
          caption: photo.caption,
          isProfile: photo.isProfile,
          sortOrder: photo.sortOrder,
        })) || [],
        bookings: caregiver.caregiverBookings?.map(booking => {
          const review = booking.reviews;
          return {
            id: booking.id,
            parentName: `${booking.parent.profile?.firstName} ${booking.parent.profile?.lastName}`,
            startTime: booking.startTime,
            endTime: booking.endTime,
            status: booking.status,
            totalAmount: booking.totalAmount,
            review: review ? {
              rating: review.rating,
              comment: review.comment,
              createdAt: review.createdAt,
            } : null,
          };
        }) || [],
        createdAt: caregiver.createdAt,
        updatedAt: caregiver.updatedAt,
      };
    } else {
      // Fallback format - strip PII, only expose safe fields
      formattedCaregiver = {
        id: (caregiver as any).id,
        name: (caregiver as any).name,
        hourlyRate: (caregiver as any).hourlyRate,
        experienceYears: (caregiver as any).experienceYears,
        bio: (caregiver as any).bio,
        languages: (caregiver as any).languages || [],
        ageGroups: (caregiver as any).ageGroups || [],
        specialties: (caregiver as any).specialties || [],
        maxChildren: (caregiver as any).maxChildren,
        minAge: (caregiver as any).minAge,
        maxAge: (caregiver as any).maxAge,
        isVerified: (caregiver as any).isVerified,
        backgroundCheck: (caregiver as any).backgroundCheck,
        canReceivePayments: false,
        totalBookings: (caregiver as any).totalBookings || 0,
        averageRating: (caregiver as any).averageRating || 0,
        isAvailable: true,
        address: {
          city: (caregiver as any).address?.city,
          province: (caregiver as any).address?.province,
          latitude: (caregiver as any).address?.latitude,
          longitude: (caregiver as any).address?.longitude,
        },
        services: (caregiver as any).services || [],
        certifications: [],
        photos: [],
        bookings: [],
        createdAt: (caregiver as any).createdAt,
        updatedAt: (caregiver as any).createdAt,
      };
    }

    return NextResponse.json({
      success: true,
      caregiver: formattedCaregiver,  // Changed from 'data' to 'caregiver' to match dashboard expectation
    });

  } catch (error) {
    console.error('Error fetching caregiver:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch caregiver',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// PUT /api/caregivers/[id] - Update caregiver profile
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    // Authenticate but allow PENDING users to update their profile
    const authResult = await withAuth(request, 'ANY', false);
    if (!authResult.isAuthorized) {
      const clientInfo = getClientInfo(request);
      logger.security('Unauthorized caregiver update attempt', {
        endpoint: '/api/caregivers/[id]',
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent
      });
      return authResult.response;
    }

    const user = authResult.user;
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    const { id } = await params;
    const body = await request.json();

    // Check if caregiver exists and verify ownership
    const existingCaregiver = await smartCaregiverOperations.findCaregiverById(id);
    if (!existingCaregiver) {
      return NextResponse.json(
        {
          success: false,
          error: 'Caregiver not found',
        },
        { status: 404 }
      );
    }

    // Verify ownership - user can only update their own caregiver profile
    const caregiverUserId = 'user' in existingCaregiver ? existingCaregiver.userId : existingCaregiver.id;
    if (caregiverUserId !== user.id && user.userType !== 'ADMIN') {
      logger.security('Unauthorized caregiver profile modification attempt', {
        userId: user.id,
        targetCaregiverId: id,
        targetUserId: caregiverUserId
      });
      return NextResponse.json(
        { success: false, error: 'You can only update your own profile' },
        { status: 403 }
      );
    }

    // Update caregiver using Prisma directly
    const { db } = await import('@/lib/db');

    // Whitelist: only allow safe profile fields from user requests
    const updateData: Record<string, unknown> = {};
    const ALLOWED_FIELDS = [
      'hourlyRate', 'experienceYears', 'bio', 'languages',
      'maxChildren', 'minAge', 'maxAge', 'isAvailable',
      'ageGroups', 'specialties',
    ] as const;
    for (const field of ALLOWED_FIELDS) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    const updatedCaregiver = await db.caregiver.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        services: true,
        certifications: true,
        photos: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedCaregiver,
      message: 'Caregiver profile updated successfully',
    });

  } catch (error) {
    console.error('Error updating caregiver:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update caregiver',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// PATCH /api/caregivers/[id] - Update caregiver profile (partial update)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    // Authenticate but allow PENDING users to update their profile
    const authResult = await withAuth(request, 'ANY', false);
    if (!authResult.isAuthorized) {
      const clientInfo = getClientInfo(request);
      logger.security('Unauthorized caregiver patch attempt', {
        endpoint: '/api/caregivers/[id]',
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent
      });
      return authResult.response;
    }

    const user = authResult.user;
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    const { id } = await params;
    const body = await request.json();

    // Check if caregiver exists and verify ownership
    const existingCaregiver = await smartCaregiverOperations.findCaregiverById(id);
    if (!existingCaregiver) {
      return NextResponse.json(
        {
          success: false,
          error: 'Caregiver not found',
        },
        { status: 404 }
      );
    }

    // Verify ownership
    const caregiverUserId = 'user' in existingCaregiver ? existingCaregiver.userId : existingCaregiver.id;
    if (caregiverUserId !== user.id && user.userType !== 'ADMIN') {
      logger.security('Unauthorized caregiver profile modification attempt', {
        userId: user.id,
        targetCaregiverId: id,
        targetUserId: caregiverUserId
      });
      return NextResponse.json(
        { success: false, error: 'You can only update your own profile' },
        { status: 403 }
      );
    }

    // Update caregiver using Prisma directly
    const { db } = await import('@/lib/db');

    // Whitelist: only allow safe profile fields from user requests
    const updateData: Record<string, unknown> = {};
    const ALLOWED_FIELDS = [
      'hourlyRate', 'experienceYears', 'bio', 'languages',
      'maxChildren', 'minAge', 'maxAge', 'isAvailable',
      'ageGroups', 'specialties',
    ] as const;
    for (const field of ALLOWED_FIELDS) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    const updatedCaregiver = await db.caregiver.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        services: true,
        certifications: true,
        photos: true,
      },
    });

    return NextResponse.json({
      success: true,
      caregiver: updatedCaregiver,
      message: 'Caregiver profile updated successfully',
    });

  } catch (error) {
    console.error('Error updating caregiver (PATCH):', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update caregiver',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}