import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { canAccess, homePath } from '../config/roles';
import * as authApi from '../api/auth';
import { setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

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
    setUser(u);
    return u;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
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
        // Shkurtore per rastet e shpeshta te nderfaqes
        isAdmin: canAccess(user, 'settings'),
        isManager: canAccess(user, 'manage'),
        isFinance: canAccess(user, 'finance'),
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