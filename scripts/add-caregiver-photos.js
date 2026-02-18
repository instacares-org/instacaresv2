const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Stock photo URLs from Unsplash (professional headshots)
const PROFILE_PHOTOS = [
  'https://images.unsplash.com/photo-1494790108755-2616b169ad2c?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1554151228-14d9def656e4?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1567532900872-f4e906cbf06a?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&crop=face'
];

async function addProfilePhotos() {
  try {
    console.log('📸 Adding profile photos to caregivers...\n');
    
    const caregivers = await prisma.caregiver.findMany({
      include: {
        user: {
          include: {
            profile: true
          }
        }
      }
    });
    
    for (let i = 0; i < caregivers.length; i++) {
      const caregiver = caregivers[i];
      const photoUrl = PROFILE_PHOTOS[i];
      
      // Add profile photo
      await prisma.caregiverPhoto.create({
        data: {
          caregiverId: caregiver.id,
          url: photoUrl,
          isProfile: true,
          caption: 'Profile photo',
          sortOrder: 0
        }
      });
      
      console.log(`✅ Added photo for ${caregiver.user.profile.firstName} ${caregiver.user.profile.lastName}`);
    }
    
    console.log('\n📸 Profile photos added successfully!');
    
  } catch (error) {
    console.error('❌ Error adding photos:', error);
  }
}

async function main() {
  await addProfilePhotos();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });