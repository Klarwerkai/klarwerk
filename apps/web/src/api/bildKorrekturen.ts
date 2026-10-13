// produkt:20261012:klara-ocr-fundstellen-korrekturen (OCR-E02) — der Drahtvertrag des berichtigten
// Bildtexts (Spiegel von `services/app/src/routes/assistenz-profil-routes.ts`). Das Konto bestimmt
// allein die Sitzung; der Client schickt nie eine Kontokennung mit.
import type { BildKorrekturDaten } from "../lib/bildKorrektur";
import { api } from "./client";

export type { BildKorrekturDaten };

export interface BildKorrekturAntwort {
  /** Darf dieses Konto berichtigen (`ko.create`)? Entscheidet der Server. */
  darfBearbeiten: boolean;
  korrekturen: BildKorrekturDaten[];
}

export type BildKorrekturAenderung =
  | { aktion: "setzen"; quelle: string; inhaltskennung: string; ort?: string; text: string }
  | { aktion: "rueckgaengig" | "zuruecksetzen"; quelle: string; inhaltskennung: string };

export const bildKorrekturApi = {
  lesen: (): Promise<BildKorrekturAntwort> =>
    api.get<BildKorrekturAntwort>("/me/assistenz/bildkorrekturen"),
  aendern: (aenderung: BildKorrekturAenderung): Promise<BildKorrekturAntwort> =>
    api.put<BildKorrekturAntwort>("/me/assistenz/bildkorrekturen", aenderung),
};
