import { useState } from 'react';
import { addSubject, updateSubject, deleteSubject } from '../../api/ditari';
import { errorMessage } from '../../api/client';
import Modal from '../ui/Modal.jsx';
import Field from '../ui/Field.jsx';

const GROUP_ORDER = ['gjuhet', 'matematika', 'shkencat', 'shoqeria', 'sportet',
  'teknologjia', 'teorike', 'praktike'];

/**
 * Lëndët e paraleles — si emrat e shkruar me dorë në krye të librit.
 * Lëndët e bërthamës vijnë vetë me paralelen; ato profesionale
 * (teorike / praktika) i shton kujdestari sipas drejtimit.
 *
 * Fshirja e një lënde me nota vetëm e fsheh kolonën (çaktivizim) —
 * notat e vendosura nuk humbasin kurrë; kështu vendos serveri.
 */
export default function SubjectsManager({ classId, subjects, groupLabels, onClose, onChanged }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', grp: 'teorike' });
  const [renaming, setRenaming] = useState(null);   // { id, name }
  const [confirming, setConfirming] = useState(null); // subject id në pritje fshirjeje

  const wrap = async (fn) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await fn();
      await onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submitNew = () => {
    if (!form.name.trim()) return;
    wrap(async () => {
      await addSubject(classId, form);
      setForm({ name: '', grp: form.grp });
    });
  };

  const submitRename = () => {
    if (!renaming || !renaming.name.trim()) return;
    wrap(async () => {
      await updateSubject(renaming.id, { name: renaming.name.trim() });
      setRenaming(null);
    });
  };

  /** Ngjitja/zbritja: ndërrohen pozicionet me fqinjin brenda grupit. */
  const move = (grp, index, dir) => {
    const list = subjects.filter((s) => s.grp === grp);
    const a = list[index];
    const b = list[index + dir];
    if (!a || !b) return;
    wrap(async () => {
      await updateSubject(a.id, { position: b.position });
      await updateSubject(b.id, { position: a.position });
    });
  };

  const remove = (id) => {
    wrap(async () => {
      await deleteSubject(id);
      setConfirming(null);
    });
  };

  return (
    <Modal title="Lëndët e paraleles" onClose={onClose}>
      {error && <p className="form-error">{error}</p>}

      <div className="dt-subjects">
        {GROUP_ORDER.map((grp) => {
          const list = subjects.filter((s) => s.grp === grp);
          if (!list.length) return null;
          return (
            <div key={grp} className="dt-subjects-group">
              <h4 className="dt-subjects-title">{groupLabels[grp]}</h4>
              <ul className="dt-subjects-list">
                {list.map((s, i) => (
                  <li key={s.id} className="dt-subjects-item">
                    <span className="dt-subjects-move">
                      <button
                        type="button"
                        className="dt-subjects-btn"
                        title="Ngjite lart"
                        disabled={busy || i === 0}
                        onClick={() => move(grp, i, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="dt-subjects-btn"
                        title="Zbrite poshtë"
                        disabled={busy || i === list.length - 1}
                        onClick={() => move(grp, i, 1)}
                      >
                        ↓
                      </button>
                    </span>

                    {renaming?.id === s.id ? (
                      <span className="dt-subjects-rename">
                        <input
                          value={renaming.name}
                          autoFocus
                          maxLength={80}
                          onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && submitRename()}
                        />
                        <button type="button" className="btn btn-primary btn-small"
                          disabled={busy} onClick={submitRename}>
                          Ruaj
                        </button>
                        <button type="button" className="btn btn-ghost btn-small"
                          onClick={() => setRenaming(null)}>
                          Anulo
                        </button>
                      </span>
                    ) : (
                      <span className="dt-subjects-name">{s.name}</span>
                    )}

                    {confirming === s.id ? (
                      <span className="dt-subjects-confirm">
                        Hiqet nga ditari?
                        <button type="button" className="btn btn-danger btn-small"
                          disabled={busy} onClick={() => remove(s.id)}>
                          Po
                        </button>
                        <button type="button" className="btn btn-ghost btn-small"
                          onClick={() => setConfirming(null)}>
                          Jo
                        </button>
                      </span>
                    ) : (
                      renaming?.id !== s.id && (
                        <span className="cell-actions">
                          <button type="button" className="btn btn-ghost btn-small"
                            onClick={() => setRenaming({ id: s.id, name: s.name })}>
                            Riemërto
                          </button>
                          <button type="button" className="btn btn-ghost btn-small"
                            onClick={() => setConfirming(s.id)}>
                            Hiq
                          </button>
                        </span>
                      )
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="dt-subjects-add">
        <h4 className="dt-subjects-title">Shto lëndë</h4>
        <div className="form-grid">
          <Field label="Emri i lëndës" required>
            <input
              value={form.name}
              maxLength={80}
              placeholder="p.sh. Farmakologji me toksikologji"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && submitNew()}
            />
          </Field>
          <Field label="Grupi" required>
            <select value={form.grp} onChange={(e) => setForm({ ...form, grp: e.target.value })}>
              {GROUP_ORDER.map((grp) => (
                <option key={grp} value={grp}>{groupLabels[grp]}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Mbyll</button>
          <button type="button" className="btn btn-primary" disabled={busy || !form.name.trim()}
            onClick={submitNew}>
            {busy ? 'Duke ruajtur…' : '+ Shto lëndën'}
          </button>
        </div>
      </div>
    </Modal>
  );
}