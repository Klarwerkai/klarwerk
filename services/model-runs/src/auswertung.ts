import type { ModelRunRecord } from "./types";

// ================================================================================================
// Aufnahme gesamt-ki-laufprotokoll (V9, R-2071, Ben R1 B3/B5) — DIE AUSWERTUNG EINES ZEITRAUMS.
// ================================================================================================
//
// Grundlage der KI-Übersicht („was hat die KI in diesem Zeitraum getan, verbraucht und gekostet").
// Rein abgeleitet aus den Laufdatensätzen, nur Metadaten. Jede Summe steht mit ihrer Grundmenge da
// (dieselbe Regel wie an der Laufkarte): eine Kostensumme über 3 von 40 Läufen ist etwas anderes
// als eine über 40.
//
// KOSTEN JE WÄHRUNG: Läufe aus verschiedenen Preislisten können verschiedene Währungen tragen. Sie
// werden nie umgerechnet oder addiert — je Währung eine Summe.

/** Obergrenze der Läufe, über die eine Auswertung rechnet. Darüber: `gekappt: true`. */
export const MAX_AUSWERTUNG_LAEUFE = 10_000;

export interface ModelRunAufgabenWerte {
  laeufe: number;
  fehler: number;
  eingabeToken: number;
  ausgabeToken: number;
}

export interface ModelRunKostensumme {
  waehrung: string;
  betrag: number;
  /** Läufe, die zu dieser Summe beitragen. */
  laeufe: number;
}

export interface ModelRunAuswertung {
  von: string;
  bis: string;
  laeufe: number;
  erfolg: number;
  fehler: number;
  rueckfall: number;
  demo: number;
  jeAufgabe: Record<string, ModelRunAufgabenWerte>;
  dauerSummeMs: number;
  dauerGezaehlt: number;
  eingabeToken: number;
  ausgabeToken: number;
  verbrauchGezaehlt: number;
  kosten: ModelRunKostensumme[];
  /**
   * Läufe OHNE Kostennachweis, obwohl sie Verbrauch gemeldet oder ein Modell wirklich gerufen
   * haben (kein Preis hinterlegt, oder ein gerufenes Modell hat keinen Verbrauch gemeldet —
   * Ben R3 B3: unbekannter Verbrauch geht nicht still als kostenfrei ein).
   */
  verbrauchOhneKosten: number;
  /** true: der Zeitraum enthält mehr als MAX_AUSWERTUNG_LAEUFE Läufe; gerechnet wurde über die jüngsten. */
  gekappt: boolean;
}

function ganzzahlNichtNegativ(n: unknown): n is number {
  return Number.isSafeInteger(n) && (n as number) >= 0;
}

function runde(betrag: number): number {
  return Math.round(betrag * 1e6) / 1e6;
}

export function werteLaeufeAus(
  laeufe: readonly ModelRunRecord[],
  von: string,
  bis: string,
  gekappt: boolean,
): ModelRunAuswertung {
  const jeAufgabe: Record<string, ModelRunAufgabenWerte> = {};
  const kosten = new Map<string, ModelRunKostensumme>();
  let erfolg = 0;
  let fehler = 0;
  let rueckfall = 0;
  let demo = 0;
  let dauerSummeMs = 0;
  let dauerGezaehlt = 0;
  let eingabeToken = 0;
  let ausgabeToken = 0;
  let verbrauchGezaehlt = 0;
  let verbrauchOhneKosten = 0;
  for (const lauf of laeufe) {
    const aufgabe = jeAufgabe[lauf.task] ?? {
      laeufe: 0,
      fehler: 0,
      eingabeToken: 0,
      ausgabeToken: 0,
    };
    jeAufgabe[lauf.task] = aufgabe;
    aufgabe.laeufe += 1;
    if (lauf.status === "error") {
      fehler += 1;
      aufgabe.fehler += 1;
    } else {
      erfolg += 1;
    }
    if (lauf.fallback) rueckfall += 1;
    if (lauf.demo) demo += 1;
    const start = Date.parse(lauf.startedAt);
    const ende = Date.parse(lauf.finishedAt);
    if (!Number.isNaN(start) && !Number.isNaN(ende) && ende >= start) {
      dauerSummeMs += ende - start;
      dauerGezaehlt += 1;
    }
    const v = lauf.verbrauch;
    const verbrauchBrauchbar =
      v !== undefined &&
      ganzzahlNichtNegativ(v.eingabeToken) &&
      ganzzahlNichtNegativ(v.ausgabeToken);
    if (verbrauchBrauchbar) {
      eingabeToken += v.eingabeToken;
      ausgabeToken += v.ausgabeToken;
      aufgabe.eingabeToken += v.eingabeToken;
      aufgabe.ausgabeToken += v.ausgabeToken;
      verbrauchGezaehlt += 1;
    }
    const k = lauf.kosten;
    if (k && typeof k.waehrung === "string" && Number.isFinite(k.betrag) && k.betrag >= 0) {
      const summe = kosten.get(k.waehrung) ?? { waehrung: k.waehrung, betrag: 0, laeufe: 0 };
      summe.betrag = runde(summe.betrag + k.betrag);
      summe.laeufe += 1;
      kosten.set(k.waehrung, summe);
    } else if (verbrauchBrauchbar || lauf.versuche?.some((x) => x.model !== undefined)) {
      verbrauchOhneKosten += 1;
    }
  }
  return {
    von,
    bis,
    laeufe: laeufe.length,
    erfolg,
    fehler,
    rueckfall,
    demo,
    jeAufgabe,
    dauerSummeMs,
    dauerGezaehlt,
    eingabeToken,
    ausgabeToken,
    verbrauchGezaehlt,
    kosten: [...kosten.values()].sort((a, b) => a.waehrung.localeCompare(b.waehrung)),
    verbrauchOhneKosten,
    gekappt,
  };
}
