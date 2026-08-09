import { useCallback, useEffect, useState } from 'react';
import { fetchLogs, fetchLogFacets } from '../../api/meta';
import { dateTime } from '../../utils/format';
import { ROLE_LABELS } from '../../config/roles';
import { errorMessage } from '../../api/client';
import EmptyState from '../ui/EmptyState.jsx';

/**
 * Ditari i veprimeve — kush çfarë ndryshoi dhe kur.
 *
 * Kërkimi bëhet NË SERVER, jo mbi një listë të ngarkuar: ditari rritet
 * pa fund dhe s'do të kishte kuptim të tërhiqej i tëri te shfletuesi.
 * Shkrimi është i pandryshueshëm — s'ka butona fshirjeje me qëllim,
 * përndryshe ditari s'do të kishte vlerë si dëshmi.
 */

// Dhjete veprimet e fundit per faqe: lista lexohet me nje veshtrim dhe
// pyetja e zakonshme — «cfare ndodhi tani» — merr pergjigje pa rreshqitje.
const PER_PAGE = 10;

/** Deri ne 5 numra faqesh rreth asaj ku ndodhemi. */
function pageWindow(current, total) {
  const span = 5;
  let start = Math.max(1, current - Math.floor(span / 2));
  const end = Math.min(total, start + span - 1);
  start = Math.max(1, end - span + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

/**
 * Data e veprimit. Delegon te ndihmesi i perbashket, qe formati te mos
 * jete nje kopje me vete qe mbetet pas kur ndryshon rregulli.
 */
function stamp(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 16).replace('T', ' ');
  return dateTime(value);
}

/** Veprimet që meritojnë të bien në sy. */
const TONE = {
  delete: 'log-danger',
  'login-failed': 'log-danger',
  create: 'log-ok',
  login: 'log-muted',
  logout: 'log-muted',
};

export default function ActivityLog() {
  const [data, setData] = useState(null);
  const [facets, setFacets] = useState({ usernames: [], entities: [], actions: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);

  const [filters, setFilters] = useState({
    search: '', username: '', entity: '', action: '', from: '', to: '',
  });
  const [page, setPage] = useState(1);

  const load = useCallback(async (f, p) => {
    setBusy(true);
    setError('');
    try {
      const clean = Object.fromEntries(Object.entries(f).filter(([, v]) => v));
      setData(await fetchLogs({ ...clean, page: p, limit: PER_PAGE }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    fetchLogFacets().then(setFacets).catch(() => {});
  }, []);

  // Kërkimi pret pak pas shtypjes së fundit — pa këtë, çdo shkronjë
  // do të nisë një kërkesë të re në server.
  useEffect(() => {
    const t = setTimeout(() => load(filters, page), filters.search ? 350 : 0);
    return () => clearTimeout(t);
  }, [filters, page, load]);

  const set = (name) => (e) => {
    setPage(1);
    setFilters((f) => ({ ...f, [name]: e.target.value }));
  };

  const clear = () => {
    setPage(1);
    setFilters({ search: '', username: '', entity: '', action: '', from: '', to: '' });
  };

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <section className="card">
      <div className="card-title-row">
        <h2 className="card-title">Ditari i veprimeve</h2>
        {data && (
          <span className="muted log-count">
            {data.total.toLocaleString('de-DE')} veprime
          </span>
        )}
      </div>
      <p className="muted card-sub">
        Çdo ndryshim në sistem: kush e bëri, çfarë ndryshoi dhe kur. Vetëm
        administratorët e shohin. Shkrimi nuk mund të fshihet.
      </p>

      <div className="log-filters">
        <input
          type="search"
          className="filter-search"
          placeholder="Kërko: emër, nxënës, veprim…"
          value={filters.search}
          onChange={set('search')}
        />
        <select value={filters.username} onChange={set('username')} aria-label="Përdoruesi">
          <option value="">Të gjithë përdoruesit</option>
          {facets.usernames.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={filters.entity} onChange={set('entity')} aria-label="Subjekti">
          <option value="">Gjithçka</option>
          {facets.entities.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
        <select value={filters.action} onChange={set('action')} aria-label="Veprimi">
          <option value="">Të gjitha veprimet</option>
          {facets.actions.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
        <input type="date" value={filters.from} onChange={set('from')} aria-label="Nga data" />
        <input type="date" value={filters.to} onChange={set('to')} aria-label="Deri më" />
        {hasFilters && (
          <button type="button" className="btn btn-ghost btn-small" onClick={clear}>
            Pastro
          </button>
        )}
      </div>

      {error && <p className="form-error">{error}</p>}

      {!data ? (
        <p className="muted">Duke ngarkuar…</p>
      ) : data.rows.length === 0 ? (
        <EmptyState
          title="Asnjë veprim"
          hint={hasFilters ? 'Provoni filtra të tjerë.' : 'Ende nuk është regjistruar asgjë.'}
        />
      ) : (
        <>
          <div className={`table-wrap${busy ? ' is-busy' : ''}`}>
            <table className="table log-table">
              <thead>
                <tr>
                  <th>Data dhe ora</th>
                  <th>Përdoruesi</th>
                  <th>Veprimi</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="mono log-time">{stamp(r.created_at)}</td>
                    <td>
                      <strong>{r.full_name || r.username}</strong>
                      <span className="muted cell-sub">
                        {r.username}
                        {r.role ? ` · ${ROLE_LABELS[r.role] || r.role}` : ''}
                      </span>
                    </td>
                    <td>
                      <span className={TONE[r.action] || ''}>{r.summary}</span>
                    </td>
                    <td className="num">
                      {(r.details || r.path) && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-small"
                          onClick={() => setOpen(open === r.id ? null : r.id)}
                          title="Shfaq detajet"
                        >
                          {open === r.id ? '−' : '⋯'}
                        </button>
                      )}
                      {open === r.id && (
                        <dl className="log-details">
                          <div><dt>Rruga</dt><dd className="mono">{r.method} {r.path}</dd></div>
                          {r.entity_id && <div><dt>ID</dt><dd className="mono">{r.entity_id}</dd></div>}
                          {r.ip && <div><dt>IP</dt><dd className="mono">{r.ip}</dd></div>}
                          {r.details && (
                            <div><dt>Të dhënat</dt><dd className="mono log-json">{r.details}</dd></div>
                          )}
                        </dl>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.pages > 1 && (
            <div className="log-pager">
              <span className="muted log-range">
                {(data.page - 1) * data.limit + 1}–
                {Math.min(data.page * data.limit, data.total)} nga{' '}
                {data.total.toLocaleString('de-DE')}
              </span>

              <span className="log-pager-btns">
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  title="Të fundit"
                  disabled={page <= 1 || busy}
                  onClick={() => setPage(1)}
                >
                  «
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  disabled={page <= 1 || busy}
                  onClick={() => setPage((n) => n - 1)}
                >
                  ← Më të reja
                </button>

                {/* Nje dritare e ngushte numrash: me 10 per faqe numri i
                    faqeve rritet shpejt, dhe nje rresht i tere numrash do
                    te ishte me i veshtire per t'u lexuar se vete lista. */}
                {pageWindow(data.page, data.pages).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`log-page-btn${n === data.page ? ' active' : ''}`}
                    disabled={busy}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </button>
                ))}

                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  disabled={page >= data.pages || busy}
                  onClick={() => setPage((n) => n + 1)}
                >
                  Më të vjetra →
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  title="Të parat"
                  disabled={page >= data.pages || busy}
                  onClick={() => setPage(data.pages)}
                >
                  »
                </button>
              </span>
            </div>
          )}
        </>
      )}
    </section>
  );
}