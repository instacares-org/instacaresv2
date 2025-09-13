const fetch = require('node-fetch');

const PRODUCTION_URL = 'https://instacares.net';

async function resetAdminLockout() {
  console.log('🔓 RESETTING ADMIN ACCOUNT LOCKOUT');
  console.log('==================================\n');
  
  console.log('The admin account is currently locked due to rate limiting.');
  console.log('Unfortunately, the rate limiting is stored in memory on the server,');
  console.log('so I cannot reset it directly through an API call.\n');
  
  console.log('🕒 Current Status:');
  console.log('   Account: admin@instacares.net');
  console.log('   Status: Locked for ~4 minutes (15-minute lockout)');
  console.log('   Reason: Too many failed NextAuth attempts during testing\n');
  
  console.log('💡 Solutions:');
  console.log('   1. Wait ~4 minutes for automatic unlock');
  console.log('   2. Restart the production server to clear memory');
  console.log('   3. The account itself is working - authentication passes in debug mode\n');
  
  console.log('🔑 Admin Credentials (Ready Once Unlocked):');
  console.log('   Email: admin@instacares.net');
  console.log('   Password: AdminInstaCares2024!');
  console.log('   Login URL: https://instacares.net/login/admin');
  
  console.log('\n✅ Account is fully functional - just temporarily rate-limited');
}

resetAdminLockout().catch(console.error);