"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type User = {
  id: string;
  email: string;
  alias: string | null;
};

type SessionContextValue = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setUser: (user: User | null) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

async function fetchSessionUser() {
  const res = await fetch("/api/auth/me", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch session");
  const data = await res.json();
  return (data?.user ?? null) as User | null;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const assignUser = useCallback((value: User | null) => {
    if (mountedRef.current) setUser(value);
  }, []);

  const setLoadingSafe = useCallback((value: boolean) => {
    if (mountedRef.current) setLoading(value);
  }, []);

  const refresh = useCallback(async () => {
    setLoadingSafe(true);
    try {
      const next = await fetchSessionUser();
      assignUser(next);
    } catch (error) {
      console.error(error);
      assignUser(null);
    } finally {
      setLoadingSafe(false);
    }
  }, [assignUser, setLoadingSafe]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      user,
      loading,
      refresh,
      setUser: assignUser,
    }),
    [assignUser, loading, refresh, user]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return ctx;
}
