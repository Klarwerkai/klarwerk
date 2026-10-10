import type { ReasonerLocale } from "../../reasoner";
import type { Gap, GapBelegbedarf, GapPriority } from "./types";

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
  // GAP-SPRACHHERKUNFT: Sprache, in der die Lücke entstand. Bewusst AUCH in der redigierten Sicht
  // (siehe unten) — eine Sprachangabe ist kein Fragetext und verrät nichts über den Inhalt.
  locale?: ReasonerLocale;
  // JOB 1111 / D-032 · R-0333: wie oft dieselbe Frage zu dieser Lücke führte. Stand bis zur
  // Aufnahme gesamt-wissensluecken NICHT in dieser Projektion — die Häufigkeit wurde gezählt und
  // gespeichert, erreichte die Oberfläche aber nie. In BEIDEN Zweigen: eine Zahl ist kein Fragetext.
  askCount?: number;
  // R-0291: welcher Beleg für eine tragfähige Antwort fehlen würde. NUR in der berechtigten Sicht —
  // der Befund gehört zur Frage und wird mit ihr zurückgehalten.
  belegbedarf?: GapBelegbedarf[];
  // true → der Fragetext wurde für diesen Betrachter zurückgehalten (fail-closed Redaktion).
  redacted?: boolean;
}

// R-0585 (DS6, Auftrag gesamt-datenschutz-voreinstellung): „Was jemand gefragt hat, sieht nur er
// selbst und der Zuständige — für alle anderen wird der Fragetext geschwärzt." Bis hierher trug der
// Kontext ein drittes Recht, `maySeeDetail`, das die Routen pauschal aus `ko.validate` ableiteten:
// jeder Admin und Controller las jeden Fragetext, auch ohne je zuständig gewesen zu sein. Dieses
// Rollenrecht ist ENTFERNT, nicht bloß auf `false` gestellt — ein Feld, das niemand mehr setzen
// darf, wäre die Einladung, es wieder zu setzen. Zuständig wird man durch Zuweisung (`assignee`).
export interface GapViewerContext {
  viewerId: string;
}

// FUNKE-FIX2 P0: fail-closed Redaktion. Volltext sehen NUR der Assignee (der Zuständige) ODER der
// Ersteller/Owner (der Fragende). Alle anderen — ausdrücklich auch Rollen mit `ko.validate` — und
// jeder Fall ohne ermittelbare Berechtigung erhalten eine redigierte Sicht (Kategorie/
// Neutralbezeichnung über die vorhandenen Felder — Priorität/Status/Zeitpunkt bleiben, der
// Fragetext NICHT).
export function redactGapForViewer(gap: Gap, viewer: GapViewerContext): GapView {
  const authorized =
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
    // GAP-SPRACHHERKUNFT: in BEIDEN Zweigen mitgeliefert. Gerade der Betrachter ohne Detailrecht
    // sieht nur eine Neutralbezeichnung — ohne die Sprachangabe stünde bei ihm ein unerklärter
    // fremdsprachiger Eintrag. Die Sprache ist datensparsam: sie sagt nichts über den Inhalt.
    ...(gap.locale ? { locale: gap.locale } : {}),
    ...(typeof gap.askCount === "number" ? { askCount: gap.askCount } : {}),
  };
  if (authorized) {
    return {
      ...base,
      question: gap.question,
      ...(gap.belegbedarf?.length ? { belegbedarf: [...gap.belegbedarf] } : {}),
    };
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
