const { PrismaClient } = require('/var/www/instacaresv2/node_modules/@prisma/client');
const db = new PrismaClient();

async function main() {
  const user = await db.user.findFirst({
    where: { email: 'fazilaanoorzad@yahoo.co.uk' },
    include: { babysitter: true, profile: true }
  });

  if (user === null) {
    console.log('User not found');
    process.exit(0);
  }

  console.log('User:', user.id, user.email, user.userType);
  console.log('Profile:', user.profile ? user.profile.firstName + ' ' + user.profile.lastName : 'No profile');

  if (user.babysitter) {
    console.log('Babysitter ID:', user.babysitter.id);
    console.log('Status:', user.babysitter.status);
    console.log('isAvailable:', user.babysitter.isAvailable);
    console.log('hourlyRate:', user.babysitter.hourlyRate);
    console.log('govIdFront:', user.babysitter.governmentIdFront ? 'YES' : 'NO');
    console.log('govIdBack:', user.babysitter.governmentIdBack ? 'YES' : 'NO');
    console.log('policeCheck:', user.babysitter.policeCheck ? 'YES' : 'NO');
    console.log('selfie:', user.babysitter.selfieForMatch ? 'YES' : 'NO');
  } else {
    console.log('No babysitter record found');
  }

  process.exit(0);
}

main().catch(function(e) { console.error(e); process.exit(1); });
