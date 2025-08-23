import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@instacares.com' },
    update: {},
    create: {
      email: 'admin@instacares.com',
      passwordHash: adminPasswordHash,
      userType: 'ADMIN',
      approvalStatus: 'APPROVED',
      emailVerified: true,
      profile: {
        create: {
          firstName: 'Admin',
          lastName: 'User',
          phone: '(555) 123-4567',
          streetAddress: '123 Admin St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          latitude: 40.7128,
          longitude: -74.0060,
        },
      },
    },
  });

  // Create parent users
  const parent1PasswordHash = await bcrypt.hash('parent123', 10);
  const parent1 = await prisma.user.upsert({
    where: { email: 'sarah.williams@example.com' },
    update: {},
    create: {
      email: 'sarah.williams@example.com',
      passwordHash: parent1PasswordHash,
      userType: 'PARENT',
      approvalStatus: 'APPROVED',
      emailVerified: true,
      profile: {
        create: {
          firstName: 'Sarah',
          lastName: 'Williams',
          phone: '(555) 234-5678',
          streetAddress: '456 Parent Ave',
          city: 'New York',
          state: 'NY',
          zipCode: '10002',
          latitude: 40.7589,
          longitude: -73.9851,
        },
      },
    },
  });

  const parent2PasswordHash = await bcrypt.hash('parent123', 10);
  const parent2 = await prisma.user.upsert({
    where: { email: 'michael.johnson@example.com' },
    update: {},
    create: {
      email: 'michael.johnson@example.com',
      passwordHash: parent2PasswordHash,
      userType: 'PARENT',
      approvalStatus: 'APPROVED',
      emailVerified: true,
      profile: {
        create: {
          firstName: 'Michael',
          lastName: 'Johnson',
          phone: '(555) 345-6789',
          streetAddress: '789 Family Rd',
          city: 'Brooklyn',
          state: 'NY',
          zipCode: '11201',
          latitude: 40.6892,
          longitude: -73.9442,
        },
      },
    },
  });

  // Create caregiver users
  const caregiver1PasswordHash = await bcrypt.hash('caregiver123', 10);
  const caregiver1User = await prisma.user.upsert({
    where: { email: 'emily.davis@example.com' },
    update: {},
    create: {
      email: 'emily.davis@example.com',
      passwordHash: caregiver1PasswordHash,
      userType: 'CAREGIVER',
      approvalStatus: 'APPROVED',
      emailVerified: true,
      profile: {
        create: {
          firstName: 'Emily',
          lastName: 'Davis',
          phone: '(555) 456-7890',
          streetAddress: '321 Caregiver St',
          city: 'Manhattan',
          state: 'NY',
          zipCode: '10003',
          latitude: 40.7505,
          longitude: -73.9934,
        },
      },
    },
  });

  const caregiver2PasswordHash = await bcrypt.hash('caregiver123', 10);
  const caregiver2User = await prisma.user.upsert({
    where: { email: 'jennifer.chen@example.com' },
    update: {},
    create: {
      email: 'jennifer.chen@example.com',
      passwordHash: caregiver2PasswordHash,
      userType: 'CAREGIVER',
      approvalStatus: 'APPROVED',
      emailVerified: true,
      profile: {
        create: {
          firstName: 'Jennifer',
          lastName: 'Chen',
          phone: '(555) 567-8901',
          streetAddress: '654 Care Ave',
          city: 'Queens',
          state: 'NY',
          zipCode: '11101',
          latitude: 40.7282,
          longitude: -73.7949,
        },
      },
    },
  });

  const caregiver3PasswordHash = await bcrypt.hash('caregiver123', 10);
  const caregiver3User = await prisma.user.upsert({
    where: { email: 'sarah.johnson@example.com' },
    update: {},
    create: {
      email: 'sarah.johnson@example.com',
      passwordHash: caregiver3PasswordHash,
      userType: 'CAREGIVER',
      approvalStatus: 'APPROVED',
      emailVerified: true,
      profile: {
        create: {
          firstName: 'Sarah',
          lastName: 'Johnson',
          phone: '(555) 678-9012',
          streetAddress: '987 Childcare Blvd',
          city: 'Bronx',
          state: 'NY',
          zipCode: '10451',
          latitude: 40.8176,
          longitude: -73.9182,
        },
      },
    },
  });

  // Add Fazila Noorzad - Toronto caregiver with precise geocoding
  const caregiver4PasswordHash = await bcrypt.hash('caregiver123', 10);
  const caregiver4User = await prisma.user.upsert({
    where: { email: 'fazila.noorzad@example.com' },
    update: {},
    create: {
      email: 'fazila.noorzad@example.com',
      passwordHash: caregiver4PasswordHash,
      userType: 'CAREGIVER',
      approvalStatus: 'APPROVED',
      emailVerified: true,
      profile: {
        create: {
          firstName: 'Fazila',
          lastName: 'Noorzad',
          phone: '(416) 555-0123',
          streetAddress: '234 Sherway Gardens',
          city: 'Etobicoke',
          state: 'Ontario',
          zipCode: 'M9C 1A8',
          latitude: 43.6150655, // Precise coordinates from geocoding
          longitude: -79.55241,
        },
      },
    },
  });

  // Create caregiver profiles
  const caregiver1 = await prisma.caregiver.upsert({
    where: { userId: caregiver1User.id },
    update: {},
    create: {
      userId: caregiver1User.id,
      hourlyRate: 25.00,
      experienceYears: 5,
      bio: 'Experienced childcare provider with a passion for nurturing young minds. I specialize in educational activities and have worked with children of all ages.',
      languages: ['English', 'Spanish'],
      maxChildren: 3,
      minAge: 6, // 6 months
      maxAge: 144, // 12 years
      isVerified: true,
      backgroundCheck: true,
      backgroundCheckDate: new Date('2024-01-15'),
      stripeAccountId: 'acct_demo_emily',
      stripeOnboarded: false,
      canReceivePayments: false,
      totalBookings: 15,
      averageRating: 4.8,
      totalEarnings: 375000, // $3,750 in cents
      isAvailable: true,
    },
  });

  const caregiver2 = await prisma.caregiver.upsert({
    where: { userId: caregiver2User.id },
    update: {},
    create: {
      userId: caregiver2User.id,
      hourlyRate: 30.00,
      experienceYears: 8,
      bio: 'Certified nanny with extensive experience in infant care and early childhood development. CPR and First Aid certified.',
      languages: ['English', 'Mandarin'],
      maxChildren: 2,
      minAge: 0, // newborn
      maxAge: 60, // 5 years
      isVerified: true,
      backgroundCheck: true,
      backgroundCheckDate: new Date('2023-12-01'),
      stripeAccountId: 'acct_demo_jennifer',
      stripeOnboarded: false,
      canReceivePayments: false,
      totalBookings: 22,
      averageRating: 4.9,
      totalEarnings: 528000, // $5,280 in cents
      isAvailable: true,
    },
  });

  const caregiver3 = await prisma.caregiver.upsert({
    where: { userId: caregiver3User.id },
    update: {},
    create: {
      userId: caregiver3User.id,
      hourlyRate: 22.00,
      experienceYears: 3,
      bio: 'Creative and energetic caregiver who loves outdoor activities and arts & crafts. Great with school-aged children.',
      languages: ['English'],
      maxChildren: 4,
      minAge: 24, // 2 years
      maxAge: 144, // 12 years
      isVerified: true,
      backgroundCheck: true,
      backgroundCheckDate: new Date('2024-02-01'),
      stripeAccountId: 'acct_demo_sarah',
      stripeOnboarded: false,
      canReceivePayments: false,
      totalBookings: 8,
      averageRating: 4.7,
      totalEarnings: 176000, // $1,760 in cents
      isAvailable: true,
    },
  });

  const caregiver4 = await prisma.caregiver.upsert({
    where: { userId: caregiver4User.id },
    update: {},
    create: {
      userId: caregiver4User.id,
      hourlyRate: 28.00,
      experienceYears: 6,
      bio: 'Experienced and caring childcare provider serving the Etobicoke area. Specializes in infant and toddler care with a warm, nurturing approach.',
      languages: ['English', 'Urdu'],
      maxChildren: 3,
      minAge: 0, // newborn
      maxAge: 72, // 6 years
      isVerified: true,
      backgroundCheck: true,
      backgroundCheckDate: new Date('2024-01-01'),
      stripeAccountId: 'acct_demo_fazila',
      stripeOnboarded: false,
      canReceivePayments: false,
      totalBookings: 12,
      averageRating: 4.8,
      totalEarnings: 336000, // $3,360 in cents
      isAvailable: true,
    },
  });

  // Create services for caregivers using upsert to avoid constraint issues
  const services = [
    // Emily's services
    { caregiverId: caregiver1.id, serviceType: 'BABYSITTING', rate: 25.00, description: 'Evening and weekend babysitting' },
    { caregiverId: caregiver1.id, serviceType: 'TUTORING', rate: 30.00, description: 'Elementary school homework help' },
    { caregiverId: caregiver1.id, serviceType: 'AFTER_SCHOOL', rate: 28.00, description: 'After-school care and activities' },
    
    // Jennifer's services
    { caregiverId: caregiver2.id, serviceType: 'NANNY', rate: 30.00, description: 'Full-time nanny services' },
    { caregiverId: caregiver2.id, serviceType: 'BABYSITTING', rate: 28.00, description: 'Professional babysitting' },
    { caregiverId: caregiver2.id, serviceType: 'OVERNIGHT', rate: 35.00, description: 'Overnight care for infants and toddlers' },
    
    // Sarah's services
    { caregiverId: caregiver3.id, serviceType: 'BABYSITTING', rate: 22.00, description: 'Fun and engaging babysitting' },
    { caregiverId: caregiver3.id, serviceType: 'AFTER_SCHOOL', rate: 25.00, description: 'After-school supervision and activities' },
    
    // Fazila's services
    { caregiverId: caregiver4.id, serviceType: 'BABYSITTING', rate: 28.00, description: 'Professional babysitting in Etobicoke area' },
    { caregiverId: caregiver4.id, serviceType: 'NANNY', rate: 30.00, description: 'Full-time nanny services for infants and toddlers' },
    { caregiverId: caregiver4.id, serviceType: 'OVERNIGHT', rate: 35.00, description: 'Overnight care for babies and young children' },
  ];

  for (const service of services) {
    await prisma.caregiverService.upsert({
      where: {
        caregiverId_serviceType: {
          caregiverId: service.caregiverId,
          serviceType: service.serviceType as any,
        },
      },
      update: service,
      create: service,
    });
  }

  // Create certifications
  await prisma.caregiverCertification.createMany({
    data: [
      // Emily's certifications
      { 
        caregiverId: caregiver1.id, 
        type: 'CPR', 
        title: 'CPR Certification', 
        issuingBody: 'American Red Cross',
        issueDate: new Date('2023-06-15'),
        expirationDate: new Date('2025-06-15'),
        isVerified: true,
      },
      { 
        caregiverId: caregiver1.id, 
        type: 'FIRST_AID', 
        title: 'First Aid Certification', 
        issuingBody: 'American Red Cross',
        issueDate: new Date('2023-06-15'),
        expirationDate: new Date('2025-06-15'),
        isVerified: true,
      },
      
      // Jennifer's certifications
      { 
        caregiverId: caregiver2.id, 
        type: 'CPR', 
        title: 'Infant CPR Certification', 
        issuingBody: 'American Heart Association',
        issueDate: new Date('2023-05-01'),
        expirationDate: new Date('2025-05-01'),
        isVerified: true,
      },
      { 
        caregiverId: caregiver2.id, 
        type: 'CHILDCARE_LICENSE', 
        title: 'Childcare Provider License', 
        issuingBody: 'NY State Department of Health',
        issueDate: new Date('2022-01-01'),
        expirationDate: new Date('2025-01-01'),
        isVerified: true,
      },
      { 
        caregiverId: caregiver2.id, 
        type: 'EDUCATION', 
        title: 'Early Childhood Development Certificate', 
        issuingBody: 'NYU School of Professional Studies',
        issueDate: new Date('2020-05-15'),
        isVerified: true,
      },
      
      // Sarah's certifications
      { 
        caregiverId: caregiver3.id, 
        type: 'FIRST_AID', 
        title: 'Pediatric First Aid', 
        issuingBody: 'American Red Cross',
        issueDate: new Date('2023-08-01'),
        expirationDate: new Date('2025-08-01'),
        isVerified: true,
      },
      
      // Fazila's certifications
      { 
        caregiverId: caregiver4.id, 
        type: 'CPR', 
        title: 'Infant and Child CPR Certification', 
        issuingBody: 'Canadian Red Cross',
        issueDate: new Date('2023-09-01'),
        expirationDate: new Date('2025-09-01'),
        isVerified: true,
      },
      { 
        caregiverId: caregiver4.id, 
        type: 'FIRST_AID', 
        title: 'Standard First Aid', 
        issuingBody: 'Canadian Red Cross',
        issueDate: new Date('2023-09-01'),
        expirationDate: new Date('2025-09-01'),
        isVerified: true,
      },
    ],
  });

  // Create some bookings
  const booking1 = await prisma.booking.create({
    data: {
      parentId: parent1.id,
      caregiverId: caregiver1User.id,
      startTime: new Date('2024-02-08T09:00:00'),
      endTime: new Date('2024-02-08T17:00:00'),
      childrenCount: 2,
      specialRequests: 'Please help with homework and prepare light snacks.',
      address: '456 Parent Ave, New York, NY 10002',
      latitude: 40.7589,
      longitude: -73.9851,
      hourlyRate: 25.00,
      totalHours: 8,
      subtotal: 20000, // $200 in cents
      platformFee: 3000, // $30 in cents (15%)
      totalAmount: 20000,
      status: 'COMPLETED',
      confirmedAt: new Date('2024-02-06T10:00:00'),
      completedAt: new Date('2024-02-08T17:30:00'),
    },
  });

  const booking2 = await prisma.booking.create({
    data: {
      parentId: parent2.id,
      caregiverId: caregiver2User.id,
      startTime: new Date('2024-02-09T10:00:00'),
      endTime: new Date('2024-02-09T15:00:00'),
      childrenCount: 1,
      specialRequests: 'Baby needs feeding every 2 hours.',
      address: '789 Family Rd, Brooklyn, NY 11201',
      latitude: 40.6892,
      longitude: -73.9442,
      hourlyRate: 30.00,
      totalHours: 5,
      subtotal: 15000, // $150 in cents
      platformFee: 2250, // $22.50 in cents (15%)
      totalAmount: 15000,
      status: 'PENDING',
    },
  });

  // Create payments
  await prisma.payment.create({
    data: {
      bookingId: booking1.id,
      stripePaymentIntentId: 'pi_demo_1234567890',
      amount: 20000,
      platformFee: 3000,
      caregiverPayout: 17000,
      status: 'PAID',
      paidAt: new Date('2024-02-06T10:05:00'),
    },
  });

  await prisma.payment.create({
    data: {
      bookingId: booking2.id,
      stripePaymentIntentId: 'pi_demo_0987654321',
      amount: 15000,
      platformFee: 2250,
      caregiverPayout: 12750,
      status: 'PAID',
      paidAt: new Date('2024-02-07T14:30:00'),
    },
  });

  // Create reviews
  await prisma.review.create({
    data: {
      bookingId: booking1.id,
      reviewerId: parent1.id,
      revieweeId: caregiver1User.id,
      rating: 5,
      comment: 'Emily was fantastic! She was punctual, professional, and the kids loved her. She helped with homework and kept them engaged with fun activities.',
      isApproved: true,
      moderatedAt: new Date('2024-02-09T10:00:00'),
    },
  });

  // Create system settings
  await prisma.setting.createMany({
    data: [
      {
        key: 'platform_commission_rate',
        value: '0.15',
        description: 'Platform commission rate (15%)',
      },
      {
        key: 'minimum_hourly_rate',
        value: '15.00',
        description: 'Minimum hourly rate for caregivers',
      },
      {
        key: 'maximum_hourly_rate',
        value: '100.00',
        description: 'Maximum hourly rate for caregivers',
      },
      {
        key: 'booking_cancellation_window',
        value: '24',
        description: 'Hours before booking start time that cancellation is allowed',
      },
    ],
  });

  console.log('✅ Database seeded successfully!');
  console.log(`📧 Admin login: admin@instacares.com / admin123`);
  console.log(`👨‍👩‍👧‍👦 Parent login: sarah.williams@example.com / parent123`);
  console.log(`👶 Caregiver login: emily.davis@example.com / caregiver123`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });