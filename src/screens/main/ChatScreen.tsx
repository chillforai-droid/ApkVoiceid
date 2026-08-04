import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Send, Image as ImageIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { uploadMedia } from '../../lib/api';
import { cacheLocalFile } from '../../lib/mediaCache';
import { MessageBubble } from '../../components/MessageBubble';
import { VoiceRecorderBar } from '../../components/VoiceRecorderBar';

// Ported from src/pages/ChatPage.tsx. Same messages table, same realtime
// channel pattern, same /api/media/* upload flow — just React Native UI.
export default function ChatScreen({ route, navigation }: any) {
  const { conversationId, name } = route.params ?? {};
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [isVoicePreview, setIsVoicePreview] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!conversationId || !user) return;

    const load = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      setMessages(data ?? []);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => {
            if (prev.find((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user]);

  const sendText = async () => {
    if (!text.trim() || !user || !conversationId) return;
    const body = text.trim();
    setText('');
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content_body: body,
      content_type: 'text',
    });
    if (error) {
      console.error('send text error', error);
      Alert.alert('गड़बड़ी', 'मैसेज नहीं भेजा जा सका: ' + error.message);
    }
  };

  const sendImage = async () => {
    if (!user || !conversationId) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('अनुमति चाहिए', 'इमेज भेजने के लिए फ़ोटो एक्सेस दें');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType || 'image/jpeg';

    setSending(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const sha256 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64);

      const objectKey = await uploadMedia(asset.uri, mimeType);

      const { data: message, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content_body: '',
          content_type: 'image',
          b2_object_key: objectKey,
          sha256,
          media_status: 'delivered',
          mime_type: mimeType,
          byte_size: asset.fileSize ?? 0,
        })
        .select()
        .single();

      if (error) throw error;
      if (message) await cacheLocalFile(message.id, asset.uri, mimeType);
    } catch (err: any) {
      console.error('sendImage error', err);
      Alert.alert('गड़बड़ी', 'इमेज नहीं भेजी जा सकी: ' + (err?.message ?? ''));
    } finally {
      setSending(false);
    }
  };

  const sendVoice = async (localUri: string, durationSec: number, mimeType: string) => {
    if (!user || !conversationId) return;
    const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
    const sha256 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64);
    const fileInfo = await FileSystem.getInfoAsync(localUri, { size: true });

    const objectKey = await uploadMedia(localUri, mimeType);

    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content_body: '',
        content_type: 'voice',
        b2_object_key: objectKey,
        sha256,
        media_status: 'pending',
        duration: durationSec,
        mime_type: mimeType,
        byte_size: (fileInfo as any).size ?? 0,
      })
      .select()
      .single();

    if (error) throw error;
    if (message) await cacheLocalFile(message.id, localUri, mimeType);
  };

  const renderItem = useCallback(
    ({ item }: any) => <MessageBubble message={item} isOwn={item.sender_id === user?.id} />,
    [user?.id]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#F1F5F9" />
        </TouchableOpacity>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(name ?? '?').charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.headerName} numberOfLines={1}>
          {name ?? 'चैट'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#22C55E" size="large" />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputBar}>
          <VoiceRecorderBar onSend={sendVoice} onRecordingStateChange={setIsVoicePreview} />
          {!isVoicePreview && (
            <>
              <TouchableOpacity style={styles.attachBtn} onPress={sendImage} disabled={sending}>
                <ImageIcon size={20} color="#94A3B8" />
              </TouchableOpacity>
              <TextInput
                style={styles.textInput}
                value={text}
                onChangeText={setText}
                placeholder="मैसेज लिखें..."
                placeholderTextColor="#64748B"
                multiline
              />
              <TouchableOpacity
                style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
                onPress={sendText}
                disabled={!text.trim()}
              >
                <Send size={18} color="#fff" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1220' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1E293B',
  },
  backBtn: { padding: 6, marginRight: 4 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: { color: '#fff', fontWeight: '700' },
  headerName: { color: '#F1F5F9', fontSize: 16, fontWeight: '700', flex: 1 },
  listContent: { paddingVertical: 12 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1E293B',
    gap: 4,
  },
  attachBtn: { padding: 10 },
  textInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    color: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: { backgroundColor: '#22C55E', padding: 10, borderRadius: 20, marginLeft: 4 },
  sendBtnDisabled: { opacity: 0.4 },
});
