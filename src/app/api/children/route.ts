import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { db } from '@/lib/db';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMIT_CONFIGS, createRateLimitHeaders } from '@/lib/rate-limit';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-utils';

const emergencyContactSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Contact name is required').max(200, 'Contact name too long').trim(),
  relationship: z.string().min(1, 'Relationship is required').max(100, 'Relationship too long').trim(),
  phone: z.string().min(7, 'Phone number must be at least 7 characters').max(20, 'Phone number too long').trim(),
  email: z.string().email('Invalid email').max(200, 'Email too long').optional().or(z.literal('')),
  canPickup: z.boolean().optional().default(false),
});

const createChildSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100, 'First name too long').trim(),
  lastName: z.string().min(1, 'Last name is required').max(100, 'Last name too long').trim(),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  gender: z.string().max(50, 'Gender too long').nullish(),
  allergies: z.any().optional(),
  medications: z.any().optional(),
  medicalConditions: z.any().optional(),
  emergencyMedicalInfo: z.string().max(1000, 'Emergency medical info too long').nullish(),
  bloodType: z.string().max(10, 'Blood type too long').nullish(),
  emergencyContacts: z.array(emergencyContactSchema).min(1, 'At least one emergency contact is required'),
  dietaryRestrictions: z.any().optional(),
  specialInstructions: z.string().max(1000, 'Special instructions too long').nullish(),
  pickupInstructions: z.string().max(1000, 'Pickup instructions too long').nullish(),
  photoUrl: z.string().url('Invalid photo URL').max(500, 'Photo URL too long').nullish(),
});

// Force dynamic rendering - don't cache this route
export const dynamic = 'force-dynamic';

// GET /api/children - Fetch children for authenticated parent
export async function GET(request: NextRequest) {
  try {
    const authResult = await withAuth(request, 'PARENT');
    if (!authResult.isAuthorized || !authResult.user) {
      return authResult.response;
    }

    const children = await db.child.findMany({
      where: { parentId: authResult.user.id },
      orderBy: { createdAt: 'desc' }
    });

    return apiSuccess(children);

  } catch (error) {
    console.error('Error fetching children:', error);
    return ApiErrors.internal('Failed to fetch children profiles');
  }
}

// POST /api/children - Create new child profile
export async function POST(request: NextRequest) {
  // Force log to stderr which PM2 captures
  process.stderr.write(`[POST /api/children] Request received at ${new Date().toISOString()}\n`);
  console.log('[POST /api/children] Request received');
  try {
    const rateLimitResult = await checkRateLimit(request, RATE_LIMIT_CONFIGS.API_WRITE);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    process.stderr.write('[POST /api/children] Calling withAuth...\n');
    console.log('[POST /api/children] Calling withAuth...');
    const authResult = await withAuth(request, 'PARENT');
    process.stderr.write(`[POST /api/children] withAuth result: ${JSON.stringify({ isAuthorized: authResult.isAuthorized })}\n`);
    console.log('[POST /api/children] withAuth result:', { isAuthorized: authResult.isAuthorized });
    if (!authResult.isAuthorized || !authResult.user) {
      return authResult.response;
    }

    const body = await request.json();
    const parsed = createChildSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid input', parsed.error.flatten().fieldErrors);
    }

    const {
      firstName,
      lastName,
      dateOfBirth,
      gender,
      allergies,
      medications,
      medicalConditions,
      emergencyMedicalInfo,
      bloodType,
      emergencyContacts,
      dietaryRestrictions,
      specialInstructions,
      pickupInstructions,
      photoUrl
    } = parsed.data;

    const child = await db.child.create({
      data: {
        parentId: authResult.user.id,
        firstName,
        lastName,
        dateOfBirth: new Date(dateOfBirth),
        gender,
        allergies,
        medications,
        medicalConditions,
        emergencyMedicalInfo,
        bloodType,
        emergencyContacts,
        dietaryRestrictions,
        specialInstructions,
        pickupInstructions,
        photoUrl
      }
    });

    return apiSuccess(child, 'Child profile created successfully');

  } catch (error) {
    console.error('Error creating child profile:', error);
    return ApiErrors.internal('Failed to create child profile');
  }
}