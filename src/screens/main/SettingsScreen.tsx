import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';

export default function SettingsScreen() {
  const { profile, user, signOut } = useAuth();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>सेटिंग्स</Text>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(profile?.full_name ?? '?').charAt(0).toUpperCase()}</Text>
        </View>
        <View>
          <Text style={styles.name}>{profile?.full_name ?? 'यूज़र'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={signOut} activeOpacity={0.8}>
        <Text style={styles.signOutText}>लॉगआउट करें</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1220' },
  header: { paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  name: { color: '#fff', fontSize: 16, fontWeight: '700' },
  email: { color: '#94A3B8', fontSize: 13, marginTop: 3 },
  signOutButton: {
    marginHorizontal: 20,
    backgroundColor: '#DC2626',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
