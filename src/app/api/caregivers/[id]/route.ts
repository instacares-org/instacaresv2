import { NextRequest, NextResponse } from 'next/server';
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
        email: caregiver.user.email,
        phone: caregiver.user.profile?.phone,
        hourlyRate: caregiver.hourlyRate,
        experienceYears: caregiver.experienceYears,
        bio: caregiver.bio,
        languages: caregiver.languages as string[] || [],
        maxChildren: caregiver.maxChildren,
        minAge: caregiver.minAge,
        maxAge: caregiver.maxAge,
        isVerified: caregiver.isVerified,
        backgroundCheck: caregiver.backgroundCheck,
        backgroundCheckDate: caregiver.backgroundCheckDate,
        stripeAccountId: caregiver.stripeAccountId,
        stripeOnboarded: caregiver.stripeOnboarded,
        canReceivePayments: caregiver.canReceivePayments,
        totalBookings: caregiver.totalBookings,
        averageRating: caregiver.averageRating,
        totalEarnings: caregiver.totalEarnings,
        isAvailable: caregiver.isAvailable,
        lastActiveAt: caregiver.lastActiveAt,
        address: {
          street: caregiver.user.profile?.streetAddress,
          city: caregiver.user.profile?.city,
          province: caregiver.user.profile?.state, // Map state to province for Canadian terminology
          postalCode: caregiver.user.profile?.zipCode, // Map zipCode to postalCode for Canadian terminology
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
        bookings: caregiver.bookings?.map(booking => ({
          id: booking.id,
          parentName: `${booking.parent.profile?.firstName} ${booking.parent.profile?.lastName}`,
          startTime: booking.startTime,
          endTime: booking.endTime,
          status: booking.status,
          totalAmount: booking.totalAmount,
          review: booking.reviews?.[0] ? {
            rating: booking.reviews[0].rating,
            comment: booking.reviews[0].comment,
            createdAt: booking.reviews[0].createdAt,
          } : null,
        })) || [],
        createdAt: caregiver.createdAt,
        updatedAt: caregiver.updatedAt,
      };
    } else {
      // Fallback format - already properly formatted
      formattedCaregiver = {
        ...caregiver,
        // Add missing fields for consistency
        backgroundCheckDate: null,
        stripeAccountId: null,
        stripeOnboarded: false,
        canReceivePayments: false,
        totalEarnings: 0,
        isAvailable: true,
        certifications: [],
        photos: [],
        bookings: [],
        updatedAt: caregiver.createdAt,
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
    const { id } = await params;
    const body = await request.json();

    // First check if caregiver exists  
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

    // Update caregiver using Prisma directly (we'd add this to operations later)
    const { db } = await import('@/lib/db');
    
    const updatedCaregiver = await db.caregiver.update({
      where: { id },
      data: {
        hourlyRate: body.hourlyRate,
        experienceYears: body.experienceYears,
        bio: body.bio,
        languages: body.languages,
        maxChildren: body.maxChildren,
        minAge: body.minAge,
        maxAge: body.maxAge,
        isAvailable: body.isAvailable,
        ...(body.stripeAccountId && { stripeAccountId: body.stripeAccountId }),
        ...(body.stripeOnboarded !== undefined && { stripeOnboarded: body.stripeOnboarded }),
        ...(body.canReceivePayments !== undefined && { canReceivePayments: body.canReceivePayments }),
      },
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
    const { id } = await params;
    const body = await request.json();

    // First check if caregiver exists
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

    // Update caregiver using Prisma directly
    const { db } = await import('@/lib/db');
    
    // Build update data object only with provided fields
    const updateData: any = {};
    if (body.hourlyRate !== undefined) updateData.hourlyRate = body.hourlyRate;
    if (body.experienceYears !== undefined) updateData.experienceYears = body.experienceYears;
    if (body.bio !== undefined) updateData.bio = body.bio;
    if (body.languages !== undefined) updateData.languages = body.languages;
    if (body.maxChildren !== undefined) updateData.maxChildren = body.maxChildren;
    if (body.minAge !== undefined) updateData.minAge = body.minAge;
    if (body.maxAge !== undefined) updateData.maxAge = body.maxAge;
    if (body.isAvailable !== undefined) updateData.isAvailable = body.isAvailable;
    if (body.stripeAccountId !== undefined) updateData.stripeAccountId = body.stripeAccountId;
    if (body.stripeOnboarded !== undefined) updateData.stripeOnboarded = body.stripeOnboarded;
    if (body.canReceivePayments !== undefined) updateData.canReceivePayments = body.canReceivePayments;

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