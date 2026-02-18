import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { db } from '@/lib/db';
import { z } from 'zod';

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
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await request.json();

    // Get babysitter profile
    const babysitter = await db.babysitter.findUnique({
      where: { userId }
    });

    if (!babysitter) {
      return NextResponse.json(
        { error: 'Babysitter profile not found' },
        { status: 404 }
      );
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
      return NextResponse.json(
        { error: `Cannot add more references. You have ${existingCount} and can only add ${3 - existingCount} more.` },
        { status: 400 }
      );
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

    return NextResponse.json({
      success: true,
      message: `${createdRefs.count} reference(s) added successfully`,
      totalReferences: existingCount + createdRefs.count,
    });

  } catch (error) {
    console.error('Add references error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to add references' },
      { status: 500 }
    );
  }
}

// GET - Get all references
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
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
      return NextResponse.json(
        { error: 'Babysitter profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
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
    return NextResponse.json(
      { error: 'Failed to get references' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a reference
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const referenceId = searchParams.get('id');

    if (!referenceId) {
      return NextResponse.json(
        { error: 'Reference ID is required' },
        { status: 400 }
      );
    }

    const babysitter = await db.babysitter.findUnique({
      where: { userId: session.user.id }
    });

    if (!babysitter) {
      return NextResponse.json(
        { error: 'Babysitter profile not found' },
        { status: 404 }
      );
    }

    // Verify the reference belongs to this babysitter
    const reference = await db.babysitterReference.findFirst({
      where: {
        id: referenceId,
        babysitterId: babysitter.id
      }
    });

    if (!reference) {
      return NextResponse.json(
        { error: 'Reference not found' },
        { status: 404 }
      );
    }

    await db.babysitterReference.delete({
      where: { id: referenceId }
    });

    return NextResponse.json({
      success: true,
      message: 'Reference removed successfully'
    });

  } catch (error) {
    console.error('Delete reference error:', error);
    return NextResponse.json(
      { error: 'Failed to delete reference' },
      { status: 500 }
    );
  }
}
