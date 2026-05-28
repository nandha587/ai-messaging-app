'use strict';

const express = require('express');
const { admin, db } = require('../firebase/admin');
const { authenticateToken } = require('../middleware/auth.middleware');
const { generateSmartReplies } = require('../services/ai.service');

const router = express.Router();

// All chat routes require authentication
router.use(authenticateToken);

// ─── GET /api/chats ───────────────────────────────────────────────────────────
// List conversations where the authenticated user is a participant.
router.get('/', async (req, res) => {
  try {
    const { uid } = req.user;

    const snap = await db
      .collection('chats')
      .where('participants', 'array-contains', uid)
      .orderBy('lastMessageAt', 'desc')
      .limit(50)
      .get();

    // Filter out soft-deleted chats for this user
    const chats = snap.docs
      .map((doc) => ({ chatId: doc.id, ...doc.data() }))
      .filter((chat) => {
        const deletedFor = chat.deletedFor || {};
        return !deletedFor[uid];
      });

    return res.status(200).json({ chats });
  } catch (err) {
    console.error('[Chats] list error:', err.message || err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── GET /api/chats/:chatId/messages ─────────────────────────────────────────
// Paginated messages — 30 per page, cursor via ?before=<ISO timestamp>
router.get('/:chatId/messages', async (req, res) => {
  try {
    const { uid } = req.user;
    const { chatId } = req.params;
    const { before } = req.query;

    // Verify participant
    const chatSnap = await db.collection('chats').doc(chatId).get();
    if (!chatSnap.exists || !chatSnap.data().participants.includes(uid)) {
      return res.status(403).json({ error: 'Access denied to this chat.' });
    }

    let query = db
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .orderBy('createdAt', 'desc')
      .limit(30);

    if (before) {
      const cursorDate = new Date(before);
      if (!isNaN(cursorDate.getTime())) {
        query = query.startAfter(admin.firestore.Timestamp.fromDate(cursorDate));
      }
    }

    const snap = await query.get();
    const messages = snap.docs.map((doc) => ({ messageId: doc.id, ...doc.data() }));

    return res.status(200).json({ messages, count: messages.length });
  } catch (err) {
    console.error('[Chats] messages error:', err.message || err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── POST /api/chats/create ───────────────────────────────────────────────────
// Create (or return existing) a 1-to-1 chat between two users.
router.post('/create', async (req, res) => {
  try {
    const { uid } = req.user;
    const { participantId } = req.body;

    if (!participantId) {
      return res.status(400).json({ error: 'participantId is required.' });
    }
    if (participantId === uid) {
      return res.status(400).json({ error: 'Cannot create a chat with yourself.' });
    }

    // Verify the other participant exists
    const otherUserSnap = await db.collection('users').doc(participantId).get();
    if (!otherUserSnap.exists) {
      return res.status(404).json({ error: 'Participant user not found.' });
    }

    // Check for an existing chat between these two users
    const existingSnap = await db
      .collection('chats')
      .where('participants', 'array-contains', uid)
      .get();

    const existing = existingSnap.docs.find((doc) => {
      const p = doc.data().participants || [];
      return p.includes(participantId) && p.length === 2;
    });

    if (existing) {
      return res.status(200).json({ chatId: existing.id, existed: true });
    }

    // Create new chat
    const now = admin.firestore.FieldValue.serverTimestamp();
    const chatRef = db.collection('chats').doc();
    await chatRef.set({
      participants: [uid, participantId],
      createdAt: now,
      lastMessageAt: now,
      lastMessage: null,
      deletedFor: {},
      pinnedFor: {},
    });

    return res.status(201).json({ chatId: chatRef.id, existed: false });
  } catch (err) {
    console.error('[Chats] create error:', err.message || err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── POST /api/chats/:chatId/ai-suggest ──────────────────────────────────────
// Return 3 AI-generated smart reply suggestions.
router.post('/:chatId/ai-suggest', async (req, res) => {
  try {
    const { uid } = req.user;
    const { chatId } = req.params;
    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required.' });
    }

    // Verify participant
    const chatSnap = await db.collection('chats').doc(chatId).get();
    if (!chatSnap.exists || !chatSnap.data().participants.includes(uid)) {
      return res.status(403).json({ error: 'Access denied to this chat.' });
    }

    const suggestions = await generateSmartReplies(message, history);
    return res.status(200).json({ suggestions });
  } catch (err) {
    console.error('[Chats] ai-suggest error:', err.message || err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── DELETE /api/chats/:chatId ────────────────────────────────────────────────
// Soft-delete a chat for the requesting user only.
router.delete('/:chatId', async (req, res) => {
  try {
    const { uid } = req.user;
    const { chatId } = req.params;

    const chatRef = db.collection('chats').doc(chatId);
    const chatSnap = await chatRef.get();

    if (!chatSnap.exists) {
      return res.status(404).json({ error: 'Chat not found.' });
    }
    if (!chatSnap.data().participants.includes(uid)) {
      return res.status(403).json({ error: 'Access denied to this chat.' });
    }

    // Soft delete: mark as deleted for this user only
    await chatRef.update({
      [`deletedFor.${uid}`]: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ message: 'Chat deleted for your account.' });
  } catch (err) {
    console.error('[Chats] delete error:', err.message || err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── POST /api/chats/:chatId/pin ──────────────────────────────────────────────
// Toggle pin status for the requesting user.
router.post('/:chatId/pin', async (req, res) => {
  try {
    const { uid } = req.user;
    const { chatId } = req.params;

    const chatRef = db.collection('chats').doc(chatId);
    const chatSnap = await chatRef.get();

    if (!chatSnap.exists) {
      return res.status(404).json({ error: 'Chat not found.' });
    }
    if (!chatSnap.data().participants.includes(uid)) {
      return res.status(403).json({ error: 'Access denied to this chat.' });
    }

    const pinnedFor = chatSnap.data().pinnedFor || {};
    const isPinned = Boolean(pinnedFor[uid]);

    if (isPinned) {
      // Unpin
      await chatRef.update({
        [`pinnedFor.${uid}`]: admin.firestore.FieldValue.delete(),
      });
      return res.status(200).json({ pinned: false });
    } else {
      // Pin
      await chatRef.update({
        [`pinnedFor.${uid}`]: admin.firestore.FieldValue.serverTimestamp(),
      });
      return res.status(200).json({ pinned: true });
    }
  } catch (err) {
    console.error('[Chats] pin error:', err.message || err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
