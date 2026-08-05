import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchGradeIssues, closeGradeIssue } from '../api/ditari';
import { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Loader from '../components/ui/Loader.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { dateTime } from '../utils/format';

/**
 * Gabimet e gjetura gjatë kontrollit të ditarit.
 *
 * Kontrolluesi (stafi) i shënon, kujdestari i rregullon. Kartela e vë
 * përballë notën që figuron në sistem me atë që thotë kontrolluesi, se
 * pikërisht ky krahasim është arsyeja e ekzistencës së kësaj faqeje.
 *
 * Gabimi mbyllet vetvetiu sapo nota ndryshon; butonat këtu janë për
 * rastet kur mbyllja duhet bërë me dorë.
 */

const TABS = [
  { value: 'error', label: 'Të hapura' },
  { value: 'resolved', label: 'Të rregulluara' },
  { value: 'dismissed', label: 'Të hedhura poshtë' },
  { value: 'all', label: 'Të gjitha' },
];

const STATUS_BADGE = {
  error: { tone: 'red', label: 'Gabim i hapur' },
  resolved: { tone: 'green', label: 'U rregullua' },
  dismissed: { tone: 'neutral', label: 'E pabazuar' },
};

const KIND_LABELS = { mark: 'Notë e vazhdueshme', closing: 'Mbyllje' };

export default function GradeIssues() {
  const { user, can } = useAuth();
  const [status, setStatus] = useState('error');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);

  const isReviewer = can('review');

  const load = useCallback(
    () => fetchGradeIssues(status).then(setRows).catch((err) => setError(errorMessage(err))),
    [status]
  );

  useEffect(() => { setRows(null); load(); }, [load]);

  const run = async (id, action, okMsg) => {
    setBusyId(id); setError(''); setNotice('');
    try {
      await closeGradeIssue(id, action);
      setNotice(okMsg);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Gabimet e ditarit"
        subtitle={
          isReviewer
            ? 'Mospërputhjet mes ditarit elektronik dhe librit fizik'
            : 'Notat që duhen korrigjuar në paralelet tuaja'
        }
      />

      <div className="dt-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={status === t.value}
            className={`dt-tab${status === t.value ? ' active' : ''}`}
            onClick={() => setStatus(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="form-error form-error-page">{error}</p>}
      {notice && <p className="form-success">{notice}</p>}

      {!rows ? (
        <Loader text="Duke ngarkuar gabimet…" />
      ) : rows.length === 0 ? (
        <EmptyState
          title={status === 'error' ? 'Asnjë gabim i hapur' : 'Asnjë gabim'}
          hint={
            status === 'error'
              ? 'Kur stafi gjen një notë që nuk përputhet me librin fizik, ajo shfaqet këtu.'
              : 'Provoni një gjendje tjetër më sipër.'
          }
        />
      ) : (
        <div className="dt-req-list">
          {rows.map((r) => {
            const badge = STATUS_BADGE[r.status] || STATUS_BADGE.error;
            const isOwner = r.kujdestar_id === user.id;
            const stillWrong = r.status === 'error'
              && r.current_value !== null
              && r.current_value === r.observed_value;

            return (
              <article key={r.id} className="card dt-req">
                <div className="dt-req-head">
                  <span className="dt-cat-dot" style={{ background: r.category_color }} />
                  <div className="dt-req-who">
                    <strong>{r.first_name} {r.last_name}</strong>
                    <span className="muted">
                      {r.subject_name} · {r.term_label} · {KIND_LABELS[r.kind]}
                      {' '}· paralelja {r.class_label || r.class_name}
                    </span>
                  </div>
                  <span className={`badge badge-${badge.tone}`}>
                    <span className="badge-dot" />
                    {badge.label}
                  </span>
                </div>

                <div className="dt-req-values">
                  <span className="dt-req-value">
                    <em>Kur u kontrollua</em>
                    <strong>{r.observed_value}</strong>
                  </span>
                  <span className={`dt-req-value${stillWrong ? '' : ' dt-req-value-new'}`}>
                    <em>Në sistem tani</em>
                    <strong>{r.current_value ?? '—'}</strong>
                  </span>
                </div>

                <p className="dt-req-reason">«{r.comment}»</p>

                <p className="dt-req-meta">
                  Shënoi <strong>{r.reviewed_by_name}</strong> më {dateTime(r.reviewed_at)}
                  {r.kujdestar_name && <> · kujdestari: <strong>{r.kujdestar_name}</strong></>}
                  {r.resolved_by_name && (
                    <> · mbylli <strong>{r.resolved_by_name}</strong> më {dateTime(r.resolved_at)}</>
                  )}
                </p>

                {r.status === 'error' && (
                  <div className="dt-req-actions">
                    {(isOwner || can('manage')) && (
                      <Link to={`/ditari/${r.class_id}`} className="btn btn-ghost btn-small">
                        Hap ditarin
                      </Link>
                    )}
                    {isReviewer && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-small"
                        disabled={busyId === r.id}
                        onClick={() => run(r.id, 'dismissed', 'Gabimi u hoq si i pabazuar.')}
                      >
                        S'ishte gabim
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary btn-small"
                      disabled={busyId === r.id}
                      onClick={() => run(r.id, 'resolved', 'Gabimi u shënua si i rregulluar.')}
                    >
                      {busyId === r.id ? 'Duke ruajtur…' : 'U rregullua'}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}