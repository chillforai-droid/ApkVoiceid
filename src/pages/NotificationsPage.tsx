import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Bell, CheckCheck, Trash2 } from 'lucide-react';
import { useNotifications, AppNotification } from '../context/NotificationContext';
import { useNotificationActions } from '../hooks/useNotificationActions';
import { FILTERS, getNotificationMeta } from '../lib/notificationNav';
import { groupByDate } from '../lib/timeFormat';
import NotificationItem from '../components/notifications/NotificationItem';

type FilterKey = typeof FILTERS[number]['key'];

export default function NotificationsPage() {
  const { notifications, loading, loadingMore, hasMore, fetchMore, markAllRead, deleteNotification, clearAll, unreadCount } = useNotifications();
  const { openNotification, acceptFriendRequest, declineFriendRequest, fallbackMessage } = useNotificationActions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [confirmClear, setConfirmClear] = useState(false);

  const initialFilter = (searchParams.get('filter') as FilterKey) || 'all';
  const [filter, setFilter] = useState<FilterKey>(FILTERS.some(f => f.key === initialFilter) ? initialFilter : 'all');

  useEffect(() => {
    const urlFilter = searchParams.get('filter') as FilterKey;
    if (urlFilter && urlFilter !== filter && FILTERS.some(f => f.key === urlFilter)) setFilter(urlFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const changeFilter = (key: FilterKey) => {
    setFilter(key);
    setSearchParams(key === 'all' ? {} : { filter: key });
  };

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter(n => !n.is_read);
    return notifications.filter(n => getNotificationMeta(n.type).category === filter);
  }, [notifications, filter]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasMore || filter !== 'all') return; // pagination only makes sense on the full unfiltered feed
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) fetchMore();
    }, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, filter, fetchMore]);

  return (
    <div className="max-w-xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead()}
              aria-label="Mark all as read"
              className="flex items-center gap-1 text-xs sm:text-sm font-medium text-blue-600 hover:bg-blue-50 min-h-[36px] px-2 sm:px-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <CheckCheck size={16} /> <span className="hidden sm:inline">Mark all read</span>
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={() => setConfirmClear(true)}
              aria-label="Clear all notifications"
              className="flex items-center gap-1 text-xs sm:text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 min-h-[36px] px-2 sm:px-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <Trash2 size={16} /> <span className="hidden sm:inline">Clear all</span>
            </button>
          )}
        </div>
      </div>

      {confirmClear && (
        <div role="alertdialog" aria-label="Confirm clear all notifications" className="mb-4 p-4 bg-white border border-red-100 rounded-2xl flex items-center justify-between gap-3">
          <p className="text-sm text-gray-700">Delete all notifications? This can't be undone.</p>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setConfirmClear(false)} className="min-h-[36px] px-3 text-sm rounded-full text-gray-600 hover:bg-gray-100">Cancel</button>
            <button onClick={() => { clearAll(); setConfirmClear(false); }} className="min-h-[36px] px-3 text-sm rounded-full bg-red-600 text-white hover:bg-red-700">Delete all</button>
          </div>
        </div>
      )}

      {fallbackMessage && (
        <div className="mb-4 px-4 py-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl">{fallbackMessage}</div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1" role="tablist" aria-label="Filter notifications">
        {FILTERS.map(f => (
          <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => changeFilter(f.key)}
            className={`shrink-0 min-h-[36px] px-4 rounded-full text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              filter === f.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <Bell className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-500">{filter === 'all' ? 'No notifications.' : `No ${FILTERS.find(f => f.key === filter)?.label.toLowerCase()} notifications.`}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ group, items }) => (
            <div key={group}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2 px-1">{group}</h2>
              <div className="space-y-2">
                {items.map((n: AppNotification) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onOpen={openNotification}
                    onDelete={deleteNotification}
                    onAccept={n.type === 'friend_request' ? acceptFriendRequest : undefined}
                    onDecline={n.type === 'friend_request' ? declineFriendRequest : undefined}
                  />
                ))}
              </div>
            </div>
          ))}

          {filter === 'all' && (
            <div ref={sentinelRef} className="flex justify-center py-4">
              {loadingMore && <Loader2 className="animate-spin text-blue-400" size={20} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
