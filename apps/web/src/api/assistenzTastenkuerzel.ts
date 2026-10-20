// produkt:20261012:klara-setup-shortcuts-umsetzung — der Drahtvertrag der Klara-Tastenkürzel
// (Spiegel von `services/app/src/routes/assistenz-profil-routes.ts`). Das Konto bestimmt allein die
// Sitzung; der Client schickt nie eine Kontokennung mit.
import { api } from "./client";

export type KlaraKuerzelAktion =
  | "oeffnen"
  | "seitenhilfe"
  | "diktieren"
  | "auftragSprechen"
  | "aufnahmeStoppen"
  | "vorlesenStoppen"
  | "suchen";

/** Dieselbe Reihenfolge wie am Server (`KLARA_KUERZEL_AKTIONEN`). */
export const KLARA_KUERZEL_AKTIONEN: readonly KlaraKuerzelAktion[] = [
  "oeffnen",
  "seitenhilfe",
  "diktieren",
  "auftragSprechen",
  "aufnahmeStoppen",
  "vorlesenStoppen",
  "suchen",
];

export interface KuerzelKombination {
  /** `KeyboardEvent.code` — die physische Taste. */
  code: string;
  /** Die Beschriftung der Taste, wie sie bei der Aufnahme gedrückt wurde. */
  taste: string;
  strg: boolean;
  alt: boolean;
  umschalt: boolean;
  meta: boolean;
}

export type KuerzelQuelle = "standard" | "eigen" | "entfernt";

export interface KuerzelEintrag {
  aktion: KlaraKuerzelAktion;
  belegung: KuerzelKombination | null;
  quelle: KuerzelQuelle;
}

export interface TastenkuerzelAntwort {
  aktionen: KuerzelEintrag[];
  geaendertAm: string | null;
}

export const tastenkuerzelApi = {
  lesen: (): Promise<TastenkuerzelAntwort> =>
    api.get<TastenkuerzelAntwort>("/me/assistenz/tastenkuerzel"),
  setzen: (
    aktion: KlaraKuerzelAktion,
    belegung: KuerzelKombination | null | "standard",
  ): Promise<TastenkuerzelAntwort> =>
    api.put<TastenkuerzelAntwort>("/me/assistenz/tastenkuerzel", { aktion, belegung }),
  alleZuruecksetzen: (): Promise<TastenkuerzelAntwort> =>
    api.put<TastenkuerzelAntwort>("/me/assistenz/tastenkuerzel", { alleZuruecksetzen: true }),
};
