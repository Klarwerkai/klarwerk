import { api } from "./client";
import type { DatenpunktSicht, Ort } from "./praesentationDaten";

export interface ErgaenzungsSuche {
  ort: Ort;
  luecke: {
    zeitraum: string;
    einheit: string;
    waehrung: string;
    bezugsgroesse: string;
    verwendung: "beobachtet" | "prognose";
  };
  quellArtikelIds: string[];
}
export interface ErgaenzungsVorschau {
  offen: boolean;
  gruende: string[];
  alt: string;
  zielFassung: number;
  dateiFassung: string;
  kandidaten: {
    datenpunkt: DatenpunktSicht;
    passend: boolean;
    gruende: string[];
    neu: string;
    token: string;
  }[];
}
export interface ErgaenzungsErgebnis {
  datenpunktId: string;
  bindung: "gespeichert";
  dokument: { neueFassung: number; ruecknahme?: { ausFassung: number; moeglich: boolean } };
}
const pfad = (ko: string, anhang: string) =>
  `/kos/${encodeURIComponent(ko)}/office/${encodeURIComponent(anhang)}/ergaenzung`;
export const praesentationErgaenzung = {
  vorschau: (ko: string, suche: ErgaenzungsSuche) =>
    api.post<ErgaenzungsVorschau>(`${pfad(ko, suche.ort.anhangId)}/vorschau`, suche),
  uebernehmen: (ko: string, suche: ErgaenzungsSuche, kandidatId: string, token: string) =>
    api.post<ErgaenzungsErgebnis>(`${pfad(ko, suche.ort.anhangId)}/uebernehmen`, {
      ...suche,
      kandidatId,
      token,
    }),
};
