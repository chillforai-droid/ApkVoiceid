import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { register, handleSubmit } = useForm();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'https://voiceid.online/auth/callback' }
    });
  };

  const onSubmit = async (data: any) => {
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (signInError) {
        setError(signInError.message);
        return;
    }
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full">
        <h1 className="text-4xl font-extrabold tracking-tighter mb-8">Sign In</h1>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input {...register('email')} placeholder="Email" className="w-full p-4 border border-gray-200 rounded-full" />
          <input {...register('password')} type="password" placeholder="Password" className="w-full p-4 border border-gray-200 rounded-full" />
          <div className="flex justify-end">
            <a href="/auth/forgot-password" className="text-sm text-gray-500 hover:text-black">Forgot Password?</a>
          </div>
          <button type="submit" className="w-full py-4 font-semibold text-white bg-black rounded-full hover:bg-gray-800 transition">Login</button>
          <button type="button" onClick={signInWithGoogle} className="w-full py-4 font-semibold text-black bg-gray-100 rounded-full hover:bg-gray-200 transition">Continue with Google</button>
        </form>
      </div>
    </div>
  );
}
