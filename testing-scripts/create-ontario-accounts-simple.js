const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestAccounts() {
  console.log('🇨🇦 Creating Ontario test accounts...\n');

  try {
    // Create Caregiver Account
    const caregiverPassword = 'TestCaregiver123!';
    const caregiverHashedPassword = await bcrypt.hash(caregiverPassword, 10);
    
    const caregiver = await prisma.user.create({
      data: {
        email: 'sarah.johnson@testmail.ca',
        passwordHash: caregiverHashedPassword,
        userType: 'CAREGIVER',
        approvalStatus: 'APPROVED',
        isActive: true,
        emailVerified: new Date(),
        profile: {
          create: {
            firstName: 'Sarah',
            lastName: 'Johnson',
            phone: '+1-416-555-0101',
            streetAddress: '123 Queen Street West',
            apartment: 'Unit 5B',
            city: 'Toronto',
            state: 'ON',
            zipCode: 'M5H 2M9',
            country: 'Canada',
            latitude: 43.6532,
            longitude: -79.3832
          }
        },
        caregiver: {
          create: {
            hourlyRate: 25.00,
            experienceYears: 8,
            bio: 'Experienced childcare provider with 8 years of experience in Toronto. ECE certified and first aid trained. Specializing in infant and toddler care with a focus on developmental milestones.',
            languages: ['English', 'French'],
            availability: {
              monday: { start: '08:00', end: '18:00' },
              tuesday: { start: '08:00', end: '18:00' },
              wednesday: { start: '08:00', end: '18:00' },
              thursday: { start: '08:00', end: '18:00' },
              friday: { start: '08:00', end: '18:00' }
            },
            maxChildren: 4,
            minAge: 0,
            maxAge: 12,
            dailyCapacity: 4,
            enableDynamicPricing: true,
            isVerified: true,
            backgroundCheck: true,
            backgroundCheckDate: new Date('2024-01-15'),
            isAvailable: true,
            averageRating: 4.8,
            totalBookings: 45
          }
        }
      },
      include: {
        caregiver: true,
        profile: true
      }
    });

    console.log('✅ Caregiver Account Created:');
    console.log('   Email: sarah.johnson@testmail.ca');
    console.log('   Password: TestCaregiver123!');
    console.log('   Location: Toronto, ON, Canada');
    console.log('   Hourly Rate: $25.00 CAD');
    console.log('');

    // Create Parent Account
    const parentPassword = 'TestParent123!';
    const parentHashedPassword = await bcrypt.hash(parentPassword, 10);
    
    const parent = await prisma.user.create({
      data: {
        email: 'michael.chen@testmail.ca',
        passwordHash: parentHashedPassword,
        userType: 'PARENT',
        approvalStatus: 'APPROVED',
        isActive: true,
        emailVerified: new Date(),
        profile: {
          create: {
            firstName: 'Michael',
            lastName: 'Chen',
            phone: '+1-416-555-0202',
            streetAddress: '456 King Street East',
            apartment: 'Suite 12A',
            city: 'Toronto',
            state: 'ON',
            zipCode: 'M5A 1L4',
            country: 'Canada',
            latitude: 43.6544,
            longitude: -79.3607
          }
        }
      },
      include: {
        profile: true
      }
    });

    console.log('✅ Parent Account Created:');
    console.log('   Email: michael.chen@testmail.ca');
    console.log('   Password: TestParent123!');
    console.log('   Location: Toronto, ON, Canada');
    console.log('');

    // Create children for the parent
    const child1 = await prisma.child.create({
      data: {
        parentId: parent.id,
        firstName: 'Lily',
        lastName: 'Chen',
        dateOfBirth: new Date('2021-03-15'),
        gender: 'FEMALE',
        allergies: 'Peanuts',
        notes: 'Loves puzzles and drawing. Needs afternoon nap around 1 PM.',
        emergencyContact: 'Emma Chen (Grandmother) - +1-416-555-0303'
      }
    });

    const child2 = await prisma.child.create({
      data: {
        parentId: parent.id,
        firstName: 'Oliver',
        lastName: 'Chen',
        dateOfBirth: new Date('2018-09-22'),
        gender: 'MALE',
        notes: 'Very active, enjoys sports and building blocks. Learning to read.',
        emergencyContact: 'Emma Chen (Grandmother) - +1-416-555-0303'
      }
    });

    console.log('✅ Created 2 children for parent:');
    console.log('   - Lily Chen (Age 3)');
    console.log('   - Oliver Chen (Age 6)');
    console.log('');

    // Create some availability slots for the caregiver
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const slotDate = new Date(tomorrow);
      slotDate.setDate(slotDate.getDate() + i);
      
      // Morning slot (8 AM - 12 PM)
      const morningStart = new Date(slotDate);
      morningStart.setHours(8, 0, 0, 0);
      const morningEnd = new Date(slotDate);
      morningEnd.setHours(12, 0, 0, 0);
      
      await prisma.availabilitySlot.create({
        data: {
          caregiverId: caregiver.caregiver.id,
          date: slotDate,
          startTime: morningStart,
          endTime: morningEnd,
          totalCapacity: 4,
          availableSpots: 4,
          currentOccupancy: 0,
          baseRate: 25.00,
          currentRate: 25.00,
          status: 'AVAILABLE',
          isRecurring: false,
          notes: 'Morning childcare slot'
        }
      });

      // Afternoon slot (1 PM - 5 PM)
      const afternoonStart = new Date(slotDate);
      afternoonStart.setHours(13, 0, 0, 0);
      const afternoonEnd = new Date(slotDate);
      afternoonEnd.setHours(17, 0, 0, 0);
      
      await prisma.availabilitySlot.create({
        data: {
          caregiverId: caregiver.caregiver.id,
          date: slotDate,
          startTime: afternoonStart,
          endTime: afternoonEnd,
          totalCapacity: 4,
          availableSpots: 4,
          currentOccupancy: 0,
          baseRate: 25.00,
          currentRate: 25.00,
          status: 'AVAILABLE',
          isRecurring: false,
          notes: 'Afternoon childcare slot'
        }
      });
    }

    console.log('✅ Created 14 availability slots for the next 7 days');
    console.log('');
    console.log('========================================');
    console.log('🎉 Test Accounts Successfully Created!');
    console.log('========================================');
    console.log('');
    console.log('CAREGIVER CREDENTIALS:');
    console.log('📧 Email: sarah.johnson@testmail.ca');
    console.log('🔑 Password: TestCaregiver123!');
    console.log('');
    console.log('PARENT CREDENTIALS:');
    console.log('📧 Email: michael.chen@testmail.ca');
    console.log('🔑 Password: TestParent123!');
    console.log('');
    console.log('Both accounts are:');
    console.log('✅ Located in Toronto, Ontario, Canada');
    console.log('✅ Fully approved and active');
    console.log('✅ Ready for testing');
    console.log('');
    console.log('The caregiver has availability slots created for the next 7 days.');
    console.log('You can now test the full booking workflow!');

  } catch (error) {
    console.error('Error creating test accounts:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestAccounts();