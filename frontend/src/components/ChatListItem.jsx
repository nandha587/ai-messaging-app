import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

function hashColor(name = '') {
  const colors = [
    ['#7C3AED', '#9B3EC8'], ['#DB2777', '#E84A9B'], ['#0EA5E9', '#0284C7'],
    ['#10B981', '#059669'], ['#F59E0B', '#D97706'], ['#EF4444', '#DC2626'],
    ['#8B5CF6', '#7C3AED'], ['#06B6D4', '#0891B2'],
  ];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}

function smartTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ChatListItem({ chat, currentUid, onPress, onLongPress }) {
  const otherUser = chat.otherUser || {};
  const name = otherUser.displayName || 'Unknown';
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  const avatarColors = hashColor(name);
  const lastMsg = chat.lastMessage ? chat.lastMessage.slice(0, 40) + (chat.lastMessage.length > 40 ? '…' : '') : 'Start chatting';
  const unread = chat.unreadCount || 0;
  const isOnline = chat.isOtherOnline || false;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.75}
    >
      {/* Avatar */}
      <View style={styles.avatarWrapper}>
        <LinearGradient colors={avatarColors} style={styles.avatar}>
          <Text style={styles.initials}>{initials}</Text>
        </LinearGradient>
        {isOnline && <View style={styles.onlineDot} />}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.nameRow}>
            {chat.isPinned && (
              <Ionicons name="pin" size={12} color="#7C3AED" style={{ marginRight: 4 }} />
            )}
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
          </View>
          <Text style={styles.time}>{smartTime(chat.lastMessageAt)}</Text>
        </View>
        <View style={styles.bottomRow}>
          <Text style={[styles.preview, unread > 0 && styles.previewUnread]} numberOfLines={1}>
            {lastMsg}
          </Text>
          {unread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#16162A',
  },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#FFFFFF', fontWeight: '700', fontSize: 18 },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 13, height: 13, borderRadius: 7,
    backgroundColor: '#22C55E', borderWidth: 2.5, borderColor: '#0F0F1A',
  },
  content: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  name: { color: '#FFFFFF', fontWeight: '700', fontSize: 15, flex: 1 },
  time: { color: '#5A5A7A', fontSize: 12 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  preview: { color: '#7C7C9C', fontSize: 13, flex: 1, marginRight: 8 },
  previewUnread: { color: '#CCCCDD', fontWeight: '500' },
  badge: {
    backgroundColor: '#7C3AED', borderRadius: 10,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
});
