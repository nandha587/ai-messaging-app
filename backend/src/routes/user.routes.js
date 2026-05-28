'use strict';

const express = require('express');
const { admin, db } = require('../firebase/admin');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

// All user routes require authentication
router.use(authenticateToken);

// ─── GET /api/users/search?phone=+1234567890 ─────────────────────────────────
// Search for a user by phone number and return their public profile.
router.get('/search', async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({ error: 'phone query parameter is required.' });
    }

    // Normalise the phone number (ensure it starts with '+')
    const normalised = phone.startsWith('+') ? phone : `+${phone}`;

    const snap = await db
      .collection('users')
      .where('phone', '==', normalised)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const doc = snap.docs[0];
    const data = doc.data();

    return res.status(200).json({
      user: {
        uid: doc.id,
        displayName: data.displayName || null,
        photoURL: data.photoURL || null,
        phone: data.phone || null,
      },
    });
  } catch (err) {
    console.error('[Users] search error:', err.message || err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── PUT /api/users/status ────────────────────────────────────────────────────
// Update the authenticated user's online/offline status.
router.put('/status', async (req, res) => {
  try {
    const { uid } = req.user;
    const { isOnline } = req.body;

    if (typeof isOnline !== 'boolean') {
      return res.status(400).json({ error: 'isOnline must be a boolean.' });
    }

    const updatePayload = {
      isOnline,
      lastSeen: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection('users').doc(uid).update(updatePayload);

    return res.status(200).json({ isOnline, lastSeen: new Date().toISOString() });
  } catch (err) {
    console.error('[Users] status error:', err.message || err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── POST /api/users/fcm-token ────────────────────────────────────────────────
// Save (or update) the FCM push notification token for the authenticated user.
router.post('/fcm-token', async (req, res) => {
  try {
    const { uid } = req.user;
    const { fcmToken } = req.body;

    if (!fcmToken || typeof fcmToken !== 'string') {
      return res.status(400).json({ error: 'fcmToken is required.' });
    }

    const userRef = db.collection('users').doc(uid);

    // Use arrayUnion to avoid duplicates
    await userRef.update({
      fcmTokens: admin.firestore.FieldValue.arrayUnion(fcmToken),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ message: 'FCM token saved.' });
  } catch (err) {
    console.error('[Users] fcm-token error:', err.message || err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── GET /api/users/:uid ──────────────────────────────────────────────────────
// Fetch the public profile of any user by UID.
// NOTE: keep this route AFTER all named routes to avoid shadowing them.
router.get('/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const snap = await db.collection('users').doc(uid).get();

    if (!snap.exists) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const data = snap.data();

    // Return only the public subset of the profile
    return res.status(200).json({
      user: {
        uid: snap.id,
        displayName: data.displayName || null,
        photoURL: data.photoURL || null,
        bio: data.bio || null,
        statusMessage: data.statusMessage || null,
        isOnline: data.isOnline || false,
        lastSeen: data.lastSeen || null,
      },
    });
  } catch (err) {
    console.error('[Users] get-by-uid error:', err.message || err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
