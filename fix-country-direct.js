const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixCountries() {
  try {
    console.log('🔧 Fixing country codes in database...\n');
    
    // Update all profiles with 'Canada' to 'CA'
    const result = await prisma.$executeRaw`
      UPDATE user_profiles 
      SET country = 'CA' 
      WHERE country = 'Canada'
    `;
    
    console.log(`✅ Updated ${result} profiles from 'Canada' to 'CA'`);
    
    // Check Isabella specifically
    const isabella = await prisma.user.findFirst({
      where: {
        email: 'isabella.rodriguez@example.com'
      },
      include: {
        profile: true,
        caregiver: true
      }
    });
    
    if (isabella) {
      console.log('\n📊 Isabella Rodriguez Status:');
      console.log('   User ID:', isabella.id);
      console.log('   Active:', isabella.isActive);
      console.log('   Approved:', isabella.approvalStatus);
      if (isabella.profile) {
        console.log('   Country:', isabella.profile.country);
        console.log('   City:', isabella.profile.city);
        console.log('   State:', isabella.profile.state);
        console.log('   Coordinates:', isabella.profile.latitude, isabella.profile.longitude);
      }
      if (isabella.caregiver) {
        console.log('   Caregiver Verified:', isabella.caregiver.isVerified);
        console.log('   Caregiver Available:', isabella.caregiver.isAvailable);
      }
    }
    
    // Check all active caregivers
    const activeCaregivers = await prisma.caregiver.findMany({
      where: {
        isVerified: true,
        user: {
          isActive: true,
          approvalStatus: 'APPROVED'
        }
      },
      include: {
        user: {
          include: {
            profile: true
          }
        }
      }
    });
    
    console.log(`\n📊 Total active caregivers: ${activeCaregivers.length}`);
    
    const countryCounts = {};
    activeCaregivers.forEach(cg => {
      const country = cg.user.profile?.country || 'NONE';
      countryCounts[country] = (countryCounts[country] || 0) + 1;
    });
    
    console.log('   Countries distribution:', countryCounts);
    
    // Clear the API cache to force refresh
    console.log('\n🗑️ Note: API cache needs to be cleared for changes to appear.');
    console.log('   Restart the Next.js dev server or wait for cache to expire.');
    
    console.log('\n✨ Isabella should now appear in search results after cache refresh!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixCountries();