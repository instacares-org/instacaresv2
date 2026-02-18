import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
  console.log('Starting database cleanup...');
  console.log('Keeping admin user (admin@instacares.com)');

  // Find admin user
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@instacares.com' },
  });

  if (!admin) {
    console.log('WARNING: Admin user not found! Aborting.');
    return;
  }

  console.log(`Admin user ID: ${admin.id}`);

  // Delete in order: leaf tables first, then parent tables
  // Many have onDelete: Cascade, but we clean explicitly to be safe

  // 1. Babysitter-related leaf tables
  console.log('Deleting babysitter messages...');
  await prisma.babysitterMessage.deleteMany({});
  console.log('Deleting babysitter chat rooms...');
  await prisma.babysitterChatRoom.deleteMany({});
  console.log('Deleting babysitter reviews...');
  await prisma.babysitterReview.deleteMany({});
  console.log('Deleting babysitter references...');
  await prisma.babysitterReference.deleteMany({});
  console.log('Deleting babysitter availability...');
  await prisma.babysitterAvailability.deleteMany({});
  console.log('Deleting babysitter bookings...');
  await prisma.babysitterBooking.deleteMany({});

  // 2. Caregiver-related leaf tables
  console.log('Deleting caregiver photos...');
  await prisma.caregiverPhoto.deleteMany({});
  console.log('Deleting caregiver certifications...');
  await prisma.caregiverCertification.deleteMany({});
  console.log('Deleting caregiver services...');
  await prisma.caregiverService.deleteMany({});
  console.log('Deleting caregiver verifications...');
  await prisma.caregiverVerification.deleteMany({});
  console.log('Deleting caregiver warnings...');
  await prisma.caregiverWarning.deleteMany({});

  // 3. Booking-related tables
  console.log('Deleting slot bookings...');
  await prisma.slotBooking.deleteMany({});
  console.log('Deleting booking extensions...');
  await prisma.bookingExtension.deleteMany({});
  console.log('Deleting check in/out records...');
  await prisma.checkInOut.deleteMany({});
  console.log('Deleting booking reservations...');
  await prisma.bookingReservation.deleteMany({});
  console.log('Deleting cancellations...');
  await prisma.cancellation.deleteMany({});
  console.log('Deleting invoices...');
  await prisma.invoice.deleteMany({});
  console.log('Deleting payments...');
  await prisma.payment.deleteMany({});
  console.log('Deleting reviews...');
  await prisma.review.deleteMany({});
  console.log('Deleting bookings...');
  await prisma.booking.deleteMany({});

  // 4. Chat tables
  console.log('Deleting messages...');
  await prisma.message.deleteMany({});
  console.log('Deleting chat rooms...');
  await prisma.chatRoom.deleteMany({});

  // 5. Notification tables
  console.log('Deleting notification retries...');
  await prisma.notificationRetry.deleteMany({});
  console.log('Deleting notification webhooks...');
  await prisma.notificationWebhook.deleteMany({});
  console.log('Deleting notification events...');
  await prisma.notificationEvent.deleteMany({});
  console.log('Deleting notifications...');
  await prisma.notification.deleteMany({});
  console.log('Deleting notification preferences...');
  await prisma.notificationPreferences.deleteMany({});

  // 6. Support & misc
  console.log('Deleting ticket responses...');
  await prisma.ticketResponse.deleteMany({});
  console.log('Deleting support tickets...');
  await prisma.supportTicket.deleteMany({});
  console.log('Deleting manual payouts...');
  await prisma.manualPayout.deleteMany({});
  console.log('Skipping audit logs (protected by DB trigger)...');

  // 7. Availability slots
  console.log('Deleting availability slots...');
  await prisma.availabilitySlot.deleteMany({});

  // 8. Children & emergency contacts
  console.log('Deleting emergency contacts...');
  await prisma.emergencyContact.deleteMany({});
  console.log('Deleting children...');
  await prisma.child.deleteMany({});

  // 9. Core profile tables (non-admin)
  console.log('Deleting caregivers...');
  await prisma.caregiver.deleteMany({});
  console.log('Deleting babysitters...');
  await prisma.babysitter.deleteMany({});

  // 10. Auth tables for non-admin users
  console.log('Deleting sessions (non-admin)...');
  await prisma.session.deleteMany({
    where: { userId: { not: admin.id } },
  });
  console.log('Deleting accounts (non-admin)...');
  await prisma.account.deleteMany({
    where: { userId: { not: admin.id } },
  });

  // 11. User profiles (non-admin)
  console.log('Deleting user profiles (non-admin)...');
  await prisma.userProfile.deleteMany({
    where: { userId: { not: admin.id } },
  });

  // 12. Users (non-admin)
  console.log('Deleting users (non-admin)...');
  await prisma.user.deleteMany({
    where: { id: { not: admin.id } },
  });

  // 13. Clean up verification tokens
  console.log('Deleting verification tokens...');
  await prisma.verificationToken.deleteMany({});

  // Count remaining
  const userCount = await prisma.user.count();
  console.log(`\nCleanup complete! Remaining users: ${userCount}`);
  console.log('Admin account preserved: admin@instacares.com');
}

cleanup()
  .catch((e) => {
    console.error('Cleanup failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
