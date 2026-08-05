import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchClasses } from '../api/ditari';
import { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Loader from '../components/ui/Loader.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { YEAR_LABELS, shortGen } from '../utils/format';

/**
 * Ditari i notave — lista e paraleleve.
 * Administratori i sheh të gjitha; kujdestari vetëm të vetat (kështu
 * i kthen edhe serveri). Kujdestari me një paralele të vetme kalon
 * direkt te ditari i saj, pa hap të ndërmjetëm.
 */
export default function Ditari() {
  // isManager → i sheh te gjitha paralelet, ndaj nuk kercen te njera
  // can('administrata') → i krijon dot vete paralelet
  const { isManager, can } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchClasses()
      .then((rows) => {
        setClasses(rows);
        if (!isManager && rows.length === 1) {
          navigate(`/ditari/${rows[0].id}`, { replace: true });
        }
      })
      .catch((err) => setError(errorMessage(err)));
  }, [isManager, navigate]);

  if (error) return <EmptyState title="Gabim" hint={error} />;
  if (!classes) return <Loader text="Duke hapur ditarin…" />;

  return (
    <>
      <PageHeader
        title="Ditari i notave"
        subtitle="Suksesi i nxënësve sipas lëndëve mësimore — zgjidhni paralelen"
      />

      {classes.length === 0 ? (
        <EmptyState
          title="Ende nuk ka paralele"
          hint={
            can('administrata')
              ? 'Krijoni paralelet dhe caktoni kujdestarët te faqja «Administrata».'
              : 'Ende nuk ju është caktuar asnjë paralele. Drejtojuni administratës së shkollës.'
          }
        />
      ) : (
        <div className="dt-class-grid">
          {classes.map((c) => (
            <Link key={c.id} to={`/ditari/${c.id}`} className={`dt-class-card${c.is_active ? '' : ' dt-class-inactive'}`}>
              <span className="dt-class-spine" style={{ background: c.category_color }} />
              <span className="dt-class-body">
                <strong className="dt-class-name">{c.label || c.name}</strong>
                <span className="dt-class-cat" style={{ color: c.category_color }}>
                  {c.category_name}
                </span>
                <span className="dt-class-line">
                  {YEAR_LABELS[c.study_year]} · {shortGen(c.school_year)}
                </span>
                <span className="dt-class-line">
                  Kujdestari: <strong>{c.kujdestar_name || '—'}</strong>
                </span>
                <span className="dt-class-foot">
                  <span>{c.students_count} nxënës</span>
                  {!c.is_active && <span className="badge badge-neutral">Çaktivizuar</span>}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}