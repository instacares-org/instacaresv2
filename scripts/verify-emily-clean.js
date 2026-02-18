const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyEmilyClean() {
  console.log('🔍 Comprehensive verification of Emily Thompson\'s account cleanliness...\n');

  try {
    // Find Emily Thompson
    const emilyThompson = await prisma.user.findFirst({
      where: {
        email: 'emily.thompson@example.com'
      },
      include: {
        profile: true,
        caregiver: true,
        parentBookings: true,
        caregiverBookings: true,
        givenReviews: true,
        receivedReviews: true,
        parentChatRooms: true,
        caregiverChatRooms: true,
        sentMessages: true,
        children: true,
        emergencyContacts: true,
        notifications: true,
        manualPayouts: true
      }
    });

    if (!emilyThompson) {
      console.log('❌ Emily Thompson account not found!');
      return;
    }

    console.log('✅ EMILY THOMPSON ACCOUNT FOUND');
    console.log('═'.repeat(50));
    console.log(`👤 Name: ${emilyThompson.profile?.firstName || 'N/A'} ${emilyThompson.profile?.lastName || 'N/A'}`);
    console.log(`📧 Email: ${emilyThompson.email}`);
    console.log(`🏷️  User Type: ${emilyThompson.userType}`);
    console.log(`✅ Account Status: ${emilyThompson.approvalStatus}`);
    console.log(`🆔 User ID: ${emilyThompson.id}`);
    console.log(`🕒 Created: ${emilyThompson.createdAt.toLocaleDateString()} ${emilyThompson.createdAt.toLocaleTimeString()}`);

    console.log('\n📊 ACCOUNT DATA SUMMARY');
    console.log('═'.repeat(50));

    // Check all related data
    const dataChecks = [
      { name: 'Parent Bookings', count: emilyThompson.parentBookings.length, icon: '📅' },
      { name: 'Caregiver Bookings', count: emilyThompson.caregiverBookings.length, icon: '🍼' },
      { name: 'Reviews Given', count: emilyThompson.givenReviews.length, icon: '⭐' },
      { name: 'Reviews Received', count: emilyThompson.receivedReviews.length, icon: '🌟' },
      { name: 'Parent Chat Rooms', count: emilyThompson.parentChatRooms.length, icon: '💬' },
      { name: 'Caregiver Chat Rooms', count: emilyThompson.caregiverChatRooms.length, icon: '🗨️' },
      { name: 'Messages Sent', count: emilyThompson.sentMessages.length, icon: '📝' },
      { name: 'Children Profiles', count: emilyThompson.children.length, icon: '👶' },
      { name: 'Emergency Contacts', count: emilyThompson.emergencyContacts.length, icon: '🚨' },
      { name: 'Notifications', count: emilyThompson.notifications.length, icon: '🔔' },
      { name: 'Manual Payouts', count: emilyThompson.manualPayouts.length, icon: '💳' }
    ];

    let totalDataItems = 0;
    dataChecks.forEach(check => {
      console.log(`${check.icon} ${check.name}: ${check.count}`);
      totalDataItems += check.count;
    });

    console.log('\n🏆 CLEANLINESS VERIFICATION RESULTS');
    console.log('═'.repeat(50));

    if (totalDataItems === 0) {
      console.log('🎉 PERFECT! Emily Thompson\'s account is completely clean!');
      console.log('✅ No old mock bookings found');
      console.log('✅ No leftover data from mock accounts');
      console.log('✅ Account is ready for real usage');
    } else {
      console.log('⚠️  Account has some data:');
      dataChecks.forEach(check => {
        if (check.count > 0) {
          console.log(`   - ${check.name}: ${check.count} items`);
        }
      });
    }

    // Check for any payments related to Emily (even if no bookings)
    const paymentsRelatedToEmily = await prisma.payment.findMany({
      where: {
        booking: {
          OR: [
            { parentId: emilyThompson.id },
            { caregiverId: emilyThompson.id }
          ]
        }
      }
    });

    console.log(`💳 Related Payments: ${paymentsRelatedToEmily.length}`);

    // Check for any reviews related to Emily
    const reviewsRelatedToEmily = await prisma.review.findMany({
      where: {
        OR: [
          { reviewerId: emilyThompson.id },
          { revieweeId: emilyThompson.id }
        ]
      }
    });

    console.log(`📝 Related Reviews: ${reviewsRelatedToEmily.length}`);

    // Check database-wide for any references to old mock names
    console.log('\n🔍 CHECKING FOR ANY REMAINING MOCK DATA');
    console.log('═'.repeat(50));

    const totalBookingsInSystem = await prisma.booking.count();
    const totalPaymentsInSystem = await prisma.payment.count();
    const totalReviewsInSystem = await prisma.review.count();
    const totalUsersInSystem = await prisma.user.count();

    console.log(`📊 System-wide totals:`);
    console.log(`   👤 Total Users: ${totalUsersInSystem}`);
    console.log(`   📅 Total Bookings: ${totalBookingsInSystem}`);
    console.log(`   💳 Total Payments: ${totalPaymentsInSystem}`);
    console.log(`   ⭐ Total Reviews: ${totalReviewsInSystem}`);

    // Check profile data
    if (emilyThompson.profile) {
      console.log('\n👤 PROFILE INFORMATION');
      console.log('═'.repeat(50));
      const profile = emilyThompson.profile;
      console.log(`📍 Address: ${profile.streetAddress || 'Not set'}`);
      console.log(`🏙️  City: ${profile.city || 'Not set'}`);
      console.log(`🌎 Location: ${profile.latitude && profile.longitude ? `${profile.latitude}, ${profile.longitude}` : 'Not set'}`);
      console.log(`📞 Phone: ${profile.phone || 'Not set'}`);
      console.log(`🖼️  Avatar: ${profile.avatar || 'Not set'}`);
    }

    console.log('\n✅ FINAL VERIFICATION STATUS');
    console.log('═'.repeat(50));

    if (totalDataItems === 0 && paymentsRelatedToEmily.length === 0 && reviewsRelatedToEmily.length === 0) {
      console.log('🎊 SUCCESS! Emily Thompson\'s account is completely clean!');
      console.log('✅ No old mock bookings');
      console.log('✅ No related payments');  
      console.log('✅ No related reviews');
      console.log('✅ No leftover mock data');
      console.log('✅ Account is ready for real usage');
      console.log('\n🚀 The cleanup was successful!');
    } else {
      console.log('⚠️  There is still some data associated with the account.');
      console.log('📋 Please review the details above to determine if additional cleanup is needed.');
    }

  } catch (error) {
    console.error('❌ Error during verification:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the verification
verifyEmilyClean()
  .then(() => {
    console.log('\n🏁 Verification completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Verification failed:', error);
    process.exit(1);
  });