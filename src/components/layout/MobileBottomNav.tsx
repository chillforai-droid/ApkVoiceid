import { memo } from 'react';
import { Home, Search, MessageSquare, Bell, User } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';

function MobileBottomNav() {
  const { user } = useAuth();
  const { unreadCount, unreadMessageCount } = useNotifications();

  const navItems = [
    { name: 'Home', path: '/dashboard', icon: Home, badge: 0 },
    { name: 'Search', path: '/dashboard/search', icon: Search, badge: 0 },
    { name: 'Messages', path: '/dashboard/messages', icon: MessageSquare, badge: unreadMessageCount },
    { name: 'Notifications', path: '/dashboard/notifications', icon: Bell, badge: unreadCount },
    { name: 'Profile', path: user ? `/dashboard/profile/${user.id}` : '/dashboard/profile/me', icon: User, badge: 0 },
  ];

  return (
    <nav className="bg-white border-t border-gray-200 flex justify-around items-stretch h-16 px-1">
      {navItems.map((item) => (
        <NavLink
          key={item.name}
          to={item.path}
          className={({ isActive }) =>
            `relative flex flex-1 flex-col items-center justify-center min-w-0 gap-0.5 text-[11px] font-medium ${
              isActive ? 'text-blue-600' : 'text-gray-500'
            }`
          }
        >
          {item.badge > 0 && (
            <span className="absolute top-1 right-1/2 translate-x-3 bg-red-500 text-white text-[10px] min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full">
              {item.badge > 99 ? '99+' : item.badge}
            </span>
          )}
          <item.icon className="w-6 h-6" />
          <span className="truncate max-w-full">{item.name}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default memo(MobileBottomNav);
