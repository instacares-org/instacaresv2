const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkAllBookings() {
  console.log('🔍 Checking all bookings in the database...\n');

  try {
    // Get count of all bookings
    const totalBookingsCount = await prisma.booking.count();
    console.log(`📊 Total bookings in database: ${totalBookingsCount}`);

    if (totalBookingsCount === 0) {
      console.log('✅ No bookings found in database. System is clean!');
      return;
    }

    // Get all bookings with full details
    const allBookings = await prisma.booking.findMany({
      include: {
        parent: {
          include: {
            profile: true
          }
        },
        caregiverData: {
          include: {
            user: {
              include: {
                profile: true
              }
            }
          }
        },
        payments: true,
        reviews: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`\n📋 All ${allBookings.length} bookings:\n`);
    console.log('═'.repeat(100));

    allBookings.forEach((booking, index) => {
      const parentName = booking.parent?.profile ? 
        `${booking.parent.profile.firstName} ${booking.parent.profile.lastName}` : 
        'Unknown Parent';
      const parentEmail = booking.parent?.email || 'No Email';
      
      const caregiverName = booking.caregiverData?.user?.profile ? 
        `${booking.caregiverData.user.profile.firstName} ${booking.caregiverData.user.profile.lastName}` : 
        'Unknown Caregiver';
      const caregiverEmail = booking.caregiverData?.user?.email || 'No Email';
      
      const date = booking.startTime.toLocaleDateString();
      const startTime = booking.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const endTime = booking.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const amount = `$${(booking.totalAmount / 100).toFixed(2)}`;
      const status = booking.status;

      console.log(`${index + 1}. BOOKING ${booking.id.slice(-8)}`);
      console.log(`   👤 Parent: ${parentName} (${parentEmail})`);
      console.log(`   👩‍⚕️ Caregiver: ${caregiverName} (${caregiverEmail})`);
      console.log(`   📅 Date/Time: ${date} ${startTime}-${endTime}`);
      console.log(`   💰 Amount: ${amount} (${status})`);
      console.log(`   📊 Payments: ${booking.payments.length}, Reviews: ${booking.reviews.length}`);
      
      // Check if this looks like mock/test data
      const mockEmails = ['@example.com', '@test.com'];
      const isParentMock = mockEmails.some(domain => parentEmail.includes(domain));
      const isCaregiverMock = mockEmails.some(domain => caregiverEmail.includes(domain));
      
      if (isParentMock || isCaregiverMock) {
        console.log(`   🚨 MOCK DATA DETECTED - Should be cleaned up`);
      }
      
      console.log(`   🕒 Created: ${booking.createdAt.toLocaleDateString()} ${booking.createdAt.toLocaleTimeString()}`);
      console.log('');
    });

    // Specifically check Emily Thompson's bookings
    console.log('\n🔍 Checking Emily Thompson\'s specific bookings...');
    console.log('═'.repeat(60));

    const emilyThompson = await prisma.user.findFirst({
      where: {
        email: 'emily.thompson@example.com'
      },
      include: {
        profile: true,
        parentBookings: {
          include: {
            caregiverData: {
              include: {
                user: {
                  include: {
                    profile: true
                  }
                }
              }
            },
            payments: true,
            reviews: true
          }
        }
      }
    });

    if (emilyThompson) {
      console.log(`✅ Found Emily Thompson: ${emilyThompson.profile?.firstName} ${emilyThompson.profile?.lastName}`);
      console.log(`📧 Email: ${emilyThompson.email}`);
      console.log(`📅 Parent bookings: ${emilyThompson.parentBookings.length}`);

      if (emilyThompson.parentBookings.length > 0) {
        console.log('\n📋 Emily\'s bookings:');
        emilyThompson.parentBookings.forEach((booking, index) => {
          const caregiverName = booking.caregiverData?.user?.profile ? 
            `${booking.caregiverData.user.profile.firstName} ${booking.caregiverData.user.profile.lastName}` : 
            'Unknown Caregiver';
          const caregiverEmail = booking.caregiverData?.user?.email || 'No Email';
          const date = booking.startTime.toLocaleDateString();
          const startTime = booking.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const endTime = booking.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const amount = `$${(booking.totalAmount / 100).toFixed(2)}`;

          console.log(`  ${index + 1}. ${caregiverName} (${caregiverEmail})`);
          console.log(`     📅 ${date} ${startTime}-${endTime}`);
          console.log(`     💰 ${amount} (${booking.status})`);
          console.log(`     🆔 Booking ID: ${booking.id}`);
          
          // Check for specific mock caregivers mentioned by user
          const mockCaregiverNames = ['Emily Davis', 'Jennifer Chen', 'Sarah Johnson', 'Fazila Noorzad'];
          if (mockCaregiverNames.includes(caregiverName)) {
            console.log(`     🚨 THIS IS THE MOCK DATA TO DELETE!`);
          }
          console.log('');
        });
      } else {
        console.log('✅ Emily Thompson has no bookings - account is clean!');
      }
    } else {
      console.log('❌ Emily Thompson not found!');
    }

    // Check for any users with the mock caregiver names mentioned
    console.log('\n🔍 Checking for mock caregivers mentioned by user...');
    console.log('═'.repeat(60));

    const mockCaregiverNames = [
      { firstName: 'Emily', lastName: 'Davis' },
      { firstName: 'Jennifer', lastName: 'Chen' },
      { firstName: 'Sarah', lastName: 'Johnson' },
      { firstName: 'Fazila', lastName: 'Noorzad' }
    ];

    let foundMockCaregivers = [];

    for (const mockName of mockCaregiverNames) {
      const mockCaregiver = await prisma.user.findFirst({
        where: {
          profile: {
            firstName: mockName.firstName,
            lastName: mockName.lastName
          }
        },
        include: {
          profile: true,
          caregiverBookings: {
            include: {
              parent: {
                include: {
                  profile: true
                }
              }
            }
          }
        }
      });

      if (mockCaregiver) {
        foundMockCaregivers.push(mockCaregiver);
        console.log(`🚨 Found mock caregiver: ${mockCaregiver.profile?.firstName} ${mockCaregiver.profile?.lastName}`);
        console.log(`   📧 Email: ${mockCaregiver.email}`);
        console.log(`   📅 Bookings: ${mockCaregiver.caregiverBookings.length}`);
        console.log(`   🆔 ID: ${mockCaregiver.id}`);
      }
    }

    if (foundMockCaregivers.length === 0) {
      console.log('✅ No mock caregivers with those names found in database');
    }

    // Summary
    console.log('\n📊 SUMMARY');
    console.log('═'.repeat(40));
    console.log(`Total bookings: ${totalBookingsCount}`);
    console.log(`Mock caregivers found: ${foundMockCaregivers.length}`);
    console.log(`Emily Thompson bookings: ${emilyThompson?.parentBookings.length || 0}`);

    if (totalBookingsCount === 0 && foundMockCaregivers.length === 0) {
      console.log('\n🎉 Database appears to be clean of mock data!');
    } else if (totalBookingsCount > 0) {
      console.log('\n⚠️  There are bookings in the database - please review above to identify which need cleanup');
    }

  } catch (error) {
    console.error('❌ Error checking bookings:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkAllBookings()
  .then(() => {
    console.log('\n✅ Booking check completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Check failed:', error);
    process.exit(1);
  });