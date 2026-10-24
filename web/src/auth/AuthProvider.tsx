import { createContext, useContext, useEffect, type ReactNode } from "react";
import useSWR from "swr";
import { ApiError, fetchJson, setCsrfToken } from "../api/client";

export interface User {
  id: string;
  name: string;
  email: string;
}
interface Session {
  user: User | null;
  csrfToken?: string;
}
interface Credentials {
  email: string;
  password: string;
  name?: string;
  remember?: boolean;
}
interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: Error | undefined;
  signIn: (credentials: Credentials, register: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  retry: () => void;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useSWR<Session, Error>("/api/auth/session", fetchJson, {
    revalidateOnFocus: true,
    shouldRetryOnError: false,
    dedupingInterval: 1000,
  });
  const { mutate } = session;

  useEffect(() => {
    setCsrfToken(session.data?.csrfToken ?? null);
  }, [session.data]);
  useEffect(() => {
    const expired = () => {
      setCsrfToken(null);
      void mutate({ user: null }, { revalidate: false });
    };
    const recheck = () => {
      void mutate();
    };
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("aquaml-auth")
        : null;
    if (channel) channel.onmessage = recheck;
    window.addEventListener("aquaml:session-expired", expired);
    return () => {
      window.removeEventListener("aquaml:session-expired", expired);
      channel?.close();
    };
  }, [mutate]);

  const announce = () => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("aquaml-auth");
    channel.postMessage("session-changed");
    channel.close();
  };
  const signIn = async (credentials: Credentials, register: boolean) => {
    const next = await fetchJson<Session>(
      `/api/auth/${register ? "register" : "login"}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      },
    );
    setCsrfToken(next.csrfToken ?? null);
    await mutate(next, { revalidate: false });
    announce();
  };
  const signOut = async () => {
    try {
      await fetchJson("/api/auth/logout", { method: "POST" });
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) throw error;
    }
    setCsrfToken(null);
    await mutate({ user: null }, { revalidate: false });
    announce();
  };
  return (
    <AuthContext.Provider
      value={{
        user: session.data?.user ?? null,
        loading: session.isLoading,
        error: session.error,
        signIn,
        signOut,
        retry: () => {
          void mutate();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("A autenticação precisa do AuthProvider.");
  return context;
}
