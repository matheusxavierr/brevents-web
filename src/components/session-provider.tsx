"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import type { User } from "@/lib/api-types";

type SessionContextValue = {
  user: User | null;
  setUser: (user: User | null) => void;
  reload: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ initialUser, children }: { initialUser: User | null; children: ReactNode }) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [syncedUserId, setSyncedUserId] = useState<number | null>(initialUser?.id ?? null);

  const initialUserId = initialUser?.id ?? null;
  if (syncedUserId !== initialUserId) {
    setSyncedUserId(initialUserId);
    setUser(initialUser);
  }

  useEffect(() => {
    const handleSessionExpired = () => setUser(null);
    window.addEventListener("brevents:session-expired", handleSessionExpired);
    return () => window.removeEventListener("brevents:session-expired", handleSessionExpired);
  }, []);

  const reload = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me");
      setUser(response.ok ? ((await response.json()) as User) : null);
    } catch {
      setUser(null);
    }
  }, []);

  return <SessionContext.Provider value={{ user, setUser, reload }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession precisa ser usado dentro de SessionProvider.");
  return context;
}
