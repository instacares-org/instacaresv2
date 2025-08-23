import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Get detailed chat room info for admin
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const adminUserId = searchParams.get('adminUserId');

    if (!adminUserId) {
      return NextResponse.json({ error: 'Admin authentication required' }, { status: 401 });
    }

    // Verify admin user
    const adminUser = await db.user.findFirst({
      where: { id: adminUserId, userType: 'ADMIN' }
    });

    if (!adminUser) {
      return NextResponse.json({ error: 'Admin access denied' }, { status: 403 });
    }

    const { roomId } = await params;

    // Get detailed chat room information
    console.log('🔍 Fetching chat room:', roomId);
    
    const chatRoom = await db.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        booking: true,
        messages: {
          include: {
            sender: { include: { profile: true } }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!chatRoom) {
      console.log('❌ Chat room not found');
      return NextResponse.json({ error: 'Chat room not found' }, { status: 404 });
    }

    console.log('✅ Chat room found, fetching participants...');
    
    // Fetch parent and caregiver separately
    const [parent, caregiver] = await Promise.all([
      db.user.findUnique({
        where: { id: chatRoom.booking.parentId },
        include: { profile: true }
      }),
      db.user.findUnique({
        where: { id: chatRoom.booking.caregiverId },
        include: { profile: true }
      })
    ]);


    if (!parent || !caregiver) {
      console.log('❌ Missing participants:', { parent: !!parent, caregiver: !!caregiver });
      return NextResponse.json({ error: 'Participants not found' }, { status: 404 });
    }

    console.log('✅ All data fetched, formatting response...');

    // Format for admin view
    const adminView = {
      id: chatRoom.id,
      booking: {
        id: chatRoom.booking.id,
        status: chatRoom.booking.status,
        startTime: chatRoom.booking.startTime,
        endTime: chatRoom.booking.endTime,
        totalAmount: chatRoom.booking.totalAmount,
        address: chatRoom.booking.address
      },
      participants: {
        parent: {
          id: parent.id,
          name: `${parent.profile?.firstName} ${parent.profile?.lastName}`,
          email: parent.email,
          phone: parent.profile?.phone
        },
        caregiver: {
          id: caregiver.id,
          name: `${caregiver.profile?.firstName} ${caregiver.profile?.lastName}`,
          email: caregiver.email,
          phone: caregiver.profile?.phone
        }
      },
      chatMetadata: {
        isActive: chatRoom.isActive,
        createdAt: chatRoom.createdAt,
        lastMessageAt: chatRoom.lastMessageAt,
        messageCount: chatRoom.messages.length
      },
      messages: chatRoom.messages.map(message => ({
        id: message.id,
        content: message.content,
        messageType: message.messageType,
        sender: {
          id: message.sender.id,
          name: `${message.sender.profile?.firstName} ${message.sender.profile?.lastName}`,
          userType: message.sender.userType
        },
        createdAt: message.createdAt,
        isRead: message.isRead
      }))
    };

    return NextResponse.json(adminView);
  } catch (error) {
    console.error('Error fetching admin chat details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat details' },
      { status: 500 }
    );
  }
}

// Admin actions on chat room
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const adminUserId = searchParams.get('adminUserId');
    const body = await request.json();

    if (!adminUserId) {
      return NextResponse.json({ error: 'Admin authentication required' }, { status: 401 });
    }

    // Verify admin user
    const adminUser = await db.user.findFirst({
      where: { id: adminUserId, userType: 'ADMIN' }
    });

    if (!adminUser) {
      return NextResponse.json({ error: 'Admin access denied' }, { status: 403 });
    }

    const { roomId } = await params;
    const { action, reason } = body;

    switch (action) {
      case 'disable':
        await db.chatRoom.update({
          where: { id: roomId },
          data: { isActive: false }
        });
        
        // Create audit log
        await db.notification.create({
          data: {
            userId: adminUserId,
            type: 'admin_action',
            title: 'Chat Room Disabled',
            message: `Chat room ${roomId} disabled by admin. Reason: ${reason || 'No reason provided'}`,
            resourceType: 'chat',
            resourceId: roomId
          }
        });
        break;

      case 'enable':
        await db.chatRoom.update({
          where: { id: roomId },
          data: { isActive: true }
        });
        
        await db.notification.create({
          data: {
            userId: adminUserId,
            type: 'admin_action',
            title: 'Chat Room Enabled',
            message: `Chat room ${roomId} enabled by admin. Reason: ${reason || 'No reason provided'}`,
            resourceType: 'chat',
            resourceId: roomId
          }
        });
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true, action, roomId });
  } catch (error) {
    console.error('Error performing admin action:', error);
    return NextResponse.json(
      { error: 'Failed to perform admin action' },
      { status: 500 }
    );
  }
}