const fetch = require('node-fetch');

const PRODUCTION_URL = 'https://instacares.net';

async function createProductionAccounts() {
  console.log('🔧 CREATING TEST ACCOUNTS IN PRODUCTION DATABASE');
  console.log('================================================\n');
  
  try {
    // Step 1: Check current account status
    console.log('1️⃣ Checking current account status...');
    const statusResponse = await fetch(`${PRODUCTION_URL}/api/debug/create-accounts`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log(`   Total users in production: ${statusData.totalUsers}`);
      console.log(`   Total caregivers: ${statusData.totalCaregivers}`);
      console.log(`   Test accounts found: ${statusData.testAccounts.length}`);
      
      if (statusData.testAccounts.length > 0) {
        console.log('   Existing test accounts:');
        statusData.testAccounts.forEach(account => {
          console.log(`     - ${account.email} (${account.userType})`);
        });
      }
    } else {
      console.log('   ⚠️ Could not check status:', await statusResponse.text());
    }
    
    // Step 2: Create accounts
    console.log('\n2️⃣ Creating test accounts...');
    const createResponse = await fetch(`${PRODUCTION_URL}/api/debug/create-accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (createResponse.ok) {
      const createData = await createResponse.json();
      console.log(`   Final user count: ${createData.finalUserCount}`);
      
      if (createData.created.length > 0) {
        console.log('   ✅ Successfully created accounts:');
        createData.created.forEach(account => {
          console.log(`     - ${account.email} (${account.userType}) - ID: ${account.userId}`);
        });
      }
      
      if (createData.existing.length > 0) {
        console.log('   ℹ️ Accounts already existed:');
        createData.existing.forEach(account => {
          console.log(`     - ${account.email} (${account.userType})`);
        });
      }
      
      if (createData.errors.length > 0) {
        console.log('   ❌ Errors during creation:');
        createData.errors.forEach(error => {
          console.log(`     - ${error.email}: ${error.error}`);
        });
      }
    } else {
      console.log('   ❌ Account creation failed:', await createResponse.text());
    }
    
    // Step 3: Verify authentication
    console.log('\n3️⃣ Verifying authentication after creation...');
    
    // Test caregiver credentials
    const caregiverTest = await fetch(`${PRODUCTION_URL}/api/debug/auth-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'sarah.johnson@testmail.ca',
        password: 'TestCaregiver123!',
        userType: 'caregiver'
      })
    });
    
    if (caregiverTest.ok) {
      const caregiverData = await caregiverTest.json();
      console.log('   Caregiver authentication test:');
      console.log(`     User found: ${caregiverData.authTest?.userFound}`);
      console.log(`     Password match: ${caregiverData.authTest?.passwordMatch}`);
      console.log(`     Account active: ${caregiverData.authTest?.isActive}`);
      console.log(`     Approval status: ${caregiverData.authTest?.approvalStatus}`);
    }
    
    // Test parent credentials
    const parentTest = await fetch(`${PRODUCTION_URL}/api/debug/auth-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'michael.chen@testmail.ca',
        password: 'TestParent123!',
        userType: 'parent'
      })
    });
    
    if (parentTest.ok) {
      const parentData = await parentTest.json();
      console.log('   Parent authentication test:');
      console.log(`     User found: ${parentData.authTest?.userFound}`);
      console.log(`     Password match: ${parentData.authTest?.passwordMatch}`);
      console.log(`     Account active: ${parentData.authTest?.isActive}`);
      console.log(`     Approval status: ${parentData.authTest?.approvalStatus}`);
    }
    
    console.log('\n✅ Production account setup complete!');
    console.log('\n📋 TEST ACCOUNTS READY:');
    console.log('================================');
    console.log('Caregiver: sarah.johnson@testmail.ca / TestCaregiver123!');
    console.log('Parent: michael.chen@testmail.ca / TestParent123!');
    console.log('Location: Toronto, Ontario, Canada');
    
  } catch (error) {
    console.error('❌ Production account setup failed:', error.message);
  }
}

createProductionAccounts().catch(console.error);