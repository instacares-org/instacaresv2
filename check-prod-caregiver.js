const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

async function checkTestCaregiver() {
  const prisma = new PrismaClient();

  try {
    // Check if test caregiver exists
    const caregiver = await prisma.user.findUnique({
      where: { email: 'test.caregiver@instacares.com' },
      include: {
        UserProfile: true
      }
    });

    console.log('Test Caregiver Account Details:');
    if (caregiver) {
      console.log('- ID:', caregiver.id);
      console.log('- Email:', caregiver.email);
      console.log('- Password Hash Length:', caregiver.passwordHash ? caregiver.passwordHash.length : 'NULL');
      console.log('- Password Hash (first 20 chars):', caregiver.passwordHash ? caregiver.passwordHash.substring(0, 20) + '...' : 'NULL');
      console.log('- User Type:', caregiver.userType);
      console.log('- Created At:', caregiver.createdAt);
      console.log('- UserProfile exists:', !!caregiver.UserProfile);

      // Test password verification
      if (caregiver.passwordHash) {
        const isValid = await bcrypt.compare('TestPass123!', caregiver.passwordHash);
        console.log('- Password Test (TestPass123!):', isValid ? 'VALID' : 'INVALID');
      } else {
        console.log('- Password Test: CANNOT TEST - NO HASH');
      }
    } else {
      console.log('- Account NOT FOUND');
    }

    // Also check if there are any other test accounts
    const allTestUsers = await prisma.user.findMany({
      where: {
        email: {
          contains: 'test'
        }
      },
      select: {
        id: true,
        email: true,
        userType: true,
        passwordHash: true
      }
    });

    console.log('\nAll Test Accounts:');
    allTestUsers.forEach(user => {
      console.log(`- ${user.email} (${user.userType}) - Has Password: ${!!user.passwordHash}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTestCaregiver();