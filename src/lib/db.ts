import { PrismaClient } from "@prisma/client";
import { apiCache } from "./cache";
import { applyFieldEncryption } from "./field-encryption";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const basePrisma = globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : [
          { emit: "event", level: "error" },
          { emit: "event", level: "warn" },
          // Log slow queries in production (> 2 seconds)
          { emit: "event", level: "query" },
        ],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

// Log slow queries in production
if (process.env.NODE_ENV === "production") {
  basePrisma.$on("query" as never, (e: { duration: number; query: string; params: string }) => {
    if (e.duration > 2000) {
      console.warn("Slow query detected:", {
        query: e.query,
        duration: `${e.duration}ms`,
        params: e.params,
      });
    }
  });

  basePrisma.$on("error" as never, (e: { message: string; target: string; timestamp: Date }) => {
    console.error("Database error:", e);
  });

  basePrisma.$on("warn" as never, (e: { message: string; target: string; timestamp: Date }) => {
    console.warn("Database warning:", e);
  });
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
}

// Apply field-level encryption extension for sensitive data (medical info, PII).
// The base client is cached globally; the extension wraps it transparently.
export const db = applyFieldEncryption(basePrisma);

// Backward-compatible alias — files that previously imported { prisma } from '@/lib/database'
// now get the same encrypted client.
export const prisma = db;

// Transaction helper with retry logic (exponential backoff).
// Moved from the now-deleted database.ts to consolidate on a single encrypted client.
export async function withTransaction<T>(
  operations: (tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await db.$transaction(operations, {
        timeout: 10000,
        isolationLevel: 'ReadCommitted',
      });
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        throw lastError;
      }

      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  throw lastError!;
}

// Utility functions for common database operations

export const userOperations = {
  async findUserByEmail(email: string) {
    return db.user.findUnique({
      where: { email },
      include: {
        profile: true,
        caregiver: {
          include: {
            certifications: true,
            services: true,
            photos: true,
          },
        },
      },
    });
  },
};

// Caregiver operations
export const caregiverOperations = {
  async findCaregiverByUserId(userId: string) {
    return db.caregiver.findUnique({
      where: { userId },
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
  },
};

// Booking operations
export const bookingOperations = {
  async createBooking(data: {
    parentId: string;
    caregiverId: string;
    startTime: Date;
    endTime: Date;
    childrenCount: number;
    specialRequests?: string;
    address: string;
    latitude?: number;
    longitude?: number;
    hourlyRate: number;
    totalHours: number;
    subtotal: number;
    platformFee: number;
    totalAmount: number;
    slotId?: string; // Optional slot ID for slot-based bookings
    reservationId?: string; // Optional reservation ID to convert
  }) {
    // Create booking and integrate with availability slot system in a transaction
    const result = await db.$transaction(async (tx) => {
      // Debug: Log the data being passed to create
      console.log('Creating booking with data:', {
        parentId: data.parentId,
        caregiverId: data.caregiverId,
        startTime: data.startTime,
        endTime: data.endTime,
        childrenCount: data.childrenCount,
        address: data.address,
        totalAmount: data.totalAmount,
        slotId: data.slotId,
        reservationId: data.reservationId
      });
      
      // Verify caregiver exists before creating booking
      const caregiverExists = await tx.user.findUnique({
        where: { id: data.caregiverId },
        include: { caregiver: true }
      });
      
      if (!caregiverExists) {
        throw new Error(`Caregiver with ID ${data.caregiverId} not found`);
      }
      
      if (!caregiverExists.caregiver) {
        throw new Error(`User ${data.caregiverId} is not a caregiver`);
      }
      
      console.log('Caregiver verified:', caregiverExists.email, caregiverExists.caregiver.hourlyRate);

      // Handle slot-based booking logic
      let availabilitySlot = null;
      if (data.slotId) {
        // Find the specific slot
        availabilitySlot = await tx.availabilitySlot.findUnique({
          where: { id: data.slotId },
          include: { reservations: true }
        });

        if (!availabilitySlot) {
          throw new Error(`Availability slot ${data.slotId} not found`);
        }

        if (availabilitySlot.caregiverId !== caregiverExists.caregiver.id) {
          throw new Error(`Slot does not belong to the specified caregiver`);
        }

        // Check if there's enough capacity (accounting for active reservations)
        const activeReservations = availabilitySlot.reservations.filter(
          r => r.status === 'ACTIVE' && r.expiresAt > new Date()
        );
        const reservedSpots = activeReservations.reduce((sum, r) => sum + r.reservedSpots, 0);
        const realTimeAvailable = availabilitySlot.totalCapacity - availabilitySlot.currentOccupancy - reservedSpots;

        if (realTimeAvailable < data.childrenCount) {
          throw new Error(`Insufficient capacity: ${realTimeAvailable} spots available, ${data.childrenCount} requested`);
        }
      } else {
        // Auto-find matching availability slot for legacy bookings
        const bookingDate = new Date(data.startTime.getFullYear(), data.startTime.getMonth(), data.startTime.getDate());
        
        availabilitySlot = await tx.availabilitySlot.findFirst({
          where: {
            caregiverId: caregiverExists.caregiver.id,
            date: {
              gte: bookingDate,
              lt: new Date(bookingDate.getTime() + 24 * 60 * 60 * 1000)
            },
            startTime: {
              lte: data.startTime
            },
            endTime: {
              gte: data.endTime
            },
            status: 'AVAILABLE'
          },
          include: { reservations: true },
          orderBy: { createdAt: 'asc' }
        });

        // If no matching slot exists, create one automatically
        if (!availabilitySlot) {
          console.log('No matching slot found, creating one automatically...');
          
          availabilitySlot = await tx.availabilitySlot.create({
            data: {
              caregiverId: caregiverExists.caregiver.id,
              date: bookingDate,
              startTime: data.startTime,
              endTime: data.endTime,
              totalCapacity: Math.max(data.childrenCount, caregiverExists.caregiver.dailyCapacity),
              currentOccupancy: 0,
              availableSpots: Math.max(data.childrenCount, caregiverExists.caregiver.dailyCapacity),
              baseRate: data.hourlyRate,
              currentRate: data.hourlyRate,
              status: 'AVAILABLE'
            },
            include: { reservations: true }
          });
          
          console.log(`Created new availability slot: ${availabilitySlot.id}`);
        }

        // Check capacity for auto-found/created slot
        const activeReservations = availabilitySlot.reservations.filter(
          r => r.status === 'ACTIVE' && r.expiresAt > new Date()
        );
        const reservedSpots = activeReservations.reduce((sum, r) => sum + r.reservedSpots, 0);
        const realTimeAvailable = availabilitySlot.totalCapacity - availabilitySlot.currentOccupancy - reservedSpots;

        if (realTimeAvailable < data.childrenCount) {
          throw new Error(`Insufficient capacity: ${realTimeAvailable} spots available, ${data.childrenCount} requested`);
        }
      }

      // Create the booking
      const { slotId, reservationId, ...bookingData } = data;
      const booking = await tx.booking.create({
        data: bookingData,
        include: {
          parent: {
            include: {
              profile: true,
            },
          },
          caregiverUser: {
            include: {
              profile: true,
            },
          },
          caregiverProfile: true,
          slotBookings: {
            include: {
              slot: true
            }
          }
        },
      });

      // Handle reservation conversion if provided
      if (data.reservationId) {
        const reservation = await tx.bookingReservation.findUnique({
          where: { id: data.reservationId }
        });

        if (reservation && reservation.status === 'ACTIVE') {
          // Update reservation status
          await tx.bookingReservation.update({
            where: { id: data.reservationId },
            data: {
              status: 'CONVERTED_TO_BOOKING',
              bookingId: booking.id
            }
          });
          
          console.log(`Converted reservation ${data.reservationId} to booking`);
        }
      }

      // Update slot occupancy and create SlotBooking junction record
      if (availabilitySlot) {
        // Atomic conditional update using optimistic locking.
        // The `where` clause includes `currentOccupancy` so the UPDATE only succeeds
        // if no other transaction has modified the slot since we read it.
        // This prevents double-booking race conditions.
        const newAvailableSpots = availabilitySlot.totalCapacity - availabilitySlot.currentOccupancy - data.childrenCount;
        const updated = await tx.availabilitySlot.updateMany({
          where: {
            id: availabilitySlot.id,
            currentOccupancy: availabilitySlot.currentOccupancy, // Optimistic lock
          },
          data: {
            currentOccupancy: { increment: data.childrenCount },
            availableSpots: { decrement: data.childrenCount },
            status: newAvailableSpots <= 0 ? 'BOOKED' : 'AVAILABLE',
          },
        });

        if (updated.count === 0) {
          throw new Error('Slot was modified concurrently. Please try again.');
        }

        // Create SlotBooking junction record
        await tx.slotBooking.create({
          data: {
            slotId: availabilitySlot.id,
            bookingId: booking.id,
            childrenCount: data.childrenCount,
            spotsUsed: data.childrenCount,
            rateApplied: data.hourlyRate
          }
        });

        const newOccupancy = availabilitySlot.currentOccupancy + data.childrenCount;
        console.log(`Updated slot ${availabilitySlot.id}: occupancy ${newOccupancy}/${availabilitySlot.totalCapacity}, available: ${newAvailableSpots}`);
      }

      // Chat rooms are now created on-demand when either party clicks "Message"
      // See /api/chat/rooms/find-or-create endpoint

      return booking;
    });

    // Invalidate caregivers cache to ensure availability updates are reflected immediately
    try {
      const cacheStats = apiCache.getStats();
      console.log('📊 Cache before invalidation:', {
        size: cacheStats.size,
        keys: cacheStats.keys
      });

      const invalidatedCount = await apiCache.invalidatePattern('caregivers:');
      console.log(`🗑️ Invalidated ${invalidatedCount} caregivers cache entries after booking creation`);

      const cacheStatsAfter = apiCache.getStats();
      console.log('📊 Cache after invalidation:', {
        size: cacheStatsAfter.size,
        keys: cacheStatsAfter.keys
      });
    } catch (cacheError) {
      console.warn('⚠️ Could not invalidate caregivers cache:', cacheError);
      // Don't fail the booking if cache invalidation fails
    }

    return result;
  },

  async getBookingById(id: string) {
    return db.booking.findUnique({
      where: { id },
      include: {
        parent: {
          include: {
            profile: true,
          },
        },
        caregiverUser: {
          include: {
            profile: true,
          },
        },
        caregiverProfile: true,
        payments: true,
        reviews: true,
      },
    });
  },

  async getUserBookings(userId: string, userType: 'parent' | 'caregiver') {
    const whereClause = userType === 'parent' ? { parentId: userId } : { caregiverId: userId };
    // Sort by request date and time for better user experience
    
    return db.booking.findMany({
      where: whereClause,
      include: {
        parent: {
          include: {
            profile: true,
          },
        },
        caregiverUser: {
          include: {
            profile: true,
          },
        },
        caregiverProfile: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
        payments: true,
        reviews: true,
      },
      orderBy: [
        {
          requestedAt: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
    });
  },

  async updateBookingStatus(bookingId: string, status: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED') {
    const updateData: {
      status: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';
      confirmedAt?: Date;
      completedAt?: Date;
      cancelledAt?: Date;
    } = { status };

    if (status === 'CONFIRMED') {
      updateData.confirmedAt = new Date();
    } else if (status === 'COMPLETED') {
      updateData.completedAt = new Date();
    } else if (status === 'CANCELLED') {
      updateData.cancelledAt = new Date();
    }

    const updatedBooking = await db.booking.update({
      where: { id: bookingId },
      data: updateData,
      include: {
        parent: {
          include: {
            profile: true,
          },
        },
        caregiverUser: {
          include: {
            profile: true,
          },
        },
        payments: true,
      },
    });

    // Create chat room when booking is confirmed or in progress
    if ((status === 'CONFIRMED' || status === 'IN_PROGRESS') && updatedBooking) {
      try {
        // Check if chat room already exists
        const existingChatRoom = await db.chatRoom.findFirst({
          where: { bookingId: bookingId }
        });

        if (!existingChatRoom) {
          console.log('Creating chat room for booking:', bookingId);
          await db.chatRoom.create({
            data: {
              bookingId: bookingId,
              parentId: updatedBooking.parentId,
              caregiverId: updatedBooking.caregiverId,
              isActive: true,
            },
          });
          console.log('Chat room created successfully for booking:', bookingId);
        } else {
          console.log('Chat room already exists for booking:', bookingId);
        }
      } catch (error) {
        console.error('Error creating chat room for booking:', bookingId, error);
        // Don't fail the booking update if chat room creation fails
      }
    }

    // Invalidate caregivers cache when booking status changes (especially cancellations)
    if (status === 'CANCELLED') {
      try {
        const invalidatedCount = await apiCache.invalidatePattern('caregivers:');
        console.log(`🗑️ Invalidated ${invalidatedCount} caregivers cache entries after booking cancellation`);
      } catch (cacheError) {
        console.warn('⚠️ Could not invalidate caregivers cache:', cacheError);
      }
    }

    return updatedBooking;
  },
};

// Payment operations
export const paymentOperations = {
  async createPayment(data: {
    bookingId: string;
    stripePaymentIntentId: string;
    amount: number;
    platformFee: number;
    caregiverPayout: number;
    status?: 'PENDING' | 'PAID' | 'REFUNDED' | 'FAILED';
  }) {
    return db.payment.create({
      data: {
        ...data,
        status: data.status || 'PENDING',
      },
      include: {
        booking: {
          include: {
            parent: {
              include: {
                profile: true,
              },
            },
            caregiverProfile: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });
  },

  async updatePaymentStatus(paymentIntentId: string, status: 'PAID' | 'FAILED', metadata?: Record<string, unknown>) {
    const updateData: {
      status: 'PAID' | 'FAILED';
      paidAt?: Date;
      paymentMethod?: Record<string, unknown>;
    } = { status };

    if (status === 'PAID') {
      updateData.paidAt = new Date();
    }

    if (metadata) {
      updateData.paymentMethod = metadata;
    }

    return db.payment.update({
      where: { stripePaymentIntentId: paymentIntentId },
      data: updateData,
      include: {
        booking: true,
      },
    });
  },
};

export default db;
