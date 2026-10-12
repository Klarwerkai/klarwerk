// ================================================================================================
// produkt:20261009:referenzki-pruefdienst (REF-02, K10, Ben nacharbeit-10) — KOSTEN EINES VORHANDENEN
// BEOBACHTUNGSBERICHTS NACH EINER DATIERTEN TARIFQUELLE, OHNE NEUEN MODELLLAUF.
// ================================================================================================
//
// Eingabe: das Laufprotokoll eines Berichts (`beobachtung.json`) und eine Tarifquelle mit Herkunft
// (`quelle`, `abgerufenAm`) in der Preisform des Produkts (`KLARWERK_KI_PREISLISTE`). Ohne Herkunft
// wird nicht gerechnet: ein Preis ohne datierte Quelle ist kein Tarifnachweis.
//
// Versuche mit Modell, aber ohne gemeldeten Verbrauch (z. B. am Zeitlimit abgebrochen), gehen NICHT
// in die Summe ein. Sie stehen getrennt als „unbekannt" — weder als 0 noch als angenommene Obergrenze.
import { type Preisliste, lesePreisliste } from "../../services/model-runs";

export interface Tarifquelle {
  quelle: string;
  abgerufenAm: string;
  preisliste: unknown;
}

interface Versuch {
  model: string | null;
  verbrauch: { eingabeToken: number; ausgabeToken: number } | null;
}

export interface BerichtLauf {
  task: string;
  status: string;
  model: string | null;
  startedAt: string;
  versuche: Versuch[];
}

export type Kostenauswertung =
  | { ok: false; grund: string }
  | {
      ok: true;
      quelle: string;
      abgerufenAm: string;
      waehrung: string;
      preisstand: string;
      versuche: {
        startedAt: string;
        model: string;
        eingabeToken: number;
        ausgabeToken: number;
        betrag: number;
      }[];
      summeGemeldet: { eingabeToken: number; ausgabeToken: number; betrag: number };
      unbekannt: { startedAt: string; model: string; status: string }[];
      vollstaendig: boolean;
    };

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

function runde(betrag: number): number {
  return Math.round(betrag * 1e6) / 1e6;
}

/** Wertet die Prüfläufe (`task: "referenz"`) eines vorhandenen Berichts nach der Tarifquelle aus. */
export function werteKostenAus(
  laufprotokoll: readonly BerichtLauf[],
  tarif: Tarifquelle,
): Kostenauswertung {
  if (!tarif.quelle?.trim() || !DATUM.test(tarif.abgerufenAm ?? "")) {
    return { ok: false, grund: "Tarifquelle braucht `quelle` und `abgerufenAm` (JJJJ-MM-TT)." };
  }
  const lesung = lesePreisliste(JSON.stringify(tarif.preisliste));
  if (!lesung.preisliste) {
    return { ok: false, grund: lesung.fehler ?? "Keine Preisliste." };
  }
  const liste: Preisliste = lesung.preisliste;
  const versuche = [];
  const unbekannt = [];
  for (const lauf of laufprotokoll.filter((l) => l.task === "referenz")) {
    for (const v of lauf.versuche) {
      if (v.model === null) {
        continue;
      }
      if (v.verbrauch === null) {
        unbekannt.push({ startedAt: lauf.startedAt, model: v.model, status: lauf.status });
        continue;
      }
      const preis = Object.hasOwn(liste.modelle, v.model) ? liste.modelle[v.model] : undefined;
      if (!preis) {
        return { ok: false, grund: `Kein Preis für ${v.model} in der Tarifquelle.` };
      }
      versuche.push({
        startedAt: lauf.startedAt,
        model: v.model,
        eingabeToken: v.verbrauch.eingabeToken,
        ausgabeToken: v.verbrauch.ausgabeToken,
        betrag: runde(
          (v.verbrauch.eingabeToken * preis.eingabeJeMillion +
            v.verbrauch.ausgabeToken * preis.ausgabeJeMillion) /
            1_000_000,
        ),
      });
    }
  }
  const summe = versuche.reduce(
    (s, v) => ({
      eingabeToken: s.eingabeToken + v.eingabeToken,
      ausgabeToken: s.ausgabeToken + v.ausgabeToken,
      betrag: s.betrag + v.betrag,
    }),
    { eingabeToken: 0, ausgabeToken: 0, betrag: 0 },
  );
  return {
    ok: true,
    quelle: tarif.quelle.trim(),
    abgerufenAm: tarif.abgerufenAm,
    waehrung: liste.waehrung,
    preisstand: liste.preisstand,
    versuche,
    summeGemeldet: { ...summe, betrag: runde(summe.betrag) },
    unbekannt,
    vollstaendig: unbekannt.length === 0,
  };
}
