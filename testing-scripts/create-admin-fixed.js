const fetch = require('node-fetch');

const PRODUCTION_URL = 'https://instacares.net';

async function createAdminAccountFixed() {
  console.log('👑 CREATING ADMIN ACCOUNT (FIXED VERSION)');
  console.log('=========================================\n');
  
  try {
    // Step 1: Create admin account with all required fields
    console.log('1️⃣ Creating admin account with proper validation...');
    
    const adminAccountData = {
      email: 'admin@instacares.net',
      password: 'AdminInstaCares2024!',
      confirmPassword: 'AdminInstaCares2024!', // Added missing field
      userType: 'PARENT', // Use PARENT initially, we'll manually change to ADMIN
      firstName: 'Admin',
      lastName: 'User',
      phone: '+1-416-555-0000',
      agreeToTerms: true // Added missing field
    };
    
    console.log(`   Creating admin account: ${adminAccountData.email}`);
    console.log('   Note: Creating as PARENT first, then will change to ADMIN in database');
    
    const createResponse = await fetch(`${PRODUCTION_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adminAccountData)
    });
    
    if (createResponse.ok) {
      const createData = await createResponse.json();
      console.log('   ✅ Account created successfully!');
      console.log(`   User ID: ${createData.user?.id || 'Not provided'}`);
    } else {
      const createError = await createResponse.text();
      console.log(`   ❌ Account creation failed: ${createError}`);
      
      // If account already exists, that's actually good
      if (createError.includes('already exists') || createError.includes('already registered')) {
        console.log('   ℹ️ Account already exists - continuing to test...');
      } else {
        throw new Error(`Account creation failed: ${createError}`);
      }
    }
    
    // Step 2: Test authentication as PARENT first
    console.log('\n2️⃣ Testing authentication as PARENT...');
    
    const authTestResponse = await fetch(`${PRODUCTION_URL}/api/debug/auth-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: adminAccountData.email,
        password: adminAccountData.password,
        userType: 'parent'
      })
    });
    
    if (authTestResponse.ok) {
      const authData = await authTestResponse.json();
      console.log('   Parent authentication test:');
      console.log(`     User found: ${authData.authTest?.userFound}`);
      console.log(`     Password match: ${authData.authTest?.passwordMatch}`);
      console.log(`     Account active: ${authData.authTest?.isActive}`);
      console.log(`     User type: ${authData.authTest?.userType}`);
      
      if (authData.authTest?.userFound && authData.authTest?.passwordMatch) {
        console.log('   ✅ Account exists and password works!');
      }
    }
    
    // Step 3: Create a database update script
    console.log('\n3️⃣ Creating database update script...');
    
    const dbUpdateScript = `
-- SQL to manually update user to ADMIN type
UPDATE User 
SET userType = 'ADMIN', 
    approvalStatus = 'APPROVED',
    isActive = true
WHERE email = '${adminAccountData.email}';
`;
    
    console.log('   Database update script created:');
    console.log(dbUpdateScript);
    
    // Step 4: Test admin authentication (will fail until DB is updated)
    console.log('\n4️⃣ Testing admin authentication (will likely fail until DB updated)...');
    
    const adminAuthTestResponse = await fetch(`${PRODUCTION_URL}/api/debug/auth-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: adminAccountData.email,
        password: adminAccountData.password,
        userType: 'admin'
      })
    });
    
    if (adminAuthTestResponse.ok) {
      const adminAuthData = await adminAuthTestResponse.json();
      console.log('   Admin authentication test:');
      console.log(`     User found: ${adminAuthData.authTest?.userFound}`);
      console.log(`     User type match: ${adminAuthData.authTest?.userTypeMatch}`);
      
      if (adminAuthData.authTest?.userTypeMatch) {
        console.log('   ✅ Admin authentication working!');
      } else {
        console.log('   ⚠️ User exists but type mismatch - need to update database');
      }
    }
    
    console.log('\n🎊 ADMIN ACCOUNT SETUP INSTRUCTIONS');
    console.log('===================================');
    console.log('📋 Account Details:');
    console.log(`   Email: ${adminAccountData.email}`);
    console.log(`   Password: ${adminAccountData.password}`);
    console.log(`   Status: Created as PARENT, needs DB update to ADMIN`);
    
    console.log('\n🔧 Next Steps:');
    console.log('1. Access your production database');
    console.log('2. Run this SQL command:');
    console.log(`   UPDATE "User" SET "userType" = 'ADMIN' WHERE email = '${adminAccountData.email}';`);
    console.log('3. Then test login at: https://instacares.net/login/admin');
    
    console.log('\n💡 Alternative: Use Prisma Studio to change userType from PARENT to ADMIN');
    
  } catch (error) {
    console.error('❌ Admin account setup failed:', error.message);
  }
}

createAdminAccountFixed().catch(console.error);