import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, StatusBar, RefreshControl, Modal, Alert,
  Animated, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useChatStore } from '../store/chatStore';
import ChatListItem from '../components/ChatListItem';
import { api } from '../services/api';
import { getSocket } from '../services/socket';

export default function ChatListScreen({ navigation }) {
  const { user } = useAuth();
  const { chats, setChats, updateChatLastMessage } = useChatStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [phoneSearch, setPhoneSearch] = useState('');
  const [searchedUser, setSearchedUser] = useState(null);
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const searchBarWidth = useRef(new Animated.Value(0)).current;

  const chatList = Array.from(chats.values()).sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0);
  });

  const filtered = searchQuery
    ? chatList.filter(c =>
        (c.otherUser?.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.lastMessage || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : chatList;

  const pinned = filtered.filter(c => c.isPinned);
  const regular = filtered.filter(c => !c.isPinned);

  const loadChats = useCallback(async () => {
    try {
      const res = await api.get('/chats');
      const chatMap = new Map();
      (res.data.chats || []).forEach(c => chatMap.set(c.id, c));
      setChats(chatMap);
    } catch (err) {
      console.error('Load chats error:', err.message);
    }
  }, []);

  useEffect(() => {
    loadChats();
    const socket = getSocket();
    if (socket) {
      socket.on('message:received', (msg) => {
        updateChatLastMessage(msg.chatId, msg.content, msg.createdAt);
      });
    }
    return () => {
      const s = getSocket();
      if (s) s.off('message:received');
    };
  }, []);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadChats();
    setIsRefreshing(false);
  };

  const animateSearch = (focused) => {
    Animated.timing(searchBarWidth, {
      toValue: focused ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
    setIsSearchFocused(focused);
  };

  const handleSearchUser = async () => {
    if (!phoneSearch.trim()) return;
    setIsSearchingUser(true);
    try {
      const res = await api.get(`/users/search?phone=${encodeURIComponent(phoneSearch.trim())}`);
      setSearchedUser(res.data.user);
    } catch {
      Alert.alert('Not Found', 'No user found with that phone number.');
      setSearchedUser(null);
    } finally {
      setIsSearchingUser(false);
    }
  };

  const handleStartChat = async (targetUser) => {
    try {
      const res = await api.post('/chats/create', { participantId: targetUser.uid });
      setShowNewChatModal(false);
      setPhoneSearch('');
      setSearchedUser(null);
      navigation.navigate('Chat', { chatId: res.data.chatId, otherUser: targetUser });
    } catch (err) {
      Alert.alert('Error', 'Could not start chat. Please try again.');
    }
  };

  const getInitials = (name = '') =>
    name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity
            style={styles.smsSyncBtn}
            onPress={() => navigation.navigate('SmsInbox')}
          >
            <LinearGradient colors={['#8A57FF', '#00F2FE']} style={styles.headerSmsIcon}>
              <Ionicons name="mail-unread-outline" size={20} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => navigation.navigate('Profile')}
          >
            <LinearGradient colors={['#7C3AED', '#DB2777']} style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>{getInitials(user?.displayName)}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#5A5A7A" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search conversations..."
            placeholderTextColor="#4A4A6A"
            onFocus={() => animateSearch(true)}
            onBlur={() => animateSearch(false)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#5A5A7A" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Pinned section */}
      {pinned.length > 0 && (
        <View style={styles.pinnedSection}>
          <Text style={styles.sectionLabel}>📌 Pinned</Text>
        </View>
      )}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>💬</Text>
      <Text style={styles.emptyTitle}>No conversations yet</Text>
      <Text style={styles.emptySubtitle}>Tap the + button to start chatting</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0F0F1A" />
      <LinearGradient colors={['#0F0F1A', '#0F0F1A']} style={StyleSheet.absoluteFillObject} />

      <FlatList
        data={[...pinned, ...regular]}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ChatListItem
            chat={item}
            currentUid={user?.uid}
            onPress={() => navigation.navigate('Chat', { chatId: item.id, otherUser: item.otherUser })}
            onLongPress={() => {}}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#7C3AED" />
        }
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowNewChatModal(true)}>
        <LinearGradient colors={['#7C3AED', '#DB2777']} style={styles.fabGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Ionicons name="create-outline" size={24} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>

      {/* New Chat Modal */}
      <Modal visible={showNewChatModal} transparent animationType="slide" onRequestClose={() => setShowNewChatModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowNewChatModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>New Conversation</Text>
            <Text style={styles.modalSubtitle}>Search by phone number</Text>

            <View style={styles.phoneRow}>
              <TextInput
                style={styles.phoneInput}
                value={phoneSearch}
                onChangeText={setPhoneSearch}
                placeholder="+1 234 567 8900"
                placeholderTextColor="#4A4A6A"
                keyboardType="phone-pad"
                autoFocus
              />
              <TouchableOpacity style={styles.searchBtn} onPress={handleSearchUser} disabled={isSearchingUser}>
                <LinearGradient colors={['#7C3AED', '#DB2777']} style={styles.searchBtnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Ionicons name="search" size={18} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {searchedUser && (
              <TouchableOpacity style={styles.userResult} onPress={() => handleStartChat(searchedUser)}>
                <LinearGradient colors={['#7C3AED', '#DB2777']} style={styles.resultAvatar}>
                  <Text style={styles.resultAvatarText}>
                    {(searchedUser.displayName || '?').slice(0, 2).toUpperCase()}
                  </Text>
                </LinearGradient>
                <View style={styles.resultInfo}>
                  <Text style={styles.resultName}>{searchedUser.displayName}</Text>
                  <Text style={styles.resultPhone}>{searchedUser.phone}</Text>
                </View>
                <Ionicons name="chatbubble-outline" size={22} color="#7C3AED" />
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F1A' },
  listContent: { paddingBottom: 100 },
  emptyContainer: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#FFFFFF' },
  avatarBtn: { padding: 2 },
  smsSyncBtn: { padding: 2 },
  headerSmsIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  searchRow: { marginBottom: 16 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#16162A', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: '#2A2A45',
  },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 15 },
  pinnedSection: { marginBottom: 4 },
  sectionLabel: { color: '#7C7C9C', fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyEmoji: { fontSize: 64, marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#5A5A7A' },
  fab: {
    position: 'absolute', bottom: 28, right: 24,
    shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 16,
  },
  fabGradient: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#16162A', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 48 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#2A2A45', borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
  modalSubtitle: { fontSize: 14, color: '#5A5A7A', marginBottom: 24 },
  phoneRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  phoneInput: {
    flex: 1, backgroundColor: '#1E1E38', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, color: '#FFFFFF', fontSize: 16,
    borderWidth: 1, borderColor: '#2A2A45',
  },
  searchBtn: { borderRadius: 12, overflow: 'hidden' },
  searchBtnGradient: { paddingHorizontal: 18, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  userResult: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1E38',
    borderRadius: 16, padding: 16, gap: 14, borderWidth: 1, borderColor: '#7C3AED40',
  },
  resultAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  resultAvatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  resultInfo: { flex: 1 },
  resultName: { color: '#FFFFFF', fontWeight: '700', fontSize: 16, marginBottom: 2 },
  resultPhone: { color: '#7C7C9C', fontSize: 13 },
});
