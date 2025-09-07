import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiCache, cacheKeys, cacheTTL } from '@/lib/cache';

// Helper function to calculate availability status
function calculateAvailabilityStatus(availabilitySlots: any[]) {
  if (!availabilitySlots || availabilitySlots.length === 0) {
    return "No Availability Posted Yet";
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  // Check for availability today
  const todaySlots = availabilitySlots.filter(slot => {
    const slotDate = new Date(slot.date);
    return slotDate.toDateString() === today.toDateString() && slot.availableSpots > 0;
  });

  if (todaySlots.length > 0) {
    return "Available today";
  }

  // Check for availability tomorrow
  const tomorrowSlots = availabilitySlots.filter(slot => {
    const slotDate = new Date(slot.date);
    return slotDate.toDateString() === tomorrow.toDateString() && slot.availableSpots > 0;
  });

  if (tomorrowSlots.length > 0) {
    return "Available tomorrow";
  }

  // Check for availability this week
  const thisWeekSlots = availabilitySlots.filter(slot => {
    const slotDate = new Date(slot.date);
    return slotDate >= today && slotDate < nextWeek && slot.availableSpots > 0;
  });

  if (thisWeekSlots.length > 0) {
    return "Available this week";
  }

  // Has future availability
  const futureSlots = availabilitySlots.filter(slot => {
    const slotDate = new Date(slot.date);
    return slotDate >= today && slot.availableSpots > 0;
  });

  if (futureSlots.length > 0) {
    const nextAvailableDate = new Date(Math.min(...futureSlots.map(slot => new Date(slot.date).getTime())));
    return `Next available: ${nextAvailableDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }

  return "No upcoming availability";
}

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
    const allowedCountries = searchParams.get('countries')?.split(',') || ['CA']; // Default to Canada only

    // Debug logging
    console.log(`\n🔍 API Request - Radius: ${radius}km, Location: ${latitude || 'none'}, ${longitude || 'none'}`);
    console.log(`📋 Parameters:`, { latitude, longitude, radius, limit, offset, allowedCountries });
    
    // When no location is provided, return all Canadian caregivers
    if (!latitude || !longitude) {
      console.log('🍁 No location provided - returning all Canadian caregivers');
    }

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
      allowedCountries,
    };
    const cacheKey = cacheKeys.caregivers(searchQuery);
    
    // Try to get from cache first
    let caregivers = apiCache.get(cacheKey);
    
    if (!caregivers) {
      console.log(`💾 Cache miss for key: ${cacheKey}`);
      
      // Fetch from real database
      // Use raw query to avoid emailVerified field issues
      const rawCaregivers = await db.$queryRaw`
        SELECT 
          c.*,
          u.id as user_id,
          u.email as user_email,
          up.firstName,
          up.lastName,
          up.phone,
          up.avatar,
          up.streetAddress,
          up.city,
          up.state,
          up.zipCode,
          up.country,
          up.latitude,
          up.longitude
        FROM caregivers c
        JOIN users u ON c.userId = u.id
        JOIN user_profiles up ON u.id = up.userId
        WHERE c.isVerified = 1
          AND u.isActive = 1
          AND u.approvalStatus = 'APPROVED'
          AND up.country = 'CA'
        ORDER BY c.averageRating DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
      
      // Transform raw results to match expected format
      caregivers = (rawCaregivers as any[]).map((raw) => ({
        id: raw.id,
        userId: raw.userId,
        hourlyRate: raw.hourlyRate,
        experienceYears: raw.experienceYears,
        bio: raw.bio,
        languages: (() => {
          if (!raw.languages) return [];
          const lang = raw.languages;
          try {
            // Try parsing as JSON first
            return JSON.parse(lang);
          } catch {
            // If it's already an array, return it
            if (Array.isArray(lang)) return lang;
            // If it's a string, try to split by comma
            if (typeof lang === 'string') {
              return lang.split(',').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
            }
            // Fallback
            return [];
          }
        })(),
        maxChildren: raw.maxChildren,
        minAge: raw.minAge,
        maxAge: raw.maxAge,
        isVerified: raw.isVerified,
        backgroundCheck: raw.backgroundCheck,
        totalBookings: raw.totalBookings,
        averageRating: raw.averageRating,
        user: {
          id: raw.user_id,
          email: raw.user_email,
          profile: {
            firstName: raw.firstName,
            lastName: raw.lastName,
            phone: raw.phone,
            avatar: raw.avatar,
            streetAddress: raw.streetAddress,
            city: raw.city,
            state: raw.state,
            zipCode: raw.zipCode,
            country: raw.country,
            latitude: raw.latitude,
            longitude: raw.longitude,
          }
        },
        services: [], // We'll fetch these separately if needed
        photos: [], // We'll fetch these separately if needed
        availabilitySlots: [], // We'll fetch these separately if needed
      }));
      
      // If we need services and other relations, fetch them separately
      if (caregivers.length > 0) {
        const caregiverIds = caregivers.map(c => c.id);
        
        // Fetch services
        const services = await db.caregiverService.findMany({
          where: { caregiverId: { in: caregiverIds } }
        });
        
        // Fetch photos
        const photos = await db.caregiverPhoto.findMany({
          where: { caregiverId: { in: caregiverIds } }
        });
        
        // Fetch availability slots
        const slots = await db.availabilitySlot.findMany({
          where: {
            caregiverId: { in: caregiverIds },
            status: 'AVAILABLE',
            availableSpots: { gt: 0 },
            date: { gte: new Date() }
          },
          orderBy: { startTime: 'asc' }
        });
        
        // Attach relations to caregivers
        caregivers.forEach(caregiver => {
          caregiver.services = services.filter(s => s.caregiverId === caregiver.id);
          caregiver.photos = photos.filter(p => p.caregiverId === caregiver.id);
          caregiver.availabilitySlots = slots.filter(s => s.caregiverId === caregiver.id);
        });
      }
      
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
        // Debug logging for Isabella specifically
        if (caregiver.user.profile?.firstName === 'Isabella') {
          console.log('🔍 Isabella Debug - Raw Data:', {
            caregiverRecordId: caregiver.id,
            userId: caregiver.userId,
            name: `${caregiver.user.profile?.firstName} ${caregiver.user.profile?.lastName}`,
            availabilitySlots: caregiver.availabilitySlots?.length || 0,
            slotsData: caregiver.availabilitySlots?.map(slot => ({
              id: slot.id,
              date: slot.date,
              availableSpots: slot.availableSpots,
              caregiverId: slot.caregiverId
            }))
          });
        }
        
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
          description: caregiver.bio || 'No description available', // Map bio to description for compatibility
          languages: caregiver.languages as string[] || [],
          maxChildren: caregiver.maxChildren,
          minAge: caregiver.minAge,
          maxAge: caregiver.maxAge,
          isVerified: caregiver.isVerified,
          backgroundCheck: caregiver.backgroundCheck,
          totalBookings: caregiver.totalBookings,
          averageRating: Math.round(caregiver.averageRating * 100) / 100, // Round to 2 decimal places
          image: caregiver.user.profile?.avatar || caregiver.photos?.find(photo => photo.isProfile)?.url || null,
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
          // Add actual availability information
          availability: calculateAvailabilityStatus(caregiver.availabilitySlots),
          availabilitySlots: caregiver.availabilitySlots?.map(slot => ({
            id: slot.id,
            date: slot.date,
            startTime: slot.startTime,
            endTime: slot.endTime,
            totalCapacity: slot.totalCapacity,
            availableSpots: slot.availableSpots,
            baseRate: slot.baseRate,
            status: slot.status
          })) || [],
          hasAvailability: (caregiver.availabilitySlots?.length || 0) > 0,
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