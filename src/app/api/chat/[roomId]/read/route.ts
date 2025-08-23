import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const { roomId } = await params;

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

    // Mark all unread messages in this room as read for this user
    await db.message.updateMany({
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark messages as read' },
      { status: 500 }
    );
  }
}