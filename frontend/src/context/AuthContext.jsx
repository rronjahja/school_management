import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { canAccess, homePath } from '../config/roles';
import * as authApi from '../api/auth';
import { setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);

// ── Sesioni: 15 minuta pa veprimtari ───────────────────────────────
// I njejti afat si te backend/src/config/auth.js. Nese ndryshon njeri,
// duhet te ndryshoje edhe tjetri.
const IDLE_MINUTES = 15;
const WARN_SECONDS = 60;          // paralajmerimi shfaqet nje minute para
const IDLE_MS = IDLE_MINUTES * 60 * 1000;

// Sa shpesh i thuhet serverit «jam ende ketu» kur perdoruesi punon pa
// bere kerkesa. Duhet dukshem me e shkurter se afati, qe cookie-ja te
// mos skadoje ndersa dikush shkruan.
const KEEPALIVE_MS = 5 * 60 * 1000;

// Veprimet qe llogariten si «perdoruesi eshte ketu»
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'wheel'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  // Sekondat e mbetura kur shfaqet paralajmerimi; null = pa paralajmerim
  const [secondsLeft, setSecondsLeft] = useState(null);
  // Perdoret nga faqja e hyrjes per te shpjeguar pse u nxor perdoruesi
  const [sessionExpired, setSessionExpired] = useState(false);

  /**
   * Fjalëkalimi i përkohshëm, i mbajtur VETËM në kujtesë dhe VETËM derisa
   * përdoruesi të vendosë të tijin. Nuk shkon kurrë te localStorage as te
   * cookie: nëse faqja rifreskohet, humbet — dhe ekrani i ndryshimit e
   * kërkon atëherë me shkrim. Kështu përdoruesi nuk e shtyp dy herë të
   * njëjtin fjalëkalim brenda dhjetë sekondash, pa lëshuar asgjë nga siguria
   * (serveri e verifikon gjithsesi, çdo herë).
   */
  const initialPassword = useRef('');

  const lastActivity = useRef(Date.now());
  const lastKeepAlive = useRef(Date.now());

  // Sesioni i skaduar -> kthehemi te faqja e hyrjes
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setSecondsLeft(null);
      setSessionExpired(true);
    });
  }, []);

  // Ne ngarkim, pyesim serverin nese cookie-ja eshte ende e vlefshme
  useEffect(() => {
    authApi
      .fetchMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  const signIn = useCallback(async (username, password) => {
    const u = await authApi.login(username, password);
    initialPassword.current = u && u.must_change_password ? password : '';
    lastActivity.current = Date.now();
    lastKeepAlive.current = Date.now();
    setSecondsLeft(null);
    setSessionExpired(false);
    setUser(u);
    return u;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      initialPassword.current = '';
      setSecondsLeft(null);
      setUser(null);
    }
  }, []);

  /** «Jam ende këtu» — rikthen numëruesin dhe fsheh paralajmërimin. */
  const staySignedIn = useCallback(() => {
    lastActivity.current = Date.now();
    setSecondsLeft(null);
    authApi.fetchMe().then(() => { lastKeepAlive.current = Date.now(); }).catch(() => { });
  }, []);

  // ── Numëruesi i joveprimtarisë ───────────────────────────────────
  //
  // KUJDES: «veprimtari» do të thotë prekje e vërtetë e tastierës a e miut,
  // JO thirrje të API-t. Dikush që plotëson formularin e regjistrimit shkruan
  // për dhjetë minuta pa bërë asnjë kërkesë; po t'i numëronim vetëm kërkesat,
  // sesioni do t'i mbyllej mu ndërsa punon dhe do të humbte gjithë formularin.
  useEffect(() => {
    if (!user) return undefined;

    const touch = () => { lastActivity.current = Date.now(); };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, touch, { passive: true }));

    const tick = setInterval(() => {
      const idle = Date.now() - lastActivity.current;

      if (idle >= IDLE_MS) {
        setSessionExpired(true);
        signOut();
        return;
      }

      const left = Math.ceil((IDLE_MS - idle) / 1000);
      setSecondsLeft(left <= WARN_SECONDS ? left : null);

      // Kur përdoruesi është aktiv por s'ka bërë kërkesa, i themi serverit
      // që sesioni është i gjallë — përndryshe cookie-ja skadon nën duart e tij.
      const active = idle < KEEPALIVE_MS;
      if (active && Date.now() - lastKeepAlive.current >= KEEPALIVE_MS) {
        lastKeepAlive.current = Date.now();
        authApi.fetchMe().catch(() => { });
      }
    }, 1000);

    return () => {
      clearInterval(tick);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, touch));
    };
  }, [user, signOut]);

  /**
   * Përdoruesi vendos fjalëkalimin e vet. Serveri e kthen përdoruesin e
   * freskuar, ndaj flamuri bie pa pasur nevojë për një kërkesë të dytë —
   * dhe rrugëtimi e nxjerr vetvetiu te faqja e tij e parë.
   */
  const completePasswordChange = useCallback(async (currentPassword, newPassword) => {
    const res = await authApi.changePassword(currentPassword, newPassword);
    initialPassword.current = '';
    if (res && res.user) setUser(res.user);
    else setUser((u) => (u ? { ...u, must_change_password: false } : u));
    return res && res.user;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        ready,
        signIn,
        signOut,
        // can('zona') eshte menyra e vetme e sakte per te pyetur «a e hap?».
        // Te drejtat jetojne te config/roles.js, jo te shperndara neper faqe.
        can: (area) => canAccess(user, area),
        home: homePath(user),
        // Fjalëkalimi i përkohshëm: rrugëtimi e mban përdoruesin te ekrani
        // i ndryshimit derisa ta zëvendësojë.
        mustChangePassword: Boolean(user && user.must_change_password),
        initialPassword: initialPassword.current,
        completePasswordChange,
        // Sesioni
        sessionExpired,
        clearSessionExpired: () => setSessionExpired(false),
        idleMinutes: IDLE_MINUTES,
        // Shkurtore per rastet e shpeshta te nderfaqes
        isAdmin: canAccess(user, 'settings'),
        isManager: canAccess(user, 'manage'),
        isFinance: canAccess(user, 'finance'),
        // KUJDES: kontroll ZONE, jo roli — admini, menaxheri dhe stafi e
        // hapin gjithashtu ditarin. Emri i vjeter mbahet si alias.
        canDitari: canAccess(user, 'ditari'),
        isKujdestar: canAccess(user, 'ditari'),
      }}
    >
      {children}
      {user && secondsLeft !== null && (
        <SessionWarning seconds={secondsLeft} onStay={staySignedIn} onLeave={signOut} />
      )}
    </AuthContext.Provider>
  );
}

/**
 * Paralajmërimi një minutë para mbylljes.
 *
 * Stilet janë këtu brenda me qëllim: kutia duhet të dalë mbi çdo faqe, edhe
 * nëse fleta e stileve ndryshon nesër. Është e vetmja gjë që qëndron mes
 * përdoruesit dhe humbjes së një formulari të paruajtur.
 */
function SessionWarning({ seconds, onStay, onLeave }) {
  const box = {
    position: 'fixed', right: 20, bottom: 20, zIndex: 9999,
    background: '#fff', border: '1px solid #d8dee9', borderLeft: '4px solid #b42318',
    borderRadius: 10, padding: '16px 18px', maxWidth: 340,
    boxShadow: '0 10px 30px rgba(16,24,40,0.18)',
    font: '14px/1.5 Inter, system-ui, sans-serif', color: '#1b2a41',
  };
  const row = { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 };
  const btn = {
    padding: '8px 14px', borderRadius: 8, border: '1px solid #d8dee9',
    background: '#fff', cursor: 'pointer', font: 'inherit', fontWeight: 600,
  };
  const primary = { ...btn, background: '#1257a6', borderColor: '#1257a6', color: '#fff' };

  return (
    <div style={box} role="alertdialog" aria-live="assertive">
      <strong>Sesioni po mbyllet</strong>
      <p style={{ margin: '6px 0 0' }}>
        Nga mosveprimi, do të dilni për <strong>{seconds}</strong> sekonda.
        Puna e paruajtur humbet.
      </p>
      <div style={row}>
        <button type="button" style={btn} onClick={onLeave}>Dil tani</button>
        <button type="button" style={primary} onClick={onStay} autoFocus>
          Vazhdo punën
        </button>
      </div>
    </div>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth duhet përdorur brenda <AuthProvider>');
  return ctx;
}