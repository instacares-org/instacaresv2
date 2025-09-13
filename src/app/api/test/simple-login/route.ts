import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/database';
// import { generateToken, createAuthCookieConfig } from '@/lib/jwt';

export async function POST(request: NextRequest) {
  console.log('\n=== SIMPLE LOGIN TEST ===');
  
  try {
    const body = await request.json();
    console.log('1. Request body:', body);

    const { email, password } = body;
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true }
    });
    
    console.log('2. User found:', {
      exists: !!user,
      email: user?.email,
      userType: user?.userType,
      approvalStatus: user?.approvalStatus,
      isActive: user?.isActive
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json({
        success: false,
        error: 'User not found or no password set'
      }, { status: 401 });
    }

    // Check password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    console.log('3. Password valid:', isValid);
    
    if (!isValid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid password'
      }, { status: 401 });
    }

    // Generate token
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      userType: user.userType as 'PARENT' | 'CAREGIVER' | 'ADMIN',
      approvalStatus: user.approvalStatus,
    };
    
    const token = generateToken(tokenPayload, false);
    console.log('4. Token generated:', {
      length: token.length,
      preview: token.substring(0, 20) + '...'
    });

    // Create response
    const responseData = {
      success: true,
      message: 'Simple login successful',
      user: {
        id: user.id,
        email: user.email,
        userType: user.userType,
        approvalStatus: user.approvalStatus,
        isActive: user.isActive
      },
      token,
      debug: {
        tokenGenerated: true,
        userStatus: user.approvalStatus
      }
    };

    const response = NextResponse.json(responseData);
    
    // Set cookie (multiple ways)
    const cookieConfig = createAuthCookieConfig(false, false);
    console.log('5. Cookie config:', cookieConfig);
    
    response.cookies.set(cookieConfig.name, token, cookieConfig.options);
    
    // Also try setting a simple cookie
    response.cookies.set('simple-auth-token', token, {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/'
    });

    console.log('6. Response created with cookies set');
    console.log('=== END SIMPLE LOGIN TEST ===\n');

    return response;

  } catch (error) {
    console.error('Simple login error:', error);
    return NextResponse.json({
      success: false,
      error: 'Login failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}