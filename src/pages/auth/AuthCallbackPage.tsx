import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { updateProfile } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      // Wait for session to be established
      const { data: { session }, error } = await supabase.auth.getSession();
      

      if (error || !session) {
        console.error('Callback error or no session:', error);
        navigate('/auth/login', { replace: true });
        return;
      }
      

      // Check profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();


      if (profileError || !profile || !profile.username) {
        navigate('/auth/choose-id', { replace: true });
      } else {
        await updateProfile();
        navigate('/dashboard', { replace: true });
      }
    };

    handleCallback();
  }, [navigate, updateProfile]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Authenticating...</p>
    </div>
  );
}
