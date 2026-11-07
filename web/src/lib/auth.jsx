import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { inTelegram, initData, initTelegram } from './telegram';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get('/auth/me');
      setUser(data.user ?? null);
      return data.user ?? null;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      initTelegram();

      let current = await refresh();

      // Bot ichida ochilgan bo'lsa, parol so'ramasdan kiramiz:
      // Telegram bergan imzo serverda tekshiriladi.
      if (!current && inTelegram()) {
        try {
          const res = await api.post('/telegram/webapp-auth', { initData: initData() });
          current = res.user ?? null;
        } catch {
          // Hisob hali ulanmagan — oddiy kirish sahifasi ko'rinadi
          current = null;
        }
      }

      if (!alive) return;
      setUser(current);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      setUser,
      loading,
      refresh,
      logout,
      isAdmin: user?.role === 'admin' || user?.role === 'owner',
    }),
    [user, loading, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth faqat AuthProvider ichida ishlatiladi');
  return ctx;
}
