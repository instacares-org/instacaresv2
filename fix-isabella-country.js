const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixIsabellaCountry() {
  try {
    console.log('🔧 Fixing Isabella Rodriguez country setting...\n');
    
    // Find Isabella's user account
    const user = await prisma.user.findFirst({
      where: {
        email: 'isabella.rodriguez@example.com'
      },
      include: {
        profile: true
      }
    });
    
    if (!user || !user.profile) {
      console.log('❌ Isabella Rodriguez or her profile not found');
      return;
    }
    
    console.log('Current Profile Data:');
    console.log('   Country:', user.profile.country);
    console.log('   City:', user.profile.city);
    console.log('   State:', user.profile.state);
    
    // Check if country needs fixing
    if (user.profile.country !== 'CA' && user.profile.country !== 'Canada') {
      console.log('\n⚠️ Country is not set to CA/Canada. Fixing...');
      
      const updated = await prisma.profile.update({
        where: { userId: user.id },
        data: {
          country: 'CA',  // The API expects 'CA' not 'Canada'
          city: user.profile.city || 'Toronto',
          state: user.profile.state || 'ON'
        }
      });
      
      console.log('\n✅ Fixed profile:');
      console.log('   Country:', updated.country);
      console.log('   City:', updated.city);
      console.log('   State:', updated.state);
    } else if (user.profile.country === 'Canada') {
      // Change 'Canada' to 'CA' for consistency
      console.log('\n⚠️ Country is "Canada" but should be "CA". Fixing...');
      
      const updated = await prisma.profile.update({
        where: { userId: user.id },
        data: {
          country: 'CA'
        }
      });
      
      console.log('\n✅ Fixed profile:');
      console.log('   Country:', updated.country);
    } else {
      console.log('\n✅ Country is already set correctly to:', user.profile.country);
    }
    
    // Also check and update all other caregivers with 'Canada' instead of 'CA'
    console.log('\n🔍 Checking all profiles for country format...');
    
    const profilesWithCanada = await prisma.profile.findMany({
      where: {
        country: 'Canada'
      }
    });
    
    if (profilesWithCanada.length > 0) {
      console.log(`Found ${profilesWithCanada.length} profiles with country="Canada"`);
      console.log('Updating all to "CA"...');
      
      await prisma.profile.updateMany({
        where: {
          country: 'Canada'
        },
        data: {
          country: 'CA'
        }
      });
      
      console.log('✅ Updated all profiles to use "CA" instead of "Canada"');
    }
    
    // Check final state
    const finalUser = await prisma.user.findFirst({
      where: {
        email: 'isabella.rodriguez@example.com'
      },
      include: {
        profile: true,
        caregiver: true
      }
    });
    
    console.log('\n📊 Final Isabella Status:');
    console.log('   Active:', finalUser.isActive);
    console.log('   Approved:', finalUser.approvalStatus);
    console.log('   Country:', finalUser.profile.country);
    console.log('   Caregiver Verified:', finalUser.caregiver?.isVerified);
    console.log('\n✨ Isabella should now appear in search results!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixIsabellaCountry();