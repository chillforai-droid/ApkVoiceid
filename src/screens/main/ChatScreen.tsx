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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Send, Image as ImageIcon, Phone } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { uploadMedia, handleSessionExpired, getDownloadUrl, deleteMedia } from '../../lib/api';
import { cacheLocalFile } from '../../lib/mediaCache';
import { sha256File } from '../../lib/sha256';
import { MessageBubble } from '../../components/MessageBubble';
import { VoiceRecorderBar } from '../../components/VoiceRecorderBar';
import { useVoiceCall } from '../../context/VoiceCallContext';
import { usePresence } from '../../context/PresenceContext';

// Ported from src/pages/ChatPage.tsx. Same messages table, same realtime
// channel pattern, same /api/media/* upload flow — just React Native UI.
export default function ChatScreen({ route, navigation }: any) {
  const { conversationId, name, otherUserId } = route.params ?? {};
  const { initiateCall } = useVoiceCall();
  const { isOnline } = usePresence();
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadProgress,setUploadProgress]=useState(0); const [typing,setTyping]=useState(false); const [otherProfile,setOtherProfile]=useState<any>(null); const typingTimer=useRef<any>(null); const typingChannel=useRef<any>(null);
  const [isVoicePreview, setIsVoicePreview] = useState(false);
  const listRef = useRef<FlatList>(null);

  // Realtime is still kept for messages from the other participant, but a
  // successful local insert is also appended immediately. This avoids the
  // sender depending on a postgres_changes echo to see their own media.
  const appendMessage = useCallback((message: any) => {
    if (!message?.id) return;
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev;
      return [...prev, message];
    });
  }, []);

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
          appendMessage(payload.new);
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
  }, [conversationId, user, appendMessage]);

  useEffect(()=>{if(!conversationId||!user)return; (async()=>{if(otherUserId){const{data}=await supabase.from('profiles').select('display_name,avatar_url').eq('id',otherUserId).maybeSingle();setOtherProfile(data)}})(); const ch=supabase.channel(`typing:${conversationId}`);typingChannel.current=ch;ch.on('broadcast',{event:'typing'},({payload}:any)=>{if(payload?.user_id!==user.id){setTyping(!!payload.typing);if(typingTimer.current)clearTimeout(typingTimer.current);typingTimer.current=setTimeout(()=>setTyping(false),1800)}}).subscribe();return()=>{if(typingTimer.current)clearTimeout(typingTimer.current);supabase.removeChannel(ch)}},[conversationId,user,otherUserId]);
  const onTextChange=(v:string)=>{setText(v);typingChannel.current?.send({type:'broadcast',event:'typing',payload:{user_id:user?.id,typing:!!v}})};

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
      const sha256 = await sha256File(asset.uri);

      setUploadProgress(0); const objectKey = await uploadMedia(asset.uri, mimeType, setUploadProgress);

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
      if (message) {
        // Cache first so ImageMessageBubble can render the just-picked local
        // file without immediately asking the server to download it again.
        await cacheLocalFile(message.id, asset.uri, mimeType);
        appendMessage(message);
      }
    } catch (err: any) {
      console.error('sendImage error', err);
      const handled = await handleSessionExpired(err);
      if (!handled) Alert.alert('गड़बड़ी', 'इमेज नहीं भेजी जा सकी: ' + (err?.message ?? ''));
    } finally {
      setSending(false); setUploadProgress(0);
    }
  };

  const sendVoice = async (localUri: string, durationSec: number, mimeType: string) => {
    if (!user || !conversationId) return;
    const sha256 = await sha256File(localUri);
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
    if (message) {
      // Same sender-side fix as images: make the DB-confirmed message visible
      // immediately instead of waiting for a realtime INSERT echo.
      await cacheLocalFile(message.id, localUri, mimeType);
      appendMessage(message);
    }
  };

  const messageActions=useCallback((m:any)=>{const own=m.sender_id===user?.id;const buttons:any[]=[];if(m.content_type==='text'&&own)buttons.push({text:'Edit',onPress:()=>Alert.prompt?.('Edit message','',async(v)=>{if(v?.trim())await supabase.from('messages').update({content_body:v.trim()}).eq('id',m.id)})});if(m.content_type!=='text')buttons.push({text:'Download / Share',onPress:async()=>{try{let uri=await (await import('../../lib/mediaCache')).getCachedMedia(m.id,m.mime_type||'application/octet-stream');if(!uri){const url=await getDownloadUrl(m.id);uri=await (await import('../../lib/mediaCache')).downloadToCache(m.id,url,m.mime_type||'application/octet-stream')}if(await Sharing.isAvailableAsync())await Sharing.shareAsync(uri!)}catch(e:any){Alert.alert('Download failed',e?.message||'')}}});if(own)buttons.push({text:'Delete',style:'destructive',onPress:async()=>{if(m.b2_object_key)deleteMedia(m.b2_object_key).catch(()=>{});await supabase.from('messages').delete().eq('id',m.id)}});buttons.push({text:'Cancel',style:'cancel'});Alert.alert('Message options','Choose action',buttons)},[user?.id]);
  const renderItem = useCallback(({ item }: any) => <MessageBubble message={item} isOwn={item.sender_id === user?.id} onLongPress={()=>messageActions(item)} />,[user?.id,messageActions]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#F1F5F9" />
        </TouchableOpacity>
        <View style={styles.avatar}>{otherProfile?.avatar_url?<Image source={{uri:otherProfile.avatar_url}} style={{width:'100%',height:'100%',borderRadius:18}}/>:<Text style={styles.avatarText}>{(name ?? '?').charAt(0).toUpperCase()}</Text>}</View>
        <View style={{flex:1}}><Text style={styles.headerName} numberOfLines={1}>{name ?? 'चैट'}</Text><Text style={{color:typing?'#22C55E':isOnline(otherUserId)?'#22C55E':'#64748B',fontSize:11}}>{typing?'typing…':isOnline(otherUserId)?'Online':'Offline'}</Text></View>
        <TouchableOpacity onPress={() => otherUserId && initiateCall(otherUserId)} disabled={!otherUserId} style={styles.backBtn}>
          <Phone size={22} color={otherUserId ? '#22C55E' : '#475569'} />
        </TouchableOpacity>
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

      {sending&&<View style={{paddingHorizontal:16,paddingVertical:6}}><Text style={{color:'#94A3B8',fontSize:12}}>Uploading… {Math.round(uploadProgress*100)}%</Text><View style={{height:4,backgroundColor:'#1E293B',borderRadius:2,marginTop:4}}><View style={{height:4,width:`${Math.max(3,uploadProgress*100)}%`,backgroundColor:'#22C55E',borderRadius:2}}/></View></View>}
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
                onChangeText={onTextChange}
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
