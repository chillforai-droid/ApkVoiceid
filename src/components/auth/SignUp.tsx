import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signUpSchema, SignUpForm } from '../../lib/validation';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function SignUp() {
  const { register, handleSubmit, formState: { errors } } = useForm<SignUpForm>({
    resolver: zodResolver(signUpSchema),
  });
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'https://voiceid.online/auth/callback' }
    });
  };

  const onSubmit = async (data: SignUpForm) => {
    setError(null);
    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { 
        data: { full_name: data.fullName },
        emailRedirectTo: 'https://voiceid.online/auth/confirm'
      }
    });
    setLoading(false);
    if (signUpError) {
        console.error('Signup error:', signUpError);
        if (signUpError.status === 429 || signUpError.message.includes('rate limit')) {
            setError('Too many attempts. Please wait a few minutes before trying again.');
        } else {
            setError(signUpError.message);
        }
        return;
    }
    navigate('/auth/choose-id');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full">
        <h1 className="text-4xl font-extrabold tracking-tighter mb-8">Create Account</h1>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input {...register('fullName')} placeholder="Full Name" className="w-full p-4 border border-gray-200 rounded-full" />
          {errors.fullName && <p className="text-red-500 text-sm">{errors.fullName.message}</p>}
          <input {...register('email')} placeholder="Email" className="w-full p-4 border border-gray-200 rounded-full" />
          {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
          <input {...register('password')} type="password" placeholder="Password" className="w-full p-4 border border-gray-200 rounded-full" />
          {errors.password && <p className="text-red-500 text-sm">{errors.password.message}</p>}
          <input {...register('confirmPassword')} type="password" placeholder="Confirm Password" className="w-full p-4 border border-gray-200 rounded-full" />
          {errors.confirmPassword && <p className="text-red-500 text-sm">{errors.confirmPassword.message}</p>}
          <label className="flex items-center gap-2">
            <input type="checkbox" {...register('acceptTerms')} />
            <span>Accept Terms</span>
          </label>
          {errors.acceptTerms && <p className="text-red-500 text-sm">{errors.acceptTerms.message}</p>}
          <button type="submit" disabled={loading} className="w-full py-4 font-semibold text-white bg-black rounded-full hover:bg-gray-800 transition disabled:opacity-50">
            {loading ? 'Creating...' : 'Create Account'}
          </button>
          <button type="button" onClick={signInWithGoogle} className="w-full py-4 font-semibold text-black bg-gray-100 rounded-full hover:bg-gray-200 transition">Continue with Google</button>
        </form>
      </div>
    </div>
  );
}
