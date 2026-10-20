export interface KlaraEinfuehrungStand {
  schritt: number;
  begleitung: "kurz" | "ausfuehrlich";
  zeitzone: string;
  abgeschlossen: boolean;
}
// produkt:20261010:assistenz-name-avatar — der Drahtvertrag des eigenen Assistenzprofils
// (Spiegel von `services/app/src/routes/assistenz-profil-routes.ts`). Das Konto bestimmt allein die
// Sitzung; der Client schickt nie eine Kontokennung mit.
import { api } from "./client";

export type AssistenzBewegung = "standard" | "reduziert";

export interface AssistenzProfilDaten {
  einfuehrung?: KlaraEinfuehrungStand;
  name: string | null;
  avatar: string | null;
  bewegung: AssistenzBewegung;
  eingerichtetAm: string | null;
  fassung: number;
  geaendertAm: string;
  /** OCR-03: nur nach bewusster Wahl vorhanden — sonst gilt die Voreinstellung „an“. */
  bildAutomatik?: boolean;
  /** PP-03: nur nach bewusster Wahl vorhanden — sonst gilt „alle“. */
  datenkontrolleOffenePunkte?: "alle" | "nur_klaerung";
}

export interface AssistenzProfilAntwort {
  profil: AssistenzProfilDaten | null;
  einrichtungOffen: boolean;
}

export interface AssistenzProfilAenderung {
  einfuehrung?: KlaraEinfuehrungStand;
  name?: string;
  avatar?: string;
  bewegung?: AssistenzBewegung;
  /** OCR-03: Setup › Klara „Bilder automatisch analysieren und Text erkennen“. */
  bildAutomatik?: boolean;
  /** PP-03: Setup › Klara „Offene Datenpunkte in der Datenlage“. */
  datenkontrolleOffenePunkte?: "alle" | "nur_klaerung";
  einrichtungAbschliessen?: boolean;
  /** Die zuletzt bestätigte Fassung (0 ohne Profil) — schützt vor stillem Überschreiben. */
  fassung: number;
}

export const assistenzProfilApi = {
  lesen: (): Promise<AssistenzProfilAntwort> => api.get<AssistenzProfilAntwort>("/me/assistenz"),
  speichern: (aenderung: AssistenzProfilAenderung): Promise<AssistenzProfilAntwort> =>
    api.put<AssistenzProfilAntwort>("/me/assistenz", aenderung),
};
