import { useCallback, useEffect, useMemo, useState } from 'react';
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
 *
 * Rreshtat grupohen sipas DITËS. Pyetja e vërtetë e këtij ekrani nuk është
 * «rreshti i 37-të çfarë thotë», por «çfarë ndodhi të martën» — dhe një
 * listë e pandarë datash të përsëritura e fsheh pikërisht atë.
 */

const PER_PAGE = 25;

/** Deri ne 5 numra faqesh rreth asaj ku ndodhemi. */
function pageWindow(current, total) {
  const span = 5;
  let start = Math.max(1, current - Math.floor(span / 2));
  const end = Math.min(total, start + span - 1);
  start = Math.max(1, end - span + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

const toDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Vetem ora — data qendron nje here te vetme, te koka e grupit. */
function clock(value) {
  const d = toDate(value);
  if (!d) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const DAYS = ['E diel', 'E hënë', 'E martë', 'E mërkurë', 'E enjte', 'E premte', 'E shtunë'];
const MONTHS = ['janar', 'shkurt', 'mars', 'prill', 'maj', 'qershor',
  'korrik', 'gusht', 'shtator', 'tetor', 'nëntor', 'dhjetor'];

/** Koka e grupit: «Sot», «Dje», ose «E martë, 12 gusht 2026». */
function dayHeading(value) {
  const d = toDate(value);
  if (!d) return '—';

  const midnight = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((midnight(new Date()) - midnight(d)) / 86400000);
  if (diff === 0) return 'Sot';
  if (diff === 1) return 'Dje';
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const dayKey = (value) => String(value).slice(0, 10);

/** Veprimet që meritojnë të bien në sy. */
const TONE = {
  delete: 'log-danger',
  'login-failed': 'log-danger',
  create: 'log-ok',
  login: 'log-muted',
  logout: 'log-muted',
};

/** Nje shenje per cdo subjekt: syri e gjen rreshtin pa lexuar tekstin. */
const ICONS = {
  student: '🎓', payment: '€', user: '👤', bank: '🏦', category: '📚',
  settings: '⚙', promotion: '↗', auth: '🔑', class: '🏫', subject: '📘',
  grade: '✎', register: '📋', grade_review: '✓', lesson: '🕘',
  professor: '👨‍🏫', export: '⬇', document: '📄',
};

const failed = (row) => Number(row.status_code) >= 400 || row.action === 'login-failed';

/** «{"amount":"200"}» -> rreshta cift-vlere te lexueshem. */
function parseDetails(raw) {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    const entries = Object.entries(obj);
    return entries.length ? entries : null;
  } catch {
    return [['të dhënat', String(raw)]];
  }
}

export default function ActivityLog() {
  const [data, setData] = useState(null);
  const [facets, setFacets] = useState({
    usernames: [], entities: [], actions: [], failed: 0,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);

  const [filters, setFilters] = useState({
    search: '', username: '', entity: '', action: '', from: '', to: '', only_failed: '',
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

  const loadFacets = useCallback(() => {
    fetchLogFacets().then(setFacets).catch(() => { });
  }, []);

  useEffect(() => { loadFacets(); }, [loadFacets]);

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
    setFilters({
      search: '', username: '', entity: '', action: '', from: '', to: '', only_failed: '',
    });
  };

  const refresh = () => { load(filters, page); loadFacets(); };

  const toggleFailed = () => {
    setPage(1);
    setFilters((f) => ({ ...f, only_failed: f.only_failed ? '' : 'true' }));
  };

  const hasFilters = Object.values(filters).some(Boolean);

  // Grupimi sipas dites ruan rendin e serverit (me te rejat te parat).
  const groups = useMemo(() => {
    if (!data) return [];
    const out = [];
    for (const row of data.rows) {
      const key = dayKey(row.created_at);
      const last = out[out.length - 1];
      if (last && last.key === key) last.rows.push(row);
      else out.push({ key, heading: dayHeading(row.created_at), rows: [row] });
    }
    return out;
  }, [data]);

  return (
    <section className="card">
      {/* Titulli i faqes e thote tashme se cfare eshte kjo; ketu rri vetem
          ajo qe ndryshon — sa jane dhe si te rifreskohen. */}
      <div className="card-title-row">
        <p className="muted card-sub log-intro">
          Regjistrohen edhe përpjekjet e dështuara dhe shkarkimet e dokumenteve.
          Shkrimi nuk mund të fshihet.
        </p>
        <span className="cell-actions">
          {data && (
            <span className="muted log-count">
              {data.total.toLocaleString('de-DE')} veprime
            </span>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={refresh}
            disabled={busy}
            title="Rifresko listën"
          >
            {busy ? 'Duke ngarkuar…' : '↻ Rifresko'}
          </button>
        </span>
      </div>

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

        {/* Nje buton, jo nje zgjedhes: «cfare deshtoi» eshte pyetja e pare
            kur dikush thote «nuk po punon», ndaj rri gjithnje nje klikim larg. */}
        <button
          type="button"
          className={`log-fail-toggle${filters.only_failed ? ' active' : ''}`}
          onClick={toggleFailed}
          aria-pressed={Boolean(filters.only_failed)}
          title="Vetëm veprimet që nuk u kryen"
        >
          ⚠ Të dështuara
          {facets.failed > 0 && <span className="log-fail-count">{facets.failed}</span>}
        </button>

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
          action={hasFilters ? (
            <button type="button" className="btn btn-ghost" onClick={clear}>
              Pastro filtrat
            </button>
          ) : null}
        />
      ) : (
        <>
          <div className={`log-feed${busy ? ' is-busy' : ''}`}>
            {groups.map((g) => (
              <div key={g.key} className="log-day">
                <h3 className="log-day-head">
                  <span>{g.heading}</span>
                  <span className="muted">{g.rows.length}</span>
                </h3>

                <ul className="log-list">
                  {g.rows.map((r) => {
                    const bad = failed(r);
                    const details = open === r.id ? parseDetails(r.details) : null;
                    return (
                      <li key={r.id} className={`log-item${bad ? ' is-failed' : ''}`}>
                        <span className="log-item-time" title={dateTime(r.created_at)}>
                          {clock(r.created_at)}
                        </span>

                        <span className="log-item-icon" aria-hidden="true">
                          {ICONS[r.entity] || '•'}
                        </span>

                        <div className="log-item-body">
                          <p className={`log-item-summary ${bad ? 'log-danger' : (TONE[r.action] || '')}`}>
                            {r.summary}
                          </p>
                          <p className="log-item-who muted">
                            {r.full_name || r.username}
                            <span className="log-sep">·</span>
                            {r.username}
                            {r.role && (
                              <>
                                <span className="log-sep">·</span>
                                {ROLE_LABELS[r.role] || r.role}
                              </>
                            )}
                            {bad && <span className="log-badge-fail">nuk u krye</span>}
                          </p>

                          {open === r.id && (
                            <dl className="log-details">
                              <div>
                                <dt>Rruga</dt>
                                <dd className="mono">{r.method} {r.path}</dd>
                              </div>
                              <div>
                                <dt>Përgjigjja</dt>
                                <dd className="mono">{r.status_code || '—'}</dd>
                              </div>
                              {r.entity_id && (
                                <div><dt>ID</dt><dd className="mono">{r.entity_id}</dd></div>
                              )}
                              {r.ip && <div><dt>IP</dt><dd className="mono">{r.ip}</dd></div>}
                              {details && details.map(([k, v]) => (
                                <div key={k}>
                                  <dt>{k}</dt>
                                  <dd className="mono">{String(v)}</dd>
                                </div>
                              ))}
                            </dl>
                          )}
                        </div>

                        <button
                          type="button"
                          className="log-item-more"
                          onClick={() => setOpen(open === r.id ? null : r.id)}
                          aria-expanded={open === r.id}
                          title={open === r.id ? 'Mbyll detajet' : 'Shfaq detajet'}
                        >
                          {open === r.id ? '−' : '⋯'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
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