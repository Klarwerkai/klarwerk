import { type ReactNode, createContext, useContext, useMemo, useState } from "react";
import type { Role } from "./navigation";

// Rollen-/Stufe-2-Zustand. Im Prototyp per Schalter umschaltbar (BRIEF §4/§7);
// die echte Rolle kommt später aus der Auth-Sitzung (#60). Standard = Experte.
interface RoleState {
  role: Role;
  setRole: (role: Role) => void;
  stufe2: boolean;
  setStufe2: (on: boolean) => void;
}

const RoleCtx = createContext<RoleState | null>(null);

export function RoleProvider({ children }: { children: ReactNode }): JSX.Element {
  const [role, setRole] = useState<Role>("experte");
  const [stufe2, setStufe2] = useState(false);

  const value = useMemo<RoleState>(
    () => ({
      role,
      setRole,
      // Stufe-2-Module sind nur für Admin gedacht; bei Rollenwechsel weg vom Admin aus.
      stufe2: role === "admin" ? stufe2 : false,
      setStufe2,
    }),
    [role, stufe2],
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
