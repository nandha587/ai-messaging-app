import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { useChatStore } from './src/store/chatStore';
import { initSocket, getSocket } from './src/services/socket';

// Screens
import SplashScreen from './src/screens/SplashScreen';
import PhoneLoginScreen from './src/screens/auth/PhoneLoginScreen';
import OTPVerifyScreen from './src/screens/auth/OTPVerifyScreen';
import ProfileSetupScreen from './src/screens/auth/ProfileSetupScreen';
import ChatListScreen from './src/screens/ChatListScreen';
import ChatScreen from './src/screens/ChatScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SmsInboxScreen from './src/screens/SmsInboxScreen';

const Stack = createNativeStackNavigator();
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 30000 },
  },
});

// ─── Socket global event listener setup ──────────────────────────────────────
function SocketEventWatcher() {
  const { user, token } = useAuth();
  const {
    addMessage, updateMessage, setTyping, clearTyping,
    setOnline, setOffline, setAiSuggestions, updateChatLastMessage,
  } = useChatStore();

  useEffect(() => {
    if (!token || !user) return;

    // Initialize socket connection
    const socket = initSocket(token);

    // ── Presence ───────────────────────────────────────────────────────────
    socket.on('user:online', ({ uid }) => setOnline(uid));
    socket.on('user:offline', ({ uid }) => setOffline(uid));

    // ── Messages ───────────────────────────────────────────────────────────
    socket.on('message:received', (msg) => {
      addMessage(msg.chatId, msg);
      updateChatLastMessage(msg.chatId, msg.content, msg.createdAt);
    });

    socket.on('message:read', ({ chatId, messageId }) => {
      updateMessage(chatId, messageId, { status: 'read' });
    });

    // ── Typing ─────────────────────────────────────────────────────────────
    socket.on('typing:start', ({ chatId, uid }) => setTyping(chatId, uid));
    socket.on('typing:stop', ({ chatId, uid }) => clearTyping(chatId, uid));

    // ── AI Suggestions ─────────────────────────────────────────────────────
    socket.on('ai:suggestions', ({ chatId, suggestions }) => {
      if (Array.isArray(suggestions) && suggestions.length > 0) {
        setAiSuggestions(chatId, suggestions);
      }
    });

    return () => {
      socket.off('user:online');
      socket.off('user:offline');
      socket.off('message:received');
      socket.off('message:read');
      socket.off('typing:start');
      socket.off('typing:stop');
      socket.off('ai:suggestions');
    };
  }, [token, user?.uid]);

  return null;
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const { theme, isDark } = useTheme();

  const screenOptions = {
    headerShown: false,
    animation: 'slide_from_right',
    contentStyle: { backgroundColor: theme.colors.background },
  };

  return (
    <>
      <SocketEventWatcher />
      <Stack.Navigator screenOptions={screenOptions}>
        {/* Splash — always shown first */}
        <Stack.Screen name="Splash" component={SplashScreen} />

        {/* Auth flow */}
        <Stack.Screen name="PhoneLogin" component={PhoneLoginScreen} />
        <Stack.Screen name="OTPVerify" component={OTPVerifyScreen} />
        <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />

        {/* Main app */}
        <Stack.Screen name="ChatList" component={ChatListScreen} />
        <Stack.Screen
          name="Chat"
          component={ChatScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="SmsInbox"
          component={SmsInboxScreen}
          options={{ animation: 'slide_from_right' }}
        />
      </Stack.Navigator>
    </>
  );
}

// ─── Theme-aware navigation theme ─────────────────────────────────────────────
function ThemedApp() {
  const { isDark, theme } = useTheme();

  const navTheme = {
    dark: isDark,
    colors: {
      primary: '#7C3AED',
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: '#7C3AED',
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <AppNavigator />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavigationContainer>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <ThemedApp />
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
