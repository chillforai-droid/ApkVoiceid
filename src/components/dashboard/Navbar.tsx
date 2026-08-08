import { Menu, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Navbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { profile } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="h-16 border-b border-gray-200 flex items-center justify-between px-4 md:px-8 bg-white">
      <div className='flex items-center gap-4'>
        <button onClick={onMenuClick} className="md:hidden"><Menu size={20} /></button>
        <div className="text-lg font-semibold hidden md:block">Home</div>
      </div>

      <div className="relative flex-1 max-w-md mx-4">
        <Search className="absolute left-3 top-3 text-gray-400" size={18} />
        <input 
          placeholder="Search by VoiceID..."
          className="w-full p-2 pl-10 bg-gray-50 border border-gray-100 rounded-full focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          onFocus={() => navigate('/dashboard/search')}
        />
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
            <p className="text-sm font-medium">{profile?.display_name || 'User'}</p>
            <p className="text-xs text-gray-500">@{profile?.username}</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-gray-200 border-2 border-white shadow-sm overflow-hidden">
            {profile?.avatar_url && <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />}
        </div>
      </div>
    </div>
  );
}
