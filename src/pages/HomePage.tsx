import { useAuth } from '../context/AuthContext';
import { Mail, Search, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function HomePage() {
  const { profile } = useAuth();
  const displayName = profile?.display_name || 'there';

  const actions = [
    { label: 'Messages', icon: Mail, path: '/dashboard/messages' },
    { label: 'Search VoiceID', icon: Search, path: '/dashboard/search' },
    { label: 'Start Chat', icon: MessageSquare, path: '/dashboard/search' },
  ];

  return (
    <div className="max-w-xl mx-auto space-y-8 p-4">
      <div className="flex items-center gap-4 min-w-0">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt={displayName} decoding="async" className="w-16 h-16 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-bold shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">Hello, {displayName}</h1>
          <p className="text-gray-500">How's your voice today?</p>
        </div>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3">
          {actions.map((action) => (
            <Link
              key={action.label}
              to={action.path}
              className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-2xl hover:border-blue-200 transition-colors shadow-sm"
            >
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <action.icon size={24} />
              </div>
              <span className="font-medium text-gray-900">{action.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
