import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { db } from '@/lib/db';
import { z } from 'zod';

// Validation schema for document upload
const documentsSchema = z.object({
  governmentIdFront: z.string().url().optional(),
  governmentIdBack: z.string().url().optional(),
  policeCheck: z.string().url().optional(),
  selfieForMatch: z.string().url().optional(),
  cprCertificate: z.string().url().optional(),
  cprCertificateExpiry: z.string().optional(),
  eceCertificate: z.string().url().optional(),
});

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

    // Validate input
    const validatedData = documentsSchema.parse(body);

    // Get babysitter profile
    const babysitter = await db.babysitter.findUnique({
      where: { userId }
    });

    if (!babysitter) {
      return NextResponse.json(
        { error: 'Babysitter profile not found. Please complete registration first.' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (validatedData.governmentIdFront) {
      updateData.governmentIdFront = validatedData.governmentIdFront;
    }
    if (validatedData.governmentIdBack) {
      updateData.governmentIdBack = validatedData.governmentIdBack;
    }
    if (validatedData.policeCheck) {
      updateData.policeCheck = validatedData.policeCheck;
    }
    if (validatedData.selfieForMatch) {
      updateData.selfieForMatch = validatedData.selfieForMatch;
    }
    if (validatedData.cprCertificate) {
      updateData.cprCertificate = validatedData.cprCertificate;
      if (validatedData.cprCertificateExpiry) {
        updateData.cprCertificateExpiry = new Date(validatedData.cprCertificateExpiry);
      }
    }
    if (validatedData.eceCertificate) {
      updateData.eceCertificate = validatedData.eceCertificate;
    }

    // Check if all required documents are now uploaded
    const updatedBabysitter = await db.babysitter.update({
      where: { id: babysitter.id },
      data: updateData
    });

    // Check if we should update status to DOCUMENTS_SUBMITTED
    const hasRequiredDocs =
      updatedBabysitter.governmentIdFront &&
      updatedBabysitter.governmentIdBack &&
      updatedBabysitter.policeCheck &&
      updatedBabysitter.selfieForMatch;

    if (hasRequiredDocs && updatedBabysitter.status === 'PENDING_VERIFICATION') {
      await db.babysitter.update({
        where: { id: babysitter.id },
        data: { status: 'DOCUMENTS_SUBMITTED' }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Documents uploaded successfully',
      hasRequiredDocs,
      nextStep: hasRequiredDocs ? 'references' : 'documents'
    });

  } catch (error) {
    console.error('Document upload error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to upload documents' },
      { status: 500 }
    );
  }
}

// GET - Get document status
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
      select: {
        governmentIdFront: true,
        governmentIdBack: true,
        policeCheck: true,
        selfieForMatch: true,
        cprCertificate: true,
        cprCertificateExpiry: true,
        eceCertificate: true,
        status: true,
      }
    });

    if (!babysitter) {
      return NextResponse.json(
        { error: 'Babysitter profile not found' },
        { status: 404 }
      );
    }

    const documents = {
      governmentIdFront: !!babysitter.governmentIdFront,
      governmentIdBack: !!babysitter.governmentIdBack,
      policeCheck: !!babysitter.policeCheck,
      selfieForMatch: !!babysitter.selfieForMatch,
      cprCertificate: !!babysitter.cprCertificate,
      cprCertificateExpiry: babysitter.cprCertificateExpiry,
      eceCertificate: !!babysitter.eceCertificate,
    };

    const requiredComplete =
      documents.governmentIdFront &&
      documents.governmentIdBack &&
      documents.policeCheck &&
      documents.selfieForMatch;

    return NextResponse.json({
      documents,
      requiredComplete,
      status: babysitter.status,
    });

  } catch (error) {
    console.error('Get documents error:', error);
    return NextResponse.json(
      { error: 'Failed to get document status' },
      { status: 500 }
    );
  }
}
