import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

function SkeletonChip() {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[styles.skeletonChip, { opacity: shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] }) }]} />
  );
}

export default function AISuggestionBar({ suggestions, onSelect, onDismiss, isLoading = false }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
    ]).start();
  }, [suggestions]);

  const handleSelect = (suggestion) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(suggestion);
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.sparkle}>✨</Text>
          <Text style={styles.label}>AI Suggestions</Text>
        </View>
        <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn}>
          <Ionicons name="close" size={16} color="#5A5A7A" />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {isLoading ? (
          <>
            <SkeletonChip />
            <SkeletonChip />
            <SkeletonChip />
          </>
        ) : (
          suggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleSelect(suggestion)}
              activeOpacity={0.75}
            >
              <LinearGradient
                colors={['#7C3AED15', '#DB287715']}
                style={styles.chip}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <View style={styles.chipInner}>
                  <Text style={styles.chipText}>{suggestion}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F0F1A',
    borderTopWidth: 1, borderTopColor: '#1E1E38',
    paddingTop: 10, paddingBottom: 6,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sparkle: { fontSize: 14 },
  label: { fontSize: 12, color: '#7C3AED', fontWeight: '700', letterSpacing: 0.5 },
  dismissBtn: { padding: 4 },
  chipRow: { paddingHorizontal: 12, gap: 8 },
  chip: {
    borderRadius: 20, padding: 1.5,
    borderWidth: 1, borderColor: '#7C3AED40',
  },
  chipInner: { paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { color: '#E0E0F0', fontSize: 13, fontWeight: '500' },
  skeletonChip: {
    width: 120, height: 36, borderRadius: 20,
    backgroundColor: '#2A2A45',
  },
});
