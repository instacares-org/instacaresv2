// Production Caregiver Account Creation Script
// Run this on your production server to create the test caregiver account

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createProductionCaregiver() {
  try {
    console.log('🚀 Creating production caregiver account...');

    // Check if account already exists
    const existing = await prisma.user.findUnique({
      where: { email: 'caregiver@test.com' },
      include: { caregiver: true }
    });

    if (existing) {
      console.log('✅ Caregiver account already exists');
      console.log('📧 Email:', existing.email);
      console.log('🔑 Password: test123');
      console.log('👤 User Type:', existing.userType);
      console.log('✅ Status:', existing.approvalStatus);
      console.log('🏥 Has Caregiver Profile:', !!existing.caregiver);

      // Ensure caregiver profile exists
      if (!existing.caregiver) {
        console.log('⚠️  Creating missing caregiver profile...');
        await prisma.caregiver.create({
          data: {
            userId: existing.id,
            bio: 'Experienced and caring childcare provider for testing',
            experienceYears: 5,
            hourlyRate: 25,
            dailyCapacity: 4,
            enableDynamicPricing: false,
            maxChildren: 4,
            minAge: 1,
            maxAge: 12,
            isAvailable: true,
            averageRating: 4.8
          }
        });
        console.log('✅ Caregiver profile created');
      }

      return existing;
    }

    // Create new caregiver account
    console.log('📝 Creating new caregiver account...');

    const hashedPassword = await bcrypt.hash('test123', 12);

    const user = await prisma.user.create({
      data: {
        email: 'caregiver@test.com',
        passwordHash: hashedPassword,
        userType: 'CAREGIVER',
        approvalStatus: 'APPROVED',
        isActive: true,
        emailVerified: new Date(),
        profile: {
          create: {
            firstName: 'Sarah',
            lastName: 'Johnson',
            phone: '(555) 123-4567',
            streetAddress: '123 Main St',
            city: 'Toronto',
            state: 'ON',
            zipCode: 'M5V 3A1',
            country: 'CA',
          },
        },
      },
      include: {
        profile: true,
      },
    });

    // Create caregiver profile
    const caregiver = await prisma.caregiver.create({
      data: {
        userId: user.id,
        bio: 'Experienced and caring childcare provider for testing',
        experienceYears: 5,
        hourlyRate: 25,
        dailyCapacity: 4,
        enableDynamicPricing: false,
        maxChildren: 4,
        minAge: 1,
        maxAge: 12,
        isAvailable: true,
        averageRating: 4.8
      }
    });

    console.log('✅ Production caregiver account created successfully!');
    console.log('📧 Email: caregiver@test.com');
    console.log('🔑 Password: test123');
    console.log('👤 Name: Sarah Johnson');
    console.log('🆔 User ID:', user.id);
    console.log('🏥 Caregiver ID:', caregiver.id);
    console.log('💰 Hourly Rate: $' + caregiver.hourlyRate);
    console.log('');
    console.log('🎯 Ready to test at: https://instacares.net/login/caregiver');

    return user;

  } catch (error) {
    console.error('❌ Error creating production caregiver:', error.message);

    if (error.code === 'P2002') {
      console.log('💡 Account may already exist. Try the debug script first.');
    }

    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  createProductionCaregiver().catch(console.error);
}

module.exports = { createProductionCaregiver };