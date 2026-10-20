// produkt:20261011:assistenz-programmadapter (BPA-04) — der Drahtvertrag der Fähigkeitsübersicht
// (Spiegel von `services/app/src/routes/programmadapter-routes.ts`) und des Übergabecodes für den
// Mac-Begleiter (bestehender Weg `POST /api/auth/office-handover` — keine zweite Anmeldung).
import { api } from "./client";

export type Faehigkeit = "lesen" | "auswahl" | "schreiben" | "ergebnispruefung" | "ruecknahme";

export type FaehigkeitsStand =
  | "real-belegt"
  | "gebaut-ohne-hostbeleg"
  | "nicht-geliefert"
  | "ausgeschlossen";

export interface ProgrammSicht {
  programm: string;
  anzeigename: string;
  plattform: string;
  weg: "office-js" | "datei-auswahl" | "bedienungshilfe" | "keiner";
  mindestfassung: string | null;
  os: { unterstuetzt: string | null; realGeprueft: string | null };
  geliefert: boolean;
  faehigkeiten: Record<Faehigkeit, { stand: FaehigkeitsStand; grenze: string }>;
  bedienungshilfeLesen: FaehigkeitsStand | null;
  grenzen: string[];
}

export interface ProgrammeAntwort {
  programme: ProgrammSicht[];
  alleProgramme: false;
  nichtAufgefuehrt: string;
}

export interface BegleiterCode {
  code: string;
  expiresInMs: number;
}

export const programmeApi = {
  lesen: (): Promise<ProgrammeAntwort> => api.get<ProgrammeAntwort>("/klara/programme"),
  begleiterCode: (): Promise<BegleiterCode> => api.post<BegleiterCode>("/auth/office-handover", {}),
};
