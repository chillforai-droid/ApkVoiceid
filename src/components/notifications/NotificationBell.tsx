import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { useNotificationActions } from '../../hooks/useNotificationActions';
import NotificationItem from './NotificationItem';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markAllRead } = useNotifications();
  const { openNotification, acceptFriendRequest, declineFriendRequest, fallbackMessage } = useNotificationActions();

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const recent = notifications.slice(0, 8);

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        onClick={() => setOpen(o => !o)}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] min-w-[16px] h-[16px] px-1 flex items-center justify-center rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 mt-2 w-[92vw] max-w-sm sm:w-96 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Notifications</h2>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead()}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 min-h-[32px] px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
              >
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          {fallbackMessage && (
            <div className="px-4 py-2 text-xs text-amber-700 bg-amber-50 border-b border-amber-100">{fallbackMessage}</div>
          )}

          <div className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" size={22} /></div>
            ) : recent.length === 0 ? (
              <div className="text-center py-10 px-4">
                <Bell className="mx-auto text-gray-300 mb-2" size={28} />
                <p className="text-sm text-gray-500">You're all caught up.</p>
              </div>
            ) : (
              recent.map(n => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  compact
                  onOpen={(notif) => openNotification(notif, () => setOpen(false))}
                  onAccept={n.type === 'friend_request' ? acceptFriendRequest : undefined}
                  onDecline={n.type === 'friend_request' ? declineFriendRequest : undefined}
                />
              ))
            )}
          </div>

          <button
            onClick={() => { setOpen(false); navigate('/dashboard/notifications'); }}
            className="w-full py-3 text-sm font-medium text-blue-600 hover:bg-gray-50 border-t border-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            View all
          </button>
        </div>
      )}
    </div>
  );
}
