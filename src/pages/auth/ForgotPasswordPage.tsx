import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://voiceid.online/auth/reset-password',
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage('We sent a password reset link to your email address.');
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md space-y-8">
        <h1 className="text-3xl font-bold">Forgot Password</h1>
        <p className="text-gray-600">Enter the email associated with your VoiceID account. We'll send you a password reset link.</p>
        
        <form onSubmit={handleReset} className="space-y-4">
          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email" 
            className="w-full p-4 border border-gray-200 rounded-full" 
            required
          />
          <button type="submit" disabled={loading} className="w-full py-4 font-semibold text-white bg-black rounded-full hover:bg-gray-800 transition disabled:opacity-50">
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
        {error && <p className="text-red-500">{error}</p>}
        {message && <p className="text-green-500">{message}</p>}
        <Link to="/auth/login" className="block text-center text-gray-600 hover:text-black">Back to Login</Link>
      </div>
    </div>
  );
}
