const admin = require('firebase-admin');

// Prevent re-initialization in hot-reload environments
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
  });

  console.log('✅ Firebase Admin initialized for project:', process.env.FIREBASE_PROJECT_ID);
}

const db = admin.firestore();
const messaging = admin.messaging();
const auth = admin.auth();

// Firestore settings
db.settings({ ignoreUndefinedProperties: true });

module.exports = { admin, db, messaging, auth };
