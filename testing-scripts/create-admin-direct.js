const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "sqlite:./prisma/dev.db"
    }
  }
});

async function createAdminDirectly() {
  console.log('👑 CREATING ADMIN ACCOUNT DIRECTLY IN DATABASE');
  console.log('==============================================\n');
  
  try {
    await prisma.$connect();
    console.log('✅ Database connected');
    
    const adminData = {
      email: 'admin@instacares.net',
      password: 'AdminInstaCares2024!',
      firstName: 'Admin',
      lastName: 'User',
      phone: '+1-416-555-0000'
    };
    
    console.log(`Creating admin account: ${adminData.email}`);
    
    // Step 1: Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminData.email }
    });
    
    if (existingAdmin) {
      console.log('   ℹ️ Admin account already exists');
      console.log(`   Existing admin ID: ${existingAdmin.id}`);
      console.log(`   Current user type: ${existingAdmin.userType}`);
      
      // If it exists but is not ADMIN type, update it
      if (existingAdmin.userType !== 'ADMIN') {
        console.log('   🔄 Updating existing account to ADMIN type...');
        
        const updatedAdmin = await prisma.user.update({
          where: { id: existingAdmin.id },
          data: {
            userType: 'ADMIN',
            approvalStatus: 'APPROVED',
            isActive: true
          }
        });
        
        console.log('   ✅ Account updated to ADMIN type');
        console.log(`   New user type: ${updatedAdmin.userType}`);
      } else {
        console.log('   ✅ Account is already ADMIN type');
      }
    } else {
      console.log('   Creating new admin account...');
      
      // Hash the password
      const passwordHash = await bcrypt.hash(adminData.password, 12);
      console.log('   ✅ Password hashed');
      
      // Create admin user with profile
      const newAdmin = await prisma.user.create({
        data: {
          email: adminData.email,
          passwordHash: passwordHash,
          userType: 'ADMIN',
          approvalStatus: 'APPROVED',
          isActive: true,
          emailVerified: new Date(),
          profile: {
            create: {
              firstName: adminData.firstName,
              lastName: adminData.lastName,
              phone: adminData.phone,
              city: 'Toronto',
              state: 'ON',
              zipCode: 'M5H 2M9',
              country: 'Canada'
            }
          }
        },
        include: {
          profile: true
        }
      });
      
      console.log('   ✅ Admin account created successfully!');
      console.log(`   Admin ID: ${newAdmin.id}`);
      console.log(`   User type: ${newAdmin.userType}`);
      console.log(`   Approval status: ${newAdmin.approvalStatus}`);
    }
    
    // Step 2: Test authentication
    console.log('\n🧪 Testing admin authentication...');
    
    const adminUser = await prisma.user.findUnique({
      where: { email: adminData.email },
      include: {
        profile: true
      }
    });
    
    if (adminUser) {
      console.log('   ✅ Admin user found in database');
      console.log(`   Email: ${adminUser.email}`);
      console.log(`   User type: ${adminUser.userType}`);
      console.log(`   Is active: ${adminUser.isActive}`);
      console.log(`   Approval status: ${adminUser.approvalStatus}`);
      
      // Test password
      const passwordMatch = await bcrypt.compare(adminData.password, adminUser.passwordHash);
      console.log(`   Password match: ${passwordMatch}`);
      
      if (passwordMatch && adminUser.userType === 'ADMIN' && adminUser.isActive) {
        console.log('   ✅ All authentication checks passed!');
      }
    }
    
    console.log('\n🎊 ADMIN ACCOUNT SETUP COMPLETE!');
    console.log('=================================');
    console.log('📋 Admin Login Details:');
    console.log(`   Email: ${adminData.email}`);
    console.log(`   Password: ${adminData.password}`);
    console.log('   Login URL: https://instacares.net/login/admin');
    console.log('   User Type: ADMIN');
    console.log('   Status: APPROVED & ACTIVE');
    
    console.log('\n💡 You can now login with these credentials!');
    
  } catch (error) {
    console.error('❌ Admin creation failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminDirectly().catch(console.error);