const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testLoginCredentials() {
  console.log('🔐 Testing login credentials...\n');
  
  const testAccounts = [
    { email: 'emily.thompson@example.com', type: 'Parent' },
    { email: 'isabella.rodriguez@example.com', type: 'Caregiver' },
    { email: 'sarah.martinez@example.com', type: 'Parent' },
    { email: 'aisha.patel@example.com', type: 'Caregiver' }
  ];
  
  for (const account of testAccounts) {
    try {
      const user = await prisma.user.findUnique({
        where: { email: account.email },
        include: {
          profile: true,
          caregiver: true
        }
      });
      
      if (!user) {
        console.log(`❌ ${account.type}: ${account.email} - NOT FOUND`);
        continue;
      }
      
      // Test password hash
      const passwordMatch = await bcrypt.compare('password123', user.passwordHash);
      
      console.log(`✅ ${account.type}: ${account.email}`);
      console.log(`   🔑 Password: ${passwordMatch ? 'Valid' : 'Invalid'}`);
      console.log(`   👤 Name: ${user.profile.firstName} ${user.profile.lastName}`);
      console.log(`   ✅ Status: ${user.approvalStatus}, Active: ${user.isActive}`);
      console.log(`   📧 Email Verified: ${user.emailVerified}`);
      console.log(`   📱 Phone Verified: ${user.phoneVerified}`);
      console.log(`   📍 Location: ${user.profile.city}, ${user.profile.state}`);
      
      if (user.caregiver) {
        console.log(`   💰 Rate: $${user.caregiver.hourlyRate}/hour`);
        console.log(`   ⭐ Rating: ${user.caregiver.averageRating?.toFixed(1) || 'N/A'}`);
      }
      
      console.log('');
    } catch (error) {
      console.log(`❌ ${account.type}: ${account.email} - ERROR: ${error.message}\n`);
    }
  }
  
  console.log('🎯 LOGIN TESTING SUMMARY:');
  console.log('========================');
  console.log('📧 All test accounts use: password123');
  console.log('🔗 Application URL: http://localhost:3000');
  console.log('');
  console.log('🏃‍♂️ Quick Test Accounts:');
  console.log('• Parent: emily.thompson@example.com');
  console.log('• Caregiver: isabella.rodriguez@example.com');
}

async function main() {
  await testLoginCredentials();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });