// src/screens/SplashScreen.jsx
// Animated splash screen with auth check

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');

export default function SplashScreen({ navigation }) {
  const { isAuthenticated, isLoading } = useAuth();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const taglineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start entrance animation
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.timing(taglineAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    });
  }, []);

  // Navigate after loading resolves
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => {
        if (isAuthenticated) {
          navigation.replace('ChatList');
        } else {
          navigation.replace('PhoneLogin');
        }
      }, 1800); // small delay so the splash is visible
      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated, navigation]);

  return (
    <View style={styles.container}>
      {/* Background */}
      <LinearGradient
        colors={['#0F0F1A', '#130D2A', '#0F0F1A']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Decorative glow */}
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      {/* Logo section */}
      <Animated.View
        style={[
          styles.logoContainer,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* Icon bubble */}
        <LinearGradient
          colors={['#7C3AED', '#DB2777']}
          style={styles.iconGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.iconEmoji}>💬</Text>
        </LinearGradient>

        {/* Brand name */}
        <Text style={styles.brandName}>AI Chat</Text>

        {/* Tagline */}
        <Animated.Text style={[styles.tagline, { opacity: taglineAnim }]}>
          Smarter conversations, powered by AI
        </Animated.Text>
      </Animated.View>

      {/* Loading indicator */}
      {isLoading && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="small" color="#7C3AED" />
        </View>
      )}

      {/* Version */}
      <Animated.Text style={[styles.version, { opacity: taglineAnim }]}>
        v1.0.0
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowTop: {
    position: 'absolute',
    top: -100,
    left: width / 2 - 150,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -80,
    right: width / 2 - 120,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(219, 39, 119, 0.10)',
  },
  logoContainer: {
    alignItems: 'center',
    gap: 16,
  },
  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 16,
  },
  iconEmoji: {
    fontSize: 48,
  },
  brandName: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginTop: 8,
  },
  tagline: {
    fontSize: 14,
    color: '#A0A0C0',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  loaderContainer: {
    position: 'absolute',
    bottom: height * 0.15,
  },
  version: {
    position: 'absolute',
    bottom: 40,
    fontSize: 11,
    color: '#404060',
    letterSpacing: 1,
  },
});
