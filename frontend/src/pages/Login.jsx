import { useEffect, useState } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchAuthStatus } from '../api/auth';
import { errorMessage } from '../api/client';
import IspeLogo from '../components/ui/IspeLogo.jsx';
import InvasoftLogo from '../components/ui/InvasoftLogo.jsx';

export default function Login() {
  const { user, ready, signIn, home } = useAuth();
  const location = useLocation();

  const [form, setForm] = useState({ username: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [noUsers, setNoUsers] = useState(false);

  // Nese baza eshte bosh, e udhezojme administratorin si ta krijoje llogarine
  useEffect(() => {
    fetchAuthStatus()
      .then((s) => setNoUsers(!s.has_users))
      .catch(() => {});
  }, []);

  if (ready && user) {
    // Pas hyrjes secili rol shkon te faqja e VET e pare: paneli nuk eshte
    // me i hapur per te gjithe, ndaj «/» s'eshte shtepi e perbashket.
    return <Navigate to={location.state?.from?.pathname || home} replace />;
  }

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signIn(form.username.trim(), form.password);
      // Pa navigim me dore: sapo vendoset perdoruesi, degezimi me lart e con
      // secilin te faqja e vet — roli behet i njohur vetem pas hyrjes.
    } catch (err) {
      setError(errorMessage(err));
      setForm((f) => ({ ...f, password: '' }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-logo">
            <IspeLogo height={72} />
          </span>
          <h1 className="login-title">Kolegji ISPE</h1>
          <p className="login-sub">Sistemi i menaxhimit të shkollës</p>
        </div>

        {noUsers ? (
          <div className="login-setup">
            <h2>Asnjë llogari nuk ekziston ende</h2>
            <p>Krijoni administratorin e parë nga terminali, në dosjen e serverit:</p>
            <code>npm run create-admin</code>
            <p className="muted">Pas krijimit, rifreskoni këtë faqe.</p>
          </div>
        ) : (
          <form className="login-form" onSubmit={submit}>
            <label className="field">
              <span className="field-label">Emri i përdoruesit</span>
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                autoComplete="username"
                autoFocus
                required
              />
            </label>

            <label className="field">
              <span className="field-label">Fjalëkalimi</span>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="current-password"
                required
              />
            </label>

            {error && <p className="form-error">{error}</p>}

            <button type="submit" className="btn btn-primary login-btn" disabled={busy}>
              {busy ? 'Duke hyrë…' : 'Hyr në sistem'}
            </button>
          </form>
        )}
      </div>

      <a
        className="login-credit"
        href="https://invasoft.io"
        target="_blank"
        rel="noreferrer"
      >
        Produkt i zhvilluar nga <strong>invasoft.io</strong>
      </a>
    </div>
  );
}