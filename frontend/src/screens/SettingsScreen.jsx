import React, { useState } from 'react';
import {
  View, Text, Switch, TouchableOpacity, StyleSheet,
  SectionList, StatusBar, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export default function SettingsScreen({ navigation }) {
  const { isDark, toggleTheme } = useTheme();
  const { logout } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [readReceiptsEnabled, setReadReceiptsEnabled] = useState(true);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => Alert.alert('Info', 'Contact support to delete your account.') },
      ]
    );
  };

  const SettingRow = ({ icon, label, value, onPress, showArrow = true, color = '#CCCCDD', danger = false }) => (
    <TouchableOpacity style={styles.settingRow} onPress={onPress} disabled={!onPress}>
      <View style={[styles.settingIcon, danger && styles.settingIconDanger]}>
        <Ionicons name={icon} size={18} color={danger ? '#EF4444' : '#7C3AED'} />
      </View>
      <Text style={[styles.settingLabel, danger && styles.settingLabelDanger]}>{label}</Text>
      {value !== undefined ? (
        <Switch
          value={value}
          onValueChange={onPress}
          trackColor={{ false: '#2A2A45', true: '#7C3AED' }}
          thumbColor={value ? '#FFFFFF' : '#5A5A7A'}
        />
      ) : showArrow ? (
        <Ionicons name="chevron-forward" size={18} color="#3D3D5C" />
      ) : null}
    </TouchableOpacity>
  );

  const sections = [
    {
      title: 'Appearance',
      data: [
        { key: 'darkMode', icon: isDark ? 'moon' : 'sunny', label: isDark ? 'Dark Mode' : 'Light Mode', value: isDark, onPress: toggleTheme },
      ],
    },
    {
      title: 'Notifications',
      data: [
        { key: 'notifs', icon: 'notifications-outline', label: 'Push Notifications', value: notificationsEnabled, onPress: setNotificationsEnabled },
        { key: 'receipts', icon: 'checkmark-done-outline', label: 'Read Receipts', value: readReceiptsEnabled, onPress: setReadReceiptsEnabled },
      ],
    },
    {
      title: 'Account',
      data: [
        { key: 'editProfile', icon: 'person-outline', label: 'Edit Profile', onPress: () => navigation.navigate('ProfileSetup') },
        { key: 'exportChats', icon: 'download-outline', label: 'Export All Chats', onPress: () => Alert.alert('Export', 'Chat export initiated.') },
        { key: 'clearCache', icon: 'trash-outline', label: 'Clear Cache', onPress: () => Alert.alert('Cleared', 'Cache cleared successfully.') },
      ],
    },
    {
      title: 'About',
      data: [
        { key: 'version', icon: 'information-circle-outline', label: 'Version 1.0.0', onPress: null, showArrow: false },
        { key: 'terms', icon: 'document-text-outline', label: 'Terms of Service', onPress: () => {} },
        { key: 'privacy', icon: 'shield-outline', label: 'Privacy Policy', onPress: () => {} },
      ],
    },
    {
      title: 'Danger Zone',
      data: [
        { key: 'deleteAccount', icon: 'warning-outline', label: 'Delete Account', onPress: handleDeleteAccount, danger: true },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0F0F1A" />
      <LinearGradient colors={['#0F0F1A', '#1A0A2E', '#0F0F1A']} style={StyleSheet.absoluteFillObject} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 32 }} />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={item => item.key}
        renderItem={({ item }) => (
          <SettingRow
            icon={item.icon}
            label={item.label}
            value={item.value}
            onPress={item.onPress}
            showArrow={item.showArrow !== false}
            danger={item.danger}
          />
        )}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.sectionHeader}>{title}</Text>
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
      />
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
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionHeader: {
    fontSize: 12, color: '#5A5A7A', fontWeight: '700',
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginTop: 28, marginBottom: 10, marginLeft: 4,
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#16162A', padding: 16,
    borderRadius: 14, marginBottom: 2,
    borderWidth: 1, borderColor: '#2A2A45',
  },
  settingIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#7C3AED20', alignItems: 'center', justifyContent: 'center',
  },
  settingIconDanger: { backgroundColor: '#EF444420' },
  settingLabel: { flex: 1, color: '#CCCCDD', fontSize: 15 },
  settingLabelDanger: { color: '#EF4444' },
});
