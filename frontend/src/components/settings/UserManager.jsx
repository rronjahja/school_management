import { useEffect, useState } from 'react';
import {
  fetchUsers, createUser, updateUser, resetUserPassword, changePassword,
} from '../../api/auth';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext.jsx';
import { date } from '../../utils/format';
import Modal from '../ui/Modal.jsx';
import Field from '../ui/Field.jsx';

const EMPTY = { username: '', full_name: '', role: 'staff', password: '' };

/** Menaxhimi i perdoruesve + ndryshimi i fjalekalimit tuaj (vetem admin). */
export default function UserManager() {
  const { user } = useAuth();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const [pwUser, setPwUser] = useState(null);
  const [newPw, setNewPw] = useState('');

  const [ownOpen, setOwnOpen] = useState(false);
  const [own, setOwn] = useState({ current_password: '', new_password: '' });

  const load = () => fetchUsers().then(setUsers).catch((e) => setError(errorMessage(e)));
  useEffect(() => { load(); }, []);

  const wrap = async (fn, okMsg) => {
    setBusy(true); setError(''); setNotice('');
    try {
      await fn();
      setNotice(okMsg);
      await load();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submitNew = async (e) => {
    e.preventDefault();
    if (await wrap(() => createUser(form), 'Përdoruesi u krijua.')) {
      setAddOpen(false); setForm(EMPTY);
    }
  };

  const submitReset = async (e) => {
    e.preventDefault();
    if (await wrap(() => resetUserPassword(pwUser.id, newPw), 'Fjalëkalimi u ndryshua.')) {
      setPwUser(null); setNewPw('');
    }
  };

  const submitOwn = async (e) => {
    e.preventDefault();
    if (await wrap(() => changePassword(own.current_password, own.new_password),
      'Fjalëkalimi juaj u ndryshua.')) {
      setOwnOpen(false); setOwn({ current_password: '', new_password: '' });
    }
  };

  const toggleActive = (u) =>
    wrap(() => updateUser(u.id, { is_active: !u.is_active }),
      u.is_active ? 'Llogaria u çaktivizua.' : 'Llogaria u aktivizua.');

  return (
    <section className="card">
      <div className="card-title-row">
        <h2 className="card-title">Përdoruesit e sistemit</h2>
        <span className="cell-actions">
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setOwnOpen(true)}>
            Ndrysho fjalëkalimin tim
          </button>
          <button type="button" className="btn btn-primary btn-small" onClick={() => setAddOpen(true)}>
            + Shto përdorues
          </button>
        </span>
      </div>

      {error && <p className="form-error">{error}</p>}
      {notice && <p className="form-success">{notice}</p>}

      {!users ? (
        <p className="muted">Duke ngarkuar…</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Përdoruesi</th>
                <th>Emri i plotë</th>
                <th>Roli</th>
                <th>Hyrja e fundit</th>
                <th>Statusi</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.username}</strong>{u.id === user.id && <span className="muted"> (ju)</span>}</td>
                  <td>{u.full_name}</td>
                  <td>{u.role === 'admin' ? 'Administrator' : 'Staf'}</td>
                  <td>{u.last_login_at ? date(u.last_login_at) : '—'}</td>
                  <td>
                    <span className={`badge badge-${u.is_active ? 'green' : 'neutral'}`}>
                      <span className="badge-dot" />
                      {u.is_active ? 'Aktiv' : 'Çaktivizuar'}
                    </span>
                  </td>
                  <td className="cell-tight">
                    <span className="cell-actions">
                      <button type="button" className="btn btn-ghost btn-small"
                        onClick={() => { setPwUser(u); setNewPw(''); }}>
                        Fjalëkalim i ri
                      </button>
                      {u.id !== user.id && (
                        <button type="button" className="btn btn-ghost btn-small"
                          onClick={() => toggleActive(u)} disabled={busy}>
                          {u.is_active ? 'Çaktivizo' : 'Aktivizo'}
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addOpen && (
        <Modal title="Shto përdorues" onClose={() => setAddOpen(false)}>
          <form onSubmit={submitNew} className="modal-form">
            <div className="form-grid">
              <Field label="Emri i përdoruesit" required>
                <input value={form.username} required autoFocus
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="p.sh. arben" />
              </Field>
              <Field label="Emri i plotë" required>
                <input value={form.full_name} required
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </Field>
              <Field label="Roli" required>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="staff">Staf</option>
                  <option value="admin">Administrator</option>
                </select>
              </Field>
              <Field label="Fjalëkalimi" required>
                <input type="password" value={form.password} required autoComplete="new-password"
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Min. 8 karaktere, shkronja + numra" />
              </Field>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setAddOpen(false)}>Anulo</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>Krijo</button>
            </div>
          </form>
        </Modal>
      )}

      {pwUser && (
        <Modal title={`Fjalëkalim i ri për "${pwUser.username}"`} onClose={() => setPwUser(null)}>
          <form onSubmit={submitReset} className="modal-form">
            <Field label="Fjalëkalimi i ri" required>
              <input type="password" value={newPw} required autoFocus autoComplete="new-password"
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="Min. 8 karaktere, shkronja + numra" />
            </Field>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setPwUser(null)}>Anulo</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>Ruaj</button>
            </div>
          </form>
        </Modal>
      )}

      {ownOpen && (
        <Modal title="Ndrysho fjalëkalimin tim" onClose={() => setOwnOpen(false)}>
          <form onSubmit={submitOwn} className="modal-form">
            <Field label="Fjalëkalimi aktual" required>
              <input type="password" value={own.current_password} required autoFocus autoComplete="current-password"
                onChange={(e) => setOwn({ ...own, current_password: e.target.value })} />
            </Field>
            <Field label="Fjalëkalimi i ri" required>
              <input type="password" value={own.new_password} required autoComplete="new-password"
                onChange={(e) => setOwn({ ...own, new_password: e.target.value })}
                placeholder="Min. 8 karaktere, shkronja + numra" />
            </Field>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setOwnOpen(false)}>Anulo</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>Ruaj</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}