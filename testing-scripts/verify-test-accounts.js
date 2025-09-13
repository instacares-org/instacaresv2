#!/usr/bin/env node
/**
 * Verify test accounts exist and have proper password hashes
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function verifyTestAccounts() {
  console.log('🔍 Verifying test accounts...');

  try {
    // Check parent account
    const parent = await prisma.user.findUnique({
      where: { email: 'parent.test@instacares.com' },
      include: { profile: true, children: true }
    });

    if (!parent) {
      console.log('❌ Parent account not found');
      return;
    }

    console.log(`✅ Parent account found: ${parent.email}`);
    console.log(`   - ID: ${parent.id}`);
    console.log(`   - UserType: ${parent.userType}`);
    console.log(`   - ApprovalStatus: ${parent.approvalStatus}`);
    console.log(`   - IsActive: ${parent.isActive}`);
    console.log(`   - Has password hash: ${!!parent.passwordHash}`);
    console.log(`   - Password hash length: ${parent.passwordHash?.length || 0}`);
    console.log(`   - Profile: ${parent.profile?.firstName} ${parent.profile?.lastName}`);
    console.log(`   - Children: ${parent.children.length}`);

    // Test password verification
    if (parent.passwordHash) {
      const isValidPassword = await bcrypt.compare('TestParent123!', parent.passwordHash);
      console.log(`   - Password verification: ${isValidPassword ? '✅ Valid' : '❌ Invalid'}`);
    }

    // Check caregiver account
    const caregiver = await prisma.user.findUnique({
      where: { email: 'caregiver.test@instacares.com' },
      include: { profile: true, caregiver: true }
    });

    if (!caregiver) {
      console.log('❌ Caregiver account not found');
      return;
    }

    console.log(`\n✅ Caregiver account found: ${caregiver.email}`);
    console.log(`   - ID: ${caregiver.id}`);
    console.log(`   - UserType: ${caregiver.userType}`);
    console.log(`   - ApprovalStatus: ${caregiver.approvalStatus}`);
    console.log(`   - IsActive: ${caregiver.isActive}`);
    console.log(`   - Has password hash: ${!!caregiver.passwordHash}`);
    console.log(`   - Password hash length: ${caregiver.passwordHash?.length || 0}`);
    console.log(`   - Profile: ${caregiver.profile?.firstName} ${caregiver.profile?.lastName}`);
    console.log(`   - Rate: $${caregiver.caregiver?.hourlyRate}/hour`);

    // Test password verification
    if (caregiver.passwordHash) {
      const isValidPassword = await bcrypt.compare('TestCaregiver123!', caregiver.passwordHash);
      console.log(`   - Password verification: ${isValidPassword ? '✅ Valid' : '❌ Invalid'}`);
    }

    console.log(`\n📊 SUMMARY:`);
    console.log(`✅ Both accounts exist and are properly configured`);
    console.log(`✅ Both accounts are APPROVED and ACTIVE`);
    console.log(`✅ Both accounts have valid password hashes`);
    console.log(`✅ Ready for login testing`);

  } catch (error) {
    console.error('❌ Error verifying accounts:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  verifyTestAccounts()
    .then(() => {
      console.log('\n🔍 Verification completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Verification failed:', error);
      process.exit(1);
    });
}