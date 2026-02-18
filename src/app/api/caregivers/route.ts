import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { logger, getClientInfo } from '@/lib/logger';
import { db } from '@/lib/db';
import { apiCache, cacheKeys, cacheTTL } from '@/lib/cache';
import { DateTime } from 'luxon';
import type { CaregiverService, CaregiverPhoto, AvailabilitySlot, Prisma } from '@prisma/client';

// Interface for the transformed caregiver data used throughout the GET handler
interface CaregiverProfile {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  avatar?: string | null;
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string;
}

interface CaregiverUser {
  id: string;
  email: string;
  profile: CaregiverProfile;
}

interface CaregiverData {
  id: string;
  userId: string;
  hourlyRate: number;
  experienceYears: number;
  bio: string | null;
  languages: Prisma.JsonValue | string[];
  maxChildren: number;
  minAge: number;
  maxAge: number;
  isVerified: boolean;
  backgroundCheck: boolean;
  ageGroups: Prisma.JsonValue | string[];
  specialties: Prisma.JsonValue | string[];
  stripeAccountId: string | null;
  stripeOnboarded: boolean;
  canReceivePayments: boolean;
  totalBookings: number;
  averageRating: number | null;
  user: CaregiverUser;
  services: CaregiverService[];
  photos: CaregiverPhoto[];
  availabilitySlots: AvailabilitySlot[];
  reviewCount?: number;
  distance?: number | null;
  lastActiveAt?: Date;
  createdAt?: Date;
}

// Haversine formula to calculate distance between two coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}


// Helper function to calculate availability status with timezone support
function calculateAvailabilityStatus(availabilitySlots: any[], userTimezone: string = 'America/Toronto') {
  if (!availabilitySlots || availabilitySlots.length === 0) {
    return "No Availability Posted Yet";
  }

  // Get current time in the caregiver's timezone
  const nowInZone = DateTime.now().setZone(userTimezone);
  const todayInZone = nowInZone.startOf('day');
  const tomorrowInZone = todayInZone.plus({ days: 1 });
  const nextWeekInZone = todayInZone.plus({ days: 7 });

  // Filter slots to only include future time slots (not just future dates)
  // Convert slot endTime from UTC to caregiver's timezone for comparison
  const futureSlots = availabilitySlots.filter(slot => {
    const slotEndTimeUTC = DateTime.fromJSDate(new Date(slot.endTime), { zone: 'UTC' });
    const slotEndTimeInZone = slotEndTimeUTC.setZone(userTimezone);
    return slotEndTimeInZone > nowInZone && slot.availableSpots > 0;
  });

  if (futureSlots.length === 0) {
    return "No upcoming availability";
  }

  // Helper to get calendar date from slot.date (stored as UTC but represents local date)
  const getSlotCalendarDate = (slotDate: Date | string) => {
    // slot.date is stored as UTC midnight (e.g., 2025-11-14T00:00:00Z)
    // but it represents Nov 14 in the caregiver's timezone
    // Extract just the year-month-day components without timezone conversion
    const dateObj = typeof slotDate === 'string' ? new Date(slotDate) : slotDate;
    const year = dateObj.getUTCFullYear();
    const month = dateObj.getUTCMonth() + 1; // 0-indexed
    const day = dateObj.getUTCDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  // Get current date components in caregiver's timezone
  const getTodayCalendarDate = () => {
    const year = nowInZone.year;
    const month = nowInZone.month;
    const day = nowInZone.day;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const getTomorrowCalendarDate = () => {
    const year = tomorrowInZone.year;
    const month = tomorrowInZone.month;
    const day = tomorrowInZone.day;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const todayDate = getTodayCalendarDate();
  const tomorrowDate = getTomorrowCalendarDate();

  // Check for availability today (in caregiver's timezone)
  const todaySlots = futureSlots.filter(slot => {
    return getSlotCalendarDate(slot.date) === todayDate;
  });

  if (todaySlots.length > 0) {
    return "Available today";
  }

  // Check for availability tomorrow (in caregiver's timezone)
  const tomorrowSlots = futureSlots.filter(slot => {
    return getSlotCalendarDate(slot.date) === tomorrowDate;
  });

  if (tomorrowSlots.length > 0) {
    return "Available tomorrow";
  }

  // Check for availability this week (in caregiver's timezone)
  const thisWeekSlots = futureSlots.filter(slot => {
    const slotCalendarDate = getSlotCalendarDate(slot.date);
    return slotCalendarDate >= todayDate && slotCalendarDate < getTodayCalendarDate(); // Will implement properly
  });

  if (thisWeekSlots.length > 0 && thisWeekSlots.length !== futureSlots.length) {
    return "Available this week";
  }

  // Show next available date
  const nextSlot = futureSlots[0];
  const nextDateStr = getSlotCalendarDate(nextSlot.date);
  const [year, month, day] = nextDateStr.split('-').map(Number);
  const nextDate = DateTime.fromObject({ year, month, day }, { zone: userTimezone });
  return `Next available: ${nextDate.toFormat('MMM d')}`;
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

    // Fetch platform settings to determine if contact info should be shown
    const platformSettings = await db.platformSettings.findFirst();
    const showCaregiverContactInfo = platformSettings?.showCaregiverContactInfo ?? false;

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
    let caregivers = apiCache.get<CaregiverData[]>(cacheKey);
    
    if (!caregivers) {
      console.log(`💾 Cache miss for key: ${cacheKey}`);
      
      // Fetch from real database using standard Prisma queries
      const rawCaregivers = await db.caregiver.findMany({
        where: {
          isVerified: true,
          user: {
            isActive: true,
            approvalStatus: 'APPROVED',
            profile: {
              country: 'CA'
            }
          }
        },
        include: {
          user: {
            include: {
              profile: true
            }
          }
        },
        orderBy: {
          averageRating: 'desc'
        },
        take: limit,
        skip: offset
      });
      
      // Transform Prisma results to match expected format
      caregivers = rawCaregivers.map((caregiver): CaregiverData => ({
        id: caregiver.id,
        userId: caregiver.userId,
        hourlyRate: caregiver.hourlyRate,
        experienceYears: caregiver.experienceYears,
        bio: caregiver.bio,
        languages: (() => {
          if (!caregiver.languages) return [];
          const lang = caregiver.languages;
          try {
            // Try parsing as JSON first
            return JSON.parse(lang as string);
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
        maxChildren: caregiver.maxChildren,
        minAge: caregiver.minAge,
        maxAge: caregiver.maxAge,
        isVerified: caregiver.isVerified,
        backgroundCheck: caregiver.backgroundCheck,
        ageGroups: (() => {
          if (!caregiver.ageGroups) return [];
          try { return JSON.parse(caregiver.ageGroups as string); }
          catch { return Array.isArray(caregiver.ageGroups) ? caregiver.ageGroups : []; }
        })(),
        specialties: (() => {
          if (!caregiver.specialties) return [];
          try { return JSON.parse(caregiver.specialties as string); }
          catch { return Array.isArray(caregiver.specialties) ? caregiver.specialties : []; }
        })(),
        stripeAccountId: caregiver.stripeAccountId,
        stripeOnboarded: caregiver.stripeOnboarded,
        canReceivePayments: caregiver.canReceivePayments,
        totalBookings: caregiver.totalBookings,
        averageRating: caregiver.averageRating,
        user: {
          id: caregiver.user.id,
          email: caregiver.user.email,
          profile: {
            firstName: caregiver.user.profile?.firstName,
            lastName: caregiver.user.profile?.lastName,
            phone: caregiver.user.profile?.phone,
            avatar: caregiver.user.profile?.avatar,
            streetAddress: caregiver.user.profile?.streetAddress,
            city: caregiver.user.profile?.city,
            state: caregiver.user.profile?.state,
            zipCode: caregiver.user.profile?.zipCode,
            country: caregiver.user.profile?.country,
            latitude: caregiver.user.profile?.latitude,
            longitude: caregiver.user.profile?.longitude,
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
        
        // Fetch approved review counts for each caregiver
        const userIds = caregivers.map(c => c.userId);
        const reviewCounts = await Promise.all(
          userIds.map(async (userId) => {
            const count = await db.review.count({
              where: {
                revieweeId: userId,
                isApproved: true
              }
            });
            return { userId, count };
          })
        );
        const reviewCountMap = new Map(reviewCounts.map(r => [r.userId, r.count]));
        
        // Fetch availability slots
        // CRITICAL: Use UTC start of today to match database storage
        const now = new Date();
        const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
        
        const slots = await db.availabilitySlot.findMany({
          where: {
            caregiverId: { in: caregiverIds },
            status: 'AVAILABLE',
            availableSpots: { gt: 0 },
            date: { gte: startOfToday },
            endTime: { gt: now }  // Filter out expired slots (past endTime)
          },
          orderBy: { startTime: 'asc' }
        });
        
        // Attach relations to caregivers
        caregivers.forEach(caregiver => {
          caregiver.services = services.filter(s => s.caregiverId === caregiver.id);
          caregiver.photos = photos.filter(p => p.caregiverId === caregiver.id);
          caregiver.availabilitySlots = slots.filter(s => s.caregiverId === caregiver.id);
          caregiver.reviewCount = reviewCountMap.get(caregiver.userId) || 0;
        });
      }
      
      console.log(`🗄️ Database returned ${caregivers?.length || 0} caregivers`);
      
      // Cache the results for 5 minutes
      apiCache.set(cacheKey, caregivers, cacheTTL.caregivers);
    } else {
      console.log(`🎯 Cache hit for key: ${cacheKey} - ${caregivers?.length || 0} caregivers`);
      
      // For cached data, we need to refresh reviewCount as it may have changed
      if (caregivers.length > 0) {
        const userIds = caregivers.map(c => c.userId);
        const reviewCounts = await Promise.all(
          userIds.map(async (userId) => {
            const count = await db.review.count({
              where: {
                revieweeId: userId,
                isApproved: true
              }
            });
            return { userId, count };
          })
        );
        const reviewCountMap = new Map(reviewCounts.map(r => [r.userId, r.count]));
        
        // Update reviewCount for cached caregivers
        caregivers.forEach(caregiver => {
          caregiver.reviewCount = reviewCountMap.get(caregiver.userId) || 0;
        });
        
        console.log('📊 Updated review counts for cached caregivers');

        // Also refresh availability slots as they change frequently
        const caregiverIds = caregivers.map(c => c.id);
        const now = new Date();
        const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

        const freshSlots = await db.availabilitySlot.findMany({
          where: {
            caregiverId: { in: caregiverIds },
            status: 'AVAILABLE',
            availableSpots: { gt: 0 },
            date: { gte: startOfToday },
            endTime: { gt: now }  // Filter out expired slots (past endTime)
          },
          orderBy: { startTime: 'asc' }
        });

        // Update availability slots for cached caregivers
        caregivers.forEach(caregiver => {
          caregiver.availabilitySlots = freshSlots.filter(s => s.caregiverId === caregiver.id);
        });

        console.log('📅 Updated availability slots for cached caregivers');

        // Also refresh services as they may have been updated
        const freshServices = await db.caregiverService.findMany({
          where: { caregiverId: { in: caregiverIds } }
        });

        // Update services for cached caregivers
        caregivers.forEach(caregiver => {
          caregiver.services = freshServices.filter(s => s.caregiverId === caregiver.id);
        });

        console.log('🛠️ Updated services for cached caregivers');

        // Also refresh ageGroups as they may have been updated (stored on Caregiver model)
        const freshCaregiverData = await db.caregiver.findMany({
          where: { id: { in: caregiverIds } },
          select: { id: true, ageGroups: true, specialties: true, languages: true }
        });

        // Update ageGroups, specialties, languages for cached caregivers
        caregivers.forEach(caregiver => {
          const freshData = freshCaregiverData.find(c => c.id === caregiver.id);
          if (freshData) {
            caregiver.ageGroups = freshData.ageGroups;
            caregiver.specialties = freshData.specialties;
            caregiver.languages = freshData.languages;
          }
        });

        console.log('👶 Updated ageGroups, specialties, languages for cached caregivers');
      }
    }

    // Calculate distances and filter by radius if location is provided
    // IMPORTANT: This must run AFTER both cache hit and cache miss paths
    if (latitude && longitude) {
      console.log(`📍 Calculating distances from (${latitude}, ${longitude}) with radius ${radius}km`);

      const beforeFilterCount = caregivers.length;

      caregivers = caregivers
        .map(caregiver => {
          const caregiverLat = caregiver.user?.profile?.latitude;
          const caregiverLng = caregiver.user?.profile?.longitude;

          if (caregiverLat && caregiverLng) {
            const distance = calculateDistance(latitude, longitude, caregiverLat, caregiverLng);
            return { ...caregiver, distance };
          }
          return { ...caregiver, distance: null };
        })
        .filter(caregiver => {
          if (caregiver.distance === null) {
            console.log(`  ⚠️ ${caregiver.user?.profile?.firstName} ${caregiver.user?.profile?.lastName}: No coordinates, excluding`);
            return false;
          }
          const withinRadius = caregiver.distance <= radius;
          if (!withinRadius) {
            console.log(`  ❌ ${caregiver.user?.profile?.firstName} ${caregiver.user?.profile?.lastName}: ${caregiver.distance.toFixed(1)}km > ${radius}km radius`);
          }
          return withinRadius;
        })
        .sort((a, b) => (a.distance || 0) - (b.distance || 0)); // Sort by distance (closest first)

      console.log(`📊 Distance filter: ${beforeFilterCount} caregivers → ${caregivers.length} within ${radius}km`);
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
        
        // Database format — strip PII from public response
        // Only include contact info when admin setting allows it
        const result: any = {
          id: caregiver.userId, // Use USER ID for bookings, not caregiver record ID
          caregiverId: caregiver.id, // Keep caregiver record ID for reference
          userId: caregiver.userId,
          name: `${caregiver.user.profile?.firstName} ${caregiver.user.profile?.lastName}`,
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
          ageGroups: (() => {
            if (!caregiver.ageGroups) return [];
            try { return JSON.parse(caregiver.ageGroups as string); }
            catch { return Array.isArray(caregiver.ageGroups) ? caregiver.ageGroups : []; }
          })(),
          specialties: (() => {
            if (!caregiver.specialties) return [];
            try { return JSON.parse(caregiver.specialties as string); }
            catch { return Array.isArray(caregiver.specialties) ? caregiver.specialties : []; }
          })(),
          // Only expose payment capability booleans, NOT the Stripe account ID
          stripeOnboarded: caregiver.stripeOnboarded,
          canReceivePayments: caregiver.canReceivePayments,
          totalBookings: caregiver.totalBookings,
          averageRating: Math.round((caregiver.averageRating ?? 0) * 100) / 100, // Round to 2 decimal places
          reviewCount: caregiver.reviewCount || 0,
          image: caregiver.user.profile?.avatar || caregiver.photos?.find(photo => photo.isProfile)?.url || null,
          profilePhoto: caregiver.user.profile?.avatar || caregiver.photos?.find(photo => photo.isProfile)?.url,
          address: {
            // Only city and province — no street address, postal code, or exact coordinates
            city: caregiver.user.profile?.city,
            province: caregiver.user.profile?.state,
            // Fuzz coordinates to ~1km precision so exact home address can't be derived
            latitude: caregiver.user.profile?.latitude ? Math.round(caregiver.user.profile.latitude * 100) / 100 : null,
            longitude: caregiver.user.profile?.longitude ? Math.round(caregiver.user.profile.longitude * 100) / 100 : null,
          },
          distance: caregiver.distance, // Include distance from location-based query
          services: caregiver.services?.map(service => ({
            type: service.serviceType,
            rate: service.rate || caregiver.hourlyRate,
            description: service.description,
          })) || [],
          // Add actual availability information
          availability: (() => {
            const userTimezone = caregiver.user?.profile?.timezone || 'America/Toronto';
            const avail = calculateAvailabilityStatus(caregiver.availabilitySlots, userTimezone);
            if (caregiver.user?.profile?.firstName === 'Fazila') {
              console.log('🔍 Fazila Availability Debug:', {
                slotsCount: caregiver.availabilitySlots?.length || 0,
                availability: avail,
                slots: caregiver.availabilitySlots?.map(s => ({
                  date: s.date,
                  availableSpots: s.availableSpots,
                  status: s.status
                }))
              });
            }
            return avail;
          })(),
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

        // Only include contact info when the admin platform setting allows it
        if (showCaregiverContactInfo) {
          result.email = caregiver.user.email;
          result.phone = caregiver.user.profile?.phone;
        }

        return result;
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
      showCaregiverContactInfo,
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
    // ✅ STEP 1: Require authentication to create caregiver profile
    const authResult = await withAuth(request, 'ANY');
    if (!authResult.isAuthorized) {
      const clientInfo = getClientInfo(request);
      logger.security('Unauthorized caregiver creation attempt', {
        endpoint: '/api/caregivers',
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

    // ✅ STEP 2: Use authenticated user ID, not client-provided userId
    const userId = user.id;

    const body = await request.json();
    
    const {
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
          required: ['hourlyRate'],
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
        },
        services: true
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