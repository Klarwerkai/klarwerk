// ================================================================================================
// aufnahme:20260922:gesamt-negativwissen-erfassung (R-1664, R-2179, R-2180) — DER GEFÜHRTE FALL.
// ================================================================================================
//
// Herkunft: KLARWERK_Codex_Next_Prompt_Knowledge_OS_Addendum.md:281 („Negativwissen soll später
// nicht nur ein Dropdown-Wert sein, sondern ein eigener geführter Erfassungsmodus") und die
// Review-Befunde B10/B11 (CODEX-ANALYSE-1.md:112–113). Die Wissensart `negativwissen` selbst gab es
// schon (R-2204); hier kommen die charakteristischen strukturierten Angaben und die Stufenregel dazu.
//
// DIE FELDNAMEN SIND DIE STRUKTURBEGRIFFE DER QUELLE (`incidentTrigger`, `mistakePattern`, `impact`,
// `avoidanceRule`, `earlyWarningSigns`, `recoveryAction`) — kein zweites Vokabular. `similarCases`
// steht bewusst NICHT hier: ähnliche Fälle sind Verweise auf andere Objekte und gehören der
// Ähnlichkeits-/Beziehungserkennung, keiner Freitextangabe. „Was ist passiert?" ist die Kernaussage
// (`statement`) und wird nicht verdoppelt.
//
// `bezug` beantwortet die Quellenfrage „Welche Anlage / Kunde / Prozess / Produkt war betroffen?"
// als ART des Bezugs — nie als Name. Ein Personenname gehört gerade NICHT in ein Strukturfeld.
//
// OPTIONAL UND OHNE MIGRATION: das Objekt liegt als Voll-JSONB. Fehlt das Feld, ist der Fall nicht
// geführt erfasst worden (Altbestand, andere Wissensart) — es wird nichts abgeleitet.
import { confidentialityRank } from "./confidentiality";
import type { Confidentiality } from "./types";

export type NegativwissenBezug = "personen" | "kunden" | "produktion" | "qualitaet";

export const NEGATIVWISSEN_BEZUEGE: readonly NegativwissenBezug[] = [
  "personen",
  "kunden",
  "produktion",
  "qualitaet",
];

export interface NegativwissenAngaben {
  /** Was hat den Fall ausgelöst? */
  incidentTrigger?: string;
  /** Welche Annahme war falsch / was wurde vorher gemacht? */
  mistakePattern?: string;
  /** Welche Auswirkungen hatte es? */
  impact?: string;
  /** Wie wurde es behoben? */
  recoveryAction?: string;
  /** Was sollten wir künftig vermeiden? */
  avoidanceRule?: string;
  /** Welche Warnsignale gab es? Eines je Eintrag, in Eingabereihenfolge, ohne Doppelte. */
  earlyWarningSigns: string[];
  /** Art des Bezugs (nie ein Name). Leer = kein schutzbedürftiger Bezug angegeben. */
  bezug: NegativwissenBezug[];
}

export const NEGATIVWISSEN_TEXTFELDER = [
  "incidentTrigger",
  "mistakePattern",
  "impact",
  "recoveryAction",
  "avoidanceRule",
] as const;

export const NEGATIVWISSEN_LIMITS = { text: 2000, warnsignale: 20, warnsignal: 300 } as const;

/**
 * Die Mindeststufe eines Falls mit Bezug: „vertraulich".
 *
 * Die Quelle verlangt „mindestens L2 Confidential". Das heutige Modell kennt keine L-Stufen; L2
 * entspricht hier „vertraulich" (geht nie in externe Kontexte), L3 „streng_vertraulich". Die
 * strengere Stufe bleibt eine bewusste Wahl — sie wird nie automatisch gesetzt.
 */
export const NEGATIVWISSEN_MINDESTSTUFE: Confidentiality = "vertraulich";

function text(wert: unknown, max: number): string | undefined {
  if (typeof wert !== "string") {
    return undefined;
  }
  const t = wert.trim().slice(0, max);
  return t.length > 0 ? t : undefined;
}

/**
 * Bringt eine Eingabe in die Normalform — oder liefert `undefined`, wenn sie nichts trägt.
 *
 * Typ-tolerant wie die übrigen Persistenzgrenzen dieses Projekts: falscher Container ⇒ Feld fällt
 * weg, unbekannte Bezüge werden verworfen (nicht geraten), überlange Texte gekürzt. Eine Angabe ohne
 * jeden Inhalt wird nicht abgelegt, damit „nicht geführt erfasst" von „leer erfasst" nicht zu
 * unterscheiden sein muss.
 */
export function normalizeNegativwissen(roh: unknown): NegativwissenAngaben | undefined {
  if (typeof roh !== "object" || roh === null || Array.isArray(roh)) {
    return undefined;
  }
  const r = roh as Record<string, unknown>;
  const angaben: NegativwissenAngaben = { earlyWarningSigns: [], bezug: [] };
  for (const feld of NEGATIVWISSEN_TEXTFELDER) {
    const wert = text(r[feld], NEGATIVWISSEN_LIMITS.text);
    if (wert !== undefined) {
      angaben[feld] = wert;
    }
  }
  if (Array.isArray(r.earlyWarningSigns)) {
    const gesehen = new Set<string>();
    for (const eintrag of r.earlyWarningSigns) {
      const wert = text(eintrag, NEGATIVWISSEN_LIMITS.warnsignal);
      if (wert !== undefined && !gesehen.has(wert)) {
        gesehen.add(wert);
        angaben.earlyWarningSigns.push(wert);
      }
      if (angaben.earlyWarningSigns.length >= NEGATIVWISSEN_LIMITS.warnsignale) {
        break;
      }
    }
  }
  const bezug = r.bezug;
  if (Array.isArray(bezug)) {
    // In der festen Reihenfolge der Konstante — damit ist die Normalform unabhängig von der
    // Klickreihenfolge, und Doppelte fallen von selbst weg.
    angaben.bezug = NEGATIVWISSEN_BEZUEGE.filter((b) => bezug.includes(b));
  }
  const traegtInhalt =
    NEGATIVWISSEN_TEXTFELDER.some((feld) => angaben[feld] !== undefined) ||
    angaben.earlyWarningSigns.length > 0 ||
    angaben.bezug.length > 0;
  return traegtInhalt ? angaben : undefined;
}

/** Trägt dieser Fall einen Bezug, der ihn schutzbedürftig macht? */
export function hatSchutzbezug(angaben: NegativwissenAngaben | undefined): boolean {
  return (angaben?.bezug.length ?? 0) > 0;
}

/**
 * R-2180 — die wirksame Stufe beim Anlegen: nie unter der Mindeststufe, wenn ein Bezug angegeben ist.
 *
 * NUR ANHEBEN, NIE SENKEN: eine strengere Wahl bleibt unverändert. Ohne Bezug bleibt alles wie
 * bisher — auch „nicht übergeben" bleibt „nicht übergeben" (JOB 3076: kein erfundener Default).
 */
export function stufeFuerNegativwissen(
  gewaehlt: Confidentiality | undefined,
  angaben: NegativwissenAngaben | undefined,
): Confidentiality | undefined {
  if (!hatSchutzbezug(angaben)) {
    return gewaehlt;
  }
  if (
    gewaehlt === undefined ||
    confidentialityRank(gewaehlt) < confidentialityRank(NEGATIVWISSEN_MINDESTSTUFE)
  ) {
    return NEGATIVWISSEN_MINDESTSTUFE;
  }
  return gewaehlt;
}

/** R-2180 — würde `ziel` die Mindeststufe eines Falls mit Bezug unterschreiten? */
export function unterschreitetNegativwissenStufe(
  angaben: NegativwissenAngaben | undefined,
  ziel: Confidentiality,
): boolean {
  return (
    hatSchutzbezug(angaben) &&
    confidentialityRank(ziel) < confidentialityRank(NEGATIVWISSEN_MINDESTSTUFE)
  );
}
