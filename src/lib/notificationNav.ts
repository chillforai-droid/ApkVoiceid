import { MessageSquare, UserPlus, UserCheck, PhoneMissed, Bell, type LucideIcon } from 'lucide-react';

export type NotificationCategory = 'messages' | 'friends' | 'calls' | 'system';

export interface NotificationMeta {
  category: NotificationCategory;
  icon: LucideIcon;
  color: string; // tailwind text color class
  bg: string; // tailwind bg color class
}

// Central registry: adding a brand new notification type in the future
// (group_invite, mention, profile_update, ...) only requires one entry
// here plus a route builder below — nothing else needs to change.
const META: Record<string, NotificationMeta> = {
  message: { category: 'messages', icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50' },
  friend_request: { category: 'friends', icon: UserPlus, color: 'text-amber-600', bg: 'bg-amber-50' },
  friend_accepted: { category: 'friends', icon: UserCheck, color: 'text-green-600', bg: 'bg-green-50' },
  contact_request: { category: 'friends', icon: UserCheck, color: 'text-green-600', bg: 'bg-green-50' }, // legacy rows
  missed_call: { category: 'calls', icon: PhoneMissed, color: 'text-red-600', bg: 'bg-red-50' },
};

const DEFAULT_META: NotificationMeta = { category: 'system', icon: Bell, color: 'text-gray-600', bg: 'bg-gray-100' };

export function getNotificationMeta(type: string): NotificationMeta {
  return META[type] || DEFAULT_META;
}

export const FILTERS: { key: 'all' | 'unread' | NotificationCategory; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'messages', label: 'Messages' },
  { key: 'friends', label: 'Friends' },
  { key: 'calls', label: 'Calls' },
  { key: 'system', label: 'System' },
];

/**
 * Resolves where a notification should navigate to.
 * Returns null when there is no sensible destination — callers should
 * show a friendly fallback instead of attempting to route anywhere.
 */
export function resolveNotificationRoute(notification: any): string | null {
  if (!notification) return null;
  const { type, related_id, secondary_id } = notification;

  switch (type) {
    case 'message':
      if (!related_id) return null;
      return secondary_id ? `/dashboard/chat/${related_id}?m=${secondary_id}` : `/dashboard/chat/${related_id}`;

    case 'friend_request':
    case 'contact_request': // legacy rows created before this upgrade
      return `/dashboard/notifications?filter=friends`;

    case 'friend_accepted':
      return notification.actor_id ? `/dashboard/profile/${notification.actor_id}` : `/dashboard/notifications?filter=friends`;

    case 'missed_call':
      return `/dashboard/calls`;

    default:
      // Unknown / future type — no crash, caller shows a fallback.
      return null;
  }
}
