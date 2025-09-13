import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json();
    const { email, password } = requestBody;
    
    console.log('Debug login attempt:', { email, passwordLength: password?.length });
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        userType: true,
        approvalStatus: true,
        isActive: true
      }
    });
    
    if (!user) {
      return NextResponse.json({
        debug: true,
        message: 'User not found',
        email: email
      });
    }
    
    console.log('User found:', {
      id: user.id,
      email: user.email,
      hasPasswordHash: !!user.passwordHash,
      passwordHashLength: user.passwordHash?.length,
      userType: user.userType,
      approvalStatus: user.approvalStatus,
      isActive: user.isActive
    });
    
    // Test bcrypt
    let bcryptResult = false;
    try {
      bcryptResult = await bcrypt.compare(password, user.passwordHash || '');
      console.log('Bcrypt comparison result:', bcryptResult);
    } catch (bcryptError) {
      console.error('Bcrypt error:', bcryptError);
      return NextResponse.json({
        debug: true,
        message: 'Bcrypt error',
        error: bcryptError.message
      });
    }
    
    // Test manual password creation
    try {
      const testHash = await bcrypt.hash(password, 12);
      const testCompare = await bcrypt.compare(password, testHash);
      console.log('Test hash creation and comparison:', { success: testCompare });
    } catch (testError) {
      console.error('Test hash error:', testError);
    }
    
    return NextResponse.json({
      debug: true,
      user: {
        id: user.id,
        email: user.email,
        userType: user.userType,
        approvalStatus: user.approvalStatus,
        isActive: user.isActive,
        hasPasswordHash: !!user.passwordHash,
        passwordHashLength: user.passwordHash?.length
      },
      passwordMatch: bcryptResult,
      bcryptWorking: true
    });
    
  } catch (error) {
    console.error('Debug login error:', error);
    return NextResponse.json({
      debug: true,
      error: error.message
    }, { status: 500 });
  }
}