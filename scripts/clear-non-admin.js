/**
 * Clear all users and related data except the admin user.
 * Usage: node scripts/clear-non-admin.js
 */
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();

  // Find admin
  const admin = await prisma.user.findFirst({ where: { userType: 'ADMIN' } });
  if (!admin) {
    console.error('No admin user found! Aborting.');
    process.exit(1);
  }

  console.log(`Admin: ${admin.email} (${admin.id})`);

  const nonAdminCount = await prisma.user.count({ where: { id: { not: admin.id } } });
  console.log(`Users to delete: ${nonAdminCount}`);

  if (nonAdminCount === 0) {
    console.log('Nothing to delete.');
    await prisma.$disconnect();
    return;
  }

  const notAdmin = { userId: { not: admin.id } };
  const notAdminId = { not: admin.id };

  console.log('\n--- Deleting in dependency order ---\n');

  // 1. Babysitter leaf tables
  let c;
  c = await prisma.babysitterMessage.deleteMany({});
  console.log(`BabysitterMessage: ${c.count}`);
  c = await prisma.babysitterChatRoom.deleteMany({});
  console.log(`BabysitterChatRoom: ${c.count}`);
  c = await prisma.babysitterReview.deleteMany({});
  console.log(`BabysitterReview: ${c.count}`);
  c = await prisma.babysitterReference.deleteMany({});
  console.log(`BabysitterReference: ${c.count}`);
  c = await prisma.babysitterAvailability.deleteMany({});
  console.log(`BabysitterAvailability: ${c.count}`);
  c = await prisma.babysitterBooking.deleteMany({});
  console.log(`BabysitterBooking: ${c.count}`);

  // 2. Caregiver leaf tables
  c = await prisma.caregiverPhoto.deleteMany({});
  console.log(`CaregiverPhoto: ${c.count}`);
  c = await prisma.caregiverCertification.deleteMany({});
  console.log(`CaregiverCertification: ${c.count}`);
  c = await prisma.caregiverService.deleteMany({});
  console.log(`CaregiverService: ${c.count}`);
  c = await prisma.caregiverVerification.deleteMany({});
  console.log(`CaregiverVerification: ${c.count}`);
  c = await prisma.caregiverWarning.deleteMany({});
  console.log(`CaregiverWarning: ${c.count}`);

  // 3. Booking-related
  c = await prisma.slotBooking.deleteMany({});
  console.log(`SlotBooking: ${c.count}`);
  c = await prisma.bookingExtension.deleteMany({});
  console.log(`BookingExtension: ${c.count}`);
  c = await prisma.checkInOut.deleteMany({});
  console.log(`CheckInOut: ${c.count}`);
  c = await prisma.bookingReservation.deleteMany({});
  console.log(`BookingReservation: ${c.count}`);
  c = await prisma.cancellation.deleteMany({});
  console.log(`Cancellation: ${c.count}`);
  c = await prisma.invoice.deleteMany({});
  console.log(`Invoice: ${c.count}`);
  c = await prisma.payment.deleteMany({});
  console.log(`Payment: ${c.count}`);
  c = await prisma.review.deleteMany({});
  console.log(`Review: ${c.count}`);
  c = await prisma.booking.deleteMany({});
  console.log(`Booking: ${c.count}`);

  // 4. Chat & messaging
  c = await prisma.message.deleteMany({});
  console.log(`Message: ${c.count}`);
  c = await prisma.chatRoom.deleteMany({});
  console.log(`ChatRoom: ${c.count}`);

  // 5. Notifications
  c = await prisma.notificationRetry.deleteMany({});
  console.log(`NotificationRetry: ${c.count}`);
  c = await prisma.notificationWebhook.deleteMany({});
  console.log(`NotificationWebhook: ${c.count}`);
  c = await prisma.notificationEvent.deleteMany({});
  console.log(`NotificationEvent: ${c.count}`);
  c = await prisma.notification.deleteMany({});
  console.log(`Notification: ${c.count}`);
  c = await prisma.notificationPreferences.deleteMany({});
  console.log(`NotificationPreferences: ${c.count}`);

  // 6. Support & misc
  c = await prisma.ticketResponse.deleteMany({});
  console.log(`TicketResponse: ${c.count}`);
  c = await prisma.supportTicket.deleteMany({});
  console.log(`SupportTicket: ${c.count}`);
  c = await prisma.manualPayout.deleteMany({});
  console.log(`ManualPayout: ${c.count}`);

  // 7. Availability slots
  c = await prisma.availabilitySlot.deleteMany({});
  console.log(`AvailabilitySlot: ${c.count}`);

  // 8. Child-related
  c = await prisma.emergencyContact.deleteMany({});
  console.log(`EmergencyContact: ${c.count}`);
  c = await prisma.child.deleteMany({});
  console.log(`Child: ${c.count}`);

  // 9. Caregiver & babysitter profiles
  c = await prisma.caregiver.deleteMany({});
  console.log(`Caregiver: ${c.count}`);
  c = await prisma.babysitter.deleteMany({});
  console.log(`Babysitter: ${c.count}`);

  // 10. Auth tables (exclude admin)
  c = await prisma.session.deleteMany({ where: notAdmin });
  console.log(`Session (non-admin): ${c.count}`);
  c = await prisma.account.deleteMany({ where: notAdmin });
  console.log(`Account (non-admin): ${c.count}`);

  // 11. User profiles (exclude admin)
  c = await prisma.userProfile.deleteMany({ where: notAdmin });
  console.log(`UserProfile (non-admin): ${c.count}`);

  // 12. Audit logs - skip (protected by DB trigger, cannot be deleted)
  console.log('AuditLog: skipped (DB trigger prevents deletion)');

  // 13. Verification tokens
  c = await prisma.verificationToken.deleteMany({});
  console.log(`VerificationToken: ${c.count}`);

  // 14. Finally, delete non-admin users
  c = await prisma.user.deleteMany({ where: { id: notAdminId } });
  console.log(`\nUsers deleted: ${c.count}`);

  // Verify
  const remaining = await prisma.user.findMany({ select: { id: true, email: true, userType: true } });
  console.log('\n--- Remaining users ---');
  remaining.forEach(u => console.log(`  ${u.email} (${u.userType})`));

  await prisma.$disconnect();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
