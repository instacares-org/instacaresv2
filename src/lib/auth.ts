import { NextRequest } from 'next/server';
import { prisma } from './database';
import { logger } from './logger';
import jwt from 'jsonwebtoken';

// Simple admin authentication for demo purposes
// In production, you'd use proper JWT/session management
export async function verifyAdminAuth(request: NextRequest): Promise<{ isValid: boolean; adminId?: string; error?: string }> {
  try {
    // Check for admin authorization header
    const authHeader = request.headers.get('authorization');
    const adminKey = request.headers.get('x-admin-key');
    
    // For demo purposes, check for a simple admin key
    // In production, implement proper JWT token validation
    const validAdminKey = process.env.ADMIN_SECRET_KEY;
    
    if (!validAdminKey) {
      return { 
        isValid: false, 
        error: 'Admin configuration error' 
      };
    }
    
    if (!adminKey || adminKey !== validAdminKey) {
      return { 
        isValid: false, 
        error: 'Invalid admin credentials' 
      };
    }

    // In a real app, you'd validate the admin user from the token
    // For now, return a demo admin ID
    return { 
      isValid: true, 
      adminId: 'admin-demo-id' 
    };

  } catch (error) {
    logger.error('Admin auth verification failed', error);
    return { 
      isValid: false, 
      error: 'Authentication failed' 
    };
  }
}

// Verify JWT token and return user data
export async function verifyToken(token: string): Promise<any | null> {
  try {
    const secret = process.env.JWT_SECRET;
    
    if (!secret) {
      logger.error('JWT_SECRET environment variable not configured');
      return null;
    }
    const decoded = jwt.verify(token, secret) as any;
    
    // Get user from database to ensure they still exist and are active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId || decoded.id },
      select: {
        id: true,
        email: true,
        userType: true,
        isActive: true,
        approvalStatus: true,
        emailVerified: true
      }
    });

    if (!user || !user.isActive || user.approvalStatus !== 'APPROVED') {
      return null;
    }

    return user;
  } catch (error) {
    logger.error('Token verification failed', error);
    return null;
  }
}

// Check if user account is approved and active
export async function verifyUserStatus(userId: string): Promise<{ isValid: boolean; user?: any; error?: string }> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        userType: true,
        approvalStatus: true,
        isActive: true,
        emailVerified: true
      }
    });

    if (!user) {
      return { isValid: false, error: 'User not found' };
    }

    if (user.approvalStatus !== 'APPROVED') {
      return { isValid: false, error: 'Account pending approval' };
    }

    if (!user.isActive) {
      return { isValid: false, error: 'Account is inactive' };
    }

    return { isValid: true, user };

  } catch (error) {
    logger.error('User status verification failed', error, { userId });
    return { isValid: false, error: 'Verification failed' };
  }
}

// Generate secure random tokens
export function generateSecureToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

// Password strength validation
export function validatePasswordStrength(password: string): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  if (password.length < 8) {
    issues.push('Password must be at least 8 characters long');
  }
  
  if (password.length > 128) {
    issues.push('Password must not exceed 128 characters');
  }
  
  if (!/[a-z]/.test(password)) {
    issues.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    issues.push('Password must contain at least one uppercase letter');
  }
  
  if (!/\d/.test(password)) {
    issues.push('Password must contain at least one number');
  }
  
  if (!/[@$!%*?&]/.test(password)) {
    issues.push('Password must contain at least one special character (@$!%*?&)');
  }
  
  // Check for common weak passwords
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123', 
    'password123', 'admin', 'letmein', 'welcome', 'monkey'
  ];
  
  if (commonPasswords.includes(password.toLowerCase())) {
    issues.push('Password is too common and easily guessable');
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}