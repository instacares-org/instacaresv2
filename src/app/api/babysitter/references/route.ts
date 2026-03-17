import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { db } from '@/lib/db';
import { z } from 'zod';
import { apiSuccess, ApiErrors } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// Validation schema for references
const referenceSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  relationship: z.string().min(2, 'Relationship is required'),
  contactMethod: z.enum(['phone', 'email']),
  contactValue: z.string().min(5, 'Contact info is required'),
  notes: z.string().max(500).optional(),
});

const referencesArraySchema = z.array(referenceSchema).max(3, 'Maximum 3 references allowed');

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const userId = session.user.id;
    const body = await request.json();

    // Get babysitter profile
    const babysitter = await db.babysitter.findUnique({
      where: { userId }
    });

    if (!babysitter) {
      return ApiErrors.notFound('Babysitter profile not found');
    }

    // Handle single reference or array
    const references = Array.isArray(body) ? body : [body];

    // Validate references
    const validatedRefs = referencesArraySchema.parse(references);

    // Check current reference count
    const existingCount = await db.babysitterReference.count({
      where: { babysitterId: babysitter.id }
    });

    if (existingCount + validatedRefs.length > 3) {
      return ApiErrors.badRequest(`Cannot add more references. You have ${existingCount} and can only add ${3 - existingCount} more.`);
    }

    // Create references
    const createdRefs = await db.babysitterReference.createMany({
      data: validatedRefs.map(ref => ({
        babysitterId: babysitter.id,
        name: ref.name,
        relationship: ref.relationship,
        contactMethod: ref.contactMethod,
        contactValue: ref.contactValue,
        notes: ref.notes,
      }))
    });

    return apiSuccess({
      totalReferences: existingCount + createdRefs.count,
    }, `${createdRefs.count} reference(s) added successfully`);

  } catch (error) {
    console.error('Add references error:', error);

    if (error instanceof z.ZodError) {
      return ApiErrors.badRequest('Validation error', error.issues);
    }

    return ApiErrors.internal('Failed to add references');
  }
}

// GET - Get all references
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const babysitter = await db.babysitter.findUnique({
      where: { userId: session.user.id },
      include: {
        references: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!babysitter) {
      return ApiErrors.notFound('Babysitter profile not found');
    }

    return apiSuccess({
      references: babysitter.references.map(ref => ({
        id: ref.id,
        name: ref.name,
        relationship: ref.relationship,
        contactMethod: ref.contactMethod,
        contactValue: ref.contactValue,
        isVerified: ref.isVerified,
        verifiedAt: ref.verifiedAt,
        notes: ref.notes,
      })),
      canAddMore: babysitter.references.length < 3,
    });

  } catch (error) {
    console.error('Get references error:', error);
    return ApiErrors.internal('Failed to get references');
  }
}

// DELETE - Remove a reference
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const referenceId = searchParams.get('id');

    if (!referenceId) {
      return ApiErrors.badRequest('Reference ID is required');
    }

    const babysitter = await db.babysitter.findUnique({
      where: { userId: session.user.id }
    });

    if (!babysitter) {
      return ApiErrors.notFound('Babysitter profile not found');
    }

    // Verify the reference belongs to this babysitter
    const reference = await db.babysitterReference.findFirst({
      where: {
        id: referenceId,
        babysitterId: babysitter.id
      }
    });

    if (!reference) {
      return ApiErrors.notFound('Reference not found');
    }

    await db.babysitterReference.delete({
      where: { id: referenceId }
    });

    return apiSuccess(undefined, 'Reference removed successfully');

  } catch (error) {
    console.error('Delete reference error:', error);
    return ApiErrors.internal('Failed to delete reference');
  }
}
