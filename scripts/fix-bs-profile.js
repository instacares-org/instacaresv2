const { PrismaClient } = require('/var/www/instacaresv2/node_modules/@prisma/client');
const db = new PrismaClient();

async function main() {
  // Update profile to have state = ON (Ontario)
  const updated = await db.userProfile.updateMany({
    where: {
      user: { email: 'fazilanoorzad@yahoo.co.uk' }
    },
    data: {
      state: 'ON',
      country: 'CA',
    }
  });

  console.log('Updated profiles:', updated.count);
  process.exit(0);
}

main().catch(function(e) { console.error(e); process.exit(1); });
