"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, API_URL, tokenStore, type Quota, type User } from "./api";

interface AuthState { user: User | null; quota: Quota | null; ready: boolean; enabled: boolean; refresh: () => Promise<void>; signIn: (token: string, user: User) => void; signOut: () => void }
const Ctx = createContext<AuthState>({ user: null, quota: null, ready: false, enabled: false, refresh: async () => {}, signIn: () => {}, signOut: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [ready, setReady] = useState(false);
  const refresh = useCallback(async () => {
    if (!API_URL || !tokenStore.get()) { setUser(null); setReady(true); return; }
    try {
      const { status, body } = await api.me();
      if (status === 200 && body.ok) { setUser(body.user); setQuota(body.quota); } else if (status === 401) { tokenStore.clear(); setUser(null); }
    } catch { /* offline: keep token, show logged-out UI */ }
    setReady(true);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const signIn = (t: string, u: User) => { tokenStore.set(t); setUser(u); refresh(); };
  const signOut = () => { tokenStore.clear(); setUser(null); setQuota(null); };
  return <Ctx.Provider value={{ user, quota, ready, enabled: !!API_URL, refresh, signIn, signOut }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
