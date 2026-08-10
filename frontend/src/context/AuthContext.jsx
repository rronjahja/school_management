import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { canAccess, homePath } from '../config/roles';
import * as authApi from '../api/auth';
import { setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  /**
   * Fjalëkalimi i përkohshëm, i mbajtur VETËM në kujtesë dhe VETËM derisa
   * përdoruesi të vendosë të tijin. Nuk shkon kurrë te localStorage as te
   * cookie: nëse faqja rifreskohet, humbet — dhe ekrani i ndryshimit e
   * kërkon atëherë me shkrim. Kështu përdoruesi nuk e shtyp dy herë të
   * njëjtin fjalëkalim brenda dhjetë sekondash, pa lëshuar asgjë nga siguria
   * (serveri e verifikon gjithsesi, çdo herë).
   */
  const initialPassword = useRef('');

  // Sesioni i skaduar -> kthehemi te faqja e hyrjes
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
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
    setUser(u);
    return u;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      initialPassword.current = '';
      setUser(null);
    }
  }, []);

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
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth duhet përdorur brenda <AuthProvider>');
  return ctx;
}