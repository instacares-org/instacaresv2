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
            bio: 'Passionate about early childhood education. I specialize in infant and toddler care with a focus on developmental milestones and creative play. Fluent in English and French.',
            languages: ['English', 'French'],
            specializations: ['Infant Care', 'Special Needs', 'Educational Activities'],
            certifications: ['ECE Certification', 'First Aid', 'CPR'],
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
            acceptsInfants: true,
            instantBooking: true,
            cancellationPolicy: '24 hours notice required for cancellations',
            additionalServices: ['Meal Preparation', 'Light Housekeeping', 'Pet Friendly'],
            holidayAvailability: false,
            overnightCare: false,
            weekendAvailability: true,
            emergencyAvailable: false,
            transportationAvailable: false,
            hasVehicle: true,
            smokingHousehold: false,
            hasPets: true,
            petDescription: 'One friendly golden retriever',
            childcareExperience: 'Professional nanny and daycare assistant experience',
            educationLevel: 'College Diploma in Early Childhood Education',
            additionalQualifications: 'Montessori training, Music therapy basics',
            interests: 'Arts and crafts, outdoor activities, reading',
            preferredAgeGroups: ['Toddler', 'Preschool'],
            dailyCapacity: 4,
            enableDynamicPricing: true,
            dynamicPricingRules: {
              peakHours: { rate: 30.00, hours: ['17:00-20:00'] },
              weekends: { rate: 28.00 },
              lastMinute: { rate: 35.00 }
            },
            stripeAccountId: null,
            stripeOnboardingComplete: false,
            payoutEnabled: false,
            documentsVerified: true,
            backgroundCheckStatus: 'APPROVED',
            backgroundCheckDate: new Date('2024-01-15'),
            insuranceStatus: 'VERIFIED',
            insuranceExpiryDate: new Date('2025-12-31'),
            governmentIdStatus: 'VERIFIED',
            governmentIdType: 'DRIVERS_LICENSE',
            licenseNumber: 'J6789-12345-67890',
            isAvailable: true,
            responseTime: 30,
            averageRating: 4.8,
            totalReviews: 15,
            totalBookings: 45,
            completedBookings: 42,
            cancelledBookings: 3,
            memberSince: new Date('2023-06-15')
          }
        }
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
        },
        parent: {
          create: {
            numberOfChildren: 2,
            childrenAges: [3, 6],
            specialNeeds: false,
            specialNeedsDescription: null,
            emergencyContact: 'Emma Chen - +1-416-555-0303',
            preferredActivities: ['Educational Games', 'Outdoor Play', 'Reading'],
            dietaryRestrictions: 'Vegetarian household',
            allergies: 'Peanut allergy (6-year-old)',
            medications: 'None',
            behavioralNotes: 'Both children are friendly and well-behaved. The younger one needs a nap after lunch.',
            languages: ['English', 'Mandarin'],
            petInfo: 'No pets',
            transportationNeeds: false,
            parkingAvailable: true,
            homeType: 'Condo',
            neighborhoodDescription: 'Safe downtown neighborhood with nearby parks',
            nearbyAmenities: ['Playground 2 blocks away', 'Library nearby', 'Community center'],
            houseRules: 'No screen time during care hours, healthy snacks only',
            preferredCommunication: 'Text message',
            workSchedule: 'Monday to Friday, 9 AM - 5 PM',
            additionalInfo: 'We prefer caregivers who can engage children in educational activities',
            memberSince: new Date('2024-02-01')
          }
        },
        children: {
          create: [
            {
              firstName: 'Lily',
              lastName: 'Chen',
              dateOfBirth: new Date('2021-03-15'),
              gender: 'FEMALE',
              allergies: 'Peanuts',
              medications: null,
              specialNeeds: null,
              notes: 'Loves puzzles and drawing. Needs afternoon nap around 1 PM.',
              emergencyContact: 'Emma Chen (Grandmother) - +1-416-555-0303',
              medicalInfo: 'Up to date on all vaccinations',
              interests: 'Art, puzzles, story time',
              routine: 'Breakfast 8am, Snack 10am, Lunch 12pm, Nap 1pm, Snack 3pm'
            },
            {
              firstName: 'Oliver',
              lastName: 'Chen', 
              dateOfBirth: new Date('2018-09-22'),
              gender: 'MALE',
              allergies: null,
              medications: null,
              specialNeeds: null,
              notes: 'Very active, enjoys sports and building blocks. Learning to read.',
              emergencyContact: 'Emma Chen (Grandmother) - +1-416-555-0303',
              medicalInfo: 'Up to date on all vaccinations',
              interests: 'Soccer, building blocks, science experiments',
              routine: 'Breakfast 8am, Snack 10am, Lunch 12pm, Quiet time 1pm, Snack 3pm'
            }
          ]
        }
      }
    });

    console.log('✅ Parent Account Created:');
    console.log('   Email: michael.chen@testmail.ca');
    console.log('   Password: TestParent123!');
    console.log('   Location: Toronto, ON, Canada');
    console.log('   Children: 2 (Ages 3 and 6)');
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
          specialRequirements: null,
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
          specialRequirements: null,
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
    console.log('Email: sarah.johnson@testmail.ca');
    console.log('Password: TestCaregiver123!');
    console.log('');
    console.log('PARENT CREDENTIALS:');
    console.log('Email: michael.chen@testmail.ca');
    console.log('Password: TestParent123!');
    console.log('');
    console.log('Both accounts are:');
    console.log('- Located in Toronto, Ontario, Canada');
    console.log('- Fully approved and active');
    console.log('- Ready for testing');
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