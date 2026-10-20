import { api } from "./client";

export const NORM_ARTEN = [
  "angekuendigt",
  "veroeffentlicht",
  "inkrafttreten",
  "uebergangsfrist",
] as const;
export type NormArt = (typeof NORM_ARTEN)[number];
export interface NormFundstelle {
  von: number;
  bis: number;
  wortlaut: string;
}
export interface NormBeleg {
  id: string;
  umfang: "begrenzte_bekanntmachung";
  quelle: { art: string; id: string; fassung: string; belegId: string };
  norm: NormFundstelle;
  ereignis: NormFundstelle;
  geltung: NormFundstelle | null;
  datum: string | null;
  klaerung: string[];
  aktuell: boolean;
  widerspruch: boolean;
}
export interface NormEreignis {
  id: string;
  art: NormArt;
  datum: string | null;
  geltung: string | null;
  belege: NormBeleg[];
  zuerstGelesenAm: string;
  pruefVorgang: string;
}
export interface NormZiel {
  koId: string;
  fassung: number;
}
export interface NormAnnahme {
  id: string;
  geltung: string;
  begruendung: string;
  entschiedenVon: string;
  entschiedenName: string | null;
  entschiedenAm: string;
  bisher: NormZiel;
  nachfolger: NormZiel;
}
export interface Normgeschichte {
  id: string;
  kennung: string;
  ausgabe: string;
  ereignisse: NormEreignis[];
  annahmen: NormAnnahme[];
  widerspruch: boolean;
}
export interface NormStand {
  fassung: number;
  normen: Normgeschichte[];
  fachannahmeErlaubt: boolean;
}
export interface NormVorschau {
  ereignisse: {
    normId: string;
    kennung: string;
    ausgabe: string;
    ereignis: NormEreignis;
    klaerung: string[];
    betroffen: {
      koId: string;
      titel: string;
      fassung: number;
      grund: { art: "gespeicherte_normzuordnung"; referenz: string };
    }[];
  }[];
  ungeprueft: { quelleId: string; hinweis: string }[];
  wirkung: "keine";
}
export interface NormFachoption {
  koId: string;
  titel: string;
  fassung: number;
  aktuell: boolean;
}
export interface NormFassung {
  koId: string;
  fassung: number;
  titel: string;
  aussage: string;
  freigegebenAm: string;
}
const BASIS = "/me/klara/normereignisse";
const pfad = (id: string) => `${BASIS}/${encodeURIComponent(id)}`;
export const klaraNormApi = {
  lesen: () => api.get<NormStand>(BASIS),
  fachfassung: (id: string, ziel: NormZiel) =>
    api.get<NormFassung>(`${pfad(id)}/fassungen/${encodeURIComponent(ziel.koId)}/${ziel.fassung}`),
  vorschau: (quellen: string[]) =>
    api.post<NormVorschau>(`${BASIS}/vorschau`, { quellen, bekanntmachungErlaubt: true }),
  erfassen: (quellen: string[]) =>
    api.post<NormStand & { ungeprueft: NormVorschau["ungeprueft"] }>(`${BASIS}/erfassen`, {
      quellen,
      bekanntmachungErlaubt: true,
    }),
  fachoptionen: (id: string) =>
    api.get<{ fassungen: NormFachoption[] }>(`${pfad(id)}/fachoptionen`),
  annehmen: (
    id: string,
    eingabe: {
      fassung: number;
      bisher: NormZiel;
      nachfolger: NormZiel;
      geltung: string;
      begruendung: string;
      bestaetigt: true;
    },
  ) =>
    api.post<{ fassung: number; annahme: NormAnnahme; wiederholt: boolean }>(
      `${pfad(id)}/annahme`,
      eingabe,
    ),
};
