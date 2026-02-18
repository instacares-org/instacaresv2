import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { db } from '@/lib/db';
import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Base fields shared by all recurrence types
const baseFields = {
  startTime: z.string().regex(timeRegex, 'Invalid time format (HH:MM)'),
  endTime: z.string().regex(timeRegex, 'Invalid time format (HH:MM)'),
};

// Discriminated union based on recurrenceType
const slotSchema = z.discriminatedUnion('recurrenceType', [
  z.object({
    recurrenceType: z.literal('ONCE'),
    specificDate: z.string().refine(val => !isNaN(Date.parse(val)), 'Invalid date'),
    ...baseFields,
  }),
  z.object({
    recurrenceType: z.literal('WEEKLY'),
    dayOfWeek: z.number().min(0).max(6),
    repeatInterval: z.number().min(1).max(4).default(1),
    anchorDate: z.string().optional(),
    ...baseFields,
  }),
  z.object({
    recurrenceType: z.literal('MONTHLY'),
    dayOfMonth: z.number().min(1).max(31),
    ...baseFields,
  }),
]);

// Also accept legacy format (no recurrenceType = WEEKLY with interval 1)
const legacySlotSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(timeRegex, 'Invalid time format (HH:MM)'),
  endTime: z.string().regex(timeRegex, 'Invalid time format (HH:MM)'),
  isRecurring: z.boolean().default(true),
});

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await request.json();

    const babysitter = await db.babysitter.findUnique({
      where: { userId }
    });

    if (!babysitter) {
      return NextResponse.json(
        { error: 'Babysitter profile not found' },
        { status: 404 }
      );
    }

    const slots = Array.isArray(body) ? body : [body];

    // Parse each slot - try new format first, fall back to legacy
    const parsedSlots = slots.map(slot => {
      if (slot.recurrenceType) {
        return slotSchema.parse(slot);
      }
      // Legacy format: treat as WEEKLY with interval 1
      const legacy = legacySlotSchema.parse(slot);
      return {
        recurrenceType: 'WEEKLY' as const,
        dayOfWeek: legacy.dayOfWeek,
        startTime: legacy.startTime,
        endTime: legacy.endTime,
        repeatInterval: 1,
      };
    });

    // Validate endTime > startTime
    for (const slot of parsedSlots) {
      if (slot.startTime >= slot.endTime) {
        return NextResponse.json(
          { error: 'End time must be after start time' },
          { status: 400 }
        );
      }
    }

    // Validate ONCE dates are not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const slot of parsedSlots) {
      if (slot.recurrenceType === 'ONCE') {
        const slotDate = new Date(slot.specificDate);
        slotDate.setHours(0, 0, 0, 0);
        if (slotDate < today) {
          return NextResponse.json(
            { error: 'One-time availability date cannot be in the past' },
            { status: 400 }
          );
        }
      }
    }

    // Upsert each slot using the compound unique key
    const results = await Promise.all(
      parsedSlots.map(slot => {
        const uniqueKey = {
          babysitterId: babysitter.id,
          recurrenceType: slot.recurrenceType,
          dayOfWeek: slot.recurrenceType === 'WEEKLY' ? (slot.dayOfWeek ?? 0) : 0,
          specificDate: slot.recurrenceType === 'ONCE' ? new Date(slot.specificDate) : new Date(0),
          dayOfMonth: slot.recurrenceType === 'MONTHLY' ? (slot.dayOfMonth ?? 1) : 0,
          startTime: slot.startTime,
        };

        const commonData = {
          startTime: slot.startTime,
          endTime: slot.endTime,
          recurrenceType: slot.recurrenceType,
          isRecurring: slot.recurrenceType !== 'ONCE',
          isActive: true,
        };

        const typeSpecificData = slot.recurrenceType === 'WEEKLY'
          ? {
              dayOfWeek: slot.dayOfWeek,
              repeatInterval: slot.repeatInterval,
              anchorDate: slot.anchorDate ? new Date(slot.anchorDate) : null,
              specificDate: null,
              dayOfMonth: null,
            }
          : slot.recurrenceType === 'ONCE'
          ? {
              specificDate: new Date(slot.specificDate),
              dayOfWeek: null,
              dayOfMonth: null,
              repeatInterval: 1,
              anchorDate: null,
            }
          : {
              dayOfMonth: slot.dayOfMonth,
              dayOfWeek: null,
              specificDate: null,
              repeatInterval: 1,
              anchorDate: null,
            };

        return db.babysitterAvailability.upsert({
          where: {
            babysitterId_recurrenceType_dayOfWeek_specificDate_dayOfMonth_startTime: uniqueKey,
          },
          create: {
            babysitterId: babysitter.id,
            ...commonData,
            ...typeSpecificData,
          },
          update: {
            ...commonData,
            ...typeSpecificData,
          },
        });
      })
    );

    return NextResponse.json({
      success: true,
      message: `${results.length} availability slot(s) saved`,
      slots: results,
    });

  } catch (error) {
    console.error('Save availability error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to save availability' },
      { status: 500 }
    );
  }
}

function formatSlot(slot: any) {
  const base = {
    id: slot.id,
    recurrenceType: slot.recurrenceType,
    startTime: slot.startTime,
    endTime: slot.endTime,
    isRecurring: slot.isRecurring,
  };

  if (slot.recurrenceType === 'WEEKLY') {
    return {
      ...base,
      dayOfWeek: slot.dayOfWeek,
      day: slot.dayOfWeek != null ? DAY_NAMES[slot.dayOfWeek] : null,
      repeatInterval: slot.repeatInterval,
      anchorDate: slot.anchorDate,
    };
  }

  if (slot.recurrenceType === 'ONCE') {
    return {
      ...base,
      specificDate: slot.specificDate,
    };
  }

  // MONTHLY
  return {
    ...base,
    dayOfMonth: slot.dayOfMonth,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const babysitterId = searchParams.get('id');

    if (babysitterId) {
      // Public query: filter out expired ONCE slots
      const slots = await db.babysitterAvailability.findMany({
        where: {
          babysitterId,
          isActive: true,
          OR: [
            { recurrenceType: { not: 'ONCE' } },
            { specificDate: { gte: new Date() } },
          ],
        },
        orderBy: [
          { recurrenceType: 'asc' },
          { dayOfWeek: 'asc' },
          { specificDate: 'asc' },
          { dayOfMonth: 'asc' },
          { startTime: 'asc' },
        ],
      });

      return NextResponse.json({
        slots: slots.map(formatSlot),
      });
    }

    // Current user's own availability
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const babysitter = await db.babysitter.findUnique({
      where: { userId: session.user.id },
      include: {
        availabilitySlots: {
          where: { isActive: true },
          orderBy: [
            { recurrenceType: 'asc' },
            { dayOfWeek: 'asc' },
            { specificDate: 'asc' },
            { dayOfMonth: 'asc' },
            { startTime: 'asc' },
          ],
        },
      },
    });

    if (!babysitter) {
      return NextResponse.json(
        { error: 'Babysitter profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      slots: babysitter.availabilitySlots.map(formatSlot),
    });

  } catch (error) {
    console.error('Get availability error:', error);
    return NextResponse.json(
      { error: 'Failed to get availability' },
      { status: 500 }
    );
  }
}

// DELETE - Remove availability slot (no changes needed - works by ID)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const slotId = searchParams.get('id');

    if (!slotId) {
      return NextResponse.json(
        { error: 'Slot ID is required' },
        { status: 400 }
      );
    }

    const babysitter = await db.babysitter.findUnique({
      where: { userId: session.user.id }
    });

    if (!babysitter) {
      return NextResponse.json(
        { error: 'Babysitter profile not found' },
        { status: 404 }
      );
    }

    const slot = await db.babysitterAvailability.findFirst({
      where: {
        id: slotId,
        babysitterId: babysitter.id
      }
    });

    if (!slot) {
      return NextResponse.json(
        { error: 'Availability slot not found' },
        { status: 404 }
      );
    }

    await db.babysitterAvailability.update({
      where: { id: slotId },
      data: { isActive: false }
    });

    return NextResponse.json({
      success: true,
      message: 'Availability slot removed'
    });

  } catch (error) {
    console.error('Delete availability error:', error);
    return NextResponse.json(
      { error: 'Failed to delete availability' },
      { status: 500 }
    );
  }
}
