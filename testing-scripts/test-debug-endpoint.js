const fetch = require('node-fetch');

const PRODUCTION_URL = 'https://instacares.net';
const TEST_CREDENTIALS = {
  caregiver: {
    email: 'sarah.johnson@testmail.ca',
    password: 'TestCaregiver123!',
    userType: 'caregiver'
  },
  parent: {
    email: 'michael.chen@testmail.ca',
    password: 'TestParent123!',
    userType: 'parent'
  }
};

async function testDebugEndpoint() {
  console.log('🔍 TESTING PRODUCTION DEBUG ENDPOINT');
  console.log('====================================\n');
  
  try {
    // Test 1: Basic endpoint health
    console.log('1️⃣ Testing Debug Endpoint Health...');
    const healthResponse = await fetch(`${PRODUCTION_URL}/api/debug/auth-test`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log(`   Status: ${healthResponse.status}`);
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('   Environment Info:');
      console.log(`     Environment: ${healthData.environment}`);
      console.log(`     NEXTAUTH_URL: ${healthData.nextAuthUrl || 'not set'}`);
      console.log(`     Has NEXTAUTH_SECRET: ${healthData.hasNextAuthSecret}`);
      console.log(`     Has DATABASE_URL: ${healthData.hasDatabaseUrl}`);
    } else {
      const errorText = await healthResponse.text();
      console.log(`   Error: ${errorText}`);
    }
    
    // Test 2: Caregiver Authentication Debug
    console.log('\n2️⃣ Testing Caregiver Authentication...');
    const caregiverResponse = await fetch(`${PRODUCTION_URL}/api/debug/auth-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_CREDENTIALS.caregiver)
    });
    
    console.log(`   Status: ${caregiverResponse.status}`);
    if (caregiverResponse.ok) {
      const data = await caregiverResponse.json();
      console.log('   Database Test:');
      console.log(`     Connected: ${data.databaseTest?.connected}`);
      console.log(`     Total Users: ${data.databaseTest?.totalUsers}`);
      if (data.databaseTest?.error) console.log(`     DB Error: ${data.databaseTest.error}`);
      
      console.log('   Auth Test:');
      console.log(`     User Found: ${data.authTest?.userFound}`);
      console.log(`     User Type: ${data.authTest?.userType}`);
      console.log(`     Is Active: ${data.authTest?.isActive}`);
      console.log(`     Approval Status: ${data.authTest?.approvalStatus}`);
      console.log(`     Email Verified: ${data.authTest?.emailVerified}`);
      console.log(`     Has Password Hash: ${data.authTest?.hasPasswordHash}`);
      console.log(`     Password Match: ${data.authTest?.passwordMatch}`);
      console.log(`     User Type Match: ${data.authTest?.userTypeMatch}`);
      if (data.authTest?.error) console.log(`     Auth Error: ${data.authTest.error}`);
    } else {
      const errorText = await caregiverResponse.text();
      console.log(`   Error: ${errorText}`);
    }
    
    // Test 3: Parent Authentication Debug
    console.log('\n3️⃣ Testing Parent Authentication...');
    const parentResponse = await fetch(`${PRODUCTION_URL}/api/debug/auth-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_CREDENTIALS.parent)
    });
    
    console.log(`   Status: ${parentResponse.status}`);
    if (parentResponse.ok) {
      const data = await parentResponse.json();
      console.log('   Auth Test:');
      console.log(`     User Found: ${data.authTest?.userFound}`);
      console.log(`     User Type: ${data.authTest?.userType}`);
      console.log(`     Is Active: ${data.authTest?.isActive}`);
      console.log(`     Approval Status: ${data.authTest?.approvalStatus}`);
      console.log(`     Email Verified: ${data.authTest?.emailVerified}`);
      console.log(`     Has Password Hash: ${data.authTest?.hasPasswordHash}`);
      console.log(`     Password Match: ${data.authTest?.passwordMatch}`);
      console.log(`     User Type Match: ${data.authTest?.userTypeMatch}`);
      if (data.authTest?.error) console.log(`     Auth Error: ${data.authTest.error}`);
    } else {
      const errorText = await parentResponse.text();
      console.log(`   Error: ${errorText}`);
    }
    
    console.log('\n✅ Debug endpoint testing complete!');
    
  } catch (error) {
    console.error('❌ Debug endpoint test failed:', error.message);
  }
}

testDebugEndpoint().catch(console.error);