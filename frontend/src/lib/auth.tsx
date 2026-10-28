import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";
import type { Role } from "./types";

const KEY = "avinor_user";

export type AuthUser = {
  role: Role;
  login: string;
  nome: string;
  vendedor_id: number | null;
  token: string;
};

type AuthCtx = {
  user: AuthUser | null;
  role: Role | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

const Ctx = createContext<AuthCtx | null>(null);

function readSaved(): AuthUser | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed?.token || (parsed.role !== "adm" && parsed.role !== "colaborador")) return null;
    return parsed;
  } catch {
    localStorage.removeItem(KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readSaved());

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      role: user?.role || null,
      login: async (username, password) => {
        const next = await api<AuthUser>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ username, password }),
        });
        localStorage.setItem(KEY, JSON.stringify(next));
        setUser(next);
      },
      logout: () => {
        localStorage.removeItem(KEY);
        setUser(null);
      },
    }),
    [user],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("AuthProvider ausente");
  return ctx;
}
