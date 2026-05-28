import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
// expo-speech removed — stub out to avoid missing module error
const Speech = { speak: () => {}, stop: () => {}, isSpeakingAsync: async () => false };
import { useAuth } from '../context/AuthContext';
import { useChatStore } from '../store/chatStore';
import MessageBubble from '../components/MessageBubble';
import AISuggestionBar from '../components/AISuggestionBar';
import TypingIndicator from '../components/TypingIndicator';
import { getSocket, joinChat, sendMessage, startTyping, stopTyping, markRead } from '../services/socket';
import { api } from '../services/api';
import { encryptMessage } from '../services/encryption';

let typingTimer = null;

export default function ChatScreen({ route, navigation }) {
  const { chatId, otherUser } = route.params;
  const { user } = useAuth();
  const { messages, addMessage, updateMessage, typingUsers, aiSuggestions, clearAiSuggestions, onlineUsers } = useChatStore();

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const flatListRef = useRef(null);
  const inputRef = useRef(null);

  const chatMessages = (messages.get(chatId) || []).slice().reverse();
  const isOtherTyping = (typingUsers.get(chatId) || new Set()).size > 0;
  const isOtherOnline = onlineUsers.has(otherUser?.uid);
  const suggestions = aiSuggestions.get(chatId) || [];

  // Load message history
  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/chats/${chatId}/messages`);
      const msgs = (res.data.messages || []).reverse();
      const store = useChatStore.getState();
      const existing = store.messages.get(chatId) || [];
      if (existing.length === 0) {
        const map = new Map(store.messages);
        map.set(chatId, msgs);
        useChatStore.setState({ messages: map });
      }
    } catch (err) {
      console.error('Load messages error:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [chatId]);

  // Socket event listeners
  useEffect(() => {
    loadMessages();
    joinChat(chatId);
    markRead(chatId);

    const socket = getSocket();
    if (!socket) return;

    socket.on('message:received', (msg) => {
      if (msg.chatId === chatId) {
        addMessage(chatId, msg);
        markRead(chatId);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShowSuggestions(true);
        setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }), 100);
      }
    });

    socket.on('message:blocked', ({ reason }) => {
      const blockedMsg = {
        id: `blocked-${Date.now()}`,
        chatId,
        senderId: user.uid,
        content: '',
        isBlocked: true,
        blockedReason: reason,
        createdAt: new Date().toISOString(),
        status: 'blocked',
      };
      addMessage(chatId, blockedMsg);
    });

    socket.on('message:read', ({ messageId }) => updateMessage(chatId, messageId, { status: 'read' }));

    return () => {
      socket.off('message:received');
      socket.off('message:blocked');
      socket.off('message:read');
    };
  }, [chatId]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic = {
      id: messageId,
      chatId,
      senderId: user.uid,
      content: text,
      createdAt: new Date().toISOString(),
      status: 'sent',
      readBy: [],
    };

    addMessage(chatId, optimistic);
    setInputText('');
    stopTyping(chatId);
    clearAiSuggestions(chatId);
    setShowSuggestions(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    sendMessage({ chatId, content: text, messageId });
    setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }), 50);
  };

  const handleInputChange = (text) => {
    setInputText(text);
    if (text.length > 0) {
      startTyping(chatId);
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => stopTyping(chatId), 2000);
    } else {
      stopTyping(chatId);
    }
  };

  const handleVoicePress = async () => {
    if (isRecording) {
      setIsRecording(false);
      Speech.stop();
    } else {
      setIsRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      Alert.alert(
        'Voice Input',
        'Voice-to-text requires a speech recognition plugin. For now, use the keyboard.',
        [{ text: 'OK', onPress: () => setIsRecording(false) }]
      );
    }
  };

  const handleSuggestionSelect = (suggestion) => {
    setInputText(suggestion);
    clearAiSuggestions(chatId);
    setShowSuggestions(false);
    inputRef.current?.focus();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const getInitials = (name = '') =>
    name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

  const renderMessage = ({ item }) => (
    <MessageBubble
      message={item}
      isSent={item.senderId === user?.uid}
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0F0F1A" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerCenter} onPress={() => {}}>
          <LinearGradient colors={['#7C3AED', '#DB2777']} style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{getInitials(otherUser?.displayName)}</Text>
          </LinearGradient>
          <View style={styles.headerInfo}>
            <Text style={styles.headerName} numberOfLines={1}>{otherUser?.displayName || 'Chat'}</Text>
            <Text style={[styles.headerStatus, { color: isOtherOnline ? '#22C55E' : '#5A5A7A' }]}>
              {isOtherOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="videocam-outline" size={22} color="#7C3AED" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="call-outline" size={20} color="#7C3AED" />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        {isLoading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#7C3AED" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={chatMessages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            inverted
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={isOtherTyping ? <TypingIndicator name={otherUser?.displayName} /> : null}
          />
        )}

        {/* AI Suggestion Bar */}
        {showSuggestions && suggestions.length > 0 && (
          <AISuggestionBar
            suggestions={suggestions}
            onSelect={handleSuggestionSelect}
            onDismiss={() => { setShowSuggestions(false); clearAiSuggestions(chatId); }}
          />
        )}

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <View style={styles.inputContainer}>
            <TouchableOpacity style={styles.emojiBtn}>
              <Ionicons name="happy-outline" size={22} color="#5A5A7A" />
            </TouchableOpacity>

            <TextInput
              ref={inputRef}
              style={styles.textInput}
              value={inputText}
              onChangeText={handleInputChange}
              placeholder="Type a message..."
              placeholderTextColor="#4A4A6A"
              multiline
              maxLength={2000}
              returnKeyType="default"
            />

            <TouchableOpacity style={styles.voiceBtn} onPress={handleVoicePress}>
              <Ionicons
                name={isRecording ? 'stop-circle' : 'mic-outline'}
                size={22}
                color={isRecording ? '#DB2777' : '#5A5A7A'}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <LinearGradient
              colors={inputText.trim() ? ['#7C3AED', '#DB2777'] : ['#2A2A45', '#2A2A45']}
              style={styles.sendBtnGradient}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <Ionicons name="send" size={18} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F1A' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1E1E38',
    backgroundColor: '#0F0F1A',
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  headerInfo: { flex: 1 },
  headerName: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  headerStatus: { fontSize: 12, marginTop: 1 },
  headerActions: { flexDirection: 'row', gap: 4 },
  iconBtn: { padding: 8 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messageList: { paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#1E1E38', backgroundColor: '#0F0F1A',
  },
  inputContainer: {
    flex: 1, flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: '#16162A', borderRadius: 24,
    paddingHorizontal: 8, paddingVertical: 6,
    borderWidth: 1, borderColor: '#2A2A45',
  },
  emojiBtn: { padding: 6 },
  textInput: {
    flex: 1, color: '#FFFFFF', fontSize: 15, maxHeight: 120,
    paddingHorizontal: 6, paddingVertical: 4,
  },
  voiceBtn: { padding: 6 },
  sendBtn: {
    shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  sendBtnDisabled: { shadowOpacity: 0, elevation: 0 },
  sendBtnGradient: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
