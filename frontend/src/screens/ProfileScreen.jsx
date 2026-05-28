import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, StatusBar, Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

export default function ProfileScreen({ navigation }) {
  const { user, logout, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]
    );
  };

  const handleExport = async () => {
    try {
      await Share.share({
        message: `AI Chat Export\nUser: ${user?.displayName}\nPhone: ${user?.phone}\nMember since: ${user?.createdAt ? new Date(user.createdAt).toDateString() : 'N/A'}`,
        title: 'AI Chat Profile Export',
      });
    } catch { }
  };

  const getInitials = (name = '') =>
    name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

  const InfoRow = ({ icon, label, value }) => (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={18} color="#7C3AED" />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || '—'}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0F0F1A" />
      <LinearGradient colors={['#0F0F1A', '#1A0A2E', '#0F0F1A']} style={StyleSheet.absoluteFillObject} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.settingsBtn}>
          <Ionicons name="settings-outline" size={22} color="#7C3AED" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            <LinearGradient colors={['#7C3AED', '#DB2777']} style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(user?.displayName)}</Text>
            </LinearGradient>
            <View style={styles.onlineDot} />
          </View>
          <Text style={styles.displayName}>{user?.displayName || 'User'}</Text>
          <Text style={styles.statusMessage}>{user?.statusMessage || 'Hey, I am using AI Chat!'}</Text>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate('ProfileSetup')}
          >
            <Ionicons name="pencil-outline" size={14} color="#7C3AED" style={{ marginRight: 4 }} />
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account Info</Text>
          <InfoRow icon="call-outline" label="Phone" value={user?.phone} />
          <View style={styles.divider} />
          <InfoRow icon="person-outline" label="Name" value={user?.displayName} />
          <View style={styles.divider} />
          <InfoRow icon="calendar-outline" label="Member Since"
            value={user?.createdAt ? new Date(user.createdAt).toDateString() : 'N/A'} />
        </View>

        {/* Actions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Data</Text>
          <TouchableOpacity style={styles.actionRow} onPress={handleExport}>
            <Ionicons name="share-outline" size={20} color="#7C3AED" />
            <Text style={styles.actionText}>Export Profile</Text>
            <Ionicons name="chevron-forward" size={18} color="#3D3D5C" />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F1A' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  settingsBtn: { padding: 4 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', paddingVertical: 32 },
  avatarWrapper: { position: 'relative', marginBottom: 16 },
  avatar: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 16, elevation: 16,
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 36 },
  onlineDot: {
    position: 'absolute', bottom: 4, right: 4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#22C55E', borderWidth: 3, borderColor: '#0F0F1A',
  },
  displayName: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
  statusMessage: { fontSize: 14, color: '#7C7C9C', marginBottom: 16 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#7C3AED40', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  editBtnText: { color: '#7C3AED', fontSize: 14, fontWeight: '600' },
  card: {
    backgroundColor: '#16162A', borderRadius: 20, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: '#2A2A45',
  },
  cardTitle: { fontSize: 13, color: '#7C3AED', fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  infoIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#7C3AED20', alignItems: 'center', justifyContent: 'center',
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, color: '#5A5A7A', marginBottom: 2 },
  infoValue: { fontSize: 15, color: '#FFFFFF', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#1E1E38', marginVertical: 14 },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  actionText: { flex: 1, color: '#CCCCDD', fontSize: 15 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#EF444415', borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: '#EF444430',
  },
  logoutText: { color: '#EF4444', fontSize: 16, fontWeight: '700' },
});
