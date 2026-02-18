const { PrismaClient } = require('/var/www/instacaresv2/node_modules/@prisma/client');
const db = new PrismaClient();

async function main() {
  const babysitterId = 'cmlcq197e0003jx8fdfp1ywdl';

  const updated = await db.babysitter.update({
    where: { id: babysitterId },
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
    }
  });

  console.log('Updated babysitter:', updated.id);
  console.log('New status:', updated.status);
  console.log('isAvailable:', updated.isAvailable);

  // Also update user approval status
  await db.user.update({
    where: { id: 'cmlcq196j0000jx8f0uhtrdrk' },
    data: { approvalStatus: 'APPROVED' }
  });

  console.log('User approval status updated to APPROVED');
  process.exit(0);
}

main().catch(function(e) { console.error(e); process.exit(1); });
