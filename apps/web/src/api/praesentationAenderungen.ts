import { api } from "./client";
import type { DatenpunktSicht, FolienDatenLage, Korrekturauftrag } from "./praesentationDaten";

export interface AenderungsVorschau {
  art: "vorschau";
  gespeichert: false;
  abdruck: string;
  aenderungen: {
    vorher: DatenpunktSicht;
    nachher: DatenpunktSicht;
    ausloeser: "ausdruecklich" | "eingabe";
  }[];
  wirkungen: {
    datenpunktId: string;
    bindungId: string;
    koId: string;
    anhangId: string;
    sldId: string;
    shapeId: string;
    folienPosition: number;
    elementName: string;
    zeile?: number;
    spalte?: number;
    vorher: string;
    nachher: string;
    lage: "vorschau" | "bereits_aktuell" | "konflikt";
    grund: string;
  }[];
  konflikte: { datenpunktId: string; grund: string }[];
  uebernahme: { verfuegbar: false; grund: string };
  grenzen: string[];
}

export function ladeAenderungsVorschau(
  lage: FolienDatenLage,
  id: string,
  korrektur: Korrekturauftrag,
) {
  const { fassung, ...inhalt } = korrektur;
  return api.post<AenderungsVorschau>(
    `/kos/${encodeURIComponent(lage.koId)}/office/${encodeURIComponent(lage.anhangId)}/aenderungsvorschau`,
    {
      dateiFassung: lage.dateiFassung,
      artikelFassung: lage.artikelFassung,
      aenderungen: [{ datenpunktId: id, fassung, korrektur: inhalt }],
    },
  );
}
