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

/**
 * Die Obergrenzen eines Falls. GEGENSTÜCK: `apps/web/src/lib/negativwissen.ts` (die Fläche zeigt
 * Überschreitungen vor dem Speichern an); beide Werte vergleicht
 * `tests/negativwissen-erfassung/grenzen.test.ts`.
 *
 * BEN, Nacharbeit 2: hier wird NICHTS gekürzt. Eine Überschreitung wird an den Schreibrändern
 * abgewiesen (`negativwissenGrenzfehler`) — ein still abgeschnittener Lerneffekt wäre genau der
 * Inhaltsverlust, den niemand bemerkt.
 */
export const NEGATIVWISSEN_LIMITS = { text: 2000, warnsignale: 20, warnsignal: 300 } as const;

/**
 * Die Mindeststufe eines Falls mit Bezug: „vertraulich".
 *
 * Die Quelle verlangt „mindestens L2 Confidential". Das heutige Modell kennt keine L-Stufen; L2
 * entspricht hier „vertraulich" (geht nie in externe Kontexte), L3 „streng_vertraulich". Die
 * strengere Stufe bleibt eine bewusste Wahl — sie wird nie automatisch gesetzt.
 */
export const NEGATIVWISSEN_MINDESTSTUFE: Confidentiality = "vertraulich";

function text(wert: unknown): string | undefined {
  if (typeof wert !== "string") {
    return undefined;
  }
  const t = wert.trim();
  return t.length > 0 ? t : undefined;
}

/** Die Warnsignale in Normalform: getrimmt, ohne Leer- und Doppeleinträge, in Eingabereihenfolge. */
function warnsignaleVon(roh: unknown): string[] {
  if (!Array.isArray(roh)) {
    return [];
  }
  const liste: string[] = [];
  for (const eintrag of roh) {
    const wert = text(eintrag);
    if (wert !== undefined && !liste.includes(wert)) {
      liste.push(wert);
    }
  }
  return liste;
}

/**
 * BEN, Nacharbeit 2 — überschreitet die Eingabe eine Obergrenze? Liefert dann einen Satz, der die
 * Stelle und die Grenze nennt, sonst `undefined`. Gemessen wird an der NORMALFORM (getrimmt, ohne
 * Leer- und Doppeleinträge) — dieselbe Zählung wie in der Fläche. Die Schreibränder weisen damit ab
 * (`KoService.buildCreatedKo`, `validateDraftPayloadShape`), statt zu kürzen.
 */
export function negativwissenGrenzfehler(roh: unknown): string | undefined {
  if (typeof roh !== "object" || roh === null || Array.isArray(roh)) {
    return undefined;
  }
  const r = roh as Record<string, unknown>;
  for (const feld of NEGATIVWISSEN_TEXTFELDER) {
    const wert = text(r[feld]);
    if (wert !== undefined && wert.length > NEGATIVWISSEN_LIMITS.text) {
      return `negativwissen.${feld} ist ${wert.length} Zeichen lang — höchstens ${NEGATIVWISSEN_LIMITS.text} sind erlaubt.`;
    }
  }
  const warnsignale = warnsignaleVon(r.earlyWarningSigns);
  if (warnsignale.length > NEGATIVWISSEN_LIMITS.warnsignale) {
    return `negativwissen.earlyWarningSigns nennt ${warnsignale.length} Warnsignale — höchstens ${NEGATIVWISSEN_LIMITS.warnsignale} sind erlaubt.`;
  }
  const zuLang = warnsignale.find((w) => w.length > NEGATIVWISSEN_LIMITS.warnsignal);
  if (zuLang !== undefined) {
    return `Ein Warnsignal ist ${zuLang.length} Zeichen lang — höchstens ${NEGATIVWISSEN_LIMITS.warnsignal} sind erlaubt.`;
  }
  return undefined;
}

/**
 * Bringt eine Eingabe in die Normalform — oder liefert `undefined`, wenn sie nichts trägt.
 *
 * Typ-tolerant wie die übrigen Persistenzgrenzen dieses Projekts: falscher Container ⇒ Feld fällt
 * weg, unbekannte Bezüge werden verworfen (nicht geraten). Es wird NICHTS gekürzt (BEN, Nacharbeit
 * 2): die Obergrenzen prüft `negativwissenGrenzfehler` an den Schreibrändern und weist ab. Eine
 * Angabe ohne jeden Inhalt wird nicht abgelegt, damit „nicht geführt erfasst" von „leer erfasst"
 * nicht zu unterscheiden sein muss.
 */
export function normalizeNegativwissen(roh: unknown): NegativwissenAngaben | undefined {
  if (typeof roh !== "object" || roh === null || Array.isArray(roh)) {
    return undefined;
  }
  const r = roh as Record<string, unknown>;
  const angaben: NegativwissenAngaben = { earlyWarningSigns: [], bezug: [] };
  for (const feld of NEGATIVWISSEN_TEXTFELDER) {
    const wert = text(r[feld]);
    if (wert !== undefined) {
      angaben[feld] = wert;
    }
  }
  angaben.earlyWarningSigns = warnsignaleVon(r.earlyWarningSigns);
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
