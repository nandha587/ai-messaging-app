'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { admin, db } = require('../firebase/admin');
const { detectSpam } = require('../services/spam.service');
const { generateSmartReplies } = require('../services/ai.service');

// ─── Encryption Helpers ───────────────────────────────────────────────────────

const ALGORITHM = 'aes-256-cbc';

/**
 * Derive a 32-byte key from the env variable.
 * The env var can be any string; we hash it to guarantee correct length.
 */
function getDerivedKey() {
  const rawKey = process.env.ENCRYPTION_KEY || 'default-insecure-key-change-me-now';
  return crypto.createHash('sha256').update(rawKey).digest(); // 32 bytes
}

/**
 * AES-256-CBC encrypt a UTF-8 plaintext string.
 * @param {string} plaintext
 * @returns {string} "<iv_hex>:<ciphertext_hex>"
 */
function encryptMessage(plaintext) {
  const key = getDerivedKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * AES-256-CBC decrypt a "<iv_hex>:<ciphertext_hex>" string.
 * @param {string} encryptedStr
 * @returns {string} plaintext
 */
function decryptMessage(encryptedStr) {
  const key = getDerivedKey();
  const [ivHex, ciphertextHex] = encryptedStr.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

// ─── Contact Lookup ───────────────────────────────────────────────────────────

/**
 * Returns an array of UIDs who share at least one chat with the given user.
 * Used to broadcast presence events to relevant users only.
 * @param {string} uid
 * @returns {Promise<string[]>}
 */
async function getContactUids(uid) {
  try {
    const chatsSnap = await db
      .collection('chats')
      .where('participants', 'array-contains', uid)
      .limit(100)
      .get();

    const contactSet = new Set();
    chatsSnap.docs.forEach((doc) => {
      (doc.data().participants || []).forEach((p) => {
        if (p !== uid) contactSet.add(p);
      });
    });
    return [...contactSet];
  } catch (err) {
    console.error('[Socket] getContactUids error:', err.message || err);
    return [];
  }
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Initialize all Socket.IO chat event handlers.
 * @param {import('socket.io').Server} io
 */
function initializeChatSocket(io) {
  // ── JWT Authentication Middleware ──────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('Authentication error: token is required.'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // { uid, phone, iat, exp }
      return next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new Error('Authentication error: token has expired.'));
      }
      return next(new Error('Authentication error: invalid token.'));
    }
  });

  // ── Connection Handler ─────────────────────────────────────────────────────
  io.on('connection', async (socket) => {
    const { uid } = socket.user;
    console.log(`[Socket] User connected: ${uid} (socketId: ${socket.id})`);

    // Join personal room for direct notifications
    socket.join(`user_${uid}`);

    // Mark user online in Firestore
    try {
      await db.collection('users').doc(uid).update({
        isOnline: true,
        lastSeen: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.error(`[Socket] Failed to mark user ${uid} online:`, err.message);
    }

    // Broadcast presence to contacts
    try {
      const contactUids = await getContactUids(uid);
      contactUids.forEach((contactUid) => {
        io.to(`user_${contactUid}`).emit('user:online', { uid });
      });
    } catch (err) {
      console.error(`[Socket] Failed to broadcast online for ${uid}:`, err.message);
    }

    // ── chat:join ────────────────────────────────────────────────────────────
    // Allow a user to subscribe to a specific chat room.
    socket.on('chat:join', async ({ chatId } = {}) => {
      if (!chatId) return;

      try {
        // Verify the user is a participant before joining
        const chatSnap = await db.collection('chats').doc(chatId).get();
        if (!chatSnap.exists || !chatSnap.data().participants.includes(uid)) {
          socket.emit('error', { message: 'Access denied to this chat.' });
          return;
        }
        socket.join(`chat_${chatId}`);
        console.log(`[Socket] User ${uid} joined chat room: chat_${chatId}`);
      } catch (err) {
        console.error(`[Socket] chat:join error for ${uid}:`, err.message);
        socket.emit('error', { message: 'Failed to join chat.' });
      }
    });

    // ── message:send ─────────────────────────────────────────────────────────
    socket.on('message:send', async ({ chatId, content, messageId } = {}) => {
      if (!chatId || !content || !messageId) {
        socket.emit('message:error', { messageId, error: 'chatId, content, and messageId are required.' });
        return;
      }

      // 1. Spam detection
      const spamResult = detectSpam(content, uid);
      if (spamResult.isSpam) {
        socket.emit('message:blocked', { messageId, reason: spamResult.reason });
        return;
      }

      try {
        // Verify participant
        const chatRef = db.collection('chats').doc(chatId);
        const chatSnap = await chatRef.get();

        if (!chatSnap.exists || !chatSnap.data().participants.includes(uid)) {
          socket.emit('message:error', { messageId, error: 'Access denied to this chat.' });
          return;
        }

        const participants = chatSnap.data().participants;
        const recipientUid = participants.find((p) => p !== uid);

        // 2. Encrypt message content
        const encryptedContent = encryptMessage(content);

        // 3. Save to Firestore
        const now = admin.firestore.Timestamp.now();
        const messageRef = db
          .collection('chats')
          .doc(chatId)
          .collection('messages')
          .doc(messageId);

        const messageData = {
          id: messageId,
          senderId: uid,
          content: encryptedContent,          // stored encrypted
          contentPreview: content.slice(0, 50), // plain-text preview for notifications
          createdAt: now,
          status: 'sent',
          readBy: [uid],
        };

        await messageRef.set(messageData);

        // 4. Update chat metadata
        await chatRef.update({
          lastMessage: content.slice(0, 100),
          lastMessageAt: now,
        });

        // 5. Build the outbound (decrypted) message object
        const outboundMessage = {
          id: messageId,
          chatId,
          senderId: uid,
          content,          // send decrypted to clients over the socket
          contentPreview: messageData.contentPreview,
          createdAt: now.toDate().toISOString(),
          status: 'sent',
          readBy: [uid],
        };

        // Emit to all members of the chat room (including sender for confirmation)
        io.to(`chat_${chatId}`).emit('message:received', outboundMessage);

        // 6. Send notification to recipient if they are connected
        if (recipientUid) {
          io.to(`user_${recipientUid}`).emit('notification:new', {
            chatId,
            messageId,
            senderId: uid,
            preview: messageData.contentPreview,
            createdAt: outboundMessage.createdAt,
          });

          // 7. Generate AI suggestions in the background for the recipient
          // Fire-and-forget: we don't await this so message delivery is not delayed
          (async () => {
            try {
              // Fetch last few messages as conversation context
              const historySnap = await db
                .collection('chats')
                .doc(chatId)
                .collection('messages')
                .orderBy('createdAt', 'desc')
                .limit(6)
                .get();

              // Build history in chronological order, excluding the new message
              const history = historySnap.docs
                .filter((doc) => doc.id !== messageId)
                .reverse()
                .map((doc) => {
                  const d = doc.data();
                  let text = d.contentPreview || '';
                  // Attempt to decrypt stored content for better context
                  try {
                    text = decryptMessage(d.content);
                  } catch (_e) {
                    // Fall back to preview if decryption fails
                  }
                  return {
                    role: d.senderId === uid ? 'user' : 'assistant',
                    content: text,
                  };
                });

              const suggestions = await generateSmartReplies(content, history);
              io.to(`user_${recipientUid}`).emit('ai:suggestions', {
                chatId,
                messageId,
                suggestions,
              });
            } catch (err) {
              console.error(`[Socket] AI suggestions error for chat ${chatId}:`, err.message);
            }
          })();
        }
      } catch (err) {
        console.error(`[Socket] message:send error for ${uid}:`, err.message);
        socket.emit('message:error', { messageId, error: 'Failed to send message.' });
      }
    });

    // ── message:read ─────────────────────────────────────────────────────────
    socket.on('message:read', async ({ chatId, messageId } = {}) => {
      if (!chatId || !messageId) return;

      try {
        const messageRef = db
          .collection('chats')
          .doc(chatId)
          .collection('messages')
          .doc(messageId);

        await messageRef.update({
          readBy: admin.firestore.FieldValue.arrayUnion(uid),
          status: 'read',
        });

        // Notify everyone in the room about the read receipt
        io.to(`chat_${chatId}`).emit('message:read', {
          chatId,
          messageId,
          readBy: uid,
          readAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error(`[Socket] message:read error for ${uid}:`, err.message);
      }
    });

    // ── typing:start ──────────────────────────────────────────────────────────
    socket.on('typing:start', ({ chatId } = {}) => {
      if (!chatId) return;
      // Broadcast to everyone in the room except the sender
      socket.to(`chat_${chatId}`).emit('typing:start', { chatId, uid });
    });

    // ── typing:stop ───────────────────────────────────────────────────────────
    socket.on('typing:stop', ({ chatId } = {}) => {
      if (!chatId) return;
      socket.to(`chat_${chatId}`).emit('typing:stop', { chatId, uid });
    });

    // ── disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', async (reason) => {
      console.log(`[Socket] User disconnected: ${uid} (reason: ${reason})`);

      // Mark user offline in Firestore
      try {
        await db.collection('users').doc(uid).update({
          isOnline: false,
          lastSeen: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (err) {
        console.error(`[Socket] Failed to mark user ${uid} offline:`, err.message);
      }

      // Broadcast offline status to contacts
      try {
        const contactUids = await getContactUids(uid);
        contactUids.forEach((contactUid) => {
          io.to(`user_${contactUid}`).emit('user:offline', {
            uid,
            lastSeen: new Date().toISOString(),
          });
        });
      } catch (err) {
        console.error(`[Socket] Failed to broadcast offline for ${uid}:`, err.message);
      }
    });
  });

  console.log('[Socket] Chat socket handlers initialized.');
}

module.exports = { initializeChatSocket };
