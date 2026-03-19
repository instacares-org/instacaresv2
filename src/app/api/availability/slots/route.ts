import { NextRequest } from 'next/server';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';
import { withAuth } from '@/lib/auth-middleware';
import { AvailabilityService } from '@/lib/availabilityService';

export const dynamic = 'force-dynamic';

// GET /api/availability/slots - Get available slots
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const caregiverId = searchParams.get('caregiverId');
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const minAvailableSpots = searchParams.get('minAvailableSpots');
    const includeExpired = searchParams.get('includeExpired');
    const userTimezone = searchParams.get("userTimezone") || "America/Toronto"; // Default to EST

    const query: any = {};

    if (caregiverId) query.caregiverId = caregiverId;
    if (date) query.date = date;
    if (startDate) query.startDate = startDate;
    if (endDate) query.endDate = endDate;
    if (userTimezone) query.userTimezone = userTimezone;
    if (minAvailableSpots) query.minAvailableSpots = parseInt(minAvailableSpots);
    if (includeExpired === 'true') query.includeExpired = true;

    console.log('🔍 Availability Slots Query:', {
      caregiverId,
      query,
      searchParams: Object.fromEntries(searchParams.entries())
    });

    const slots = await AvailabilityService.getAvailableSlots(query);
    
    console.log('📊 Slots Found:', {
      caregiverId,
      slotsCount: slots?.length || 0,
      firstFewSlots: slots?.slice(0, 3).map(slot => ({
        id: slot.id,
        date: slot.date,
        availableSpots: slot.availableSpots
      }))
    });

    return apiSuccess(slots);

  } catch (error) {
    console.error('Error fetching availability slots:', error);
    return ApiErrors.internal('Failed to fetch availability slots');
  }
}

// POST /api/availability/slots - Create new availability slot (caregivers only)
export async function POST(request: NextRequest) {
  try {
    const authResult = await withAuth(request, 'CAREGIVER');
    if (!authResult.isAuthorized || !authResult.user) {
      return authResult.response;
    }

    const body = await request.json();
    const {
      date,
      startTime,
      endTime,
      totalCapacity,
      baseRate,
      isRecurring,
      recurringPattern,
      specialRequirements,
      notes
    } = body;

    if (!date || !startTime || !endTime) {
      return ApiErrors.badRequest('Date, start time, and end time are required');
    }

    const { prisma } = await import('@/lib/db');
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: authResult.user.id },
      include: {
        user: {
          include: {
            profile: true
          }
        }
      }
    });

    if (!caregiver) {
      const user = await prisma.user.findUnique({
        where: { id: authResult.user.id },
        include: { profile: true }
      });

      if (!user || !user.profile) {
        return ApiErrors.notFound('User profile not found. Please complete your profile setup first.');
      }

      const userTimezone = user.profile.timezone || 'America/Toronto';

      const newCaregiver = await prisma.caregiver.create({
        data: {
          userId: authResult.user.id,
          hourlyRate: baseRate || 25.00,
          experienceYears: 0,
          bio: '',
          languages: ['English'],
          availability: {},
          maxChildren: 3,
          minAge: 0,
          maxAge: 12,
          dailyCapacity: 5,
          isAvailable: true
        }
      });

      const slot = await AvailabilityService.createSlot({
        caregiverId: newCaregiver.id,
        date,
        startTime,
        endTime,
        userTimezone,
        totalCapacity: totalCapacity || 3,
        baseRate: baseRate || 25.00,
        isRecurring,
        recurringPattern,
        specialRequirements,
        notes
      });

      return apiSuccess(slot, 'Availability slot created successfully');
    }

    const userTimezone = caregiver.user.profile?.timezone || 'America/Toronto';

    const slot = await AvailabilityService.createSlot({
      caregiverId: caregiver.id,
      date,
      startTime,
      endTime,
      userTimezone,
      totalCapacity: totalCapacity || 3,
      baseRate: baseRate || caregiver.hourlyRate,
      isRecurring,
      recurringPattern,
      specialRequirements,
      notes
    });

    return apiSuccess(slot, 'Availability slot created successfully');

  } catch (error) {
    console.error('Error creating availability slot:', error);
    return ApiErrors.internal('Failed to create availability slot');
  }
}

// PUT /api/availability/slots - Update existing availability slot
export async function PUT(request: NextRequest) {
  try {
    const authResult = await withAuth(request, 'CAREGIVER');
    if (!authResult.isAuthorized || !authResult.user) {
      return authResult.response;
    }

    const body = await request.json();
    const {
      slotId,
      date,
      startTime,
      endTime,
      totalCapacity,
      baseRate,
      notes
    } = body;

    if (!slotId) {
      return ApiErrors.badRequest('Slot ID is required for updates');
    }

    const { prisma } = await import('@/lib/db');
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: authResult.user.id }
    });

    if (!caregiver) {
      return ApiErrors.notFound('Caregiver profile not found');
    }

    // Verify the slot belongs to this caregiver
    const existingSlot = await prisma.availabilitySlot.findFirst({
      where: {
        id: slotId,
        caregiverId: caregiver.id
      }
    });

    if (!existingSlot) {
      return ApiErrors.notFound('Slot not found or not owned by this caregiver');
    }

    // Validate and sanitize rate if provided
    let validatedRate: number | undefined = undefined;
    if (baseRate) {
      let rate = parseFloat(baseRate);

      // VALIDATION: If rate > 500, it's likely in cents - convert to dollars
      if (rate > 500) {
        console.warn(`[Availability PUT] Rate ${rate} appears to be in cents, converting to dollars`);
        rate = rate / 100;
      }

      // Validate reasonable range ($5 - $500/hr)
      if (rate < 5 || rate > 500) {
        return ApiErrors.badRequest(`Invalid hourly rate: $${rate}. Rate must be between $5 and $500 per hour.`);
      }

      validatedRate = rate;
    }

    // Update the slot
    const updatedSlot = await prisma.availabilitySlot.update({
      where: { id: slotId },
      data: {
        date: date ? new Date(date) : undefined,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
        totalCapacity: totalCapacity ? parseInt(totalCapacity) : undefined,
        availableSpots: totalCapacity ?
          (parseInt(totalCapacity) - existingSlot.currentOccupancy) : undefined,
        baseRate: validatedRate,
        currentRate: validatedRate,
        notes: notes !== undefined ? notes : undefined
      }
    });

    return apiSuccess(updatedSlot, 'Availability slot updated successfully');

  } catch (error) {
    console.error('Error updating availability slot:', error);
    return ApiErrors.internal('Failed to update availability slot');
  }
}

// DELETE /api/availability/slots - Delete availability slot
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await withAuth(request, 'CAREGIVER');
    if (!authResult.isAuthorized || !authResult.user) {
      return authResult.response;
    }

    const { searchParams } = new URL(request.url);
    const slotId = searchParams.get('slotId');

    if (!slotId) {
      return ApiErrors.badRequest('Slot ID is required');
    }

    const { prisma } = await import('@/lib/db');
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: authResult.user.id }
    });

    if (!caregiver) {
      return ApiErrors.notFound('Caregiver profile not found');
    }

    // Verify the slot belongs to this caregiver and check for existing bookings
    const existingSlot = await prisma.availabilitySlot.findFirst({
      where: {
        id: slotId,
        caregiverId: caregiver.id
      },
      include: {
        slotBookings: true,
        reservations: {
          where: {
            status: 'ACTIVE'
          }
        }
      }
    });

    if (!existingSlot) {
      return ApiErrors.notFound('Slot not found or not owned by this caregiver');
    }

    // Check if slot has active bookings or reservations
    if (existingSlot.slotBookings.length > 0) {
      return ApiErrors.badRequest('Cannot delete slot with existing bookings');
    }

    if (existingSlot.reservations.length > 0) {
      return ApiErrors.badRequest('Cannot delete slot with active reservations');
    }

    // Delete the slot
    await prisma.availabilitySlot.delete({
      where: { id: slotId }
    });

    return apiSuccess(undefined, 'Availability slot deleted successfully');

  } catch (error) {
    console.error('Error deleting availability slot:', error);
    return ApiErrors.internal('Failed to delete availability slot');
  }
}