const fetch = require('node-fetch');

const PRODUCTION_URL = 'https://instacares.net';

async function checkAdminAccount() {
  console.log('🔍 CHECKING ADMIN ACCOUNT STATUS');
  console.log('=================================\n');
  
  try {
    // Step 1: Check all users and look for admin accounts
    console.log('1️⃣ Checking for existing admin accounts...');
    
    const statusResponse = await fetch(`${PRODUCTION_URL}/api/debug/create-accounts`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log(`   Total users in production: ${statusData.totalUsers}`);
      console.log(`   Test accounts found: ${statusData.testAccounts.length}`);
      
      // Check if any admin accounts exist
      const adminAccounts = statusData.testAccounts.filter(account => 
        account.userType === 'ADMIN' || account.email.includes('admin')
      );
      
      if (adminAccounts.length > 0) {
        console.log('   ✅ Admin accounts found:');
        adminAccounts.forEach(admin => {
          console.log(`     - ${admin.email} (${admin.userType})`);
        });
      } else {
        console.log('   ❌ No admin accounts found in test accounts');
      }
    }
    
    // Step 2: Test if we can access admin endpoints
    console.log('\n2️⃣ Testing admin endpoint access...');
    
    const adminEndpointTest = await fetch(`${PRODUCTION_URL}/api/admin/users`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log(`   Admin endpoint status: ${adminEndpointTest.status}`);
    if (!adminEndpointTest.ok) {
      const errorText = await adminEndpointTest.text();
      console.log(`   Admin endpoint error: ${errorText}`);
    }
    
    // Step 3: Check what login paths are available
    console.log('\n3️⃣ Checking available login paths...');
    
    const paths = ['/login', '/login/admin', '/admin/login'];
    
    for (const path of paths) {
      try {
        const pathResponse = await fetch(`${PRODUCTION_URL}${path}`, {
          method: 'HEAD'
        });
        console.log(`   ${path}: ${pathResponse.status} ${pathResponse.statusText}`);
      } catch (error) {
        console.log(`   ${path}: Network error - ${error.message}`);
      }
    }
    
    // Step 4: Provide recommendations
    console.log('\n4️⃣ Recommendations:');
    console.log('   📋 Based on the results above:');
    
    if (adminAccounts && adminAccounts.length === 0) {
      console.log('   → Need to create an admin account');
      console.log('   → Admin login path needs to be confirmed');
    }
    
    console.log('\n✅ Admin account investigation complete!');
    
  } catch (error) {
    console.error('❌ Admin check failed:', error.message);
    console.log('\n💡 This might be the network error you\'re experiencing.');
    console.log('   Check your internet connection and production server status.');
  }
}

checkAdminAccount().catch(console.error);