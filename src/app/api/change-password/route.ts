import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/\d/, 'Must contain a number')
    .regex(/[@$!%*?&#^]/, 'Must contain a special character'),
});

export async function POST(request: NextRequest) {
  try {
    // Auth via JWT token
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: process.env.NODE_ENV === 'production',
    });

    if (!token?.email) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const validation = changePasswordSchema.safeParse(body);

    if (!validation.success) {
      return ApiErrors.badRequest('Validation failed', validation.error.flatten().fieldErrors);
    }

    const { currentPassword, newPassword } = validation.data;

    // Fetch user from DB
    const user = await prisma.user.findUnique({
      where: { email: token.email as string },
      select: { id: true, passwordHash: true, mustChangePassword: true },
    });

    if (!user || !user.passwordHash) {
      return ApiErrors.badRequest('Unable to change password for this account');
    }

    // Verify current password
    const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      return ApiErrors.badRequest('Current password is incorrect');
    }

    // Ensure new password is different
    const isSame = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSame) {
      return ApiErrors.badRequest('New password must be different from current password');
    }

    // Hash and save new password, clear the flag
    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
      },
    });

    console.log(`[AUTH] Password changed for user ${user.id}`);

    return apiSuccess(null, 'Password changed successfully');
  } catch (error) {
    console.error('Error changing password:', error);
    return ApiErrors.internal('Failed to change password');
  }
}
