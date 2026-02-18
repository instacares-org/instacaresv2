import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// POST - Add a response to a ticket
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ticketId } = await params;
    const body = await request.json();
    const { message, isInternal, attachments } = body;

    if (!message || message.trim() === '') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Get user to check if admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { userType: true }
    });

    const isAdmin = user?.userType === 'ADMIN';

    // Get ticket
    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId }
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Non-admins can only respond to their own tickets
    if (!isAdmin && ticket.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Only admins can create internal notes
    const internal = isAdmin && isInternal === true;

    // Create response and update ticket status
    const [response, updatedTicket] = await db.$transaction([
      db.ticketResponse.create({
        data: {
          ticketId,
          responderId: session.user.id,
          message: message.trim(),
          isInternal: internal,
          attachments: attachments || null
        }
      }),
      db.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: isAdmin ? 'AWAITING_USER' : 'AWAITING_ADMIN',
          updatedAt: new Date()
        }
      })
    ]);

    logger.info(`Response added to ticket ${ticket.ticketNumber} by ${session.user.id}`);

    return NextResponse.json({
      success: true,
      data: response
    });
  } catch (error) {
    logger.error('Error adding ticket response:', error);
    return NextResponse.json(
      { error: 'Failed to add response' },
      { status: 500 }
    );
  }
}

// GET - Get all responses for a ticket
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ticketId } = await params;

    // Get user to check if admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { userType: true }
    });

    const isAdmin = user?.userType === 'ADMIN';

    // Get ticket to verify access
    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId }
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Non-admins can only view their own tickets
    if (!isAdmin && ticket.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const responses = await db.ticketResponse.findMany({
      where: {
        ticketId,
        // Non-admins don't see internal notes
        ...(isAdmin ? {} : { isInternal: false })
      },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json({
      success: true,
      data: responses
    });
  } catch (error) {
    logger.error('Error fetching ticket responses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch responses' },
      { status: 500 }
    );
  }
}
