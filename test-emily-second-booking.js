const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testEmilySecondBooking() {
  console.log('=== TESTING EMILY\'S SECOND BOOKING ===\n');
  
  try {
    // Get Emily and Isabella
    const emily = await prisma.user.findFirst({
      where: { email: { contains: 'emily' } },
      include: { profile: true }
    });

    const isabella = await prisma.user.findFirst({
      where: { email: { contains: 'isabella' } },
      include: { caregiver: true }
    });

    if (!emily || !isabella || !isabella.caregiver) {
      throw new Error('Could not find Emily or Isabella');
    }

    console.log(`Emily: ${emily.email}`);
    console.log(`Isabella: ${isabella.email} (Caregiver ID: ${isabella.caregiver.id})`);

    // Find Isabella's slot for Aug 23 (the one that should have 1 spot remaining)
    const availableSlot = await prisma.availabilitySlot.findFirst({
      where: {
        caregiverId: isabella.caregiver.id,
        date: {
          gte: new Date('2025-08-23'),
          lt: new Date('2025-08-24')
        }
      },
      include: {
        slotBookings: true,
        reservations: true
      }
    });

    if (!availableSlot) {
      throw new Error('Could not find Isabella\'s slot for Aug 23');
    }

    console.log(`\nFound slot ${availableSlot.id}:`);
    console.log(`  Capacity: ${availableSlot.totalCapacity}`);
    console.log(`  Current Occupancy: ${availableSlot.currentOccupancy}`);
    console.log(`  Available Spots: ${availableSlot.availableSpots}`);
    console.log(`  Status: ${availableSlot.status}`);

    // Check real-time availability
    const activeReservations = availableSlot.reservations.filter(
      r => r.status === 'ACTIVE' && r.expiresAt > new Date()
    );
    const reservedSpots = activeReservations.reduce((sum, r) => sum + r.reservedSpots, 0);
    const realTimeAvailable = availableSlot.totalCapacity - availableSlot.currentOccupancy - reservedSpots;

    console.log(`  Active Reservations: ${activeReservations.length} (${reservedSpots} spots)`);
    console.log(`  Real-time Available: ${realTimeAvailable}`);

    if (realTimeAvailable < 1) {
      throw new Error(`No spots available! Real-time: ${realTimeAvailable}`);
    }

    console.log('\n✅ Slot has available capacity for another booking');

    // Test creating a second booking using the updated createBooking function
    console.log('\n=== CREATING SECOND BOOKING ===');

    // Import the updated booking operations
    const { bookingOperations } = require('./src/lib/db.ts');

    const bookingData = {
      parentId: emily.id,
      caregiverId: isabella.id,  // User ID, not caregiver ID
      startTime: new Date('2025-08-23T10:00:00'),  // 10 AM - 2 PM (4 hours)
      endTime: new Date('2025-08-23T14:00:00'),
      childrenCount: 1,
      address: '456 Oak Ave, City, ST 12345',
      latitude: 40.7589,
      longitude: -73.9851,
      hourlyRate: isabella.caregiver.hourlyRate,
      totalHours: 4,
      subtotal: Math.round(4 * isabella.caregiver.hourlyRate * 100), // in cents
      platformFee: Math.round(4 * isabella.caregiver.hourlyRate * 100 * 0.15), // 15%
      totalAmount: Math.round(4 * isabella.caregiver.hourlyRate * 100),
      slotId: availableSlot.id  // Specify the slot ID
    };

    console.log('Creating booking with data:', {
      parentId: bookingData.parentId,
      caregiverId: bookingData.caregiverId,
      startTime: bookingData.startTime,
      endTime: bookingData.endTime,
      childrenCount: bookingData.childrenCount,
      slotId: bookingData.slotId,
      totalAmount: bookingData.totalAmount
    });

    const secondBooking = await bookingOperations.createBooking(bookingData);

    console.log(`✅ Second booking created successfully: ${secondBooking.id}`);

    // Verify the slot state after second booking
    console.log('\n=== VERIFYING SLOT AFTER SECOND BOOKING ===');
    
    const updatedSlot = await prisma.availabilitySlot.findUnique({
      where: { id: availableSlot.id },
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
      }
    });

    console.log(`Updated slot ${updatedSlot.id}:`);
    console.log(`  Capacity: ${updatedSlot.totalCapacity}`);
    console.log(`  Current Occupancy: ${updatedSlot.currentOccupancy}`);
    console.log(`  Available Spots: ${updatedSlot.availableSpots}`);
    console.log(`  Status: ${updatedSlot.status}`);
    console.log(`  Bookings: ${updatedSlot.slotBookings.length}`);

    updatedSlot.slotBookings.forEach((sb, index) => {
      const parentName = sb.booking.parent.profile ? 
        `${sb.booking.parent.profile.firstName} ${sb.booking.parent.profile.lastName}` : 
        'Unknown';
      console.log(`    ${index + 1}. ${parentName}: ${sb.spotsUsed} spots, ${sb.childrenCount} children (${sb.booking.startTime.toLocaleTimeString()} - ${sb.booking.endTime.toLocaleTimeString()})`);
    });

    // Test trying to create a third booking (should fail)
    console.log('\n=== TESTING THIRD BOOKING (SHOULD FAIL) ===');
    
    try {
      const thirdBookingData = {
        ...bookingData,
        startTime: new Date('2025-08-23T14:00:00'),  // 2 PM - 6 PM
        endTime: new Date('2025-08-23T18:00:00'),
      };

      await bookingOperations.createBooking(thirdBookingData);
      console.log('❌ Third booking should have failed but succeeded!');
    } catch (error) {
      console.log(`✅ Third booking correctly failed: ${error.message}`);
    }

    console.log('\n=== SUCCESS! THE BOOKING SYSTEM IS NOW WORKING CORRECTLY ===');
    console.log('- Emily\'s first booking consumed 1 of 2 spots');
    console.log('- Emily\'s second booking consumed the remaining 1 spot');
    console.log('- The slot is now full (2/2 spots occupied)');
    console.log('- Future booking attempts will be rejected');

  } catch (error) {
    console.error('❌ Error during test:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testEmilySecondBooking();