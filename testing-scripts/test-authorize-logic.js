const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "sqlite:./prisma/dev.db"
    }
  }
});

// Rate limiting for credentials login (copied from options.ts)
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

const checkRateLimit = (email) => {
  const now = Date.now();
  const attempts = loginAttempts.get(email) || { count: 0, lastAttempt: 0 };
  
  if (now - attempts.lastAttempt > LOCKOUT_DURATION) {
    attempts.count = 0;
  }
  
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    return { allowed: false };
  }
  
  return { allowed: true };
};

const recordFailedAttempt = (email) => {
  const now = Date.now();
  const attempts = loginAttempts.get(email) || { count: 0, lastAttempt: 0 };
  attempts.count += 1;
  attempts.lastAttempt = now;
  loginAttempts.set(email, attempts);
};

const resetFailedAttempts = (email) => {
  loginAttempts.delete(email);
};

async function testAuthorizeLogic() {
  console.log('🔧 TESTING AUTHORIZE FUNCTION LOGIC DIRECTLY');
  console.log('============================================\n');

  // Test with the same credentials that work in debug mode
  const testCredentials = [
    {
      email: 'sarah.johnson@testmail.ca',
      password: 'TestCaregiver123!',
      userType: 'caregiver'
    },
    {
      email: 'michael.chen@testmail.ca', 
      password: 'TestParent123!',
      userType: 'parent'
    }
  ];

  try {
    await prisma.$connect();
    console.log('✅ Database connected');

    for (const credentials of testCredentials) {
      console.log(`\n🔍 Testing ${credentials.userType} login for ${credentials.email}`);
      
      // Replicate the exact authorize logic
      if (!credentials?.email || !credentials?.password) {
        console.log('❌ Missing credentials');
        continue;
      }

      try {
        const email = credentials.email.toLowerCase();
        console.log(`   Processing email: ${email}`);
        
        // Rate limiting check
        const rateLimitResult = checkRateLimit(email);
        if (!rateLimitResult.allowed) {
          console.log('❌ Rate limit exceeded');
          continue;
        }
        console.log('   ✅ Rate limit check passed');

        // Find user with profile data (exact same query as in NextAuth)
        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            profile: true,
            caregiver: true
          }
        });

        if (!user) {
          console.log('❌ User not found');
          recordFailedAttempt(email);
          continue;
        }
        console.log('   ✅ User found:', {
          id: user.id,
          email: user.email,
          userType: user.userType,
          isActive: user.isActive,
          approvalStatus: user.approvalStatus
        });

        // Check if user type matches (if specified)
        if (credentials.userType) {
          const expectedUserType = credentials.userType === 'parent' ? 'PARENT' : 
                                 credentials.userType === 'caregiver' ? 'CAREGIVER' : 
                                 credentials.userType === 'admin' ? 'ADMIN' : null;
          
          console.log(`   Expected user type: ${expectedUserType}, Actual: ${user.userType}`);
          
          if (expectedUserType && user.userType !== expectedUserType) {
            console.log('❌ User type mismatch');
            recordFailedAttempt(email);
            continue;
          }
        }
        console.log('   ✅ User type check passed');

        // Verify password
        if (!user.passwordHash || typeof user.passwordHash !== 'string') {
          console.log('❌ No password hash or invalid password hash type');
          console.log(`   Password hash exists: ${!!user.passwordHash}`);
          console.log(`   Password hash type: ${typeof user.passwordHash}`);
          recordFailedAttempt(email);
          continue;
        }
        console.log('   ✅ Password hash exists and is string');

        const isValidPassword = await bcrypt.compare(credentials.password, user.passwordHash);
        console.log(`   Password validation result: ${isValidPassword}`);
        
        if (!isValidPassword) {
          console.log('❌ Password validation failed');
          recordFailedAttempt(email);
          continue;
        }
        console.log('   ✅ Password validation passed');

        // Check account status
        if (!user.isActive) {
          console.log('❌ Account is not active');
          continue;
        }
        console.log('   ✅ Account is active');

        if (user.approvalStatus === 'PENDING') {
          console.log('❌ Account pending approval');
          continue;
        }

        if (user.approvalStatus === 'REJECTED') {
          console.log('❌ Account rejected');
          continue;
        }

        if (user.approvalStatus === 'SUSPENDED') {
          console.log('❌ Account suspended');
          continue;
        }
        console.log('   ✅ Approval status is valid');

        // Reset failed attempts on successful login
        resetFailedAttempts(email);
        console.log('   ✅ Failed attempts reset');

        // This is where we would return the user object
        const userObject = {
          id: user.id,
          email: user.email,
          name: user.profile?.firstName && user.profile?.lastName 
            ? `${user.profile.firstName} ${user.profile.lastName}` 
            : user.name || 'User',
          image: user.profile?.avatar || user.image,
          userType: user.userType,
          approvalStatus: user.approvalStatus,
          isActive: user.isActive,
          profile: user.profile,
          caregiver: user.caregiver
        };

        console.log('   ✅ SUCCESS! Would return user object:');
        console.log('   ', JSON.stringify(userObject, null, 4));

      } catch (error) {
        console.log('❌ Error in authorize logic:', error.message);
        console.log('   Full error:', error);
        
        const email = credentials?.email?.toLowerCase();
        if (email) {
          recordFailedAttempt(email);
        }
      }
    }

    console.log('\n✅ Authorize logic testing complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testAuthorizeLogic().catch(console.error);