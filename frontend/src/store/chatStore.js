import { create } from 'zustand';

export const useChatStore = create((set, get) => ({
  // State
  chats: new Map(),
  messages: new Map(),        // chatId -> message[]
  typingUsers: new Map(),     // chatId -> Set<uid>
  onlineUsers: new Set(),
  aiSuggestions: new Map(),   // chatId -> string[]
  isLoadingChats: false,

  // Chats
  setChats: (chatMap) => set({ chats: chatMap }),

  updateChatLastMessage: (chatId, message, timestamp) => set(state => {
    const chats = new Map(state.chats);
    const chat = chats.get(chatId);
    if (chat) {
      chats.set(chatId, { ...chat, lastMessage: message, lastMessageAt: timestamp });
    }
    return { chats };
  }),

  // Messages
  addMessage: (chatId, message) => set(state => {
    const messages = new Map(state.messages);
    const existing = messages.get(chatId) || [];
    // Avoid duplicates
    if (existing.some(m => m.id === message.id)) return {};
    messages.set(chatId, [...existing, message]);
    return { messages };
  }),

  updateMessage: (chatId, messageId, updates) => set(state => {
    const messages = new Map(state.messages);
    const existing = messages.get(chatId) || [];
    messages.set(chatId, existing.map(m => m.id === messageId ? { ...m, ...updates } : m));
    return { messages };
  }),

  markMessageRead: (chatId, messageId, uid) => set(state => {
    const messages = new Map(state.messages);
    const existing = messages.get(chatId) || [];
    messages.set(chatId, existing.map(m => {
      if (m.id === messageId && !m.readBy?.includes(uid)) {
        return { ...m, readBy: [...(m.readBy || []), uid], status: 'read' };
      }
      return m;
    }));
    return { messages };
  }),

  // Typing
  setTyping: (chatId, uid) => set(state => {
    const typingUsers = new Map(state.typingUsers);
    const set_ = new Set(typingUsers.get(chatId) || []);
    set_.add(uid);
    typingUsers.set(chatId, set_);
    return { typingUsers };
  }),

  clearTyping: (chatId, uid) => set(state => {
    const typingUsers = new Map(state.typingUsers);
    const set_ = new Set(typingUsers.get(chatId) || []);
    if (uid) set_.delete(uid); else set_.clear();
    typingUsers.set(chatId, set_);
    return { typingUsers };
  }),

  // Online presence
  setOnline: (uid) => set(state => {
    const onlineUsers = new Set(state.onlineUsers);
    onlineUsers.add(uid);
    return { onlineUsers };
  }),

  setOffline: (uid) => set(state => {
    const onlineUsers = new Set(state.onlineUsers);
    onlineUsers.delete(uid);
    return { onlineUsers };
  }),

  // AI Suggestions
  setAiSuggestions: (chatId, suggestions) => set(state => {
    const aiSuggestions = new Map(state.aiSuggestions);
    aiSuggestions.set(chatId, suggestions);
    return { aiSuggestions };
  }),

  clearAiSuggestions: (chatId) => set(state => {
    const aiSuggestions = new Map(state.aiSuggestions);
    aiSuggestions.delete(chatId);
    return { aiSuggestions };
  }),

  setLoadingChats: (isLoadingChats) => set({ isLoadingChats }),
}));
