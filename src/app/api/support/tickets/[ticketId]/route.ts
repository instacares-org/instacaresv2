import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// GET - Get single ticket with all responses
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

    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            userType: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                avatar: true,
                phone: true
              }
            }
          }
        },
        booking: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            status: true,
            totalAmount: true,
            parent: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            caregiverUser: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        responses: {
          orderBy: { createdAt: 'asc' },
          where: isAdmin ? {} : { isInternal: false }
        },
        cancellation: true
      }
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Non-admins can only view their own tickets
    if (!isAdmin && ticket.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: ticket
    });
  } catch (error) {
    logger.error('Error fetching ticket:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ticket' },
      { status: 500 }
    );
  }
}

// PATCH - Update ticket (admin only for most fields, user can add info)
export async function PATCH(
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

    // Get user to check if admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { userType: true }
    });

    const isAdmin = user?.userType === 'ADMIN';

    // Get existing ticket
    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId }
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Non-admins can only update their own tickets and only certain fields
    if (!isAdmin && ticket.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const updateData: any = {};

    // Admin-only fields
    if (isAdmin) {
      if (body.status) updateData.status = body.status;
      if (body.priority) updateData.priority = body.priority;
      if (body.assignedTo !== undefined) updateData.assignedTo = body.assignedTo;
      if (body.resolution) {
        updateData.resolution = body.resolution;
        updateData.resolvedAt = new Date();
        updateData.status = 'RESOLVED';
      }
    }

    // User can update description/attachments if ticket is still open
    if (!isAdmin && ticket.status === 'OPEN') {
      if (body.description) updateData.description = body.description;
      if (body.attachments) updateData.attachments = body.attachments;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const updatedTicket = await db.supportTicket.update({
      where: { id: ticketId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        responses: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    logger.info(`Ticket ${ticket.ticketNumber} updated by ${session.user.id}`);

    return NextResponse.json({
      success: true,
      data: updatedTicket
    });
  } catch (error) {
    logger.error('Error updating ticket:', error);
    return NextResponse.json(
      { error: 'Failed to update ticket' },
      { status: 500 }
    );
  }
}
