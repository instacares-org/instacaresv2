"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: Set<string>;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  sendMessage: (data: {
    roomId: string;
    content: string;
    senderId: string;
    messageType?: string;
  }) => void;
  onNewMessage: (callback: (data: any) => void) => () => void;
  onUserTyping: (callback: (data: any) => void) => () => void;
  onRoomStatusChanged: (callback: (data: any) => void) => () => void;
  startTyping: (roomId: string, userId: string, userName: string) => void;
  stopTyping: (roomId: string, userId: string) => void;
  markMessagesRead: (roomId: string, userId: string) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  onlineUsers: new Set(),
  joinRoom: () => {},
  leaveRoom: () => {},
  sendMessage: () => {},
  onNewMessage: () => () => {},
  onUserTyping: () => () => {},
  onRoomStatusChanged: () => () => {},
  startTyping: () => {},
  stopTyping: () => {},
  markMessagesRead: () => {},
});

interface SocketProviderProps {
  children: React.ReactNode;
  userId?: string;
  userType?: 'parent' | 'caregiver' | 'admin';
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ 
  children, 
  userId, 
  userType 
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Temporarily disable WebSocket connections to prevent errors
    // TODO: Set up proper Socket.IO server for real-time features
    console.log(`Socket.IO temporarily disabled for ${userType} ${userId}`);
    
    // For now, just simulate a connected state without actual WebSocket
    setIsConnected(false); // Set to false to indicate no real-time features
    setSocket(null);
    
    return () => {
      // Cleanup
      setSocket(null);
      setIsConnected(false);
    };
  }, [userId, userType]);

  const joinRoom = useCallback((roomId: string) => {
    if (socket && userId) {
      socket.emit('join_room', { roomId, userId });
    }
  }, [socket, userId]);

  const leaveRoom = useCallback((roomId: string) => {
    if (socket && userId) {
      socket.emit('leave_room', { roomId, userId });
    }
  }, [socket, userId]);

  const sendMessage = useCallback((data: {
    roomId: string;
    content: string;
    senderId: string;
    messageType?: string;
  }) => {
    if (socket) {
      socket.emit('send_message', {
        ...data,
        messageType: data.messageType || 'text'
      });
    }
  }, [socket]);

  const onNewMessage = useCallback((callback: (data: any) => void) => {
    if (!socket) return () => {};
    
    socket.on('new_message', callback);
    return () => {
      socket.off('new_message', callback);
    };
  }, [socket]);

  const onUserTyping = useCallback((callback: (data: any) => void) => {
    if (!socket) return () => {};
    
    socket.on('user_typing', callback);
    return () => {
      socket.off('user_typing', callback);
    };
  }, [socket]);

  const onRoomStatusChanged = useCallback((callback: (data: any) => void) => {
    if (!socket) return () => {};
    
    socket.on('room_status_changed', callback);
    return () => {
      socket.off('room_status_changed', callback);
    };
  }, [socket]);

  const startTyping = useCallback((roomId: string, userId: string, userName: string) => {
    if (socket) {
      socket.emit('typing_start', { roomId, userId, userName });
    }
  }, [socket]);

  const stopTyping = useCallback((roomId: string, userId: string) => {
    if (socket) {
      socket.emit('typing_stop', { roomId, userId });
    }
  }, [socket]);

  const markMessagesRead = useCallback((roomId: string, userId: string) => {
    if (socket) {
      socket.emit('mark_messages_read', { roomId, userId });
    }
  }, [socket]);

  const value: SocketContextType = {
    socket,
    isConnected,
    onlineUsers,
    joinRoom,
    leaveRoom,
    sendMessage,
    onNewMessage,
    onUserTyping,
    onRoomStatusChanged,
    startTyping,
    stopTyping,
    markMessagesRead,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export default SocketContext;