const fetch = require('node-fetch');
const { URLSearchParams } = require('url');

const PRODUCTION_URL = 'https://instacares.net';

async function testNextAuthDirect() {
  console.log('🔧 TESTING NEXTAUTH DIRECT AUTHENTICATION');
  console.log('=========================================\n');
  
  try {
    // Step 1: Get providers
    console.log('1️⃣ Getting NextAuth providers...');
    const providersResponse = await fetch(`${PRODUCTION_URL}/api/auth/providers`);
    
    if (providersResponse.ok) {
      const providers = await providersResponse.json();
      console.log('   Available providers:', Object.keys(providers));
      
      const credentialsProvider = providers.credentials;
      if (credentialsProvider) {
        console.log('   ✅ Credentials provider found');
        console.log('   Provider config:', JSON.stringify(credentialsProvider, null, 2));
      } else {
        console.log('   ❌ Credentials provider not found!');
      }
    } else {
      console.log('   ❌ Failed to get providers:', await providersResponse.text());
    }
    
    // Step 2: Test signIn endpoint directly
    console.log('\n2️⃣ Testing signIn endpoint...');
    
    const signInResponse = await fetch(`${PRODUCTION_URL}/api/auth/signin/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        email: 'sarah.johnson@testmail.ca',
        password: 'TestCaregiver123!',
        userType: 'caregiver',
        callbackUrl: `${PRODUCTION_URL}/caregiver-dashboard`,
        json: 'true'
      }),
      redirect: 'manual'
    });
    
    console.log(`   Status: ${signInResponse.status}`);
    console.log(`   Location: ${signInResponse.headers.get('location') || 'None'}`);
    
    const signInText = await signInResponse.text();
    console.log(`   Response: ${signInText.substring(0, 500)}...`);
    
    // Step 3: Test with proper CSRF handling
    console.log('\n3️⃣ Testing with CSRF token...');
    
    // Get CSRF token first
    const csrfResponse = await fetch(`${PRODUCTION_URL}/api/auth/csrf`);
    let csrfToken = '';
    let cookies = '';
    
    if (csrfResponse.ok) {
      const csrfData = await csrfResponse.json();
      csrfToken = csrfData.csrfToken;
      cookies = csrfResponse.headers.get('set-cookie') || '';
      console.log(`   CSRF token: ${csrfToken.substring(0, 20)}...`);
    }
    
    // Test signIn with CSRF
    const signInWithCSRFResponse = await fetch(`${PRODUCTION_URL}/api/auth/signin/credentials`, {
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
    
    console.log(`   Status with CSRF: ${signInWithCSRFResponse.status}`);
    console.log(`   Location with CSRF: ${signInWithCSRFResponse.headers.get('location') || 'None'}`);
    
    const signInWithCSRFText = await signInWithCSRFResponse.text();
    console.log(`   Response with CSRF: ${signInWithCSRFText.substring(0, 500)}...`);
    
    // Step 4: Check if there are any specific error patterns
    console.log('\n4️⃣ Analyzing responses...');
    
    if (signInWithCSRFText.includes('signin?csrf=true')) {
      console.log('   ❌ Authentication failed - returning to signin');
    } else if (signInWithCSRFText.includes('error')) {
      console.log('   ❌ Error in response');
    } else if (signInWithCSRFResponse.headers.get('location')) {
      console.log('   ✅ Redirect occurred - might be successful');
    } else {
      console.log('   ⚠️ Unclear response');
    }
    
    // Step 5: Try to understand the NextAuth configuration
    console.log('\n5️⃣ Checking NextAuth configuration...');
    
    const configResponse = await fetch(`${PRODUCTION_URL}/api/auth/session`);
    if (configResponse.ok) {
      const sessionData = await configResponse.json();
      console.log('   Session endpoint works:', sessionData);
    } else {
      console.log('   Session endpoint error:', await configResponse.text());
    }
    
    console.log('\n✅ Direct NextAuth testing complete!');
    
  } catch (error) {
    console.error('❌ Direct test failed:', error.message);
  }
}

testNextAuthDirect().catch(console.error);