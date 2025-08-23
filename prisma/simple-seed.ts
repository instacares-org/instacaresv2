import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting simple database seed...');

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@instacares.com' },
    update: {},
    create: {
      email: 'admin@instacares.com',
      passwordHash: adminPasswordHash,
      userType: 'ADMIN',
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

  // Create caregiver users
  const caregiver1PasswordHash = await bcrypt.hash('caregiver123', 10);
  const caregiver1User = await prisma.user.upsert({
    where: { email: 'emily.davis@example.com' },
    update: {},
    create: {
      email: 'emily.davis@example.com',
      passwordHash: caregiver1PasswordHash,
      userType: 'CAREGIVER',
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

  const caregiver2User = await prisma.user.upsert({
    where: { email: 'jennifer.chen@example.com' },
    update: {},
    create: {
      email: 'jennifer.chen@example.com',
      passwordHash: caregiver1PasswordHash,
      userType: 'CAREGIVER',
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

  // Create caregiver profiles
  const caregiver1 = await prisma.caregiver.upsert({
    where: { userId: caregiver1User.id },
    update: {},
    create: {
      userId: caregiver1User.id,
      hourlyRate: 25.00,
      experienceYears: 5,
      bio: 'Experienced childcare provider with a passion for nurturing young minds.',
      languages: ['English', 'Spanish'],
      maxChildren: 3,
      minAge: 6,
      maxAge: 144,
      isVerified: true,
      backgroundCheck: true,
      backgroundCheckDate: new Date('2024-01-15'),
      totalBookings: 15,
      averageRating: 4.8,
      totalEarnings: 375000,
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
      bio: 'Certified nanny with extensive experience in infant care.',
      languages: ['English', 'Mandarin'],
      maxChildren: 2,
      minAge: 0,
      maxAge: 60,
      isVerified: true,
      backgroundCheck: true,
      backgroundCheckDate: new Date('2023-12-01'),
      totalBookings: 22,
      averageRating: 4.9,
      totalEarnings: 528000,
      isAvailable: true,
    },
  });

  // Create some bookings for chat testing
  const booking1 = await prisma.booking.create({
    data: {
      parentId: parent1.id,
      caregiverId: caregiver1User.id,
      startTime: new Date('2024-02-10T09:00:00'),
      endTime: new Date('2024-02-10T17:00:00'),
      childrenCount: 2,
      specialRequests: 'Please help with homework and prepare snacks.',
      address: '456 Parent Ave, New York, NY 10002',
      latitude: 40.7589,
      longitude: -73.9851,
      hourlyRate: 25.00,
      totalHours: 8,
      subtotal: 20000,
      platformFee: 3000,
      totalAmount: 20000,
      status: 'CONFIRMED',
      confirmedAt: new Date('2024-02-08T10:00:00'),
    },
  });

  const booking2 = await prisma.booking.create({
    data: {
      parentId: parent1.id,
      caregiverId: caregiver2User.id,
      startTime: new Date('2024-02-12T10:00:00'),
      endTime: new Date('2024-02-12T15:00:00'),
      childrenCount: 1,
      specialRequests: 'Baby needs feeding every 2 hours.',
      address: '456 Parent Ave, New York, NY 10002',
      latitude: 40.7589,
      longitude: -73.9851,
      hourlyRate: 30.00,
      totalHours: 5,
      subtotal: 15000,
      platformFee: 2250,
      totalAmount: 15000,
      status: 'PENDING',
    },
  });

  // Create chat rooms for the bookings
  const chatRoom1 = await prisma.chatRoom.create({
    data: {
      bookingId: booking1.id,
      parentId: parent1.id,
      caregiverId: caregiver1User.id,
      lastMessageAt: new Date(),
    },
  });

  const chatRoom2 = await prisma.chatRoom.create({
    data: {
      bookingId: booking2.id,
      parentId: parent1.id,
      caregiverId: caregiver2User.id,
    },
  });

  // Create some sample messages
  await prisma.message.create({
    data: {
      chatRoomId: chatRoom1.id,
      senderId: parent1.id,
      content: 'Hi Emily! Looking forward to having you watch the kids on Saturday.',
      messageType: 'TEXT',
    },
  });

  await prisma.message.create({
    data: {
      chatRoomId: chatRoom1.id,
      senderId: caregiver1User.id,
      content: 'Hi Sarah! I\'m excited to meet your children. Do they have any favorite snacks I should know about?',
      messageType: 'TEXT',
      isRead: true,
    },
  });

  await prisma.message.create({
    data: {
      chatRoomId: chatRoom1.id,
      senderId: parent1.id,
      content: 'Yes! They love apple slices and goldfish crackers. Thank you for asking!',
      messageType: 'TEXT',
    },
  });

  // Create some notifications for testing
  await prisma.notification.create({
    data: {
      userId: parent1.id,
      type: 'booking_confirmed',
      title: 'Booking Confirmed',
      message: 'Your booking with Emily Davis has been confirmed.',
    },
  });

  await prisma.notification.create({
    data: {
      userId: caregiver1User.id,
      type: 'new_message',
      title: 'New Message',
      message: 'Sarah Williams sent you a message about your upcoming booking.',
    },
  });

  console.log('✅ Simple database seeded successfully!');
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