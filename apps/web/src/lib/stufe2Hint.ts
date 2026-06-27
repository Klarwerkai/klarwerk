// SCRUM-235: DOM-freie Ableitung des Stufe-2-Auffindbarkeits-Hinweises. Stufe-2-Module sind
// admin-only UND zusätzlich hinter dem Sidebar-Schalter (effectiveStufe2). Ist man Admin, hat den
// Schalter aber AUS, sind Kapital/Output/Import/Graph unsichtbar — der Hinweis macht sie auffindbar,
// OHNE Rechte zu erfinden oder etwas freizuschalten. Nicht-Admins bekommen keinen Hinweis (kein
// falsches Versprechen); Admins mit aktivem Schalter brauchen keinen (Navigation zeigt die Gruppe).
import { NAV_GROUPS, type Role } from "../app/navigation";

export type Stufe2HintKind = "enable" | "none";

export function stufe2HintKind(role: Role, stufe2: boolean): Stufe2HintKind {
  return role === "admin" && !stufe2 ? "enable" : "none";
}

// labelKeys der Stufe-2-Module — aus der Navigation abgeleitet (keine Hardcodes, bleibt korrekt,
// falls sich die Stufe-2-Items ändern).
export function stufe2FeatureLabelKeys(): string[] {
  const keys: string[] = [];
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.stufe2) {
        keys.push(item.labelKey);
      }
    }
  }
  return keys;
}
