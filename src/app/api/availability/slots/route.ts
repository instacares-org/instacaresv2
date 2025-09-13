import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { AvailabilityService } from '@/lib/availabilityService';
import { SlotStatus } from '@prisma/client';

// GET /api/availability/slots - Get available slots
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const caregiverId = searchParams.get('caregiverId');
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const minAvailableSpots = searchParams.get('minAvailableSpots');

    const query: any = {};

    if (caregiverId) query.caregiverId = caregiverId;
    if (date) query.date = new Date(date);
    if (startDate) query.startDate = new Date(startDate);
    if (endDate) query.endDate = new Date(endDate);
    if (minAvailableSpots) query.minAvailableSpots = parseInt(minAvailableSpots);

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

    return NextResponse.json({
      success: true,
      data: slots
    });

  } catch (error) {
    console.error('Error fetching availability slots:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch availability slots'
    }, { status: 500 });
  }
}

// POST /api/availability/slots - Create new availability slot (caregivers only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in again.' },
        { status: 401 }
      );
    }

    if (session.user.userType !== 'CAREGIVER') {
      return NextResponse.json(
        { error: 'Only caregivers can create availability slots' },
        { status: 403 }
      );
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
      return NextResponse.json(
        { error: 'Date, start time, and end time are required' },
        { status: 400 }
      );
    }

    // First find the caregiver record for this user
    const { prisma } = await import('@/lib/database');
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: session.user.id }
    });

    if (!caregiver) {
      // If caregiver record doesn't exist, create it
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { profile: true }
      });
      
      if (!user || !user.profile) {
        return NextResponse.json(
          { error: 'User profile not found. Please complete your profile setup first.' },
          { status: 404 }
        );
      }

      // Create caregiver record with default values
      const newCaregiver = await prisma.caregiver.create({
        data: {
          userId: session.user.id,
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
        date: date, // Pass string directly to avoid timezone conversion
        startTime: startTime, // Pass string directly
        endTime: endTime, // Pass string directly
        totalCapacity: totalCapacity || 3,
        baseRate: baseRate || 25.00,
        isRecurring,
        recurringPattern,
        specialRequirements,
        notes
      });

      return NextResponse.json({
        success: true,
        data: slot,
        message: 'Availability slot created successfully'
      });
    }

    const slot = await AvailabilityService.createSlot({
      caregiverId: caregiver.id, // Use caregiver record ID
      date: date, // Pass string directly to avoid timezone conversion
      startTime: startTime, // Pass string directly
      endTime: endTime, // Pass string directly
      totalCapacity: totalCapacity || 3,
      baseRate: baseRate || caregiver.hourlyRate,
      isRecurring,
      recurringPattern,
      specialRequirements,
      notes
    });

    return NextResponse.json({
      success: true,
      data: slot,
      message: 'Availability slot created successfully'
    });

  } catch (error) {
    console.error('Error creating availability slot:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create availability slot'
    }, { status: 500 });
  }
}

// PUT /api/availability/slots - Update existing availability slot
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (session.user.userType !== 'CAREGIVER') {
      return NextResponse.json(
        { error: 'Only caregivers can update availability slots' },
        { status: 403 }
      );
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
      return NextResponse.json(
        { error: 'Slot ID is required for updates' },
        { status: 400 }
      );
    }

    // First find the caregiver record for this user
    const { prisma } = await import('@/lib/database');
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: session.user.id }
    });

    if (!caregiver) {
      return NextResponse.json(
        { error: 'Caregiver profile not found' },
        { status: 404 }
      );
    }

    // Verify the slot belongs to this caregiver
    const existingSlot = await prisma.availabilitySlot.findFirst({
      where: {
        id: slotId,
        caregiverId: caregiver.id
      }
    });

    if (!existingSlot) {
      return NextResponse.json(
        { error: 'Slot not found or not owned by this caregiver' },
        { status: 404 }
      );
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
        baseRate: baseRate ? parseFloat(baseRate) : undefined,
        currentRate: baseRate ? parseFloat(baseRate) : undefined,
        notes: notes !== undefined ? notes : undefined
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedSlot,
      message: 'Availability slot updated successfully'
    });

  } catch (error) {
    console.error('Error updating availability slot:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update availability slot'
    }, { status: 500 });
  }
}

// DELETE /api/availability/slots - Delete availability slot
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (session.user.userType !== 'CAREGIVER') {
      return NextResponse.json(
        { error: 'Only caregivers can delete availability slots' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const slotId = searchParams.get('slotId');

    if (!slotId) {
      return NextResponse.json(
        { error: 'Slot ID is required' },
        { status: 400 }
      );
    }

    // First find the caregiver record for this user
    const { prisma } = await import('@/lib/database');
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId: session.user.id }
    });

    if (!caregiver) {
      return NextResponse.json(
        { error: 'Caregiver profile not found' },
        { status: 404 }
      );
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
      return NextResponse.json(
        { error: 'Slot not found or not owned by this caregiver' },
        { status: 404 }
      );
    }

    // Check if slot has active bookings or reservations
    if (existingSlot.slotBookings.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete slot with existing bookings' },
        { status: 400 }
      );
    }

    if (existingSlot.reservations.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete slot with active reservations' },
        { status: 400 }
      );
    }

    // Delete the slot
    await prisma.availabilitySlot.delete({
      where: { id: slotId }
    });

    return NextResponse.json({
      success: true,
      message: 'Availability slot deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting availability slot:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to delete availability slot'
    }, { status: 500 });
  }
}