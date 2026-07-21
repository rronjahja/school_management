import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseContractFile, checkExistingContracts } from '../../api/meta';
import { errorMessage } from '../../api/client';

const BATCH_KEY = 'ispe_contract_batch';
const PREFILL_KEY = 'ispe_import_prefill';

/**
 * Migrimi i kontratave: ngarkohen kontratat .docx, aplikacioni lexon të
 * dhënat dhe për secilën hapet formulari i regjistrimit i parambushur.
 * Asgjë nuk ruhet në bazë pa e parë dhe konfirmuar njeriu.
 *
 * Lista mbahet në sessionStorage që të mbijetojë vajtje-ardhjet te
 * formulari; kthimi këtu e rifreskon gjendjen "i regjistruar" nga baza.
 */
export default function ContractImport() {
  const navigate = useNavigate();
  const [batch, setBatch] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(BATCH_KEY)) || []; }
    catch { return []; }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const persist = (list) => {
    setBatch(list);
    try { sessionStorage.setItem(BATCH_KEY, JSON.stringify(list)); } catch { /* plot */ }
  };

  // Kthimi nga regjistrimi: kush prej listës ekziston tani në bazë?
  useEffect(() => {
    const numbers = batch.map((b) => b.data.contract_number).filter(Boolean);
    if (!numbers.length) return;
    checkExistingContracts(numbers)
      .then((rows) => {
        const byNr = Object.fromEntries(rows.map((r) => [r.contract_number, r]));
        persist(batch.map((b) => ({ ...b, existing: byNr[b.data.contract_number] || null })));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upload = async (files) => {
    setBusy(true);
    setError('');
    const next = [...batch];
    for (const file of files) {
      try {
        const parsed = await parseContractFile(file);
        // i njejti numer kontrate ne liste zevendesohet, jo dyfishohet
        const i = next.findIndex(
          (b) => b.data.contract_number &&
            b.data.contract_number === parsed.data.contract_number
        );
        if (i >= 0) next[i] = parsed;
        else next.push(parsed);
      } catch (e) {
        setError(`${file.name}: ${errorMessage(e)}`);
      }
    }
    persist(next);
    setBusy(false);
  };

  const openRegistration = (entry) => {
    const prefill = { ...entry.data, quota_override: true };
    delete prefill.category_code;
    delete prefill.category_name;
    try { sessionStorage.setItem(PREFILL_KEY, JSON.stringify({
      prefill,
      warnings: entry.warnings,
      filename: entry.filename,
    })); } catch { /* plot */ }
    navigate('/studentet/regjistro');
  };

  const remove = (idx) => persist(batch.filter((_, i) => i !== idx));

  return (
    <section className="card">
      <div className="card-title-row">
        <h2 className="card-title">Migrimi i kontratave</h2>
        {batch.length > 0 && (
          <button type="button" className="btn btn-ghost btn-small" onClick={() => persist([])}>
            Pastro listën
          </button>
        )}
      </div>
      <p className="muted card-sub">
        Ngarkoni kontratat .docx — aplikacioni lexon të dhënat dhe për secilën
        hap formularin e regjistrimit të parambushur. Ju kontrolloni, plotësoni
        planin e pagesës, vitin e studimit e gjininë, dhe e ruani.
      </p>

      {error && <p className="form-error">{error}</p>}

      <label className={`import-drop${busy ? ' is-busy' : ''}`}>
        <input
          type="file"
          accept=".docx"
          multiple
          disabled={busy}
          onChange={(e) => { upload([...e.target.files]); e.target.value = ''; }}
        />
        {busy ? 'Duke lexuar kontratat…' : '⇪ Zgjidhni ose lëshoni kontratat (.docx)'}
      </label>

      {batch.length > 0 && (
        <div className="table-wrap import-list">
          <table className="table">
            <thead>
              <tr>
                <th>Nxënësi</th>
                <th>Nr. i kontratës</th>
                <th>Drejtimi</th>
                <th>Gjenerata</th>
                <th className="num">Çmimi</th>
                <th>Vërejtje</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {batch.map((b, i) => (
                <tr key={`${b.data.contract_number || b.filename}-${i}`}>
                  <td>
                    <strong>{b.data.first_name} {b.data.last_name}</strong>
                    <span className="muted cell-sub">{b.filename}</span>
                  </td>
                  <td className="mono">{b.data.contract_number || '—'}</td>
                  <td>{b.data.category_name || b.data.category_code || '—'}</td>
                  <td>{b.data.generation || '—'}</td>
                  <td className="num">
                    {b.data.yearly_quota != null ? `${b.data.yearly_quota} €` : '—'}
                  </td>
                  <td>
                    {b.warnings.length ? (
                      <details className="import-warnings">
                        <summary>⚠ {b.warnings.length}</summary>
                        <ul>{b.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
                      </details>
                    ) : '—'}
                  </td>
                  <td className="num">
                    {b.existing ? (
                      <span className="badge badge-paid" title={`Nxënësi ekziston (id ${b.existing.id})`}>
                        ✓ i regjistruar
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary btn-small"
                        onClick={() => openRegistration(b)}
                      >
                        Hap regjistrimin →
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-small"
                      onClick={() => remove(i)}
                      title="Hiqe nga lista"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}