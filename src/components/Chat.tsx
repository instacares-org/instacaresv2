"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useChat, ChatRoom, ChatMessage } from '../hooks/useChat';
import { 
  PaperAirplaneIcon, 
  ChatBubbleLeftRightIcon,
  UserCircleIcon,
  ClockIcon,
  CheckIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { CheckIcon as CheckSolidIcon } from '@heroicons/react/24/solid';

interface ChatProps {
  userId: string;
  userType: 'parent' | 'caregiver';
}

const Chat: React.FC<ChatProps> = ({ userId, userType }) => {
  const {
    rooms,
    loadingRooms,
    messages,
    loadingMessages,
    sendMessage,
    markAllMessagesAsRead,
    fetchMessages,
    activeRoomId,
    setActiveRoomId,
    sendingMessage,
  } = useChat(userId, userType);

  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle room selection
  const handleRoomSelect = async (room: ChatRoom) => {
    console.log('🔍 Selected room:', room);
    console.log('🖼️ Other user avatar:', room.otherUser.avatar);
    setActiveRoomId(room.id);
    await fetchMessages(room.id);
    
    // Mark messages as read
    if (room.unreadCount > 0) {
      await markAllMessagesAsRead(room.id);
    }
  };

  // Handle sending message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeRoomId || sendingMessage) return;

    const content = messageInput;
    setMessageInput('');
    
    try {
      const result = await sendMessage(activeRoomId, content);
      if (!result) {
        // Restore message input if sending failed
        setMessageInput(content);
        console.error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Restore message input on error
      setMessageInput(content);
    }
  };

  // Format time
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(date));
  };

  // Format date
  const formatDate = (date: Date) => {
    const today = new Date();
    const messageDate = new Date(date);
    
    if (messageDate.toDateString() === today.toDateString()) {
      return 'Today';
    }
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    return messageDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (loadingRooms) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border h-[600px] flex">
      {/* Chat Rooms List */}
      <div className="w-1/3 border-r flex flex-col">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-900 flex items-center">
            <ChatBubbleLeftRightIcon className="h-5 w-5 mr-2" />
            Messages
          </h3>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {rooms.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <ChatBubbleLeftRightIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No conversations yet</p>
              <p className="text-sm">Messages will appear when you book with caregivers</p>
            </div>
          ) : (
            rooms.map((room) => {
              console.log('🏠 Rendering room:', room.otherUser.name, 'Avatar:', room.otherUser.avatar);
              return (
                <div
                  key={room.id}
                  onClick={() => handleRoomSelect(room)}
                  className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition ${
                    activeRoomId === room.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {room.otherUser.avatar ? (
                        <img
                          src={room.otherUser.avatar}
                          alt={room.otherUser.name}
                          className="w-12 h-12 rounded-full object-cover"
                          onError={(e) => {
                            console.error('🚨 Image failed to load:', room.otherUser.avatar);
                            console.error('🚨 Error details:', e);
                          }}
                          onLoad={() => {
                            console.log('✅ Image loaded successfully:', room.otherUser.avatar);
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
                          <UserCircleIcon className="w-8 h-8 text-gray-600" />
                        </div>
                      )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900 truncate">
                        {room.otherUser.name}
                      </p>
                      {room.unreadCount > 0 && (
                        <span className="bg-green-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                          {room.unreadCount}
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-1">
                      {formatDate(new Date(room.booking.startTime))} • {room.booking.status}
                    </p>
                    
                    {room.lastMessage && (
                      <p className="text-sm text-gray-500 truncate">
                        {room.lastMessage.isFromMe ? 'You: ' : ''}
                        {room.lastMessage.content}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 flex flex-col">
        {activeRoomId ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b bg-gray-50">
              {(() => {
                const activeRoom = rooms.find(r => r.id === activeRoomId);
                if (!activeRoom) return null;
                
                return (
                  <div className="flex items-center space-x-3">
                    {activeRoom.otherUser.avatar ? (
                      <img
                        src={activeRoom.otherUser.avatar}
                        alt={activeRoom.otherUser.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                        <UserCircleIcon className="w-6 h-6 text-gray-600" />
                      </div>
                    )}
                    <div>
                      <h4 className="font-medium text-gray-900">{activeRoom.otherUser.name}</h4>
                      <p className="text-sm text-gray-600">
                        Booking: {formatDate(new Date(activeRoom.booking.startTime))} • {activeRoom.booking.status}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-green-500 border-t-transparent"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <ChatBubbleLeftRightIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>No messages yet</p>
                  <p className="text-sm">Start the conversation!</p>
                </div>
              ) : (
                messages.map((message) => {
                  console.log('💬 Rendering message:', message.content, 'From:', message.senderName, 'Avatar:', message.senderAvatar);
                  return (
                  <div
                    key={message.id}
                    className={`flex ${message.isFromMe ? 'justify-end' : 'justify-start'} items-end space-x-2`}
                  >
                    {!message.isFromMe && (
                      <div className="flex-shrink-0">
                        {message.senderAvatar ? (
                          <img
                            src={message.senderAvatar}
                            alt="Avatar"
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                            <UserCircleIcon className="w-5 h-5 text-gray-600" />
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.isFromMe
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <div className={`flex items-center justify-between mt-1 text-xs ${
                        message.isFromMe ? 'text-green-100' : 'text-gray-500'
                      }`}>
                        <span>{formatTime(new Date(message.createdAt))}</span>
                        {message.isFromMe && (
                          <span className="ml-2">
                            {message.isRead ? (
                              <CheckSolidIcon className="h-3 w-3" title="Read" />
                            ) : (
                              <CheckIcon className="h-3 w-3" title="Sent" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {message.isFromMe && (
                      <div className="flex-shrink-0">
                        {message.senderAvatar ? (
                          <img
                            src={message.senderAvatar}
                            alt="Avatar"
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-green-300 rounded-full flex items-center justify-center">
                            <UserCircleIcon className="w-5 h-5 text-green-600" />
                          </div>
                        )}
                      </div>
                    )}
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t bg-gray-50">
              <form onSubmit={handleSendMessage} className="flex space-x-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  disabled={sendingMessage}
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim() || sendingMessage}
                  className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg transition flex items-center"
                >
                  {sendingMessage ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : (
                    <PaperAirplaneIcon className="h-4 w-4" />
                  )}
                </button>
              </form>
            </div>
          </>
        ) : (
          /* No Room Selected */
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <ChatBubbleLeftRightIcon className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">Select a conversation</p>
              <p className="text-sm">Choose a chat from the list to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;