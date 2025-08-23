import { db } from './db';
import { SlotStatus, ReservationStatus } from '@prisma/client';

export interface CreateSlotParams {
  caregiverId: string; // Caregiver record ID (not user ID)
  date: Date | string; // Accept both Date objects and strings
  startTime: Date | string; // Accept both Date objects and strings
  endTime: Date | string; // Accept both Date objects and strings
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
  date?: Date;
  startDate?: Date;
  endDate?: Date;
  status?: SlotStatus;
  minAvailableSpots?: number;
}

export class AvailabilityService {
  /**
   * Create a new availability slot for a caregiver
   */
  static async createSlot(params: CreateSlotParams) {
    const {
      caregiverId,
      date,
      startTime,
      endTime,
      totalCapacity,
      baseRate,
      isRecurring = false,
      recurringPattern,
      specialRequirements,
      notes
    } = params;

    // Get caregiver info for defaults
    const caregiver = await db.caregiver.findUnique({
      where: { id: caregiverId },
      select: { dailyCapacity: true, hourlyRate: true }
    });

    if (!caregiver) {
      throw new Error('Caregiver not found');
    }

    // Handle dates consistently - preserve the local date without timezone conversion
    // If date is already a Date object, extract the local components
    // If it's a string, parse it carefully to avoid timezone shifts
    let localDate: Date;
    
    if (typeof date === 'string') {
      // Handle date strings like "2025-08-19" by treating them as local dates
      const [year, month, day] = date.split('-').map(Number);
      localDate = new Date(year, month - 1, day); // month is 0-indexed
    } else {
      // If it's already a Date object, create a new one with the same local date components
      localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }
    
    // Handle startTime and endTime consistently to avoid timezone shifts
    let startTimeObj: Date;
    let endTimeObj: Date;
    
    if (typeof startTime === 'string') {
      // Handle ISO strings like "2025-08-19T09:00:00" by preserving local time
      if (startTime.includes('T')) {
        const [dateStr, timeStr] = startTime.split('T');
        const [year, month, day] = dateStr.split('-').map(Number);
        const [hour, minute, second = 0] = timeStr.split(':').map(Number);
        startTimeObj = new Date(year, month - 1, day, hour, minute, second);
      } else {
        startTimeObj = new Date(startTime);
      }
    } else {
      startTimeObj = startTime;
    }
    
    if (typeof endTime === 'string') {
      // Handle ISO strings like "2025-08-19T17:00:00" by preserving local time
      if (endTime.includes('T')) {
        const [dateStr, timeStr] = endTime.split('T');
        const [year, month, day] = dateStr.split('-').map(Number);
        const [hour, minute, second = 0] = timeStr.split(':').map(Number);
        endTimeObj = new Date(year, month - 1, day, hour, minute, second);
      } else {
        endTimeObj = new Date(endTime);
      }
    } else {
      endTimeObj = endTime;
    }
    
    const slotData = {
      caregiverId,
      date: localDate,
      startTime: startTimeObj,
      endTime: endTimeObj,
      totalCapacity: totalCapacity || caregiver.dailyCapacity,
      currentOccupancy: 0,
      availableSpots: totalCapacity || caregiver.dailyCapacity,
      baseRate: baseRate || caregiver.hourlyRate,
      currentRate: baseRate || caregiver.hourlyRate,
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
        // Check if a slot already exists with the same parameters
        const existingSlot = await db.availabilitySlot.findFirst({
          where: {
            caregiverId,
            date: localDate,
            startTime
          }
        });

        if (existingSlot) {
          throw new Error(`An availability slot already exists for this time slot (${startTime.toLocaleTimeString()} on ${date.toLocaleDateString()}). Please choose a different time or delete the existing slot first.`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Get available slots based on query parameters
   */
  static async getAvailableSlots(query: AvailabilityQuery) {
    const {
      caregiverId,
      date,
      startDate,
      endDate,
      status = SlotStatus.AVAILABLE,
      minAvailableSpots = 1
    } = query;

    const where: any = {
      status,
      availableSpots: {
        gte: minAvailableSpots
      }
    };

    if (caregiverId) {
      where.caregiverId = caregiverId;
    }

    if (date) {
      // Create date range for the specific day using local date components
      const year = date.getFullYear();
      const month = date.getMonth();
      const dayOfMonth = date.getDate();
      
      // Create start and end of day using local date constructor to avoid timezone shifts
      const startOfDay = new Date(year, month, dayOfMonth, 0, 0, 0, 0);
      const endOfDay = new Date(year, month, dayOfMonth, 23, 59, 59, 999);
      
      where.date = {
        gte: startOfDay,
        lte: endOfDay
      };
    }

    if (startDate && endDate) {
      // Parse date strings and create proper Date objects using local time
      let start: Date;
      let end: Date;
      
      if (typeof startDate === 'string') {
        const [year, month, day] = startDate.split('-').map(Number);
        start = new Date(year, month - 1, day, 0, 0, 0, 0);
      } else {
        start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0);
      }
      
      if (typeof endDate === 'string') {
        const [year, month, day] = endDate.split('-').map(Number);
        end = new Date(year, month - 1, day, 23, 59, 59, 999);
      } else {
        end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);
      }
      
      where.date = {
        gte: start,
        lte: end
      };
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
  static async getRealTimeAvailability(caregiverId: string, date: Date) {
    // Use local date components to avoid timezone issues
    const year = date.getFullYear();
    const month = date.getMonth();
    const dayOfMonth = date.getDate();
    
    const startOfDay = new Date(year, month, dayOfMonth, 0, 0, 0, 0);
    const endOfDay = new Date(year, month, dayOfMonth, 23, 59, 59, 999);

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