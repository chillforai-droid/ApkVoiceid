import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNoIndex } from '../../hooks/useNoIndex';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  useNoIndex();
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/auth/welcome" state={{ from: location }} replace />;
  
  // If user is authenticated but hasn't set a username and isn't on the choose-id page, redirect them
  if (user && !profile?.username && location.pathname !== '/auth/choose-id') {
      return <Navigate to="/auth/choose-id" replace />;
  }

  return children;
}
