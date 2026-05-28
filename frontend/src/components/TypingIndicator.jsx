import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

export default function TypingIndicator({ name }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  const animateDot = (anim, delay) =>
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: -6, duration: 280, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.delay(500),
      ])
    );

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    animateDot(dot1, 0).start();
    animateDot(dot2, 150).start();
    animateDot(dot3, 300).start();
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fade }]}>
      <View style={styles.bubble}>
        <Text style={styles.name}>{name} is typing</Text>
        <View style={styles.dots}>
          {[dot1, dot2, dot3].map((anim, i) => (
            <Animated.View key={i} style={[styles.dot, { transform: [{ translateY: anim }] }]} />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 4 },
  bubble: {
    backgroundColor: '#1E1E38', borderRadius: 18, borderBottomLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  name: { color: '#7C7C9C', fontSize: 12, fontStyle: 'italic' },
  dots: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#7C3AED' },
});
