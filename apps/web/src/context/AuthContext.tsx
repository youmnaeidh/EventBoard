import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, setAccessToken } from "../lib/api";
import type { Role, User } from "../types";

interface AuthValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: { name: string; email: string; password: string; role: Role; interests: string[] }) => Promise<User>;
  logout: () => Promise<void>;
  setInterests: (interests: string[]) => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<{ user: User | null }>("/auth/me"),
    staleTime: 5 * 60_000
  });

  // Anything personalised (favourites, recommendations, bookings) must be refetched after the identity changes.
  const refreshPersonal = useCallback(async () => {
    await qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "me" });
  }, [qc]);

  const login = useCallback<AuthValue["login"]>(
    async (email, password) => {
      const { user, accessToken } = await api.post<{ user: User; accessToken?: string }>("/auth/login", { email, password });
      if (accessToken) setAccessToken(accessToken);
      qc.setQueryData(["me"], { user });
      await refreshPersonal();
      return user;
    },
    [qc, refreshPersonal]
  );

  const register = useCallback<AuthValue["register"]>(
    async (input) => {
      const { user, accessToken } = await api.post<{ user: User; accessToken?: string }>("/auth/register", input);
      if (accessToken) setAccessToken(accessToken);
      qc.setQueryData(["me"], { user });
      await refreshPersonal();
      return user;
    },
    [qc, refreshPersonal]
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setAccessToken(null);
      qc.setQueryData(["me"], { user: null });
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
    }
  }, [qc]);

  const setInterests = useCallback(
    async (interests: string[]) => {
      await api.put("/auth/me/interests", { interests });
      qc.setQueryData<{ user: User | null }>(["me"], (old) => (old?.user ? { user: { ...old.user, interests } } : old));
      await qc.invalidateQueries({ queryKey: ["recommendations"] });
    },
    [qc]
  );

  const value = useMemo<AuthValue>(
    () => ({ user: data?.user ?? null, loading: isLoading, login, register, logout, setInterests }),
    [data, isLoading, login, register, logout, setInterests]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
