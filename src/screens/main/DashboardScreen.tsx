import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';

export default function DashboardScreen() {
  const { profile } = useAuth();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.greeting}>नमस्ते, {profile?.full_name ?? 'दोस्त'} 👋</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>आपका VoiceID अकाउंट तैयार है</Text>
          <Text style={styles.cardText}>
            यह Phase 1 फाउंडेशन है — Auth और backend कनेक्शन काम कर रहा है। चैट, वॉइस मैसेज और कॉल्स अगले फेज़ में
            जुड़ेंगे।
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1220' },
  content: { padding: 20 },
  greeting: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 20 },
  card: { backgroundColor: '#1E293B', borderRadius: 16, padding: 18 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  cardText: { color: '#94A3B8', fontSize: 14, lineHeight: 20 },
});
