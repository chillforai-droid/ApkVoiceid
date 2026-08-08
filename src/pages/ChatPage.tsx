import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { Send, Loader2, ArrowLeft, Phone, Image as ImageIcon } from 'lucide-react';
import { VoiceRecorder } from '../components/chat/VoiceRecorder';
import { MessageBubble } from '../components/chat/MessageBubble';
import { ConfirmDialog } from '../components/chat/ConfirmDialog';
import { MediaCache } from '../lib/MediaCache';
import { useVoiceCall } from '../hooks/useVoiceCall';
import { usePresence } from '../context/PresenceContext';

export default function ChatPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { markConversationRead, setActiveConversationId } = useNotifications();
  const { initiateCall, canCallUser } = useVoiceCall();
  const { isUserOnline } = usePresence();
  const [messages, setMessages] = useState<any[]>([]);
  const [editingMessage, setEditingMessage] = useState<any>(null);
  const [editContent, setEditContent] = useState('');
  const [messageToDelete, setMessageToDelete] = useState<any>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingChannelRef = useRef<any>(null);
  const offlineQueueKey = user && id ? `voiceid:offline-messages:${user.id}:${id}` : null;
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setMessageReceipt = async (messageId: string, status: 'delivered' | 'read') => {
    try {
      const fn = status === 'read' ? 'mark_message_read' : 'mark_message_delivered';
      const { error } = await supabase.rpc(fn, { p_message_id: messageId });
      if (error) console.warn(`message ${status} receipt failed`, error.message);
    } catch (err) {
      console.warn(`message ${status} receipt failed`, err);
    }
  };

  const markIncomingMessages = async (rows: any[], readNow: boolean) => {
    const incoming = rows.filter(m => m.sender_id !== user?.id);
    if (!incoming.length) return;
    await Promise.all(incoming.map(m => setMessageReceipt(m.id, readNow ? 'read' : 'delivered')));
  };

  const flushOfflineQueue = async () => {
    if (!offlineQueueKey || !navigator.onLine) return;
    let queue: any[] = [];
    try { queue = JSON.parse(localStorage.getItem(offlineQueueKey) || '[]'); } catch { queue = []; }
    if (!queue.length) return;
    const remaining: any[] = [];
    for (const item of queue) {
      const { error } = await supabase.from('messages').insert({
        id: item.id,
        conversation_id: id,
        sender_id: user?.id,
        content_body: item.content_body,
        content_type: 'text'
      });
      if (error) remaining.push(item);
    }
    localStorage.setItem(offlineQueueKey, JSON.stringify(remaining));
  };

  const publishTyping = async (typing: boolean) => {
    const ch = typingChannelRef.current;
    if (!ch || !user || !id) return;
    await ch.send({ type: 'broadcast', event: 'typing', payload: { userId: user.id, typing } });
  };

  const handleTyping = (value: string) => {
    setNewMessage(value);
    if (!value.trim()) {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      publishTyping(false);
      return;
    }
    publishTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => publishTyping(false), 1400);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !id) return;
    
    // Reset file input
    e.target.value = '';
    
    // Set preview (revoking any previous preview URL first so we don't
    // accumulate Blob URLs across multiple attachments in one session)
    if (previewImage) URL.revokeObjectURL(previewImage);
    setPreviewImage(URL.createObjectURL(file));
    
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const sha256 = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    
    const uploadRes = await fetch("/api/media/upload", {
      method: "POST",
      headers: { 
        "Content-Type": file.type,
        "Authorization": `Bearer ${token}` 
      },
      body: file,
    });
    
    if (!uploadRes.ok) {
        console.error("handleImageUpload: proxy upload failed", await uploadRes.text());
        throw new Error("Failed to upload to storage");
    }
    
    const { objectKey } = await uploadRes.json();
    
    const { data: message, error: dbError } = await supabase.from('messages').insert({
        conversation_id: id,
        sender_id: user.id,
        content_body: '',
        content_type: 'image',
        b2_object_key: objectKey,
        sha256: sha256,
        media_status: 'delivered', // Change to delivered
        mime_type: file.type,
        byte_size: file.size
    }).select().single();
    
    if (dbError) {
        console.error('Image message insert error:', dbError);
    } else {
        // Cache the blob
        await MediaCache.putMedia({
            messageId: message.id,
            mediaType: 'image',
            blob: file,
            mimeType: file.type,
            byteSize: file.size,
            createdAt: Date.now(),
            sha256: sha256,
            deliveryStatus: 'delivered'
        });
        setPreviewImage(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    }
  };

  const handleCall = async () => {
      if (!otherUser?.user_id) return;
      const { canCall, reason } = await canCallUser(otherUser.user_id);
      if (!canCall) {
          alert(reason);
      } else {
          initiateCall(otherUser.user_id);
      }
  };

  // Notification-system only: lets the bell/notifications page know this
  // conversation is currently open, so new message notifications for it
  // are marked read instantly instead of bumping the unread badge.
  useEffect(() => {
    setActiveConversationId(id ?? null);
    return () => setActiveConversationId(null);
  }, [id, setActiveConversationId]);

  useEffect(() => {
    if (id) markConversationRead(id);
    if (authLoading || !id || !user) return;

    const fetchMessagesAndUser = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*, profiles(display_name)')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });

      if (!error && data) {
        const messageIds = data.map((m: any) => m.id);
        let receiptRows: any[] = [];
        if (messageIds.length) {
          const { data: receipts } = await supabase.from('message_receipts').select('message_id,user_id,delivered_at,read_at').in('message_id', messageIds);
          receiptRows = receipts || [];
        }
        const receiptMap = new Map(receiptRows.filter((r: any) => r.user_id !== user.id).map((r: any) => [r.message_id, r]));
        const merged = data.map((m: any) => {
          const r: any = receiptMap.get(m.id);
          return { ...m, delivery_status: m.sender_id === user.id ? (r?.read_at ? 'read' : r?.delivered_at ? 'delivered' : 'sent') : undefined };
        });
        setMessages(merged);
        await markIncomingMessages(data, true);
      }
      setMessagesLoading(false);

      const { data: members } = await supabase.from('conversation_members').select('user_id, profiles(display_name, avatar_url)').eq('conversation_id', id).neq('user_id', user.id);
      if (members && members.length > 0) setOtherUser(members[0]);
    };

    fetchMessagesAndUser();

    const subscription = supabase
      .channel(`messages:${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, async (payload) => {
        const msg: any = payload.new;
        setMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        });
        if (msg.sender_id !== user.id) await setMessageReceipt(msg.id, 'read');
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_receipts' }, (payload) => {
        const r: any = payload.new;
        if (r.user_id === user.id) return;
        setMessages(prev => prev.map(m => m.id === r.message_id ? { ...m, delivery_status: r.read_at ? 'read' : r.delivered_at ? 'delivered' : 'sent' } : m));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'message_receipts' }, (payload) => {
        const r: any = payload.new;
        if (r.user_id === user.id) return;
        setMessages(prev => prev.map(m => m.id === r.message_id ? { ...m, delivery_status: r.read_at ? 'read' : r.delivered_at ? 'delivered' : 'sent' } : m));
      })
      .on('broadcast', { event: 'typing' }, ({ payload }: any) => {
        if (!payload || payload.userId === user.id) return;
        setTypingUsers(prev => ({ ...prev, [payload.userId]: !!payload.typing }));
        if (payload.typing) setTimeout(() => setTypingUsers(prev => ({ ...prev, [payload.userId]: false })), 1800);
      })
      .subscribe();
    typingChannelRef.current = subscription;

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      publishTyping(false);
      typingChannelRef.current = null;
      supabase.removeChannel(subscription);
    };
  }, [id, user, authLoading]);

  useEffect(() => {
    const onOnline = () => { setIsOnline(true); void flushOfflineQueue(); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    void flushOfflineQueue();
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, [offlineQueueKey, id, user?.id]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Safety net: revoke the attachment preview URL if the user navigates
  // away mid-upload instead of cancelling or completing it.
  useEffect(() => {
    return () => { if (previewImage) URL.revokeObjectURL(previewImage); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deep link support: notifications for a specific message (e.g. a new
  // message notification) can carry ?m=<messageId> so we scroll straight
  // to it and briefly highlight it, then clean the param from the URL.
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  useEffect(() => {
    const targetId = searchParams.get('m');
    if (!targetId || messagesLoading) return;
    const el = document.getElementById(`msg-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(targetId);
      const timeout = setTimeout(() => setHighlightedMessageId(null), 2000);
      setSearchParams(prev => { const next = new URLSearchParams(prev); next.delete('m'); return next; }, { replace: true });
      return () => clearTimeout(timeout);
    }
  }, [searchParams, messagesLoading, setSearchParams]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !id) return;

    const content = newMessage.trim();
    const messageId = crypto.randomUUID();
    setNewMessage('');
    if (!navigator.onLine) {
      const queued = JSON.parse(localStorage.getItem(offlineQueueKey || '') || '[]');
      queued.push({ id: messageId, content_body: content, created_at: new Date().toISOString() });
      if (offlineQueueKey) localStorage.setItem(offlineQueueKey, JSON.stringify(queued));
      setMessages(prev => [...prev, { id: messageId, conversation_id: id, sender_id: user.id, content_body: content, content_type: 'text', created_at: new Date().toISOString(), delivery_status: 'sending' }]);
      return;
    }

    const { data, error } = await supabase.from('messages').insert({
      id: messageId,
      conversation_id: id,
      sender_id: user.id,
      content_body: content,
      content_type: 'text'
    }).select().single();
    if (error) {
      console.error('Message insert error:', error);
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, delivery_status: 'failed' } : m));
      alert(`Failed to save message. Details: ${error.message}`);
    } else if (data) {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...data, delivery_status: 'sent' } : m));
    }
  };

  const deleteMessage = async (m: any) => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    
    // .select() forces PostgREST to return the row(s) actually deleted.
    // Without it, a DELETE blocked by RLS (0 rows affected) still comes
    // back with error: null, which would make this look successful even
    // though nothing changed in the database.
    const { data: deleteData, error } = await supabase
        .from('messages')
        .delete()
        .eq('id', m.id)
        .select();

    if (error) { 
        console.error("Delete failed", error);
        alert('Failed to delete message: ' + error.message); 
        return; 
    }

    if (!deleteData || deleteData.length === 0) {
        console.error("Delete affected 0 rows (blocked by RLS or already deleted)", m.id);
        alert('Failed to delete message: you may not have permission to delete this message.');
        return;
    }
    
    if (m.b2_object_key) {
        await fetch(`/api/media/delete/${m.b2_object_key}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    }
    await MediaCache.deleteMedia(m.id);
    setMessages(prev => prev.filter(msg => msg.id !== m.id));
  };

  const updateMessage = async () => {
    if (!editingMessage || !editContent.trim()) return;
    const { data, error } = await supabase.from('messages').update({ content_body: editContent + " (edited)" }).eq('id', editingMessage.id).select();
    if (error) {
        alert('Failed to update message: ' + error.message);
    } else if (!data || data.length === 0) {
        alert('Failed to update message: you may not have permission to edit this message.');
    } else {
        setMessages(prev =>
            prev.map(msg =>
                msg.id === editingMessage.id
                ? {
                    ...msg,
                    content_body: editContent + " (edited)"
                }
                : msg
            )
        );
        setEditingMessage(null);
        setEditContent('');
    }
  };

  if (authLoading || messagesLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-500" size={32}/></div>;
  if (!user) return <div className="p-20 text-center">Please sign in to chat.</div>;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="pt-safe sticky top-0 bg-white border-b border-gray-200 p-3 sm:p-4 flex items-center gap-2 sm:gap-3 z-10">
        <button onClick={() => navigate('/dashboard/messages')} className="p-2 hover:bg-gray-100 rounded-full shrink-0" aria-label="Back to conversations">
            <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold overflow-hidden shrink-0">
             {otherUser?.profiles?.avatar_url ? <img src={otherUser.profiles.avatar_url} alt="" decoding="async" className="w-full h-full object-cover" /> : otherUser?.profiles?.display_name?.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 truncate">{otherUser?.profiles?.display_name || 'Conversation'}</div>
          <div className="text-xs text-gray-500 h-4">{otherUser?.user_id && typingUsers[otherUser.user_id] ? 'typing…' : (otherUser?.user_id && isUserOnline(otherUser.user_id) ? 'online' : 'offline')}</div>
        </div>
        {otherUser && (
            <div className="flex items-center gap-2 shrink-0">
                <button onClick={handleCall} className={`p-2 hover:bg-gray-100 rounded-full ${!isUserOnline(otherUser.user_id) ? 'text-gray-400' : 'text-gray-600'}`} aria-label="Call">
                    <Phone size={20} />
                </button>
                <div className={`w-2 h-2 rounded-full shrink-0 ${isUserOnline(otherUser.user_id) ? 'bg-green-500' : 'bg-gray-300'}`} />
            </div>
        )}
      </div>
      
      {!isOnline && <div className="mx-3 mt-2 rounded-xl px-3 py-2 text-xs text-gray-600 bg-gray-100 border border-gray-200">You’re offline. Text messages will be queued and sent automatically when the connection returns.</div>}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 space-y-3 sm:space-y-4">
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            isOwn={m.sender_id === user?.id}
            isHighlighted={highlightedMessageId === m.id}
            isSelected={selectedMessageId === m.id}
            isEditing={editingMessage?.id === m.id}
            editContent={editContent}
            onEditContentChange={setEditContent}
            onSaveEdit={updateMessage}
            onCancelEdit={() => setEditingMessage(null)}
            onToggleSelect={() => setSelectedMessageId(selectedMessageId === m.id ? null : m.id)}
            onStartEdit={() => { setEditingMessage(m); setEditContent(m.content_body.replace(" (edited)", "")); setSelectedMessageId(null); }}
            onRequestDelete={() => { setMessageToDelete(m); setSelectedMessageId(null); }}
          />
        ))}
        <div ref={scrollRef} />
      </div>
      
      <ConfirmDialog
        isOpen={!!messageToDelete}
        title="Delete Message"
        message="Are you sure you want to delete this message?"
        onConfirm={async () => {
            await deleteMessage(messageToDelete);
            setMessageToDelete(null);
        }}
        onCancel={() => setMessageToDelete(null)}
      />
      
      {previewImage && (
        <div className="p-2 border-t bg-white flex items-center gap-3">
          <img src={previewImage} alt="Preview" loading="lazy" decoding="async" className="h-16 w-16 sm:h-20 sm:w-20 rounded object-cover" />
          <button onClick={() => { URL.revokeObjectURL(previewImage); setPreviewImage(null); }} className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-full hover:bg-gray-100">Cancel</button>
        </div>
      )}
      
      <form onSubmit={sendMessage} className="pb-safe p-2 sm:p-4 bg-white border-t flex gap-1 sm:gap-2 w-full items-center">
        <>
        <VoiceRecorder onSent={() => {}} onAudioPreview={(isPreview) => setIsPreviewMode(isPreview)} />
        <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 hover:bg-gray-100 rounded-full shrink-0 text-gray-500" aria-label="Attach image">
            <ImageIcon size={20} />
        </button>
        <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
        {!isPreviewMode && (
          <>
            <input 
              value={newMessage}
              onChange={(e) => handleTyping(e.target.value)}
              className="flex-1 p-3 px-4 bg-gray-100 border-none rounded-full outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
              placeholder={isOnline ? 'Message...' : 'Offline — message will send when online'}
              aria-label="Message"
            />
            <button type="submit" disabled={!newMessage.trim()} className="p-3 bg-blue-600 text-white rounded-full shrink-0 disabled:opacity-50" aria-label="Send message"><Send size={20} /></button>
          </>
        )}
        </>
      </form>
    </div>
  );
}
