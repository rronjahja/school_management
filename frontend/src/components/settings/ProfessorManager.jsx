import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchProfessors, fetchSubjects, createProfessor, updateProfessor,
  deleteProfessor, createSubject,
} from '../../api/profesoret';
import { errorMessage } from '../../api/client';
import Modal from '../ui/Modal.jsx';
import Field from '../ui/Field.jsx';
import Loader from '../ui/Loader.jsx';

/**
 * Profesorët dhe lëndët që japin.
 *
 * Lidhja është shumë-me-shumë, ndaj mund të shihet nga të dyja anët.
 * Faqja i jep të dyja, sepse puna e vërtetë vjen në të dyja format:
 *   · «Profesorët»  — hapet një profesor dhe i zgjidhen lëndët
 *   · «Lëndët»      — hapet një lëndë dhe shihet kush e jep
 *
 * Rasti më i shpeshtë është një lëndë me 2–3 profesorë; më i rralli,
 * një profesor me disa lëndë. Të dyja mbulohen nga i njëjti formular:
 * zgjedhja e lëndëve bëhet me kuti të klikueshme, jo me listë rrëshqitëse
 * me shumë zgjedhje — ajo e fundit është e vështirë të përdoret dhe fsheh
 * atë që ke zgjedhur.
 */

const EMPTY = { full_name: '', subject_ids: [] };

const GROUP_LABELS = {
  gjuhet: 'Gjuhët',
  matematika: 'Matematikë',
  shkencat: 'Shkencat',
  shoqeria: 'Shoqëria',
  sportet: 'Ed. fizike',
  teknologjia: 'Teknologjia',
  teorike: 'Profesionale — teori',
  praktike: 'Profesionale — praktikë',
};

export default function ProfessorManager() {
  const [professors, setProfessors] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [view, setView] = useState('subjects');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleting, setDeleting] = useState(null);
  const [newSubject, setNewSubject] = useState('');
  const [subjectOpen, setSubjectOpen] = useState(false);

  const load = useCallback(
    () => Promise.all([fetchProfessors(), fetchSubjects()])
      .then(([p, s]) => { setProfessors(p); setSubjects(s); })
      .catch((err) => setError(errorMessage(err))),
    []
  );

  useEffect(() => { load(); }, [load]);

  /** Lëndët e grupuara, që lista të mos jetë një mur emrash. */
  const grouped = useMemo(() => {
    const g = {};
    for (const s of subjects) (g[s.grp] = g[s.grp] || []).push(s);
    return Object.entries(g);
  }, [subjects]);

  /** Kush e jep secilën lëndë — pamja nga ana e lëndës. */
  const bySubject = useMemo(() => {
    const m = new Map();
    for (const p of professors || []) {
      for (const s of p.subjects) {
        if (!m.has(s.id)) m.set(s.id, []);
        m.get(s.id).push(p);
      }
    }
    return m;
  }, [professors]);

  const run = async (fn, okMsg) => {
    setBusy(true); setError(''); setNotice('');
    try {
      await fn();
      await load();
      setNotice(okMsg);
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openNew = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };

  const openEdit = (p) => {
    setEditing(p);
    setForm({ full_name: p.full_name, subject_ids: p.subjects.map((s) => s.id) });
    setModalOpen(true);
  };

  const toggleSubject = (id) => setForm((f) => ({
    ...f,
    subject_ids: f.subject_ids.includes(id)
      ? f.subject_ids.filter((x) => x !== id)
      : [...f.subject_ids, id],
  }));

  const submit = async () => {
    const ok = await run(
      () => (editing
        ? updateProfessor(editing.id, {
          full_name: form.full_name, subject_ids: form.subject_ids,
        })
        : createProfessor(form)),
      editing ? 'Profesori u përditësua.' : 'Profesori u krijua.'
    );
    if (ok) setModalOpen(false);
  };

  const addSubject = async () => {
    const name = newSubject.trim();
    if (!name) return;
    const ok = await run(() => createSubject({ name }), `Lënda «${name}» u shtua.`);
    if (ok) { setNewSubject(''); setSubjectOpen(false); }
  };

  const removeProfessor = async () => {
    const ok = await run(
      () => deleteProfessor(deleting.id),
      `${deleting.full_name} u hoq nga lista.`
    );
    if (ok) setDeleting(null);
  };

  if (!professors) return <Loader text="Duke ngarkuar profesorët…" />;

  return (
    <section className="card">
      <div className="card-title-row pm-head">
        <div>
          <h2 className="card-title">Profesorët dhe lëndët</h2>
          <p className="card-sub pm-head-sub">
            Një profesor mund të japë disa lëndë dhe një lëndë jepet nga disa profesorë.
            Profesorët nuk kyçen në sistem — orët e tyre i bart administrata.
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-small" onClick={openNew}>
          Shto profesor
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}
      {notice && <p className="form-success">{notice}</p>}

      <div className="dt-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'subjects'}
          className={`dt-tab${view === 'subjects' ? ' active' : ''}`}
          onClick={() => setView('subjects')}
        >
          Sipas lëndës ({subjects.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'professors'}
          className={`dt-tab${view === 'professors' ? ' active' : ''}`}
          onClick={() => setView('professors')}
        >
          Sipas profesorit ({professors.length})
        </button>
      </div>

      {view === 'professors' ? (
        professors.length === 0 ? (
          <p className="muted">
            Ende asnjë profesor. Shtoni të parin që të mund të plotësohen orët e mësimit.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Profesori</th>
                  <th>Lëndët</th>
                  <th className="num">Orë</th>
                  <th>Gjendja</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {professors.map((p) => (
                  <tr key={p.id} className={p.is_active ? '' : 'row-muted'}>
                    <td><strong>{p.full_name}</strong></td>
                    <td>
                      {p.subjects.length === 0 ? (
                        <span className="pm-warn">Pa lëndë të caktuar</span>
                      ) : (
                        <span className="pm-chips">
                          {p.subjects.map((s) => (
                            <span key={s.id} className="pm-chip">{s.name}</span>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="num muted">{p.lesson_count || '—'}</td>
                    <td>
                      {p.is_active
                        ? <span className="badge badge-green"><span className="badge-dot" />Aktiv</span>
                        : <span className="badge badge-neutral"><span className="badge-dot" />Joaktiv</span>}
                    </td>
                    <td className="row-actions">
                      <button type="button" className="btn btn-ghost btn-small"
                        onClick={() => openEdit(p)}>
                        Ndrysho
                      </button>
                      {p.lesson_count === 0 && (
                        <button type="button" className="btn btn-ghost btn-small"
                          onClick={() => setDeleting(p)}>
                          Fshi
                        </button>
                      )}
                      <button type="button" className="btn btn-ghost btn-small"
                        disabled={busy}
                        onClick={() => run(
                          () => updateProfessor(p.id, { is_active: !p.is_active }),
                          p.is_active ? 'Profesori u çaktivizua.' : 'Profesori u aktivizua.'
                        )}>
                        {p.is_active ? 'Çaktivizo' : 'Aktivizo'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <>
          <div className="pm-subject-add">
            {subjectOpen ? (
              <>
                <input
                  value={newSubject}
                  autoFocus
                  maxLength={80}
                  placeholder="Emri i lëndës së re"
                  onChange={(e) => setNewSubject(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addSubject()}
                />
                <button type="button" className="btn btn-primary btn-small"
                  disabled={busy || !newSubject.trim()} onClick={addSubject}>
                  Shto
                </button>
                <button type="button" className="btn btn-ghost btn-small"
                  onClick={() => { setSubjectOpen(false); setNewSubject(''); }}>
                  Anulo
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-ghost btn-small"
                onClick={() => setSubjectOpen(true)}>
                + Shto lëndë në katalog
              </button>
            )}
          </div>

          <div className="pm-grid">
            {grouped.map(([grp, items]) => (
              <div key={grp} className="pm-group">
                <h3 className="pm-group-title">{GROUP_LABELS[grp] || grp}</h3>
                {items.map((s) => {
                  const holders = bySubject.get(s.id) || [];
                  return (
                    <div key={s.id} className="pm-subject">
                      <span className="pm-subject-name">{s.name}</span>
                      {holders.length === 0 ? (
                        <span className="pm-warn">Askush nuk e jep</span>
                      ) : (
                        <span className="pm-chips">
                          {holders.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className="pm-chip pm-chip-btn"
                              title="Hap profesorin"
                              onClick={() => openEdit(p)}
                            >
                              {p.full_name}
                            </button>
                          ))}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}

      {modalOpen && (
        <Modal
          title={editing ? `Ndrysho ${editing.full_name}` : 'Shto profesor'}
          onClose={() => setModalOpen(false)}
        >
          <div className="modal-form">
            <div className="form-grid">
              <Field label="Emri dhe mbiemri" required>
                <input
                  value={form.full_name}
                  autoFocus
                  maxLength={120}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </Field>

            </div>

            <div className="pm-picker">
              <div className="pm-picker-head">
                <strong>Lëndët që jep</strong>
                <span className="muted">
                  {form.subject_ids.length
                    ? `${form.subject_ids.length} të zgjedhura`
                    : 'asnjë ende'}
                </span>
              </div>

              {subjects.length === 0 ? (
                <p className="muted">
                  Katalogu i lëndëve është bosh — shtoni lëndë te skeda «Sipas lëndës».
                </p>
              ) : (
                grouped.map(([grp, items]) => (
                  <div key={grp} className="pm-picker-group">
                    <span className="pm-picker-label">{GROUP_LABELS[grp] || grp}</span>
                    <div className="pm-picker-chips">
                      {items.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className={`pm-pick${form.subject_ids.includes(s.id) ? ' active' : ''}`}
                          aria-pressed={form.subject_ids.includes(s.id)}
                          onClick={() => toggleSubject(s.id)}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                Anulo
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || form.full_name.trim().length < 3}
                onClick={submit}
              >
                {busy ? 'Duke ruajtur…' : editing ? 'Ruaj' : 'Krijo profesorin'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal title={`Fshi ${deleting.full_name}?`} onClose={() => setDeleting(null)}>
          <p>
            Profesori hiqet nga lista dhe nga lëndët e tij. Kjo lejohet vetëm sepse
            nuk ka asnjë orë të shënuar në emrin e tij.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setDeleting(null)}>
              Anulo
            </button>
            <button type="button" className="btn btn-danger" disabled={busy}
              onClick={removeProfessor}>
              Po, fshije
            </button>
          </div>
        </Modal>
      )}

    </section>
  );
}