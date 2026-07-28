import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import Loader from '../ui/Loader.jsx';

/**
 * Lejon vetem perdoruesit e identifikuar.
 *   adminOnly   → vetem administratoret
 *   financeOnly → administratoret dhe roli 'finance'
 * Kush s'ka te drejte kthehet te faqja kryesore, jo te nje faqe gabimi:
 * menuja s'ia ka shfaqur fare linkun, ndaj ketu vjen vetem me URL te shkruar.
 */
export default function ProtectedRoute({ children, adminOnly = false, financeOnly = false }) {
  const { user, ready, isAdmin, isFinance } = useAuth();
  const location = useLocation();

  if (!ready) return <Loader text="Duke verifikuar sesionin…" />;
  if (!user) return <Navigate to="/hyrje" state={{ from: location }} replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  if (financeOnly && !isFinance) return <Navigate to="/" replace />;

  return children;
}