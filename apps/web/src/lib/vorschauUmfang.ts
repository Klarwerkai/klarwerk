import type { KnowledgeCheckCoverage } from "../api/types";

// AUFNAHME 20260922 · VORSCHAU-REICHWEITE — EINE Stelle, an der der belegte Prüfumfang zu Worten
// wird. Chip (Blatt) und Erklärung (LiveReactionZone) sagen damit dasselbe, und keiner der beiden
// kann eine Zahl nennen, die die Antwort nicht trägt: bei `unknown` gibt es keine Zahl.
//
// Die Übersetzer-Signatur als Überladung, nicht `TFunction`: Begründung in `auditAction.ts`
// (`exactOptionalPropertyTypes` im Root- und .tsx-Testcheck).
interface Translate {
  (key: string): string;
  (key: string, opts: Record<string, unknown>): string;
}

/** Die kurze Umfangsangabe für Chip und Statuszeile. */
export function umfangKurz(t: Translate, c: KnowledgeCheckCoverage): string {
  if (c.kind === "unknown") {
    return t("vorschau.umfangUnbekannt");
  }
  return c.limitReached
    ? t("vorschau.umfangGrenze", { count: c.checked })
    : t("vorschau.umfang", { count: c.checked });
}

/** Der ganze Satz zu einer Vorschau ohne Treffer — nennt nur den belegten Umfang. */
export function umfangErklaerung(t: Translate, c: KnowledgeCheckCoverage): string {
  if (c.kind === "unknown") {
    return t("vorschau.erklaerungUnbekannt");
  }
  return c.limitReached
    ? t("vorschau.erklaerungGrenze", { count: c.checked, limit: c.limit })
    : t("vorschau.erklaerung", { count: c.checked });
}
