const { PrismaClient } = require('/var/www/instacaresv2/node_modules/@prisma/client');
const db = new PrismaClient();

async function main() {
  // Find all babysitters
  const babysitters = await db.babysitter.findMany({
    include: {
      user: {
        include: { profile: true }
      }
    }
  });

  console.log('Total babysitters:', babysitters.length);
  babysitters.forEach(function(bs) {
    console.log('---');
    console.log('BS ID:', bs.id);
    console.log('Email:', bs.user.email);
    console.log('Name:', bs.user.profile ? bs.user.profile.firstName + ' ' + bs.user.profile.lastName : 'No profile');
    console.log('Status:', bs.status);
    console.log('isAvailable:', bs.isAvailable);
    console.log('Rate:', bs.hourlyRate);
  });

  // Also search for any user with fazila in the email
  const fazilaUsers = await db.user.findMany({
    where: { email: { contains: 'fazila', mode: 'insensitive' } },
    include: { profile: true, babysitter: true }
  });

  console.log('\n=== Users matching "fazila" ===');
  fazilaUsers.forEach(function(u) {
    console.log('User:', u.id, u.email, u.userType);
    console.log('Has babysitter:', u.babysitter ? 'YES - ' + u.babysitter.status : 'NO');
  });

  process.exit(0);
}

main().catch(function(e) { console.error(e); process.exit(1); });
