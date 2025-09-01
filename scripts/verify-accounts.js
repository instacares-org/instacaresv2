const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyAccounts() {
  try {
    console.log('🔍 Verifying created accounts...\n');
    
    // Get all users with their profiles and related data
    const users = await prisma.user.findMany({
      include: {
        profile: true,
        caregiver: {
          include: {
            services: true
          }
        }
      },
      orderBy: {
        userType: 'asc'
      }
    });
    
    console.log('👥 ALL ACCOUNTS:');
    console.log('================');
    
    const parents = users.filter(u => u.userType === 'PARENT');
    const caregivers = users.filter(u => u.userType === 'CAREGIVER');
    
    console.log('\n👨‍👩‍👧‍👦 PARENT ACCOUNTS:');
    parents.forEach((parent, index) => {
      console.log(`\n${index + 1}. ${parent.profile.firstName} ${parent.profile.lastName}`);
      console.log(`   📧 Email: ${parent.email}`);
      console.log(`   📱 Phone: ${parent.profile.phone}`);
      console.log(`   🏠 Address: ${parent.profile.streetAddress}${parent.profile.apartment ? ', ' + parent.profile.apartment : ''}, ${parent.profile.city}, ${parent.profile.state} ${parent.profile.zipCode}`);
      console.log(`   📍 Location: ${parent.profile.latitude}, ${parent.profile.longitude}`);
      console.log(`   ✅ Status: ${parent.approvalStatus}, Active: ${parent.isActive}`);
      console.log(`   🆘 Emergency: ${parent.profile.emergencyName} (${parent.profile.emergencyPhone})`);
    });
    
    console.log('\n👩‍🍼 CAREGIVER ACCOUNTS:');
    caregivers.forEach((caregiver, index) => {
      console.log(`\n${index + 1}. ${caregiver.profile.firstName} ${caregiver.profile.lastName}`);
      console.log(`   📧 Email: ${caregiver.email}`);
      console.log(`   📱 Phone: ${caregiver.profile.phone}`);
      console.log(`   🏠 Address: ${caregiver.profile.streetAddress}${caregiver.profile.apartment ? ', ' + caregiver.profile.apartment : ''}, ${caregiver.profile.city}, ${caregiver.profile.state} ${caregiver.profile.zipCode}`);
      console.log(`   📍 Location: ${caregiver.profile.latitude}, ${caregiver.profile.longitude}`);
      console.log(`   💰 Rate: $${caregiver.caregiver.hourlyRate}/hour`);
      console.log(`   👶 Experience: ${caregiver.caregiver.experienceYears} years`);
      console.log(`   🗣️ Languages: ${caregiver.caregiver.languages.join(', ')}`);
      console.log(`   ⭐ Rating: ${caregiver.caregiver.averageRating?.toFixed(1) || 'N/A'}`);
      console.log(`   📖 Bookings: ${caregiver.caregiver.totalBookings}`);
      console.log(`   ✅ Verified: ${caregiver.caregiver.isVerified}, Background Check: ${caregiver.caregiver.backgroundCheck}`);
      console.log(`   🛠️ Services: ${caregiver.caregiver.services.map(s => s.serviceType).join(', ')}`);
      console.log(`   ✅ Status: ${caregiver.approvalStatus}, Active: ${caregiver.isActive}`);
    });
    
    // Check geographic distribution
    const cities = {};
    users.forEach(user => {
      const city = user.profile.city;
      cities[city] = (cities[city] || 0) + 1;
    });
    
    console.log('\n🗺️ GEOGRAPHIC DISTRIBUTION:');
    Object.entries(cities).forEach(([city, count]) => {
      console.log(`   ${city}: ${count} users`);
    });
    
    // Check services offered
    const services = {};
    caregivers.forEach(caregiver => {
      caregiver.caregiver.services.forEach(service => {
        services[service.serviceType] = (services[service.serviceType] || 0) + 1;
      });
    });
    
    console.log('\n🛠️ SERVICES OFFERED:');
    Object.entries(services).forEach(([service, count]) => {
      console.log(`   ${service}: ${count} caregivers`);
    });
    
    console.log('\n📊 VERIFICATION STATUS:');
    console.log(`✅ Verified Caregivers: ${caregivers.filter(c => c.caregiver.isVerified).length}/${caregivers.length}`);
    console.log(`🔍 Background Checks: ${caregivers.filter(c => c.caregiver.backgroundCheck).length}/${caregivers.length}`);
    console.log(`📧 Email Verified: ${users.filter(u => u.emailVerified).length}/${users.length}`);
    console.log(`📱 Phone Verified: ${users.filter(u => u.phoneVerified).length}/${users.length}`);
    
    console.log('\n✅ Account verification completed successfully!');
    
  } catch (error) {
    console.error('❌ Error verifying accounts:', error);
  }
}

async function main() {
  await verifyAccounts();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });