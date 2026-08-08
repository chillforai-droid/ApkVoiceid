import { Home, Search, Mic, Mail, Users, Bell, Settings, LogOut, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'motion/react';

const menuItems = [
  { icon: Home, label: 'Home', path: '/dashboard' },
  { icon: Search, label: 'Search', path: '/dashboard/search' },
  { icon: Mail, label: 'Messages', path: '/dashboard/messages' },
  { icon: Bell, label: 'Notifications', path: '/dashboard/notifications' },
  { icon: Settings, label: 'Settings', path: '/dashboard/settings' },
];

export default function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { signOut } = useAuth();

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 md:hidden" 
          onClick={onClose}
        />
      )}
      <motion.div 
        className={`fixed md:relative z-50 w-64 border-r border-gray-200 h-screen flex flex-col p-4 bg-white md:bg-gray-50/50 ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        initial={false}
        animate={{ x: isOpen ? 0 : '-100%' }}
      >
        <div className="flex items-center justify-between p-4 mb-8">
            <div className="text-2xl font-bold">VoiceID</div>
            <button onClick={onClose} className="md:hidden"><X size={20} /></button>
        </div>
        
        <nav className="flex-1 flex flex-col gap-2">
          {menuItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) => 
                `flex items-center gap-3 p-3 rounded-xl transition ${isActive ? 'bg-white shadow-sm font-medium' : 'text-gray-600 hover:bg-gray-100'}`
              }
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button onClick={signOut} className="flex items-center gap-3 p-3 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-xl transition">
          <LogOut size={20} />
          Sign Out
        </button>
      </motion.div>
    </>
  );
}
