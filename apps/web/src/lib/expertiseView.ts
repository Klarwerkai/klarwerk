import type { ExpertiseEntry } from "../api/types";
import type { Role } from "../app/navigation";

// Consultant-System (Experten-Matching), UI-Gating — DOM-frei und testbar (wie der übrige
// Anzeige-Logik-Stil im Frontend). ko.assign halten laut RBAC nur controller/admin; nur diese
// Rollen fragen die Experten-Sicht überhaupt an (sonst kein Request, keine Anzeige = heutiges Verhalten).
export function canSeeExpertise(role: Role): boolean {
  return role === "controller" || role === "admin";
}

// Sichtbar NUR, wenn die Rolle ko.assign hat UND echte Daten vorliegen. Beides zusammen bildet die
// Server-Gates ab: Flag AUS → 404 → keine Daten → unsichtbar; fehlendes ko.assign → 401/403 → keine
// Daten → unsichtbar; leere Liste → nichts zu zeigen. Kein Score, kein Ranking — reines „gibt es was".
export function expertiseVisible(role: Role, data: ExpertiseEntry[] | undefined): boolean {
  return canSeeExpertise(role) && Array.isArray(data) && data.length > 0;
}

// Beitragende eines Themas als Namen. Die alphabetische Reihenfolge kommt vom Backend und bleibt
// bewusst erhalten (anti-Gamification: keine Sortierung nach Beitragsmenge). Unbekanntes Thema → leer.
export function contributorNamesFor(
  data: ExpertiseEntry[] | undefined,
  category: string,
  nameOf: (id: string) => string,
): string[] {
  const entry = data?.find((e) => e.category === category);
  return entry ? entry.contributors.map((c) => nameOf(c.authorId)) : [];
}
