// src/services/api.js
// 100% Mocked API Layer utilizing AsyncStorage for a self-contained mobile-only experience

import AsyncStorage from '@react-native-async-storage/async-storage';
import { decryptMessage, encryptMessage } from './encryption';

const USER_KEY = '@mock_user';
const CHATS_KEY = '@mock_chats';
const MESSAGES_PREFIX = '@mock_messages_';
const TOKEN_KEY = '@ai_chat_auth_token';

// Default mock profiles and assets
const DEFAULT_USER = {
  uid: 'mock_user_id',
  displayName: 'User',
  phone: '+15555555555',
  avatar: '1',
  statusMessage: 'Hey, I am using AI Chat!',
  createdAt: new Date().toISOString(),
};

const GEMINI_USER = {
  uid: 'gemini_assistant',
  displayName: 'Gemini AI Assistant',
  avatar: '7',
  statusMessage: 'Powered by gemini-1.5-flash',
  isOnline: true,
};

const DEFAULT_CHAT = {
  id: 'chat_gemini',
  otherUser: GEMINI_USER,
  lastMessage: encryptMessage('Hello! I am your Gemini AI Assistant. How can I help you today?'),
  lastMessageAt: new Date().toISOString(),
  isPinned: true,
  isOtherOnline: true,
  unreadCount: 0,
};

const DEFAULT_GREETING = {
  id: 'msg_greeting',
  chatId: 'chat_gemini',
  senderId: 'gemini_assistant',
  content: encryptMessage('Hello! I am your Gemini AI Assistant. How can I help you today?'),
  createdAt: new Date().toISOString(),
  status: 'read',
  readBy: ['mock_user_id'],
};

// Database seeding helper
const seedDatabaseIfNeeded = async () => {
  try {
    const userStr = await AsyncStorage.getItem(USER_KEY);
    if (!userStr) {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(DEFAULT_USER));
    }

    const chatsStr = await AsyncStorage.getItem(CHATS_KEY);
    if (!chatsStr) {
      const initialChats = [DEFAULT_CHAT];
      await AsyncStorage.setItem(CHATS_KEY, JSON.stringify(initialChats));

      // Seed the initial message
      await AsyncStorage.setItem(
        `${MESSAGES_PREFIX}chat_gemini`,
        JSON.stringify([DEFAULT_GREETING])
      );
    }
  } catch (error) {
    console.error('[Mock DB] Seeding failed:', error);
  }
};

// Call immediately
seedDatabaseIfNeeded();

// Active auth callbacks
let logoutCallback = null;
export const setLogoutCallback = (cb) => {
  logoutCallback = cb;
};

export const setAuthToken = async (token) => {
  await AsyncStorage.setItem(TOKEN_KEY, token);
};

export const clearAuthToken = async () => {
  await AsyncStorage.removeItem(TOKEN_KEY);
};

export const getStoredToken = async () => {
  return await AsyncStorage.getItem(TOKEN_KEY);
};

// Router matching logic
const routeRequest = async (method, url, data) => {
  await seedDatabaseIfNeeded();

  console.log(`[Mock API] ${method.toUpperCase()} request to: ${url}`, data);

  // Normalize URL by removing optional backend prefix
  const path = url.replace(/^\/api/, '');

  // 1. GET /auth/me
  if (path === '/auth/me' && method === 'get') {
    const user = JSON.parse(await AsyncStorage.getItem(USER_KEY) || '{}');
    return { data: { user } };
  }

  // 2. POST /auth/verify-token
  if (path === '/auth/verify-token' && method === 'post') {
    const token = 'mock_jwt_token_' + Date.now();
    await setAuthToken(token);
    const user = JSON.parse(await AsyncStorage.getItem(USER_KEY) || '{}');
    return { data: { user, token, isNewUser: false } };
  }

  // 3. POST /auth/profile
  if (path === '/auth/profile' && method === 'post') {
    const currentUser = JSON.parse(await AsyncStorage.getItem(USER_KEY) || '{}');
    const updatedUser = { ...currentUser, ...data };
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    return { data: { user: updatedUser } };
  }

  // 4. GET /chats
  if (path === '/chats' && method === 'get') {
    const rawChats = JSON.parse(await AsyncStorage.getItem(CHATS_KEY) || '[]');
    // Decrypt the lastMessage for frontend rendering
    const chats = rawChats.map(c => ({
      ...c,
      lastMessage: decryptMessage(c.lastMessage),
    }));
    return { data: { chats } };
  }

  // 5. GET /chats/:chatId/messages
  const chatMessagesMatch = path.match(/^\/chats\/([^/]+)\/messages$/);
  if (chatMessagesMatch && method === 'get') {
    const chatId = chatMessagesMatch[1];
    const rawMessages = JSON.parse(await AsyncStorage.getItem(`${MESSAGES_PREFIX}${chatId}`) || '[]');
    // Decrypt content for safety
    const messages = rawMessages.map(m => ({
      ...m,
      content: decryptMessage(m.content),
    }));
    return { data: { messages } };
  }

  // 6. GET /users/search
  if (path.startsWith('/users/search') && method === 'get') {
    const phoneMatch = url.match(/phone=([^&]+)/);
    const phone = phoneMatch ? decodeURIComponent(phoneMatch[1]) : '';
    if (!phone) {
      throw new Error('Phone number is required');
    }

    // Always generate a beautiful mock user for searching
    const displayName = phone.includes('555') ? 'Jane Doe' : 'Alex Smith';
    const searchedUser = {
      uid: 'user_' + phone.replace(/\D/g, ''),
      displayName,
      phone,
      avatar: String(Math.floor(Math.random() * 8) + 1),
      statusMessage: 'Available',
      createdAt: new Date().toISOString(),
    };
    return { data: { user: searchedUser } };
  }

  // 7. POST /chats/create
  if (path === '/chats/create' && method === 'post') {
    const { participantId } = data;
    if (!participantId) {
      throw new Error('Participant ID is required');
    }

    const chats = JSON.parse(await AsyncStorage.getItem(CHATS_KEY) || '[]');
    // Check if chat already exists
    const existing = chats.find(c => c.otherUser?.uid === participantId);
    if (existing) {
      return { data: { chatId: existing.id } };
    }

    let displayName = 'Alex Smith';
    if (participantId === 'gemini_assistant') {
      displayName = 'Gemini AI Assistant';
    } else if (participantId.startsWith('user_')) {
      // derive name or default
      displayName = 'Friend';
    }

    const otherUser = {
      uid: participantId,
      displayName,
      avatar: String(Math.floor(Math.random() * 8) + 1),
      statusMessage: 'Hey there! I am using AI Chat.',
      isOnline: false,
    };

    const newChatId = `chat_${Date.now()}`;
    const newChat = {
      id: newChatId,
      otherUser,
      lastMessage: encryptMessage('Start chatting'),
      lastMessageAt: new Date().toISOString(),
      isPinned: false,
      isOtherOnline: false,
      unreadCount: 0,
    };

    chats.push(newChat);
    await AsyncStorage.setItem(CHATS_KEY, JSON.stringify(chats));
    await AsyncStorage.setItem(`${MESSAGES_PREFIX}${newChatId}`, JSON.stringify([]));

    return { data: { chatId: newChatId } };
  }

  throw new Error(`Endpoint mock not implemented: ${method} ${url}`);
};

export const get = (url, config) => routeRequest('get', url);
export const post = (url, data, config) => routeRequest('post', url, data);
export const put = (url, data, config) => routeRequest('put', url, data);
export const patch = (url, data, config) => routeRequest('patch', url, data);
export const del = (url, config) => routeRequest('delete', url);

export const api = {
  get,
  post,
  put,
  patch,
  delete: del,
};

export default {
  get,
  post,
  put,
  patch,
  del,
  api,
  setLogoutCallback,
  setAuthToken,
  clearAuthToken,
  getStoredToken,
};
