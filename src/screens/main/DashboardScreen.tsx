import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageCirclePlus, ChevronRight } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useThemeMode } from '../../context/ThemeContext';

export default function DashboardScreen({ navigation }: any) {
  const { profile, user } = useAuth();
  const { scheme } = useThemeMode(); const light=scheme==='light';
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: memberships } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', user.id);
    const convIds = (memberships ?? []).map((m) => m.conversation_id);
    if (convIds.length === 0) {
      setRecentChats([]);
      return;
    }
    const { data } = await supabase
      .from('conversations')
      .select(`id, last_message_at, conversation_members(user_id, profiles(display_name, avatar_url))`)
      .in('id', convIds)
      .order('last_message_at', { ascending: false })
      .limit(4);
    setRecentChats(data ?? []);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openChat = (conversationId: string, name: string) => {
    navigation.navigate('Chat', { conversationId, name });
  };

  return (
    <SafeAreaView style={[styles.container,light&&{backgroundColor:'#F8FAFC'}]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22C55E" />}
      >
        <Text style={[styles.greeting,light&&{color:'#0F172A'}]}>नमस्ते, {profile?.display_name ?? 'दोस्त'} 👋</Text>

        <TouchableOpacity style={[styles.newChatCard,light&&{backgroundColor:'#FFFFFF'}]} activeOpacity={0.8} onPress={() => navigation.navigate('Chats')}>
          <View style={styles.newChatIcon}>
            <MessageCirclePlus size={22} color="#22C55E" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.newChatTitle,light&&{color:'#0F172A'}]}>नई चैट शुरू करें</Text>
            <Text style={styles.newChatSubtitle}>यूज़र सर्च करके बातचीत शुरू करें</Text>
          </View>
          <ChevronRight size={20} color="#64748B" />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>हाल की चैट्स</Text>

        {recentChats.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>अभी कोई बातचीत नहीं है</Text>
            <Text style={styles.emptySubtext}>ऊपर से नई चैट शुरू करें</Text>
          </View>
        ) : (
          recentChats.map((conv) => {
            const other = conv.conversation_members?.find((m: any) => m.user_id !== user?.id)?.profiles;
            return (
              <TouchableOpacity
                key={conv.id}
                style={styles.chatRow}
                activeOpacity={0.7}
                onPress={() => openChat(conv.id, other?.display_name)}
              >
                <View style={styles.avatar}>{other?.avatar_url ? <Image source={{uri:other.avatar_url}} style={styles.avatarImage}/> : <Text style={styles.avatarText}>{(other?.display_name ?? '?').charAt(0).toUpperCase()}</Text>}</View>
                <Text style={[styles.chatName,light&&{color:'#0F172A'}]}>{other?.display_name ?? 'यूज़र'}</Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1220' },
  content: { padding: 20, paddingBottom: 40 },
  greeting: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 20 },
  newChatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    marginBottom: 28,
  },
  newChatIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(34,197,94,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newChatTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  newChatSubtitle: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  sectionTitle: { color: '#94A3B8', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  emptyCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 20, alignItems: 'center' },
  emptyText: { color: '#CBD5E1', fontSize: 14, fontWeight: '600' },
  emptySubtext: { color: '#64748B', fontSize: 12, marginTop: 4 },
  chatRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage:{width:'100%',height:'100%',borderRadius:21},
  avatarText: { color: '#fff', fontWeight: '700' },
  chatName: { color: '#F1F5F9', fontSize: 15, fontWeight: '600' },
});
