import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function ConfirmPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleConfirm = async () => {
      const { error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Confirmation error:', error);
        navigate('/auth/login', { replace: true });
        return;
      }
      
      // If we have a session, we are confirmed.
      // Now check profile to see where to redirect.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
          navigate('/auth/login', { replace: true });
          return;
      }

      // Check profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (!profile || !profile.username) {
        navigate('/auth/choose-id', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    };

    handleConfirm();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Confirming your email...</p>
    </div>
  );
}
