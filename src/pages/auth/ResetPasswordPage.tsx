import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setError('');
    
    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage('Password updated successfully.');
    }
    setLoading(false);
  };

  if (message) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md space-y-8">
            <h1 className="text-3xl font-bold">Success</h1>
            <p className="text-gray-600">{message}</p>
            <button onClick={() => navigate('/auth/login')} className="w-full py-4 font-semibold text-white bg-black rounded-full hover:bg-gray-800 transition">Continue to Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md space-y-8">
        <h1 className="text-3xl font-bold">Create New Password</h1>
        
        <form onSubmit={handleUpdate} className="space-y-4">
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New Password" 
            className="w-full p-4 border border-gray-200 rounded-full" 
            required
          />
          <input 
            type="password" 
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm New Password" 
            className="w-full p-4 border border-gray-200 rounded-full" 
            required
          />
          <button type="submit" disabled={loading} className="w-full py-4 font-semibold text-white bg-black rounded-full hover:bg-gray-800 transition disabled:opacity-50">
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
        {error && <p className="text-red-500">{error}</p>}
      </div>
    </div>
  );
}
