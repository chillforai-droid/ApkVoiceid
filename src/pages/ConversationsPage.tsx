import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Loader2 } from 'lucide-react';

export default function ConversationsPage() {
  const { user, loading: authLoading } = useAuth();
  const { notifications } = useNotifications();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  // Coalesces refetches: the 'conversations' and 'messages' realtime
  // channels can both fire for the same underlying change, which
  // previously triggered two full refetches back-to-back.
  const refetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }

    const fetchConversations = async () => {
      // 1. Get IDs of conversations the user is a member of
      const { data: memberships, error: membershipsError } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user?.id);

      if (membershipsError || !memberships) {
        setLoading(false);
        return;
      }

      const convIds = memberships.map((m) => m.conversation_id);

      // 2. Fetch conversations and all their members
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          last_message_at,
          conversation_members(user_id, profiles(display_name, avatar_url)),
          messages(content_body, created_at, content_type)
        `)
        .in('id', convIds)
        .order('last_message_at', { ascending: false });

      if (!error && data) {
        setConversations(data);
      }
      setLoading(false);
    };

    const scheduleRefetch = () => {
      if (refetchTimeoutRef.current) clearTimeout(refetchTimeoutRef.current);
      refetchTimeoutRef.current = setTimeout(fetchConversations, 150);
    };

    fetchConversations();

    // Real-time
    const subscription = supabase
      .channel('conversations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, scheduleRefetch)
      .subscribe();

    const messageSubscription = supabase
      .channel('messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, scheduleRefetch)
      .subscribe();

    return () => {
        if (refetchTimeoutRef.current) clearTimeout(refetchTimeoutRef.current);
        supabase.removeChannel(subscription);
        supabase.removeChannel(messageSubscription);
    };
  }, [user, authLoading]);

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-500" size={32}/></div>;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Messages</h1>
      {conversations.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <MessageSquare className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-500">No conversations yet.</p>
            <p className="text-sm text-gray-400 mt-1">Start chatting with friends!</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
          {conversations.map((conv) => {
            const otherMember = conv.conversation_members.find((m: any) => m.user_id !== user?.id)?.profiles;
            const latestMessage = conv.messages.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
            const name = otherMember?.display_name || 'Unknown';
            return (
              <div 
                key={conv.id} 
                onClick={() => navigate(`/dashboard/chat/${conv.id}`)}
                className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer transition border-b last:border-b-0 border-gray-100"
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg overflow-hidden shrink-0">
                    {otherMember?.avatar_url ? (
                        <img src={otherMember.avatar_url} alt={name} loading="lazy" decoding="async" className="w-full h-full object-cover"/>
                    ) : (
                        name.charAt(0).toUpperCase()
                    )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{name}</p>
                  <p className="text-sm text-gray-500 truncate">
                    {latestMessage?.content_type === 'voice' ? 'Voice message' : (latestMessage?.content_body || 'No messages')}
                  </p>
                </div>
                {notifications.filter(n => n.type === 'message' && n.related_id === conv.id && !n.is_read).length > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                        {notifications.filter(n => n.type === 'message' && n.related_id === conv.id && !n.is_read).length}
                    </span>
                )}
                <p className="text-xs text-gray-400 shrink-0">{new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
