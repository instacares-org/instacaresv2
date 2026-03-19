export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';
import { passwordValidationSchema } from '@/lib/password-validation';

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: passwordValidationSchema,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Invalid request';
      return ApiErrors.badRequest(firstError);
    }

    const { token, password } = parsed.data;

    // Hash the incoming token with SHA-256 to compare against stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Look up the token: must match, not used, not expired
    const resetToken = await db.passwordResetToken.findFirst({
      where: {
        token: hashedToken,
        used: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!resetToken) {
      return ApiErrors.badRequest('Invalid or expired reset link. Please request a new password reset.');
    }

    // Hash the new password with bcrypt
    const passwordHash = await bcrypt.hash(password, 12);

    // Perform the update in a transaction
    await db.$transaction([
      // Update the user's password and clear mustChangePassword flag
      db.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash,
          mustChangePassword: false,
        },
      }),
      // Mark the token as used
      db.passwordResetToken.update({
        where: { id: resetToken.id },
        data: {
          used: true,
          usedAt: new Date(),
        },
      }),
    ]);

    return apiSuccess({
      message: 'Password has been reset successfully.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return ApiErrors.internal('An unexpected error occurred');
  }
}
