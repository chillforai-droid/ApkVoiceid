import { memo } from 'react';
import { Home, Search, Mail, Bell, Settings, LogOut, User } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import NotificationBell from '../notifications/NotificationBell';

function DesktopSidebar() {
  const { user, signOut } = useAuth();
  const { unreadCount, unreadMessageCount } = useNotifications();

  const menuItems = [
    { icon: Home, label: 'Home', path: '/dashboard', badge: 0 },
    { icon: Search, label: 'Search', path: '/dashboard/search', badge: 0 },
    { icon: Mail, label: 'Messages', path: '/dashboard/messages', badge: unreadMessageCount },
    { icon: Bell, label: 'Notifications', path: '/dashboard/notifications', badge: unreadCount },
    { icon: User, label: 'Profile', path: user ? `/dashboard/profile/${user.id}` : '/dashboard/profile/me', badge: 0 },
    { icon: Settings, label: 'Settings', path: '/dashboard/settings', badge: 0 },
  ];

  return (
    <div className="w-64 border-r border-gray-200 h-screen flex flex-col p-4 bg-white">
      <div className="flex items-center justify-between p-4 mb-8">
        <div className="text-2xl font-bold text-blue-600">VoiceID</div>
        <NotificationBell />
      </div>
      
      <nav className="flex-1 flex flex-col gap-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 p-3 rounded-xl transition relative ${
                isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            <span className="relative">
              <item.icon size={20} />
              {item.badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] min-w-[15px] h-[15px] px-0.5 flex items-center justify-center rounded-full">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={signOut}
        className="flex items-center gap-3 p-3 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-xl transition"
      >
        <LogOut size={20} />
        Sign Out
      </button>
    </div>
  );
}

export default memo(DesktopSidebar);
