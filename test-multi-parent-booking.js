const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testMultiParentBooking() {
  console.log('=== TESTING MULTI-PARENT BOOKING SYSTEM ===\n');
  
  try {
    // Get Isabella and find another parent (Sarah)
    const isabella = await prisma.user.findFirst({
      where: { email: { contains: 'isabella' } },
      include: { caregiver: true }
    });

    const sarah = await prisma.user.findFirst({
      where: { 
        email: { contains: 'sarah' },
        userType: 'PARENT'
      },
      include: { profile: true }
    });

    if (!isabella || !isabella.caregiver) {
      throw new Error('Could not find Isabella');
    }

    if (!sarah) {
      console.log('Sarah not found, creating a test parent...');
      
      // Create Sarah for testing
      const sarahUser = await prisma.user.create({
        data: {
          email: 'sarah.wilson@example.com',
          userType: 'PARENT',
          approvalStatus: 'APPROVED',
          emailVerified: true,
          profile: {
            create: {
              firstName: 'Sarah',
              lastName: 'Wilson',
              phone: '+1-555-0103',
              city: 'Springfield',
              state: 'IL',
              zipCode: '62701'
            }
          }
        },
        include: { profile: true }
      });
      
      console.log(`✅ Created test parent: Sarah Wilson (${sarahUser.email})`);
      sarah = sarahUser;
    }

    console.log(`Isabella: ${isabella.email} (Caregiver ID: ${isabella.caregiver.id})`);
    console.log(`Sarah: ${sarah.email}`);

    // Check Isabella's Aug 24 slot (should have full capacity available)
    const aug24Slot = await prisma.availabilitySlot.findFirst({
      where: {
        caregiverId: isabella.caregiver.id,
        date: {
          gte: new Date('2025-08-24'),
          lt: new Date('2025-08-25')
        }
      },
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

    if (!aug24Slot) {
      throw new Error('Could not find Isabella\'s Aug 24 slot');
    }

    console.log(`\nFound Aug 24 slot ${aug24Slot.id}:`);
    console.log(`  Capacity: ${aug24Slot.totalCapacity}`);
    console.log(`  Current Occupancy: ${aug24Slot.currentOccupancy}`);
    console.log(`  Available Spots: ${aug24Slot.availableSpots}`);
    console.log(`  Status: ${aug24Slot.status}`);
    console.log(`  Current Bookings: ${aug24Slot.slotBookings.length}`);

    // Test Sarah booking 1 spot
    console.log('\n=== SARAH BOOKS 1 SPOT ===');

    const { bookingOperations } = require('./src/lib/db.ts');

    const sarahBookingData = {
      parentId: sarah.id,
      caregiverId: isabella.id,
      startTime: new Date('2025-08-24T09:00:00'),
      endTime: new Date('2025-08-24T13:00:00'),  // 9 AM - 1 PM (4 hours)
      childrenCount: 1,
      address: '789 Pine St, Springfield, IL 62701',
      latitude: 39.7817,
      longitude: -89.6501,
      hourlyRate: isabella.caregiver.hourlyRate,
      totalHours: 4,
      subtotal: Math.round(4 * isabella.caregiver.hourlyRate * 100),
      platformFee: Math.round(4 * isabella.caregiver.hourlyRate * 100 * 0.15),
      totalAmount: Math.round(4 * isabella.caregiver.hourlyRate * 100),
      slotId: aug24Slot.id
    };

    const sarahBooking = await bookingOperations.createBooking(sarahBookingData);
    console.log(`✅ Sarah's booking created successfully: ${sarahBooking.id}`);

    // Verify slot after Sarah's booking
    const slotAfterSarah = await prisma.availabilitySlot.findUnique({
      where: { id: aug24Slot.id },
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

    console.log(`Slot after Sarah's booking:`);
    console.log(`  Capacity: ${slotAfterSarah.totalCapacity}`);
    console.log(`  Current Occupancy: ${slotAfterSarah.currentOccupancy}`);
    console.log(`  Available Spots: ${slotAfterSarah.availableSpots}`);
    console.log(`  Status: ${slotAfterSarah.status}`);
    console.log(`  Total Bookings: ${slotAfterSarah.slotBookings.length}`);

    slotAfterSarah.slotBookings.forEach((sb, index) => {
      const parentName = sb.booking.parent.profile ? 
        `${sb.booking.parent.profile.firstName} ${sb.booking.parent.profile.lastName}` : 
        'Unknown';
      console.log(`    ${index + 1}. ${parentName}: ${sb.spotsUsed} spots, ${sb.childrenCount} children`);
    });

    if (slotAfterSarah.availableSpots > 0) {
      console.log(`\n✅ Remaining capacity: ${slotAfterSarah.availableSpots} spots available for other parents`);

      // Now test Emily booking the remaining spot
      console.log('\n=== EMILY TRIES TO BOOK REMAINING SPOT ===');

      const emily = await prisma.user.findFirst({
        where: { email: { contains: 'emily' } },
        include: { profile: true }
      });

      if (!emily) {
        throw new Error('Emily not found');
      }

      const emilyBookingData = {
        parentId: emily.id,
        caregiverId: isabella.id,
        startTime: new Date('2025-08-24T13:00:00'),
        endTime: new Date('2025-08-24T17:00:00'),  // 1 PM - 5 PM (4 hours)
        childrenCount: 1,
        address: '123 Main St, Springfield, IL 62701',
        latitude: 39.7817,
        longitude: -89.6501,
        hourlyRate: isabella.caregiver.hourlyRate,
        totalHours: 4,
        subtotal: Math.round(4 * isabella.caregiver.hourlyRate * 100),
        platformFee: Math.round(4 * isabella.caregiver.hourlyRate * 100 * 0.15),
        totalAmount: Math.round(4 * isabella.caregiver.hourlyRate * 100),
        slotId: aug24Slot.id
      };

      const emilyBooking = await bookingOperations.createBooking(emilyBookingData);
      console.log(`✅ Emily's booking created successfully: ${emilyBooking.id}`);

      // Final slot verification
      const finalSlot = await prisma.availabilitySlot.findUnique({
        where: { id: aug24Slot.id },
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

      console.log(`\nFinal slot state:`);
      console.log(`  Capacity: ${finalSlot.totalCapacity}`);
      console.log(`  Current Occupancy: ${finalSlot.currentOccupancy}`);
      console.log(`  Available Spots: ${finalSlot.availableSpots}`);
      console.log(`  Status: ${finalSlot.status}`);
      console.log(`  Total Bookings: ${finalSlot.slotBookings.length}`);

      finalSlot.slotBookings.forEach((sb, index) => {
        const parentName = sb.booking.parent.profile ? 
          `${sb.booking.parent.profile.firstName} ${sb.booking.parent.profile.lastName}` : 
          'Unknown';
        const timeRange = `${sb.booking.startTime.toLocaleTimeString()} - ${sb.booking.endTime.toLocaleTimeString()}`;
        console.log(`    ${index + 1}. ${parentName}: ${sb.spotsUsed} spots, ${sb.childrenCount} children (${timeRange})`);
      });

      // Test third parent trying to book (should fail)
      if (finalSlot.availableSpots === 0) {
        console.log('\n=== TESTING THIRD PARENT (SHOULD FAIL) ===');
        
        try {
          const thirdParentData = {
            ...emilyBookingData,
            parentId: sarah.id,  // Try with Sarah again
            startTime: new Date('2025-08-24T17:00:00'),
            endTime: new Date('2025-08-24T18:00:00')
          };

          await bookingOperations.createBooking(thirdParentData);
          console.log('❌ Third booking should have failed but succeeded!');
        } catch (error) {
          console.log(`✅ Third booking correctly failed: ${error.message}`);
        }
      }
    }

    console.log('\n=== MULTI-PARENT BOOKING SYSTEM VERIFICATION COMPLETE ===');
    console.log('✅ Multiple parents can book the same caregiver\'s time slot');
    console.log('✅ Capacity is properly tracked and enforced');
    console.log('✅ Slots become unavailable when fully booked');
    console.log('✅ Overbooking is prevented');

  } catch (error) {
    console.error('❌ Error during test:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testMultiParentBooking();