// produkt:20261013:produktbudget-anwender-admin — der Draht zu
// `services/app/src/routes/produktbudget-routes.ts`.
//
// Die Gestalt ist die des Servers (`services/app/src/produktbudget.ts`); sie steht hier ein zweites
// Mal, weil die Web-App keine Servertypen importiert. Geändert wird beides gemeinsam.
import { api } from "./client";

export type BudgetBereichId = "perplexity-poc" | "nr32-claude" | "nr32-chatgpt";
export type BudgetAnbieter = "perplexity" | "anthropic" | "openai";
export type BudgetWaehrung = "EUR" | "USD";
export type BudgetZeitraum = "einmalig" | "offen";
export type BudgetSperre = "zeitraum_offen" | "null_budget" | "ausgeschoepft";

export const BUDGET_WAEHRUNGEN: readonly BudgetWaehrung[] = ["EUR", "USD"];
export const BUDGET_ZEITRAEUME: readonly BudgetZeitraum[] = ["einmalig", "offen"];

export interface BudgetWerte {
  betragCent: number;
  waehrung: BudgetWaehrung;
  zeitraum: BudgetZeitraum;
}

export interface BudgetAenderung {
  aenderungId: string;
  bereich: BudgetBereichId;
  am: string;
  von: string;
  vorher: BudgetWerte;
  nachher: BudgetWerte;
  grund: string | null;
}

export interface BudgetBereich extends BudgetWerte {
  bereich: BudgetBereichId;
  fassung: number;
  geaendertAm: string | null;
  geaendertVon: string | null;
  anbieter: BudgetAnbieter;
  original: string;
  abgeloest: { betragCent: number; waehrung: BudgetWaehrung } | null;
  verbrauchtCent: number;
  reserviertCent: number;
  verbleibendCent: number;
  ueberschrittenCent: number;
  buchungen: number;
  sperre: BudgetSperre | null;
  letzteAenderungen: BudgetAenderung[];
  /** PBE-12: Konten mit Zuweisung, Unterlimit oder Belegung. Fehlt bei älteren Servern. */
  konten?: KontoSicht[];
}

export interface KontoSicht {
  konto: string;
  zuweisungCent: number | null;
  unterlimitCent: number | null;
  fassung: number;
  belegtCent: number;
  grenzeCent: number | null;
}

/** PBE-12: die eigene Sicht eines Kontos (`GET /api/me/produktbudget`). */
export interface EigenesBudget {
  bereich: BudgetBereichId;
  anbieter: BudgetAnbieter;
  betragCent: number;
  waehrung: BudgetWaehrung;
  zeitraum: BudgetZeitraum;
  sperre: BudgetSperre | null;
  gesamtVerbleibendCent: number;
  zuweisungCent: number;
  zuweisungGesetzt: boolean;
  unterlimitCent: number | null;
  belegtCent: number;
  eigenVerbleibendCent: number;
  fassung: number;
}

export interface EigeneBudgets {
  bereiche: EigenesBudget[];
  gelesenAm: string;
}

export const EIGENES_PRODUKTBUDGET_KEY = ["me", "produktbudget"] as const;

export interface Produktbudgetstand {
  bereiche: BudgetBereich[];
  gelesenAm: string;
}

export interface BudgetAenderungEingabe {
  betrag: string;
  waehrung: BudgetWaehrung;
  zeitraum: BudgetZeitraum;
  fassung: number;
  aenderungId: string;
  grund?: string;
}

export interface Aenderungsantwort {
  wiederholt: boolean;
  geaendert: boolean;
  /**
   * Die Fassung, die GENAU diese Änderung hergestellt hat. Der mitgelieferte Stand ist danach
   * gelesen und kann schon fremde Änderungen enthalten — Grundlage einer Folgeeingabe ist allein
   * diese Zahl. `null` nur bei Altvermerken ohne Grundfassung.
   */
  bestaetigteFassung: number | null;
}

export const PRODUKTBUDGET_KEY = ["admin", "produktbudget"] as const;

export const produktbudgetApi = {
  lies: () => api.get<Produktbudgetstand>("/admin/produktbudget"),
  /** 409 `CONFLICT` trägt in `details.stand` den aktuellen Stand; die Eingabe bleibt beim Aufrufer. */
  aendere: (bereich: BudgetBereichId, eingabe: BudgetAenderungEingabe) =>
    api.put<Produktbudgetstand & Aenderungsantwort>(
      `/admin/produktbudget/${encodeURIComponent(bereich)}`,
      eingabe,
    ),
  /** PBE-12: Zuweisung eines Kontos — nur Verwaltung. `zuweisung: null` hebt sie auf. */
  setzeZuweisung: (
    bereich: BudgetBereichId,
    konto: string,
    eingabe: { zuweisung: string | null; fassung: number },
  ) =>
    api.put<Produktbudgetstand>(
      `/admin/produktbudget/${encodeURIComponent(bereich)}/konten/${encodeURIComponent(konto)}`,
      eingabe,
    ),
  eigene: () => api.get<EigeneBudgets>("/me/produktbudget"),
  /** PBE-12: das eigene Unterlimit — höchstens die erlaubte Zuweisung. */
  setzeUnterlimit: (
    bereich: BudgetBereichId,
    eingabe: { unterlimit: string | null; fassung: number },
  ) => api.put<EigeneBudgets>(`/me/produktbudget/${encodeURIComponent(bereich)}`, eingabe),
};

/** Cent als Betragstext mit zwei Nachkommastellen — ganzzahlig gerechnet, ohne Gleitkomma. */
export function centAlsBetrag(cent: number, dezimal = ","): string {
  const ganz = Math.floor(cent / 100);
  const rest = String(cent % 100).padStart(2, "0");
  return `${ganz}${dezimal}${rest}`;
}
