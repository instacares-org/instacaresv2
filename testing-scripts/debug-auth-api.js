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

async function debugAuthAPI() {
  console.log('🔍 DEBUGGING NEXTAUTH API ENDPOINTS');
  console.log('====================================\n');
  
  try {
    // Test 1: Check NextAuth API health
    console.log('1️⃣ Testing NextAuth API Health...');
    try {
      const response = await fetch(`${PRODUCTION_URL}/api/auth/providers`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.text();
      console.log(`   Status: ${response.status}`);
      console.log(`   Response: ${data.substring(0, 200)}...`);
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    // Test 2: Get CSRF Token
    console.log('\n2️⃣ Getting CSRF Token...');
    let csrfToken = '';
    let sessionCookies = '';
    
    try {
      const response = await fetch(`${PRODUCTION_URL}/api/auth/csrf`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      csrfToken = data.csrfToken;
      sessionCookies = response.headers.get('set-cookie') || '';
      
      console.log(`   Status: ${response.status}`);
      console.log(`   CSRF Token: ${csrfToken}`);
      console.log(`   Cookies: ${sessionCookies}`);
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    // Test 3: Test Caregiver Authentication
    console.log('\n3️⃣ Testing Caregiver Authentication...');
    try {
      const authData = {
        email: TEST_CREDENTIALS.caregiver.email,
        password: TEST_CREDENTIALS.caregiver.password,
        userType: TEST_CREDENTIALS.caregiver.userType,
        csrfToken: csrfToken,
        callbackUrl: `${PRODUCTION_URL}/caregiver-dashboard`,
        json: 'true'
      };
      
      const response = await fetch(`${PRODUCTION_URL}/api/auth/callback/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': sessionCookies
        },
        body: new URLSearchParams(authData),
        redirect: 'manual'
      });
      
      console.log(`   Status: ${response.status}`);
      console.log(`   Status Text: ${response.statusText}`);
      console.log(`   Location Header: ${response.headers.get('location') || 'None'}`);
      
      const responseText = await response.text();
      console.log(`   Response Body: ${responseText.substring(0, 300)}...`);
      
      const responseCookies = response.headers.get('set-cookie');
      console.log(`   Set-Cookie: ${responseCookies || 'None'}`);
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    // Test 4: Test Direct Credentials Authorize
    console.log('\n4️⃣ Testing Direct Credentials Provider...');
    try {
      const authData = {
        email: TEST_CREDENTIALS.caregiver.email,
        password: TEST_CREDENTIALS.caregiver.password,
        userType: TEST_CREDENTIALS.caregiver.userType
      };
      
      const response = await fetch(`${PRODUCTION_URL}/api/auth/providers/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(authData)
      });
      
      console.log(`   Status: ${response.status}`);
      const responseText = await response.text();
      console.log(`   Response: ${responseText}`);
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    // Test 5: Test Session Endpoint
    console.log('\n5️⃣ Testing Session Endpoint...');
    try {
      const response = await fetch(`${PRODUCTION_URL}/api/auth/session`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      console.log(`   Status: ${response.status}`);
      const data = await response.json();
      console.log(`   Session Data: ${JSON.stringify(data, null, 2)}`);
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    // Test 6: Test Direct Database Connection from Production
    console.log('\n6️⃣ Testing Database Connection via API...');
    try {
      const response = await fetch(`${PRODUCTION_URL}/api/auth/debug`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      console.log(`   Status: ${response.status}`);
      const data = await response.text();
      console.log(`   Debug Response: ${data.substring(0, 400)}...`);
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log('\n✅ API debugging complete!');
    
  } catch (error) {
    console.error('❌ Critical debugging error:', error);
  }
}

debugAuthAPI().catch(console.error);