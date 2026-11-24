import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch, setInMemoryToken } from '../lib/api';
import type { AdminUser } from '../types/gym';

export interface MongoStatus {
  configured: boolean;
  connected: boolean;
  readyState: number;
  error: string | null;
}

interface AuthContextValue {
  user: AdminUser | null;
  loading: boolean;
  needsSetup: boolean;
  mongoStatus: MongoStatus | null;
  login: (email: string, password: string) => Promise<void>;
  setup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [mongoStatus, setMongoStatus] = useState<MongoStatus | null>(null);

  const refreshAuth = useCallback(async () => {
    try {
      const status = await apiFetch<{ needsSetup: boolean; mongo?: MongoStatus }>('/api/auth/status');
      setNeedsSetup(status.needsSetup);
      setMongoStatus(status.mongo ?? null);
      if (status.mongo && !status.mongo.connected) {
        setUser(null);
        return;
      }
      if (status.needsSetup) {
        setUser(null);
        return;
      }
      try {
        const me = await apiFetch<{ user: AdminUser }>('/api/auth/me');
        setUser(me.user);
      } catch {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  const login = async (email: string, password: string) => {
    const res = await apiFetch<{ user: AdminUser; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setInMemoryToken(res.token);
    setUser(res.user);
    setNeedsSetup(false);
  };

  const setup = async (name: string, email: string, password: string) => {
    const res = await apiFetch<{ user: AdminUser; token: string }>('/api/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    setInMemoryToken(res.token);
    setUser(res.user);
    setNeedsSetup(false);
  };

  const logout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setInMemoryToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, needsSetup, mongoStatus, login, setup, logout, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
