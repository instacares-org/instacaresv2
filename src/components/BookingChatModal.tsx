"use client";

import { Fragment, useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  XMarkIcon,
  PaperAirplaneIcon,
  UserCircleIcon,
  FaceSmileIcon,
  PaperClipIcon,
  CheckIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import Image from 'next/image';
import { io, Socket } from 'socket.io-client';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { addCSRFHeader } from '@/lib/csrf';

interface Message {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
  isRead: boolean;
  messageType?: string;
  attachmentUrl?: string;
}

interface BookingChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  otherPartyName: string;
  otherPartyAvatar?: string;
  otherPartyId: string;
  currentUserId: string;
  currentUserName: string;
}

export default function BookingChatModal({
  isOpen,
  onClose,
  bookingId,
  otherPartyName,
  otherPartyAvatar,
  otherPartyId,
  currentUserId,
  currentUserName
}: BookingChatModalProps) {
  console.log('BookingChatModal rendered', { isOpen, bookingId, otherPartyId, currentUserId });
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatRoomId, setChatRoomId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [otherPartyTyping, setOtherPartyTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [uploading, setUploading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  // Initialize Socket.io connection
  useEffect(() => {
    if (isOpen && currentUserId) {
      const socketInstance = io({
        path: '/socket.io/',
        transports: ['websocket', 'polling'],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socketInstance.on('connect', () => {
        console.log('Socket connected:', socketInstance.id);
        socketInstance.emit('join', { userId: currentUserId, userType: 'user' });
      });

      // Handle initial list of online users
      socketInstance.on('online_users_list', ({ users }) => {
        console.log('Online users:', users);
        if (users.includes(otherPartyId)) {
          setIsOnline(true);
        }
      });

      socketInstance.on('user_online', ({ userId }) => {
        if (userId === otherPartyId) {
          setIsOnline(true);
        }
      });

      socketInstance.on('user_offline', ({ userId }) => {
        if (userId === otherPartyId) {
          setIsOnline(false);
        }
      });

      socketInstance.on('new_message', ({ roomId, message }) => {
        if (roomId === chatRoomId) {
          setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === message.id)) return prev;
            return [...prev, {
              id: message.id,
              content: message.content,
              senderId: message.sender?.id || message.senderId,
              createdAt: message.createdAt,
              isRead: message.isRead,
              messageType: message.messageType,
              attachmentUrl: message.attachmentUrl
            }];
          });
        }
      });

      socketInstance.on('user_typing', ({ userId, isTyping }) => {
        if (userId === otherPartyId) {
          setOtherPartyTyping(isTyping);
        }
      });

      socketInstance.on('messages_read', ({ roomId, readBy }) => {
        if (roomId === chatRoomId && readBy === otherPartyId) {
          setMessages(prev => prev.map(m =>
            m.senderId === currentUserId ? { ...m, isRead: true } : m
          ));
        }
      });

      setSocket(socketInstance);

      return () => {
        socketInstance.disconnect();
      };
    }
  }, [isOpen, currentUserId, otherPartyId, chatRoomId]);

  // Join chat room when roomId is available
  useEffect(() => {
    if (socket && chatRoomId) {
      socket.emit('join_room', { roomId: chatRoomId, userId: currentUserId });
      // Mark messages as read when joining
      socket.emit('mark_messages_read', { roomId: chatRoomId, userId: currentUserId });

      return () => {
        socket.emit('leave_room', { roomId: chatRoomId, userId: currentUserId });
      };
    }
  }, [socket, chatRoomId, currentUserId]);

  useEffect(() => {
    if (isOpen && bookingId) {
      initializeChat();
    }
  }, [isOpen, bookingId]);

  const initializeChat = async () => {
    setLoading(true);
    try {
      const roomResponse = await fetch('/api/chat/rooms/find-or-create', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ bookingId })
      });

      if (!roomResponse.ok) {
        throw new Error('Failed to initialize chat');
      }

      const roomData = await roomResponse.json();
      if (roomData.success && roomData.chatRoom) {
        setChatRoomId(roomData.chatRoom.id);
        await loadMessages(roomData.chatRoom.id);
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (roomId: string) => {
    try {
      const response = await fetch(`/api/chat/${roomId}/messages?limit=100`);

      if (response.ok) {
        const data = await response.json();

        if (data.messages && Array.isArray(data.messages)) {
          const formattedMessages = data.messages.map((m: any) => ({
            id: m.id,
            content: m.content,
            senderId: m.sender?.id || m.senderId,
            createdAt: m.createdAt,
            isRead: m.isRead,
            messageType: m.messageType,
            attachmentUrl: m.attachmentUrl
          }));
          setMessages(formattedMessages);
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleTyping = useCallback(() => {
    if (!socket || !chatRoomId) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit('typing_start', {
        roomId: chatRoomId,
        userId: currentUserId,
        userName: currentUserName
      });
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('typing_stop', { roomId: chatRoomId, userId: currentUserId });
    }, 2000);
  }, [socket, chatRoomId, currentUserId, currentUserName, isTyping]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !chatRoomId || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);
    setShowEmojiPicker(false);

    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (socket && isTyping) {
      socket.emit('typing_stop', { roomId: chatRoomId, userId: currentUserId });
      setIsTyping(false);
    }

    // Send via WebSocket for real-time delivery
    if (socket && socket.connected) {
      socket.emit('send_message', {
        roomId: chatRoomId,
        content: messageContent,
        messageType: 'text'
      });
      setSending(false);
    } else {
      // Fallback to HTTP if socket not connected
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        content: messageContent,
        senderId: currentUserId,
        createdAt: new Date().toISOString(),
        isRead: false,
        messageType: 'text'
      };
      setMessages(prev => [...prev, optimisticMessage]);

      try {
        const response = await fetch(`/api/chat/${chatRoomId}/messages`, {
          method: 'POST',
          headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ content: messageContent })
        });

        if (response.ok) {
          const data = await response.json();
          const msgData = data.id ? data : (data.data || data);
          setMessages(prev =>
            prev.map(m => m.id === optimisticMessage.id ? {
              id: msgData.id,
              content: msgData.content,
              senderId: msgData.sender?.id || currentUserId,
              createdAt: msgData.createdAt,
              isRead: msgData.isRead,
              messageType: msgData.messageType || 'text'
            } : m)
          );
        } else {
          setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
          alert('Failed to send message');
        }
      } catch (error) {
        console.error('Error sending message:', error);
        setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
      } finally {
        setSending(false);
      }
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage(prev => prev + emojiData.emoji);
    inputRef.current?.focus();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chatRoomId) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('chatRoomId', chatRoomId);

      const response = await fetch('/api/chat/upload', {
        method: 'POST',
        headers: addCSRFHeader(),
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        // Message with attachment will be sent through the normal flow
        if (data.success) {
          await loadMessages(chatRoomId);
        }
      } else {
        alert('Failed to upload file');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const handleClose = () => {
    setShowEmojiPicker(false);
    setMessages([]);
    setChatRoomId(null);
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ height: '600px' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      {otherPartyAvatar ? (
                        <Image
                          src={otherPartyAvatar}
                          alt={otherPartyName}
                          width={40}
                          height={40}
                          className="rounded-full border-2 border-white/30"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                          <UserCircleIcon className="h-7 w-7 text-white" />
                        </div>
                      )}
                      {/* Online indicator */}
                      <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                        isOnline ? 'bg-green-400' : 'bg-gray-400'
                      }`} />
                    </div>
                    <div>
                      <Dialog.Title className="font-semibold text-sm">
                        {otherPartyName}
                      </Dialog.Title>
                      <p className="text-xs text-white/70">
                        {otherPartyTyping ? 'Typing...' : isOnline ? 'Online' : 'Offline'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    className="p-1.5 hover:bg-white/20 rounded-full transition"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900">
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                      <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mb-3">
                        <PaperAirplaneIcon className="h-8 w-8 text-gray-400" />
                      </div>
                      <p className="text-sm font-medium">Start a conversation</p>
                      <p className="text-xs">Send a message to {otherPartyName.split(' ')[0]}</p>
                    </div>
                  ) : (
                    <>
                      {messages.map((message, index) => {
                        const isOwn = message.senderId === currentUserId;
                        const showDate = index === 0 ||
                          formatDate(message.createdAt) !== formatDate(messages[index - 1].createdAt);

                        return (
                          <Fragment key={message.id}>
                            {showDate && (
                              <div className="flex justify-center">
                                <span className="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-3 py-1 rounded-full shadow-sm">
                                  {formatDate(message.createdAt)}
                                </span>
                              </div>
                            )}
                            <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[75%] ${
                                isOwn
                                  ? 'bg-green-500 text-white rounded-2xl rounded-br-md'
                                  : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-2xl rounded-bl-md shadow-sm'
                              } px-3.5 py-2`}>
                                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                                <div className={`flex items-center justify-end space-x-1 mt-1`}>
                                  <span className={`text-xs ${
                                    isOwn ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
                                  }`}>
                                    {formatTime(message.createdAt)}
                                  </span>
                                  {isOwn && (
                                    message.isRead ? (
                                      <CheckCircleIcon className="h-3.5 w-3.5 text-white/70" />
                                    ) : (
                                      <CheckIcon className="h-3.5 w-3.5 text-white/70" />
                                    )
                                  )}
                                </div>
                              </div>
                            </div>
                          </Fragment>
                        );
                      })}
                      {otherPartyTyping && (
                        <div className="flex justify-start">
                          <div className="bg-white dark:bg-gray-700 rounded-2xl rounded-bl-md shadow-sm px-4 py-3">
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Input Area */}
                <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                  {/* Emoji Picker */}
                  {showEmojiPicker && (
                    <div ref={emojiPickerRef} className="absolute bottom-20 left-4 z-10">
                      <EmojiPicker
                        onEmojiClick={handleEmojiClick}
                        width={300}
                        height={350}
                      />
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    {/* Emoji Button */}
                    <button
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
                      disabled={loading || !chatRoomId}
                    >
                      <FaceSmileIcon className="h-5 w-5" />
                    </button>

                    {/* File Upload Button */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
                      disabled={loading || !chatRoomId || uploading}
                    >
                      <PaperClipIcon className={`h-5 w-5 ${uploading ? 'animate-pulse' : ''}`} />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={handleFileUpload}
                      className="hidden"
                    />

                    {/* Message Input */}
                    <input
                      ref={inputRef}
                      type="text"
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        handleTyping();
                      }}
                      onKeyPress={handleKeyPress}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 rounded-full text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                      disabled={loading || !chatRoomId}
                    />

                    {/* Send Button */}
                    <button
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || sending || !chatRoomId}
                      className="p-2.5 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 rounded-full transition"
                    >
                      <PaperAirplaneIcon className="h-5 w-5 text-white" />
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
