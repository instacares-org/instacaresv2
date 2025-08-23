"use client";

import React, { useState, useRef, useEffect } from 'react';
import { 
  PaperAirplaneIcon,
  FaceSmileIcon,
  PaperClipIcon,
  PhotoIcon,
  PhoneIcon,
  VideoCameraIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  XMarkIcon,
  EllipsisVerticalIcon,
  MapPinIcon,
  CalendarIcon,
  ClockIcon,
  UserGroupIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
  id: string;
  content: string;
  messageType: 'TEXT' | 'SYSTEM';
  sender: {
    id: string;
    userType: string;
    profile?: {
      firstName: string;
      lastName: string;
      avatar?: string;
    };
  };
  createdAt: string;
  isRead: boolean;
}

interface ChatRoom {
  id: string;
  booking: {
    id: string;
    startTime: string;
    endTime: string;
    status: string;
    address: string;
    childrenCount: number;
    specialRequests?: string;
    hourlyRate: number;
    totalAmount: number;
    parent?: {
      id: string;
      email: string;
      profile: {
        firstName: string;
        lastName: string;
        phone?: string;
        avatar?: string;
      };
    };
    caregiver?: {
      id: string;
      email: string;
      profile: {
        firstName: string;
        lastName: string;
        phone?: string;
        avatar?: string;
      };
    };
  };
  isActive: boolean;
}

interface EnhancedChatInterfaceProps {
  room: ChatRoom | null;
  messages: Message[];
  onSendMessage: (content: string) => void;
  userType: 'parent' | 'caregiver' | 'admin';
  userId: string;
  isTyping?: boolean;
  typingUser?: string;
}

export default function EnhancedChatInterface({
  room,
  messages,
  onSendMessage,
  userType,
  userId,
  isTyping,
  typingUser
}: EnhancedChatInterfaceProps) {
  const [messageInput, setMessageInput] = useState('');
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [showBookingActions, setShowBookingActions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = () => {
    if (messageInput.trim() && room) {
      onSendMessage(messageInput.trim());
      setMessageInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!room) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <InformationCircleIcon className="h-8 w-8 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Select a conversation</h3>
          <p className="text-gray-500 dark:text-gray-400">Choose a conversation from the list to start messaging</p>
        </div>
      </div>
    );
  }

  const otherUser = userType === 'parent' ? room.booking.caregiver : room.booking.parent;
  const otherUserName = `${otherUser?.profile?.firstName || ''} ${otherUser?.profile?.lastName || ''}`.trim();
  
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  const getBookingStatus = () => {
    const now = new Date();
    const startTime = new Date(room.booking.startTime);
    const endTime = new Date(room.booking.endTime);
    
    if (room.booking.status === 'COMPLETED') return { text: 'Completed', color: 'text-green-600' };
    if (room.booking.status === 'CANCELLED') return { text: 'Cancelled', color: 'text-red-600' };
    if (now >= startTime && now <= endTime) return { text: 'In Progress', color: 'text-blue-600' };
    if (now < startTime) return { text: 'Upcoming', color: 'text-orange-600' };
    return { text: 'Past', color: 'text-gray-600' };
  };

  const bookingStatus = getBookingStatus();

  // Group messages by date
  const groupedMessages = messages.reduce((groups: { [date: string]: Message[] }, message) => {
    const date = new Date(message.createdAt).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 min-w-0 overflow-hidden">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
        <div className="flex items-center justify-between min-w-0">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            {/* Avatar */}
            <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
              {otherUser?.profile?.avatar ? (
                <img
                  src={otherUser.profile.avatar}
                  alt={otherUserName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {otherUserName.split(' ').map(n => n[0]).join('')}
                </span>
              )}
            </div>

            {/* User Info */}
            <div className="min-w-0 flex-1 overflow-hidden">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">{otherUserName}</h3>
              <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 overflow-hidden">
                <span className={`${bookingStatus.color} font-medium whitespace-nowrap`}>
                  {bookingStatus.text}
                </span>
                <span className="flex-shrink-0">•</span>
                <span className="truncate">{new Date(room.booking.startTime).toLocaleDateString()}</span>
                {isTyping && typingUser && (
                  <>
                    <span className="flex-shrink-0">•</span>
                    <span className="text-blue-600 whitespace-nowrap">typing...</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button 
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
              title="Voice call"
            >
              <PhoneIcon className="h-5 w-5" />
            </button>
            <button 
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition"
              title="Video call"
            >
              <VideoCameraIcon className="h-5 w-5" />
            </button>
            <button 
              onClick={() => setShowRoomInfo(!showRoomInfo)}
              className={`p-2 rounded-lg transition ${
                showRoomInfo 
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              title="Booking details"
            >
              <InformationCircleIcon className="h-5 w-5" />
            </button>
            <button 
              onClick={() => setShowBookingActions(!showBookingActions)}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition"
              title="More options"
            >
              <EllipsisVerticalIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Booking Info Banner */}
        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center">
                <CalendarIcon className="h-4 w-4 mr-1 text-blue-600 dark:text-blue-400" />
                <span className="text-gray-700 dark:text-gray-300">{new Date(room.booking.startTime).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center">
                <ClockIcon className="h-4 w-4 mr-1 text-blue-600 dark:text-blue-400" />
                <span className="text-gray-700 dark:text-gray-300">
                  {formatTime(room.booking.startTime)} - {formatTime(room.booking.endTime)}
                </span>
              </div>
              <div className="flex items-center">
                <UserGroupIcon className="h-4 w-4 mr-1 text-blue-600 dark:text-blue-400" />
                <span className="text-gray-700 dark:text-gray-300">{room.booking.childrenCount} child{room.booking.childrenCount !== 1 ? 'ren' : ''}</span>
              </div>
            </div>
            <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
              ${(room.booking.totalAmount / 100).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Booking Actions */}
        {showBookingActions && (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex space-x-2">
              {userType === 'caregiver' && room.booking.status === 'CONFIRMED' && (
                <>
                  <button className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-md text-sm hover:bg-green-200 dark:hover:bg-green-900/50 transition">
                    Start Service
                  </button>
                  <button className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-md text-sm hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition">
                    Reschedule
                  </button>
                </>
              )}
              {room.booking.status === 'IN_PROGRESS' && (
                <button className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md text-sm hover:bg-blue-200 dark:hover:bg-blue-900/50 transition">
                  End Service
                </button>
              )}
              <button className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-sm hover:bg-red-200 dark:hover:bg-red-900/50 transition">
                Report Issue
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Room Info Sidebar */}
      {showRoomInfo && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Booking Details</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-start">
              <MapPinIcon className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400 mt-0.5" />
              <span className="text-gray-700 dark:text-gray-300">{room.booking.address}</span>
            </div>
            {room.booking.specialRequests && (
              <div className="flex items-start">
                <StarIcon className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400 mt-0.5" />
                <div>
                  <span className="text-gray-600 dark:text-gray-400 font-medium">Special Requests:</span>
                  <p className="text-gray-700 dark:text-gray-300 mt-1">{room.booking.specialRequests}</p>
                </div>
              </div>
            )}
            <div className="flex items-center">
              <span className="text-gray-600 dark:text-gray-400 font-medium mr-2">Rate:</span>
              <span className="text-gray-700 dark:text-gray-300">${room.booking.hourlyRate}/hour</span>
            </div>
            <div className="flex items-center">
              <span className="text-gray-600 dark:text-gray-400 font-medium mr-2">Contact:</span>
              <span className="text-gray-700 dark:text-gray-300">{otherUser?.email}</span>
            </div>
            {otherUser?.profile?.phone && (
              <div className="flex items-center">
                <span className="text-gray-600 dark:text-gray-400 font-medium mr-2">Phone:</span>
                <span className="text-gray-700 dark:text-gray-300">{otherUser.profile.phone}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-gray-900 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-800">
        {Object.entries(groupedMessages).map(([date, dayMessages]) => (
          <div key={date}>
            {/* Date Separator */}
            <div className="flex items-center justify-center mb-4">
              <div className="bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                  {formatDate(dayMessages[0].createdAt)}
                </span>
              </div>
            </div>

            {/* Messages for this date */}
            {dayMessages.map((message, index) => {
              const isFromUser = message.sender.id === userId;
              const showAvatar = !isFromUser && (
                index === 0 || 
                dayMessages[index - 1]?.sender.id !== message.sender.id
              );

              return (
                <div
                  key={message.id}
                  className={`flex ${isFromUser ? 'justify-end' : 'justify-start'} mb-2`}
                >
                  {/* Avatar for other user */}
                  {!isFromUser && (
                    <div className="w-8 h-8 mr-2 flex-shrink-0">
                      {showAvatar ? (
                        <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
                          {otherUser?.profile?.avatar ? (
                            <img
                              src={otherUser.profile.avatar}
                              alt={otherUserName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                              {otherUserName.split(' ').map(n => n[0]).join('')}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="w-8"></div>
                      )}
                    </div>
                  )}

                  {/* Message Content */}
                  <div className={`max-w-xs lg:max-w-md ${isFromUser ? 'order-1' : ''}`}>
                    {message.messageType === 'SYSTEM' ? (
                      <div className="text-center">
                        <span className="inline-block bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-xs px-3 py-1 rounded-full">
                          {message.content}
                        </span>
                      </div>
                    ) : (
                      <div
                        className={`rounded-lg px-4 py-2 ${
                          isFromUser
                            ? 'bg-blue-600 dark:bg-blue-600 text-white ml-auto'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <div className={`flex items-center justify-between mt-1 text-xs ${
                          isFromUser ? 'text-blue-100 dark:text-blue-200' : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          <span>{formatTime(message.createdAt)}</span>
                          {isFromUser && (
                            <CheckIcon className="h-3 w-3 ml-2" />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Typing Indicator */}
        {isTyping && typingUser && (
          <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
            <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
              <span className="text-xs">...</span>
            </div>
            <span className="text-sm">{typingUser} is typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {!room.isActive && (
          <div className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2" />
              <span className="text-sm text-yellow-800 dark:text-yellow-300">
                This conversation has been disabled by an administrator.
              </span>
            </div>
          </div>
        )}

        <div className="flex items-end space-x-3">
          {/* Attachment Button */}
          <button
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            disabled={!room.isActive}
          >
            <PaperClipIcon className="h-5 w-5" />
          </button>

          {/* Message Input */}
          <div className="flex-1 relative">
            <textarea
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={room.isActive ? "Type a message..." : "Messaging disabled"}
              disabled={!room.isActive}
              className="w-full px-4 py-2 pr-12 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 resize-none disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-500 dark:disabled:text-gray-500"
              rows={1}
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
            
            {/* Emoji Button */}
            <button
              className="absolute right-3 top-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition"
              disabled={!room.isActive}
            >
              <FaceSmileIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Send Button */}
          <button
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || !room.isActive}
            className="p-2 bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-700 text-white rounded-lg transition disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}