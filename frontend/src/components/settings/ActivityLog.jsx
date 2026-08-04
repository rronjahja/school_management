import { useCallback, useEffect, useState } from 'react';
import { fetchLogs, fetchLogFacets } from '../../api/meta';
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

const PER_PAGE = 50;

/** "2026-07-21 14:32" nga vlera që kthen MySQL. */
function stamp(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 16).replace('T', ' ');
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const ROLE_LABELS = {
  admin: 'Administrator',
  finance: 'Financa',
  kujdestar: 'Kujdestar',
  staff: 'Staf',
};

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
              <button
                type="button"
                className="btn btn-ghost btn-small"
                disabled={page <= 1 || busy}
                onClick={() => setPage((n) => n - 1)}
              >
                ← Më të reja
              </button>
              <span className="muted">Faqja {data.page} nga {data.pages}</span>
              <button
                type="button"
                className="btn btn-ghost btn-small"
                disabled={page >= data.pages || busy}
                onClick={() => setPage((n) => n + 1)}
              >
                Më të vjetra →
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}