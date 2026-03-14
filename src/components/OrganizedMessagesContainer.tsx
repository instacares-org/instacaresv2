"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import EnhancedMessages from './EnhancedMessages';
import EnhancedChatInterface from './EnhancedChatInterface';
import { useAuth } from '@/contexts/AuthContext';
import { addCSRFHeaders } from '@/components/security/CSRFTokenProvider';
import { SocketProvider, useSocket } from '@/context/SocketContext';

interface OrganizedMessagesContainerProps {
  userId: string;
  userType: 'parent' | 'caregiver' | 'admin';
  onMessageRead?: (count: number) => void;
  onRefreshCount?: () => void;
  userAvatar?: string;
  userName?: string;
}

// Inner component that uses the socket hooks (must be inside SocketProvider)
function MessagesContainerInner({
  userId,
  userType,
  onMessageRead,
  onRefreshCount,
  userAvatar,
  userName
}: OrganizedMessagesContainerProps) {
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousRoomRef = useRef<string | null>(null);

  // Get socket functions
  const {
    socket,
    isConnected,
    joinRoom,
    leaveRoom,
    sendMessage: socketSendMessage,
    onNewMessage,
    onUserTyping,
    onUnreadCountUpdate,
    startTyping,
    stopTyping,
    markMessagesRead
  } = useSocket();

  // Fetch chat rooms (with optional silent mode to avoid loading spinner)
  const fetchRooms = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      const response = await fetch(`/api/chat/rooms?userId=${userId}&userType=${userType}`);

      if (response.ok) {
        const result = await response.json();
        setRooms(Array.isArray(result) ? result : (result.success ? result.data : []));
      } else {
        console.error('Failed to fetch rooms');
        if (!silent) setRooms([]);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
      if (!silent) {
        setError('Failed to load conversations');
        setRooms([]);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [userId, userType]);

  // Fetch messages for a room
  const fetchMessages = useCallback(async (roomId: string) => {
    try {
      const response = await fetch(`/api/chat/${roomId}/messages?userId=${userId}`);

      if (response.ok) {
        const result = await response.json();
        // Handle both apiSuccess format { success, data: { messages } } and legacy { messages }
        const msgs = result.data?.messages || result.messages || [];
        setMessages(msgs);
        setError(null);
      } else {
        const errorData = await response.text();
        console.error('Failed to fetch messages:', { status: response.status, error: errorData });

        if (response.status === 404) {
          setError('This conversation is not available or you do not have access to it.');
        } else {
          setError('Failed to load messages. Please try again.');
        }
        setMessages([]);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError('Connection error. Please check your internet connection and try again.');
      setMessages([]);
    }
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Handle room selection and socket room join/leave
  useEffect(() => {
    if (selectedRoom) {
      // Leave previous room
      if (previousRoomRef.current && previousRoomRef.current !== selectedRoom) {
        leaveRoom(previousRoomRef.current);
      }

      // Join new room
      joinRoom(selectedRoom);
      previousRoomRef.current = selectedRoom;

      // Fetch messages
      fetchMessages(selectedRoom);
    }
  }, [selectedRoom, joinRoom, leaveRoom, fetchMessages]);

  // Listen for new messages
  useEffect(() => {
    const unsubscribe = onNewMessage((data: any) => {
      console.log('[Messages] New message received:', data);

      // If message is for the currently selected room, add it
      if (data.roomId === selectedRoom) {
        setMessages(prev => {
          // Avoid duplicates
          const exists = prev.some(m => m.id === data.message.id);
          if (exists) return prev;
          return [...prev, data.message];
        });

        // Mark as read since we're viewing this room
        markMessagesRead(selectedRoom!, userId);
      }

      // Silently refresh rooms list to update last message preview (no loading spinner)
      fetchRooms(true);
    });

    return unsubscribe;
  }, [selectedRoom, onNewMessage, fetchRooms, markMessagesRead, userId]);

  // Listen for typing indicators
  useEffect(() => {
    const unsubscribe = onUserTyping((data: any) => {
      if (data.userId !== userId) {
        setIsTyping(data.isTyping);
        setTypingUser(data.isTyping ? data.userName : null);

        // Auto-clear typing indicator after 3 seconds
        if (data.isTyping) {
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
          typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
            setTypingUser(null);
          }, 3000);
        }
      }
    });

    return () => {
      unsubscribe();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [onUserTyping, userId]);

  // Listen for unread count updates (messages arriving in other rooms)
  useEffect(() => {
    const unsubscribe = onUnreadCountUpdate((data: any) => {
      console.log('[Messages] Unread count update:', data);
      // Refresh rooms list to show new message badge
      fetchRooms(true);
    });

    return unsubscribe;
  }, [onUnreadCountUpdate, fetchRooms]);

  // Polling fallback: refresh rooms every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRooms(true); // silent refresh
    }, 15000);

    return () => clearInterval(interval);
  }, [fetchRooms]);

  // Polling fallback: refresh active room messages every 8 seconds
  useEffect(() => {
    if (!selectedRoom) return;

    const interval = setInterval(() => {
      fetchMessages(selectedRoom);
    }, 8000);

    return () => clearInterval(interval);
  }, [selectedRoom, fetchMessages]);

  // Handle sending messages
  const handleSendMessage = useCallback(async (content: string) => {
    if (!selectedRoom || !content.trim()) return;

    // Stop typing indicator
    stopTyping(selectedRoom, userId);

    // Send via WebSocket if connected
    if (isConnected && socket) {
      socketSendMessage({
        roomId: selectedRoom,
        content: content.trim(),
        senderId: userId,
        messageType: 'TEXT'
      });
    } else {
      // Fallback to HTTP
      try {
        const response = await fetch(`/api/chat/${selectedRoom}/messages`, {
          method: 'POST',
          headers: addCSRFHeaders({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            content: content.trim(),
            senderId: userId,
            messageType: 'TEXT'
          }),
        });

        if (response.ok) {
          const result = await response.json();
          // Handle both apiSuccess format { success, data: {...} } and legacy {...}
          const newMessage = result.data || result;
          if (newMessage.id) {
            setMessages(prev => [...prev, newMessage]);
            fetchRooms(true); // Silent refresh
            if (onRefreshCount) {
              onRefreshCount();
            }
          }
        } else {
          console.error('Failed to send message');
        }
      } catch (error) {
        console.error('Error sending message:', error);
      }
    }
  }, [selectedRoom, isConnected, socket, socketSendMessage, userId, stopTyping, fetchRooms, onRefreshCount]);

  // Handle room selection
  const handleRoomSelect = useCallback((roomId: string) => {
    setSelectedRoom(roomId);

    // Mark messages as read
    const currentRoom = rooms.find((room: any) => room.id === roomId);
    const unreadCount = currentRoom?.unreadCount || 0;

    // Mark via socket
    markMessagesRead(roomId, userId);

    // Also mark via API
    fetch(`/api/chat/${roomId}/read?userId=${userId}`, {
      method: 'POST',
    }).then(() => {
      fetchRooms(true); // Silent refresh
      if (unreadCount > 0 && onMessageRead) {
        onMessageRead(unreadCount);
      }
    }).catch(err => {
      console.error('Error marking messages as read:', err);
    });
  }, [rooms, userId, markMessagesRead, fetchRooms, onMessageRead]);

  // Handle typing
  const handleTyping = useCallback(() => {
    if (selectedRoom && isConnected) {
      startTyping(selectedRoom, userId, userName || 'User');
    }
  }, [selectedRoom, isConnected, startTyping, userId, userName]);

  const selectedRoomData = rooms.find((room: any) => room.id === selectedRoom);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 dark:border-blue-400 border-t-transparent"></div>
      </div>
    );
  }

  if (error && !rooms.length) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center p-6">
          <div className="text-red-500 dark:text-red-400 mb-2">Warning</div>
          <p className="text-red-600 dark:text-red-400 mb-2">{error}</p>
          <button
            onClick={() => fetchRooms()}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!loading && rooms.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center p-6">
          <div className="text-gray-400 mb-4 text-4xl">Chat</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No conversations yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            When you book a caregiver or receive a booking request, your conversations will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden">
      {/* Messages List */}
      <div className="w-1/3 min-w-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <EnhancedMessages
          userId={userId}
          userType={userType}
          rooms={rooms}
          onRoomSelect={handleRoomSelect}
          selectedRoom={selectedRoom ?? undefined}
          userAvatar={userAvatar}
          userName={userName}
        />
      </div>

      {/* Chat Interface */}
      <div className="flex-1 min-w-0 bg-white dark:bg-gray-800 overflow-hidden">
        <EnhancedChatInterface
          room={selectedRoomData}
          messages={messages}
          onSendMessage={handleSendMessage}
          userType={userType}
          userId={userId}
          isTyping={isTyping}
          typingUser={typingUser || undefined}
          onTyping={handleTyping}
        />
      </div>
    </div>
  );
}

// Main component that wraps with SocketProvider
export default function OrganizedMessagesContainer(props: OrganizedMessagesContainerProps) {
  return (
    <SocketProvider userId={props.userId} userType={props.userType}>
      <MessagesContainerInner {...props} />
    </SocketProvider>
  );
}
