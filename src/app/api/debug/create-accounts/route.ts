import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const testAccounts = [
      {
        email: 'sarah.johnson@testmail.ca',
        password: 'TestCaregiver123!',
        userType: 'CAREGIVER' as const,
        profile: {
          firstName: 'Sarah',
          lastName: 'Johnson',
          phone: '+1-416-555-0101',
          streetAddress: '123 Queen Street West',
          apartment: 'Unit 5B',
          city: 'Toronto',
          state: 'ON',
          zipCode: 'M5H 2M9',
          postalCode: 'M5H 2M9',
          country: 'Canada'
        }
      },
      {
        email: 'michael.chen@testmail.ca',
        password: 'TestParent123!',
        userType: 'PARENT' as const,
        profile: {
          firstName: 'Michael', 
          lastName: 'Chen',
          phone: '+1-416-555-0202',
          streetAddress: '456 King Street East',
          apartment: 'Suite 12A',
          city: 'Toronto',
          state: 'ON',
          zipCode: 'M5A 1L4',
          postalCode: 'M5A 1L4',
          country: 'Canada'
        }
      }
    ];
    
    const results = {
      timestamp: new Date().toISOString(),
      created: [],
      existing: [],
      errors: []
    };
    
    await prisma.$connect();
    
    for (const account of testAccounts) {
      try {
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
          where: { email: account.email }
        });
        
        if (existingUser) {
          results.existing.push({
            email: account.email,
            userType: account.userType,
            status: 'Already exists'
          });
          continue;
        }
        
        // Hash password
        const passwordHash = await bcrypt.hash(account.password, 12);
        
        // Create user with profile
        const user = await prisma.user.create({
          data: {
            email: account.email,
            passwordHash: passwordHash,
            userType: account.userType,
            approvalStatus: 'APPROVED',
            isActive: true,
            emailVerified: new Date(),
            profile: {
              create: account.profile
            }
          },
          include: {
            profile: true
          }
        });
        
        // Create caregiver profile if needed
        if (account.userType === 'CAREGIVER') {
          await prisma.caregiver.create({
            data: {
              userId: user.id,
              hourlyRate: 25.00,
              experienceYears: 3,
              bio: 'Experienced childcare provider in Toronto with a passion for helping families.',
              isAvailable: true,
              averageRating: 4.8
            }
          });
        }
        
        results.created.push({
          email: account.email,
          userType: account.userType,
          userId: user.id,
          status: 'Created successfully'
        });
        
      } catch (error: any) {
        results.errors.push({
          email: account.email,
          error: error.message
        });
      }
    }
    
    // Get final user count
    const finalUserCount = await prisma.user.count();
    
    return NextResponse.json({
      ...results,
      finalUserCount,
      message: 'Account creation process complete'
    }, { status: 200 });
    
  } catch (error: any) {
    return NextResponse.json({
      error: 'Account creation failed',
      message: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET(request: NextRequest) {
  try {
    await prisma.$connect();
    
    const testEmails = [
      'sarah.johnson@testmail.ca',
      'michael.chen@testmail.ca'
    ];
    
    const users = await prisma.user.findMany({
      where: {
        email: {
          in: testEmails
        }
      },
      select: {
        id: true,
        email: true,
        userType: true,
        isActive: true,
        approvalStatus: true,
        emailVerified: true,
        createdAt: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
            city: true,
            state: true
          }
        },
        caregiver: {
          select: {
            id: true,
            hourlyRate: true,
            isAvailable: true
          }
        }
      }
    });
    
    const totalUsers = await prisma.user.count();
    const totalCaregivers = await prisma.user.count({
      where: { userType: 'CAREGIVER' }
    });
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      totalUsers,
      totalCaregivers,
      testAccounts: users,
      message: 'Account status retrieved'
    });
    
  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to get account status',
      message: error.message
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}