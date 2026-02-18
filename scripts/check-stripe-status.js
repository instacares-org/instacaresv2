const { PrismaClient } = require('/var/www/instacaresv2/node_modules/@prisma/client');
const db = new PrismaClient();

async function main() {
  const bs = await db.babysitter.findFirst({
    where: { user: { email: 'fazilanoorzad@yahoo.co.uk' } },
    include: { user: { select: { email: true } } }
  });

  if (bs) {
    console.log('Babysitter ID:', bs.id);
    console.log('stripeConnectId:', bs.stripeConnectId);
    console.log('stripeOnboarded:', bs.stripeOnboarded);
    console.log('acceptsOnsitePayment:', bs.acceptsOnsitePayment);
  } else {
    console.log('Babysitter not found');
  }

  process.exit(0);
}

main().catch(function(e) { console.error(e); process.exit(1); });
