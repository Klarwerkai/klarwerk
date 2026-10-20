// Klara PowerPoint · PP-02 — der Draht zu `services/app/src/routes/praesentation-daten-routes.ts`.
//
// Die Gestalt ist die des Servers (`services/app/src/praesentation-daten.ts`, `DatenpunktSicht`); sie
// steht hier ein zweites Mal, weil die Web-App keine Servertypen importiert. Geändert wird beides
// gemeinsam.
// PP-03: die Kontrollen stehen als Gestalt bei ihrer Fläche (`DatenKontrolle.tsx`).
import type { DatenkontrolleSicht, DatenlageSicht } from "../components/bibliothek/DatenKontrolle";
import { ApiError, api } from "./client";

export type Erfassung = "direkt" | "ocr" | "manuell" | "berechnet" | "prognose";
export type Dimension =
  | "erkennung"
  | "struktur"
  | "berechnung"
  | "konsistenz"
  | "aktualitaet"
  | "fachliche_freigabe";
export type DimensionsStand = "bestanden" | "klaerung" | "offen" | "ueberholt" | "nicht_zutreffend";
export type Zustand = "erfasst" | "in_pruefung" | "klaerung" | "validiert" | "ueberpruefung_noetig";
export type Berechnungsart = "summe" | "differenz" | "anteil_prozent";
export type Bindungslage =
  | "aktuell"
  | "bestaetigt_in_neuer_fassung"
  | "abweichung"
  | "element_fehlt"
  | "anhang_fehlt";

export const DIMENSIONEN: readonly Dimension[] = [
  "erkennung",
  "struktur",
  "berechnung",
  "konsistenz",
  "aktualitaet",
  "fachliche_freigabe",
];

export interface Tabellenzelle {
  zeile: number;
  spalte: number;
  text: string;
}

export interface FolienElement {
  shapeId: string;
  name: string;
  art: "text" | "tabelle" | "bild";
  text: string;
  zellen?: Tabellenzelle[];
  bild?: { kennung: string; bildAufFolie: number };
}

export interface FolieMitElementen {
  sldId: string;
  position: number;
  titel: string;
  ausgeblendet: boolean;
  elemente: FolienElement[];
}

export type Fundstelle =
  | {
      art: "folienelement";
      sldId: string;
      shapeId: string;
      folienPosition: number;
      folienTitel: string;
      elementName: string;
      zitat: string;
    }
  | {
      art: "tabellenzelle";
      sldId: string;
      shapeId: string;
      folienPosition: number;
      folienTitel: string;
      elementName: string;
      zeile: number;
      spalte: number;
      zeilenkopf: string;
      spaltenkopf: string;
      zitat: string;
    }
  | {
      art: "bild";
      sldId: string;
      shapeId: string;
      folienPosition: number;
      folienTitel: string;
      elementName: string;
      bildKennung: string;
      ocrText: string;
      unsicher: boolean;
    }
  | { art: "artikel"; zitat: string }
  | { art: "eingabe"; beleg?: string }
  | { art: "rechenweg" };

export interface Pruefung {
  id: string;
  dimension: Dimension;
  ergebnis: "bestanden" | "klaerung";
  grund: string;
  von: string;
  name?: string;
  am: string;
  datenFassung: number;
}

export interface DimensionsBefund {
  dimension: Dimension;
  stand: DimensionsStand;
  grund: string;
  pruefung?: Pruefung;
}

export interface Pruefstand {
  zustand: Zustand;
  grund: string;
  naechsteArbeit: string[];
  datenFassung: number;
  erforderlich: Dimension[];
  dimensionen: DimensionsBefund[];
  prognose: boolean;
}

export interface BindungsSicht {
  id: string;
  koId: string;
  anhangId: string;
  anhangName?: string;
  sldId: string;
  shapeId: string;
  zeile?: number;
  spalte?: number;
  folienPosition: number;
  folienTitel: string;
  elementName: string;
  datenFassung: number;
  am: string;
  lage: Bindungslage;
  heute?: string;
}

export type QuellenSicht =
  | { lesbar: false }
  | {
      lesbar: true;
      koId: string;
      titel: string;
      koFassung: number;
      aktuelleFassung: number;
      anhangId?: string;
      anhangName?: string;
      objectId?: string;
      dateiFassung?: string;
    };

export type EingabeSicht =
  | { lesbar: false; verwendet: { fassung: number } }
  | {
      lesbar: true;
      verwendet: { datenpunktId: string; fassung: number; wert: string; zahl: number };
      /** Die Eingabe in der verwendeten Fassung (damalige Quelle und Eingaben). */
      datenpunkt: DatenpunktSicht;
      /** Ihr heutiger Stand. */
      aktuell: { fassung: number; wert: string };
    };

export interface Korrektur {
  fassung: number;
  felder: string[];
  vorher: Record<string, unknown>;
  grund: string;
  von: string;
  name?: string;
  am: string;
}

export interface DatenpunktSicht {
  id: string;
  heimatKoId: string;
  fassung: number;
  art: "zahl" | "aussage";
  wert: string;
  zahl?: number;
  einheit?: string;
  waehrung?: string;
  zeitraum?: string;
  bezugsgroesse?: string;
  erfassung: Erfassung;
  quelle: QuellenSicht | null;
  fundstelle: Fundstelle;
  rechenweg: {
    art: Berechnungsart;
    formel: string;
    stellen: number;
    roh: number;
    ergebnis: number;
    eingaben: EingabeSicht[];
  } | null;
  annahmen: string[];
  modellbezug?: string;
  erfasstVon: { id: string; name?: string };
  erfasstAm: string;
  korrekturen: Korrektur[];
  pruefungen: Pruefung[];
  pruefstand: Pruefstand;
  bindungen: BindungsSicht[];
  schutzstufe: "intern" | "vertraulich" | "streng_vertraulich";
  /** Gesetzt, wenn eine frühere Datenfassung gezeigt wird. */
  historisch?: { aktuelleFassung: number };
  /**
   * PP-03: die Kontrollen der AKTUELLEN Datenfassung über dem Prüfstand
   * (`services/app/src/praesentation-pruefung.ts`). Fehlt bei einer früheren Fassung.
   */
  kontrolle?: DatenkontrolleSicht;
}

export interface FolienDatenLage {
  koId: string;
  anhangId: string;
  anhangName: string;
  objectId: string;
  artikelFassung: number;
  dateiFassung: string;
  folien: FolieMitElementen[];
  datenpunkte: DatenpunktSicht[];
  /** PP-03: Zustände und offene Punkte der lesbaren Datenpunkte dieser Präsentation. */
  datenlage?: DatenlageSicht;
  darfErfassen: boolean;
  darfFreigeben: boolean;
}

export interface Ort {
  anhangId: string;
  sldId: string;
  shapeId: string;
  zeile?: number;
  spalte?: number;
}

export interface Erfassungsauftrag {
  art: "zahl" | "aussage";
  wert: string;
  einheit?: string;
  waehrung?: string;
  zeitraum?: string;
  bezugsgroesse?: string;
  erfassung: Erfassung;
  ort?: Ort;
  ocr?: { text: string; bildKennung: string; unsicher: boolean };
  beleg?: string;
  rechenweg?: { art: Berechnungsart; eingaben: string[]; stellen: number };
  annahmen?: string[];
  modellbezug?: string;
}

export interface Korrekturauftrag {
  fassung: number;
  grund: string;
  wert?: string;
  einheit?: string | null;
  zeitraum?: string | null;
  bezugsgroesse?: string | null;
  neuBerechnen?: boolean;
  quelleAktualisieren?: boolean;
}

const enc = encodeURIComponent;

export const praesentationDaten = {
  lage: (koId: string, anhangId: string) =>
    api.get<FolienDatenLage>(`/kos/${enc(koId)}/office/${enc(anhangId)}/folien-daten`),
  /** Ohne `fassung` der aktuelle Stand, sonst die Herkunft genau dieser Datenfassung. */
  datenpunkt: (id: string, fassung?: number) =>
    api.get<DatenpunktSicht>(
      `/datenpunkte/${enc(id)}${fassung === undefined ? "" : `?fassung=${fassung}`}`,
    ),
  erfassen: (koId: string, auftrag: Erfassungsauftrag) =>
    api.post<DatenpunktSicht>(`/kos/${enc(koId)}/datenpunkte`, auftrag),
  binden: (id: string, koId: string, ort: Ort) =>
    api.post<DatenpunktSicht>(`/datenpunkte/${enc(id)}/bindungen`, { koId, ort }),
  pruefen: (
    id: string,
    pruefung: {
      dimension: Dimension;
      ergebnis: "bestanden" | "klaerung";
      grund?: string;
      fassung: number;
    },
  ) => api.post<DatenpunktSicht>(`/datenpunkte/${enc(id)}/pruefungen`, pruefung),
  korrigieren: (id: string, korrektur: Korrekturauftrag) =>
    api.post<DatenpunktSicht>(`/datenpunkte/${enc(id)}/korrektur`, korrektur),
};

/**
 * Was ein Fehler dem Nutzer sagt: ohne Recht bzw. unbekannt ein fester Textschlüssel (keine
 * Existenzauskunft), bei einer fachlichen Abweisung die Begründung des Servers („steht nicht in
 * diesem Element“, „Der Rechenweg ergibt …“). Unbekanntes wird nie als Erfolg gelesen.
 */
export function datenFehler(fehler: unknown): { schluessel: string; text?: string } {
  if (fehler instanceof ApiError) {
    if (fehler.status === 404 || fehler.status === 403) {
      return { schluessel: "praesentationdaten.fehler.keinRecht" };
    }
    if (fehler.message) {
      return { schluessel: "praesentationdaten.fehler.allgemein", text: fehler.message };
    }
  }
  return { schluessel: "praesentationdaten.fehler.allgemein" };
}
