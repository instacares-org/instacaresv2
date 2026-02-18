/**
 * Invoice Download API
 * Generates and downloads invoice PDFs for bookings
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/database';
import { createInvoiceData, generateInvoiceHTML } from '@/lib/notifications/invoice.service';
import { generatePdfFromHtml } from '@/lib/notifications/pdf.service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    // --- AUTHENTICATION ---
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { bookingId } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'parent' | 'caregiver' || 'parent';

    // Validate type
    if (!['parent', 'caregiver'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid invoice type. Must be "parent" or "caregiver"' },
        { status: 400 }
      );
    }

    // Fetch booking with related data
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        parent: {
          include: { profile: true },
        },
        caregiverUser: {
          include: { profile: true },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // --- AUTHORIZATION: Only parent, caregiver, or admin can download ---
    const isParent = booking.parentId === session.user.id;
    const isCaregiver = booking.caregiverId === session.user.id;
    const adminUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { userType: true }
    });
    const isAdmin = adminUser?.userType === 'ADMIN';

    if (!isParent && !isCaregiver && !isAdmin) {
      return NextResponse.json(
        { error: 'You do not have permission to download this invoice' },
        { status: 403 }
      );
    }

    // Calculate duration from DateTime fields
    const startDateTime = new Date(booking.startTime);
    const endDateTime = new Date(booking.endTime);
    const durationMs = endDateTime.getTime() - startDateTime.getTime();
    const duration = durationMs / (1000 * 60 * 60); // Convert to hours

    // Format times
    const startTimeStr = startDateTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    const endTimeStr = endDateTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    // Format names
    const parentName = booking.parent?.profile
      ? `${booking.parent.profile.firstName || ''} ${booking.parent.profile.lastName || ''}`.trim()
      : 'Parent';
    const caregiverName = booking.caregiverUser?.profile
      ? `${booking.caregiverUser.profile.firstName || ''} ${booking.caregiverUser.profile.lastName || ''}`.trim()
      : 'Caregiver';

    // Format date from startTime
    const bookingDate = startDateTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Create invoice data
    // Note: totalAmount and platformFee are already stored in cents in the database
    const invoiceData = createInvoiceData(type, {
      id: booking.id,
      parentName,
      caregiverName,
      date: bookingDate,
      startTime: startTimeStr,
      endTime: endTimeStr,
      duration,
      childrenCount: booking.childrenCount || 1,
      totalAmount: Number(booking.totalAmount), // Already in cents
      platformFee: Number(booking.platformFee || 0), // Already in cents
    });

    // Generate HTML
    const invoiceHtml = generateInvoiceHTML(invoiceData);

    // Try to generate PDF
    try {
      const pdfBuffer = await generatePdfFromHtml(invoiceHtml);

      const filename = type === 'parent'
        ? `InstaCares_Invoice_${bookingId.substring(0, 8)}.pdf`
        : `InstaCares_Payout_Statement_${bookingId.substring(0, 8)}.pdf`;

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': pdfBuffer.length.toString(),
        },
      });
    } catch (pdfError) {
      console.error('PDF generation failed, returning HTML:', pdfError);

      // Fallback to HTML download if PDF generation fails
      const filename = type === 'parent'
        ? `InstaCares_Invoice_${bookingId.substring(0, 8)}.html`
        : `InstaCares_Payout_Statement_${bookingId.substring(0, 8)}.html`;

      return new NextResponse(invoiceHtml, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }
  } catch (error) {
    console.error('Invoice download error:', error);
    return NextResponse.json(
      { error: 'Failed to generate invoice' },
      { status: 500 }
    );
  }
}
