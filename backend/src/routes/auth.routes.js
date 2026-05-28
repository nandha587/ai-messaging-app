'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const { admin, db } = require('../firebase/admin');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

// ─── POST /api/auth/verify-token ──────────────────────────────────────────────
// Verify a Firebase ID token and issue a backend JWT.
router.post('/verify-token', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'idToken is required.' });
    }

    // Verify the Firebase ID token
    const decodedFirebase = await admin.auth().verifyIdToken(idToken);
    const { uid, phone_number: phone, name: displayName, picture: photoURL } = decodedFirebase;

    // Build the user document payload
    const now = admin.firestore.FieldValue.serverTimestamp();
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();

    const updatePayload = {
      phone: phone || null,
      displayName: displayName || null,
      photoURL: photoURL || null,
      lastSeen: now,
      isOnline: true,
    };

    if (!userSnap.exists) {
      // First sign-in — create the document
      updatePayload.createdAt = now;
      updatePayload.bio = '';
      updatePayload.statusMessage = '';
      updatePayload.fcmTokens = [];
      updatePayload.pinnedChats = [];
      updatePayload.deletedChats = [];
    }

    await userRef.set(updatePayload, { merge: true });

    // Re-fetch to get the canonical data
    const freshSnap = await userRef.get();
    const userData = { uid, ...freshSnap.data() };

    // Issue backend JWT
    const token = jwt.sign(
      { uid, phone: phone || null },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.status(200).json({ token, user: userData });
  } catch (err) {
    console.error('[Auth] verify-token error:', err.message || err);
    if (err.code && err.code.startsWith('auth/')) {
      return res.status(401).json({ error: 'Invalid or expired Firebase ID token.' });
    }
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── POST /api/auth/profile ───────────────────────────────────────────────────
// Update the authenticated user's profile fields.
router.post('/profile', authenticateToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { displayName, photoURL, bio, statusMessage } = req.body;

    const updatePayload = {};
    if (displayName !== undefined) updatePayload.displayName = String(displayName).slice(0, 100);
    if (photoURL !== undefined) updatePayload.photoURL = String(photoURL).slice(0, 500);
    if (bio !== undefined) updatePayload.bio = String(bio).slice(0, 300);
    if (statusMessage !== undefined) updatePayload.statusMessage = String(statusMessage).slice(0, 200);

    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

    updatePayload.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    const userRef = db.collection('users').doc(uid);
    await userRef.update(updatePayload);

    const snap = await userRef.get();
    return res.status(200).json({ user: { uid, ...snap.data() } });
  } catch (err) {
    console.error('[Auth] profile error:', err.message || err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
// Return the authenticated user's full profile.
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const snap = await db.collection('users').doc(uid).get();

    if (!snap.exists) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.status(200).json({ user: { uid, ...snap.data() } });
  } catch (err) {
    console.error('[Auth] me error:', err.message || err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
