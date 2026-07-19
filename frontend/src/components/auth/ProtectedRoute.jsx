import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import Loader from '../ui/Loader.jsx';

/** Lejon vetem perdoruesit e identifikuar; `adminOnly` kufizon me tej. */
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, ready, isAdmin } = useAuth();
  const location = useLocation();

  if (!ready) return <Loader text="Duke verifikuar sesionin…" />;
  if (!user) return <Navigate to="/hyrje" state={{ from: location }} replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;

  return children;
}