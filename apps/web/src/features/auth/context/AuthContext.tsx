import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { configureHttpAuthRefreshFailed } from '~/lib/http';
import { authService } from '../services/auth.service';
import type { AuthUser } from '../types';

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthReady: boolean;
  isLoggedIn: boolean;
  setUser: (user: AuthUser | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    configureHttpAuthRefreshFailed(() => setUser(null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    authService
      .me()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsAuthReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    await authService.logout().catch(() => undefined);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthReady, isLoggedIn: isAuthReady && user !== null, setUser, logout }),
    [user, isAuthReady, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
