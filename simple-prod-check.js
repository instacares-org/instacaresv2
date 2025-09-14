const { PrismaClient } = require('@prisma/client');

async function checkTestCaregiver() {
  const prisma = new PrismaClient();

  try {
    // Check if test caregiver exists
    const caregiver = await prisma.user.findUnique({
      where: { email: 'test.caregiver@instacares.com' },
      include: {
        profile: true
      }
    });

    console.log('Test Caregiver Account Details:');
    if (caregiver) {
      console.log('- ID:', caregiver.id);
      console.log('- Email:', caregiver.email);
      console.log('- Password Hash Length:', caregiver.passwordHash ? caregiver.passwordHash.length : 'NULL');
      console.log('- Password Hash (first 60 chars):', caregiver.passwordHash ? caregiver.passwordHash.substring(0, 60) : 'NULL');
      console.log('- User Type:', caregiver.userType);
      console.log('- Created At:', caregiver.createdAt);
      console.log('- Profile exists:', !!caregiver.profile);

      if (caregiver.profile) {
        console.log('- Profile First Name:', caregiver.profile.firstName);
        console.log('- Profile Last Name:', caregiver.profile.lastName);
      }
    } else {
      console.log('- Account NOT FOUND');
    }

    // Also check all test accounts
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
        passwordHash: true,
        createdAt: true
      }
    });

    console.log('\nAll Test Accounts:');
    allTestUsers.forEach(user => {
      console.log(`- ${user.email} (${user.userType}) - Has Password: ${!!user.passwordHash} - Created: ${user.createdAt}`);
      if (user.passwordHash && user.email === 'test.caregiver@instacares.com') {
        console.log(`  Password hash: ${user.passwordHash.substring(0, 60)}...`);
      }
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTestCaregiver();