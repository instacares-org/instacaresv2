#!/usr/bin/env node
/**
 * Approve the test accounts and set up for complete workflow testing
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function approveTestAccounts() {
  console.log('🔓 Approving test accounts for workflow testing...');

  try {
    // Find the test accounts
    const parentAccount = await prisma.user.findUnique({
      where: { email: 'test.parent@instacares.com' },
      include: { profile: true, children: true }
    });

    const caregiverAccount = await prisma.user.findUnique({
      where: { email: 'test.caregiver@instacares.com' },
      include: { profile: true, caregiver: true }
    });

    if (!parentAccount || !caregiverAccount) {
      throw new Error('Test accounts not found. Please run create-test-accounts.js first.');
    }

    console.log(`\n✅ Found test accounts:`);
    console.log(`Parent: ${parentAccount.email} (${parentAccount.id})`);
    console.log(`Caregiver: ${caregiverAccount.email} (${caregiverAccount.id})`);

    // Approve parent account
    const approvedParent = await prisma.user.update({
      where: { id: parentAccount.id },
      data: {
        approvalStatus: 'APPROVED',
        isActive: true,
        updatedAt: new Date()
      }
    });
    console.log(`🟢 Parent approved: ${approvedParent.email}`);

    // Approve caregiver account and ensure caregiver record exists
    const approvedCaregiver = await prisma.user.update({
      where: { id: caregiverAccount.id },
      data: {
        approvalStatus: 'APPROVED',
        isActive: true,
        updatedAt: new Date()
      }
    });
    console.log(`🟢 Caregiver approved: ${approvedCaregiver.email}`);

    // Make sure caregiver profile is set up properly
    await prisma.caregiver.update({
      where: { userId: caregiverAccount.id },
      data: {
        isAvailable: true,
        canReceivePayments: true, // Enable for testing
        backgroundCheck: true,
        isVerified: true // Set verified for easier testing
      }
    });
    console.log(`🔧 Caregiver profile updated for testing`);

    console.log(`📧 Accounts ready for testing`);

    console.log(`\n🎉 TEST ACCOUNTS READY FOR WORKFLOW TESTING!`);
    console.log(`\n📋 WORKFLOW TEST PLAN:`);
    console.log(`1. Login as parent: test.parent@instacares.com`);
    console.log(`2. Search for caregivers in Toronto/Mississauga area`);
    console.log(`3. Book Jessica Martinez for childcare`);
    console.log(`4. Login as caregiver: test.caregiver@instacares.com`);
    console.log(`5. Accept/manage the booking`);
    console.log(`6. Test messaging between both accounts`);
    console.log(`7. Complete booking workflow`);

    return {
      parent: {
        id: approvedParent.id,
        email: approvedParent.email,
        status: approvedParent.approvalStatus
      },
      caregiver: {
        id: approvedCaregiver.id,
        email: approvedCaregiver.email,
        status: approvedCaregiver.approvalStatus
      }
    };

  } catch (error) {
    console.error('❌ Error approving test accounts:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  approveTestAccounts()
    .then((accounts) => {
      console.log('\n✅ Test accounts approved successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Failed to approve test accounts:', error);
      process.exit(1);
    });
}

module.exports = approveTestAccounts;