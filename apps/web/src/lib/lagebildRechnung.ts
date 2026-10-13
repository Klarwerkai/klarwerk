// produkt:20261013:lagebild-reale-werte-eingabe — DIE WISSENSBEWERTUNG MIT REALEN EINGANGSWERTEN.
//
// Reine, DOM-freie Einordnung. Gerechnet wird mit DERSELBEN Formel wie die Beispielrechnung
// (`estimateValuation`, knowledgeValuation.ts) — hier entsteht keine zweite Bewertung. Neu ist nur,
// WANN gerechnet wird: fehlt ein Eingangswert oder gibt es im Bereich keine validierten Objekte, gibt
// es keinen Geldwert, sondern die konkreten Gründe (LWE-04). Nichts wird mit Beispielwerten ergänzt.
import type { LagebildBereich, LagebildFeld, LagebildWerte } from "../api/types";
import { estimateValuation } from "./knowledgeValuation";

export const LAGEBILD_FELDER: readonly LagebildFeld[] = [
  "hourlyRate",
  "hoursSavedPerValidatedKo",
  "reuseFactor",
];

export type LagebildGrund =
  | "keine_werte"
  | "fehlt_hourlyRate"
  | "fehlt_hoursSavedPerValidatedKo"
  | "fehlt_reuseFactor"
  | "keine_validierten_objekte";

/**
 * `eigene_annahme`: mindestens ein Wert ist eine eigene Eingabe. `angegebene_messung`: alle drei
 * sind als gemessen angegeben (mit Beleg) — auch das ist nur die Angabe einer Person, kein
 * unabhängiger Wirkungsnachweis (LWE-05).
 */
export type LagebildArt = "eigene_annahme" | "angegebene_messung";

export type LagebildRechnung =
  | {
      zustand: "berechnet";
      estimateEur: number;
      perKoEur: number;
      formula: string;
      art: LagebildArt;
      /** Zusatzaufwand überwiegt: negative Entlastung, bleibt so stehen (P13-AC07). */
      negativ: boolean;
    }
  | { zustand: "nicht_berechenbar"; gruende: LagebildGrund[] };

export function lagebildRechnung(
  fakten: LagebildBereich["fakten"],
  werte: LagebildWerte | null,
): LagebildRechnung {
  if (!werte) {
    return { zustand: "nicht_berechenbar", gruende: ["keine_werte"] };
  }
  const gruende: LagebildGrund[] = [];
  for (const feld of LAGEBILD_FELDER) {
    if (!werte.werte[feld]) {
      gruende.push(`fehlt_${feld}` as LagebildGrund);
    }
  }
  // Ohne validierte Objekte gibt es keine Grundlage — eine 0 € sähe wie ein Ergebnis aus.
  if (fakten.validatedKos <= 0) {
    gruende.push("keine_validierten_objekte");
  }
  const { hourlyRate, hoursSavedPerValidatedKo, reuseFactor } = werte.werte;
  if (gruende.length > 0 || !hourlyRate || !hoursSavedPerValidatedKo || !reuseFactor) {
    return { zustand: "nicht_berechenbar", gruende };
  }
  const ergebnis = estimateValuation(fakten, {
    hourlyRate: hourlyRate.wert,
    hoursSavedPerValidatedKo: hoursSavedPerValidatedKo.wert,
    reuseFactor: reuseFactor.wert,
  });
  const alleGemessen = [hourlyRate, hoursSavedPerValidatedKo, reuseFactor].every(
    (w) => w.herkunft === "gemessen",
  );
  return {
    zustand: "berechnet",
    estimateEur: ergebnis.estimateEur,
    perKoEur: ergebnis.perKoEur,
    formula: ergebnis.formula,
    art: alleGemessen ? "angegebene_messung" : "eigene_annahme",
    negativ: ergebnis.estimateEur < 0,
  };
}

export interface LagebildFormFeld {
  wert: string;
  herkunft: "eigene_eingabe" | "gemessen";
  beleg: string;
}

export interface LagebildForm {
  zeitraumVon: string;
  zeitraumBis: string;
  felder: Record<LagebildFeld, LagebildFormFeld>;
}

/** Das Formular aus dem gespeicherten Stand — ohne Stand LEER, nie mit Beispielwerten vorbelegt. */
export function formAusWerten(werte: LagebildWerte | null): LagebildForm {
  const felder = {} as Record<LagebildFeld, LagebildFormFeld>;
  for (const feld of LAGEBILD_FELDER) {
    const w = werte?.werte[feld] ?? null;
    felder[feld] = {
      wert: w ? String(w.wert).replace(".", ",") : "",
      herkunft: w?.herkunft ?? "eigene_eingabe",
      beleg: w?.beleg ?? "",
    };
  }
  return {
    zeitraumVon: werte?.zeitraumVon ?? "",
    zeitraumBis: werte?.zeitraumBis ?? "",
    felder,
  };
}

/**
 * Liest eine Zahl aus dem Formular. Leer = nicht erfasst (`null`); Komma oder Punkt als
 * Dezimalzeichen. `undefined` = keine Zahl — das Formular meldet es, statt `null` zu senden
 * (ein `NaN` würde in JSON still zu `null` und damit zu „nicht erfasst").
 */
export function zahlAusText(text: string): number | null | undefined {
  const roh = text.trim().replace(",", ".");
  if (roh === "") {
    return null;
  }
  if (!/^-?\d+(\.\d+)?$/.test(roh)) {
    return undefined;
  }
  return Number(roh);
}
