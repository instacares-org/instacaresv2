const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Canadian addresses with real coordinates
const CANADIAN_LOCATIONS = {
  toronto: {
    city: 'Toronto',
    state: 'ON',
    country: 'CA',
    addresses: [
      { street: '123 Queen St W', apt: 'Unit 501', postal: 'M5H 2M9', lat: 43.6532, lng: -79.3832 },
      { street: '456 Bloor St E', apt: null, postal: 'M4W 1J5', lat: 43.6708, lng: -79.3896 },
      { street: '789 College St', apt: 'Apt 302', postal: 'M6G 1C5', lat: 43.6576, lng: -79.4138 },
    ]
  },
  vancouver: {
    city: 'Vancouver',
    state: 'BC',
    country: 'CA',
    addresses: [
      { street: '321 Granville St', apt: null, postal: 'V6C 1T2', lat: 49.2827, lng: -123.1207 },
      { street: '654 Davie St', apt: 'Unit 1205', postal: 'V6B 2G1', lat: 49.2778, lng: -123.1335 },
    ]
  },
  montreal: {
    city: 'Montreal',
    state: 'QC',
    country: 'CA',
    addresses: [
      { street: '987 Rue Saint-Catherine O', apt: null, postal: 'H3B 1C4', lat: 45.5017, lng: -73.5673 },
      { street: '147 Rue Sherbrooke E', apt: 'Apt 804', postal: 'H2L 1K6', lat: 45.5155, lng: -73.5806 },
    ]
  },
  calgary: {
    city: 'Calgary',
    state: 'AB',
    country: 'CA',
    addresses: [
      { street: '258 17th Ave SW', apt: null, postal: 'T2S 0B1', lat: 51.0447, lng: -114.0719 },
    ]
  },
  ottawa: {
    city: 'Ottawa',
    state: 'ON',
    country: 'CA',
    addresses: [
      { street: '369 Rideau St', apt: 'Unit 702', postal: 'K1N 5Y7', lat: 45.4215, lng: -75.6972 },
    ]
  }
};

// Parent accounts data
const PARENT_ACCOUNTS = [
  {
    firstName: 'Emily',
    lastName: 'Thompson',
    email: 'emily.thompson@example.com',
    phone: '+1 (416) 555-0123',
    location: 'toronto',
    addressIndex: 0,
    dateOfBirth: new Date('1985-03-15'),
    emergencyName: 'Michael Thompson',
    emergencyPhone: '+1 (416) 555-0124',
    emergencyRelation: 'Spouse'
  },
  {
    firstName: 'Sarah',
    lastName: 'Martinez',
    email: 'sarah.martinez@example.com', 
    phone: '+1 (604) 555-0234',
    location: 'vancouver',
    addressIndex: 0,
    dateOfBirth: new Date('1988-07-22'),
    emergencyName: 'Carlos Martinez',
    emergencyPhone: '+1 (604) 555-0235',
    emergencyRelation: 'Husband'
  },
  {
    firstName: 'Jessica',
    lastName: 'Chen',
    email: 'jessica.chen@example.com',
    phone: '+1 (416) 555-0345',
    location: 'toronto',
    addressIndex: 1,
    dateOfBirth: new Date('1990-11-08'),
    emergencyName: 'Lisa Chen',
    emergencyPhone: '+1 (416) 555-0346',
    emergencyRelation: 'Mother'
  },
  {
    firstName: 'Marie',
    lastName: 'Dubois',
    email: 'marie.dubois@example.com',
    phone: '+1 (514) 555-0456',
    location: 'montreal',
    addressIndex: 0,
    dateOfBirth: new Date('1987-05-30'),
    emergencyName: 'Jean Dubois',
    emergencyPhone: '+1 (514) 555-0457',
    emergencyRelation: 'Spouse'
  },
  {
    firstName: 'Rachel',
    lastName: 'Wilson',
    email: 'rachel.wilson@example.com',
    phone: '+1 (403) 555-0567',
    location: 'calgary',
    addressIndex: 0,
    dateOfBirth: new Date('1984-09-12'),
    emergencyName: 'David Wilson',
    emergencyPhone: '+1 (403) 555-0568',
    emergencyRelation: 'Husband'
  }
];

// Caregiver accounts data
const CAREGIVER_ACCOUNTS = [
  {
    firstName: 'Isabella',
    lastName: 'Rodriguez',
    email: 'isabella.rodriguez@example.com',
    phone: '+1 (416) 555-0678',
    location: 'toronto',
    addressIndex: 2,
    dateOfBirth: new Date('1992-04-18'),
    hourlyRate: 28.50,
    experienceYears: 5,
    bio: 'Experienced early childhood educator with a passion for nurturing young minds. I specialize in creative play, educational activities, and providing a safe, loving environment for children. Fluent in English and Spanish.',
    languages: ['English', 'Spanish'],
    services: ['BABYSITTING', 'NANNY', 'TUTORING'],
    emergencyName: 'Carmen Rodriguez',
    emergencyPhone: '+1 (416) 555-0679',
    emergencyRelation: 'Mother'
  },
  {
    firstName: 'Aisha',
    lastName: 'Patel',
    email: 'aisha.patel@example.com',
    phone: '+1 (604) 555-0789',
    location: 'vancouver',
    addressIndex: 1,
    dateOfBirth: new Date('1994-08-25'),
    hourlyRate: 32.00,
    experienceYears: 4,
    bio: 'Certified childcare professional with First Aid and CPR training. I love engaging children in outdoor activities, arts and crafts, and helping with homework. Patient and reliable caregiver.',
    languages: ['English', 'Hindi', 'Gujarati'],
    services: ['BABYSITTING', 'NANNY', 'AFTER_SCHOOL'],
    emergencyName: 'Raj Patel',
    emergencyPhone: '+1 (604) 555-0790',
    emergencyRelation: 'Father'
  },
  {
    firstName: 'Sophie',
    lastName: 'Tremblay',
    email: 'sophie.tremblay@example.com',
    phone: '+1 (514) 555-0890',
    location: 'montreal',
    addressIndex: 1,
    dateOfBirth: new Date('1991-12-03'),
    hourlyRate: 30.00,
    experienceYears: 6,
    bio: 'Bilingual childcare provider with extensive experience working with families. I focus on creating structured, fun activities that promote learning and development. Background in child psychology.',
    languages: ['French', 'English'],
    services: ['BABYSITTING', 'NANNY', 'SPECIAL_NEEDS', 'TUTORING'],
    emergencyName: 'Marie Tremblay',
    emergencyPhone: '+1 (514) 555-0891',
    emergencyRelation: 'Sister'
  },
  {
    firstName: 'Amanda',
    lastName: 'Foster',
    email: 'amanda.foster@example.com',
    phone: '+1 (613) 555-0901',
    location: 'ottawa',
    addressIndex: 0,
    dateOfBirth: new Date('1989-06-14'),
    hourlyRate: 26.00,
    experienceYears: 7,
    bio: 'Warm and caring nanny with years of experience in childcare. I enjoy reading with children, cooking healthy meals, and organizing educational play dates. Excellent references available.',
    languages: ['English', 'French'],
    services: ['BABYSITTING', 'NANNY', 'OVERNIGHT'],
    emergencyName: 'Jennifer Foster',
    emergencyPhone: '+1 (613) 555-0902',
    emergencyRelation: 'Mother'
  },
  {
    firstName: 'Priya',
    lastName: 'Singh',
    email: 'priya.singh@example.com',
    phone: '+1 (416) 555-1012',
    location: 'toronto',
    addressIndex: 0,
    dateOfBirth: new Date('1993-10-07'),
    hourlyRate: 35.00,
    experienceYears: 3,
    bio: 'Recent Early Childhood Education graduate with fresh, innovative approaches to childcare. I love music, dance, and incorporating cultural learning into daily activities. Very patient with children.',
    languages: ['English', 'Punjabi', 'Hindi'],
    services: ['BABYSITTING', 'NANNY', 'TUTORING'],
    emergencyName: 'Deepak Singh',
    emergencyPhone: '+1 (416) 555-1013',
    emergencyRelation: 'Father'
  }
];

async function cleanupTestData() {
  console.log('🧹 Cleaning up existing test data...');
  
  // Clean up in order to respect foreign keys
  // First, clean up all child tables
  await prisma.slotBooking.deleteMany();
  await prisma.bookingReservation.deleteMany();
  await prisma.availabilitySlot.deleteMany();
  await prisma.checkInOut.deleteMany();
  await prisma.message.deleteMany();
  await prisma.chatRoom.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.review.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.caregiverService.deleteMany();
  await prisma.caregiverPhoto.deleteMany();
  await prisma.caregiverCertification.deleteMany();
  await prisma.caregiverVerification.deleteMany();
  await prisma.child.deleteMany();
  await prisma.emergencyContact.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.manualPayout.deleteMany();
  await prisma.caregiver.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.user.deleteMany();
  
  console.log('✅ Test data cleaned up');
}

async function createParentAccount(parentData) {
  const location = CANADIAN_LOCATIONS[parentData.location];
  const address = location.addresses[parentData.addressIndex];
  
  const defaultPassword = process.env.TEST_ACCOUNT_PASSWORD || 'defaultpassword';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);
  
  const user = await prisma.user.create({
    data: {
      email: parentData.email,
      passwordHash,
      userType: 'PARENT',
      approvalStatus: 'APPROVED',
      emailVerified: true,
      phoneVerified: true,
      isActive: true,
      profile: {
        create: {
          firstName: parentData.firstName,
          lastName: parentData.lastName,
          phone: parentData.phone,
          dateOfBirth: parentData.dateOfBirth,
          streetAddress: address.street,
          apartment: address.apt,
          city: location.city,
          state: location.state,
          zipCode: address.postal,
          country: location.country,
          latitude: address.lat,
          longitude: address.lng,
          emergencyName: parentData.emergencyName,
          emergencyPhone: parentData.emergencyPhone,
          emergencyRelation: parentData.emergencyRelation
        }
      }
    },
    include: {
      profile: true
    }
  });
  
  console.log(`✅ Created parent: ${parentData.firstName} ${parentData.lastName} (${parentData.email})`);
  return user;
}

async function createCaregiverAccount(caregiverData) {
  const location = CANADIAN_LOCATIONS[caregiverData.location];
  const address = location.addresses[caregiverData.addressIndex];
  
  const defaultPassword = process.env.TEST_ACCOUNT_PASSWORD || 'defaultpassword';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);
  
  const user = await prisma.user.create({
    data: {
      email: caregiverData.email,
      passwordHash,
      userType: 'CAREGIVER',
      approvalStatus: 'APPROVED',
      emailVerified: true,
      phoneVerified: true,
      isActive: true,
      profile: {
        create: {
          firstName: caregiverData.firstName,
          lastName: caregiverData.lastName,
          phone: caregiverData.phone,
          dateOfBirth: caregiverData.dateOfBirth,
          streetAddress: address.street,
          apartment: address.apt,
          city: location.city,
          state: location.state,
          zipCode: address.postal,
          country: location.country,
          latitude: address.lat,
          longitude: address.lng,
          emergencyName: caregiverData.emergencyName,
          emergencyPhone: caregiverData.emergencyPhone,
          emergencyRelation: caregiverData.emergencyRelation
        }
      },
      caregiver: {
        create: {
          hourlyRate: caregiverData.hourlyRate,
          experienceYears: caregiverData.experienceYears,
          bio: caregiverData.bio,
          languages: caregiverData.languages,
          isVerified: true,
          backgroundCheck: true,
          backgroundCheckDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
          isAvailable: true,
          averageRating: 4.5 + Math.random() * 0.5, // 4.5-5.0 rating
          totalBookings: Math.floor(Math.random() * 50) + 10, // 10-60 bookings
          services: {
            create: caregiverData.services.map(serviceType => ({
              serviceType,
              isOffered: true
            }))
          }
        }
      }
    },
    include: {
      profile: true,
      caregiver: {
        include: {
          services: true
        }
      }
    }
  });
  
  console.log(`✅ Created caregiver: ${caregiverData.firstName} ${caregiverData.lastName} (${caregiverData.email})`);
  return user;
}

async function createRealAccounts() {
  try {
    console.log('🚀 Starting creation of real Canadian accounts...');
    
    // Clean up existing data
    await cleanupTestData();
    
    // Create parent accounts
    console.log('\n👨‍👩‍👧‍👦 Creating parent accounts...');
    const parents = [];
    for (const parentData of PARENT_ACCOUNTS) {
      const parent = await createParentAccount(parentData);
      parents.push(parent);
    }
    
    // Create caregiver accounts
    console.log('\n👩‍🍼 Creating caregiver accounts...');
    const caregivers = [];
    for (const caregiverData of CAREGIVER_ACCOUNTS) {
      const caregiver = await createCaregiverAccount(caregiverData);
      caregivers.push(caregiver);
    }
    
    console.log('\n🎉 Account creation completed!');
    console.log('\n📋 ACCOUNT CREDENTIALS:');
    console.log('=======================');
    
    const testPassword = process.env.TEST_ACCOUNT_PASSWORD || 'defaultpassword';
    
    console.log('\n👨‍👩‍👧‍👦 PARENT ACCOUNTS:');
    parents.forEach(parent => {
      console.log(`📧 ${parent.email} | Password: ${testPassword} | ${parent.profile.firstName} ${parent.profile.lastName}`);
    });
    
    console.log('\n👩‍🍼 CAREGIVER ACCOUNTS:');
    caregivers.forEach(caregiver => {
      console.log(`📧 ${caregiver.email} | Password: ${testPassword} | ${caregiver.profile.firstName} ${caregiver.profile.lastName}`);
    });
    
    console.log('\n🔑 TEST CREDENTIALS:');
    console.log(`Parent Login: emily.thompson@example.com | ${testPassword}`);
    console.log(`Caregiver Login: isabella.rodriguez@example.com | ${testPassword}`);
    
    // Verify counts
    const userCount = await prisma.user.count();
    const parentCount = await prisma.user.count({ where: { userType: 'PARENT' } });
    const caregiverCount = await prisma.user.count({ where: { userType: 'CAREGIVER' } });
    const serviceCount = await prisma.caregiverService.count();
    
    console.log('\n📊 SUMMARY:');
    console.log(`Total users: ${userCount}`);
    console.log(`Parents: ${parentCount}`);
    console.log(`Caregivers: ${caregiverCount}`);
    console.log(`Services: ${serviceCount}`);
    
  } catch (error) {
    console.error('❌ Error creating accounts:', error);
    throw error;
  }
}

async function main() {
  await createRealAccounts();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });