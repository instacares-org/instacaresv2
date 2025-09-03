const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function resetAdminPassword() {
  try {
    console.log('🔧 Resetting admin password...');
    
    // Hash the new password
    const newPassword = 'admin123';
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    // Check if admin exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@instacares.com' }
    });
    
    if (existingAdmin) {
      // Update existing admin password
      const updatedAdmin = await prisma.user.update({
        where: { email: 'admin@instacares.com' },
        data: {
          passwordHash: passwordHash,
          isActive: true,
          approvalStatus: 'APPROVED'
        },
        include: {
          profile: true
        }
      });
      
      console.log('✅ Admin password updated successfully!');
      console.log('📧 Email: admin@instacares.com');
      console.log('🔑 Password: admin123');
      console.log('👤 User ID:', updatedAdmin.id);
      console.log('🏷️ User Type:', updatedAdmin.userType);
      console.log('✓ Active:', updatedAdmin.isActive);
      console.log('✓ Approval Status:', updatedAdmin.approvalStatus);
    } else {
      // Create new admin user
      console.log('⚠️ Admin user not found. Creating new admin...');
      
      const newAdmin = await prisma.user.create({
        data: {
          email: 'admin@instacares.com',
          passwordHash: passwordHash,
          userType: 'ADMIN',
          isActive: true,
          approvalStatus: 'APPROVED',
          profile: {
            create: {
              firstName: 'Admin',
              lastName: 'User',
              dateOfBirth: new Date('1990-01-01'),
              phone: '+1234567890',
              streetAddress: '123 Admin St',
              city: 'Admin City',
              state: 'AC',
              zipCode: '12345',
              country: 'Canada'
            }
          }
        },
        include: {
          profile: true
        }
      });
      
      console.log('✅ Admin user created successfully!');
      console.log('📧 Email: admin@instacares.com');
      console.log('🔑 Password: admin123');
      console.log('👤 User ID:', newAdmin.id);
      console.log('🏷️ User Type:', newAdmin.userType);
    }
    
    console.log('\n🎉 You can now login at: http://localhost:3000/login/admin');
    
  } catch (error) {
    console.error('❌ Error resetting admin password:', error);
    if (error.code === 'P2002') {
      console.error('⚠️ Admin email already exists with different configuration');
    }
  } finally {
    await prisma.$disconnect();
  }
}

resetAdminPassword();