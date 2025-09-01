const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkIsabella() {
  try {
    console.log('🔍 Looking for Isabella Rodriguez...\n');
    
    // Find Isabella's user account
    const user = await prisma.user.findFirst({
      where: {
        email: 'isabella.rodriguez@example.com'
      },
      include: {
        profile: true,
        caregiver: true
      }
    });
    
    if (!user) {
      console.log('❌ Isabella Rodriguez not found in database');
      return;
    }
    
    console.log('✅ Found Isabella Rodriguez:');
    console.log('   User ID:', user.id);
    console.log('   Email:', user.email);
    console.log('   User Type:', user.userType);
    console.log('   Active:', user.isActive);
    console.log('   Approval Status:', user.approvalStatus);
    
    if (user.profile) {
      console.log('\n📍 Profile Information:');
      console.log('   Name:', user.profile.firstName, user.profile.lastName);
      console.log('   Phone:', user.profile.phone);
      console.log('   Street Address:', user.profile.streetAddress);
      console.log('   City:', user.profile.city);
      console.log('   State:', user.profile.state);
      console.log('   Zip Code:', user.profile.zipCode);
      console.log('   Country:', user.profile.country);
      console.log('   Latitude:', user.profile.latitude);
      console.log('   Longitude:', user.profile.longitude);
    }
    
    if (user.caregiver) {
      console.log('\n👩‍⚕️ Caregiver Information:');
      console.log('   Caregiver ID:', user.caregiver.id);
      console.log('   Hourly Rate:', user.caregiver.hourlyRate);
      console.log('   Is Verified:', user.caregiver.isVerified);
      console.log('   Is Available:', user.caregiver.isAvailable);
      console.log('   Average Rating:', user.caregiver.averageRating);
      console.log('   Total Reviews:', user.caregiver.totalReviews);
      console.log('   Languages:', user.caregiver.languages);
      
      // Check availability slots
      const slots = await prisma.availabilitySlot.findMany({
        where: {
          caregiverId: user.caregiver.id,
          date: {
            gte: new Date()
          }
        },
        orderBy: {
          date: 'asc'
        },
        take: 5
      });
      
      console.log('\n📅 Upcoming Availability Slots:', slots.length);
      slots.forEach(slot => {
        console.log(`   - ${slot.date.toDateString()}: ${slot.availableSpots}/${slot.totalCapacity} spots available`);
      });
    }
    
    // Check if coordinates are missing
    if (!user.profile?.latitude || !user.profile?.longitude) {
      console.log('\n⚠️ WARNING: Missing coordinates! This is why the caregiver card is not showing.');
      console.log('   The search functionality requires valid latitude/longitude.');
      
      // Try to update with default Toronto coordinates
      console.log('\n🔧 Fixing by setting default Toronto coordinates...');
      
      const updated = await prisma.profile.update({
        where: { id: user.profile.id },
        data: {
          latitude: 43.65107,
          longitude: -79.347015,
          city: user.profile?.city || 'Toronto',
          state: user.profile?.state || 'ON',
          country: user.profile?.country || 'Canada'
        }
      });
      
      console.log('✅ Updated profile with coordinates:');
      console.log('   Latitude:', updated.latitude);
      console.log('   Longitude:', updated.longitude);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkIsabella();