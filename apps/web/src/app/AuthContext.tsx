import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, createContext, useContext } from "react";
import { type SessionUser, authApi } from "../api/auth";
import { SESSION_REFRESH_MS, resolveSessionUser } from "../lib/sessionState";

// Echte Sitzung aus dem Backend (/auth/status + /auth/me). Login/Logout-Screens
// (#61) nutzen diesen Context; die Shell wird später dahinter gesperrt.
interface AuthState {
  user: SessionUser | null;
  needsSetup: boolean;
  /** FR-AUTH-07: SSO im Server konfiguriert? Steuert die ehrliche SSO-UI. */
  oidcEnabled: boolean;
  isLoading: boolean;
  /** Status-Abfrage fehlgeschlagen (z. B. Backend im Dev nicht erreichbar). */
  error: boolean;
  refresh: () => void;
  /** Abmelden: Session serverseitig beenden und den gesamten Query-Cache leeren. */
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const queryClient = useQueryClient();

  const status = useQuery({
    queryKey: ["auth", "status"],
    queryFn: authApi.status,
    retry: false,
    // FE-FND-08: Session frisch halten — periodisch + bei Fenster-Fokus.
    refetchInterval: SESSION_REFRESH_MS,
    refetchOnWindowFocus: true,
  });

  const needsSetup = status.data?.needsSetup ?? false;

  const me = useQuery({
    queryKey: ["auth", "me"],
    queryFn: authApi.me,
    retry: false,
    // Vor Ersteinrichtung gibt es keinen Nutzer abzufragen.
    enabled: status.isSuccess && !needsSetup,
    // FE-FND-08: periodisches Nachladen + Fokus-Refetch gegen stale Session.
    refetchInterval: SESSION_REFRESH_MS,
    refetchOnWindowFocus: true,
  });

  const value: AuthState = {
    // FE-FND-08: bei Abfragefehler (abgelaufene Session/401) kein stale User.
    // WP-KLARA-2 (typ-neutral): undefined → null VOR dem Aufruf, damit der Generic sauber auf
    // SessionUser bindet (verhaltensgleich — resolveSessionUser normalisierte ?? null ohnehin).
    user: resolveSessionUser({ data: me.data ?? null, isError: me.isError }),
    needsSetup,
    oidcEnabled: status.data?.oidcEnabled ?? false,
    isLoading: status.isLoading || (status.isSuccess && !needsSetup && me.isLoading),
    error: status.isError,
    refresh: () => {
      void queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
    // Nach dem Logout den Cache leeren UND hart auf "/" neu laden. Ein reines
    // invalidate/clear reicht nicht zuverlässig (React Query behält bei 401 die
    // alten /auth/me-Daten, der Nutzer wirkt weiter angemeldet). Der harte Reload
    // bootet die App frisch; da die Server-Session beendet ist, erscheint der Login.
    signOut: async () => {
      try {
        await authApi.logout();
      } finally {
        queryClient.clear();
        window.location.assign("/");
      }
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
