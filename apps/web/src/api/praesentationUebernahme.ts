import { api } from "./client";
import type { AenderungsVorschau } from "./praesentationAenderungen";
import type { FolienDatenLage, Korrekturauftrag } from "./praesentationDaten";
export interface UebernahmeVorschau extends Omit<AenderungsVorschau, "uebernahme"> {
  vorschauId: string;
  expectedVersion: number;
  dateiFassung: string;
  dateiwirkungen: {
    sldId: string;
    shapeId: string;
    vorher: string;
    nachher: string;
    art: string;
  }[];
  dateikonflikte: { id: string; grund: string; sperrtUebernahme?: boolean }[];
  uebernahme: { verfuegbar: boolean; grund: string };
}
export interface UebernahmeErgebnis {
  zustand: string;
  fassung: number;
  status?: string;
  hinweis?: string;
  belegOffen?: boolean;
  konflikteOffen?: { grund: string }[];
  vorschauId?: string;
}
export interface FassungsStand {
  fassung: number;
  dateiFassung: string;
  uebernahme: null | {
    vorschauId: string;
    ruecknahmeMoeglich: boolean;
    konflikteOffen: { id: string; grund: string }[];
    punkte: {
      id: string;
      fassung: number;
      zustand: string;
      vorherWert?: string;
      aktuellWert?: string;
    }[];
  };
  fassungen: (
    | {
        verfuegbar: true;
        gemeinsam: { datenbasis: { id: string; fassung: number; aktuelleFassung: number }[] };
        kurz: { folien: string[] };
        ausfuehrlich: { folien: string[] };
        konflikte: { grund: string }[];
      }
    | { verfuegbar: false; grund: string }
  )[];
}
export interface FassungsDatei {
  objectId: string;
  name: string;
  tiefe: string;
  basis: string;
  wiederoeffnet: boolean;
}
const pfad = (ko: string, a: string) =>
  `/kos/${encodeURIComponent(ko)}/office/${encodeURIComponent(a)}/datenaktualisierung`;
export const praesentationUebernahme = {
  auftrag: (lage: FolienDatenLage, id: string, k: Korrekturauftrag) => {
    const { fassung, ...korrektur } = k;
    return {
      expectedVersion: lage.artikelFassung,
      dateiFassung: lage.dateiFassung,
      aenderungen: [{ datenpunktId: id, fassung, korrektur }],
    };
  },
  vorschau: (lage: FolienDatenLage, id: string, k: Korrekturauftrag) =>
    api.post<UebernahmeVorschau>(
      `${pfad(lage.koId, lage.anhangId)}/vorschau`,
      praesentationUebernahme.auftrag(lage, id, k),
    ),
  speichern: (
    lage: FolienDatenLage,
    id: string,
    k: Korrekturauftrag,
    v: UebernahmeVorschau,
    konflikte: string[],
  ) =>
    api.post<UebernahmeErgebnis>(`${pfad(lage.koId, lage.anhangId)}/uebernehmen`, {
      ...praesentationUebernahme.auftrag(lage, id, k),
      expectedVersion: v.expectedVersion,
      dateiFassung: v.dateiFassung,
      vorschauId: v.vorschauId,
      bestaetigteKonflikte: konflikte,
    }),
  stand: (ko: string, a: string) => api.get<FassungsStand>(`${pfad(ko, a)}/stand`),
  ruecknahme: (ko: string, a: string, d: FassungsStand) =>
    api.post<UebernahmeErgebnis>(`${pfad(ko, a)}/ruecknahme`, {
      expectedVersion: d.fassung,
      vorschauId: d.uebernahme?.vorschauId,
    }),
  fassungen: (ko: string, a: string, d: FassungsStand) =>
    api.post<{ zustand: string; dateien: FassungsDatei[]; hinweis: string }>(
      `${pfad(ko, a)}/fassungen`,
      { expectedVersion: d.fassung, dateiFassung: d.dateiFassung },
    ),
};
