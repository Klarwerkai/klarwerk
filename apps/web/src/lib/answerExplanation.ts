// ================================================================================================
// R-0293 / R-0276 — DER WEG ZUR ANTWORT, ALS ANZEIGE ABGELEITET. DOM-FREI.
// ================================================================================================
//
// WOZU DIESE DATEI. Der Server liefert den gespeicherten Antwortbeleg samt heutigem Lesezustand
// (`GET /api/klara/answers/:answerId/explanation`, services/ask/src/answer-explanation.ts). Was die
// Fläche daraus SAGT — ist die Antwort vollständig geprüft, ist ein Widerspruch offen, warum löst
// der Hauptbeleg nicht auf —, steht hier EINMAL und ohne React, damit es ohne Browser prüfbar ist.
//
// WAS HIER AUSDRÜCKLICH NICHT GESCHIEHT: keine Neusuche, kein Nachschlagen, keine eigene Rechte-
// entscheidung. Die Fläche erzählt, was der Server über den Beleg sagt — sie ergänzt ihn nicht.
import type { AnswerExplanationResponse, AnswerPrimaryResolutionFailure } from "../api/types";

type OkErklaerung = Extract<AnswerExplanationResponse, { state: "OK" }>;

/** Drei Antworten auf eine Ja/Nein-Frage: ja, nein — und ehrlich „unbekannt". */
export type Dreiwertig = "ja" | "nein" | "unbekannt";

type GrundTexte = Readonly<Record<AnswerPrimaryResolutionFailure, string>>;

/** R-0276: der Textschlüssel je Grund — genau fünf, ein geschlossener Wertebereich. */
export const AUFLOESUNGSGRUND_SCHLUESSEL: GrundTexte = {
  UNKNOWN_REFERENCE: "antwortweg.grund.unbekannt",
  UNRESOLVABLE_REFERENCE: "antwortweg.grund.technisch",
  DAMAGED_REFERENCE: "antwortweg.grund.beschaedigt",
  ACCESS_DENIED: "antwortweg.grund.keinRecht",
  REDACTION_REQUIRED: "antwortweg.grund.geschwaerzt",
};

export interface AntwortwegLage {
  /** Sind die tragenden Quellen vollständig geprüft (Freigabeentscheidung je Quelle gebunden)? */
  readonly geprueft: Dreiwertig;
  /** Ist heute ein Widerspruch zu einer tragenden Quelle offen? */
  readonly widerspruch: Dreiwertig;
  /** Der Textschlüssel des Auflösungsgrundes — oder `null`, wenn der Hauptbeleg auflöst. */
  readonly grundSchluessel: string | null;
  /**
   * Der Beleg ist entwertet, und der Server nennt KEINEN der fünf Gründe. Das ist die Regel
   * „Fehlt der Grund, gilt der Beleg als entwertet" (R-0276) — die Fläche sagt das so und rät
   * keinen Grund dazu.
   */
  readonly entwertetOhneGrund: boolean;
}

function dreiwertig(wert: boolean | null): Dreiwertig {
  if (wert === null) {
    return "unbekannt";
  }
  return wert ? "ja" : "nein";
}

export function antwortwegLage(erklaerung: OkErklaerung): AntwortwegLage {
  const grund = erklaerung.primaryResolutionFailure;
  // Ein Wert, den diese Fassung der Fläche nicht kennt, ist kein Grund — er fällt auf dieselbe
  // Auskunft wie ein fehlender (fail-closed, KW-W3-22).
  const grundSchluessel = grund === null ? null : (AUFLOESUNGSGRUND_SCHLUESSEL[grund] ?? null);
  return {
    geprueft: dreiwertig(erklaerung.carryingSourcesValidated),
    widerspruch: dreiwertig(erklaerung.openConflictToday),
    grundSchluessel,
    entwertetOhneGrund: erklaerung.integrity === "INVALIDATED" && grundSchluessel === null,
  };
}
