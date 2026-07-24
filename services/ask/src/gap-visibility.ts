import type { Gap, GapPriority } from "./types";

// FUNKE-FIX2 P0 (bens Blocker Gap-Freitext): adressatengerechte Sichtbarkeit des Wissenslücken-
// FREITEXTES (gap.question). Der Fragetext ist Nutzer-Freitext OHNE Vertraulichkeitsstufe und kann
// vertraulichen Entwurf tragen — er darf NIE pauschal an jede ko.read-Rolle ausgeliefert werden.
// Diese reinen Helfer definieren:
//   - GapView: die an den Client gehende Projektion. Trägt NIE `createdBy` (kein Leak, wer eine
//     vertrauliche Lücke anlegte) und bei fehlender Berechtigung KEINEN Fragetext (redacted-Marker).
//   - redactGapForViewer: fail-closed Redaktion je Betrachter (Owner/Assignee/Detail-Rolle → Volltext,
//     sonst redigiert).
//   - summarizeGaps: rein aggregierte Zähler (keine Fragetexte) für die Startseite.

// Die an den Client ausgelieferte Sicht einer Wissenslücke. Bewusst OHNE `createdBy`.
export interface GapView {
  id: string;
  // Bei Berechtigung der Volltext; bei Redaktion "" (der Client zeigt eine Neutralbezeichnung).
  question: string;
  status: "offen" | "geschlossen";
  assignee: string | null;
  priority: GapPriority;
  createdAt: string;
  demoSeed?: boolean;
  // true → der Fragetext wurde für diesen Betrachter zurückgehalten (fail-closed Redaktion).
  redacted?: boolean;
}

export interface GapViewerContext {
  viewerId: string;
  // Rolle mit ausdrücklicher Detail-Berechtigung (ko.validate/users.manage-Ebene) — Kuratoren, die den
  // Lücken-Freitext ohnehin bearbeiten. Aus der Rolle in der Route abgeleitet (can(role, "ko.validate")).
  maySeeDetail: boolean;
}

// FUNKE-FIX2 P0: fail-closed Redaktion. Volltext sehen NUR: eine Detail-Rolle, der Assignee ODER der
// Ersteller/Owner. Alle anderen (und jeder Fall ohne ermittelbare Berechtigung) erhalten eine
// redigierte Sicht (Kategorie/Neutralbezeichnung über die vorhandenen Felder — Priorität/Status/
// Zeitpunkt bleiben, der Fragetext NICHT).
export function redactGapForViewer(gap: Gap, viewer: GapViewerContext): GapView {
  const authorized =
    viewer.maySeeDetail ||
    (gap.assignee !== null && gap.assignee === viewer.viewerId) ||
    (gap.createdBy !== undefined && gap.createdBy === viewer.viewerId);
  const base: GapView = {
    id: gap.id,
    question: "",
    status: gap.status,
    assignee: gap.assignee,
    priority: gap.priority,
    createdAt: gap.createdAt,
    ...(gap.demoSeed ? { demoSeed: true } : {}),
  };
  if (authorized) {
    return { ...base, question: gap.question };
  }
  return { ...base, redacted: true };
}

// FUNKE-FIX2 P0 (bens Erforderlich 1): rein aggregierte Zähler — KEINE Fragetexte. Grundlage des
// Summary-Endpunkts, den die Startseite AUSSCHLIESSLICH nutzt (kein Volltext-Fetch mehr).
export interface GapSummary {
  open: number;
  byPriority: Record<GapPriority, number>;
}

export function summarizeGaps(gaps: readonly Gap[]): GapSummary {
  const byPriority: Record<GapPriority, number> = { hoch: 0, mittel: 0, niedrig: 0 };
  let open = 0;
  for (const gap of gaps) {
    if (gap.status === "offen") {
      open += 1;
      byPriority[gap.priority] += 1;
    }
  }
  return { open, byPriority };
}
