import { useEffect, useState } from 'react';
import {
  fetchBanks, createBank, updateBank, deleteBank,
  fetchCategories, createCategory, updateCategory, deleteCategory,
} from '../../api/meta';
import { errorMessage } from '../../api/client';
import Modal from '../ui/Modal.jsx';
import Field from '../ui/Field.jsx';
import { money } from '../../utils/format';

const EMPTY_BANK = { name: '', account_number: '' };
const EMPTY_CAT = { name: '', code: '', color: '#2E6FB7', default_quota: '' };

/**
 * Konfigurimet e bazes: bankat dhe drejtimet.
 * Shfaqet vetem per administratoret (faqja Cilesimet eshte admin-only).
 */
export default function DataManager() {
  const [banks, setBanks] = useState(null);
  const [cats, setCats] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const [bankForm, setBankForm] = useState(null); // {id?, name, account_number}
  const [catForm, setCatForm] = useState(null);
  const [confirm, setConfirm] = useState(null);   // {kind, item}

  const load = () =>
    Promise.all([fetchBanks(), fetchCategories()])
      .then(([b, c]) => { setBanks(b); setCats(c); setError(''); })
      .catch((e) => setError(errorMessage(e)));

  useEffect(() => { load(); }, []);

  const run = async (fn, okMsg) => {
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

  const saveBank = async (e) => {
    e.preventDefault();
    const { id, ...data } = bankForm;
    const ok = await run(
      () => (id ? updateBank(id, data) : createBank(data)),
      id ? 'Banka u përditësua.' : 'Banka u shtua.'
    );
    if (ok) setBankForm(null);
  };

  const saveCat = async (e) => {
    e.preventDefault();
    const { id, ...data } = catForm;
    const ok = await run(
      () => (id ? updateCategory(id, data) : createCategory(data)),
      id ? 'Drejtimi u përditësua.' : 'Drejtimi u shtua.'
    );
    if (ok) setCatForm(null);
  };

  const doDelete = async () => {
    const { kind, item } = confirm;
    const ok = await run(
      () => (kind === 'bank' ? deleteBank(item.id) : deleteCategory(item.id)),
      kind === 'bank' ? 'Banka u fshi.' : 'Drejtimi u fshi.'
    );
    if (ok) setConfirm(null);
  };

  return (
    <section className="card">
      <div className="card-title-row">
        <h2 className="card-title">Konfigurimet</h2>
      </div>
      <p className="muted card-sub">
        Bankat dhe drejtimet përdoren te pagesat, numrat e kontratave dhe mesazhet e rikujtesës.
      </p>

      {error && <p className="form-error">{error}</p>}
      {notice && <p className="form-success">{notice}</p>}

      {/* ---------------- Bankat ---------------- */}
      <div className="cfg-block">
        <div className="cfg-head">
          <h3>Bankat</h3>
          <button
            type="button"
            className="btn btn-primary btn-small"
            onClick={() => setBankForm({ ...EMPTY_BANK })}
          >
            + Shto bankë
          </button>
        </div>

        {!banks ? (
          <p className="muted">Duke ngarkuar…</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Emri</th>
                  <th>Numri i llogarisë</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {banks.map((b) => (
                  <tr key={b.id}>
                    <td><strong>{b.name}</strong></td>
                    <td className={b.account_number ? 'mono' : 'muted'}>
                      {b.account_number || 'pa llogari — nuk shfaqet te rikujtesa'}
                    </td>
                    <td className="cell-tight">
                      <span className="cell-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-small"
                          onClick={() => setBankForm({ ...b, account_number: b.account_number || '' })}
                        >
                          Ndrysho
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-small"
                          onClick={() => setConfirm({ kind: 'bank', item: b })}
                        >
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
      </div>

      {/* ---------------- Drejtimet ---------------- */}
      <div className="cfg-block">
        <div className="cfg-head">
          <h3>Drejtimet</h3>
          <button
            type="button"
            className="btn btn-primary btn-small"
            onClick={() => setCatForm({ ...EMPTY_CAT })}
          >
            + Shto drejtim
          </button>
        </div>

        {!cats ? (
          <p className="muted">Duke ngarkuar…</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Emri</th>
                  <th>Kodi</th>
                  <th className="num">Kuota vjetore</th>
                  <th>Ngjyra</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {cats.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td className="mono">{c.code}</td>
                    <td className="num">
                      {c.default_quota !== null && c.default_quota !== undefined ? (
                        <strong>{money(c.default_quota)}</strong>
                      ) : (
                        <span className="muted">e pacaktuar</span>
                      )}
                    </td>
                    <td>
                      <span className="cfg-color">
                        <i style={{ background: c.color }} />
                        <span className="mono">{c.color}</span>
                      </span>
                    </td>
                    <td className="cell-tight">
                      <span className="cell-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-small"
                          onClick={() => setCatForm({ ...c, default_quota: c.default_quota ?? '' })}
                        >
                          Ndrysho
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-small"
                          onClick={() => setConfirm({ kind: 'category', item: c })}
                        >
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
      </div>

      {/* ---------------- Formulari i bankës ---------------- */}
      {bankForm && (
        <Modal
          title={bankForm.id ? 'Ndrysho bankën' : 'Shto bankë'}
          onClose={() => setBankForm(null)}
        >
          <form onSubmit={saveBank} className="modal-form">
            <Field label="Emri i bankës" required>
              <input
                value={bankForm.name}
                onChange={(e) => setBankForm({ ...bankForm, name: e.target.value })}
                placeholder="p.sh. TEB Bank, RBKO, BKT"
                required
                autoFocus
              />
            </Field>
            <Field
              label="Numri i llogarisë"
              hint="Shfaqet te mesazhi i rikujtesës. Lëreni bosh nëse nuk përdoret."
            >
              <input
                value={bankForm.account_number}
                onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })}
                placeholder="1501 1500 0091 7205"
              />
            </Field>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setBankForm(null)}>
                Anulo
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                Ruaj
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ---------------- Formulari i drejtimit ---------------- */}
      {catForm && (
        <Modal
          title={catForm.id ? 'Ndrysho drejtimin' : 'Shto drejtim'}
          onClose={() => setCatForm(null)}
        >
          <form onSubmit={saveCat} className="modal-form">
            <Field label="Emri i drejtimit" required>
              <input
                value={catForm.name}
                onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                placeholder="p.sh. Teknik Dentar"
                required
                autoFocus
              />
            </Field>
            <Field
              label="Kuota vjetore (€)"
              hint="Plotësohet vetë gjatë regjistrimit të nxënësve të këtij drejtimi."
            >
              <input
                type="number"
                min="0"
                step="0.01"
                value={catForm.default_quota}
                onChange={(e) => setCatForm({ ...catForm, default_quota: e.target.value })}
                placeholder="p.sh. 1500"
              />
            </Field>
            <div className="form-grid">
              <Field label="Kodi" hint="Përdoret te numri i kontratës, p.sh. 01/2025/TD" required>
                <input
                  value={catForm.code}
                  onChange={(e) => setCatForm({ ...catForm, code: e.target.value.toUpperCase() })}
                  placeholder="TD"
                  maxLength={6}
                  required
                />
              </Field>
              <Field label="Ngjyra" required>
                <span className="color-row">
                  <input
                    type="color"
                    value={catForm.color}
                    onChange={(e) => setCatForm({ ...catForm, color: e.target.value })}
                  />
                  <input
                    value={catForm.color}
                    onChange={(e) => setCatForm({ ...catForm, color: e.target.value })}
                    className="mono"
                  />
                </span>
              </Field>
            </div>
            {catForm.id && (
              <p className="muted small">
                Ndryshimi i kodit nuk prek kontratat e lëshuara më parë — përdoret
                vetëm te regjistrimet e reja.
              </p>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setCatForm(null)}>
                Anulo
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                Ruaj
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ---------------- Konfirmimi i fshirjes ---------------- */}
      {confirm && (
        <Modal title="Konfirmoni fshirjen" onClose={() => setConfirm(null)}>
          <p>
            Të fshihet {confirm.kind === 'bank' ? 'banka' : 'drejtimi'}{' '}
            <strong>{confirm.item.name}</strong>?
          </p>
          <p className="muted small">
            Nëse përdoret nga pagesa ose nxënës ekzistues, fshirja bllokohet automatikisht.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setConfirm(null)}>
              Anulo
            </button>
            <button type="button" className="btn btn-danger" onClick={doDelete} disabled={busy}>
              Fshi
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}