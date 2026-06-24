import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, createContext, useContext } from "react";
import { type SessionUser, authApi } from "../api/auth";

// Echte Sitzung aus dem Backend (/auth/status + /auth/me). Login/Logout-Screens
// (#61) nutzen diesen Context; die Shell wird später dahinter gesperrt.
interface AuthState {
  user: SessionUser | null;
  needsSetup: boolean;
  isLoading: boolean;
  /** Status-Abfrage fehlgeschlagen (z. B. Backend im Dev nicht erreichbar). */
  error: boolean;
  refresh: () => void;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const queryClient = useQueryClient();

  const status = useQuery({
    queryKey: ["auth", "status"],
    queryFn: authApi.status,
    retry: false,
  });

  const needsSetup = status.data?.needsSetup ?? false;

  const me = useQuery({
    queryKey: ["auth", "me"],
    queryFn: authApi.me,
    retry: false,
    // Vor Ersteinrichtung gibt es keinen Nutzer abzufragen.
    enabled: status.isSuccess && !needsSetup,
  });

  const value: AuthState = {
    user: me.data ?? null,
    needsSetup,
    isLoading: status.isLoading || (status.isSuccess && !needsSetup && me.isLoading),
    error: status.isError,
    refresh: () => {
      void queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useSession(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) {
    throw new Error("useSession muss innerhalb von <AuthProvider> verwendet werden.");
  }
  return ctx;
}
