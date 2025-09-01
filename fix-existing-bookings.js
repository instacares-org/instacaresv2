const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixExistingBookings() {
  console.log('=== FIXING EXISTING BOOKINGS ===\n');
  
  try {
    // Find all bookings that don't have SlotBooking records (orphaned bookings)
    const orphanedBookings = await prisma.booking.findMany({
      where: {
        slotBookings: {
          none: {}
        },
        status: {
          in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS']
        }
      },
      include: {
        caregiver: {
          include: {
            caregiver: true
          }
        },
        parent: {
          include: {
            profile: true
          }
        }
      }
    });

    console.log(`Found ${orphanedBookings.length} orphaned bookings to fix:`);
    
    for (const booking of orphanedBookings) {
      console.log(`\nProcessing booking ${booking.id}:`);
      console.log(`  Parent: ${booking.parent.profile?.firstName} ${booking.parent.profile?.lastName}`);
      console.log(`  Caregiver: ${booking.caregiver.email}`);
      console.log(`  Time: ${booking.startTime} - ${booking.endTime}`);
      console.log(`  Children: ${booking.childrenCount}`);

      if (!booking.caregiver.caregiver) {
        console.log(`  ❌ Skipping - caregiver profile not found`);
        continue;
      }

      // Create date for slot matching
      const bookingDate = new Date(booking.startTime.getFullYear(), booking.startTime.getMonth(), booking.startTime.getDate());
      
      // Try to find an existing availability slot that matches
      let matchingSlot = await prisma.availabilitySlot.findFirst({
        where: {
          caregiverId: booking.caregiver.caregiver.id,
          date: {
            gte: bookingDate,
            lt: new Date(bookingDate.getTime() + 24 * 60 * 60 * 1000)
          },
          startTime: {
            lte: booking.startTime
          },
          endTime: {
            gte: booking.endTime
          }
        },
        include: {
          slotBookings: true
        }
      });

      if (!matchingSlot) {
        // Create a new availability slot
        console.log(`  🔄 Creating new availability slot...`);
        
        const slotCapacity = Math.max(booking.childrenCount, booking.caregiver.caregiver.dailyCapacity);
        
        matchingSlot = await prisma.availabilitySlot.create({
          data: {
            caregiverId: booking.caregiver.caregiver.id,
            date: bookingDate,
            startTime: booking.startTime,
            endTime: booking.endTime,
            totalCapacity: slotCapacity,
            currentOccupancy: 0,
            availableSpots: slotCapacity,
            baseRate: booking.hourlyRate,
            currentRate: booking.hourlyRate,
            status: 'AVAILABLE'
          },
          include: {
            slotBookings: true
          }
        });
        
        console.log(`  ✅ Created slot ${matchingSlot.id} with capacity ${slotCapacity}`);
      } else {
        console.log(`  ✅ Found existing slot ${matchingSlot.id}`);
      }

      // Check if slot has enough capacity
      const currentOccupancy = matchingSlot.slotBookings.reduce((sum, sb) => sum + sb.spotsUsed, 0);
      const availableCapacity = matchingSlot.totalCapacity - currentOccupancy;

      if (availableCapacity < booking.childrenCount) {
        console.log(`  🔄 Expanding slot capacity from ${matchingSlot.totalCapacity} to ${matchingSlot.totalCapacity + booking.childrenCount}`);
        
        // Expand slot capacity to accommodate this booking
        const newCapacity = matchingSlot.totalCapacity + booking.childrenCount;
        await prisma.availabilitySlot.update({
          where: { id: matchingSlot.id },
          data: {
            totalCapacity: newCapacity,
            availableSpots: newCapacity - currentOccupancy
          }
        });
        
        // Refresh the slot data
        matchingSlot = await prisma.availabilitySlot.findUnique({
          where: { id: matchingSlot.id },
          include: { slotBookings: true }
        });
      }

      // Create SlotBooking junction record
      console.log(`  🔄 Creating SlotBooking junction record...`);
      
      await prisma.slotBooking.create({
        data: {
          slotId: matchingSlot.id,
          bookingId: booking.id,
          childrenCount: booking.childrenCount,
          spotsUsed: booking.childrenCount,
          rateApplied: booking.hourlyRate
        }
      });

      // Update slot occupancy
      const newOccupancy = currentOccupancy + booking.childrenCount;
      const newAvailableSpots = matchingSlot.totalCapacity - newOccupancy;
      
      await prisma.availabilitySlot.update({
        where: { id: matchingSlot.id },
        data: {
          currentOccupancy: newOccupancy,
          availableSpots: newAvailableSpots,
          status: newAvailableSpots <= 0 ? 'BOOKED' : 'AVAILABLE'
        }
      });

      console.log(`  ✅ Updated slot occupancy: ${newOccupancy}/${matchingSlot.totalCapacity}, available: ${newAvailableSpots}`);
      console.log(`  ✅ Booking ${booking.id} successfully linked to slot ${matchingSlot.id}`);
    }

    console.log('\n=== VERIFICATION ===');
    
    // Verify all bookings now have slot connections
    const stillOrphaned = await prisma.booking.findMany({
      where: {
        slotBookings: {
          none: {}
        },
        status: {
          in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS']
        }
      }
    });

    console.log(`Remaining orphaned bookings: ${stillOrphaned.length}`);

    // Show current state of Isabella's slots
    console.log('\n=== ISABELLA\'S UPDATED SLOTS ===');
    
    const isabella = await prisma.user.findFirst({
      where: { email: { contains: 'isabella' } },
      include: { caregiver: true }
    });

    if (isabella && isabella.caregiver) {
      const isabellaSlots = await prisma.availabilitySlot.findMany({
        where: { caregiverId: isabella.caregiver.id },
        include: {
          slotBookings: {
            include: {
              booking: {
                include: {
                  parent: { include: { profile: true } }
                }
              }
            }
          }
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }]
      });

      console.log(`Isabella now has ${isabellaSlots.length} slots:`);
      isabellaSlots.forEach(slot => {
        console.log(`- Slot ${slot.id}:`);
        console.log(`  Date: ${slot.date.toLocaleDateString()}`);
        console.log(`  Time: ${slot.startTime.toLocaleTimeString()} - ${slot.endTime.toLocaleTimeString()}`);
        console.log(`  Capacity: ${slot.totalCapacity}, Occupancy: ${slot.currentOccupancy}, Available: ${slot.availableSpots}`);
        console.log(`  Status: ${slot.status}`);
        console.log(`  Bookings: ${slot.slotBookings.length}`);
        
        slot.slotBookings.forEach(sb => {
          const parentName = sb.booking.parent.profile ? 
            `${sb.booking.parent.profile.firstName} ${sb.booking.parent.profile.lastName}` : 
            'Unknown';
          console.log(`    - ${parentName}: ${sb.spotsUsed} spots, ${sb.childrenCount} children`);
        });
        console.log('');
      });
    }

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixExistingBookings();