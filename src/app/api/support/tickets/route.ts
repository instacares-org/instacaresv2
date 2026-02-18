import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// Generate ticket number
function generateTicketNumber(): string {
  const prefix = 'TKT';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// GET - List tickets for user or all tickets for admin
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Get user to check if admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { userType: true }
    });

    const isAdmin = user?.userType === 'ADMIN';

    // Build where clause
    const where: any = {};

    // Non-admins can only see their own tickets
    if (!isAdmin) {
      where.userId = session.user.id;
    }

    if (status) {
      where.status = status;
    }

    if (category) {
      where.category = category;
    }

    const [tickets, total] = await Promise.all([
      db.supportTicket.findMany({
        where,
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
                  avatar: true
                }
              }
            }
          },
          booking: {
            select: {
              id: true,
              startTime: true,
              endTime: true,
              status: true
            }
          },
          responses: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ],
        skip: (page - 1) * limit,
        take: limit
      }),
      db.supportTicket.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      data: {
        tickets,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching support tickets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tickets' },
      { status: 500 }
    );
  }
}

// POST - Create a new support ticket
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { category, subject, description, bookingId, priority, attachments } = body;

    // Validate required fields
    if (!category || !subject || !description) {
      return NextResponse.json(
        { error: 'Category, subject, and description are required' },
        { status: 400 }
      );
    }

    // Get user type
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { userType: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If bookingId provided, verify it belongs to the user
    if (bookingId) {
      const booking = await db.booking.findFirst({
        where: {
          id: bookingId,
          OR: [
            { parentId: session.user.id },
            { caregiverId: session.user.id }
          ]
        }
      });

      if (!booking) {
        return NextResponse.json(
          { error: 'Booking not found or not authorized' },
          { status: 404 }
        );
      }
    }

    // Create ticket
    const ticket = await db.supportTicket.create({
      data: {
        ticketNumber: generateTicketNumber(),
        userId: session.user.id,
        userType: user.userType,
        category,
        subject,
        description,
        bookingId: bookingId || null,
        priority: priority || 'NORMAL',
        attachments: attachments || null,
        status: 'OPEN'
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        booking: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            status: true
          }
        }
      }
    });

    logger.info(`Support ticket created: ${ticket.ticketNumber} by user ${session.user.id}`);

    return NextResponse.json({
      success: true,
      data: ticket,
      message: `Ticket ${ticket.ticketNumber} created successfully`
    });
  } catch (error) {
    logger.error('Error creating support ticket:', error);
    return NextResponse.json(
      { error: 'Failed to create ticket' },
      { status: 500 }
    );
  }
}
