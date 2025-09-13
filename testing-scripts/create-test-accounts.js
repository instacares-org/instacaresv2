#!/usr/bin/env node
/**
 * Create complete test accounts for InstaCares workflow testing
 * Creates: Parent with child + Caregiver with full profiles
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestAccounts() {
  console.log('🚀 Creating comprehensive test accounts...');

  try {
    // 1. CREATE PARENT ACCOUNT
    console.log('\n👨‍👩‍👧 Creating parent account...');
    
    const parent = await prisma.user.create({
      data: {
        email: 'test.parent@instacares.com',
        name: 'Sarah Johnson',
        userType: 'PARENT',
        approvalStatus: 'PENDING',
        isActive: true,
        emailVerified: new Date(),
        profile: {
          create: {
            firstName: 'Sarah',
            lastName: 'Johnson',
            phone: '+1-647-555-0123',
            dateOfBirth: new Date('1985-03-15'),
            streetAddress: '123 Maple Street',
            apartment: 'Unit 4B',
            city: 'Toronto',
            state: 'Ontario',
            zipCode: 'M5V 2T6',
            country: 'Canada',
            latitude: 43.6426,
            longitude: -79.3871,
            emergencyName: 'Michael Johnson',
            emergencyPhone: '+1-647-555-0124',
            emergencyRelation: 'Spouse'
          }
        },
        children: {
          create: [
            {
              firstName: 'Emma',
              lastName: 'Johnson',
              dateOfBirth: new Date('2019-08-22'), // 5 years old
              gender: 'FEMALE',
              allergies: ['Peanut allergy (severe)'],
              medicalConditions: ['None'],
              specialInstructions: 'Loves reading books and playing with dolls. Bedtime is 7:30 PM.',
              emergencyContacts: [{ name: 'Michael Johnson', phone: '+1-647-555-0124' }]
            },
            {
              firstName: 'Lucas',
              lastName: 'Johnson',
              dateOfBirth: new Date('2021-12-10'), // 3 years old
              gender: 'MALE',
              allergies: ['None'],
              medicalConditions: ['Mild asthma - inhaler available'],
              medications: ['Ventolin inhaler - as needed for breathing'],
              specialInstructions: 'Very active, loves trucks and outdoor play. Takes afternoon nap at 1 PM.',
              emergencyContacts: [{ name: 'Michael Johnson', phone: '+1-647-555-0124' }]
            }
          ]
        },
        emergencyContacts: {
          create: [
            {
              name: 'Michael Johnson',
              relationship: 'Spouse',
              phoneNumber: '+1-647-555-0124',
              email: 'michael.johnson@email.com',
              priority: 1,
              canPickup: true,
              canMakeDecisions: true
            },
            {
              name: 'Linda Thompson',
              relationship: 'Mother',
              phoneNumber: '+1-647-555-0125',
              email: 'linda.thompson@email.com',
              priority: 2,
              canPickup: true,
              canMakeDecisions: false
            }
          ]
        }
      },
      include: {
        profile: true,
        children: true,
        emergencyContacts: true
      }
    });

    console.log(`✅ Parent created: ${parent.email} (ID: ${parent.id})`);
    console.log(`   Profile: ${parent.profile.firstName} ${parent.profile.lastName}`);
    console.log(`   Children: ${parent.children.length} kids`);
    console.log(`   Address: ${parent.profile.streetAddress}, ${parent.profile.city}, ${parent.profile.state}`);

    // 2. CREATE CAREGIVER ACCOUNT
    console.log('\n👶 Creating caregiver account...');
    
    const caregiver = await prisma.user.create({
      data: {
        email: 'test.caregiver@instacares.com',
        name: 'Jessica Martinez',
        userType: 'CAREGIVER',
        approvalStatus: 'PENDING',
        isActive: true,
        emailVerified: new Date(),
        profile: {
          create: {
            firstName: 'Jessica',
            lastName: 'Martinez',
            phone: '+1-416-555-0987',
            dateOfBirth: new Date('1992-07-28'),
            streetAddress: '456 Oak Avenue',
            apartment: 'Apt 12',
            city: 'Mississauga',
            state: 'Ontario',
            zipCode: 'L5B 3C1',
            country: 'Canada',
            latitude: 43.5890,
            longitude: -79.6441,
            emergencyName: 'Carlos Martinez',
            emergencyPhone: '+1-416-555-0988',
            emergencyRelation: 'Brother'
          }
        },
        caregiver: {
          create: {
            hourlyRate: 28.50,
            experienceYears: 6,
            bio: "Hi! I'm Jessica, a passionate childcare provider with 6+ years of experience caring for children aged 6 months to 12 years. I have my ECE certificate and CPR/First Aid training. I love creating fun, educational activities and providing a safe, nurturing environment for children. I'm fluent in English and Spanish, and I'm comfortable with pets. I believe in positive reinforcement and helping children develop their creativity and confidence.",
            languages: ['English', 'Spanish'],
            availability: {
              monday: { available: true, start: '07:00', end: '19:00' },
              tuesday: { available: true, start: '07:00', end: '19:00' },
              wednesday: { available: true, start: '07:00', end: '19:00' },
              thursday: { available: true, start: '07:00', end: '19:00' },
              friday: { available: true, start: '07:00', end: '19:00' },
              saturday: { available: true, start: '09:00', end: '17:00' },
              sunday: { available: false, start: null, end: null }
            },
            maxChildren: 4,
            minAge: 6, // 6 months
            maxAge: 144, // 12 years in months
            isVerified: false,
            backgroundCheck: true,
            backgroundCheckDate: new Date('2024-01-15'),
            isAvailable: true,
            canReceivePayments: false,
            stripeOnboarded: false
          }
        }
      },
      include: {
        profile: true,
        caregiver: true
      }
    });

    console.log(`✅ Caregiver created: ${caregiver.email} (ID: ${caregiver.id})`);
    console.log(`   Profile: ${caregiver.profile.firstName} ${caregiver.profile.lastName}`);
    console.log(`   Rate: $${caregiver.caregiver.hourlyRate}/hour`);
    console.log(`   Experience: ${caregiver.caregiver.experienceYears} years`);
    console.log(`   Address: ${caregiver.profile.streetAddress}, ${caregiver.profile.city}, ${caregiver.profile.state}`);

    console.log('\n📋 TEST ACCOUNT SUMMARY:');
    console.log('=' .repeat(50));
    console.log('PARENT ACCOUNT:');
    console.log(`Email: ${parent.email}`);
    console.log(`Password: No password (OAuth login)`);
    console.log(`Name: ${parent.profile.firstName} ${parent.profile.lastName}`);
    console.log(`Phone: ${parent.profile.phone}`);
    console.log(`Address: ${parent.profile.streetAddress}, ${parent.profile.apartment}`);
    console.log(`         ${parent.profile.city}, ${parent.profile.state} ${parent.profile.zipCode}`);
    console.log(`Children: ${parent.children.map(child => `${child.firstName} (${child.gender}, Age: ${Math.floor((Date.now() - new Date(child.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))})`).join(', ')}`);
    
    console.log('\nCAREGIVER ACCOUNT:');
    console.log(`Email: ${caregiver.email}`);
    console.log(`Password: No password (OAuth login)`);
    console.log(`Name: ${caregiver.profile.firstName} ${caregiver.profile.lastName}`);
    console.log(`Phone: ${caregiver.profile.phone}`);
    console.log(`Rate: $${caregiver.caregiver.hourlyRate}/hour`);
    console.log(`Experience: ${caregiver.caregiver.experienceYears} years`);
    console.log(`Address: ${caregiver.profile.streetAddress}, ${caregiver.profile.apartment}`);
    console.log(`         ${caregiver.profile.city}, ${caregiver.profile.state} ${caregiver.profile.zipCode}`);

    console.log('\n⚠️  NEXT STEPS:');
    console.log('1. Admin needs to APPROVE both accounts');
    console.log('2. Test OAuth login for both accounts');
    console.log('3. Test booking workflow');
    console.log('4. Test messaging system');
    
    return {
      parent: {
        id: parent.id,
        email: parent.email,
        name: parent.name,
        profile: parent.profile,
        children: parent.children
      },
      caregiver: {
        id: caregiver.id,
        email: caregiver.email,
        name: caregiver.name,
        profile: caregiver.profile,
        caregiverProfile: caregiver.caregiver
      }
    };

  } catch (error) {
    console.error('❌ Error creating test accounts:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  createTestAccounts()
    .then((accounts) => {
      console.log('\n🎉 Test accounts created successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Failed to create test accounts:', error);
      process.exit(1);
    });
}

module.exports = createTestAccounts;