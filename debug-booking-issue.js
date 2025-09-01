const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function investigateBookingIssue() {
  console.log('=== BOOKING LOGIC INVESTIGATION ===\n');
  
  try {
    // 1. Find Isabella Rodriguez
    console.log('1. Looking for Isabella Rodriguez...');
    const isabella = await prisma.user.findFirst({
      where: {
        email: {
          contains: 'isabella'
        }
      },
      include: {
        profile: true,
        caregiver: true
      }
    });
    
    if (!isabella) {
      console.log('Isabella not found!');
      return;
    }
    
    console.log(`Found Isabella: ${isabella.email} (ID: ${isabella.id})`);
    console.log(`Caregiver ID: ${isabella.caregiver?.id}`);
    
    // 2. Find Emily Thompson  
    console.log('\n2. Looking for Emily Thompson...');
    const emily = await prisma.user.findFirst({
      where: {
        email: {
          contains: 'emily'
        }
      },
      include: {
        profile: true
      }
    });
    
    if (!emily) {
      console.log('Emily not found!');
      return;
    }
    
    console.log(`Found Emily: ${emily.email} (ID: ${emily.id})`);
    
    // 3. Check Isabella's availability slots
    console.log('\n3. Checking Isabella\'s availability slots...');
    if (isabella.caregiver) {
      const slots = await prisma.availabilitySlot.findMany({
        where: {
          caregiverId: isabella.caregiver.id
        },
        include: {
          slotBookings: true,
          reservations: true
        },
        orderBy: [
          { date: 'asc' },
          { startTime: 'asc' }
        ]
      });
      
      console.log(`Found ${slots.length} slots for Isabella:`);
      slots.forEach(slot => {
        console.log(`- Slot ID: ${slot.id}`);
        console.log(`  Date: ${slot.date.toLocaleDateString()}`);
        console.log(`  Time: ${slot.startTime.toLocaleTimeString()} - ${slot.endTime.toLocaleTimeString()}`);
        console.log(`  Capacity: ${slot.totalCapacity}, Occupancy: ${slot.currentOccupancy}, Available: ${slot.availableSpots}`);
        console.log(`  Status: ${slot.status}`);
        console.log(`  Slot Bookings: ${slot.slotBookings.length}`);
        console.log(`  Reservations: ${slot.reservations.length}`);
        console.log('');
      });
    }
    
    // 4. Check Emily's bookings  
    console.log('\n4. Checking Emily\'s bookings...');
    const emilyBookings = await prisma.booking.findMany({
      where: {
        parentId: emily.id
      },
      include: {
        slotBookings: {
          include: {
            slot: true
          }
        },
        reservations: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`Found ${emilyBookings.length} bookings for Emily:`);
    emilyBookings.forEach(booking => {
      console.log(`- Booking ID: ${booking.id}`);
      console.log(`  Status: ${booking.status}`);
      console.log(`  Caregiver ID: ${booking.caregiverId}`);
      console.log(`  Start: ${booking.startTime}`);
      console.log(`  End: ${booking.endTime}`);
      console.log(`  Slot Bookings: ${booking.slotBookings.length}`);
      console.log(`  Reservations: ${booking.reservations.length}`);
      console.log('');
    });
    
    // 5. Check any reservations
    console.log('\n5. Checking all active reservations...');
    const reservations = await prisma.bookingReservation.findMany({
      where: {
        status: 'ACTIVE'
      },
      include: {
        slot: true,
        parent: {
          include: {
            profile: true
          }
        }
      }
    });
    
    console.log(`Found ${reservations.length} active reservations:`);
    reservations.forEach(reservation => {
      console.log(`- Reservation ID: ${reservation.id}`);
      console.log(`  Parent: ${reservation.parent.profile?.firstName} ${reservation.parent.profile?.lastName}`);
      console.log(`  Slot ID: ${reservation.slotId}`);
      console.log(`  Reserved Spots: ${reservation.reservedSpots}`);
      console.log(`  Expires At: ${reservation.expiresAt}`);
      console.log('');
    });
    
    // 6. Check slot bookings connecting slots to actual bookings
    console.log('\n6. Checking slot bookings (junction table)...');
    if (isabella.caregiver) {
      const slotBookings = await prisma.slotBooking.findMany({
        where: {
          slot: {
            caregiverId: isabella.caregiver.id
          }
        },
        include: {
          slot: true,
          booking: {
            include: {
              parent: {
                include: {
                  profile: true
                }
              }
            }
          }
        }
      });
      
      console.log(`Found ${slotBookings.length} slot bookings for Isabella's slots:`);
      slotBookings.forEach(slotBooking => {
        console.log(`- Slot Booking ID: ${slotBooking.id}`);
        console.log(`  Slot ID: ${slotBooking.slotId}`);
        console.log(`  Booking ID: ${slotBooking.bookingId}`);
        console.log(`  Parent: ${slotBooking.booking.parent.profile?.firstName} ${slotBooking.booking.parent.profile?.lastName}`);
        console.log(`  Spots Used: ${slotBooking.spotsUsed}`);
        console.log(`  Children Count: ${slotBooking.childrenCount}`);
        console.log('');
      });
    }
    
    // 7. Analyze the issue
    console.log('\n7. ANALYSIS:');
    if (isabella.caregiver) {
      const problemSlots = await prisma.availabilitySlot.findMany({
        where: {
          caregiverId: isabella.caregiver.id,
          totalCapacity: {
            gt: 1
          },
          currentOccupancy: {
            gt: 0
          },
          availableSpots: {
            lte: 0
          }
        },
        include: {
          slotBookings: true,
          reservations: true
        }
      });
      
      console.log(`Found ${problemSlots.length} potentially problematic slots:`);
      problemSlots.forEach(slot => {
        const actualOccupancy = slot.slotBookings.reduce((sum, sb) => sum + sb.spotsUsed, 0);
        const expectedAvailable = slot.totalCapacity - actualOccupancy;
        
        console.log(`- Slot ID: ${slot.id}`);
        console.log(`  Total Capacity: ${slot.totalCapacity}`);
        console.log(`  Recorded Occupancy: ${slot.currentOccupancy}`);
        console.log(`  Actual Occupancy (from slot bookings): ${actualOccupancy}`);
        console.log(`  Recorded Available: ${slot.availableSpots}`);  
        console.log(`  Expected Available: ${expectedAvailable}`);
        console.log(`  ISSUE: ${slot.availableSpots !== expectedAvailable ? 'MISMATCH!' : 'OK'}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('Error during investigation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

investigateBookingIssue();