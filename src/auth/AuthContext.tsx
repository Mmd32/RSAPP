import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AuthService, AuthUser } from '../services/authService';
import { UNAUTHORIZED_EVENT } from '../services/apiClient';

type AuthState =
  | { status: 'loading' }
  | { status: 'offline' }
  | { status: 'setup'; setupTokenRequired: boolean }
  | { status: 'signed-out'; reason?: 'expired' }
  | { status: 'signed-in'; user: AuthUser };

interface AuthContextValue {
  state: AuthState;
  /** The signed-in user; only call where state.status === 'signed-in'. */
  user: AuthUser | null;
  signedIn: (user: AuthUser) => void;
  logout: () => Promise<void>;
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const LAST_USER_KEY = 'rsapp_last_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const resolve = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const user = await AuthService.me();
      localStorage.setItem(LAST_USER_KEY, JSON.stringify(user));
      setState({ status: 'signed-in', user });
    } catch (e: any) {
      if (e?.status === 401) {
        const s = await AuthService.status().catch(() => null);
        if (s?.setupRequired) setState({ status: 'setup', setupTokenRequired: s.setupTokenRequired });
        else setState({ status: 'signed-out' });
        return;
      }
      // No network: an evaluator in a basement must still reach the form they
      // were filling. Reuse the last verified account; the server re-checks the
      // session on every sync once the connection returns.
      try {
        const cached = localStorage.getItem(LAST_USER_KEY);
        if (cached) {
          setState({ status: 'signed-in', user: JSON.parse(cached) });
          return;
        }
      } catch {
        /* fall through */
      }
      setState({ status: 'offline' });
    }
  }, []);

  useEffect(() => {
    resolve();
  }, [resolve]);

  useEffect(() => {
    const onUnauthorized = () =>
      setState((prev) => (prev.status === 'signed-in' ? { status: 'signed-out', reason: 'expired' } : prev));
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const signedIn = useCallback((user: AuthUser) => {
    localStorage.setItem(LAST_USER_KEY, JSON.stringify(user));
    setState({ status: 'signed-in', user });
  }, []);

  const logout = useCallback(async () => {
    await AuthService.logout().catch(() => undefined);
    localStorage.removeItem(LAST_USER_KEY);
    setState({ status: 'signed-out' });
  }, []);

  return (
    <AuthContext.Provider
      value={{ state, user: state.status === 'signed-in' ? state.user : null, signedIn, logout, retry: resolve }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
