import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import Loader from '../ui/Loader.jsx';

/**
 * Lejon vetem perdoruesit e identifikuar qe e hapin ZONEN e kerkuar.
 *
 *   <ProtectedRoute area="finance"> ... </ProtectedRoute>
 *
 * Kush s'ka te drejte kthehet te faqja e VET e pare, jo te «/»: paneli
 * nuk eshte me i hapur per te gjithe, keshtu qe nje kthim i verber te «/»
 * do ta fuste stafin ne nje cikel te pafund midis dy faqeve te mbyllura.
 *
 * Kjo eshte lehtesi per syrin — mbrojtja e vertete eshte ne server.
 */
export default function ProtectedRoute({ children, area }) {
  const { user, ready, can, home } = useAuth();
  const location = useLocation();

  if (!ready) return <Loader text="Duke verifikuar sesionin…" />;
  if (!user) return <Navigate to="/hyrje" state={{ from: location }} replace />;

  if (area && !can(area)) {
    // Nese as shtepia s'i hapet (rast qe s'duhet te ndodhe), del te hyrja
    const target = home === location.pathname ? '/hyrje' : home;
    return <Navigate to={target} replace />;
  }

  return children;
}