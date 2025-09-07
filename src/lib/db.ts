import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

// Utility functions for common database operations

// User operations
export const userOperations = {
  async createUser(data: {
    email: string;
    passwordHash?: string;
    userType: 'PARENT' | 'CAREGIVER' | 'ADMIN';
    profile: {
      firstName: string;
      lastName: string;
      phone?: string;
      streetAddress?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      latitude?: number;
      longitude?: number;
    };
  }) {
    return db.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        userType: data.userType,
        profile: {
          create: data.profile,
        },
      },
      include: {
        profile: true,
      },
    });
  },

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

  async findUserById(id: string) {
    return db.user.findUnique({
      where: { id },
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
  async createCaregiver(userId: string, data: {
    hourlyRate: number;
    experienceYears?: number;
    bio?: string;
    languages?: string[];
    maxChildren?: number;
    minAge?: number;
    maxAge?: number;
    services?: Array<{
      serviceType: 'BABYSITTING' | 'NANNY' | 'DAYCARE' | 'AFTER_SCHOOL' | 'OVERNIGHT' | 'SPECIAL_NEEDS' | 'TUTORING';
      rate?: number;
      description?: string;
    }>;
  }) {
    return db.caregiver.create({
      data: {
        userId,
        hourlyRate: data.hourlyRate,
        experienceYears: data.experienceYears || 0,
        bio: data.bio,
        languages: data.languages,
        maxChildren: data.maxChildren || 3,
        minAge: data.minAge || 0,
        maxAge: data.maxAge || 144,
        services: {
          create: data.services?.map(service => ({
            serviceType: service.serviceType,
            rate: service.rate,
            description: service.description,
          })) || [],
        },
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
  },

  async findCaregiverById(id: string) {
    return db.caregiver.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        services: true,
        certifications: true,
        photos: true,
        bookings: {
          include: {
            parent: {
              include: {
                profile: true,
              },
            },
            reviews: true,
          },
        },
      },
    });
  },

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

  async searchCaregivers(params: {
    latitude?: number;
    longitude?: number;
    radius?: number; // in kilometers
    serviceType?: string;
    minRate?: number;
    maxRate?: number;
    minRating?: number;
    isAvailable?: boolean;
    limit?: number;
    offset?: number;
  }) {
    // Note: For production, you'd want to use a proper geospatial search
    // This is a simplified version
    return db.caregiver.findMany({
      where: {
        // Only show caregivers whose users are approved
        user: {
          approvalStatus: 'APPROVED',
          isActive: true,
        },
        isAvailable: params.isAvailable ?? true,
        hourlyRate: {
          gte: params.minRate,
          lte: params.maxRate,
        },
        averageRating: params.minRating ? { gte: params.minRating } : undefined,
        services: params.serviceType ? {
          some: {
            serviceType: params.serviceType as any,
            isOffered: true,
          },
        } : undefined,
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        services: true,
        photos: {
          where: { isProfile: true },
          take: 1,
        },
      },
      take: params.limit || 20,
      skip: params.offset || 0,
      orderBy: {
        averageRating: 'desc',
      },
    });
  },

  async updateCaregiverStripeAccount(caregiverId: string, stripeAccountId: string, canReceivePayments: boolean) {
    return db.caregiver.update({
      where: { id: caregiverId },
      data: {
        stripeAccountId,
        stripeOnboarded: true,
        canReceivePayments,
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
      
      // Check for existing booking with same details to prevent duplicates
      const existingBooking = await tx.booking.findFirst({
        where: {
          parentId: data.parentId,
          caregiverId: data.caregiverId,
          startTime: data.startTime,
          endTime: data.endTime,
        },
      });
      
      if (existingBooking) {
        console.log('Duplicate booking detected, returning existing booking:', existingBooking.id);
        return await tx.booking.findUnique({
          where: { id: existingBooking.id },
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
      }

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
        // Update slot occupancy
        const newOccupancy = availabilitySlot.currentOccupancy + data.childrenCount;
        const newAvailableSpots = availabilitySlot.totalCapacity - newOccupancy;

        await tx.availabilitySlot.update({
          where: { id: availabilitySlot.id },
          data: {
            currentOccupancy: newOccupancy,
            availableSpots: newAvailableSpots,
            status: newAvailableSpots <= 0 ? 'BOOKED' : 'AVAILABLE'
          }
        });

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

        console.log(`Updated slot ${availabilitySlot.id}: occupancy ${newOccupancy}/${availabilitySlot.totalCapacity}, available: ${newAvailableSpots}`);
      }

      // Automatically create chat room for the booking
      try {
        await tx.chatRoom.create({
          data: {
            bookingId: booking.id,
            parentId: data.parentId,
            caregiverId: data.caregiverId,
            isActive: true,
          },
        });
        console.log(`✅ Chat room created for booking ${booking.id}`);
      } catch (chatError) {
        console.warn(`⚠️ Could not create chat room for booking ${booking.id}:`, chatError);
        // Don't fail the booking creation if chat room creation fails
      }

      return booking;
    });

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

  async findBookingById(id: string) {
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
        invoices: true,
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
    const updateData: any = { status };
    
    if (status === 'CONFIRMED') {
      updateData.confirmedAt = new Date();
    } else if (status === 'COMPLETED') {
      updateData.completedAt = new Date();
    } else if (status === 'CANCELLED') {
      updateData.cancelledAt = new Date();
    }

    return db.booking.update({
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
            caregiver: {
              include: {
                profile: true,
              },
            },
          },
        },
      },
    });
  },

  async updatePaymentStatus(paymentIntentId: string, status: 'PAID' | 'FAILED', metadata?: any) {
    const updateData: any = { status };
    
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

// Review operations
export const reviewOperations = {
  async createReview(data: {
    bookingId: string;
    reviewerId: string;
    revieweeId: string;
    rating: number;
    comment?: string;
  }) {
    // First create the review
    const review = await db.review.create({
      data,
      include: {
        reviewer: {
          include: {
            profile: true,
          },
        },
        reviewee: {
          include: {
            profile: true,
            caregiver: true,
          },
        },
      },
    });

    // Update caregiver's average rating if the reviewee is a caregiver
    if (review.reviewee.caregiver) {
      const avgRating = await db.review.aggregate({
        where: {
          revieweeId: data.revieweeId,
          isApproved: true,
        },
        _avg: {
          rating: true,
        },
      });

      if (avgRating._avg.rating) {
        await db.caregiver.update({
          where: { userId: data.revieweeId },
          data: {
            averageRating: avgRating._avg.rating,
          },
        });
      }
    }

    return review;
  },
};

export default db;