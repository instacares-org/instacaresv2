const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPhotos() {
  try {
    console.log('📸 Checking caregiver photos in database...\n');
    
    // Get all caregiver photos
    const photos = await prisma.caregiverPhoto.findMany({
      include: {
        caregiver: {
          include: {
            user: {
              include: {
                profile: true
              }
            }
          }
        }
      }
    });
    
    console.log(`Total photos in database: ${photos.length}`);
    
    if (photos.length > 0) {
      console.log('\n📷 Photo Details:');
      photos.forEach(photo => {
        const caregiverName = photo.caregiver?.user?.profile 
          ? `${photo.caregiver.user.profile.firstName} ${photo.caregiver.user.profile.lastName}`
          : 'Unknown';
        console.log(`\n  Caregiver: ${caregiverName}`);
        console.log(`  Photo ID: ${photo.id}`);
        console.log(`  URL: ${photo.url}`);
        console.log(`  Caption: ${photo.caption || 'No caption'}`);
        console.log(`  Is Profile: ${photo.isProfile}`);
        console.log(`  Sort Order: ${photo.sortOrder}`);
      });
    } else {
      console.log('\n⚠️ No photos found in database');
      console.log('Creating sample photos for testing...\n');
      
      // Get all verified caregivers
      const caregivers = await prisma.caregiver.findMany({
        where: {
          isVerified: true
        },
        include: {
          user: {
            include: {
              profile: true
            }
          }
        }
      });
      
      // Create sample photos for each caregiver
      for (const caregiver of caregivers) {
        const name = caregiver.user?.profile 
          ? `${caregiver.user.profile.firstName} ${caregiver.user.profile.lastName}`
          : 'Caregiver';
          
        console.log(`Creating photos for ${name}...`);
        
        // Create 3 sample photos for each caregiver
        const samplePhotos = [
          {
            caregiverId: caregiver.id,
            url: '/uploads/daycare-photos/sample-playroom.jpg',
            caption: 'Our bright and cheerful playroom',
            isProfile: true,
            sortOrder: 1
          },
          {
            caregiverId: caregiver.id,
            url: '/uploads/daycare-photos/sample-outdoor.jpg',
            caption: 'Safe outdoor play area',
            isProfile: false,
            sortOrder: 2
          },
          {
            caregiverId: caregiver.id,
            url: '/uploads/daycare-photos/sample-learning.jpg',
            caption: 'Learning activities corner',
            isProfile: false,
            sortOrder: 3
          }
        ];
        
        for (const photoData of samplePhotos) {
          await prisma.caregiverPhoto.create({
            data: photoData
          });
        }
        
        console.log(`  ✅ Created 3 photos for ${name}`);
      }
      
      console.log('\n✨ Sample photos created successfully!');
    }
    
    // Check specific caregiver (Isabella)
    const isabella = await prisma.user.findFirst({
      where: {
        email: 'isabella.rodriguez@example.com'
      },
      include: {
        caregiver: {
          include: {
            photos: true
          }
        }
      }
    });
    
    if (isabella?.caregiver) {
      console.log('\n📸 Isabella Rodriguez Photos:');
      console.log(`  Total photos: ${isabella.caregiver.photos?.length || 0}`);
      if (isabella.caregiver.photos?.length > 0) {
        isabella.caregiver.photos.forEach(photo => {
          console.log(`  - ${photo.caption || 'No caption'} (${photo.url})`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPhotos();