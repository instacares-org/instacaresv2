const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Names of old mock accounts to remove
const OLD_MOCK_NAMES = [
  'Emily Davis',
  'Jennifer Chen', 
  'Sarah Johnson',
  'Fazila Noorzad',
  'Maria Rodriguez',
  'Ashley Brown',
  'Jessica Wilson',
  'Amanda Miller'
];

async function cleanupMockData() {
  console.log('🧹 Starting comprehensive mock data cleanup...\n');

  try {
    // Step 1: Find all old mock user accounts
    console.log('Step 1: Identifying old mock accounts...');
    
    const oldMockUsers = await prisma.user.findMany({
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
      },
      where: {
        profile: {
          OR: OLD_MOCK_NAMES.map(name => {
            const [firstName, lastName] = name.split(' ');
            return {
              AND: [
                { firstName: { equals: firstName } },
                { lastName: { equals: lastName } }
              ]
            };
          })
        }
      }
    });

    console.log(`Found ${oldMockUsers.length} old mock accounts:`);
    oldMockUsers.forEach(user => {
      if (user.profile) {
        console.log(`  - ${user.profile.firstName} ${user.profile.lastName} (${user.email || 'no email'})`);
      }
    });

    if (oldMockUsers.length === 0) {
      console.log('✅ No old mock accounts found. Database is already clean!');
      return;
    }

    console.log('\n📊 Analyzing data to be cleaned...');

    // Count related data
    let totalBookingsToDelete = 0;
    let totalPaymentsToDelete = 0;
    let totalReviewsToDelete = 0;
    let totalChatRoomsToDelete = 0;
    let totalMessagesToDelete = 0;
    let totalChildrenToDelete = 0;
    let totalNotificationsToDelete = 0;

    for (const user of oldMockUsers) {
      totalBookingsToDelete += user.parentBookings.length + user.caregiverBookings.length;
      totalReviewsToDelete += user.givenReviews.length + user.receivedReviews.length;
      totalChatRoomsToDelete += user.parentChatRooms.length + user.caregiverChatRooms.length;
      totalMessagesToDelete += user.sentMessages.length;
      totalChildrenToDelete += user.children.length;
      totalNotificationsToDelete += user.notifications.length;
    }

    // Count payments separately as they're related to bookings
    const allBookingIds = [];
    for (const user of oldMockUsers) {
      allBookingIds.push(...user.parentBookings.map(b => b.id));
      allBookingIds.push(...user.caregiverBookings.map(b => b.id));
    }

    if (allBookingIds.length > 0) {
      const paymentsToDelete = await prisma.payment.findMany({
        where: {
          bookingId: { in: allBookingIds }
        }
      });
      totalPaymentsToDelete = paymentsToDelete.length;
    }

    console.log('Data to be cleaned:');
    console.log(`  📅 Bookings: ${totalBookingsToDelete}`);
    console.log(`  💳 Payments: ${totalPaymentsToDelete}`);
    console.log(`  ⭐ Reviews: ${totalReviewsToDelete}`);
    console.log(`  💬 Chat Rooms: ${totalChatRoomsToDelete}`);
    console.log(`  📝 Messages: ${totalMessagesToDelete}`);
    console.log(`  👶 Children: ${totalChildrenToDelete}`);
    console.log(`  🔔 Notifications: ${totalNotificationsToDelete}`);

    console.log('\n🗑️  Starting deletion process...\n');

    let deletedCount = {
      payments: 0,
      reviews: 0,
      messages: 0,
      chatRooms: 0,
      invoices: 0,
      checkInOuts: 0,
      slotBookings: 0,
      bookingReservations: 0,
      bookings: 0,
      children: 0,
      emergencyContacts: 0,
      notifications: 0,
      manualPayouts: 0,
      caregiverCertifications: 0,
      caregiverServices: 0,
      caregiverPhotos: 0,
      caregiverVerifications: 0,
      availabilitySlots: 0,
      caregivers: 0,
      profiles: 0,
      users: 0
    };

    // Step 2: Delete related data in correct order (respecting foreign key constraints)
    for (const user of oldMockUsers) {
      console.log(`🔄 Cleaning data for ${user.profile?.firstName || 'Unknown'} ${user.profile?.lastName || 'User'}...`);

      // Get all booking IDs for this user (as parent or caregiver)
      const userBookingIds = [
        ...user.parentBookings.map(b => b.id),
        ...user.caregiverBookings.map(b => b.id)
      ];

      if (userBookingIds.length > 0) {
        // Delete payments first
        const payments = await prisma.payment.deleteMany({
          where: { bookingId: { in: userBookingIds } }
        });
        deletedCount.payments += payments.count;

        // Delete reviews
        const reviews = await prisma.review.deleteMany({
          where: { bookingId: { in: userBookingIds } }
        });
        deletedCount.reviews += reviews.count;

        // Delete invoices
        const invoices = await prisma.invoice.deleteMany({
          where: { bookingId: { in: userBookingIds } }
        });
        deletedCount.invoices += invoices.count;

        // Delete check-in/check-out records
        const checkInOuts = await prisma.checkInOut.deleteMany({
          where: { bookingId: { in: userBookingIds } }
        });
        deletedCount.checkInOuts += checkInOuts.count;

        // Delete slot bookings
        const slotBookings = await prisma.slotBooking.deleteMany({
          where: { bookingId: { in: userBookingIds } }
        });
        deletedCount.slotBookings += slotBookings.count;

        // Delete booking reservations
        const bookingReservations = await prisma.bookingReservation.deleteMany({
          where: { bookingId: { in: userBookingIds } }
        });
        deletedCount.bookingReservations += bookingReservations.count;
      }

      // Delete messages sent by this user
      const messages = await prisma.message.deleteMany({
        where: { senderId: user.id }
      });
      deletedCount.messages += messages.count;

      // Delete chat rooms where this user is participant
      const chatRooms = await prisma.chatRoom.deleteMany({
        where: {
          OR: [
            { parentId: user.id },
            { caregiverId: user.id }
          ]
        }
      });
      deletedCount.chatRooms += chatRooms.count;

      // Delete bookings (after all related data is cleaned)
      const bookings = await prisma.booking.deleteMany({
        where: {
          OR: [
            { parentId: user.id },
            { caregiverId: user.id }
          ]
        }
      });
      deletedCount.bookings += bookings.count;

      // Delete children profiles
      const children = await prisma.child.deleteMany({
        where: { parentId: user.id }
      });
      deletedCount.children += children.count;

      // Delete emergency contacts
      const emergencyContacts = await prisma.emergencyContact.deleteMany({
        where: { userId: user.id }
      });
      deletedCount.emergencyContacts += emergencyContacts.count;

      // Delete notifications
      const notifications = await prisma.notification.deleteMany({
        where: { userId: user.id }
      });
      deletedCount.notifications += notifications.count;

      // Delete manual payouts
      const manualPayouts = await prisma.manualPayout.deleteMany({
        where: { caregiverId: user.id }
      });
      deletedCount.manualPayouts += manualPayouts.count;

      // If this is a caregiver, delete caregiver-specific data
      if (user.caregiver) {
        // Delete caregiver certifications
        const caregiverCertifications = await prisma.caregiverCertification.deleteMany({
          where: { caregiverId: user.caregiver.id }
        });
        deletedCount.caregiverCertifications += caregiverCertifications.count;

        // Delete caregiver services
        const caregiverServices = await prisma.caregiverService.deleteMany({
          where: { caregiverId: user.caregiver.id }
        });
        deletedCount.caregiverServices += caregiverServices.count;

        // Delete caregiver photos
        const caregiverPhotos = await prisma.caregiverPhoto.deleteMany({
          where: { caregiverId: user.caregiver.id }
        });
        deletedCount.caregiverPhotos += caregiverPhotos.count;

        // Delete caregiver verification
        const caregiverVerifications = await prisma.caregiverVerification.deleteMany({
          where: { caregiverId: user.caregiver.id }
        });
        deletedCount.caregiverVerifications += caregiverVerifications.count;

        // Delete availability slots
        const availabilitySlots = await prisma.availabilitySlot.deleteMany({
          where: { caregiverId: user.caregiver.id }
        });
        deletedCount.availabilitySlots += availabilitySlots.count;

        // Delete caregiver record (will cascade to related data)
        const caregivers = await prisma.caregiver.deleteMany({
          where: { id: user.caregiver.id }
        });
        deletedCount.caregivers += caregivers.count;
      }

      // Delete user profile (will cascade via Prisma relation)
      if (user.profile) {
        const profiles = await prisma.userProfile.deleteMany({
          where: { id: user.profile.id }
        });
        deletedCount.profiles += profiles.count;
      }

      // Finally delete the user account
      const users = await prisma.user.deleteMany({
        where: { id: user.id }
      });
      deletedCount.users += users.count;

      console.log(`  ✅ Cleaned ${user.profile?.firstName || 'Unknown'} ${user.profile?.lastName || 'User'}`);
    }

    console.log('\n🎉 Cleanup completed successfully!\n');

    console.log('📈 Cleanup Summary:');
    console.log(`  👤 Users deleted: ${deletedCount.users}`);
    console.log(`  📋 Profiles deleted: ${deletedCount.profiles}`);
    console.log(`  👩‍⚕️ Caregivers deleted: ${deletedCount.caregivers}`);
    console.log(`  📅 Bookings deleted: ${deletedCount.bookings}`);
    console.log(`  💳 Payments deleted: ${deletedCount.payments}`);
    console.log(`  ⭐ Reviews deleted: ${deletedCount.reviews}`);
    console.log(`  💬 Chat rooms deleted: ${deletedCount.chatRooms}`);
    console.log(`  📝 Messages deleted: ${deletedCount.messages}`);
    console.log(`  👶 Children deleted: ${deletedCount.children}`);
    console.log(`  🔔 Notifications deleted: ${deletedCount.notifications}`);
    console.log(`  🏆 Certifications deleted: ${deletedCount.caregiverCertifications}`);
    console.log(`  📸 Caregiver photos deleted: ${deletedCount.caregiverPhotos}`);
    console.log(`  📊 Other records deleted: ${deletedCount.invoices + deletedCount.checkInOuts + deletedCount.slotBookings + deletedCount.bookingReservations + deletedCount.emergencyContacts + deletedCount.manualPayouts + deletedCount.caregiverServices + deletedCount.caregiverVerifications + deletedCount.availabilitySlots}`);

    // Step 3: Verify Emily Thompson's account is clean
    console.log('\n🔍 Verifying Emily Thompson\'s account is clean...');
    
    const emilyThompson = await prisma.user.findFirst({
      where: {
        email: 'emily.thompson@example.com'
      },
      include: {
        profile: true,
        parentBookings: {
          include: {
            caregiver: {
              include: {
                user: {
                  include: {
                    profile: true
                  }
                }
              }
            }
          }
        },
        caregiverBookings: true
      }
    });

    if (emilyThompson) {
      console.log(`✅ Emily Thompson found: ${emilyThompson.profile?.firstName} ${emilyThompson.profile?.lastName}`);
      console.log(`📅 Current bookings as parent: ${emilyThompson.parentBookings.length}`);
      console.log(`📅 Current bookings as caregiver: ${emilyThompson.caregiverBookings.length}`);
      
      if (emilyThompson.parentBookings.length > 0) {
        console.log('\n📋 Remaining bookings:');
        emilyThompson.parentBookings.forEach((booking, index) => {
          const caregiverName = booking.caregiver?.user?.profile ? 
            `${booking.caregiver.user.profile.firstName} ${booking.caregiver.user.profile.lastName}` : 
            'Unknown Caregiver';
          console.log(`  ${index + 1}. With ${caregiverName} on ${booking.startTime.toDateString()}`);
        });
      } else {
        console.log('🎉 Emily Thompson\'s account is completely clean of bookings!');
      }
    } else {
      console.log('❌ Emily Thompson account not found!');
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupMockData()
  .then(() => {
    console.log('\n🎊 Mock data cleanup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Cleanup failed:', error);
    process.exit(1);
  });