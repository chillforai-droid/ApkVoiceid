import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

// TODO(Phase 3): replace with the real conversations query/RPC ported from
// ConversationsPage.tsx once the chat schema is wired up. For now this
// fetches profiles as placeholder rows so the list + navigation is testable.
export default function ConversationsScreen({ navigation }: any) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('*').neq('id', user.id).limit(30);
    setConversations(data ?? []);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>चैट्स</Text>
      </View>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22C55E" />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.6}
            onPress={() => navigation.navigate('Chat', { userId: item.id, name: item.full_name })}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(item.full_name ?? '?').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.name}>{item.full_name ?? 'यूज़र'}</Text>
              <Text style={styles.preview} numberOfLines={1}>
                टैप करके बातचीत शुरू करें
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>कोई बातचीत नहीं मिली</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1220' },
  header: { paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  rowContent: { flex: 1, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1E293B', paddingBottom: 12 },
  name: { fontSize: 16, fontWeight: '600', color: '#fff' },
  preview: { fontSize: 13, color: '#94A3B8', marginTop: 3 },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: '#64748B', fontSize: 14 },
});
