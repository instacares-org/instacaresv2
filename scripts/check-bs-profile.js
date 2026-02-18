const { PrismaClient } = require('/var/www/instacaresv2/node_modules/@prisma/client');
const db = new PrismaClient();

async function main() {
  const user = await db.user.findFirst({
    where: { email: 'fazilanoorzad@yahoo.co.uk' },
    include: {
      babysitter: {
        include: { availabilitySlots: true }
      },
      profile: true
    }
  });

  console.log('Profile city:', user.profile ? user.profile.city : 'NONE');
  console.log('Profile state/province:', user.profile ? user.profile.province : 'NONE');
  console.log('Profile firstName:', user.profile ? user.profile.firstName : 'NONE');
  console.log('Profile lastName:', user.profile ? user.profile.lastName : 'NONE');
  console.log('Profile avatar:', user.profile ? user.profile.avatar : 'NONE');
  console.log('Availability slots:', user.babysitter ? user.babysitter.availabilitySlots.length : 0);
  if (user.babysitter && user.babysitter.availabilitySlots.length > 0) {
    user.babysitter.availabilitySlots.forEach(function(s) {
      console.log('  Day:', s.dayOfWeek, 'Time:', s.startTime, '-', s.endTime, 'Active:', s.isActive);
    });
  }

  process.exit(0);
}

main().catch(function(e) { console.error(e); process.exit(1); });
