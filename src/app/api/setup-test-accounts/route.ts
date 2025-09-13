import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Security check - only allow in development or with special key
    const { setupKey } = await request.json();
    if (setupKey !== 'InstaCares2024Setup!') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Setting up test accounts in production database...');

    // Hash passwords
    const parentPassword = await bcrypt.hash('TestParent123!', 12);
    const caregiverPassword = await bcrypt.hash('TestCaregiver123!', 12);

    // Check if accounts already exist
    const existingParent = await prisma.user.findUnique({
      where: { email: 'parent.test@instacares.com' }
    });

    const existingCaregiver = await prisma.user.findUnique({
      where: { email: 'caregiver.test@instacares.com' }
    });

    if (existingParent && existingCaregiver) {
      return NextResponse.json({
        message: 'Test accounts already exist',
        accounts: [
          { email: 'parent.test@instacares.com', password: 'TestParent123!' },
          { email: 'caregiver.test@instacares.com', password: 'TestCaregiver123!' }
        ]
      });
    }

    // Create parent account
    let parentAccount;
    if (!existingParent) {
      parentAccount = await prisma.user.create({
        data: {
          email: 'parent.test@instacares.com',
          passwordHash: parentPassword,
          name: 'Sarah Thompson',
          userType: 'PARENT',
          approvalStatus: 'APPROVED',
          isActive: true,
          emailVerified: new Date(),
          profile: {
            create: {
              firstName: 'Sarah',
              lastName: 'Thompson',
              phone: '+1-647-555-1234',
              dateOfBirth: new Date('1987-05-12'),
              streetAddress: '789 Queen Street West',
              apartment: 'Unit 15A',
              city: 'Toronto',
              state: 'Ontario',
              zipCode: 'M5H 2M9',
              country: 'Canada',
              latitude: 43.6505,
              longitude: -79.3889,
              emergencyName: 'Michael Thompson',
              emergencyPhone: '+1-647-555-1235',
              emergencyRelation: 'Spouse'
            }
          }
        }
      });
      console.log('Parent account created:', parentAccount.id);
    } else {
      parentAccount = existingParent;
    }

    // Create caregiver account
    let caregiverAccount;
    if (!existingCaregiver) {
      caregiverAccount = await prisma.user.create({
        data: {
          email: 'caregiver.test@instacares.com',
          passwordHash: caregiverPassword,
          name: 'Amanda Rodriguez',
          userType: 'CAREGIVER',
          approvalStatus: 'APPROVED',
          isActive: true,
          emailVerified: new Date(),
          profile: {
            create: {
              firstName: 'Amanda',
              lastName: 'Rodriguez',
              phone: '+1-905-555-7890',
              dateOfBirth: new Date('1994-09-22'),
              streetAddress: '321 Lakeshore Boulevard',
              apartment: 'Suite 8B',
              city: 'Oakville',
              state: 'Ontario',
              zipCode: 'L6H 7R1',
              country: 'Canada',
              latitude: 43.4481,
              longitude: -79.6877,
              emergencyName: 'Maria Rodriguez',
              emergencyPhone: '+1-905-555-7891',
              emergencyRelation: 'Mother'
            }
          },
          caregiver: {
            create: {
              hourlyRate: 32.00,
              experienceYears: 8,
              bio: "Hello! I'm Amanda, a dedicated childcare professional with 8 years of experience working with children from infants to pre-teens. I hold a diploma in Early Childhood Education and am certified in CPR and First Aid. I speak English, Spanish, and French fluently.",
              languages: ['English', 'Spanish', 'French'],
              availability: {
                monday: { available: true, start: '06:30', end: '20:00' },
                tuesday: { available: true, start: '06:30', end: '20:00' },
                wednesday: { available: true, start: '06:30', end: '20:00' },
                thursday: { available: true, start: '06:30', end: '20:00' },
                friday: { available: true, start: '06:30', end: '20:00' },
                saturday: { available: true, start: '08:00', end: '18:00' },
                sunday: { available: true, start: '10:00', end: '16:00' }
              },
              maxChildren: 5,
              minAge: 3,
              maxAge: 156,
              isVerified: true,
              backgroundCheck: true,
              backgroundCheckDate: new Date('2024-02-01'),
              isAvailable: true,
              canReceivePayments: true,
              stripeOnboarded: false
            }
          }
        }
      });
      console.log('Caregiver account created:', caregiverAccount.id);
    } else {
      caregiverAccount = existingCaregiver;
    }

    return NextResponse.json({
      success: true,
      message: 'Test accounts created successfully',
      accounts: [
        {
          type: 'parent',
          email: 'parent.test@instacares.com',
          password: 'TestParent123!',
          id: parentAccount.id,
          name: 'Sarah Thompson'
        },
        {
          type: 'caregiver', 
          email: 'caregiver.test@instacares.com',
          password: 'TestCaregiver123!',
          id: caregiverAccount.id,
          name: 'Amanda Rodriguez'
        }
      ]
    });

  } catch (error) {
    console.error('Setup accounts error:', error);
    return NextResponse.json({
      error: 'Failed to setup test accounts',
      details: error.message
    }, { status: 500 });
  }
}