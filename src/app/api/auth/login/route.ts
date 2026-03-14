import { NextRequest } from 'next/server';
import { z } from 'zod';
import { signIn } from 'next-auth/react';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Must be a valid email address'),
  password: z.string().min(1, 'Password is required'),
  userType: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      const text = await request.text();
      body = JSON.parse(text);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      return ApiErrors.badRequest('Invalid JSON format in request body');
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid input', parsed.error.flatten().fieldErrors);
    }
    const { email, password, userType } = parsed.data;

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        profile: true,
      }
    });

    if (!user) {
      return ApiErrors.unauthorized('Invalid credentials');
    }

    // Check user type if specified
    if (userType === 'admin' && user.userType !== 'ADMIN') {
      return ApiErrors.forbidden('Access denied. Admin credentials required.');
    }

    // Verify password
    if (!user.passwordHash) {
      return ApiErrors.unauthorized('Password authentication not configured for this account');
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return ApiErrors.unauthorized('Invalid credentials');
    }

    // Check account status
    if (!user.isActive) {
      return ApiErrors.forbidden('Account is deactivated. Please contact support.');
    }

    if (user.approvalStatus === 'REJECTED') {
      return ApiErrors.forbidden('Account has been rejected.');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Return success with user data
    // Note: Actual session creation should be handled by NextAuth
    // This endpoint is for validation only
    return apiSuccess({
      user: {
        id: user.id,
        email: user.email,
        userType: user.userType,
        profile: user.profile,
      }
    }, 'Authentication successful. Use NextAuth for session management.');

  } catch (error) {
    console.error('Login error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return ApiErrors.internal('Authentication failed');
  }
}