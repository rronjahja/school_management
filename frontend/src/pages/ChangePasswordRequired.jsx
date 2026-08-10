import { useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage } from '../api/client';
import IspeLogo from '../components/ui/IspeLogo.jsx';
import Loader from '../components/ui/Loader.jsx';

/**
 * Vendosja e fjalëkalimit në hyrjen e parë.
 *
 * Fjalëkalimin e parë e shkruan administratori, ndaj e dinë dy veta.
 * Ky ekran e mbyll atë hendek: derisa përdoruesi të vendosë të tijin,
 * serveri nuk i hap asgjë tjetër.
 *
 * PSE NUK KËRKOHET FJALËKALIMI AKTUAL: përdoruesi sapo e shkroi te hyrja,
 * dhe AuthContext e mban në kujtesë (jo në disk, jo në localStorage) vetëm
 * për këtë hap. Nëse faqja rifreskohet, kujtesa zbrazet dhe fusha shfaqet —
 * verifikimi në server bëhet gjithsesi, çdo herë.
 */
export default function ChangePasswordRequired() {
  const { user, ready, signOut, initialPassword, completePasswordChange } = useAuth();

  const carried = useRef(initialPassword).current;   // e ngrirë në hapjen e ekranit
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const currentValue = carried || current;

  // Kërkesat shfaqen që në fillim dhe ndriçohen ndërsa shkruhet: përdoruesi
  // e sheh se ç'i mungon PARA se të shtypë butonin, jo pasi të dështojë.
  const rules = useMemo(() => [
    { ok: next.length >= 8, text: 'Të paktën 8 karaktere' },
    { ok: /[A-Za-zÇËçë]/.test(next), text: 'Të paktën një shkronjë' },
    { ok: /[0-9]/.test(next), text: 'Të paktën një numër' },
    { ok: next.length > 0 && next === again, text: 'Të dy fushat përputhen' },
    {
      ok: next.length > 0 && next !== currentValue,
      text: 'I ndryshëm nga fjalëkalimi i përkohshëm',
    },
  ], [next, again, currentValue]);

  const valid = rules.every((r) => r.ok) && currentValue.length > 0;

  if (!ready) return <Loader text="Duke verifikuar sesionin…" />;
  if (!user) return <Navigate to="/hyrje" replace />;
  if (!user.must_change_password) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    try {
      await completePasswordChange(currentValue, next);
      // Pa navigim me dorë: sapo flamuri bie, degëzimi më lart e nxjerr
      // përdoruesin te faqja e tij e parë.
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-logo">
            <IspeLogo height={64} />
          </span>
          <h1 className="login-title">Vendosni fjalëkalimin tuaj</h1>
          <p className="login-sub">
            Mirë se erdhët, {user.full_name || user.username}
          </p>
        </div>

        <p className="pw-note">
          Fjalëkalimi që përdorët është i përkohshëm — e caktoi administratori.
          Zgjidhni një fjalëkalim që e dini vetëm ju, që veprimet në sistem të
          jenë vërtet tuajat.
        </p>

        <form className="login-form" onSubmit={submit}>
          {!carried && (
            <label className="field">
              <span className="field-label">Fjalëkalimi i përkohshëm</span>
              <input
                type={show ? 'text' : 'password'}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
                autoFocus
                required
              />
            </label>
          )}

          <label className="field">
            <span className="field-label">Fjalëkalimi i ri</span>
            <input
              type={show ? 'text' : 'password'}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              autoFocus={Boolean(carried)}
              required
            />
          </label>

          <label className="field">
            <span className="field-label">Përsërisni fjalëkalimin e ri</span>
            <input
              type={show ? 'text' : 'password'}
              value={again}
              onChange={(e) => setAgain(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>

          <label className="pw-show">
            <input
              type="checkbox"
              checked={show}
              onChange={(e) => setShow(e.target.checked)}
            />
            <span>Shfaq fjalëkalimin</span>
          </label>

          <ul className="pw-rules">
            {rules.map((r) => (
              <li key={r.text} className={r.ok ? 'pw-rule ok' : 'pw-rule'}>
                <span className="pw-rule-mark" aria-hidden="true">{r.ok ? '✓' : '•'}</span>
                {r.text}
              </li>
            ))}
          </ul>

          {error && <p className="form-error">{error}</p>}

          <button
            type="submit"
            className="btn btn-primary login-btn"
            disabled={!valid || busy}
          >
            {busy ? 'Duke ruajtur…' : 'Ruaj dhe vazhdo'}
          </button>
        </form>

        <button type="button" className="pw-signout" onClick={signOut}>
          Dil dhe hyr me një llogari tjetër
        </button>
      </div>
    </div>
  );
}