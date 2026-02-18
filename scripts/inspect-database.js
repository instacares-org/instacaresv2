const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function inspectDatabase() {
  console.log('🔍 Inspecting current database state...\n');

  try {
    // Find all users with their profiles and booking data
    const allUsers = await prisma.user.findMany({
      include: {
        profile: true,
        caregiver: true,
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
            }
          }
        },
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

    console.log(`📊 Total users in database: ${allUsers.length}\n`);

    // Group users by type
    const parents = allUsers.filter(u => u.userType === 'PARENT');
    const caregivers = allUsers.filter(u => u.userType === 'CAREGIVER');
    const admins = allUsers.filter(u => u.userType === 'ADMIN');

    console.log(`👨‍👩‍👧‍👦 Parents: ${parents.length}`);
    console.log(`👩‍⚕️ Caregivers: ${caregivers.length}`);
    console.log(`🛠️  Admins: ${admins.length}\n`);

    // Show all users with their details
    console.log('👤 All users in database:');
    console.log('═'.repeat(80));

    for (const user of allUsers) {
      const profile = user.profile;
      const name = profile ? `${profile.firstName} ${profile.lastName}` : 'No Profile';
      const email = user.email || 'No Email';
      const userType = user.userType;
      const bookingsAsParent = user.parentBookings.length;
      const bookingsAsCaregiver = user.caregiverBookings.length;
      const totalBookings = bookingsAsParent + bookingsAsCaregiver;

      console.log(`📋 ${name}`);
      console.log(`   📧 Email: ${email}`);
      console.log(`   👤 Type: ${userType}`);
      console.log(`   📅 Bookings: ${totalBookings} (${bookingsAsParent} as parent, ${bookingsAsCaregiver} as caregiver)`);
      console.log(`   🆔 ID: ${user.id}`);
      console.log('');
    }

    // Show Emily Thompson's specific data
    console.log('\n🔍 Checking Emily Thompson specifically...');
    console.log('═'.repeat(50));

    const emilyThompson = await prisma.user.findFirst({
      where: {
        OR: [
          { email: 'emily.thompson@example.com' },
          { 
            profile: {
              AND: [
                { firstName: { contains: 'Emily', mode: 'insensitive' } },
                { lastName: { contains: 'Thompson', mode: 'insensitive' } }
              ]
            }
          }
        ]
      },
      include: {
        profile: true,
        parentBookings: {
          include: {
            caregiver: {
              include: {
                user: {
                  include: {
                    profile: true
                  }
                }
              }
            },
            payments: true
          },
          orderBy: {
            startTime: 'desc'
          }
        }
      }
    });

    if (emilyThompson) {
      console.log(`✅ Found Emily Thompson: ${emilyThompson.profile?.firstName} ${emilyThompson.profile?.lastName}`);
      console.log(`📧 Email: ${emilyThompson.email}`);
      console.log(`📅 Total bookings: ${emilyThompson.parentBookings.length}`);
      
      if (emilyThompson.parentBookings.length > 0) {
        console.log('\n📋 Emily\'s bookings:');
        emilyThompson.parentBookings.forEach((booking, index) => {
          const caregiverName = booking.caregiverData?.user?.profile ? 
            `${booking.caregiverData.user.profile.firstName} ${booking.caregiverData.user.profile.lastName}` : 
            'Unknown Caregiver';
          const date = booking.startTime.toDateString();
          const time = `${booking.startTime.toLocaleTimeString()}-${booking.endTime.toLocaleTimeString()}`;
          const amount = `$${(booking.totalAmount / 100).toFixed(2)}`;
          const status = booking.status;
          
          console.log(`  ${index + 1}. ${caregiverName}`);
          console.log(`     📅 ${date} ${time}`);
          console.log(`     💰 ${amount} (Status: ${status})`);
          console.log(`     🆔 Booking ID: ${booking.id}`);
          console.log('');
        });
      }
    } else {
      console.log('❌ Emily Thompson not found in database!');
    }

    // Check for potential mock caregivers in Emily's bookings
    if (emilyThompson?.parentBookings.length > 0) {
      console.log('\n🔍 Analyzing caregivers in Emily\'s bookings...');
      const caregiverIds = [...new Set(emilyThompson.parentBookings.map(b => b.caregiverId))];
      
      for (const caregiverId of caregiverIds) {
        const caregiver = await prisma.user.findUnique({
          where: { id: caregiverId },
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

        if (caregiver) {
          const name = caregiver.profile ? `${caregiver.profile.firstName} ${caregiver.profile.lastName}` : 'No Profile';
          const email = caregiver.email || 'No Email';
          const totalBookings = caregiver.caregiverBookings.length;
          
          console.log(`👩‍⚕️ ${name}`);
          console.log(`   📧 ${email}`);
          console.log(`   📅 Total bookings: ${totalBookings}`);
          console.log(`   🆔 ID: ${caregiverId}`);
          
          // Check if this looks like mock data
          const isMockEmail = email.includes('@example.com') || email.includes('@test.com') || email === 'No Email';
          const hasNoBookingsWithRealUsers = caregiver.caregiverBookings.every(booking => 
            booking.parent.email?.includes('@example.com') || booking.parent.email?.includes('@test.com')
          );
          
          if (isMockEmail || hasNoBookingsWithRealUsers) {
            console.log('   🚨 LIKELY MOCK DATA - Should be cleaned up');
          }
          console.log('');
        }
      }
    }

    // Check for all bookings in the system
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
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    console.log(`\n📅 Total bookings in system: ${allBookings.length > 10 ? '10+ (showing latest 10)' : allBookings.length}`);
    console.log('Recent bookings:');
    allBookings.forEach((booking, index) => {
      const parentName = booking.parent.profile ? 
        `${booking.parent.profile.firstName} ${booking.parent.profile.lastName}` : 
        'Unknown Parent';
      const caregiverName = booking.caregiverData?.user?.profile ? 
        `${booking.caregiverData.user.profile.firstName} ${booking.caregiverData.user.profile.lastName}` : 
        'Unknown Caregiver';
      
      console.log(`${index + 1}. ${parentName} ↔ ${caregiverName}`);
      console.log(`   📅 ${booking.startTime.toDateString()} ${booking.startTime.toLocaleTimeString()}`);
      console.log(`   💰 $${(booking.totalAmount / 100).toFixed(2)} (${booking.status})`);
      console.log(`   🆔 ${booking.id}`);
    });

  } catch (error) {
    console.error('❌ Error inspecting database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the inspection
inspectDatabase()
  .then(() => {
    console.log('\n✅ Database inspection completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Inspection failed:', error);
    process.exit(1);
  });