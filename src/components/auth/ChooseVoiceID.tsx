import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle2 } from 'lucide-react';

export default function ChooseVoiceID() {
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();

  const checkAvailability = async (val: string) => {
    if (val.length < 3) { setStatus('invalid'); return; }
    setStatus('checking');
    const { data } = await supabase.from('profiles').select('username').eq('username', val.toLowerCase());
    setStatus(data && data.length > 0 ? 'taken' : 'available');
  };

  const createProfile = async () => {
    if (!user) { setSubmitError("User not authenticated"); return; }
    setSubmitError(null);
    setSubmitting(true);
    const { error } = await supabase.from('profiles').insert({
        id: user.id,
        username: username.toLowerCase()
    });
    if (error) {
        setSubmitError(error.message);
        setSubmitting(false);
        return;
    }

    // Refresh the AuthContext's cached profile so ProtectedRoute sees the
    // new username immediately — otherwise it still reads the stale
    // (pre-signup) profile and bounces the user straight back here.
    try {
        await updateProfile();
    } catch {
        // Non-fatal: the profile row was created successfully either way.
    }

    setSubmitting(false);
    setSuccess(true);
    setTimeout(() => navigate('/dashboard'), 900);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <CheckCircle2 className="text-green-500 mb-4" size={48} />
        <h1 className="text-2xl font-bold mb-2">You're all set, @{username.toLowerCase()}!</h1>
        <p className="text-gray-500">Taking you to your dashboard…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full">
        <h1 className="text-4xl font-extrabold tracking-tighter mb-4">Choose VoiceID</h1>
        <p className="text-gray-600 mb-8">Your VoiceID is permanent. Choose carefully.</p>
        <div className="flex gap-2 mb-4">
            <span className="text-xl font-bold flex items-center">@</span>
            <input value={username} onChange={(e) => {setUsername(e.target.value); checkAvailability(e.target.value)}} placeholder="username" className="w-full p-4 border border-gray-200 rounded-full" />
        </div>
        <p className={`text-sm mb-4 ${status === 'available' ? 'text-green-500' : status === 'taken' ? 'text-red-500' : 'text-gray-500'}`}>
            {status === 'available' ? 'Available' : status === 'taken' ? 'Taken' : 'Enter 3-25 lowercase characters'}
        </p>
        {submitError && <p className="text-red-500 text-sm mb-4">{submitError}</p>}
        <button disabled={status !== 'available' || submitting} onClick={createProfile} className="w-full py-4 font-semibold text-white bg-black rounded-full hover:bg-gray-800 transition disabled:opacity-50">
            {submitting ? 'Creating…' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
