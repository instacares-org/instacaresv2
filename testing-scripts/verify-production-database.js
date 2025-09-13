const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const TEST_ACCOUNTS = [
  {
    email: 'sarah.johnson@testmail.ca',
    password: 'TestCaregiver123!',
    userType: 'CAREGIVER',
    name: 'Sarah Johnson'
  },
  {
    email: 'michael.chen@testmail.ca', 
    password: 'TestParent123!',
    userType: 'PARENT',
    name: 'Michael Chen'
  }
];

async function verifyDatabaseConnection() {
  console.log('🔍 VERIFYING PRODUCTION DATABASE CONNECTION');
  console.log('==========================================\n');
  
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Check if our test accounts exist
    console.log('\n📋 CHECKING TEST ACCOUNTS:');
    console.log('---------------------------');
    
    for (const testAccount of TEST_ACCOUNTS) {
      const user = await prisma.user.findUnique({
        where: { email: testAccount.email },
        include: {
          profile: true,
          caregiver: testAccount.userType === 'CAREGIVER'
        }
      });
      
      if (user) {
        console.log(`\n✅ ${testAccount.userType} ACCOUNT FOUND:`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Name: ${user.name}`);
        console.log(`   User Type: ${user.userType}`);
        console.log(`   Active: ${user.isActive}`);
        console.log(`   Approval Status: ${user.approvalStatus}`);
        console.log(`   Email Verified: ${user.emailVerified ? 'Yes' : 'No'}`);
        console.log(`   Password Hash Exists: ${user.passwordHash ? 'Yes' : 'No'}`);
        console.log(`   Last Login: ${user.lastLogin || 'Never'}`);
        console.log(`   Profile: ${user.profile ? 'Complete' : 'Missing'}`);
        
        if (testAccount.userType === 'CAREGIVER') {
          console.log(`   Caregiver Profile: ${user.caregiver ? 'Complete' : 'Missing'}`);
        }
        
        // Check if account needs any fixes
        const needsUpdates = [];
        if (!user.isActive) needsUpdates.push('isActive = true');
        if (user.approvalStatus !== 'APPROVED') needsUpdates.push('approvalStatus = APPROVED');
        if (!user.emailVerified) needsUpdates.push('emailVerified = true');
        
        if (needsUpdates.length > 0) {
          console.log(`   ⚠️ NEEDS UPDATES: ${needsUpdates.join(', ')}`);
        }
        
      } else {
        console.log(`\n❌ ${testAccount.userType} ACCOUNT NOT FOUND: ${testAccount.email}`);
      }
    }
    
    // Check for any caregiver profiles (for search functionality)
    console.log('\n🔍 CHECKING CAREGIVER AVAILABILITY:');
    console.log('-----------------------------------');
    
    const totalCaregivers = await prisma.user.count({
      where: {
        userType: 'CAREGIVER',
        isActive: true,
        approvalStatus: 'APPROVED'
      }
    });
    
    console.log(`   Total Active Approved Caregivers: ${totalCaregivers}`);
    
    const caregiverProfiles = await prisma.caregiver.count({
      where: {
        user: {
          isActive: true,
          approvalStatus: 'APPROVED'
        }
      }
    });
    
    console.log(`   Caregivers with Profiles: ${caregiverProfiles}`);
    
    if (totalCaregivers === 0) {
      console.log('   ⚠️ NO ACTIVE CAREGIVERS - Search page will be empty');
    }
    
    // Database statistics
    console.log('\n📊 DATABASE STATISTICS:');
    console.log('-----------------------');
    
    const userStats = await prisma.user.groupBy({
      by: ['userType'],
      _count: { id: true }
    });
    
    userStats.forEach(stat => {
      console.log(`   ${stat.userType}: ${stat._count.id} users`);
    });
    
    const approvalStats = await prisma.user.groupBy({
      by: ['approvalStatus'],
      _count: { id: true }
    });
    
    approvalStats.forEach(stat => {
      console.log(`   ${stat.approvalStatus}: ${stat._count.id} users`);
    });
    
    console.log('\n✅ Database verification complete!');
    
  } catch (error) {
    console.error('\n❌ Database connection/query error:', error.message);
    console.error('Details:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function fixTestAccounts() {
  console.log('\n🔧 FIXING TEST ACCOUNT ISSUES');
  console.log('==============================\n');
  
  try {
    await prisma.$connect();
    
    for (const testAccount of TEST_ACCOUNTS) {
      const user = await prisma.user.findUnique({
        where: { email: testAccount.email }
      });
      
      if (user) {
        const updates = {};
        let needsUpdate = false;
        
        if (!user.isActive) {
          updates.isActive = true;
          needsUpdate = true;
        }
        
        if (user.approvalStatus !== 'APPROVED') {
          updates.approvalStatus = 'APPROVED';
          needsUpdate = true;
        }
        
        if (!user.emailVerified) {
          updates.emailVerified = new Date();
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          await prisma.user.update({
            where: { id: user.id },
            data: updates
          });
          
          console.log(`✅ Updated ${testAccount.userType} account: ${testAccount.email}`);
          console.log(`   Applied updates: ${Object.keys(updates).join(', ')}`);
        } else {
          console.log(`✅ ${testAccount.userType} account OK: ${testAccount.email}`);
        }
      }
    }
    
    console.log('\n✅ Account fixes complete!');
    
  } catch (error) {
    console.error('\n❌ Error fixing accounts:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
async function main() {
  await verifyDatabaseConnection();
  await fixTestAccounts();
}

main().catch(console.error);