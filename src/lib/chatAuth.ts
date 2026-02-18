import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { prisma } from './database';
import { logger } from './logger';

export interface AuthenticatedUser {
  id: string;
  email: string;
  userType: 'PARENT' | 'CAREGIVER' | 'ADMIN';
  profile?: {
    firstName: string;
    lastName: string;
    avatar?: string;
  };
}

/**
 * Get authenticated user from JWT token in cookies
 */
export async function getAuthenticatedUser(request?: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    let token: string | undefined;

    if (request) {
      // Try to get token from Authorization header first (for mobile app)
      const authHeader = request.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      }
      
      // Fallback to request cookies
      if (!token) {
        token = request.cookies.get('auth-token')?.value;
      }
    }

    if (!token) {
      // Fallback to server-side cookies
      const cookieStore = await cookies();
      token = cookieStore.get('auth-token')?.value;
    }

    if (!token) {
      logger.warn('No auth token found in cookies');
      return null;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      logger.error('JWT_SECRET not configured');
      return null;
    }

    const decoded = jwt.verify(token, secret) as any;
    const userId = decoded.userId || decoded.id;

    if (!userId) {
      logger.warn('Invalid token: missing user ID');
      return null;
    }

    // Get user from database with profile information
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        userType: true,
        isActive: true,
        approvalStatus: true,
        emailVerified: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    if (!user || !user.isActive || user.approvalStatus !== 'APPROVED') {
      logger.warn('User not found, inactive, or not approved', { userId, user });
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      userType: user.userType as 'PARENT' | 'CAREGIVER' | 'ADMIN',
      profile: user.profile ? {
        firstName: user.profile.firstName,
        lastName: user.profile.lastName,
        avatar: user.profile.avatar || undefined,
      } : undefined,
    };
  } catch (error) {
    logger.error('Authentication failed', error);
    return null;
  }
}

/**
 * Create a standardized API response
 */
export function createApiResponse<T>(
  success: boolean,
  data?: T,
  error?: string,
  status: number = 200
) {
  return Response.json(
    {
      success,
      data: success ? data : undefined,
      error: success ? undefined : error,
    },
    { status }
  );
}

/**
 * Get avatar URL with fallback to UI Avatars API
 */
export function getAvatarUrl(
  profileImage?: string | null,
  firstName?: string,
  lastName?: string,
  userId?: string
): string {
  if (profileImage) {
    return profileImage.startsWith('http') 
      ? profileImage 
      : `${process.env.NEXT_PUBLIC_BASE_URL || ''}/uploads/avatars/${profileImage}`;
  }

  // Generate fallback avatar URL
  const name = `${firstName || ''} ${lastName || ''}`.trim() || userId?.slice(0, 2).toUpperCase() || 'U';
  const encodedName = encodeURIComponent(name);
  
  return `https://ui-avatars.com/api/?name=${encodedName}&size=128&background=6366f1&color=ffffff&bold=true`;
}

/**
 * Format user information for API responses
 */
export function formatUserInfo(user: AuthenticatedUser) {
  return {
    id: user.id,
    firstName: user.profile?.firstName || '',
    lastName: user.profile?.lastName || '',
    profileImage: getAvatarUrl(
      user.profile?.avatar,
      user.profile?.firstName,
      user.profile?.lastName,
      user.id
    ),
    userType: user.userType,
  };
}