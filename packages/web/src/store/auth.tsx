import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api/client';

export interface PostInfo {
  postId: string;
  positionId: string;
  positionName: string;
  isLeader: boolean;
  isDeputy: boolean;
  isPrimary: boolean;
  orgId: string;
  orgName: string;
  orgType: string;
  rootUnitId: string;
}

export interface UserInfo {
  id: string;
  account: string;
  name: string;
  title?: string;
  posts: PostInfo[];
  primaryOrgId: string | null;
  primaryOrgName: string | null;
  rootUnitId: string | null;
  isLeader: boolean;
}

interface AuthCtx {
  user: UserInfo | null;
  loading: boolean;
  login: (account: string, password: string) => Promise<UserInfo>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem('oooa_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/auth/profile');
      setUser(data);
    } catch {
      localStorage.removeItem('oooa_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (account: string, password: string) => {
    const { data } = await api.post('/auth/login', { account, password });
    localStorage.setItem('oooa_token', data.token);
    setUser(data.user);
    return data.user as UserInfo;
  };

  const logout = () => {
    localStorage.removeItem('oooa_token');
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, login, logout, refresh }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
