import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

export default function OnlineStatus({ isOnline, lastSeen, showText = true }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isOnline) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.6, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isOnline]);

  const formatLastSeen = (ts) => {
    if (!ts) return 'Offline';
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toDateString();
  };

  return (
    <View style={styles.row}>
      <View style={styles.dotWrapper}>
        {isOnline && (
          <Animated.View style={[styles.pulse, { transform: [{ scale: pulseAnim }] }]} />
        )}
        <View style={[styles.dot, { backgroundColor: isOnline ? '#22C55E' : '#4A4A6A' }]} />
      </View>
      {showText && (
        <Text style={[styles.text, { color: isOnline ? '#22C55E' : '#5A5A7A' }]}>
          {isOnline ? 'Online' : formatLastSeen(lastSeen)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dotWrapper: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, position: 'absolute' },
  pulse: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#22C55E', opacity: 0.3, position: 'absolute' },
  text: { fontSize: 12 },
});
