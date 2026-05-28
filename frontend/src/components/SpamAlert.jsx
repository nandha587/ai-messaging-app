import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function SpamAlert({ reason }) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        <Ionicons name="shield-checkmark-outline" size={18} color="#EF4444" />
      </View>
      <View style={styles.textWrapper}>
        <Text style={styles.title}>Message blocked due to unsafe or spam content.</Text>
        {reason && <Text style={styles.reason}>{reason}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#EF444410', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#EF444425', marginVertical: 4,
    maxWidth: '85%', alignSelf: 'center',
  },
  iconWrapper: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: '#EF444420', alignItems: 'center', justifyContent: 'center',
  },
  textWrapper: { flex: 1 },
  title: { color: '#EF4444', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  reason: { color: '#EF444488', fontSize: 11, marginTop: 3 },
});
