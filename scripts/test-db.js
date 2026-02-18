const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.count()
  .then(c => console.log('DB OK, users:', c))
  .catch(e => console.error('DB ERROR:', e.message))
  .finally(() => p.$disconnect());
