import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, X } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { usePresence } from '../../context/PresenceContext';
import {useThemeMode} from '../../context/ThemeContext';

// Ported from src/pages/ConversationsPage.tsx (list + realtime) and the
// handleMessageAction flow in src/pages/UserProfilePage.tsx (starting a new
// chat via the create_private_conversation RPC), combined into one screen.
export default function ConversationsScreen({ navigation }: any) {
  const { user } = useAuth();
  const { isOnline } = usePresence();
  const {colors}=useThemeMode();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const refetchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: memberships } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', user.id);

    const convIds = (memberships ?? []).map((m) => m.conversation_id);
    if (convIds.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('conversations')
      .select(
        `id, last_message_at,
         conversation_members(user_id, profiles(display_name, avatar_url)),
         messages(content_body, content_type, created_at)`
      )
      .in('id', convIds)
      .order('last_message_at', { ascending: false });

    setConversations(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();

    const scheduleRefetch = () => {
      if (refetchTimeout.current) clearTimeout(refetchTimeout.current);
      refetchTimeout.current = setTimeout(load, 150);
    };

    const convChannel = supabase
      .channel('conversations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, scheduleRefetch)
      .subscribe();
    const msgChannel = supabase
      .channel('messages-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, scheduleRefetch)
      .subscribe();

    return () => {
      if (refetchTimeout.current) clearTimeout(refetchTimeout.current);
      supabase.removeChannel(convChannel);
      supabase.removeChannel(msgChannel);
    };
  }, [load]);

  // Debounced user search for starting a new chat
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .neq('id', user?.id)
        .limit(10);
      setSearchResults(data ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query, user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openChat = (conversationId: string, name: string, otherUserId?: string) => {
    navigation.navigate('Chat', { conversationId, name, otherUserId });
  };

  const startChatWith = async (otherUserId: string, name: string) => {
    const { data: conversationId, error } = await supabase.rpc('create_private_conversation', {
      other_user_id: otherUserId,
    });
    if (error || !conversationId) {
      console.error('create_private_conversation failed', error);
      return;
    }
    setQuery('');
    openChat(conversationId, name, otherUserId);
  };

  const renderConversation = ({ item }: any) => {
    const other = item.conversation_members?.find((m: any) => m.user_id !== user?.id)?.profiles;
    const sorted = [...(item.messages ?? [])].sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const latest = sorted[0];
    const preview =
      latest?.content_type === 'voice'
        ? '🎤 वॉइस मैसेज'
        : latest?.content_type === 'image'
        ? '📷 इमेज'
        : latest?.content_body || 'बातचीत शुरू करें';

    return (
      <TouchableOpacity style={styles.row} activeOpacity={0.6} onPress={() => openChat(item.id, other?.display_name, item.conversation_members?.find((m: any) => m.user_id !== user?.id)?.user_id)}>
        <View style={styles.avatar}>{other?.avatar_url ? <Image source={{uri:other.avatar_url}} style={styles.avatarImage}/> : <Text style={styles.avatarText}>{(other?.display_name ?? '?').charAt(0).toUpperCase()}</Text>}<View style={[styles.dot,{borderColor:colors.background,backgroundColor:isOnline(item.conversation_members?.find((m:any)=>m.user_id!==user?.id)?.user_id)?'#22C55E':'#64748B'}]}/></View>
        <View style={[styles.rowContent,{borderBottomColor:colors.border}]}>
          <Text style={[styles.name,{color:colors.text}]}>{other?.display_name ?? 'यूज़र'}</Text>
          <Text style={[styles.preview,{color:colors.textSecondary}]} numberOfLines={1}>
            {preview}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container,{backgroundColor:colors.background}]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle,{color:colors.text}]}>चैट्स</Text>
      </View>

      <View style={[styles.searchBar,{backgroundColor:colors.surfaceAlt}] }>
        <Search size={18} color="#64748B" />
        <TextInput
          style={[styles.searchInput,{color:colors.inputText}]}
          value={query}
          onChangeText={setQuery}
          placeholder="नाम या यूज़रनेम से खोजें..."
          placeholderTextColor={colors.textSecondary}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <X size={18} color="#64748B" />
          </TouchableOpacity>
        )}
      </View>

      {query.trim() ? (
        searching ? (
          <ActivityIndicator style={{ marginTop: 30 }} color="#22C55E" />
        ) : (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.row} activeOpacity={0.6} onPress={() => navigation.navigate('UserProfile', { profileId: item.id })}>
                <View style={styles.avatar}>{item.avatar_url?<Image source={{uri:item.avatar_url}} style={styles.avatarImage}/>:<Text style={styles.avatarText}>{(item.display_name ?? '?').charAt(0).toUpperCase()}</Text>}<View style={[styles.dot,{borderColor:colors.background,backgroundColor:isOnline(item.id)?'#22C55E':'#64748B'}]}/></View>
                <View style={[styles.rowContent,{borderBottomColor:colors.border}]}>
                  <Text style={[styles.name,{color:colors.text}]}>{item.display_name}</Text>
                  <Text style={[styles.preview,{color:colors.textSecondary}]}>@{item.username}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={[styles.emptyText,{color:colors.textSecondary}]}>कोई यूज़र नहीं मिला</Text>
              </View>
            }
          />
        )
      ) : loading ? (
        <ActivityIndicator style={{ marginTop: 30 }} color="#22C55E" />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22C55E" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyText,{color:colors.textSecondary}]}>अभी कोई बातचीत नहीं — ऊपर सर्च करके शुरू करें</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1220' },
  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    marginHorizontal: 16,
    marginVertical: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: { flex: 1, color: '#F1F5F9', paddingVertical: 10, fontSize: 14 },
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
  avatarImage:{width:'100%',height:'100%',borderRadius:25},
  dot:{position:'absolute',right:0,bottom:1,width:12,height:12,borderRadius:6,borderWidth:2,borderColor:'#0B1220'},
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  rowContent: { flex: 1, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1E293B', paddingBottom: 12 },
  name: { fontSize: 16, fontWeight: '600', color: '#fff' },
  preview: { fontSize: 13, color: '#94A3B8', marginTop: 3 },
  empty: { alignItems: 'center', marginTop: 80, paddingHorizontal: 30 },
  emptyText: { color: '#64748B', fontSize: 14, textAlign: 'center' },
});
