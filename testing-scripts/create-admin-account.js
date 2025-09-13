const fetch = require('node-fetch');

const PRODUCTION_URL = 'https://instacares.net';

async function createAdminAccount() {
  console.log('👑 CREATING ADMIN ACCOUNT FOR PRODUCTION');
  console.log('========================================\n');
  
  try {
    // Step 1: Create admin account via registration endpoint
    console.log('1️⃣ Creating admin account...');
    
    const adminAccountData = {
      email: 'admin@instacares.net',
      password: 'AdminInstaCares2024!',
      userType: 'ADMIN',
      firstName: 'Admin',
      lastName: 'User',
      phone: '+1-416-555-0000'
    };
    
    console.log(`   Creating admin account: ${adminAccountData.email}`);
    
    const createResponse = await fetch(`${PRODUCTION_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adminAccountData)
    });
    
    if (createResponse.ok) {
      const createData = await createResponse.json();
      console.log('   ✅ Admin account created successfully!');
      console.log(`   Response: ${JSON.stringify(createData, null, 2)}`);
    } else {
      const createError = await createResponse.text();
      console.log(`   ❌ Admin account creation failed: ${createError}`);
      
      // If account already exists, that's actually good
      if (createError.includes('already exists') || createError.includes('already registered')) {
        console.log('   ℹ️ Admin account already exists - this is fine!');
      } else {
        throw new Error(`Admin account creation failed: ${createError}`);
      }
    }
    
    // Step 2: Test admin authentication
    console.log('\n2️⃣ Testing admin authentication...');
    
    const authTestResponse = await fetch(`${PRODUCTION_URL}/api/debug/auth-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: adminAccountData.email,
        password: adminAccountData.password,
        userType: 'admin'
      })
    });
    
    if (authTestResponse.ok) {
      const authData = await authTestResponse.json();
      console.log('   Admin authentication test:');
      console.log(`     User found: ${authData.authTest?.userFound}`);
      console.log(`     Password match: ${authData.authTest?.passwordMatch}`);
      console.log(`     Account active: ${authData.authTest?.isActive}`);
      console.log(`     Approval status: ${authData.authTest?.approvalStatus}`);
      console.log(`     User type match: ${authData.authTest?.userTypeMatch}`);
      
      if (authData.authTest?.error) {
        console.log(`     ❌ Auth error: ${authData.authTest.error}`);
      } else {
        console.log('     ✅ Admin authentication successful!');
      }
    } else {
      console.log(`   ❌ Admin auth test failed: ${await authTestResponse.text()}`);
    }
    
    // Step 3: Test NextAuth admin login
    console.log('\n3️⃣ Testing NextAuth admin login...');
    
    // Get CSRF token
    const csrfResponse = await fetch(`${PRODUCTION_URL}/api/auth/csrf`);
    let csrfToken = '';
    let cookies = '';
    
    if (csrfResponse.ok) {
      const csrfData = await csrfResponse.json();
      csrfToken = csrfData.csrfToken;
      cookies = csrfResponse.headers.get('set-cookie') || '';
      console.log(`   CSRF token obtained for admin login`);
    }
    
    // Test admin NextAuth login
    const adminLoginResponse = await fetch(`${PRODUCTION_URL}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies
      },
      body: new URLSearchParams({
        email: adminAccountData.email,
        password: adminAccountData.password,
        userType: 'admin',
        csrfToken: csrfToken,
        callbackUrl: `${PRODUCTION_URL}/admin-dashboard`,
        json: 'true'
      }),
      redirect: 'manual'
    });
    
    console.log(`   Admin NextAuth login status: ${adminLoginResponse.status}`);
    const adminLoginLocation = adminLoginResponse.headers.get('location');
    console.log(`   Admin NextAuth location: ${adminLoginLocation || 'None'}`);
    
    const adminLoginResponse_text = await adminLoginResponse.text();
    console.log(`   Admin NextAuth response: ${adminLoginResponse_text.substring(0, 200)}...`);
    
    if (adminLoginLocation && adminLoginLocation.includes('/admin-dashboard')) {
      console.log('   ✅ Admin NextAuth login successful!');
    } else if (adminLoginResponse_text.includes('signin?csrf=true')) {
      console.log('   ⚠️ Admin NextAuth login returning CSRF redirect');
    } else {
      console.log('   ❌ Admin NextAuth login failed');
    }
    
    console.log('\n🎊 ADMIN ACCOUNT SETUP COMPLETE!');
    console.log('=================================');
    console.log('📋 Admin Account Details:');
    console.log(`   Email: ${adminAccountData.email}`);
    console.log(`   Password: ${adminAccountData.password}`);
    console.log(`   Login URL: https://instacares.net/login/admin`);
    console.log('   User Type: ADMIN');
    console.log('\n💡 Try logging in with these credentials at /login/admin');
    
  } catch (error) {
    console.error('❌ Admin account creation failed:', error.message);
    console.log('\n🔧 Manual Steps:');
    console.log('1. Check your database for admin accounts');
    console.log('2. Verify the registration endpoint is working');
    console.log('3. Ensure ADMIN user type is supported in your schema');
  }
}

createAdminAccount().catch(console.error);