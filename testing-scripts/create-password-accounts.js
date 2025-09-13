#!/usr/bin/env node
/**
 * Create test accounts with email/password authentication
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function createPasswordAccounts() {
  console.log('🔐 Creating test accounts with passwords...');

  try {
    // Hash passwords
    const parentPassword = await bcrypt.hash('TestParent123!', 12);
    const caregiverPassword = await bcrypt.hash('TestCaregiver123!', 12);

    // 1. CREATE PARENT ACCOUNT WITH PASSWORD
    console.log('\n👨‍👩‍👧 Creating parent account with password...');
    
    const parent = await prisma.user.create({
      data: {
        email: 'parent.test@instacares.com',
        passwordHash: parentPassword,
        name: 'Michael & Sarah Thompson',
        userType: 'PARENT',
        approvalStatus: 'APPROVED',
        isActive: true,
        emailVerified: new Date(),
        profile: {
          create: {
            firstName: 'Sarah',
            lastName: 'Thompson',
            phone: '+1-647-555-1234',
            dateOfBirth: new Date('1987-05-12'),
            streetAddress: '789 Queen Street West',
            apartment: 'Unit 15A',
            city: 'Toronto',
            state: 'Ontario',
            zipCode: 'M5H 2M9',
            country: 'Canada',
            latitude: 43.6505,
            longitude: -79.3889,
            emergencyName: 'Michael Thompson',
            emergencyPhone: '+1-647-555-1235',
            emergencyRelation: 'Spouse'
          }
        },
        children: {
          create: [
            {
              firstName: 'Oliver',
              lastName: 'Thompson',
              dateOfBirth: new Date('2018-03-15'), // 6 years old
              gender: 'MALE',
              allergies: ['None'],
              medicalConditions: ['None'],
              specialInstructions: 'Very curious and loves science experiments. Enjoys building with Lego and asking lots of questions. Bedtime routine includes reading.',
              emergencyContacts: [{ name: 'Michael Thompson', phone: '+1-647-555-1235' }]
            },
            {
              firstName: 'Sophia',
              lastName: 'Thompson',
              dateOfBirth: new Date('2020-11-08'), // 4 years old
              gender: 'FEMALE',
              allergies: ['Lactose intolerant'],
              medicalConditions: ['None'],
              dietaryRestrictions: ['Lactose-free milk and products'],
              specialInstructions: 'Loves arts and crafts, especially drawing and painting. Very social and enjoys playing dress-up. Takes a short nap after lunch.',
              emergencyContacts: [{ name: 'Michael Thompson', phone: '+1-647-555-1235' }]
            }
          ]
        },
        emergencyContacts: {
          create: [
            {
              name: 'Michael Thompson',
              relationship: 'Spouse',
              phoneNumber: '+1-647-555-1235',
              email: 'michael.thompson@email.com',
              priority: 1,
              canPickup: true,
              canMakeDecisions: true
            },
            {
              name: 'Patricia Thompson',
              relationship: 'Grandmother',
              phoneNumber: '+1-647-555-1236',
              email: 'patricia.thompson@email.com',
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

    console.log(`✅ Parent created: ${parent.email}`);

    // 2. CREATE CAREGIVER ACCOUNT WITH PASSWORD
    console.log('\n👶 Creating caregiver account with password...');
    
    const caregiver = await prisma.user.create({
      data: {
        email: 'caregiver.test@instacares.com',
        passwordHash: caregiverPassword,
        name: 'Amanda Rodriguez',
        userType: 'CAREGIVER',
        approvalStatus: 'APPROVED',
        isActive: true,
        emailVerified: new Date(),
        profile: {
          create: {
            firstName: 'Amanda',
            lastName: 'Rodriguez',
            phone: '+1-905-555-7890',
            dateOfBirth: new Date('1994-09-22'),
            streetAddress: '321 Lakeshore Boulevard',
            apartment: 'Suite 8B',
            city: 'Oakville',
            state: 'Ontario',
            zipCode: 'L6H 7R1',
            country: 'Canada',
            latitude: 43.4481,
            longitude: -79.6877,
            emergencyName: 'Maria Rodriguez',
            emergencyPhone: '+1-905-555-7891',
            emergencyRelation: 'Mother'
          }
        },
        caregiver: {
          create: {
            hourlyRate: 32.00,
            experienceYears: 8,
            bio: "Hello! I'm Amanda, a dedicated childcare professional with 8 years of experience working with children from infants to pre-teens. I hold a diploma in Early Childhood Education and am certified in CPR and First Aid. I speak English, Spanish, and French fluently. I love creating engaging, educational activities that help children learn while having fun. I'm passionate about outdoor play, arts and crafts, and helping children develop confidence and independence. I'm comfortable with pets and have experience with children with special needs.",
            languages: ['English', 'Spanish', 'French'],
            availability: {
              monday: { available: true, start: '06:30', end: '20:00' },
              tuesday: { available: true, start: '06:30', end: '20:00' },
              wednesday: { available: true, start: '06:30', end: '20:00' },
              thursday: { available: true, start: '06:30', end: '20:00' },
              friday: { available: true, start: '06:30', end: '20:00' },
              saturday: { available: true, start: '08:00', end: '18:00' },
              sunday: { available: true, start: '10:00', end: '16:00' }
            },
            maxChildren: 5,
            minAge: 3, // 3 months
            maxAge: 156, // 13 years in months
            isVerified: true,
            backgroundCheck: true,
            backgroundCheckDate: new Date('2024-02-01'),
            isAvailable: true,
            canReceivePayments: true,
            stripeOnboarded: true
          }
        }
      },
      include: {
        profile: true,
        caregiver: true
      }
    });

    console.log(`✅ Caregiver created: ${caregiver.email}`);

    // 3. CREATE A BOOKING BETWEEN THEM
    console.log(`\n📅 Creating test booking...`);
    
    const bookingDate = new Date();
    bookingDate.setDate(bookingDate.getDate() + 5); // 5 days from now
    bookingDate.setHours(15, 30, 0, 0); // 3:30 PM

    const endTime = new Date(bookingDate);
    endTime.setHours(19, 30, 0, 0); // 7:30 PM

    const hourlyRate = caregiver.caregiver.hourlyRate;
    const duration = 4; // 4 hours
    const totalAmount = Math.round(hourlyRate * duration * 100); // Convert to cents
    const platformFee = Math.round(totalAmount * 0.15); // 15% platform fee

    const booking = await prisma.booking.create({
      data: {
        parentId: parent.id,
        caregiverId: caregiver.id,
        startTime: bookingDate,
        endTime: endTime,
        hourlyRate: hourlyRate,
        totalHours: duration,
        childrenCount: parent.children.length,
        subtotal: totalAmount - platformFee,
        platformFee: platformFee,
        totalAmount: totalAmount,
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        specialRequests: `Childcare for Oliver and Sophia. Oliver loves science and building, Sophia enjoys arts and crafts. Please note Sophia is lactose intolerant - lactose-free milk in fridge.`,
        address: `${parent.profile.streetAddress}, ${parent.profile.city}, ${parent.profile.state}`,
        latitude: parent.profile.latitude,
        longitude: parent.profile.longitude
      }
    });

    console.log(`✅ Booking created: ${booking.id}`);

    // 4. CREATE CHAT AND MESSAGES
    const chatRoom = await prisma.chatRoom.create({
      data: {
        bookingId: booking.id,
        parentId: parent.id,
        caregiverId: caregiver.id,
        isActive: true,
        lastMessageAt: new Date()
      }
    });

    await prisma.message.create({
      data: {
        chatRoomId: chatRoom.id,
        senderId: parent.id,
        content: `Hi Amanda! Looking forward to having you care for Oliver and Sophia on ${bookingDate.toLocaleDateString()}. Just a reminder that Sophia is lactose intolerant - there's lactose-free milk in the fridge. Both kids are excited to meet you!`,
        messageType: 'TEXT',
        isRead: false
      }
    });

    await prisma.message.create({
      data: {
        chatRoomId: chatRoom.id,
        senderId: caregiver.id,
        content: `Hi Sarah! Thank you for the reminder about Sophia's lactose intolerance - I'll make sure to check all snacks and drinks. I'm really looking forward to spending time with Oliver and Sophia. I've planned some fun science activities for Oliver and art projects for Sophia. See you soon!`,
        messageType: 'TEXT',
        isRead: false
      }
    });

    console.log(`✅ Chat room and messages created`);

    console.log(`\n🎉 PASSWORD-BASED TEST ACCOUNTS READY!`);
    console.log(`\n📋 LOGIN CREDENTIALS:`);
    console.log(`=====================================`);
    console.log(`👨‍👩‍👧‍👦 PARENT ACCOUNT:`);
    console.log(`Email: ${parent.email}`);
    console.log(`Password: TestParent123!`);
    console.log(`Name: ${parent.profile.firstName} ${parent.profile.lastName}`);
    console.log(`Children: ${parent.children.map(c => `${c.firstName} (${c.gender}, Age ${Math.floor((Date.now() - new Date(c.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))})`).join(', ')}`);
    console.log(`Address: ${parent.profile.streetAddress}, ${parent.profile.city}, ${parent.profile.state}`);
    
    console.log(`\n👶 CAREGIVER ACCOUNT:`);
    console.log(`Email: ${caregiver.email}`);
    console.log(`Password: TestCaregiver123!`);
    console.log(`Name: ${caregiver.profile.firstName} ${caregiver.profile.lastName}`);
    console.log(`Rate: $${caregiver.caregiver.hourlyRate}/hour`);
    console.log(`Experience: ${caregiver.caregiver.experienceYears} years`);
    console.log(`Languages: ${caregiver.caregiver.languages.join(', ')}`);
    console.log(`Address: ${caregiver.profile.streetAddress}, ${caregiver.profile.city}, ${caregiver.profile.state}`);

    console.log(`\n📅 SAMPLE BOOKING:`);
    console.log(`Booking ID: ${booking.id}`);
    console.log(`Date: ${bookingDate.toLocaleDateString()} from ${bookingDate.toLocaleTimeString()} to ${endTime.toLocaleTimeString()}`);
    console.log(`Total: $${(totalAmount / 100).toFixed(2)}`);
    console.log(`Status: ${booking.status}`);

    console.log(`\n💬 CHAT ROOM: ${chatRoom.id} (2 messages)`);

    return {
      parent: {
        email: parent.email,
        password: 'TestParent123!',
        name: `${parent.profile.firstName} ${parent.profile.lastName}`,
        id: parent.id
      },
      caregiver: {
        email: caregiver.email,
        password: 'TestCaregiver123!',
        name: `${caregiver.profile.firstName} ${caregiver.profile.lastName}`,
        id: caregiver.id
      },
      booking: {
        id: booking.id,
        date: bookingDate.toISOString(),
        total: totalAmount / 100
      }
    };

  } catch (error) {
    console.error('❌ Error creating password accounts:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  createPasswordAccounts()
    .then((accounts) => {
      console.log('\n🔐 Password-based test accounts created successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Failed to create password accounts:', error);
      process.exit(1);
    });
}

module.exports = createPasswordAccounts;