// src/services/socket.js
// 100% Mocked Socket.IO client mimicking a real-time server connection

import AsyncStorage from '@react-native-async-storage/async-storage';
import { encryptMessage, decryptMessage } from './encryption';

const CHATS_KEY = '@mock_chats';
const MESSAGES_PREFIX = '@mock_messages_';
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

class MockSocket {
  constructor() {
    this.handlers = new Map();
    this.connected = false;
    this.id = 'mock_socket_id_' + Math.random().toString(36).substring(2, 9);
  }

  connect() {
    this.connected = true;
    console.log('[Mock Socket] Connected:', this.id);
    this.trigger('connect');
  }

  disconnect() {
    this.connected = false;
    console.log('[Mock Socket] Disconnected');
    this.trigger('disconnect', 'io client disconnect');
  }

  on(event, handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event).add(handler);
  }

  off(event, handler) {
    if (!this.handlers.has(event)) return;
    if (handler) {
      this.handlers.get(event).delete(handler);
    } else {
      this.handlers.delete(event);
    }
  }

  trigger(event, data) {
    const set = this.handlers.get(event);
    if (set) {
      set.forEach((handler) => {
        try {
          handler(data);
        } catch (e) {
          console.error(`[Mock Socket] Error in handler for event "${event}":`, e);
        }
      });
    }
  }

  emit(event, payload) {
    console.log(`[Mock Socket] Client EMIT: ${event}`, payload);

    if (event === 'chat:join') {
      console.log(`[Mock Socket] Joined chat room: ${payload.chatId}`);
    }

    if (event === 'message:read') {
      const { chatId, messageIds } = payload;
      this.markMessagesAsRead(chatId, messageIds);
    }

    if (event === 'message:send') {
      this.handleOutgoingMessage(payload);
    }
  }

  async markMessagesAsRead(chatId, messageIds) {
    try {
      const messagesKey = `${MESSAGES_PREFIX}${chatId}`;
      const messages = JSON.parse(await AsyncStorage.getItem(messagesKey) || '[]');
      let updated = false;

      const newMessages = messages.map(m => {
        if (m.senderId !== 'mock_user_id' && m.status !== 'read') {
          updated = true;
          return { ...m, status: 'read', readBy: [...(m.readBy || []), 'mock_user_id'] };
        }
        return m;
      });

      if (updated) {
        await AsyncStorage.setItem(messagesKey, JSON.stringify(newMessages));
        // Reset unread count in Chat List
        const chats = JSON.parse(await AsyncStorage.getItem(CHATS_KEY) || '[]');
        const chatIdx = chats.findIndex(c => c.id === chatId);
        if (chatIdx > -1) {
          chats[chatIdx].unreadCount = 0;
          await AsyncStorage.setItem(CHATS_KEY, JSON.stringify(chats));
        }
      }
    } catch (err) {
      console.warn('[Mock Socket] Failed to mark messages read:', err);
    }
  }

  async handleOutgoingMessage(payload) {
    const { chatId, content, messageId } = payload;
    try {
      const userStr = await AsyncStorage.getItem('@mock_user');
      const user = JSON.parse(userStr || '{"uid":"mock_user_id"}');

      // 1. Encrypt message for storage
      const encryptedContent = encryptMessage(content);

      const userMessage = {
        id: messageId || `msg_${Date.now()}`,
        chatId,
        senderId: user.uid,
        content: encryptedContent,
        createdAt: new Date().toISOString(),
        status: 'sent',
        readBy: [user.uid],
      };

      // 2. Save user message to AsyncStorage
      const messagesKey = `${MESSAGES_PREFIX}${chatId}`;
      const messages = JSON.parse(await AsyncStorage.getItem(messagesKey) || '[]');
      messages.push(userMessage);
      await AsyncStorage.setItem(messagesKey, JSON.stringify(messages));

      // 3. Update last message in chats
      const chats = JSON.parse(await AsyncStorage.getItem(CHATS_KEY) || '[]');
      const chatIdx = chats.findIndex(c => c.id === chatId);
      let otherUser = null;
      if (chatIdx > -1) {
        chats[chatIdx].lastMessage = encryptedContent;
        chats[chatIdx].lastMessageAt = userMessage.createdAt;
        otherUser = chats[chatIdx].otherUser;
        await AsyncStorage.setItem(CHATS_KEY, JSON.stringify(chats));
      }

      // 4. Trigger response based on other user
      if (otherUser && otherUser.uid === 'gemini_assistant') {
        this.triggerGeminiResponse(chatId, content, messages);
      } else if (otherUser) {
        this.triggerMockUserResponse(chatId, otherUser, content);
      }

    } catch (err) {
      console.error('[Mock Socket] Outgoing message processing error:', err);
    }
  }

  async triggerGeminiResponse(chatId, userMessageText, previousMessages) {
    // Show typing status after a brief natural pause
    setTimeout(() => {
      this.trigger('typing:start', { chatId, uid: 'gemini_assistant' });
    }, 500);

    try {
      if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
        throw new Error('GEMINI_API_KEY is not configured or is a placeholder.');
      }
      // Build sliding context window of last 8 decrypted messages
      const chatHistory = previousMessages
        .slice(-8)
        .map(m => {
          const decrypted = decryptMessage(m.content);
          const roleName = m.senderId === 'gemini_assistant' ? 'AI Assistant' : 'User';
          return `${roleName}: ${decrypted}`;
        })
        .join('\n');

      const systemPrompt = `You are a friendly, intelligent personal AI assistant inside a beautiful mobile messaging application.
Your goal is to reply to the user's message contextually, naturally, and supportively.
Along with your reply, you MUST provide exactly three short, conversational, and relevant "smart reply" suggestions for the user to tap on to continue the chat.
Each suggestion MUST be extremely concise (only 2 to 10 words each) and fit cleanly on a standard phone screen without clipping.

Return your response STRICTLY as a valid JSON object matching this schema:
{
  "reply": "Your conversational reply string here",
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
}

Do NOT wrap the JSON in Markdown block quotes or include any extra text. Just return the raw JSON.`;

      const promptText = `Here is the current conversation history:\n${chatHistory}\n\nUser's latest message: "${userMessageText}"\n\nGenerate your reply and suggestions now.`;

      console.log('[Mock Socket] Contacting Gemini API...');
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              { role: 'user', parts: [{ text: promptText }] }
            ],
            generationConfig: {
              responseMimeType: 'application/json'
            },
            systemInstruction: {
              parts: [{ text: systemPrompt }]
            }
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error code: ${response.status}`);
      }

      const resData = await response.json();
      const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log('[Mock Socket] Gemini payload returned:', rawText);

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(rawText.trim());
      } catch (e) {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0].trim());
        } else {
          throw new Error('Unparseable response');
        }
      }

      const replyText = parsedResponse.reply || "I'm always here for you. How can I help?";
      let rawSuggestions = Array.isArray(parsedResponse.suggestions)
        ? parsedResponse.suggestions
        : ["Tell me more!", "That's cool", "Help me with something else"];
      
      if (rawSuggestions.length < 3) {
        rawSuggestions = [...rawSuggestions, "Great!", "Tell me more!", "Awesome!"].slice(0, 3);
      } else if (rawSuggestions.length > 3) {
        rawSuggestions = rawSuggestions.slice(0, 3);
      }

      // Enforce suggestion text length constraint (2-10 words)
      const suggestions = rawSuggestions.map(s => {
        const words = s.split(' ');
        if (words.length > 10) return words.slice(0, 10).join(' ');
        if (words.length < 2) return s + ' please';
        return s;
      });

      // Encrypt the response
      const encryptedReply = encryptMessage(replyText);
      const aiMessageId = `msg_gemini_${Date.now()}`;
      const aiMessage = {
        id: aiMessageId,
        chatId,
        senderId: 'gemini_assistant',
        content: encryptedReply,
        createdAt: new Date().toISOString(),
        status: 'delivered',
        readBy: [],
      };

      // Store response
      const messagesKey = `${MESSAGES_PREFIX}${chatId}`;
      const messages = JSON.parse(await AsyncStorage.getItem(messagesKey) || '[]');
      messages.push(aiMessage);
      await AsyncStorage.setItem(messagesKey, JSON.stringify(messages));

      // Update Chats
      const chats = JSON.parse(await AsyncStorage.getItem(CHATS_KEY) || '[]');
      const chatIdx = chats.findIndex(c => c.id === chatId);
      if (chatIdx > -1) {
        chats[chatIdx].lastMessage = encryptedReply;
        chats[chatIdx].lastMessageAt = aiMessage.createdAt;
        chats[chatIdx].unreadCount = (chats[chatIdx].unreadCount || 0) + 1;
        await AsyncStorage.setItem(CHATS_KEY, JSON.stringify(chats));
      }

      // Stop typing indicator and emit new message & suggestions
      this.trigger('typing:stop', { chatId, uid: 'gemini_assistant' });
      this.trigger('message:received', { ...aiMessage, content: replyText });
      this.trigger('ai:suggestions', { chatId, suggestions });

    } catch (error) {
      console.error('[Mock Socket] Gemini processing failed, falling back:', error);

      const fallbacks = [
        "I'm here! Tell me more about what you have in mind.",
        "That's really interesting! Let's explore that further.",
        "Offline mode is active, but I am still here to support you!",
        "Thanks for sharing that! How can I assist you next?",
      ];
      const replyText = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      const suggestions = ["Tell me more!", "That's great", "Help me build something"];

      const encryptedReply = encryptMessage(replyText);
      const aiMessageId = `msg_gemini_fb_${Date.now()}`;
      const aiMessage = {
        id: aiMessageId,
        chatId,
        senderId: 'gemini_assistant',
        content: encryptedReply,
        createdAt: new Date().toISOString(),
        status: 'delivered',
        readBy: [],
      };

      const messagesKey = `${MESSAGES_PREFIX}${chatId}`;
      const messages = JSON.parse(await AsyncStorage.getItem(messagesKey) || '[]');
      messages.push(aiMessage);
      await AsyncStorage.setItem(messagesKey, JSON.stringify(messages));

      const chats = JSON.parse(await AsyncStorage.getItem(CHATS_KEY) || '[]');
      const chatIdx = chats.findIndex(c => c.id === chatId);
      if (chatIdx > -1) {
        chats[chatIdx].lastMessage = encryptedReply;
        chats[chatIdx].lastMessageAt = aiMessage.createdAt;
        chats[chatIdx].unreadCount = (chats[chatIdx].unreadCount || 0) + 1;
        await AsyncStorage.setItem(CHATS_KEY, JSON.stringify(chats));
      }

      this.trigger('typing:stop', { chatId, uid: 'gemini_assistant' });
      this.trigger('message:received', { ...aiMessage, content: replyText });
      this.trigger('ai:suggestions', { chatId, suggestions });
    }
  }

  async triggerMockUserResponse(chatId, otherUser, userMessageText) {
    setTimeout(() => {
      this.trigger('typing:start', { chatId, uid: otherUser.uid });
    }, 800);

    setTimeout(async () => {
      try {
        if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
          throw new Error('GEMINI_API_KEY is not configured or is a placeholder.');
        }
        const systemPrompt = `You are a person named ${otherUser.displayName}.
Your status message is "${otherUser.statusMessage || ''}".
A user is messaging you. Respond to their message naturally, casually, and briefly as a friend.
Provide a quick reply (under 25 words).
Along with your reply, you MUST provide exactly three short, conversational, and relevant "smart reply" suggestions for the user to tap on to continue the chat.
Each suggestion MUST be extremely concise (only 2 to 10 words each) and fit cleanly on a standard phone screen without clipping.

Return your response STRICTLY as a valid JSON object matching this schema:
{
  "reply": "Your casual reply here",
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
}

Do NOT wrap the JSON in Markdown block quotes or include any extra text.`;

        console.log(`[Mock Socket] Simulating AI response for user ${otherUser.displayName}...`);
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [
                { role: 'user', parts: [{ text: `User message: "${userMessageText}"` }] }
              ],
              generationConfig: {
                responseMimeType: 'application/json'
              },
              systemInstruction: {
                parts: [{ text: systemPrompt }]
              }
            }),
          }
        );

        let replyText = `Hey! Thanks for texting. Talk soon!`;
        let suggestions = ["Cool!", "How's it going?", "Awesome!"];

        if (response.ok) {
          const resData = await response.json();
          const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
          try {
            const parsed = JSON.parse(rawText.trim());
            replyText = parsed.reply || replyText;
            if (Array.isArray(parsed.suggestions) && parsed.suggestions.length >= 3) {
              suggestions = parsed.suggestions.slice(0, 3);
            }
          } catch {
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0].trim());
              replyText = parsed.reply || replyText;
              if (Array.isArray(parsed.suggestions) && parsed.suggestions.length >= 3) {
                suggestions = parsed.suggestions.slice(0, 3);
              }
            }
          }
        }

        const encryptedReply = encryptMessage(replyText);
        const friendMessageId = `msg_friend_${Date.now()}`;
        const friendMessage = {
          id: friendMessageId,
          chatId,
          senderId: otherUser.uid,
          content: encryptedReply,
          createdAt: new Date().toISOString(),
          status: 'delivered',
          readBy: [],
        };

        const messagesKey = `${MESSAGES_PREFIX}${chatId}`;
        const messages = JSON.parse(await AsyncStorage.getItem(messagesKey) || '[]');
        messages.push(friendMessage);
        await AsyncStorage.setItem(messagesKey, JSON.stringify(messages));

        const chats = JSON.parse(await AsyncStorage.getItem(CHATS_KEY) || '[]');
        const chatIdx = chats.findIndex(c => c.id === chatId);
        if (chatIdx > -1) {
          chats[chatIdx].lastMessage = encryptedReply;
          chats[chatIdx].lastMessageAt = friendMessage.createdAt;
          chats[chatIdx].unreadCount = (chats[chatIdx].unreadCount || 0) + 1;
          await AsyncStorage.setItem(CHATS_KEY, JSON.stringify(chats));
        }

        this.trigger('typing:stop', { chatId, uid: otherUser.uid });
        this.trigger('message:received', { ...friendMessage, content: replyText });
        this.trigger('ai:suggestions', { chatId, suggestions });

      } catch (err) {
        console.warn('[Mock Socket] Friend reply processing failed:', err);
        this.trigger('typing:stop', { chatId, uid: otherUser.uid });
      }
    }, 2000);
  }
}

let socketInstance = null;

export const initSocket = (token) => {
  if (!socketInstance) {
    socketInstance = new MockSocket();
  }
  socketInstance.connect();
  return socketInstance;
};

export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
};

export const getSocket = () => socketInstance;

export const joinChat = (chatId) => {
  if (socketInstance) socketInstance.emit('chat:join', { chatId });
};

export const sendMessage = (payload) => {
  if (socketInstance) socketInstance.emit('message:send', payload);
};

export const startTyping = (chatId) => {
  if (socketInstance) socketInstance.emit('typing:start', { chatId });
};

export const stopTyping = (chatId) => {
  if (socketInstance) socketInstance.emit('typing:stop', { chatId });
};

export const markRead = (chatId, messageIds) => {
  if (socketInstance) socketInstance.emit('message:read', { chatId, messageIds });
};

export const onSocketEvent = (event, handler) => {
  if (!socketInstance) return () => {};
  socketInstance.on(event, handler);
  return () => {
    if (socketInstance) socketInstance.off(event, handler);
  };
};

export default {
  initSocket,
  disconnectSocket,
  getSocket,
  joinChat,
  sendMessage,
  startTyping,
  stopTyping,
  markRead,
  onSocketEvent,
};
