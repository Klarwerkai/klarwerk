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
}

const RoleCtx = createContext<RoleState | null>(null);

export function RoleProvider({ children }: { children: ReactNode }): JSX.Element {
  const { user } = useSession();
  // Lokaler Preview-/Dev-Zustand — nur wirksam ohne echten Session-User.
  const [previewRole, setPreviewRole] = useState<Role>("experte");
  const [stufe2Toggle, setStufe2Toggle] = useState(false);

  const role = effectiveRole(user?.role ?? null, previewRole);

  const value = useMemo<RoleState>(
    () => ({
      role,
      setRole: setPreviewRole,
      stufe2: effectiveStufe2(role, stufe2Toggle),
      setStufe2: setStufe2Toggle,
      isSessionRole: Boolean(user),
    }),
    [role, stufe2Toggle, user],
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
