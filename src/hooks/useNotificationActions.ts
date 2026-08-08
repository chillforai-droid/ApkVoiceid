import { useNavigate } from 'react-router-dom';
import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { AppNotification, useNotifications } from '../context/NotificationContext';
import { resolveNotificationRoute } from '../lib/notificationNav';

export function useNotificationActions() {
  const navigate = useNavigate();
  const { markAsRead, deleteNotification } = useNotifications();
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);

  const openNotification = useCallback((notification: AppNotification, onNavigate?: () => void) => {
    if (!notification.is_read) markAsRead(notification.id);

    const route = resolveNotificationRoute(notification);
    if (!route) {
      setFallbackMessage("This item isn't available anymore.");
      window.setTimeout(() => setFallbackMessage(null), 3000);
      return;
    }
    onNavigate?.();
    navigate(route);
  }, [markAsRead, navigate]);

  const acceptFriendRequest = useCallback(async (notification: AppNotification) => {
    if (!notification.related_id) return;
    await supabase.from('contacts').update({ status: 'accepted' }).eq('id', notification.related_id);
    markAsRead(notification.id);
    deleteNotification(notification.id);
  }, [markAsRead, deleteNotification]);

  const declineFriendRequest = useCallback(async (notification: AppNotification) => {
    if (!notification.related_id) return;
    await supabase.from('contacts').update({ status: 'blocked' }).eq('id', notification.related_id);
    markAsRead(notification.id);
    deleteNotification(notification.id);
  }, [markAsRead, deleteNotification]);

  return { openNotification, acceptFriendRequest, declineFriendRequest, fallbackMessage };
}
