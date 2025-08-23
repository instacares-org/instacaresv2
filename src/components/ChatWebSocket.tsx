"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  PaperAirplaneIcon, 
  ChatBubbleLeftRightIcon,
  WifiIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { SocketProvider, useSocket } from '@/context/SocketContext';
import { useChatWebSocket } from '@/hooks/useChatWebSocket';
import { useNotifications } from '@/lib/notifications';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { useNotificationStorage } from '@/hooks/useNotificationStorage';

interface ChatWebSocketProps {
  userId: string;
  userType: 'parent' | 'caregiver' | 'admin';
}

const ChatContent: React.FC<ChatWebSocketProps> = ({ userId, userType }) => {
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [lastMessageCount, setLastMessageCount] = useState<{[roomId: string]: number}>({});

  const { isConnected } = useSocket();
  const { showMessage } = useNotifications(userId);
  const { settings } = useNotificationContext();
  const { refreshNotifications } = useNotificationStorage();
  const {
    rooms,
    messages,
    loading,
    error,
    typingUsers,
    activeRoom,
    sendMessage,
    joinChatRoom,
    leaveChatRoom,
    handleStartTyping,
    handleStopTyping,
    clearError
  } = useChatWebSocket({ userId, userType });
  
  // Create stable references to prevent infinite loops
  const roomsRef = useRef(rooms);
  const showMessageRef = useRef(showMessage);
  roomsRef.current = rooms;
  showMessageRef.current = showMessage;

  // Scroll to bottom when new messages arrive and check for new messages to notify
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    
    // Check for new messages and show notifications
    Object.keys(messages).forEach(roomId => {
      const roomMessages = messages[roomId];
      const previousCount = lastMessageCount[roomId] || 0;
      const currentCount = roomMessages.length;
      
      // If we have more messages than before and notifications are enabled
      if (currentCount > previousCount && settings.messages && roomId !== selectedRoom) {
        const newMessages = roomMessages.slice(previousCount);
        
        // Show notification for each new message from others
        newMessages.forEach(message => {
          const isFromCurrentUser = message.sender?.id === userId || message.senderId === userId;
          if (!isFromCurrentUser) {
            const room = roomsRef.current.find(r => r.id === roomId);
            const senderName = message.senderName || room?.otherUser?.name || 'Someone';
            const senderAvatar = message.senderAvatar || room?.otherUser?.avatar;
            
            showMessageRef.current(senderName, message.content, senderAvatar, roomId);
          }
        });
      }
      
      // Update message count
      setLastMessageCount(prev => ({ ...prev, [roomId]: currentCount }));
    });
  }, [messages, selectedRoom, settings.messages, userId]); // Removed unstable dependencies

  // Handle room selection
  const handleRoomSelect = (roomId: string) => {
    if (selectedRoom) {
      leaveChatRoom(selectedRoom);
    }
    setSelectedRoom(roomId);
    joinChatRoom(roomId);
  };

  // Handle message sending
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedRoom) return;

    await sendMessage(selectedRoom, messageInput);
    setMessageInput('');
    
    // Stop typing indicator
    if (isTyping) {
      handleStopTyping(selectedRoom);
      setIsTyping(false);
    }
    
    // Refresh notifications to update badge counters
    setTimeout(() => {
      refreshNotifications();
    }, 1000); // Small delay to allow API to complete
  };

  // Handle typing indicators
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    
    if (selectedRoom) {
      if (!isTyping) {
        const userName = userType === 'parent' ? 'Parent' : 'Caregiver';
        handleStartTyping(selectedRoom, userName);
        setIsTyping(true);
      }
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set new timeout to stop typing
      typingTimeoutRef.current = setTimeout(() => {
        if (selectedRoom) {
          handleStopTyping(selectedRoom);
        }
        setIsTyping(false);
      }, 2000);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm border">
      {/* Connection Status */}
      <div className="p-4 border-b bg-gray-50 rounded-t-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <ChatBubbleLeftRightIcon className="h-5 w-5 mr-2" />
            Messages
          </h3>
          <div className="flex items-center space-x-2">
            <div className={`flex items-center text-sm ${isConnected ? 'text-green-600' : 'text-blue-600'}`}>
              {isConnected ? (
                <>
                  <CheckCircleIcon className="h-4 w-4 mr-1" />
                  Real-time
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-4 w-4 mr-1" />
                  Standard
                </>
              )}
            </div>
            <WifiIcon className={`h-4 w-4 ${isConnected ? 'text-green-500' : 'text-gray-400'}`} />
          </div>
        </div>
        
        {error && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-center justify-between">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
              {error}
            </div>
            <button onClick={clearError} className="text-red-600 hover:text-red-800">
              <XCircleIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="flex h-96">
        {/* Chat Rooms List */}
        <div className="w-1/3 border-r">
          <div className="p-4 border-b bg-gray-50">
            <h4 className="font-medium text-gray-900">Conversations</h4>
          </div>
          <div className="overflow-y-auto h-full">
            {rooms.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <ChatBubbleLeftRightIcon className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p>No conversations yet</p>
              </div>
            ) : (
              rooms.map((room) => {
                // Handle both API response formats
                const otherUser = room.otherUser || (userType === 'parent' 
                  ? room.booking?.caregiver 
                  : room.booking?.parent);
                const otherUserName = room.otherUser?.name || 
                  `${otherUser?.profile?.firstName || ''} ${otherUser?.profile?.lastName || ''}`.trim() || 
                  'Unknown User';
                const messageCount = room.unreadCount ?? room._count?.messages ?? 0;
                
                
                return (
                  <div
                    key={room.id}
                    onClick={() => handleRoomSelect(room.id)}
                    className={`p-4 border-b cursor-pointer transition hover:bg-gray-50 ${
                      selectedRoom === room.id ? 'bg-blue-50 border-blue-200' : ''
                    } ${room.isActive === false ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                          {otherUser?.avatar || room.otherUser?.avatar ? (
                            <img
                              src={otherUser?.avatar || room.otherUser?.avatar}
                              alt={otherUserName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-medium text-gray-600">
                              {otherUserName.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                            </span>
                          )}
                        </div>
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900">{otherUserName || 'Unknown User'}</h5>
                          <p className="text-sm text-gray-500">
                            {messageCount} message{messageCount !== 1 ? 's' : ''}
                            {room.isActive === false && ' • Disabled'}
                          </p>
                        </div>
                      </div>
                      {(room.lastMessageAt || room.lastMessage?.createdAt) && (
                        <span className="text-xs text-gray-400">
                          {formatDate(room.lastMessageAt || room.lastMessage?.createdAt || '')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 flex flex-col">
          {selectedRoom ? (
            <>
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages[selectedRoom]?.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <ChatBubbleLeftRightIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages[selectedRoom]?.map((message) => {
                    // Handle both API response format and WebSocket format
                    const senderId = message.sender?.id || message.senderId;
                    const isFromCurrentUser = senderId === userId;
                    const senderAvatar = message.senderAvatar || message.sender?.profile?.avatar;
                    
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isFromCurrentUser ? 'justify-end' : 'justify-start'} items-end space-x-2`}
                      >
                        {!isFromCurrentUser && (
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                            {senderAvatar ? (
                              <img
                                src={senderAvatar}
                                alt="Avatar"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-xs font-medium text-gray-600">?</span>
                            )}
                          </div>
                        )}
                        
                        <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          isFromCurrentUser
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}>
                          <p className="text-sm">{message.content}</p>
                          <p className={`text-xs mt-1 ${
                            isFromCurrentUser ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            {formatDate(message.createdAt)}
                          </p>
                        </div>

                        {isFromCurrentUser && (
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                            {senderAvatar ? (
                              <img
                                src={senderAvatar}
                                alt="Avatar"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-xs font-medium text-blue-600">You</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                {/* Typing indicators */}
                {typingUsers[selectedRoom]?.length > 0 && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 px-4 py-2 rounded-lg">
                      <div className="flex items-center space-x-1">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                        <span className="text-xs text-gray-500 ml-2">
                          {typingUsers[selectedRoom].join(', ')} typing...
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="border-t p-4">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={rooms.find(r => r.id === selectedRoom)?.isActive === false}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim() || (rooms.find(r => r.id === selectedRoom)?.isActive === false)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                  >
                    <PaperAirplaneIcon className="h-5 w-5" />
                  </button>
                </div>
                {(rooms.find(r => r.id === selectedRoom)?.isActive === false) && (
                  <p className="text-xs text-gray-500 mt-1">
                    Chat is disabled
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <ChatBubbleLeftRightIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>Select a conversation to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ChatWebSocket: React.FC<ChatWebSocketProps> = ({ userId, userType }) => {
  return (
    <SocketProvider userId={userId} userType={userType}>
      <ChatContent userId={userId} userType={userType} />
    </SocketProvider>
  );
};

export default ChatWebSocket;