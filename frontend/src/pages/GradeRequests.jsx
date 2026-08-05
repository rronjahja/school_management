import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    fetchEditRequests, decideEditRequest, cancelEditRequest,
} from '../api/ditari';
import { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Loader from '../components/ui/Loader.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { dateTime } from '../utils/format';

/**
 * Kërkesat për ndryshimin e notave të mbyllura.
 *
 * Administratori i sheh të gjitha dhe vendos; kujdestari sheh vetëm të
 * vetat dhe mund t'i tërheqë derisa s'janë shqyrtuar. Ndarja bëhet në
 * server — kjo faqe vetëm e pasqyron.
 */

const TABS = [
    { value: 'pending', label: 'Në pritje' },
    { value: 'approved', label: 'Të miratuara' },
    { value: 'declined', label: 'Të refuzuara' },
    { value: 'used', label: 'Të përdorura' },
    { value: 'all', label: 'Të gjitha' },
];

const STATUS_BADGE = {
    pending: { tone: 'yellow', label: 'Në pritje' },
    approved: { tone: 'green', label: 'E miratuar' },
    declined: { tone: 'red', label: 'E refuzuar' },
    used: { tone: 'neutral', label: 'E përdorur' },
};

export default function GradeRequests() {
    // Vendimin mbi kerkesat e merr administratori DHE menaxheri — eshte
    // veprim menaxhimi, jo konfigurim i sistemit.
    const { isManager } = useAuth();
    const [status, setStatus] = useState('pending');
    const [rows, setRows] = useState(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busyId, setBusyId] = useState(null);
    const [noteFor, setNoteFor] = useState(null);   // kërkesa që po refuzohet
    const [note, setNote] = useState('');

    const load = useCallback(
        () => fetchEditRequests(status).then(setRows).catch((err) => setError(errorMessage(err))),
        [status]
    );

    useEffect(() => { setRows(null); load(); }, [load]);

    const run = async (id, fn, okMsg) => {
        setBusyId(id); setError(''); setNotice('');
        try {
            await fn();
            setNotice(okMsg);
            await load();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusyId(null);
        }
    };

    const approve = (r) =>
        run(r.id, () => decideEditRequest(r.id, 'approved'),
            `Leja u dha — ${r.first_name} ${r.last_name} · ${r.subject_name}`);

    const decline = (r) =>
        run(r.id, () => decideEditRequest(r.id, 'declined', note.trim() || null),
            `Kërkesa u refuzua — ${r.first_name} ${r.last_name} · ${r.subject_name}`)
            .then(() => { setNoteFor(null); setNote(''); });

    const cancel = (r) =>
        run(r.id, () => cancelEditRequest(r.id), 'Kërkesa u tërhoq.');

    return (
        <>
            <PageHeader
                title="Kërkesat për ndryshim notash"
                subtitle={
                    isManager
                        ? 'Notat e mbyllura ndryshohen vetëm me miratimin tuaj'
                        : 'Kërkesat tuaja për ndryshimin e notave të mbyllura'
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
                <Loader text="Duke ngarkuar kërkesat…" />
            ) : rows.length === 0 ? (
                <EmptyState
                    title={status === 'pending' ? 'Asnjë kërkesë në pritje' : 'Asnjë kërkesë'}
                    hint={
                        status === 'pending'
                            ? 'Kur një kujdestar kërkon të ndryshojë një notë të mbyllur, kërkesa shfaqet këtu.'
                            : 'Provoni një gjendje tjetër më sipër.'
                    }
                />
            ) : (
                <div className="dt-req-list">
                    {rows.map((r) => {
                        const badge = STATUS_BADGE[r.status] || STATUS_BADGE.pending;
                        return (
                            <article key={r.id} className="card dt-req">
                                <div className="dt-req-head">
                                    <span className="dt-cat-dot" style={{ background: r.category_color }} />
                                    <div className="dt-req-who">
                                        <strong>{r.first_name} {r.last_name}</strong>
                                        <span className="muted">
                                            {r.subject_name} · {r.term_label} · paralelja {r.class_label || r.class_name}
                                        </span>
                                    </div>
                                    <span className={`badge badge-${badge.tone}`}>
                                        <span className="badge-dot" />
                                        {badge.label}
                                    </span>
                                </div>

                                <div className="dt-req-values">
                                    <span className="dt-req-value">
                                        <em>Nota e mbyllur</em>
                                        <strong>{r.old_value ?? '—'}</strong>
                                    </span>
                                    {r.current_value !== null && r.current_value !== r.old_value && (
                                        <span className="dt-req-value dt-req-value-new">
                                            <em>Tani</em>
                                            <strong>{r.current_value}</strong>
                                        </span>
                                    )}
                                </div>

                                <p className="dt-req-reason">«{r.reason}»</p>

                                <p className="dt-req-meta">
                                    Kërkoi <strong>{r.requested_by_name}</strong> më {dateTime(r.created_at)}
                                    {r.decided_by_name && (
                                        <> · vendosi <strong>{r.decided_by_name}</strong> më {dateTime(r.decided_at)}</>
                                    )}
                                </p>

                                {r.decision_note && (
                                    <p className="dt-req-note">Shënim i administratorit: {r.decision_note}</p>
                                )}

                                {r.status === 'pending' && (
                                    isManager ? (
                                        noteFor === r.id ? (
                                            <div className="dt-req-decline">
                                                <input
                                                    value={note}
                                                    autoFocus
                                                    maxLength={500}
                                                    placeholder="Arsyeja e refuzimit (jo e detyrueshme)"
                                                    onChange={(e) => setNote(e.target.value)}
                                                />
                                                <button type="button" className="btn btn-ghost btn-small"
                                                    onClick={() => { setNoteFor(null); setNote(''); }}>
                                                    Anulo
                                                </button>
                                                <button type="button" className="btn btn-danger btn-small"
                                                    disabled={busyId === r.id} onClick={() => decline(r)}>
                                                    Refuzo
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="dt-req-actions">
                                                <button type="button" className="btn btn-ghost btn-small"
                                                    onClick={() => { setNoteFor(r.id); setNote(''); }}>
                                                    Refuzo
                                                </button>
                                                <button type="button" className="btn btn-primary btn-small"
                                                    disabled={busyId === r.id} onClick={() => approve(r)}>
                                                    {busyId === r.id ? 'Duke ruajtur…' : 'Mirato'}
                                                </button>
                                            </div>
                                        )
                                    ) : (
                                        <div className="dt-req-actions">
                                            <button type="button" className="btn btn-ghost btn-small"
                                                disabled={busyId === r.id} onClick={() => cancel(r)}>
                                                Tërhiq kërkesën
                                            </button>
                                        </div>
                                    )
                                )}

                                {r.status === 'approved' && (
                                    <p className="dt-req-hint">
                                        Leja është e lirë: kujdestari mund ta ndryshojë notën një herë te{' '}
                                        <Link to={`/ditari/${r.class_id}`}>ditari i paraleles {r.class_label || r.class_name}</Link>.
                                    </p>
                                )}
                            </article>
                        );
                    })}
                </div>
            )}
        </>
    );
}