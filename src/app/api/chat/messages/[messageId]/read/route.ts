import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const { messageId } = await params;

    // Get the message to verify user can mark it as read
    const message = await db.message.findUnique({
      where: { id: messageId },
      include: {
        chatRoom: true,
      },
    });

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Verify user is the recipient (not the sender)
    const isRecipient = 
      (message.chatRoom.parentId === userId && message.senderId !== userId) ||
      (message.chatRoom.caregiverId === userId && message.senderId !== userId);

    if (!isRecipient) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Mark message as read
    const updatedMessage = await db.message.update({
      where: { id: messageId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Message marked as read',
      readAt: updatedMessage.readAt,
    });
  } catch (error) {
    console.error('Error marking message as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark message as read' },
      { status: 500 }
    );
  }
}

// Mark all messages in a room as read
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const body = await request.json();
    const { userId, roomId } = body;

    if (!userId || !roomId) {
      return NextResponse.json({ error: 'User ID and room ID are required' }, { status: 400 });
    }

    // Verify user has access to this chat room
    const chatRoom = await db.chatRoom.findFirst({
      where: {
        id: roomId,
        OR: [
          { parentId: userId },
          { caregiverId: userId },
        ],
      },
    });

    if (!chatRoom) {
      return NextResponse.json({ error: 'Chat room not found or access denied' }, { status: 404 });
    }

    // Mark all unread messages from the other user as read
    const result = await db.message.updateMany({
      where: {
        chatRoomId: roomId,
        senderId: { not: userId },
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `${result.count} messages marked as read`,
      updatedCount: result.count,
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark messages as read' },
      { status: 500 }
    );
  }
}