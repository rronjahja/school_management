import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchHeldLessons, fetchReportFilters } from '../api/oret';
import { errorMessage } from '../api/client';
import PageHeader from '../components/ui/PageHeader.jsx';
import Loader from '../components/ui/Loader.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

/**
 * Orët e mbajtura — pasqyra e administratës.
 *
 * Ndryshe nga ditari, ku shihet një paralele në një muaj, këtu shihen
 * të gjitha orët së bashku dhe në fund sa ka mbajtur secili mësimdhënës.
 * Prandaj rri veç: kujdestarit i duhet ditari i paraleles së vet, kurse
 * sa orë ka mbajtur kush është çështje e administratës.
 *
 * Periudha zgjidhet si ditë, javë ose muaj. Të tria janë e njëjta pyetje
 * me dy data, ndaj tabela dhe përmbledhja i përgjigjen gjithnjë të
 * njëjtit filtër — pa rrezikun që shifrat të tregojnë një periudhë dhe
 * lista një tjetër.
 */

const DAY_NAMES = ['E diel', 'E hënë', 'E martë', 'E mërkurë', 'E enjte', 'E premte', 'E shtunë'];

/** Emri i ditës nga një datë ISO — përdoret te titulli i periudhës. */
const dayName = (iso) => DAY_NAMES[new Date(`${iso}T00:00:00Z`).getUTCDay()];

const MONTHS = ['Janar', 'Shkurt', 'Mars', 'Prill', 'Maj', 'Qershor',
    'Korrik', 'Gusht', 'Shtator', 'Tetor', 'Nëntor', 'Dhjetor'];

const dmy = (iso) => String(iso).split('-').reverse().join('/');


/** Data e sotme si '2026-08-07'; nëse bie fundjavë, e premtja e fundit. */
function workdayToday() {
    const d = new Date();
    const dow = d.getDay();
    if (dow === 0) d.setDate(d.getDate() - 2);
    if (dow === 6) d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
}

const thisMonth = () => new Date().toISOString().slice(0, 7);

export default function OretMbajtura() {
    const [period, setPeriod] = useState('muaji');
    const [date, setDate] = useState(thisMonth());
    const [professorId, setProfessorId] = useState('');
    const [classId, setClassId] = useState('');
    const [onlySubs, setOnlySubs] = useState(false);

    const [opts, setOpts] = useState({ professors: [], classes: [] });
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        fetchReportFilters().then(setOpts).catch((err) => setError(errorMessage(err)));
    }, []);

    /** Ndërrimi i periudhës kërkon edhe formë tjetër date. */
    const switchPeriod = (next) => {
        setPeriod(next);
        setDate(next === 'muaji' ? thisMonth() : workdayToday());
    };

    const load = useCallback(() => {
        setBusy(true);
        return fetchHeldLessons({
            period,
            date,
            professor_id: professorId || undefined,
            class_id: classId || undefined,
            only_substitutions: onlySubs || undefined,
        })
            .then((d) => { setData(d); setError(''); })
            .catch((err) => setError(errorMessage(err)))
            .finally(() => setBusy(false));
    }, [period, date, professorId, classId, onlySubs]);

    useEffect(() => { load(); }, [load]);

    const rangeLabel = useMemo(() => {
        if (!data) return '';
        if (period === 'muaji') {
            const [y, m] = data.from.split('-');
            return `${MONTHS[Number(m) - 1]} ${y}`;
        }
        if (period === 'dita') return `${dayName(data.from)}, ${dmy(data.from)}`;
        return `${dmy(data.from)} – ${dmy(data.to)}`;
    }, [data, period]);

    const hasFilters = professorId || classId || onlySubs;

    const clear = () => { setProfessorId(''); setClassId(''); setOnlySubs(false); };

    return (
        <>
            <PageHeader
                title="Orët e mbajtura"
                subtitle="Pasqyra e orëve dhe përmbledhja për çdo mësimdhënës"
            />

            <div className="hl-filters">
                <div className="hl-period" role="group" aria-label="Periudha">
                    {[['dita', 'Dita'], ['java', 'Java'], ['muaji', 'Muaji']].map(([v, label]) => (
                        <button
                            key={v}
                            type="button"
                            className={`hl-period-btn${period === v ? ' active' : ''}`}
                            onClick={() => switchPeriod(v)}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <label className="hl-field">
                    <span>{period === 'muaji' ? 'Muaji' : 'Data'}</span>
                    <input
                        type={period === 'muaji' ? 'month' : 'date'}
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                    />
                </label>

                <label className="hl-field">
                    <span>Mësimdhënësi</span>
                    <select value={professorId} onChange={(e) => setProfessorId(e.target.value)}>
                        <option value="">Të gjithë</option>
                        {opts.professors.map((p) => (
                            <option key={p.id} value={p.id}>{p.full_name}</option>
                        ))}
                    </select>
                </label>

                <label className="hl-field">
                    <span>Paralelja</span>
                    <select value={classId} onChange={(e) => setClassId(e.target.value)}>
                        <option value="">Të gjitha</option>
                        {opts.classes.map((c) => (
                            <option key={c.id} value={c.id}>{c.label} · {c.category_name}</option>
                        ))}
                    </select>
                </label>

                <label className="hl-check">
                    <input
                        type="checkbox"
                        checked={onlySubs}
                        onChange={(e) => setOnlySubs(e.target.checked)}
                    />
                    <span>Vetëm zëvendësimet</span>
                </label>

                {hasFilters && (
                    <button type="button" className="btn btn-ghost btn-small" onClick={clear}>
                        Pastro filtrat
                    </button>
                )}
            </div>

            {error && <p className="form-error form-error-page">{error}</p>}

            {!data ? (
                <Loader text="Duke ngarkuar orët…" />
            ) : (
                <>
                    <div className="hl-summary-bar">
                        <strong>{rangeLabel}</strong>
                        <span className="muted">
                            {data.total_hours} {data.total_hours === 1 ? 'orë e mbajtur' : 'orë të mbajtura'}
                            {data.summary.length > 0 && ` · ${data.summary.length} mësimdhënës`}
                        </span>
                        {busy && <span className="muted">Duke rifreskuar…</span>}
                    </div>

                    {data.total_hours === 0 ? (
                        <EmptyState
                            title="Asnjë orë për këtë periudhë"
                            hint={hasFilters
                                ? 'Provoni një periudhë tjetër ose pastroni filtrat.'
                                : 'Orët shfaqen këtu sapo të shënohen te «Orët e mësimit».'}
                        />
                    ) : (
                        <>
                            {/* ---- Përmbledhja: pyetja e parë është «sa mbajti kush» ---- */}
                            <section className="card">
                                <h2 className="card-title">
                                    Orët e mbajtura sipas mësimdhënësit
                                    <span className="muted"> · {rangeLabel}</span>
                                </h2>
                                <div className="table-wrap">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Mësimdhënësi</th>
                                                <th className="num">Zëvendësime</th>
                                                <th className="num">Totali i orëve</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.summary.map((r) => (
                                                <tr key={r.professor_id}>
                                                    <td className="hl-name">{r.professor_name}</td>
                                                    <td className="num">{r.substitutions || '—'}</td>
                                                    {/* Totali i ketij mesimdhenesi — kolona e fundit */}
                                                    <td className="num hl-hours">{r.total_hours}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            {/* E vetmja shifër e theksuar: ajo që kërkohet e para */}
                                            <tr className="hl-total">
                                                <td>Të gjithë së bashku</td>
                                                <td className="num">
                                                    {data.summary.reduce((a, r) => a + r.substitutions, 0) || '—'}
                                                </td>
                                                <td className="num">{data.total_hours}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                                <p className="muted hl-note">
                                    Ora e zëvendësuar i numërohet mësimdhënësit që e mbajti, jo atij që mungoi.
                                </p>
                            </section>

                        </>
                    )}
                </>
            )}
        </>
    );
}