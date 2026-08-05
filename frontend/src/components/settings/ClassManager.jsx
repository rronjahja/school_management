import { useEffect, useState } from 'react';
import {
    fetchClasses, fetchClassOptions, createClass, updateClass, deleteClass,
} from '../../api/ditari';
import { fetchCategories } from '../../api/meta';
import { errorMessage } from '../../api/client';
import { YEAR_LABELS, currentSchoolYear, shortGen, classLabel } from '../../utils/format';
import { ROLE_LABELS } from '../../config/roles';
import Modal from '../ui/Modal.jsx';
import Field from '../ui/Field.jsx';

const EMPTY = {
    name: '', category_id: '', study_year: 1, school_year: '', kujdestar_id: '',
};

/** Sa paralele mund të ketë një drejtim në një vit — si te serveri. */
const MAX_PARALLELS = 8;
const NUMBERS = Array.from({ length: MAX_PARALLELS }, (_, i) => i + 1);

/**
 * Paralelet dhe kujdestarët (vetëm administratori).
 *
 * Kujdestar caktohet një përdorues me rolin «Kujdestar/e» ose «Staf»:
 * në shkollë një arsimtar shpesh mban edhe kujdestarinë e një paraleleje.
 * Nxënësit nuk zgjidhen me dorë: paralelja i merr vetë sipas drejtimit,
 * vitit të studimit dhe gjeneratës.
 */
export default function ClassManager() {
    const [classes, setClasses] = useState(null);
    const [categories, setCategories] = useState([]);
    const [options, setOptions] = useState({ kujdestars: [], generations: [] });
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);      // paralelja në ndryshim, ose null = e re
    const [form, setForm] = useState(EMPTY);
    const [deleting, setDeleting] = useState(null);

    const load = () =>
        Promise.all([fetchClasses(), fetchCategories(), fetchClassOptions()])
            .then(([cls, cats, opts]) => {
                setClasses(cls);
                setCategories(cats);
                setOptions(opts);
            })
            .catch((err) => setError(errorMessage(err)));

    useEffect(() => { load(); }, []);

    const schoolYears = Array.from(
        new Set([currentSchoolYear(), ...options.generations])
    );

    /**
     * Cilët numra janë zënë për drejtimin, vitin dhe gjeneratën e zgjedhur.
     * Llogaritet nga paralelet që kemi tashmë në ekran, ndaj butonat
     * ndryshojnë menjëherë sapo ndërrohet drejtimi — pa asnjë thirrje tjetër.
     *
     * Paralelja që po ndryshohet nuk numërohet si e zënë: përndryshe
     * numri i saj do të dilte i çaktivizuar në formularin e vet.
     */
    const takenNumbers = new Set(
        (classes || [])
            .filter((c) => c.id !== editing?.id
                && String(c.category_id) === String(form.category_id)
                && Number(c.study_year) === Number(form.study_year)
                && c.school_year === form.school_year)
            .map((c) => String(c.name))
    );

    const openNew = () => {
        setEditing(null);
        setForm({
            ...EMPTY,
            category_id: categories[0]?.id || '',
            school_year: currentSchoolYear(),
        });
        setModalOpen(true);
    };

    const openEdit = (c) => {
        setEditing(c);
        setForm({
            name: c.name,
            category_id: c.category_id,
            study_year: c.study_year,
            school_year: c.school_year,
            kujdestar_id: c.kujdestar_id || '',
        });
        setModalOpen(true);
    };

    const wrap = async (fn, okMsg) => {
        setBusy(true); setError(''); setNotice('');
        try {
            await fn();
            setNotice(okMsg);
            await load();
            return true;
        } catch (err) {
            setError(errorMessage(err));
            return false;
        } finally {
            setBusy(false);
        }
    };

    const submit = async (e) => {
        e.preventDefault();
        const payload = { ...form, kujdestar_id: form.kujdestar_id || null };
        const ok = editing
            ? await wrap(() => updateClass(editing.id, payload), 'Paralelja u përditësua.')
            : await wrap(() => createClass(payload), 'Paralelja u krijua me lëndët e bërthamës.');
        if (ok) setModalOpen(false);
    };

    const toggleActive = (c) =>
        wrap(
            () => updateClass(c.id, { is_active: !c.is_active }),
            c.is_active ? 'Paralelja u çaktivizua.' : 'Paralelja u aktivizua.'
        );

    const confirmDelete = async () => {
        const ok = await wrap(() => deleteClass(deleting.id), 'Paralelja u fshi.');
        if (ok) setDeleting(null);
    };

    return (
        <section className="card">
            <div className="card-title-row">
                <h2 className="card-title">Paralelet dhe kujdestarët</h2>
                <button type="button" className="btn btn-primary btn-small" onClick={openNew}>
                    + Shto paralele
                </button>
            </div>

            <p className="settings-intro">
                Çdo paralele ka ditarin e vet të notave. Kujdestar mund të caktohet çdo përdorues
                aktiv me rolin <strong>«Kujdestar/e»</strong> ose <strong>«Staf»</strong> — ai sheh
                dhe plotëson <strong>vetëm</strong> ditarin e paraleles së vet.
                Nxënësit hyjnë vetë në paralele sipas drejtimit, vitit dhe gjeneratës.
            </p>

            {error && <p className="form-error">{error}</p>}
            {notice && <p className="form-success">{notice}</p>}

            {!classes ? (
                <p className="muted">Duke ngarkuar…</p>
            ) : classes.length === 0 ? (
                <p className="muted">Ende nuk është krijuar asnjë paralele.</p>
            ) : (
                <div className="table-wrap">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Paralelja</th>
                                <th>Drejtimi</th>
                                <th>Viti</th>
                                <th>Viti shkollor</th>
                                <th>Kujdestari</th>
                                <th className="num">Nxënës</th>
                                <th>Statusi</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {classes.map((c) => (
                                <tr key={c.id}>
                                    <td><strong>{c.label || classLabel(c.study_year, c.name)}</strong></td>
                                    <td>
                                        <span className="dt-cat-dot" style={{ background: c.category_color }} />
                                        {c.category_name}
                                    </td>
                                    <td>{YEAR_LABELS[c.study_year]}</td>
                                    <td>{shortGen(c.school_year)}</td>
                                    <td>{c.kujdestar_name || <span className="muted">— pa caktuar —</span>}</td>
                                    <td className="num">{c.students_count}</td>
                                    <td>
                                        <span className={`badge badge-${c.is_active ? 'green' : 'neutral'}`}>
                                            <span className="badge-dot" />
                                            {c.is_active ? 'Aktive' : 'Çaktivizuar'}
                                        </span>
                                    </td>
                                    <td className="cell-tight">
                                        <span className="cell-actions">
                                            <button type="button" className="btn btn-ghost btn-small"
                                                onClick={() => openEdit(c)}>
                                                Ndrysho
                                            </button>
                                            <button type="button" className="btn btn-ghost btn-small"
                                                disabled={busy} onClick={() => toggleActive(c)}>
                                                {c.is_active ? 'Çaktivizo' : 'Aktivizo'}
                                            </button>
                                            <button type="button" className="btn btn-ghost btn-small"
                                                onClick={() => setDeleting(c)}>
                                                Fshi
                                            </button>
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {modalOpen && (
                <Modal
                    title={editing
                        ? `Ndrysho paralelen ${editing.label || editing.name}`
                        : 'Shto paralele'}
                    onClose={() => setModalOpen(false)}
                >
                    <form onSubmit={(e) => { e.preventDefault(); }} className="modal-form">
                        <div className="form-grid">
                            <Field
                                label="Paralelja"
                                required
                                span
                                hint={
                                    form.name
                                        ? `Do të quhet ${classLabel(form.study_year, form.name)}`
                                        : 'Zgjidhni numrin. Numrat e zënë për këtë drejtim janë të çaktivizuar.'
                                }
                            >
                                <div className="nr-picker" role="radiogroup" aria-label="Numri i paraleles">
                                    {NUMBERS.map((n) => {
                                        const taken = takenNumbers.has(String(n));
                                        const active = String(form.name) === String(n);
                                        return (
                                            <button
                                                key={n}
                                                type="button"
                                                role="radio"
                                                aria-checked={active}
                                                disabled={taken}
                                                title={taken ? 'Kjo paralele ekziston tashmë' : undefined}
                                                className={`nr-btn${active ? ' active' : ''}${taken ? ' taken' : ''}`}
                                                onClick={() => setForm({ ...form, name: String(n) })}
                                            >
                                                {n}
                                            </button>
                                        );
                                    })}
                                </div>
                            </Field>
                            <Field label="Drejtimi" required>
                                <select
                                    value={form.category_id}
                                    required
                                    onChange={(e) => setForm({ ...form, category_id: e.target.value, name: '' })}
                                >
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </Field>
                            <Field label="Viti i studimit" required>
                                <select
                                    value={form.study_year}
                                    onChange={(e) =>
                                        setForm({ ...form, study_year: Number(e.target.value), name: '' })}
                                >
                                    {[1, 2, 3].map((y) => (
                                        <option key={y} value={y}>{YEAR_LABELS[y]}</option>
                                    ))}
                                </select>
                            </Field>
                            <Field label="Viti shkollor" required>
                                <select
                                    value={form.school_year}
                                    onChange={(e) => setForm({ ...form, school_year: e.target.value, name: '' })}
                                >
                                    {schoolYears.map((y) => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </Field>
                            <Field
                                label="Kujdestari"
                                span
                                hint="Përdoruesit aktivë me rolin «Kujdestar/e» ose «Staf». Mund të caktohet edhe më vonë."
                            >
                                <select
                                    value={form.kujdestar_id}
                                    onChange={(e) => setForm({ ...form, kujdestar_id: e.target.value })}
                                >
                                    <option value="">— pa caktuar —</option>
                                    {options.kujdestars.map((k) => (
                                        <option key={k.id} value={k.id}>
                                            {k.full_name} ({ROLE_LABELS[k.role] || k.role})
                                        </option>
                                    ))}
                                </select>
                            </Field>
                        </div>
                        <div className="modal-actions">
                            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                                Anulo
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={busy || !form.name}
                                onClick={submit}
                            >
                                {busy ? 'Duke ruajtur…' : editing ? 'Ruaj ndryshimet' : 'Krijo paralelen'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {deleting && (
                <Modal
                    title={`Fshi paralelen ${deleting.label || deleting.name}?`}
                    onClose={() => setDeleting(null)}
                >
                    <p className="modal-hint">
                        Fshirja lejohet vetëm kur ditari është bosh. Nëse paralelja ka nota të
                        regjistruara, serveri do ta refuzojë — atëherë çaktivizojeni në vend të fshirjes.
                    </p>
                    <div className="modal-actions">
                        <button type="button" className="btn btn-ghost" onClick={() => setDeleting(null)}>
                            Anulo
                        </button>
                        <button type="button" className="btn btn-danger" disabled={busy} onClick={confirmDelete}>
                            {busy ? 'Duke fshirë…' : 'Po, fshije'}
                        </button>
                    </div>
                </Modal>
            )}
        </section>
    );
}