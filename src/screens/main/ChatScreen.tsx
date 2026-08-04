import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// TODO(Phase 3): full chat UI — MessageBubble, VoiceMessage, VoiceRecorder,
// ImageMessage, realtime subscription — ported from src/pages/ChatPage.tsx
// and src/components/chat/* in the web app.
export default function ChatScreen({ route }: any) {
  const { name } = route.params ?? {};
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.title}>{name ?? 'चैट'}</Text>
        <Text style={styles.subtitle}>चैट स्क्रीन Phase 3 में बनेगी</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1220' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#64748B', fontSize: 13, marginTop: 8 },
});
