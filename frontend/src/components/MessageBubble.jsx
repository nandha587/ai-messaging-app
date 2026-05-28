import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Alert, Clipboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

function formatTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessageBubble({ message, isSent }) {
  const slideAnim = useRef(new Animated.Value(isSent ? 30 : -30)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleLongPress = () => {
    Alert.alert('Message', undefined, [
      { text: 'Copy', onPress: () => Clipboard.setString(message.content) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  if (message.isBlocked) {
    return (
      <Animated.View style={[styles.blockedContainer, { opacity: fadeAnim }]}>
        <View style={styles.blockedBubble}>
          <Ionicons name="shield-outline" size={14} color="#EF4444" style={{ marginRight: 6 }} />
          <Text style={styles.blockedText}>Message blocked due to unsafe or spam content.</Text>
        </View>
      </Animated.View>
    );
  }

  const StatusIcon = () => {
    if (!isSent) return null;
    if (message.status === 'read') {
      return <Ionicons name="checkmark-done" size={13} color="#7C3AED" />;
    }
    if (message.status === 'delivered') {
      return <Ionicons name="checkmark-done" size={13} color="#7C7C9C" />;
    }
    return <Ionicons name="checkmark" size={13} color="#7C7C9C" />;
  };

  return (
    <Animated.View
      style={[
        styles.row,
        isSent ? styles.rowSent : styles.rowReceived,
        { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
      ]}
    >
      <TouchableOpacity
        onLongPress={handleLongPress}
        delayLongPress={400}
        activeOpacity={0.85}
      >
        {isSent ? (
          <LinearGradient
            colors={['#7C3AED', '#9B3EC8']}
            style={[styles.bubble, styles.bubbleSent]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            <Text style={styles.messageSent}>{message.content}</Text>
            <View style={styles.meta}>
              <Text style={styles.timeSent}>{formatTime(message.createdAt)}</Text>
              <StatusIcon />
            </View>
          </LinearGradient>
        ) : (
          <View style={[styles.bubble, styles.bubbleReceived]}>
            <Text style={styles.messageReceived}>{message.content}</Text>
            <Text style={styles.timeReceived}>{formatTime(message.createdAt)}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { marginVertical: 2 },
  rowSent: { alignItems: 'flex-end' },
  rowReceived: { alignItems: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8 },
  bubbleSent: { borderBottomRightRadius: 4, shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 6 },
  bubbleReceived: { backgroundColor: '#1E1E38', borderBottomLeftRadius: 4 },
  messageSent: { color: '#FFFFFF', fontSize: 15, lineHeight: 21 },
  messageReceived: { color: '#E0E0F0', fontSize: 15, lineHeight: 21 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 },
  timeSent: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  timeReceived: { fontSize: 11, color: '#5A5A7A', marginTop: 4, textAlign: 'right' },
  blockedContainer: { alignItems: 'center', marginVertical: 4 },
  blockedBubble: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EF444415', borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: '#EF444430', maxWidth: '85%',
  },
  blockedText: { color: '#EF4444', fontSize: 13, flex: 1 },
});
