import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  Image,
  Animated,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

// Emoji icons for chat functionality
const ChevronLeftIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>‹</Text>;
const PaperAirplaneIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>✈️</Text>;
const PhoneIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>📞</Text>;
const VideoCameraIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>📹</Text>;
const EllipsisVerticalIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>⋮</Text>;
const CheckIcon = ({ size, color }: { size: number; color: string }) => <Text style={{ fontSize: size, color }}>✓</Text>;

// Airbnb-inspired color palette
const colors = {
  primary: '#FF385C',
  secondary: '#00A699',
  black: '#222222',
  darkGray: '#484848',
  gray: '#767676',
  lightGray: '#B0B0B0',
  borderGray: '#DDDDDD',
  backgroundGray: '#F7F7F7',
  white: '#FFFFFF',
  success: '#008489',
  warning: '#FFB400',
  messageBubble: '#E5F4FF',
  sentMessage: '#FF385C',
  receivedMessage: '#F1F1F1',
};

interface Message {
  id: string;
  text: string;
  timestamp: Date;
  sender: 'user' | 'caregiver';
  delivered: boolean;
  read: boolean;
}

interface ChatScreenProps {
  caregiver: {
    id: string;
    name: string;
    image: string;
    isOnline: boolean;
    lastSeen?: string;
  };
  onBack: () => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ caregiver, onBack }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hi! I'm interested in booking you for this Friday evening. Are you available?",
      timestamp: new Date(Date.now() - 3600000),
      sender: 'user',
      delivered: true,
      read: true,
    },
    {
      id: '2',
      text: "Hello! Yes, I'm available Friday evening. What time were you thinking?",
      timestamp: new Date(Date.now() - 3300000),
      sender: 'caregiver',
      delivered: true,
      read: true,
    },
    {
      id: '3',
      text: "Perfect! I was thinking 6 PM to 11 PM. I have two kids, ages 4 and 7.",
      timestamp: new Date(Date.now() - 3000000),
      sender: 'user',
      delivered: true,
      read: true,
    },
    {
      id: '4',
      text: "That sounds great! I love working with kids that age. Do they have any specific needs or preferences I should know about?",
      timestamp: new Date(Date.now() - 2700000),
      sender: 'caregiver',
      delivered: true,
      read: true,
    },
    {
      id: '5',
      text: "They're pretty easy-going. Bedtime is at 8:30 PM. They love stories and simple games. My rate is $25/hour - does that work?",
      timestamp: new Date(Date.now() - 300000),
      sender: 'user',
      delivered: true,
      read: false,
    },
  ]);
  
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate in the chat
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    
    // Scroll to bottom on load
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [fadeAnim]);

  useEffect(() => {
    // Simulate caregiver typing
    if (messages.length > 0 && messages[messages.length - 1].sender === 'user') {
      const timer = setTimeout(() => {
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          // Add auto-response
          const response: Message = {
            id: Date.now().toString(),
            text: "That rate works perfectly for me! I'll be there at 6 PM on Friday. Looking forward to meeting your kids! 😊",
            timestamp: new Date(),
            sender: 'caregiver',
            delivered: true,
            read: false,
          };
          setMessages(prev => [...prev, response]);
        }, 2000);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [messages]);

  const sendMessage = () => {
    if (inputText.trim()) {
      const newMessage: Message = {
        id: Date.now().toString(),
        text: inputText.trim(),
        timestamp: new Date(),
        sender: 'user',
        delivered: true,
        read: false,
      };
      
      setMessages(prev => [...prev, newMessage]);
      setInputText('');
      
      // Scroll to bottom after sending
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';
    
    return (
      <View style={[
        styles.messageContainer,
        isUser ? styles.userMessageContainer : styles.caregiverMessageContainer,
      ]}>
        {!isUser && (
          <Image
            source={{ uri: caregiver.image }}
            style={styles.messageAvatar}
          />
        )}
        
        <View style={[
          styles.messageBubble,
          isUser ? styles.userMessageBubble : styles.caregiverMessageBubble,
        ]}>
          <Text style={[
            styles.messageText,
            isUser ? styles.userMessageText : styles.caregiverMessageText,
          ]}>
            {item.text}
          </Text>
        </View>
        
        <View style={styles.messageMetadata}>
          <Text style={styles.messageTime}>
            {formatTime(item.timestamp)}
          </Text>
          {isUser && (
            <View style={styles.messageStatus}>
              <CheckIcon 
                size={12} 
                color={item.read ? colors.primary : colors.lightGray} 
              />
              <CheckIcon 
                size={12} 
                color={item.delivered ? colors.primary : colors.lightGray} 
                style={{ marginLeft: -4 }}
              />
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderTypingIndicator = () => {
    if (!isTyping) return null;
    
    return (
      <View style={[styles.messageContainer, styles.caregiverMessageContainer]}>
        <Image
          source={{ uri: caregiver.image }}
          style={styles.messageAvatar}
        />
        <View style={[styles.messageBubble, styles.caregiverMessageBubble]}>
          <View style={styles.typingIndicator}>
            <View style={[styles.typingDot, styles.typingDot1]} />
            <View style={[styles.typingDot, styles.typingDot2]} />
            <View style={[styles.typingDot, styles.typingDot3]} />
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={colors.white} barStyle="dark-content" />
      
      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <ChevronLeftIcon size={24} color={colors.black} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Image
            source={{ uri: caregiver.image }}
            style={styles.headerAvatar}
          />
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{caregiver.name}</Text>
            <Text style={styles.headerStatus}>
              {caregiver.isOnline ? 'Online' : `Last seen ${caregiver.lastSeen || '2 hours ago'}`}
            </Text>
          </View>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerAction}>
            <PhoneIcon size={20} color={colors.darkGray} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerAction}>
            <VideoCameraIcon size={20} color={colors.darkGray} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerAction}>
            <EllipsisVerticalIcon size={20} color={colors.darkGray} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Messages */}
      <Animated.View style={[styles.messagesContainer, { opacity: fadeAnim }]}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        />
        {renderTypingIndicator()}
      </Animated.View>

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
      >
        <Animated.View style={[styles.inputRow, { opacity: fadeAnim }]}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor={colors.gray}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              inputText.trim() ? styles.sendButtonActive : styles.sendButtonInactive
            ]}
            onPress={sendMessage}
            disabled={!inputText.trim()}
          >
            <PaperAirplaneIcon 
              size={18} 
              color={inputText.trim() ? colors.white : colors.lightGray}
            />
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGray,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.black,
    marginBottom: 2,
  },
  headerStatus: {
    fontSize: 12,
    color: colors.gray,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAction: {
    padding: 8,
    marginLeft: 4,
  },
  
  // Messages
  messagesContainer: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    marginBottom: 16,
    maxWidth: width * 0.8,
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  caregiverMessageContainer: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    marginTop: 4,
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    maxWidth: '100%',
  },
  userMessageBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  caregiverMessageBubble: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userMessageText: {
    color: colors.white,
  },
  caregiverMessageText: {
    color: colors.black,
  },
  messageMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginHorizontal: 16,
  },
  messageTime: {
    fontSize: 11,
    color: colors.gray,
  },
  messageStatus: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  
  // Typing Indicator
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.lightGray,
    marginHorizontal: 2,
  },
  typingDot1: {
    // Animation would be added here in a real implementation
  },
  typingDot2: {
    // Animation would be added here in a real implementation
  },
  typingDot3: {
    // Animation would be added here in a real implementation
  },
  
  // Input
  inputContainer: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.borderGray,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.black,
    maxHeight: 100,
    minHeight: 44,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: colors.primary,
  },
  sendButtonInactive: {
    backgroundColor: colors.borderGray,
  },
});