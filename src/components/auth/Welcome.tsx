import { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Mic } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function Welcome() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

  const signInWithGoogle = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://voiceid.online/auth/callback'
      }
    });
    if (error) {
      console.error('Error signing in with Google:', error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md w-full">
        <Mic className="mx-auto mb-8 text-black" size={48} />
        <h1 className="text-4xl font-extrabold tracking-tighter mb-4">Welcome to VoiceID</h1>
        <p className="text-gray-600 mb-10">Create your permanent Voice Identity.</p>
        
        <div className="space-y-4">
          <button 
            disabled={loading}
            onClick={signInWithGoogle}
            className="w-full py-4 font-semibold text-black border border-gray-200 rounded-full hover:bg-gray-50 transition disabled:opacity-50"
          >
            {loading ? 'Connecting...' : 'Continue with Google'}
          </button>
          <button onClick={() => navigate('/auth/signup')} className="w-full py-4 font-semibold text-white bg-black rounded-full hover:bg-gray-800 transition">Continue with Email</button>
        </div>
        <p className="mt-8 text-sm text-gray-500">Already have a VoiceID? <button onClick={() => navigate('/auth/login')} className="font-semibold text-black">Sign In</button></p>
      </motion.div>
    </div>
  );
}
