/**
 * SmsInboxScreen.jsx — Production Quality
 *
 * State machine:
 *   checking_permissions → permission_denied
 *                       → loading → error
 *                                 → empty  (real empty inbox)
 *                                 → loaded (real threads shown)
 *
 * Features:
 *  • Real SMS threads with contact names from device
 *  • Spam detection + visual quarantine
 *  • Hands-free AI auto-reply for ALL non-spam contacts
 *  • Real-time listener for incoming SMS
 *  • Manual compose still available
 *  • Pull-to-refresh
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, PermissionsAndroid, Platform,
  TextInput, RefreshControl, Modal, StatusBar,
  KeyboardAvoidingView, Alert, Switch, Animated, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import {
  getSmsThreads, sendSmsDirect, startSmsListener,
  stopSmsListener, addSmsListener, isExpoGo,
} from '../../modules/expo-sms-inbox';
import { classifyMessage } from '../services/spamDetector';

// ─── Theme ─────────────────────────────────────────────────────────────────
const T = {
  bg:         '#07070F',
  surface:    '#111122',
  surfaceHi:  '#181830',
  border:     'rgba(255,255,255,0.07)',
  text:       '#F0F0FF',
  textSub:    '#7B82A0',
  primary:    '#6C47FF',
  primaryGlow:'rgba(108,71,255,0.25)',
  accent:     '#00D4FF',
  success:    '#00CC7A',
  danger:     '#FF3B5C',
  dangerDim:  'rgba(255,59,92,0.10)',
  warn:       '#FFB800',
  bot:        '#A78BFA',
  botDim:     'rgba(167,139,250,0.12)',
};

const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

// ─── Screen states ──────────────────────────────────────────────────────────
const SCREEN = {
  CHECKING:   'checking_permissions',
  DENIED:     'permission_denied',
  LOADING:    'loading',
  ERROR:      'error',
  EMPTY:      'empty',
  LOADED:     'loaded',
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const todayStr = now.toDateString();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);

  if (d.toDateString() === todayStr) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const diff = Math.floor((now - d) / 86400000);
  if (diff < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

// ─── Gemini auto-reply ──────────────────────────────────────────────────────
async function callGeminiReply(contactName, address, recentMessages) {
  if (!GEMINI_KEY || GEMINI_KEY === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_KEY is not configured or is a placeholder.');
  }
  const history = recentMessages
    .slice(-6)
    .map(m => `${m.type === 2 ? 'Me' : (contactName || address)}: ${m.body}`)
    .join('\n');

  const prompt = `You are replying on behalf of the phone owner in a real SMS conversation.
Contact: ${contactName || address}
Recent conversation:
${history}

Write a SHORT, natural SMS reply (under 25 words). Sound like a real person, not a robot.
Reply only with the message text — nothing else.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.75, maxOutputTokens: 60 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  return raw.replace(/^["']|["']$/g, '').trim();
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function SmsInboxScreen({ navigation }) {
  const [screenState, setScreenState]   = useState(SCREEN.CHECKING);
  const [errorMsg, setErrorMsg]         = useState('');
  const [threads, setThreads]           = useState([]);
  const [activeTab, setActiveTab]       = useState('primary');
  const [search, setSearch]             = useState('');
  const [autoReply, setAutoReply]       = useState(true);
  const [statusMsg, setStatusMsg]       = useState('');
  const [refreshing, setRefreshing]     = useState(false);
  const [selectedThread, setThread]     = useState(null);
  const [modalOpen, setModalOpen]       = useState(false);
  const [replyText, setReplyText]       = useState('');
  const [sending, setSending]           = useState(false);

  const autoReplyRef     = useRef(autoReply);
  const processingSet    = useRef(new Set());
  const dotAnim          = useRef(new Animated.Value(1)).current;

  // Keep ref in sync so the SMS listener callback always has latest value
  useEffect(() => { autoReplyRef.current = autoReply; }, [autoReply]);

  // Pulse dot animation
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(dotAnim, { toValue: 0.2, duration: 900, useNativeDriver: true }),
      Animated.timing(dotAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, []);

  // ── Status toast helper ──────────────────────────────────────────────────
  const showStatus = useCallback((msg, durationMs = 4000) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), durationMs);
  }, []);

  // ── Permission request ───────────────────────────────────────────────────
  const requestPermissions = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setScreenState(SCREEN.DENIED);
      return false;
    }
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      PermissionsAndroid.PERMISSIONS.SEND_SMS,
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
    ]);
    return (
      granted['android.permission.READ_SMS']    === 'granted' &&
      granted['android.permission.SEND_SMS']    === 'granted'
    );
  }, []);

  // ── Load threads ─────────────────────────────────────────────────────────
  const loadThreads = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setScreenState(SCREEN.LOADING);
    else setRefreshing(true);

    try {
      const { threads: raw, error } = await getSmsThreads();

      if (error === 'PERMISSION_DENIED') {
        setScreenState(SCREEN.DENIED);
        return;
      }
      if (error) {
        setErrorMsg(error);
        setScreenState(SCREEN.ERROR);
        return;
      }

      // Apply spam classification
      const classified = raw.map(thread => {
        const cls = classifyMessage(thread.latestBody, thread.address);
        return { ...thread, isSpam: cls.isSpam, spamCategory: cls.category, spamReason: cls.reason };
      });

      if (classified.length === 0) {
        setScreenState(SCREEN.EMPTY);
      } else {
        setThreads(classified);
        setScreenState(SCREEN.LOADED);
      }
    } catch (e) {
      setErrorMsg(e?.message ?? 'Failed to load SMS');
      setScreenState(SCREEN.ERROR);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // ── Auto-reply logic ─────────────────────────────────────────────────────
  const doAutoReply = useCallback(async (incomingMsg) => {
    const addr = incomingMsg.address;
    if (processingSet.current.has(addr)) return;
    processingSet.current.add(addr);

    // Find thread (may not exist yet if first ever message from this contact)
    setThreads(prev => {
      const thread = prev.find(t => t.address === addr || t.threadId === incomingMsg.threadId);
      if (!thread || thread.isSpam) {
        processingSet.current.delete(addr);
        return prev;
      }
      return prev;
    });

    showStatus(`🤖 AI replying to ${incomingMsg.contactName || addr}…`);

    try {
      setThreads(prevThreads => {
        const thread = prevThreads.find(t => t.address === addr);
        if (!thread) { processingSet.current.delete(addr); return prevThreads; }
        if (thread.isSpam) { processingSet.current.delete(addr); return prevThreads; }

        // Fire Gemini async (we can't await inside setState, so use a promise chain)
        const msgs = [...(thread.messages || []), incomingMsg].sort((a, b) => a.date - b.date);
        callGeminiReply(thread.contactName, addr, msgs)
          .then(async replyBody => {
            if (!replyBody) throw new Error('Empty Gemini reply');
            const ok = await sendSmsDirect(addr, replyBody);
            if (ok) {
              const sentMsg = {
                id: `auto_${Date.now()}`,
                threadId: thread.threadId,
                address: addr,
                contactName: thread.contactName,
                body: replyBody,
                date: Date.now(),
                type: 2,
                read: 1,
                isAutoReply: true,
              };
              setThreads(p =>
                p.map(t => {
                  if (t.address !== addr) return t;
                  return {
                    ...t,
                    latestBody: replyBody,
                    latestDate: sentMsg.date,
                    messages: [sentMsg, incomingMsg, ...(t.messages || [])],
                  };
                }).sort((a, b) => b.latestDate - a.latestDate)
              );
              setThread(p => {
                if (!p || p.address !== addr) return p;
                return { ...p, messages: [sentMsg, incomingMsg, ...(p.messages || [])] };
              });
              showStatus(`✅ Auto-replied to ${thread.displayName}`);
            }
          })
          .catch(err => {
            console.error('[AutoReply] failed:', err);
            showStatus(`⚠️ Auto-reply failed for ${thread.displayName}`);
          })
          .finally(() => processingSet.current.delete(addr));

        return prevThreads;
      });
    } catch (e) {
      processingSet.current.delete(addr);
    }
  }, [showStatus]);

  // ── Initialise: permissions → load → start listener ──────────────────────
  useEffect(() => {
    let sub = null;

    const init = async () => {
      // In Expo Go, skip Android permission check
      if (!isExpoGo) {
        setScreenState(SCREEN.CHECKING);
        const ok = await requestPermissions();
        if (!ok) { setScreenState(SCREEN.DENIED); return; }
      }

      await loadThreads();
      startSmsListener();

      sub = addSmsListener(incomingMsg => {
        if (!incomingMsg?.address) return;
        const cls = classifyMessage(incomingMsg.body, incomingMsg.address);

        setThreads(prev => {
          const idx = prev.findIndex(t => t.address === incomingMsg.address);
          let next;
          if (idx >= 0) {
            next = prev.map((t, i) => {
              if (i !== idx) return t;
              return {
                ...t,
                latestBody: incomingMsg.body,
                latestDate: incomingMsg.date,
                unreadCount: t.unreadCount + 1,
                isSpam: cls.isSpam,
                spamCategory: cls.category,
                spamReason: cls.reason,
                messages: [incomingMsg, ...(t.messages || [])],
              };
            });
          } else {
            const newThread = {
              threadId: incomingMsg.threadId || incomingMsg.address,
              address: incomingMsg.address,
              contactName: incomingMsg.contactName || '',
              displayName: incomingMsg.contactName || incomingMsg.address,
              latestBody: incomingMsg.body,
              latestDate: incomingMsg.date,
              latestType: 1,
              unreadCount: 1,
              messages: [incomingMsg],
              isSpam: cls.isSpam,
              spamCategory: cls.category,
              spamReason: cls.reason,
            };
            next = [newThread, ...prev];
          }
          return next.sort((a, b) => b.latestDate - a.latestDate);
        });

        // Auto-reply only if enabled and message is not spam
        if (autoReplyRef.current && !cls.isSpam) {
          doAutoReply(incomingMsg);
        }
      });
    };

    init();
    return () => {
      sub?.remove?.();
      stopSmsListener();
    };
  }, []);

  // ── Manual send ──────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!replyText.trim() || !selectedThread || sending) return;
    setSending(true);
    try {
      const ok = await sendSmsDirect(selectedThread.address, replyText.trim());
      if (ok) {
        const msg = {
          id: `manual_${Date.now()}`,
          threadId: selectedThread.threadId,
          address: selectedThread.address,
          contactName: selectedThread.contactName,
          body: replyText.trim(),
          date: Date.now(),
          type: 2,
          read: 1,
          isAutoReply: false,
        };
        setThread(p => ({ ...p, messages: [msg, ...(p?.messages || [])] }));
        setThreads(p =>
          p.map(t => t.address !== selectedThread.address ? t : {
            ...t, latestBody: msg.body, latestDate: msg.date,
            messages: [msg, ...(t.messages || [])],
          }).sort((a, b) => b.latestDate - a.latestDate)
        );
        setReplyText('');
      }
    } catch (e) {
      Alert.alert('Send Failed', e?.message || 'Could not send message. Check permissions.');
    } finally {
      setSending(false);
    }
  };

  // ── Filtered view ────────────────────────────────────────────────────────
  const filtered = threads.filter(t => {
    const q = search.toLowerCase();
    const match = t.displayName.toLowerCase().includes(q) ||
                  t.address.toLowerCase().includes(q) ||
                  t.latestBody.toLowerCase().includes(q);
    if (!match) return false;
    if (activeTab === 'primary') return !t.isSpam;
    if (activeTab === 'spam')    return t.isSpam;
    return true;
  });

  const spamCount  = threads.filter(t => t.isSpam).length;
  const unread     = threads.filter(t => t.unreadCount > 0 && !t.isSpam).length;

  // ════════════════════════════════════════════════════════════════════════
  // RENDER — State machine
  // ════════════════════════════════════════════════════════════════════════

  // ── Checking permissions ─────────────────────────────────────────────────
  if (screenState === SCREEN.CHECKING) {
    return (
      <SafeAreaView style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={T.bg} />
        <View style={s.center}>
          <ActivityIndicator size="large" color={T.primary} />
          <Text style={s.centerText}>Checking permissions…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Permission denied ────────────────────────────────────────────────────
  if (screenState === SCREEN.DENIED) {
    return (
      <SafeAreaView style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={T.bg} />
        <View style={s.permBox}>
          <LinearGradient colors={[T.primary, T.accent]} style={s.permIcon}>
            <Ionicons name="chatbubble-ellipses" size={52} color="#FFF" />
          </LinearGradient>
          <Text style={s.permTitle}>SMS Access Required</Text>
          <Text style={s.permDesc}>
            Grant SMS permissions to read your messages, detect spam automatically, and let AI reply on your behalf.
          </Text>

          <View style={s.permStepsBox}>
            <Text style={s.permStep}>① Grant permissions below</Text>
            <Text style={s.permStep}>② Set AI Chat as your Default SMS App{'\n'}   Settings → Apps → Default Apps → SMS App</Text>
            <Text style={s.permStep}>③ Return here — your messages will load</Text>
          </View>

          <TouchableOpacity
            style={s.permBtn}
            onPress={async () => {
              const ok = await requestPermissions();
              if (ok) loadThreads();
              else setScreenState(SCREEN.DENIED);
            }}
          >
            <LinearGradient colors={[T.primary, '#4A2ECC']} style={s.permBtnGrad}>
              <Ionicons name="lock-open-outline" size={20} color="#FFF" />
              <Text style={s.permBtnText}>Grant Permissions</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (screenState === SCREEN.LOADING) {
    return (
      <SafeAreaView style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={T.bg} />
        <View style={s.center}>
          <ActivityIndicator size="large" color={T.primary} />
          <Text style={s.centerText}>Loading your messages…</Text>
          <Text style={[s.centerText, { fontSize: 12, marginTop: 6, color: T.textSub }]}>
            Resolving contacts and classifying spam
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (screenState === SCREEN.ERROR) {
    const isNativeMissing = errorMsg === 'NATIVE_MODULE_NOT_FOUND';
    return (
      <SafeAreaView style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={T.bg} />
        <View style={s.center}>
          <Ionicons name={isNativeMissing ? "hardware-chip-outline" : "alert-circle-outline"} size={56} color={T.danger} />
          <Text style={[s.centerText, { color: T.danger, fontWeight: '700', marginTop: 16 }]}>
            {isNativeMissing ? 'Native Module Missing' : 'Failed to Load Messages'}
          </Text>
          <Text style={[s.centerText, { fontSize: 13, marginTop: 8, color: T.textSub, paddingHorizontal: 30, lineHeight: 20 }]}>
            {isNativeMissing 
              ? 'The custom Android code for reading SMS was not linked into the APK during build. Please run a new EAS build to compile the native code.' 
              : errorMsg}
          </Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => loadThreads()}>
            <Text style={s.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Empty inbox ──────────────────────────────────────────────────────────
  if (screenState === SCREEN.EMPTY) {
    return (
      <SafeAreaView style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={T.bg} />
        <View style={s.center}>
          <Ionicons name="mail-open-outline" size={56} color={T.textSub} />
          <Text style={[s.centerText, { fontWeight: '700', marginTop: 16 }]}>No Messages Found</Text>
          <Text style={[s.centerText, { fontSize: 13, marginTop: 8, color: T.textSub, textAlign: 'center', lineHeight: 20, paddingHorizontal: 30 }]}>
            Your SMS inbox is empty, or this app is not set as the Default SMS App yet.{'\n\n'}
            Go to Settings → Apps → Default Apps → SMS App → select AI Chat
          </Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => loadThreads()}>
            <Text style={s.retryText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Loaded — main inbox view ─────────────────────────────────────────────
  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Messages</Text>
          <View style={s.liveRow}>
            <Animated.View style={[s.liveDot, { opacity: dotAnim }]} />
            <Text style={s.liveText}>
              {isExpoGo ? 'Demo mode' : 'Live monitoring'}
            </Text>
          </View>
        </View>
        <View style={s.headerRight}>
          <Text style={s.switchLabel}>AI Auto-Reply</Text>
          <Switch
            value={autoReply}
            onValueChange={setAutoReply}
            trackColor={{ false: '#2A2A40', true: T.primary }}
            thumbColor={autoReply ? T.accent : '#555'}
          />
        </View>
      </View>

      {/* Status toast */}
      {!!statusMsg && (
        <View style={s.toast}>
          <Text style={s.toastText}>{statusMsg}</Text>
        </View>
      )}

      {/* Stats bar */}
      <View style={s.stats}>
        {[
          { label: 'Contacts', value: threads.filter(t => !t.isSpam).length, color: T.text },
          { label: 'Spam', value: spamCount, color: T.danger },
          { label: 'Unread', value: unread, color: T.success },
        ].map((item, i) => (
          <React.Fragment key={item.label}>
            {i > 0 && <View style={s.statDivider} />}
            <View style={s.statItem}>
              <Text style={[s.statNum, { color: item.color }]}>{item.value}</Text>
              <Text style={s.statLabel}>{item.label}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {[
          { key: 'primary', label: '📩 Inbox' },
          { key: 'spam',    label: `🚨 Spam${spamCount > 0 ? ` (${spamCount})` : ''}` },
          { key: 'all',     label: '📂 All' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[s.tab, activeTab === tab.key && s.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={s.searchBar}>
        <Ionicons name="search" size={16} color={T.textSub} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, number or message…"
          placeholderTextColor={T.textSub}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={T.textSub} />
          </TouchableOpacity>
        )}
      </View>

      {/* Thread list */}
      <FlatList
        data={filtered}
        keyExtractor={t => t.threadId || t.address}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadThreads(true)}
            tintColor={T.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 30, paddingTop: 4 }}
        ListEmptyComponent={
          <View style={[s.center, { marginTop: 60 }]}>
            <Ionicons name="mail-open-outline" size={48} color={T.textSub} />
            <Text style={[s.centerText, { marginTop: 12 }]}>
              {activeTab === 'spam' ? 'No spam detected 🎉' : 'No results'}
            </Text>
          </View>
        }
        renderItem={({ item: thread }) => {
          const initials = thread.displayName.slice(0, 2).toUpperCase() || '??';
          const isContact = !!thread.contactName;
          return (
            <TouchableOpacity
              style={[s.card, thread.isSpam && s.cardSpam]}
              onPress={() => {
                setThread(thread);
                setModalOpen(true);
                setReplyText('');
              }}
              activeOpacity={0.75}
            >
              {/* Avatar */}
              {thread.isSpam ? (
                <LinearGradient colors={[T.danger, '#8B0000']} style={s.avatar}>
                  <Ionicons name="shield-alert" size={21} color="#FFF" />
                </LinearGradient>
              ) : isContact ? (
                <LinearGradient colors={[T.primary, T.accent]} style={s.avatar}>
                  <Text style={s.avatarText}>{initials}</Text>
                </LinearGradient>
              ) : (
                <View style={[s.avatar, s.avatarUnknown]}>
                  <Ionicons name="person-outline" size={21} color={T.textSub} />
                </View>
              )}

              <View style={s.cardBody}>
                <View style={s.cardRow}>
                  <Text style={s.cardName} numberOfLines={1}>
                    {thread.displayName}
                    {isContact && !thread.isSpam && (
                      <Text style={s.contactTag}>  ✓ Contact</Text>
                    )}
                  </Text>
                  {thread.isSpam
                    ? <View style={s.spamChip}><Text style={s.spamChipText}>{thread.spamCategory || 'SPAM'}</Text></View>
                    : thread.unreadCount > 0
                      ? <View style={s.unreadChip}><Text style={s.unreadChipText}>{thread.unreadCount}</Text></View>
                      : null
                  }
                  <Text style={s.cardTime}>{formatTime(thread.latestDate)}</Text>
                </View>
                <Text
                  style={[s.cardSnippet, thread.unreadCount > 0 && !thread.isSpam && s.cardSnippetUnread]}
                  numberOfLines={1}
                >
                  {thread.latestType === 2 ? '↗ You: ' : ''}{thread.latestBody}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Thread detail modal */}
      <Modal
        visible={modalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setModalOpen(false)}
      >
        {selectedThread && (
          <View style={s.modal}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={s.modalSheet}
            >
              {/* Modal header */}
              <LinearGradient colors={[T.surface, T.bg]} style={s.modalHeader}>
                <TouchableOpacity onPress={() => setModalOpen(false)} style={s.backBtn}>
                  <Ionicons name="arrow-back" size={24} color={T.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={s.modalName} numberOfLines={1}>
                    {selectedThread.displayName}
                  </Text>
                  <Text style={s.modalSub}>
                    {selectedThread.isSpam
                      ? `⚠️ ${selectedThread.spamCategory} — replies blocked`
                      : selectedThread.contactName
                        ? selectedThread.address
                        : 'Unknown number'
                    }
                  </Text>
                </View>
                <Ionicons
                  name={selectedThread.isSpam ? 'shield-alert' : 'shield-checkmark'}
                  size={22}
                  color={selectedThread.isSpam ? T.danger : T.success}
                />
              </LinearGradient>

              {/* Spam banner */}
              {selectedThread.isSpam && (
                <View style={s.spamBanner}>
                  <Ionicons name="warning" size={18} color={T.danger} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={s.spamBannerTitle}>Flagged — {selectedThread.spamCategory}</Text>
                    <Text style={s.spamBannerDesc}>{selectedThread.spamReason}</Text>
                    <Text style={[s.spamBannerDesc, { marginTop: 2 }]}>AI auto-reply is disabled for this sender.</Text>
                  </View>
                </View>
              )}

              {/* Auto-reply active banner */}
              {!selectedThread.isSpam && autoReply && (
                <View style={s.autoBanner}>
                  <Ionicons name="flash" size={14} color={T.bot} />
                  <Text style={s.autoBannerText}>
                    AI Auto-Reply is active for this contact
                  </Text>
                </View>
              )}

              {/* Messages */}
              <FlatList
                data={selectedThread.messages || []}
                inverted
                keyExtractor={m => m.id || `${m.date}_${m.type}`}
                contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
                renderItem={({ item: msg }) => {
                  const isSent = msg.type === 2;
                  return (
                    <View style={[s.bubbleWrap, isSent ? s.bubbleRight : s.bubbleLeft]}>
                      <View style={[s.bubble, isSent ? s.bubbleSent : s.bubbleRecv,
                        msg.isSpam && s.bubbleSpam]}>
                        <Text style={s.bubbleText}>{msg.body}</Text>
                        <View style={s.bubbleMeta}>
                          <Text style={s.bubbleTime}>{formatTime(msg.date)}</Text>
                          {msg.isAutoReply && (
                            <View style={s.aiTag}>
                              <Ionicons name="flash" size={8} color={T.bot} />
                              <Text style={s.aiTagText}>AI</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                }}
              />

              {/* Composer */}
              {selectedThread.isSpam ? (
                <View style={s.composerBlocked}>
                  <Ionicons name="lock-closed" size={15} color={T.textSub} />
                  <Text style={s.composerBlockedText}>Replies blocked — spam sender</Text>
                </View>
              ) : (
                <View style={s.composer}>
                  <TextInput
                    style={s.composerInput}
                    value={replyText}
                    onChangeText={setReplyText}
                    placeholder="Type a message…"
                    placeholderTextColor={T.textSub}
                    multiline
                    maxLength={800}
                  />
                  <TouchableOpacity
                    style={[s.sendBtn, (!replyText.trim() || sending) && s.sendBtnDim]}
                    onPress={handleSend}
                    disabled={!replyText.trim() || sending}
                  >
                    {sending
                      ? <ActivityIndicator size="small" color="#FFF" />
                      : <Ionicons name="send" size={19} color="#FFF" />
                    }
                  </TouchableOpacity>
                </View>
              )}
            </KeyboardAvoidingView>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { color: T.text, fontSize: 15, marginTop: 12, textAlign: 'center' },

  // Permission
  permBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  permIcon: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
    shadowColor: T.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 20,
  },
  permTitle: { fontSize: 22, fontWeight: '800', color: T.text, marginBottom: 10, textAlign: 'center' },
  permDesc: { fontSize: 14, color: T.textSub, textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  permStepsBox: {
    backgroundColor: T.surface, borderRadius: 14, padding: 16, width: '100%',
    borderWidth: 1, borderColor: T.border, marginBottom: 24,
  },
  permStep: { fontSize: 13, color: T.text, lineHeight: 20, marginBottom: 8 },
  permBtn: { width: '100%', borderRadius: 14, overflow: 'hidden' },
  permBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  permBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  retryBtn: {
    marginTop: 24, backgroundColor: T.surface, borderRadius: 12,
    paddingHorizontal: 32, paddingVertical: 14, borderWidth: 1, borderColor: T.border,
  },
  retryText: { color: T.primary, fontWeight: '700', fontSize: 15 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: T.text },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: T.success },
  liveText: { fontSize: 11, color: T.success, fontWeight: '600' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  switchLabel: { fontSize: 11, color: T.textSub, fontWeight: '600' },

  // Toast
  toast: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: 'rgba(108,71,255,0.18)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(108,71,255,0.35)',
  },
  toastText: { color: T.accent, fontSize: 12, fontWeight: '600' },

  // Stats
  stats: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 12,
    backgroundColor: T.surface, borderRadius: 14,
    borderWidth: 1, borderColor: T.border, paddingVertical: 12,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '800', color: T.text },
  statLabel: { fontSize: 11, color: T.textSub, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: T.border },

  // Tabs
  tabs: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 10,
    backgroundColor: T.surface, borderRadius: 12,
    borderWidth: 1, borderColor: T.border, padding: 4,
  },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 9 },
  tabActive: { backgroundColor: T.primary },
  tabText: { fontSize: 12, color: T.textSub, fontWeight: '600' },
  tabTextActive: { color: '#FFF', fontWeight: '700' },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: T.surface, borderRadius: 12,
    borderWidth: 1, borderColor: T.border, paddingHorizontal: 12, height: 44,
  },
  searchInput: { flex: 1, color: T.text, fontSize: 14 },

  // Thread card
  card: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: T.surface, borderRadius: 16,
    padding: 12, borderWidth: 1, borderColor: T.border,
  },
  cardSpam: { borderColor: 'rgba(255,59,92,0.2)', backgroundColor: 'rgba(15,5,10,0.9)' },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  avatarUnknown: { backgroundColor: T.surfaceHi, borderWidth: 1, borderColor: T.border },
  avatarText: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  cardBody: { flex: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  cardName: { flex: 1, fontSize: 15, fontWeight: '700', color: T.text, marginRight: 6 },
  contactTag: { fontSize: 10, color: T.success, fontWeight: '600' },
  cardTime: { fontSize: 11, color: T.textSub },
  cardSnippet: { fontSize: 13, color: T.textSub, lineHeight: 18 },
  cardSnippetUnread: { color: T.text, fontWeight: '600' },
  spamChip: {
    backgroundColor: T.danger, borderRadius: 5,
    paddingHorizontal: 5, paddingVertical: 1, marginRight: 6,
  },
  spamChipText: { color: '#FFF', fontSize: 8, fontWeight: '800' },
  unreadChip: {
    backgroundColor: T.primary, borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 1, marginRight: 6, minWidth: 20, alignItems: 'center',
  },
  unreadChipText: { color: '#FFF', fontSize: 10, fontWeight: '700' },

  // Modal
  modal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' },
  modalSheet: {
    flex: 1, marginTop: 44, backgroundColor: T.bg,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderWidth: 1, borderColor: T.border, overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderColor: T.border,
  },
  backBtn: { padding: 6, marginRight: 10 },
  modalName: { fontSize: 17, fontWeight: '700', color: T.text },
  modalSub: { fontSize: 11, color: T.textSub, marginTop: 1 },

  spamBanner: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: T.dangerDim, padding: 14,
    borderBottomWidth: 1, borderColor: 'rgba(255,59,92,0.2)',
  },
  spamBannerTitle: { color: T.danger, fontWeight: '700', fontSize: 13 },
  spamBannerDesc: { color: T.textSub, fontSize: 11, lineHeight: 16, marginTop: 1 },

  autoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: T.botDim, paddingHorizontal: 14, paddingVertical: 9,
    borderBottomWidth: 1, borderColor: 'rgba(167,139,250,0.2)',
  },
  autoBannerText: { flex: 1, fontSize: 11, color: T.bot },

  // Bubbles
  bubbleWrap: { marginBottom: 10 },
  bubbleLeft: { alignSelf: 'flex-start', maxWidth: '82%' },
  bubbleRight: { alignSelf: 'flex-end', maxWidth: '82%' },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleSent: { backgroundColor: T.primary, borderTopRightRadius: 4 },
  bubbleRecv: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderTopLeftRadius: 4 },
  bubbleSpam: { borderColor: 'rgba(255,59,92,0.3)' },
  bubbleText: { fontSize: 14, color: T.text, lineHeight: 20 },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 4 },
  bubbleTime: { fontSize: 9, color: 'rgba(255,255,255,0.45)' },
  aiTag: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: 'rgba(167,139,250,0.2)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1,
  },
  aiTagText: { fontSize: 8, color: T.bot, fontWeight: '700' },

  // Composer
  composer: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12,
    borderTopWidth: 1, borderColor: T.border, backgroundColor: 'rgba(10,10,20,0.98)',
  },
  composerInput: {
    flex: 1, backgroundColor: T.surface, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, maxHeight: 110,
    color: T.text, fontSize: 14, borderWidth: 1, borderColor: T.border,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDim: { backgroundColor: 'rgba(108,71,255,0.3)' },
  composerBlocked: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 18, borderTopWidth: 1, borderColor: T.border,
    backgroundColor: 'rgba(10,10,20,0.98)',
  },
  composerBlockedText: { color: T.textSub, fontSize: 13, fontWeight: '500' },
});
