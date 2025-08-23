"use client";

import React, { useState, useEffect } from 'react';
import EnhancedMessages from './EnhancedMessages';
import EnhancedChatInterface from './EnhancedChatInterface';
import { useAuth } from '@/contexts/AuthContext';

interface OrganizedMessagesContainerProps {
  userId: string;
  userType: 'parent' | 'caregiver' | 'admin';
  onMessageRead?: (count: number) => void;
  onRefreshCount?: () => void;
}

export default function OrganizedMessagesContainer({ 
  userId, 
  userType,
  onMessageRead,
  onRefreshCount
}: OrganizedMessagesContainerProps) {
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch chat rooms
  useEffect(() => {
    fetchRooms();
  }, [userId, userType]);

  // Fetch messages when room is selected
  useEffect(() => {
    if (selectedRoom) {
      fetchMessages(selectedRoom);
    }
  }, [selectedRoom]);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/chat/rooms?userId=${userId}&userType=${userType}`);
      
      if (response.ok) {
        const result = await response.json();
        // Handle direct array response from chat rooms API
        setRooms(Array.isArray(result) ? result : (result.success ? result.data : []));
      } else {
        console.error('Failed to fetch rooms');
        setRooms([]);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
      setError('Failed to load conversations');
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (roomId: string) => {
    try {
      const response = await fetch(`/api/chat/${roomId}/messages?userId=${userId}`);
      
      if (response.ok) {
        const result = await response.json();
        // Handle the messages API response format
        setMessages(result.messages || []);
      } else {
        const errorData = await response.text();
        console.error('Failed to fetch messages:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          roomId,
          userId
        });
        setMessages([]);
      }
    } catch (error) {
      console.error('Error fetching messages:', {
        error,
        roomId,
        userId,
        url: `/api/chat/${roomId}/messages?userId=${userId}`
      });
      setMessages([]);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedRoom) return;

    try {
      const response = await fetch(`/api/chat/${selectedRoom}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          senderId: userId,
          messageType: 'TEXT'
        }),
      });

      if (response.ok) {
        const result = await response.json();
        // Handle direct message response from API
        if (result.id) {
          // Add the new message to the list
          setMessages(prev => [...prev, result]);
          // Refresh rooms to update last message and unread counts
          fetchRooms();
          // Refresh count in parent dashboard
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
  };

  const handleRoomSelect = (roomId: string) => {
    setSelectedRoom(roomId);
    // Mark messages as read when room is selected
    markMessagesAsRead(roomId);
  };

  const markMessagesAsRead = async (roomId: string) => {
    try {
      // Get current unread count for this room before marking as read
      const currentRoom = rooms.find((room: any) => room.id === roomId);
      const unreadCount = currentRoom?.unreadCount || 0;

      await fetch(`/api/chat/${roomId}/read?userId=${userId}`, {
        method: 'POST',
      });
      
      // Refresh rooms to update unread counts
      fetchRooms();
      
      // Call callback to decrement unread count in parent component
      if (unreadCount > 0 && onMessageRead) {
        onMessageRead(unreadCount);
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const selectedRoomData = rooms.find((room: any) => room.id === selectedRoom);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 dark:border-blue-400 border-t-transparent"></div>
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
          selectedRoom={selectedRoom}
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
        />
      </div>
    </div>
  );
}