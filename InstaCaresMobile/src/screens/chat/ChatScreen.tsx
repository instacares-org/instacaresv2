import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { RootStackParamList, Message } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

type Props = StackScreenProps<RootStackParamList, 'Chat'>;

const ChatScreen: React.FC<Props> = ({ route, navigation }) => {
  const { conversationId } = route.params;
  const { user } = useAuth();
  const { messages, sendMessage, markAsRead, conversations, isConnected } = useChat();
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const conversationMessages = messages[conversationId] || [];
  const conversation = conversations.find(conv => conv.id === conversationId);

  useEffect(() => {
    // Mark messages as read when screen is focused
    const unreadMessages = conversationMessages.filter(
      msg => !msg.isRead && msg.senderId !== user?.id
    );
    
    unreadMessages.forEach(msg => {
      markAsRead(conversationId, msg.id);
    });
  }, [conversationMessages, conversationId, user?.id]);

  useEffect(() => {
    // Set navigation title
    if (conversation) {
      const otherUser = user?.userType === 'parent' 
        ? conversation.caregiver.user 
        : conversation.parent.user;
      
      navigation.setOptions({
        title: `${otherUser.firstName} ${otherUser.lastName}`,
        headerRight: () => (
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => {/* Handle profile view */}}
          >
            <Icon name="person-circle-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        ),
      });
    }
  }, [conversation, navigation, user]);

  const handleSendMessage = async () => {
    const trimmedText = inputText.trim();
    if (!trimmedText) return;

    setInputText('');
    setIsTyping(false);

    try {
      await sendMessage(conversationId, trimmedText);
      // Scroll to bottom after sending
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  const handleTyping = (text: string) => {
    setInputText(text);
    setIsTyping(text.length > 0);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.senderId === user?.id;
    const messageTime = new Date(item.createdAt);
    const timeString = messageTime.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessage : styles.otherMessage,
      ]}>
        {!isOwnMessage && (
          <Image
            source={{ 
              uri: item.sender.profileImage || `https://ui-avatars.com/api/?name=${item.sender.firstName}+${item.sender.lastName}&background=random`
            }}
            style={styles.avatar}
          />
        )}
        <View style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownBubble : styles.otherBubble,
        ]}>
          {item.messageType === 'image' ? (
            <Image source={{ uri: item.content }} style={styles.messageImage} />
          ) : (
            <Text style={[
              styles.messageText,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
            ]}>
              {item.content}
            </Text>
          )}
          <View style={styles.messageFooter}>
            <Text style={[
              styles.messageTime,
              isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime,
            ]}>
              {timeString}
            </Text>
            {isOwnMessage && (
              <Icon
                name={item.isRead ? "checkmark-done" : "checkmark"}
                size={14}
                color={item.isRead ? "#3B82F6" : "#9CA3AF"}
                style={styles.readIcon}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderDateSeparator = (date: Date) => (
    <View style={styles.dateSeparator}>
      <Text style={styles.dateSeparatorText}>
        {date.toLocaleDateString()}
      </Text>
    </View>
  );

  const getMessagesWithSeparators = () => {
    const messagesWithSeparators: (Message | { type: 'date'; date: Date; id: string })[] = [];
    let lastDate: Date | null = null;

    conversationMessages.forEach((message) => {
      const messageDate = new Date(message.createdAt);
      const messageDateString = messageDate.toDateString();
      const lastDateString = lastDate?.toDateString();

      if (messageDateString !== lastDateString) {
        messagesWithSeparators.push({
          type: 'date',
          date: messageDate,
          id: `date-${messageDateString}`,
        });
        lastDate = messageDate;
      }

      messagesWithSeparators.push(message);
    });

    return messagesWithSeparators;
  };

  const renderItem = ({ item }: { item: any }) => {
    if (item.type === 'date') {
      return renderDateSeparator(item.date);
    }
    return renderMessage({ item });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Connection Status */}
      {!isConnected && (
        <View style={styles.connectionStatus}>
          <Text style={styles.connectionStatusText}>Connecting...</Text>
        </View>
      )}

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={getMessagesWithSeparators()}
        renderItem={renderItem}
        keyExtractor={(item) => 'type' in item ? item.id : item.id}
        style={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        showsVerticalScrollIndicator={false}
      />

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            value={inputText}
            onChangeText={handleTyping}
            multiline
            maxLength={1000}
            placeholderTextColor="#9CA3AF"
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { opacity: inputText.trim() ? 1 : 0.5 }
            ]}
            onPress={handleSendMessage}
            disabled={!inputText.trim()}
          >
            <Icon name="send" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  connectionStatus: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  connectionStatusText: {
    color: '#92400E',
    fontSize: 12,
    textAlign: 'center',
  },
  headerButton: {
    marginRight: 16,
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateSeparatorText: {
    backgroundColor: '#E5E7EB',
    color: '#6B7280',
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  ownMessage: {
    justifyContent: 'flex-end',
  },
  otherMessage: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  ownBubble: {
    backgroundColor: '#3B82F6',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#1F2937',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  otherMessageTime: {
    color: '#9CA3AF',
  },
  readIcon: {
    marginLeft: 4,
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F3F4F6',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 48,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});

export default ChatScreen;