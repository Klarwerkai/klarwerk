// Reine, DOM-freie Ableitung der effektiven Frontend-Rolle (SCRUM-150).
// Echte Auth-Session-Rolle gewinnt; ohne Session greift der lokale
// Preview-/Dev-Wert. Backend-RBAC bleibt davon unberührt (Server erzwingt Rechte).
import type { Role } from "../app/navigation";

export function effectiveRole(sessionRole: Role | null | undefined, previewRole: Role): Role {
  return sessionRole ?? previewRole;
}

// Stufe-2-Module nur bei effektiver Admin-Rolle.
export function effectiveStufe2(role: Role, stufe2Toggle: boolean): boolean {
  return role === "admin" ? stufe2Toggle : false;
}
