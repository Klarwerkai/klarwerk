import type { Aenderung } from "./assistenz-lernen";

type VormachenHost = "word" | "klarwerk_web";

type VormachenVorgang =
  | "word_frage"
  | "word_auswahl_uebernehmen"
  | "word_dokument_uebernehmen"
  | "word_formulierung"
  | "seite_oeffnen"
  | "frage_stellen"
  | "entwurf_anlegen"
  | "entwurf_speichern"
  | "zur_pruefung_einreichen"
  | "quelle_lesen";

type VormachenAbbruchRegel = "alles_verwerfen" | "lernnotiz_behalten";

export type LernZustand = "lernt" | "pausiert" | "abgebrochen";

export interface Rohbeobachtung {
  readonly nr: number;
  readonly vorgang: VormachenVorgang;
  readonly beschreibung: string;
  /** Der mitgeschriebene Rohwert (etwa ein Titel). Verlässt die Lernsitzung nie. */
  readonly rohwert: string | null;
  /**
   * BPA-06: die gesetzten Felder eines angelegten Entwurfs mit Wert (Titel, Kernaussage,
   * Ordnungsangaben, Prüfer) — Rohdaten wie `rohwert`, nur für die Ableitung aus mehreren
   * Vorführungen. Verlassen die Lernsitzung nie und enden mit Bestätigung oder Abbruch.
   */
  readonly felder?: Readonly<Record<string, string>>;
  readonly am: string;
}

export interface LernKorrektur {
  readonly beschreibung?: string;
  readonly entfernt?: boolean;
}

export interface NichtAufgenommen {
  readonly host: number;
  readonly vorgang: number;
  readonly pausiert: number;
  /** Arbeitsweg des gewählten Hosts, aber ohne sichtbaren Lernzustand im beobachteten Client. */
  readonly unsichtbar: number;
}

export interface Lernsitzung {
  readonly id: string;
  readonly kontoId: string;
  readonly host: VormachenHost;
  readonly vorgaenge: readonly VormachenVorgang[];
  readonly zweck: string;
  readonly abbruchRegel: VormachenAbbruchRegel;
  readonly zustand: LernZustand;
  readonly beobachtungen: readonly Rohbeobachtung[];
  /** Je Beobachtungsnummer die Korrektur der Person — Teil der Lernnotiz. */
  readonly korrekturen: Readonly<Record<number, LernKorrektur>>;
  readonly nichtAufgenommen: NichtAufgenommen;
  /**
   * Rohdaten des Zielbezugs: welche Entwurfskennung in welchem Schritt entstand — damit ein späterer
   * Schritt „Entwurf aus Schritt n" sagen kann. Wird mit den Rohwerten entfernt.
   */
  readonly ziele: Readonly<Record<string, number>>;
  /** BPA-06: die Änderungen der Person an der Ableitung aus mehreren Vorführungen, in Folge. */
  readonly ableitungsAenderungen?: readonly Aenderung[];
  readonly angelegtAm: string;
  readonly geaendertAm: string;
  /** Bis wann Rohbeobachtungen höchstens bestehen (nach Abbruch: bis wann die Notiz besteht). */
  readonly verfallAm: string;
}
