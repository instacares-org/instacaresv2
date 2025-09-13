import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/database';
// import { generateToken, createAuthCookieConfig } from '@/lib/jwt';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    
    console.log('Test login attempt:', { email, hasPassword: !!password });
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        profile: true
      }
    });
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found',
        debug: { email, userExists: false }
      }, { status: 404 });
    }
    
    console.log('User found:', {
      id: user.id.substring(0, 8),
      email: user.email,
      userType: user.userType,
      approvalStatus: user.approvalStatus,
      isActive: user.isActive,
      hasPassword: !!user.passwordHash
    });
    
    // Check password
    if (!user.passwordHash) {
      return NextResponse.json({
        success: false,
        error: 'No password set for user',
        debug: { hasPasswordHash: false }
      }, { status: 401 });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValidPassword) {
      return NextResponse.json({
        success: false,
        error: 'Invalid password',
        debug: { passwordValid: false }
      }, { status: 401 });
    }
    
    // Check status
    console.log('User status check:', {
      isActive: user.isActive,
      approvalStatus: user.approvalStatus
    });
    
    if (!user.isActive) {
      return NextResponse.json({
        success: false,
        error: 'Account is deactivated',
        status: 'INACTIVE'
      }, { status: 403 });
    }
    
    if (user.approvalStatus === 'PENDING') {
      return NextResponse.json({
        success: false,
        error: 'Account is pending approval',
        status: 'pending_approval'
      }, { status: 403 });
    }
    
    // Generate token
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      userType: user.userType as 'PARENT' | 'CAREGIVER' | 'ADMIN',
      approvalStatus: user.approvalStatus,
    };
    
    const token = generateToken(tokenPayload, false);
    
    console.log('Token generated successfully');
    
    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Test login successful',
      user: {
        id: user.id,
        email: user.email,
        userType: user.userType,
        approvalStatus: user.approvalStatus,
        profile: user.profile
      },
      token,
      debug: {
        tokenLength: token.length,
        userStatus: user.approvalStatus,
        isActive: user.isActive
      }
    });
    
    // Set cookie
    const cookieConfig = createAuthCookieConfig(process.env.NODE_ENV === 'production', false);
    response.cookies.set(cookieConfig.name, token, cookieConfig.options);
    
    return response;
    
  } catch (error) {
    console.error('Test login error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      debug: { error: error instanceof Error ? error.message : 'Unknown error' }
    }, { status: 500 });
  }
}