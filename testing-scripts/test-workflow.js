#!/usr/bin/env node
/**
 * Test complete InstaCares workflow including booking and messaging
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCompleteWorkflow() {
  console.log('🧪 Testing complete InstaCares workflow...');

  try {
    // Get the test accounts
    const parentAccount = await prisma.user.findUnique({
      where: { email: 'test.parent@instacares.com' },
      include: { 
        profile: true, 
        children: true,
        emergencyContacts: true
      }
    });

    const caregiverAccount = await prisma.user.findUnique({
      where: { email: 'test.caregiver@instacares.com' },
      include: { 
        profile: true, 
        caregiver: true 
      }
    });

    if (!parentAccount || !caregiverAccount) {
      throw new Error('Test accounts not found. Please run setup scripts first.');
    }

    console.log(`\n✅ Test accounts ready:`);
    console.log(`Parent: ${parentAccount.profile.firstName} ${parentAccount.profile.lastName}`);
    console.log(`Caregiver: ${caregiverAccount.profile.firstName} ${caregiverAccount.profile.lastName}`);
    console.log(`Children: ${parentAccount.children.map(c => c.firstName).join(', ')}`);

    // 1. CREATE A TEST BOOKING
    console.log(`\n📅 Creating test booking...`);
    
    const bookingDate = new Date();
    bookingDate.setDate(bookingDate.getDate() + 3); // 3 days from now
    bookingDate.setHours(14, 0, 0, 0); // 2:00 PM

    const endTime = new Date(bookingDate);
    endTime.setHours(18, 0, 0, 0); // 6:00 PM

    const hourlyRate = caregiverAccount.caregiver.hourlyRate;
    const duration = 4; // 4 hours
    const totalAmount = Math.round(hourlyRate * duration * 100); // Convert to cents
    const platformFee = Math.round(totalAmount * 0.15); // 15% platform fee
    const caregiverPayout = totalAmount - platformFee;

    const booking = await prisma.booking.create({
      data: {
        parentId: parentAccount.id,
        caregiverId: caregiverAccount.id,
        startTime: bookingDate,
        endTime: endTime,
        hourlyRate: hourlyRate,
        totalHours: duration,
        childrenCount: parentAccount.children.length,
        subtotal: totalAmount - platformFee,
        platformFee: platformFee,
        totalAmount: totalAmount,
        status: 'PENDING',
        specialRequests: `Test booking for ${parentAccount.children.map(c => c.firstName).join(' and ')}. Please follow their usual routines as noted in their profiles.`,
        address: `${parentAccount.profile.streetAddress}, ${parentAccount.profile.city}, ${parentAccount.profile.state}`,
        latitude: parentAccount.profile.latitude,
        longitude: parentAccount.profile.longitude
      },
      include: {
        parent: { include: { profile: true } },
        caregiverProfile: { include: { user: { include: { profile: true } } } }
      }
    });

    console.log(`✅ Booking created: ID ${booking.id}`);
    console.log(`   Date: ${bookingDate.toLocaleDateString()} from ${bookingDate.toLocaleTimeString()} to ${endTime.toLocaleTimeString()}`);
    console.log(`   Location: ${booking.address}`);
    console.log(`   Duration: ${duration} hours`);
    console.log(`   Total: $${(totalAmount / 100).toFixed(2)}`);
    console.log(`   Platform Fee: $${(platformFee / 100).toFixed(2)}`);
    console.log(`   Caregiver Payout: $${(caregiverPayout / 100).toFixed(2)}`);

    // 2. CREATE CHAT ROOM FOR COMMUNICATION
    console.log(`\n💬 Setting up chat room...`);

    const chatRoom = await prisma.chatRoom.create({
      data: {
        bookingId: booking.id,
        parentId: parentAccount.id,
        caregiverId: caregiverAccount.id,
        isActive: true,
        lastMessageAt: new Date()
      }
    });

    console.log(`✅ Chat room created: ID ${chatRoom.id}`);

    // 3. SIMULATE MESSAGING EXCHANGE
    console.log(`\n📱 Simulating message exchange...`);

    // Parent sends initial message
    const message1 = await prisma.message.create({
      data: {
        chatRoomId: chatRoom.id,
        senderId: parentAccount.id,
        content: `Hi Jessica! Thank you for accepting our booking. I'm excited to have you care for Emma and Lucas on ${bookingDate.toLocaleDateString()}. A few quick notes: Emma loves reading and Lucas takes a nap around 1 PM. Both kids are friendly and well-behaved. Looking forward to meeting you!`,
        messageType: 'TEXT',
        isRead: false
      }
    });

    // Caregiver responds
    const message2 = await prisma.message.create({
      data: {
        chatRoomId: chatRoom.id,
        senderId: caregiverAccount.id,
        content: `Hi Sarah! I'm so looking forward to caring for Emma and Lucas. Thank you for the details about their routines. I have some great books and activities planned. I'll make sure Lucas gets his nap. Should I bring anything specific, or is everything provided at your home?`,
        messageType: 'TEXT',
        isRead: false
      }
    });

    // Parent provides more details
    const message3 = await prisma.message.create({
      data: {
        chatRoomId: chatRoom.id,
        senderId: parentAccount.id,
        content: `Everything is provided at home - snacks, toys, books, etc. Lucas has his inhaler in the kitchen if needed (though he rarely needs it). Emergency contacts are in the system. My husband Michael will be available by phone if needed. See you Saturday!`,
        messageType: 'TEXT',
        isRead: false
      }
    });

    console.log(`✅ Messages exchanged:`);
    console.log(`   1. Parent message: "${message1.content.substring(0, 50)}..."`);
    console.log(`   2. Caregiver message: "${message2.content.substring(0, 50)}..."`);
    console.log(`   3. Parent message: "${message3.content.substring(0, 50)}..."`);

    // 4. CAREGIVER ACCEPTS BOOKING
    console.log(`\n✅ Updating booking status...`);

    const acceptedBooking = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log(`✅ Booking confirmed by caregiver`);

    // 5. CREATE SOME NOTIFICATIONS
    console.log(`\n🔔 Creating notifications...`);

    // Notification to parent about booking confirmation
    await prisma.notification.create({
      data: {
        userId: parentAccount.id,
        title: 'Booking Confirmed!',
        message: `${caregiverAccount.profile.firstName} has confirmed your booking for ${bookingDate.toLocaleDateString()}`,
        type: 'BOOKING_CONFIRMED',
        resourceType: 'booking',
        resourceId: booking.id,
        isRead: false
      }
    });

    // Notification to caregiver about new message
    await prisma.notification.create({
      data: {
        userId: caregiverAccount.id,
        title: 'New Message',
        message: `${parentAccount.profile.firstName} sent you a message about your upcoming booking`,
        type: 'NEW_MESSAGE',
        resourceType: 'chat',
        resourceId: chatRoom.id,
        isRead: false
      }
    });

    console.log(`✅ Notifications created`);

    // 6. GENERATE WORKFLOW SUMMARY
    console.log(`\n🎉 COMPLETE WORKFLOW TEST SUCCESSFUL!`);
    console.log(`\n📊 SUMMARY:`);
    console.log(`=====================================`);
    console.log(`👨‍👩‍👧‍👦 PARENT ACCOUNT (${parentAccount.email})`);
    console.log(`   Name: ${parentAccount.profile.firstName} ${parentAccount.profile.lastName}`);
    console.log(`   Phone: ${parentAccount.profile.phone}`);
    console.log(`   Address: ${parentAccount.profile.streetAddress}, ${parentAccount.profile.city}, ${parentAccount.profile.state}`);
    console.log(`   Children: ${parentAccount.children.map(c => `${c.firstName} (${c.gender}, Age ${Math.floor((Date.now() - new Date(c.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))})`).join(', ')}`);
    console.log(`   Emergency: ${parentAccount.emergencyContacts[0]?.name} - ${parentAccount.emergencyContacts[0]?.phoneNumber}`);
    
    console.log(`\n👶 CAREGIVER ACCOUNT (${caregiverAccount.email})`);
    console.log(`   Name: ${caregiverAccount.profile.firstName} ${caregiverAccount.profile.lastName}`);
    console.log(`   Phone: ${caregiverAccount.profile.phone}`);
    console.log(`   Rate: $${caregiverAccount.caregiver.hourlyRate}/hour`);
    console.log(`   Experience: ${caregiverAccount.caregiver.experienceYears} years`);
    console.log(`   Address: ${caregiverAccount.profile.streetAddress}, ${caregiverAccount.profile.city}, ${caregiverAccount.profile.state}`);
    console.log(`   Background Check: ${caregiverAccount.caregiver.backgroundCheck ? '✅ Yes' : '❌ No'}`);
    
    console.log(`\n📅 BOOKING DETAILS`);
    console.log(`   Booking ID: ${booking.id}`);
    console.log(`   Date & Time: ${bookingDate.toLocaleDateString()} from ${bookingDate.toLocaleTimeString()} to ${endTime.toLocaleTimeString()}`);
    console.log(`   Duration: ${duration} hours`);
    console.log(`   Children: ${parentAccount.children.length} (${parentAccount.children.map(c => c.firstName).join(', ')})`);
    console.log(`   Location: ${booking.address}`);
    console.log(`   Total Cost: $${(totalAmount / 100).toFixed(2)}`);
    console.log(`   Platform Fee (15%): $${(platformFee / 100).toFixed(2)}`);
    console.log(`   Caregiver Payout: $${(caregiverPayout / 100).toFixed(2)}`);
    console.log(`   Status: ${acceptedBooking.status}`);
    
    console.log(`\n💬 MESSAGING`);
    console.log(`   Chat Room ID: ${chatRoom.id}`);
    console.log(`   Messages Exchanged: 3`);
    console.log(`   Last Activity: ${chatRoom.lastMessageAt?.toLocaleString() || 'N/A'}`);
    
    console.log(`\n🔔 NOTIFICATIONS: Created for both parties`);

    return {
      accounts: {
        parent: {
          id: parentAccount.id,
          email: parentAccount.email,
          name: `${parentAccount.profile.firstName} ${parentAccount.profile.lastName}`,
          phone: parentAccount.profile.phone,
          address: `${parentAccount.profile.streetAddress}, ${parentAccount.profile.city}, ${parentAccount.profile.state}`,
          children: parentAccount.children.length
        },
        caregiver: {
          id: caregiverAccount.id,
          email: caregiverAccount.email,
          name: `${caregiverAccount.profile.firstName} ${caregiverAccount.profile.lastName}`,
          phone: caregiverAccount.profile.phone,
          rate: caregiverAccount.caregiver.hourlyRate,
          address: `${caregiverAccount.profile.streetAddress}, ${caregiverAccount.profile.city}, ${caregiverAccount.profile.state}`
        }
      },
      booking: {
        id: booking.id,
        date: bookingDate.toISOString(),
        duration: duration,
        status: acceptedBooking.status,
        total: totalAmount / 100
      },
      chatRoom: {
        id: chatRoom.id,
        messages: 3
      }
    };

  } catch (error) {
    console.error('❌ Error during workflow test:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  testCompleteWorkflow()
    .then((result) => {
      console.log('\n🏁 Workflow testing completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Workflow test failed:', error);
      process.exit(1);
    });
}

module.exports = testCompleteWorkflow;