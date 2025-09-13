const fetch = require('node-fetch');

const PRODUCTION_URL = 'https://instacares.net';
const TEST_CREDENTIALS = [
  {
    email: 'sarah.johnson@testmail.ca',
    password: 'TestCaregiver123!',
    userType: 'caregiver',
    loginUrl: '/login/caregiver'
  },
  {
    email: 'michael.chen@testmail.ca',
    password: 'TestParent123!',
    userType: 'parent',
    loginUrl: '/login/parent'
  }
];

async function investigateLoginIssue() {
  console.log('🔍 INVESTIGATING LOGIN ISSUES');
  console.log('============================\n');
  
  try {
    // Step 1: Check if accounts still exist
    console.log('1️⃣ Checking account status...');
    const statusResponse = await fetch(`${PRODUCTION_URL}/api/debug/create-accounts`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (statusResponse.ok) {
      const data = await statusResponse.json();
      console.log(`   Total users: ${data.totalUsers}`);
      console.log(`   Test accounts found: ${data.testAccounts.length}`);
      
      if (data.testAccounts.length > 0) {
        console.log('   ✅ Test accounts exist:');
        data.testAccounts.forEach(account => {
          console.log(`     - ${account.email} (${account.userType}) - Active: ${account.isActive}, Status: ${account.approvalStatus}`);
        });
      } else {
        console.log('   ❌ No test accounts found!');
      }
    } else {
      console.log('   ❌ Could not check status:', await statusResponse.text());
    }
    
    // Step 2: Test authentication for each account
    console.log('\n2️⃣ Testing authentication...');
    for (const cred of TEST_CREDENTIALS) {
      console.log(`\n   Testing ${cred.userType} login:`);
      
      const authResponse = await fetch(`${PRODUCTION_URL}/api/debug/auth-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cred)
      });
      
      if (authResponse.ok) {
        const authData = await authResponse.json();
        console.log(`     User found: ${authData.authTest?.userFound}`);
        console.log(`     Password match: ${authData.authTest?.passwordMatch}`);
        console.log(`     Account active: ${authData.authTest?.isActive}`);
        console.log(`     Approval status: ${authData.authTest?.approvalStatus}`);
        console.log(`     User type match: ${authData.authTest?.userTypeMatch}`);
        
        if (authData.authTest?.error) {
          console.log(`     ❌ Auth error: ${authData.authTest.error}`);
        }
      } else {
        console.log(`     ❌ Auth test failed: ${await authResponse.text()}`);
      }
    }
    
    // Step 3: Test NextAuth API directly
    console.log('\n3️⃣ Testing NextAuth API...');
    
    // Get CSRF token
    const csrfResponse = await fetch(`${PRODUCTION_URL}/api/auth/csrf`);
    let csrfToken = '';
    let cookies = '';
    
    if (csrfResponse.ok) {
      const csrfData = await csrfResponse.json();
      csrfToken = csrfData.csrfToken;
      cookies = csrfResponse.headers.get('set-cookie') || '';
      console.log(`   CSRF token obtained: ${csrfToken.substring(0, 20)}...`);
    }
    
    // Test caregiver login via NextAuth
    console.log('\n   Testing caregiver NextAuth login...');
    const caregiverLogin = await fetch(`${PRODUCTION_URL}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies
      },
      body: new URLSearchParams({
        email: 'sarah.johnson@testmail.ca',
        password: 'TestCaregiver123!',
        userType: 'caregiver',
        csrfToken: csrfToken,
        callbackUrl: `${PRODUCTION_URL}/caregiver-dashboard`,
        json: 'true'
      }),
      redirect: 'manual'
    });
    
    console.log(`     Status: ${caregiverLogin.status}`);
    console.log(`     Location: ${caregiverLogin.headers.get('location') || 'None'}`);
    
    const caregiverResponse = await caregiverLogin.text();
    if (caregiverResponse.includes('error')) {
      console.log(`     ❌ Error in response: ${caregiverResponse.substring(0, 200)}...`);
    } else {
      console.log(`     ✅ Response looks good: ${caregiverResponse.substring(0, 100)}...`);
    }
    
    // Step 4: Check if registration is working
    console.log('\n4️⃣ Testing user registration...');
    
    const testNewUser = {
      email: 'test.new.user@testmail.ca',
      password: 'TestNew123!',
      userType: 'PARENT',
      firstName: 'Test',
      lastName: 'User',
      phone: '+1-416-555-9999'
    };
    
    const regResponse = await fetch(`${PRODUCTION_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testNewUser)
    });
    
    console.log(`   Registration status: ${regResponse.status}`);
    if (regResponse.ok) {
      const regData = await regResponse.json();
      console.log(`   ✅ Registration response: ${JSON.stringify(regData, null, 2)}`);
    } else {
      const regError = await regResponse.text();
      console.log(`   ❌ Registration error: ${regError}`);
    }
    
    console.log('\n✅ Investigation complete!');
    
  } catch (error) {
    console.error('❌ Investigation failed:', error.message);
  }
}

investigateLoginIssue().catch(console.error);