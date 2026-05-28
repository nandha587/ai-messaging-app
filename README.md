# 🤖 AI Chat — Real-Time AI Messaging App

A modern AI-powered messaging application with phone number authentication, real-time chat via Socket.IO, and Google Gemini (gemini-1.5-flash) smart reply suggestions.

![Platform](https://img.shields.io/badge/platform-Android%20%7C%20iOS-blue)
![Stack](https://img.shields.io/badge/stack-React%20Native%20%2B%20Node.js-purple)
![AI](https://img.shields.io/badge/AI-Gemini--1.5--flash-green)

---

## ✨ Features

- 📱 **Phone Number Authentication** — Firebase OTP with auto-detection
- 💬 **Real-Time Messaging** — Socket.IO with typing indicators & read receipts
- 🤖 **AI Smart Replies** — Google Gemini (gemini-1.5-flash) generates 3 contextual reply suggestions
- 🛡️ **Spam Detection** — Blocks spam, abusive language, and fake links
- 🔐 **AES-256 Encryption** — Messages encrypted before Firestore storage
- 🌙 **Dark Mode** — Premium dark UI with purple/pink gradient accents
- 🎤 **Voice-to-Text** — Hold mic button to dictate messages
- 📌 **Pin Conversations** — Pin important chats to the top
- 🔔 **Push Notifications** — Real-time notification delivery

---

## 🏗️ Architecture

```
frontend/          # React Native (Expo) mobile app
backend/           # Node.js + Express + Socket.IO API
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native (Expo SDK 51) |
| Navigation | React Navigation v6 |
| Auth | Firebase Authentication (Phone OTP) |
| Database | Firebase Firestore |
| Real-Time | Socket.IO |
| AI | Google Gemini (gemini-1.5-flash) |
| Encryption | AES-256 (crypto-js) |
| State | Zustand + React Query |
| Notifications | Expo Notifications |

---

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.x
- npm >= 9.x
- Expo CLI: `npm install -g expo-cli`
- EAS CLI (for builds): `npm install -g eas-cli`
- Firebase project (free Spark plan works)
- Google Gemini API key

---

### 1. Clone & Setup

```bash
cd ai-messaging-app
```

### 2. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable **Authentication → Phone** sign-in method
4. Create a **Firestore** database (start in test mode, then apply security rules)
5. Go to **Project Settings → Service Accounts → Generate new private key** (for backend)
6. Go to **Project Settings → General → Add app → Web** (for frontend config)
7. Download `google-services.json` and place it in `frontend/`

### 3. Backend Setup

```bash
cd backend
npm install

# Copy and fill in environment variables
cp .env.example .env
# Edit .env with your values:
#   GEMINI_API_KEY=AIzaSy...
#   FIREBASE_PROJECT_ID=...
#   FIREBASE_CLIENT_EMAIL=...
#   FIREBASE_PRIVATE_KEY="..."
#   JWT_SECRET=<random 64-char string>
#   ENCRYPTION_KEY=<exactly 32 hex chars>

npm run dev
# Server starts on http://localhost:3001
```

### 4. Apply Firestore Security Rules

In Firebase Console → Firestore → Rules, paste the contents of `backend/firestore.rules`.

### 5. Frontend Setup

```bash
cd frontend
npm install

# Copy and fill in environment variables
cp .env.example .env
# Edit .env with:
#   EXPO_PUBLIC_API_URL=http://YOUR_MACHINE_IP:3001
#   EXPO_PUBLIC_SOCKET_URL=http://YOUR_MACHINE_IP:3001
#   EXPO_PUBLIC_FIREBASE_API_KEY=...
#   (all other Firebase web config values)
#   EXPO_PUBLIC_ENCRYPTION_KEY=<same 32 hex chars as backend>

npx expo start
# Scan QR code with Expo Go app (Android)
```

> ⚠️ **Important**: Use your machine's **local IP address** (not `localhost`) for `API_URL` and `SOCKET_URL` when testing on a physical device. Find it with `ipconfig` (Windows).

---

## 📦 Building the APK

### Development Preview APK (no store)

```bash
cd frontend

# Login to Expo
eas login

# Initialize EAS build
eas build:configure

# Build APK (takes ~10-15 minutes on Expo servers)
eas build --platform android --profile preview

# Download the APK from the link provided
```

### eas.json (create this file in frontend/)

```json
{
  "cli": {
    "version": ">= 10.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "aab"
      }
    }
  }
}
```

### Local APK Build (requires Android SDK)

```bash
cd frontend

# Create development build locally
npx expo run:android

# Or eject and build with Gradle
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

---

## 🗂️ Project Structure

```
ai-messaging-app/
├── backend/
│   ├── src/
│   │   ├── index.js                 # Express + Socket.IO entry
│   │   ├── firebase/
│   │   │   └── admin.js             # Firebase Admin SDK
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js   # JWT verification
│   │   │   └── spam.middleware.js   # Spam detection
│   │   ├── routes/
│   │   │   ├── auth.routes.js       # Auth endpoints
│   │   │   ├── chat.routes.js       # Chat endpoints
│   │   │   └── user.routes.js       # User endpoints
│   │   ├── services/
│   │   │   ├── ai.service.js        # Google Gemini integration
│   │   │   └── spam.service.js      # Spam detection logic
│   │   └── sockets/
│   │       └── chat.socket.js       # Socket.IO handlers
│   ├── firestore.rules
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── App.jsx                      # Root navigation
    ├── app.json                     # Expo config
    ├── src/
    │   ├── components/
    │   │   ├── AISuggestionBar.jsx  # AI reply chips
    │   │   ├── ChatListItem.jsx     # Conversation preview
    │   │   ├── MessageBubble.jsx    # Chat message
    │   │   ├── OnlineStatus.jsx     # Online indicator
    │   │   ├── SpamAlert.jsx        # Blocked msg card
    │   │   └── TypingIndicator.jsx  # Animated dots
    │   ├── context/
    │   │   ├── AuthContext.jsx      # Auth state
    │   │   └── ThemeContext.jsx     # Dark/light theme
    │   ├── screens/
    │   │   ├── SplashScreen.jsx
    │   │   ├── auth/
    │   │   │   ├── PhoneLoginScreen.jsx
    │   │   │   ├── OTPVerifyScreen.jsx
    │   │   │   └── ProfileSetupScreen.jsx
    │   │   ├── ChatListScreen.jsx
    │   │   ├── ChatScreen.jsx
    │   │   ├── ProfileScreen.jsx
    │   │   └── SettingsScreen.jsx
    │   ├── services/
    │   │   ├── api.js               # Axios client
    │   │   ├── encryption.js        # AES-256
    │   │   ├── firebase.js          # Firebase init
    │   │   ├── notifications.js     # Push notifications
    │   │   └── socket.js            # Socket.IO client
    │   ├── store/
    │   │   └── chatStore.js         # Zustand store
    │   └── theme/
    │       └── index.js             # Design tokens
    ├── .env.example
    └── package.json
```

---

## 🔒 Security Notes

- All messages are AES-256 encrypted before writing to Firestore
- JWT tokens expire in 7 days
- API rate limited to 100 requests per 15 minutes
- Firebase security rules enforce user-scoped data access
- Spam detection runs server-side before message delivery

---

## 🤖 AI Smart Reply

The AI suggestion bar appears automatically when you receive a message. Three context-aware replies are generated using Google Gemini (gemini-1.5-flash). Tap any suggestion to use it as your reply.

Example:
- **Incoming**: "Can you send the report today?"
- **AI Suggestions**: "Yes, I'll send it soon." | "I'll send it before evening." | "Please give me some time."

---

## 🛡️ Spam Detection

Messages are automatically checked for:
- Repeated/spam text patterns
- Abusive language (bad-words library)
- Suspicious/fake links
- Bot-like behavior (all-caps, excessive punctuation)
- Send rate limiting (>20 messages/60s)

Blocked messages show: **"Message blocked due to unsafe or spam content."**

---

## 📝 Environment Variables Reference

### Backend `.env`

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3001) |
| `JWT_SECRET` | Secret key for JWT signing |
| `GEMINI_API_KEY` | Google Gemini API key (Get from aistudio.google.com) |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Service account email |
| `FIREBASE_PRIVATE_KEY` | Service account private key |
| `ENCRYPTION_KEY` | 32-char AES-256 key |

### Frontend `.env`

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | Backend API URL |
| `EXPO_PUBLIC_SOCKET_URL` | Socket.IO server URL |
| `EXPO_PUBLIC_FIREBASE_*` | Firebase web config |
| `EXPO_PUBLIC_ENCRYPTION_KEY` | Must match backend key |

---

## 📄 License

MIT — build freely!
