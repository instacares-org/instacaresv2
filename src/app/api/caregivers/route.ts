import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiCache, cacheKeys, cacheTTL } from '@/lib/cache';

// GET /api/caregivers - Search and list caregivers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract search parameters
    const latitude = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : undefined;
    const longitude = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : undefined;
    const radius = searchParams.get('radius') ? parseFloat(searchParams.get('radius')!) : 50; // Default 50km radius
    const serviceType = searchParams.get('serviceType') || undefined;
    const minRate = searchParams.get('minRate') ? parseFloat(searchParams.get('minRate')!) : undefined;
    const maxRate = searchParams.get('maxRate') ? parseFloat(searchParams.get('maxRate')!) : undefined;
    const minRating = searchParams.get('minRating') ? parseFloat(searchParams.get('minRating')!) : undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    // Debug logging
    console.log(`\n🔍 API Request - Radius: ${radius}km, Location: ${latitude}, ${longitude}`);
    console.log(`📋 Parameters:`, { latitude, longitude, radius, limit, offset });

    // Generate cache key for this search
    const searchQuery = {
      latitude,
      longitude,
      radius,
      serviceType,
      minRate,
      maxRate,
      minRating,
      limit,
      offset,
    };
    const cacheKey = cacheKeys.caregivers(searchQuery);
    
    // Try to get from cache first
    let caregivers = apiCache.get(cacheKey);
    
    if (!caregivers) {
      console.log(`💾 Cache miss for key: ${cacheKey}`);
      
      // Fetch from real database
      caregivers = await db.caregiver.findMany({
        where: {
          isVerified: true,
          ...(minRate || maxRate ? {
            hourlyRate: {
              ...(minRate ? { gte: minRate } : {}),
              ...(maxRate ? { lte: maxRate } : {}),
            }
          } : {}),
          ...(minRating ? {
            averageRating: { gte: minRating }
          } : {}),
        },
        include: {
          user: {
            include: {
              profile: true
            }
          },
          services: true,
          photos: true
        },
        take: limit,
        skip: offset,
        orderBy: {
          averageRating: 'desc'
        }
      });
      
      console.log(`🗄️ Database returned ${caregivers?.length || 0} caregivers`);
      
      // Cache the results for 5 minutes
      apiCache.set(cacheKey, caregivers, cacheTTL.caregivers);
    } else {
      console.log(`🎯 Cache hit for key: ${cacheKey} - ${caregivers?.length || 0} caregivers`);
    }

    // Transform data for frontend (handle both database and fallback formats)
    const formattedCaregivers = caregivers.map(caregiver => {
      // Check if this is fallback data (already formatted) or database data
      if ('user' in caregiver) {
        // Database format
        return {
          id: caregiver.userId, // Use USER ID for bookings, not caregiver record ID
          caregiverId: caregiver.id, // Keep caregiver record ID for reference
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
          totalBookings: caregiver.totalBookings,
          averageRating: caregiver.averageRating,
          image: `/caregivers/${caregiver.userId}.jpg`, // Use userId for image filename
          profilePhoto: caregiver.user.profile?.avatar || caregiver.photos?.find(photo => photo.isProfile)?.url,
          address: {
            street: caregiver.user.profile?.streetAddress,
            city: caregiver.user.profile?.city,
            province: caregiver.user.profile?.state, // Map state to province for Canadian terminology
            postalCode: caregiver.user.profile?.zipCode, // Map zipCode to postalCode for Canadian terminology
            latitude: caregiver.user.profile?.latitude,
            longitude: caregiver.user.profile?.longitude,
          },
          distance: caregiver.distance, // Include distance from location-based query
          services: caregiver.services?.map(service => ({
            type: service.serviceType,
            rate: service.rate || caregiver.hourlyRate,
            description: service.description,
          })) || [],
          lastActiveAt: caregiver.lastActiveAt,
          createdAt: caregiver.createdAt,
        };
      } else {
        // Fallback format (already correctly formatted)
        return caregiver;
      }
    });

    return NextResponse.json({
      success: true,
      data: formattedCaregivers,
      pagination: {
        limit,
        offset,
        total: formattedCaregivers.length,
        hasMore: formattedCaregivers.length === limit,
      },
    });

  } catch (error) {
    console.error('Error fetching caregivers:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch caregivers',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// POST /api/caregivers - Create new caregiver (for registration)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      userId,
      hourlyRate,
      experienceYears,
      bio,
      languages,
      maxChildren,
      minAge,
      maxAge,
      services,
    } = body;

    // Validate required fields
    if (!userId || !hourlyRate) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          required: ['userId', 'hourlyRate'],
        },
        { status: 400 }
      );
    }

    // Create caregiver profile
    const caregiver = await db.caregiver.create({
      data: {
        userId,
        hourlyRate,
        experienceYears: experienceYears || 0,
        bio,
        languages: languages || [],
        maxChildren: maxChildren || 5,
        minAge: minAge || 0,
        maxAge: maxAge || 18,
        isVerified: false, // Start as unverified
        backgroundCheck: false,
        totalBookings: 0,
        averageRating: 0,
      },
      include: {
        user: {
          include: {
            profile: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        id: caregiver.id,
        userId: caregiver.userId,
        hourlyRate: caregiver.hourlyRate,
        experienceYears: caregiver.experienceYears,
        bio: caregiver.bio,
        services: caregiver.services,
        createdAt: caregiver.createdAt,
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating caregiver:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create caregiver profile',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}