import { type ReactNode, createContext, useContext, useMemo, useState } from "react";
import { effectiveRole, effectiveStufe2 } from "../lib/effectiveRole";
import { useSession } from "./AuthContext";
import type { Role } from "./navigation";

// Rollen-/Stufe-2-Zustand (SCRUM-150). Die effektive Rolle kommt aus der echten
// Auth-Session (`/auth/me`). Nur wenn kein Session-User existiert (Dev-/Preview),
// greift der lokale Umschalter. Backend-RBAC bleibt serverseitig maßgeblich.
interface RoleState {
  role: Role;
  setRole: (role: Role) => void;
  stufe2: boolean;
  setStufe2: (on: boolean) => void;
  /** true, wenn die Rolle aus einer echten Session stammt (kein Preview-Schalter). */
  isSessionRole: boolean;
  /** Bug (Pedi 04.07.): Ein Admin darf die ANSICHT als andere Rolle prüfen (Beta-Test). */
  canPreview: boolean;
  /** true, wenn ein Admin gerade eine FREMDE Rolle (nicht Admin) ansieht. */
  previewActive: boolean;
}

const RoleCtx = createContext<RoleState | null>(null);

export function RoleProvider({ children }: { children: ReactNode }): JSX.Element {
  const { user } = useSession();
  const sessionRole = user?.role ?? null;
  // Nur ein Admin darf die Ansicht wechseln (nie Rechte-Eskalation für Nicht-Admins).
  const isAdminSession = sessionRole === "admin";
  // Admin-Ansicht-als: null = eigene Admin-Ansicht.
  const [viewAs, setViewAs] = useState<Role | null>(null);
  // Lokaler Preview-/Dev-Zustand — nur wirksam ohne echten Session-User.
  const [previewRole, setPreviewRole] = useState<Role>("experte");
  const [stufe2Toggle, setStufe2Toggle] = useState(false);

  // Bug (Pedi 04.07.): Ein eingeloggter Admin sieht die UI wahlweise als jede Rolle — die echte
  // Session (Backend-RBAC) bleibt Admin. Nicht-Admins: echte Session; ohne Session: Dev-Preview.
  const role: Role = isAdminSession ? (viewAs ?? "admin") : effectiveRole(sessionRole, previewRole);

  const value = useMemo<RoleState>(
    () => ({
      role,
      setRole: (r: Role) => (isAdminSession ? setViewAs(r) : setPreviewRole(r)),
      stufe2: effectiveStufe2(role, stufe2Toggle),
      setStufe2: setStufe2Toggle,
      isSessionRole: Boolean(user),
      canPreview: isAdminSession || !user,
      previewActive: isAdminSession && role !== "admin",
    }),
    [role, stufe2Toggle, user, isAdminSession],
  );

  return <RoleCtx.Provider value={value}>{children}</RoleCtx.Provider>;
}

export function useRole(): RoleState {
  const ctx = useContext(RoleCtx);
  if (!ctx) {
    throw new Error("useRole muss innerhalb von <RoleProvider> verwendet werden.");
  }
  return ctx;
}
