#!/usr/bin/env node
/**
 * Debug login API issues
 */

const https = require('https');

function testLogin(email, password) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      email: email,
      password: password,
      userType: 'parent'
    });

    const options = {
      hostname: 'instacares.net',
      port: 443,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body,
          parsed: (() => {
            try {
              return JSON.parse(body);
            } catch {
              return body;
            }
          })()
        });
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function debugLogin() {
  console.log('🔍 Debug login API...');
  
  console.log('\n1. Testing parent account:');
  try {
    const result1 = await testLogin('parent.test@instacares.com', 'TestParent123!');
    console.log(`Status: ${result1.statusCode}`);
    console.log(`Response:`, result1.parsed);
    console.log(`Headers:`, {
      'content-type': result1.headers['content-type'],
      'x-ratelimit-remaining': result1.headers['x-ratelimit-remaining']
    });
  } catch (error) {
    console.error('Error:', error.message);
  }

  console.log('\n2. Testing caregiver account:');
  try {
    const result2 = await testLogin('caregiver.test@instacares.com', 'TestCaregiver123!');
    console.log(`Status: ${result2.statusCode}`);
    console.log(`Response:`, result2.parsed);
  } catch (error) {
    console.error('Error:', error.message);
  }

  console.log('\n3. Testing with invalid account:');
  try {
    const result3 = await testLogin('nonexistent@test.com', 'wrongpassword');
    console.log(`Status: ${result3.statusCode}`);
    console.log(`Response:`, result3.parsed);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugLogin().then(() => {
  console.log('\n✅ Debug completed');
}).catch((error) => {
  console.error('❌ Debug failed:', error);
});