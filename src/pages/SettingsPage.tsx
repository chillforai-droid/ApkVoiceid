import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Loader2, Save, User, Bell, Shield, LogOut, Trash2, Ban } from 'lucide-react';
import { Avatar } from '../components/common/Avatar';

export default function SettingsPage() {
  const { user, profile, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    fetchSettings();
  }, [user]);

  const fetchSettings = async () => {
    if (!user) return;
    const { data } = await supabase.from('user_settings').select('*').eq('user_id', user?.id).single();
    if (data) setSettings(data);
  };

  const saveProfile = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName, bio })
      .eq('id', user?.id);
    
    if (!error) {
        updateProfile();
        setMessage('Profile updated!');
    }
    setLoading(false);
  };

  const updateSettings = async (updates: any) => {
    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: user?.id, ...settings, ...updates });
    
    if (!error) {
        setSettings({ ...settings, ...updates });
        setMessage('Settings updated!');
    }
  };

  const changePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) setMessage(`Error: ${error.message}`);
    else setMessage('Password updated!');
  };

  const unblockUser = async (blockedUserId: string) => {
    // .select() forces the delete to report back which rows it actually
    // removed. Without it, a delete blocked by RLS (0 rows affected) still
    // returns error: null, so a no-op would look identical to success.
    const { data, error } = await supabase.from('contacts').delete().match({ requester_id: user?.id, responder_id: blockedUserId, status: 'blocked' }).select();

    if (error) {
        console.error('Unblock failed', error);
        setMessage(`Error: ${error.message}`);
        return;
    }
    if (!data || data.length === 0) {
        console.error('Unblock affected 0 rows (blocked by RLS or already unblocked)', blockedUserId);
        setMessage('Failed to unblock user: permission denied.');
        return;
    }
    fetchBlockedUsers();
  };

  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const fetchBlockedUsers = async () => {
    if (!user) return;
    const { data } = await supabase.from('contacts').select('responder_id, profiles(display_name, username, avatar_url)').match({ requester_id: user?.id, status: 'blocked' });
    if (data) setBlockedUsers(data);
  };
  useEffect(() => { fetchBlockedUsers(); }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 sm:space-y-8 p-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      
      {/* Profile Section */}
      <div className="space-y-4 p-4 sm:p-6 bg-white border border-gray-100 rounded-2xl">
        <h2 className="text-lg font-semibold flex items-center gap-2"><User size={18}/> Profile</h2>
        <div className="flex items-center gap-4">
            <Avatar url={profile?.avatar_url} displayName={profile?.display_name} className="w-16 h-16 shrink-0" />
            <div className='flex-1 min-w-0'>
                <p className="font-semibold truncate">{profile?.display_name}</p>
                <p className="text-gray-500 truncate">@{profile?.username}</p>
            </div>
        </div>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full p-3 border rounded-full" placeholder="Display Name" />
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="w-full p-3 border rounded-2xl" placeholder="Bio" rows={3} />
        <button onClick={saveProfile} disabled={loading} className="px-6 py-3 bg-blue-600 text-white rounded-full flex items-center gap-2 justify-center w-full sm:w-auto">
            {loading ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Save Profile
        </button>
      </div>

      {/* Account & Security */}
      <div className="p-4 sm:p-6 bg-white border border-gray-100 rounded-2xl space-y-4">
        <h2 className="text-lg font-semibold mb-4">Account</h2>
        <p className="text-sm text-gray-500 break-words">Email: {user?.email}</p>
        <p className="text-sm text-gray-500">Provider: {user?.app_metadata.provider || 'Email & Password'}</p>
        {(!user?.app_metadata.provider || user?.app_metadata.provider === 'email') && (
            <div className="space-y-2">
                <input type="password" placeholder="New Password" onChange={(e) => setPassword(e.target.value)} className="w-full p-3 border rounded-full" />
                <button onClick={() => changePassword(password)} className="px-6 py-3 bg-gray-600 text-white rounded-full w-full sm:w-auto">Change Password</button>
            </div>
        )}
      </div>

      {/* Blocked Users */}
      {blockedUsers.length > 0 && <div className="p-4 sm:p-6 bg-white border border-gray-100 rounded-2xl space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Ban size={18}/> Blocked Users</h2>
        {blockedUsers.map(b => (
            <div key={b.responder_id} className="flex items-center justify-between gap-4">
                <div className='flex items-center gap-2 min-w-0'>
                    <Avatar url={b.profiles.avatar_url} displayName={b.profiles.display_name} className="w-8 h-8 shrink-0" />
                    <span className="truncate">{b.profiles.display_name}</span>
                </div>
                <button onClick={() => unblockUser(b.responder_id)} className="text-green-600 text-sm shrink-0">Unblock</button>
            </div>
        ))}
      </div>}

      {/* Privacy */}
      {settings && <div className="p-4 sm:p-6 bg-white border border-gray-100 rounded-2xl space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Shield size={18}/> Privacy</h2>
        <select value={settings.contact_requests} onChange={(e) => updateSettings({contact_requests: e.target.value})} className="w-full p-3 border rounded-full">
            <option value="everyone">Everyone can send contact requests</option>
            <option value="contacts_of_contacts">Contacts of contacts only</option>
            <option value="nobody">Nobody</option>
        </select>
      </div>}

      {/* Notifications */}
      {settings && <div className="p-4 sm:p-6 bg-white border border-gray-100 rounded-2xl space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Bell size={18}/> Notifications</h2>
        <label className="flex items-center gap-2">
            <input type="checkbox" checked={settings.notify_contact_requests} onChange={(e) => updateSettings({notify_contact_requests: e.target.checked})} />
            Contact Requests
        </label>
      </div>}

      {/* Danger Zone */}
      <div className="p-4 sm:p-6 bg-white border border-red-100 rounded-2xl space-y-4">
        <h2 className="text-lg font-semibold text-red-600 flex items-center gap-2"><Trash2 size={18}/> Danger Zone</h2>
        <button className="text-red-600 font-semibold flex items-center gap-2">Delete Account</button>
      </div>

      <div className="p-4 sm:p-6 bg-white border border-gray-100 rounded-2xl">
        <button onClick={signOut} className="text-red-600 font-semibold flex items-center gap-2"><LogOut size={16}/> Sign Out</button>
      </div>
      {message && <p className="text-sm text-green-600 text-center">{message}</p>}
    </div>
  );
}
