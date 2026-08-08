import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export interface AppNotification {
  id: string;
  user_id: string;
  actor_id: string | null;
  title: string;
  message: string | null;
  type: string;
  related_id: string | null;
  secondary_id: string | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  unreadMessageCount: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  fetchMore: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  markConversationRead: (conversationId: string) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  setActiveConversationId: (id: string | null) => void;
}

const PAGE_SIZE = 30;

export const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Tracks the conversation currently open on screen so a new message
  // notification for that conversation is auto marked-as-read instead of
  // bumping the unread badge while the user is already looking at it.
  const activeConversationIdRef = useRef<string | null>(null);
  const setActiveConversationId = useCallback((id: string | null) => {
    activeConversationIdRef.current = id;
  }, []);

  const recomputeCounts = useCallback((list: AppNotification[]) => {
    setUnreadCount(list.filter(n => !n.is_read).length);
    setUnreadMessageCount(list.filter(n => !n.is_read && n.type === 'message').length);
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (!error && data) {
      setNotifications(data);
      recomputeCounts(data);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
  }, [user, recomputeCounts]);

  const fetchMore = useCallback(async () => {
    if (!user || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const last = notifications[notifications.length - 1];
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    if (last) query = query.lt('created_at', last.created_at);

    const { data, error } = await query;
    if (!error && data) {
      setNotifications(prev => {
        const existingIds = new Set(prev.map(n => n.id));
        const merged = [...prev, ...data.filter(n => !existingIds.has(n.id))];
        recomputeCounts(merged);
        return merged;
      });
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoadingMore(false);
  }, [user, notifications, loadingMore, hasMore, recomputeCounts]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setUnreadMessageCount(0);
      setLoading(false);
      return;
    }
    fetchNotifications();

    const channel = supabase
      .channel('realtime:notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        async (payload) => {
          const incoming = payload.new as AppNotification;

          // Already looking at this conversation — treat as instantly read.
          if (incoming.type === 'message' && incoming.related_id && incoming.related_id === activeConversationIdRef.current) {
            await supabase.from('notifications').update({ is_read: true }).eq('id', incoming.id);
            incoming.is_read = true;
          }

          setNotifications(prev => {
            if (prev.find(n => n.id === incoming.id)) return prev;
            const merged = [incoming, ...prev];
            recomputeCounts(merged);
            return merged;
          });
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications(prev => {
            const merged = prev.map(n => n.id === payload.new.id ? (payload.new as AppNotification) : n);
            recomputeCounts(merged);
            return merged;
          });
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications(prev => {
            const merged = prev.filter(n => n.id !== payload.old.id);
            recomputeCounts(merged);
            return merged;
          });
        })
      .subscribe();

    const messageChannel = supabase
      .channel(`realtime:message-receipts:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const msg: any = payload.new;
        if (!msg || msg.sender_id === user.id) return;
        const { data: membership } = await supabase
          .from('conversation_members')
          .select('user_id')
          .eq('conversation_id', msg.conversation_id)
          .eq('user_id', user.id)
          .maybeSingle();
        if (!membership) return;
        const isActive = activeConversationIdRef.current === msg.conversation_id;
        await supabase.rpc(isActive ? 'mark_message_read' : 'mark_message_delivered', { p_message_id: msg.id });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(messageChannel);
    };
  }, [user, fetchNotifications, recomputeCounts]);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications(prev => {
      const merged = prev.map(n => n.id === id ? { ...n, is_read: true } : n);
      recomputeCounts(merged);
      return merged;
    });
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  }, [recomputeCounts]);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    setNotifications(prev => {
      const merged = prev.map(n => ({ ...n, is_read: true }));
      recomputeCounts(merged);
      return merged;
    });
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
  }, [user, recomputeCounts]);

  const markConversationRead = useCallback(async (conversationId: string) => {
    if (!user) return;
    setNotifications(prev => {
      const merged = prev.map(n => (n.type === 'message' && n.related_id === conversationId) ? { ...n, is_read: true } : n);
      recomputeCounts(merged);
      return merged;
    });
    await supabase.from('notifications').update({ is_read: true })
      .eq('user_id', user.id).eq('related_id', conversationId).eq('type', 'message').eq('is_read', false);
  }, [user, recomputeCounts]);

  const deleteNotification = useCallback(async (id: string) => {
    setNotifications(prev => {
      const merged = prev.filter(n => n.id !== id);
      recomputeCounts(merged);
      return merged;
    });
    await supabase.from('notifications').delete().eq('id', id);
  }, [recomputeCounts]);

  const clearAll = useCallback(async () => {
    if (!user) return;
    setNotifications([]);
    setUnreadCount(0);
    setUnreadMessageCount(0);
    await supabase.from('notifications').delete().eq('user_id', user.id);
  }, [user]);

  const value = useMemo(() => ({
    notifications, unreadCount, unreadMessageCount, loading, loadingMore, hasMore,
    fetchMore, markAsRead, markAllRead, markConversationRead, deleteNotification, clearAll,
    setActiveConversationId,
  }), [notifications, unreadCount, unreadMessageCount, loading, loadingMore, hasMore,
      fetchMore, markAsRead, markAllRead, markConversationRead, deleteNotification, clearAll,
      setActiveConversationId]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
};
