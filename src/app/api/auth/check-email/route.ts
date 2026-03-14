import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';

const checkEmailSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Must be a valid email address'),
});

export async function POST(request: NextRequest) {
  // Constant-time delay to prevent timing-based email enumeration
  const start = Date.now();
  const MIN_RESPONSE_MS = 300;

  try {
    const body = await request.json();
    const parsed = checkEmailSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid input', parsed.error.flatten().fieldErrors);
    }
    const { email } = parsed.data;

    // Check if user already exists (case-insensitive)
    const existingUser = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase()
      },
      select: { id: true } // Only select id, don't leak any user data
    });

    // Enforce constant response time to prevent timing attacks
    const elapsed = Date.now() - start;
    if (elapsed < MIN_RESPONSE_MS) {
      await new Promise(resolve => setTimeout(resolve, MIN_RESPONSE_MS - elapsed));
    }

    return apiSuccess({ exists: !!existingUser });

  } catch (error) {
    console.error('Email check error:', error);

    // Enforce constant response time even on errors
    const elapsed = Date.now() - start;
    if (elapsed < MIN_RESPONSE_MS) {
      await new Promise(resolve => setTimeout(resolve, MIN_RESPONSE_MS - elapsed));
    }

    return ApiErrors.internal('Unable to check email availability');
  }
}
