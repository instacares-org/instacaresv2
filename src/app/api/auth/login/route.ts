import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/database';
import { generateToken, createAuthCookieConfig, AuthUser } from '@/lib/jwt';
import { logger, getClientInfo } from '@/lib/logger';

// Prevent pre-rendering during build time
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Login validation schema
const loginSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
  userType: z.enum(['parent', 'caregiver', 'admin'], { message: 'Invalid user type' }).optional(),
  rememberMe: z.boolean().optional().default(false),
});

// Rate limiting (simple in-memory store)
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip: string): { allowed: boolean; remaining?: number } {
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
  
  // Reset if lockout period has passed
  if (now - attempts.lastAttempt > LOCKOUT_DURATION) {
    attempts.count = 0;
  }
  
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    return { allowed: false };
  }
  
  return { allowed: true, remaining: MAX_LOGIN_ATTEMPTS - attempts.count - 1 };
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
  
  attempts.count += 1;
  attempts.lastAttempt = now;
  loginAttempts.set(ip, attempts);
}

function resetFailedAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const clientInfo = getClientInfo(request);
  
  try {
    // Rate limiting check
    const rateLimitResult = checkRateLimit(clientInfo.ip);
    if (!rateLimitResult.allowed) {
      logger.security('Login rate limit exceeded', {
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      });
      
      return NextResponse.json(
        { 
          error: 'Too many login attempts. Please try again in 15 minutes.',
          lockoutDuration: 15 * 60 * 1000
        },
        { status: 429 }
      );
    }
    
    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }
    
    const validationResult = loginSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(issue => issue.message);
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      );
    }
    
    const { email, password, userType, rememberMe } = validationResult.data;
    
    // Find user with profile data
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
        caregiver: userType === 'caregiver' ? {
          select: {
            id: true,
            hourlyRate: true,
            averageRating: true,
            isAvailable: true,
            bio: true,
            experienceYears: true,
            stripeAccountId: true,
          }
        } : false
      }
    });
    
    if (!user) {
      recordFailedAttempt(clientInfo.ip);
      
      logger.security('Login attempt with non-existent email', {
        email,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        userType: userType || 'unknown'
      });
      
      // Generic error to prevent email enumeration
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }
    
    // Check if user type matches (if specified)
    if (userType) {
      const expectedUserType = userType === 'parent' ? 'PARENT' : 
                               userType === 'caregiver' ? 'CAREGIVER' : 
                               userType === 'admin' ? 'ADMIN' : null;
      
      if (expectedUserType && user.userType !== expectedUserType) {
        recordFailedAttempt(clientInfo.ip);
        
        logger.security('Login attempt with wrong user type', {
          userId: user.id,
          email: user.email,
          actualUserType: user.userType,
          attemptedUserType: userType,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent
        });
        
        // Generic error message to prevent user type enumeration
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        );
      }
    }
    
    // Verify password - ensure we have a valid password hash
    if (!user.passwordHash || typeof user.passwordHash !== 'string') {
      logger.error('Invalid password hash for user', {
        userId: user.id,
        email: user.email,
        passwordHashType: typeof user.passwordHash,
        passwordHashValue: user.passwordHash
      });
      
      recordFailedAttempt(clientInfo.ip);
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }
    
    // Ensure password is a string
    const passwordString = String(password);
    const isValidPassword = await bcrypt.compare(passwordString, user.passwordHash);
    if (!isValidPassword) {
      recordFailedAttempt(clientInfo.ip);
      
      logger.security('Login attempt with invalid password', {
        userId: user.id,
        email: user.email,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        userType: user.userType
      });
      
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }
    
    // Check account status
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is deactivated. Please contact support.' },
        { status: 403 }
      );
    }
    
    if (user.approvalStatus === 'PENDING') {
      return NextResponse.json(
        { 
          error: 'Account is pending approval. You will be notified once approved.',
          status: 'pending_approval'
        },
        { status: 403 }
      );
    }
    
    if (user.approvalStatus === 'REJECTED') {
      return NextResponse.json(
        { error: 'Account has been rejected. Please contact support for more information.' },
        { status: 403 }
      );
    }
    
    if (user.approvalStatus === 'SUSPENDED') {
      return NextResponse.json(
        { error: 'Account is suspended. Please contact support for assistance.' },
        { status: 403 }
      );
    }
    
    // Reset failed attempts on successful login
    resetFailedAttempts(clientInfo.ip);
    
    // Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });
    
    // Generate JWT token with remember me option
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      userType: user.userType as 'PARENT' | 'CAREGIVER' | 'ADMIN',
      approvalStatus: user.approvalStatus,
    };
    
    const token = generateToken(tokenPayload, rememberMe);
    
    // Prepare user data for response
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      userType: user.userType as 'PARENT' | 'CAREGIVER' | 'ADMIN',
      approvalStatus: user.approvalStatus,
      profile: user.profile ? {
        firstName: user.profile.firstName,
        lastName: user.profile.lastName,
        phone: user.profile.phone || undefined,
        avatar: user.profile.avatar || undefined,
      } : undefined
    };
    
    // Create response with secure cookie
    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      user: authUser,
      token, // Also provide token for client-side storage if needed
    });
    
    // Set secure HTTP-only cookie with remember me option
    const cookieConfig = createAuthCookieConfig(process.env.NODE_ENV === 'production', rememberMe);
    response.cookies.set(cookieConfig.name, token, cookieConfig.options);
    
    // Log successful login
    logger.info('User login successful', {
      userId: user.id,
      email: user.email,
      userType: user.userType,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      processingTime: Date.now() - startTime
    });
    
    return response;
    
  } catch (error: any) {
    logger.error('Login endpoint error', error, {
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      processingTime: Date.now() - startTime
    });
    
    return NextResponse.json(
      { error: 'Internal server error during login' },
      { status: 500 }
    );
  }
}