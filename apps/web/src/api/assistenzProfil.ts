// produkt:20261010:assistenz-name-avatar — der Drahtvertrag des eigenen Assistenzprofils
// (Spiegel von `services/app/src/routes/assistenz-profil-routes.ts`). Das Konto bestimmt allein die
// Sitzung; der Client schickt nie eine Kontokennung mit.
import { api } from "./client";

export type AssistenzBewegung = "standard" | "reduziert";

export interface AssistenzProfilDaten {
  name: string | null;
  avatar: string | null;
  bewegung: AssistenzBewegung;
  eingerichtetAm: string | null;
  fassung: number;
  geaendertAm: string;
}

export interface AssistenzProfilAntwort {
  profil: AssistenzProfilDaten | null;
  einrichtungOffen: boolean;
}

export interface AssistenzProfilAenderung {
  name?: string;
  avatar?: string;
  bewegung?: AssistenzBewegung;
  einrichtungAbschliessen?: boolean;
  /** Die zuletzt bestätigte Fassung (0 ohne Profil) — schützt vor stillem Überschreiben. */
  fassung: number;
}

export const assistenzProfilApi = {
  lesen: (): Promise<AssistenzProfilAntwort> => api.get<AssistenzProfilAntwort>("/me/assistenz"),
  speichern: (aenderung: AssistenzProfilAenderung): Promise<AssistenzProfilAntwort> =>
    api.put<AssistenzProfilAntwort>("/me/assistenz", aenderung),
};
