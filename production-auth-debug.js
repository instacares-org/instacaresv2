// Production Authentication Debug Script
// Run this to check what's causing the 401 errors

const { PrismaClient } = require('@prisma/client');

// Create Prisma client with production database URL if available
const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function debugProductionAuth() {
  try {
    console.log('🔍 Production Authentication Debug');
    console.log('================================');

    // Check environment variables
    console.log('\n📋 Environment Variables:');
    console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL || '❌ MISSING');
    console.log('NEXTAUTH_SECRET:', process.env.NEXTAUTH_SECRET ? '✅ SET' : '❌ MISSING');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ SET' : '❌ MISSING');
    console.log('NODE_ENV:', process.env.NODE_ENV || 'development');

    // Test database connection
    console.log('\n🗄️  Database Connection Test:');
    try {
      await prisma.$connect();
      console.log('✅ Database connection successful');

      // Check if test caregiver exists
      console.log('\n👤 Test Caregiver Account:');
      const testCaregiver = await prisma.user.findUnique({
        where: { email: 'caregiver@test.com' },
        include: {
          profile: true,
          caregiver: true
        }
      });

      if (testCaregiver) {
        console.log('✅ Test caregiver account found:');
        console.log('   - Email:', testCaregiver.email);
        console.log('   - User Type:', testCaregiver.userType);
        console.log('   - Status:', testCaregiver.approvalStatus);
        console.log('   - Active:', testCaregiver.isActive);
        console.log('   - Has Password:', !!testCaregiver.passwordHash);
        console.log('   - Has Profile:', !!testCaregiver.profile);
        console.log('   - Has Caregiver:', !!testCaregiver.caregiver);

        if (testCaregiver.profile) {
          console.log('   - Profile Name:', testCaregiver.profile.firstName, testCaregiver.profile.lastName);
        }

        if (testCaregiver.caregiver) {
          console.log('   - Caregiver ID:', testCaregiver.caregiver.id);
          console.log('   - Hourly Rate:', testCaregiver.caregiver.hourlyRate);
        }
      } else {
        console.log('❌ Test caregiver account NOT FOUND');
        console.log('   You need to create the test account in production database');
      }

      // Check total users
      const userCount = await prisma.user.count();
      const caregiverCount = await prisma.user.count({
        where: { userType: 'CAREGIVER' }
      });

      console.log('\n📊 Database Stats:');
      console.log('   - Total users:', userCount);
      console.log('   - Total caregivers:', caregiverCount);

    } catch (dbError) {
      console.log('❌ Database connection failed:', dbError.message);
    }

    console.log('\n🔧 Next Steps:');
    if (!process.env.NEXTAUTH_URL) {
      console.log('❌ Add NEXTAUTH_URL=https://instacares.net to production environment');
    }
    if (!process.env.NEXTAUTH_SECRET) {
      console.log('❌ Add NEXTAUTH_SECRET with secure 32+ character string');
    }
    if (!process.env.DATABASE_URL) {
      console.log('❌ Set DATABASE_URL to production database connection string');
    }

    console.log('\n📝 To fix 401 errors:');
    console.log('1. Update production environment variables');
    console.log('2. Restart production server');
    console.log('3. Create test caregiver account if missing');
    console.log('4. Test login at https://instacares.net/login/caregiver');

  } catch (error) {
    console.error('❌ Debug script error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the debug
debugProductionAuth().catch(console.error);