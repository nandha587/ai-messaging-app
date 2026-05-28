import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

export default function ProfileSetupScreen({ navigation }) {
  const { updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleDone = async () => {
    if (!displayName.trim()) {
      Alert.alert('Name Required', 'Please enter your display name.');
      return;
    }
    setIsLoading(true);
    try {
      await updateProfile({ displayName: displayName.trim(), statusMessage: statusMessage.trim() });
      navigation.replace('ChatList');
    } catch (e) {
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => navigation.replace('ChatList');

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor="#0F0F1A" />
      <LinearGradient colors={['#0F0F1A', '#1A0A2E', '#0F0F1A']} style={StyleSheet.absoluteFillObject} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        <View style={styles.avatarSection}>
          <LinearGradient colors={['#7C3AED', '#DB2777']} style={styles.avatar}>
            <Text style={styles.avatarEmoji}>👤</Text>
          </LinearGradient>
          <Text style={styles.avatarHint}>Your Profile Photo</Text>
        </View>

        <Text style={styles.title}>Set Up Your Profile</Text>
        <Text style={styles.subtitle}>Tell others who you are</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Display Name *</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Enter your name"
            placeholderTextColor="#4A4A6A"
            maxLength={50}
            autoFocus
          />

          <Text style={[styles.label, { marginTop: 20 }]}>Status Message</Text>
          <TextInput
            style={styles.input}
            value={statusMessage}
            onChangeText={setStatusMessage}
            placeholder="Hey, I am using AI Chat!"
            placeholderTextColor="#4A4A6A"
            maxLength={100}
          />
        </View>

        <TouchableOpacity onPress={handleDone} disabled={isLoading} style={styles.doneBtn}>
          <LinearGradient
            colors={isLoading ? ['#3D3D5C', '#3D3D5C'] : ['#7C3AED', '#DB2777']}
            style={styles.doneBtnGradient}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            <Text style={styles.doneBtnText}>{isLoading ? 'Saving...' : 'Done'}</Text>
            {!isLoading && <Ionicons name="checkmark" size={20} color="#fff" style={{ marginLeft: 8 }} />}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F1A' },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 60 },
  skipBtn: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 4 },
  skipText: { color: '#7C3AED', fontSize: 15, fontWeight: '600' },
  avatarSection: { alignItems: 'center', marginTop: 24, marginBottom: 32 },
  avatar: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarEmoji: { fontSize: 44 },
  avatarHint: { color: '#5A5A7A', fontSize: 13 },
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#7C7C9C', textAlign: 'center', marginBottom: 32 },
  card: { backgroundColor: '#16162A', borderRadius: 20, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: '#2A2A45' },
  label: { fontSize: 13, color: '#7C3AED', fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  input: { backgroundColor: '#1E1E38', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: '#FFFFFF', fontSize: 16, borderWidth: 1, borderColor: '#2A2A45' },
  doneBtn: { borderRadius: 16, overflow: 'hidden', shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 12 },
  doneBtnGradient: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  doneBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
