import { db } from './db';
import { SlotStatus, ReservationStatus } from '@prisma/client';
import { convertToUTC, combineDateTime, startOfDayInTimezone, endOfDayInTimezone } from './timezone';
import { DateTime } from 'luxon';

export interface CreateSlotParams {
  caregiverId: string; // Caregiver record ID (not user ID)
  date: string; // Date string in YYYY-MM-DD format
  startTime: string; // Time string in HH:MM format
  endTime: string; // Time string in HH:MM format
  userTimezone: string; // REQUIRED: User's timezone (e.g., "America/Toronto")
  totalCapacity?: number;
  baseRate?: number;
  isRecurring?: boolean;
  recurringPattern?: any;
  specialRequirements?: any;
  notes?: string;
}

export interface ReserveSpotParams {
  slotId: string;
  parentId: string;
  childrenCount: number;
  reservedSpots: number;
}

export interface AvailabilityQuery {
  caregiverId?: string;
  date?: Date | string;
  startDate?: Date | string;
  endDate?: Date | string;
  status?: SlotStatus;
  minAvailableSpots?: number;
  userTimezone?: string; // Optional: If provided, converts results to this timezone
}

export class AvailabilityService {
  /**
   * Create a new availability slot for a caregiver
   *
   * CRITICAL TIMEZONE HANDLING:
   * When a caregiver selects "9:00 AM" in Toronto (EST), we:
   * 1. Receive date="2025-01-15", startTime="09:00", timezone="America/Toronto"
   * 2. Combine them → "2025-01-15T09:00" in America/Toronto
   * 3. Convert to UTC → stores as "2025-01-15T14:00:00Z"
   * 4. When displayed back, convert UTC → Toronto → shows "9:00 AM" (correct!)
   */
  static async createSlot(params: CreateSlotParams) {
    const {
      caregiverId,
      date,
      startTime,
      endTime,
      userTimezone,
      totalCapacity,
      baseRate,
      isRecurring = false,
      recurringPattern,
      specialRequirements,
      notes
    } = params;

    // Validate timezone is provided
    if (!userTimezone) {
      throw new Error('userTimezone is required for creating availability slots');
    }

    // Get caregiver info for defaults
    const caregiver = await db.caregiver.findUnique({
      where: { id: caregiverId },
      select: { dailyCapacity: true, hourlyRate: true }
    });

    if (!caregiver) {
      throw new Error('Caregiver not found');
    }

    // VALIDATION: Ensure rate is in dollars (not cents)
    // Typical hourly rates should be between $10-$200
    // If rate > 500, it's likely stored in cents by mistake
    const rateToUse = baseRate || caregiver.hourlyRate;
    let validatedRate = rateToUse;

    if (rateToUse > 500) {
      console.warn(`[AvailabilityService] Rate ${rateToUse} appears to be in cents, converting to dollars`);
      validatedRate = rateToUse / 100;
    }

    if (validatedRate < 5 || validatedRate > 500) {
      throw new Error(`Invalid hourly rate: $${validatedRate}. Rate must be between $5 and $500 per hour.`);
    }

    // Combine date and time strings in user's timezone and convert to UTC
    const startTimeUTC = combineDateTime(date, startTime, userTimezone);
    const endTimeUTC = combineDateTime(date, endTime, userTimezone);

    // Parse the UTC ISO strings into Date objects for Prisma
    const startTimeDate = new Date(startTimeUTC);
    const endTimeDate = new Date(endTimeUTC);

    // FIX: Store date as midnight in the user's local timezone, not UTC
    // This preserves the calendar date across timezone conversions
    // Input: "2025-11-16" should store as midnight Nov 16 in user's timezone
    const dateObj = DateTime.fromISO(date, { zone: userTimezone }).startOf('day').toJSDate();

    // Validate Date objects
    if (isNaN(startTimeDate.getTime())) {
      throw new Error(`Invalid startTime: Cannot parse "${startTime}" in timezone "${userTimezone}"`);
    }
    if (isNaN(endTimeDate.getTime())) {
      throw new Error(`Invalid endTime: Cannot parse "${endTime}" in timezone "${userTimezone}"`);
    }
    if (isNaN(dateObj.getTime())) {
      throw new Error(`Invalid date: Cannot parse "${date}"`);
    }

    const slotData = {
      caregiverId,
      date: dateObj,
      startTime: startTimeDate,
      endTime: endTimeDate,
      totalCapacity: totalCapacity || caregiver.dailyCapacity,
      currentOccupancy: 0,
      availableSpots: totalCapacity || caregiver.dailyCapacity,
      baseRate: validatedRate,
      currentRate: validatedRate,
      status: SlotStatus.AVAILABLE,
      isRecurring,
      recurringPattern,
      specialRequirements,
      notes
    };

    try {
      return await db.availabilitySlot.create({
        data: slotData
      });
    } catch (error: any) {
      // Handle unique constraint violation
      if (error.code === 'P2002') {
        const dayStart = startOfDayInTimezone(date, userTimezone).toJSDate();
        const dayEnd = endOfDayInTimezone(date, userTimezone).toJSDate();

        const existingSlot = await db.availabilitySlot.findFirst({
          where: {
            caregiverId,
            date: {
              gte: dayStart,
              lte: dayEnd
            },
            startTime: startTimeDate
          }
        });

        if (existingSlot) {
          const timeStr = DateTime.fromJSDate(startTimeDate, { zone: 'UTC' }).setZone(userTimezone).toFormat('h:mm a ZZZZ');
          throw new Error(`An availability slot already exists for this time slot (${timeStr} on ${date}). Please choose a different time or delete the existing slot first.`);
        }
      }

      throw error;
    }
  }

  /**
   * Get available slots based on query parameters
   *
   * TIMEZONE HANDLING FOR QUERIES:
   * - Dates are queried in UTC (database timezone)
   * - Results include UTC times
   * - Caller should convert to display timezone using timezone utilities
   */
  static async getAvailableSlots(query: AvailabilityQuery) {
    const {
      caregiverId,
      date,
      startDate,
      endDate,
      status = SlotStatus.AVAILABLE,
      minAvailableSpots = 1,
      userTimezone
    } = query;

    // Filter out expired slots (endTime must be in the future)
    const now = new Date();

    const where: any = {
      status,
      availableSpots: {
        gte: minAvailableSpots
      },
      // Only return slots that haven't expired yet
      endTime: {
        gt: now
      }
    };

    if (caregiverId) {
      where.caregiverId = caregiverId;
    }

    if (date) {
      // If timezone is provided, use it for date range calculation
      if (userTimezone) {
        const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
        const startOfDay = startOfDayInTimezone(dateStr, userTimezone).toJSDate();
        const endOfDay = endOfDayInTimezone(dateStr, userTimezone).toJSDate();

        where.date = {
          gte: startOfDay,
          lte: endOfDay
        };
      } else {
        // Fallback to UTC if no timezone provided
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        const year = dateObj.getUTCFullYear();
        const month = dateObj.getUTCMonth();
        const dayOfMonth = dateObj.getUTCDate();

        const startOfDay = new Date(Date.UTC(year, month, dayOfMonth, 0, 0, 0, 0));
        const endOfDay = new Date(Date.UTC(year, month, dayOfMonth, 23, 59, 59, 999));

        where.date = {
          gte: startOfDay,
          lte: endOfDay
        };
      }
    }

    if (startDate && endDate) {
      if (userTimezone) {
        const startDateStr = typeof startDate === 'string' ? startDate : startDate.toISOString().split('T')[0];
        const endDateStr = typeof endDate === 'string' ? endDate : endDate.toISOString().split('T')[0];

        const start = startOfDayInTimezone(startDateStr, userTimezone).toJSDate();
        const end = endOfDayInTimezone(endDateStr, userTimezone).toJSDate();

        where.date = {
          gte: start,
          lte: end
        };
      } else {
        // Fallback to UTC
        const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
        const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

        where.date = {
          gte: start,
          lte: end
        };
      }
    }

    return await db.availabilitySlot.findMany({
      where,
      include: {
        caregiver: {
          include: {
            user: {
              include: {
                profile: true
              }
            }
          }
        }
      },
      orderBy: [
        { date: 'asc' },
        { startTime: 'asc' }
      ]
    });
  }

  /**
   * Reserve spots in a slot temporarily (15 minutes)
   */
  static async reserveSpots(params: ReserveSpotParams) {
    const { slotId, parentId, childrenCount, reservedSpots } = params;

    // Check if slot has enough available spots
    const slot = await db.availabilitySlot.findUnique({
      where: { id: slotId }
    });

    if (!slot) {
      throw new Error('Slot not found');
    }

    if (slot.availableSpots < reservedSpots) {
      throw new Error('Not enough available spots');
    }

    // Create reservation with 15-minute expiry
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    const reservation = await db.bookingReservation.create({
      data: {
        slotId,
        parentId,
        childrenCount,
        reservedSpots,
        status: ReservationStatus.ACTIVE,
        expiresAt
      }
    });

    // Update slot available spots (temporarily)
    await db.availabilitySlot.update({
      where: { id: slotId },
      data: {
        availableSpots: slot.availableSpots - reservedSpots
      }
    });

    return reservation;
  }

  /**
   * Convert reservation to actual booking
   */
  static async convertReservationToBooking(reservationId: string, bookingId: string) {
    const reservation = await db.bookingReservation.findUnique({
      where: { id: reservationId },
      include: { slot: true }
    });

    if (!reservation) {
      throw new Error('Reservation not found');
    }

    if (reservation.status !== ReservationStatus.ACTIVE) {
      throw new Error('Reservation is not active');
    }

    // Update reservation
    await db.bookingReservation.update({
      where: { id: reservationId },
      data: {
        status: ReservationStatus.CONVERTED_TO_BOOKING,
        bookingId
      }
    });

    // Update slot occupancy
    await db.availabilitySlot.update({
      where: { id: reservation.slotId },
      data: {
        currentOccupancy: reservation.slot.currentOccupancy + reservation.reservedSpots
      }
    });

    // Create slot booking junction record
    await db.slotBooking.create({
      data: {
        slotId: reservation.slotId,
        bookingId,
        childrenCount: reservation.childrenCount,
        spotsUsed: reservation.reservedSpots,
        rateApplied: reservation.slot.currentRate
      }
    });

    return reservation;
  }

  /**
   * Cancel/expire reservations and free up spots
   */
  static async cancelReservation(reservationId: string) {
    const reservation = await db.bookingReservation.findUnique({
      where: { id: reservationId },
      include: { slot: true }
    });

    if (!reservation) {
      throw new Error('Reservation not found');
    }

    // Return spots to availability
    await db.availabilitySlot.update({
      where: { id: reservation.slotId },
      data: {
        availableSpots: reservation.slot.availableSpots + reservation.reservedSpots
      }
    });

    // Update reservation status
    await db.bookingReservation.update({
      where: { id: reservationId },
      data: {
        status: ReservationStatus.CANCELLED
      }
    });

    return reservation;
  }

  /**
   * Clean up expired reservations (should be run periodically)
   */
  static async cleanupExpiredReservations() {
    const expiredReservations = await db.bookingReservation.findMany({
      where: {
        status: ReservationStatus.ACTIVE,
        expiresAt: {
          lt: new Date()
        }
      },
      include: { slot: true }
    });

    for (const reservation of expiredReservations) {
      await this.cancelReservation(reservation.id);
    }

    return expiredReservations.length;
  }

  /**
   * Get real-time availability for a caregiver on a specific date
   */
  static async getRealTimeAvailability(caregiverId: string, date: Date | string, userTimezone?: string) {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];

    let startOfDay: Date;
    let endOfDay: Date;

    if (userTimezone) {
      startOfDay = startOfDayInTimezone(dateStr, userTimezone).toJSDate();
      endOfDay = endOfDayInTimezone(dateStr, userTimezone).toJSDate();
    } else {
      // Fallback to UTC
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      const year = dateObj.getUTCFullYear();
      const month = dateObj.getUTCMonth();
      const dayOfMonth = dateObj.getUTCDate();

      startOfDay = new Date(Date.UTC(year, month, dayOfMonth, 0, 0, 0, 0));
      endOfDay = new Date(Date.UTC(year, month, dayOfMonth, 23, 59, 59, 999));
    }

    const slots = await db.availabilitySlot.findMany({
      where: {
        caregiverId,
        date: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      include: {
        reservations: {
          where: {
            status: ReservationStatus.ACTIVE
          }
        },
        slotBookings: true
      },
      orderBy: { startTime: 'asc' }
    });

    // Calculate real-time availability including active reservations
    return slots.map(slot => {
      const activeReservations = slot.reservations.filter(
        r => r.status === ReservationStatus.ACTIVE && r.expiresAt > new Date()
      );

      const reservedSpots = activeReservations.reduce((sum, r) => sum + r.reservedSpots, 0);
      const realTimeAvailable = slot.totalCapacity - slot.currentOccupancy - reservedSpots;

      return {
        ...slot,
        realTimeAvailable,
        reservedSpots,
        activeReservations: activeReservations.length
      };
    });
  }

  /**
   * Update slot pricing based on demand (dynamic pricing)
   */
  static async updateDynamicPricing(slotId: string) {
    const slot = await db.availabilitySlot.findUnique({
      where: { id: slotId },
      include: {
        caregiver: true
      }
    });

    if (!slot || !slot.caregiver.enableDynamicPricing) {
      return slot;
    }

    const utilizationRate = (slot.totalCapacity - slot.availableSpots) / slot.totalCapacity;
    let newRate = slot.baseRate;

    // Apply dynamic pricing based on utilization
    if (utilizationRate >= 0.8) {
      newRate = slot.baseRate * 1.3; // 30% increase when 80%+ full
    } else if (utilizationRate >= 0.6) {
      newRate = slot.baseRate * 1.2; // 20% increase when 60%+ full
    } else if (utilizationRate >= 0.4) {
      newRate = slot.baseRate * 1.1; // 10% increase when 40%+ full
    }

    if (newRate !== slot.currentRate) {
      return await db.availabilitySlot.update({
        where: { id: slotId },
        data: { currentRate: newRate }
      });
    }

    return slot;
  }
}
