import { memo } from 'react';
import { X, Check } from 'lucide-react';
import { AppNotification } from '../../context/NotificationContext';
import { getNotificationMeta } from '../../lib/notificationNav';
import { relativeTime } from '../../lib/timeFormat';

interface NotificationItemProps {
  notification: AppNotification;
  onOpen: (n: AppNotification) => void;
  onDelete?: (id: string) => void;
  compact?: boolean;
  // Only relevant for friend_request items rendered inline in the list.
  onAccept?: (n: AppNotification) => void;
  onDecline?: (n: AppNotification) => void;
}

function NotificationItemImpl({ notification, onOpen, onDelete, compact, onAccept, onDecline }: NotificationItemProps) {
  const meta = getNotificationMeta(notification.type);
  const Icon = meta.icon;
  const isFriendRequest = notification.type === 'friend_request';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${notification.title}. ${notification.message || ''}. ${notification.is_read ? 'Read' : 'Unread'}`}
      onClick={() => onOpen(notification)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(notification); } }}
      className={`group flex items-start gap-3 p-3 sm:p-4 rounded-xl sm:rounded-2xl cursor-pointer transition border border-transparent
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
        ${notification.is_read ? 'bg-white hover:bg-gray-50' : 'bg-blue-50/60 hover:bg-blue-50 border-blue-100'}`}
    >
      <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${meta.bg}`} aria-hidden="true">
        <Icon size={18} className={meta.color} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm break-words ${notification.is_read ? 'font-medium text-gray-800' : 'font-semibold text-gray-900'}`}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <span className="mt-1 w-2 h-2 rounded-full bg-blue-500 shrink-0" aria-hidden="true" />
          )}
        </div>
        {notification.message && (
          <p className="text-sm text-gray-500 break-words line-clamp-2">{notification.message}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">{relativeTime(notification.created_at)}</p>

        {isFriendRequest && (onAccept || onDecline) && (
          <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
            {onAccept && (
              <button
                onClick={() => onAccept(notification)}
                aria-label="Accept friend request"
                className="min-h-[36px] px-3 flex items-center gap-1 text-sm font-medium bg-green-50 text-green-700 rounded-full hover:bg-green-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
              >
                <Check size={14} /> Accept
              </button>
            )}
            {onDecline && (
              <button
                onClick={() => onDecline(notification)}
                aria-label="Decline friend request"
                className="min-h-[36px] px-3 flex items-center gap-1 text-sm font-medium bg-red-50 text-red-700 rounded-full hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <X size={14} /> Decline
              </button>
            )}
          </div>
        )}
      </div>

      {!compact && onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(notification.id); }}
          aria-label="Delete notification"
          className="shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

const NotificationItem = memo(NotificationItemImpl);
export default NotificationItem;
