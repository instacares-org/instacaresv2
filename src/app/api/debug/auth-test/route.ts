import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { email, password, userType } = await request.json();
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      requestData: {
        email: email || 'missing',
        password: password ? 'provided' : 'missing',
        userType: userType || 'not specified'
      },
      databaseTest: null,
      authTest: null,
      error: null
    };
    
    // Test database connection
    try {
      await prisma.$connect();
      const userCount = await prisma.user.count();
      debugInfo.databaseTest = {
        connected: true,
        totalUsers: userCount
      };
    } catch (dbError: any) {
      debugInfo.databaseTest = {
        connected: false,
        error: dbError.message
      };
    }
    
    // Test authentication if credentials provided
    if (email && password) {
      try {
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          select: {
            id: true,
            email: true,
            passwordHash: true,
            userType: true,
            isActive: true,
            approvalStatus: true,
            emailVerified: true
          }
        });
        
        debugInfo.authTest = {
          userFound: !!user,
          userType: user?.userType || null,
          isActive: user?.isActive || null,
          approvalStatus: user?.approvalStatus || null,
          emailVerified: !!user?.emailVerified,
          hasPasswordHash: !!user?.passwordHash,
          passwordMatch: null
        };
        
        if (user && user.passwordHash && password) {
          const isValidPassword = await bcrypt.compare(password, user.passwordHash);
          debugInfo.authTest.passwordMatch = isValidPassword;
        }
        
        // Check user type match if specified
        if (userType && user) {
          const expectedUserType = userType === 'parent' ? 'PARENT' : 
                                 userType === 'caregiver' ? 'CAREGIVER' : 
                                 userType === 'admin' ? 'ADMIN' : null;
          debugInfo.authTest.userTypeMatch = expectedUserType === user.userType;
        }
        
      } catch (authError: any) {
        debugInfo.authTest = {
          error: authError.message
        };
      }
    }
    
    return NextResponse.json(debugInfo, { status: 200 });
    
  } catch (error: any) {
    return NextResponse.json({
      error: 'Debug endpoint error',
      message: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Auth debug endpoint is working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    nextAuthUrl: process.env.NEXTAUTH_URL,
    hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    hasDatabaseUrl: !!process.env.DATABASE_URL
  });
}