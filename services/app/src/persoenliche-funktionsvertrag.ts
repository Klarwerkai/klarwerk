export type FunktionsArt = "favorit" | "vorschlag";

export type FunktionsStand = "vorschlag" | "aktiv" | "pausiert" | "deaktiviert";

export type Eingabeweg = "text" | "sprache";

export type ParameterName = "produkt" | "menge" | "termin" | "ansprechpartner" | "ausnahme";

export interface FunktionsParameter {
  readonly name: ParameterName;
  readonly bezeichnung: string;
  readonly pflicht: boolean;
  readonly hinweis: string;
}

/** Die Parameter des Beschaffungsablaufs — bei jedem Aufruf neu anzugeben, nie aus einem Lauf. */
export const BESCHAFFUNG_PARAMETER: readonly FunktionsParameter[] = [
  {
    name: "produkt",
    bezeichnung: "Produkt",
    pflicht: true,
    hinweis: "Welches Produkt bei diesem Aufruf angefragt wird.",
  },
  {
    name: "menge",
    bezeichnung: "Menge",
    pflicht: true,
    hinweis: "Menge mit Einheit; wird nie aus einem früheren Lauf übernommen.",
  },
  {
    name: "termin",
    bezeichnung: "Termin",
    pflicht: true,
    hinweis: "Gewünschter Angebots- oder Liefertermin.",
  },
  {
    name: "ansprechpartner",
    bezeichnung: "Ansprechpartner",
    pflicht: false,
    hinweis: "Ein Name hier ist kein Versandrecht; Empfänger prüft jeder Lauf neu.",
  },
  {
    name: "ausnahme",
    bezeichnung: "Einmalige Ausnahme",
    pflicht: false,
    hinweis: "Gilt nur für diesen Lauf und wird nicht Teil der Funktion.",
  },
];

/** Außenwirkungen sind getrennt geregelt (R05): Versand nur nach Bestätigung je Lauf, Kauf nie. */
export const AUSSENAKTIONEN = {
  anfrageVersand: "je_lauf_bestaetigen",
  nachfassen: "je_lauf_bestaetigen",
  bestellung: "ausgeschlossen",
  zahlung: "ausgeschlossen",
} as const;

export const QUELLENREGEL = {
  jedenLaufNeuLesen: true,
  nurGeltendeFassung: true,
  entwuerfeUndAnkuendigungenSindKeineFreigabe: true,
  lieferantenantwortenSindDaten: true,
} as const;

/**
 * Woraus die Funktion entstand: ein eigener Satz oder EIN Abschnitt eines Assistenzgesprächs —
 * gebunden an Gespräch, dessen Fassung und die Nachricht, mit der der Fall begann (`abschnitt`).
 */
export type FunktionsHerkunft =
  | { readonly art: "eingabe" }
  | {
      readonly art: "assistenzgespraech";
      readonly gespraechId: string;
      readonly gespraechFassung: number;
      readonly abschnitt: string;
    };

export interface FunktionsFassung {
  readonly version: number;
  readonly herkunft: FunktionsHerkunft;
  readonly name: string;
  readonly zweck: string;
  /** Die Produktgruppe aus dem Satz („Verpackung"); das konkrete Produkt ist ein Parameter. */
  readonly thema: string;
  readonly ablauf: "angebote_einholen";
  /** Der Ausgangssatz, Beispielwerte durch Platzhalter ersetzt. */
  readonly ausgangstext: string;
  readonly eingabeweg: Eingabeweg;
  readonly parameter: readonly FunktionsParameter[];
  /** Kennungen von Wissensobjekten. Inhalt, Fassung und Status liest jeder Lauf neu. */
  readonly quellen: readonly string[];
  readonly quellenregel: typeof QUELLENREGEL;
  readonly erlaubteSchritte: readonly string[];
  readonly aussenaktionen: typeof AUSSENAKTIONEN;
  readonly empfaengerregel: string;
  readonly ergebnis: string;
  readonly fehlerregel: string;
  readonly stopregel: string;
  readonly angelegtAm: string;
}

export type Rhythmus = "woechentlich" | "monatlich";

export type Nachholregel = "einmal" | "nie";

export interface Zeitauftrag {
  readonly rhythmus: Rhythmus;
  /** Erster Tag der Serie (`JJJJ-MM-TT`, Ortszeit der Zeitzone). */
  readonly beginn: string;
  /** Letzter möglicher Tag oder `null` (ohne Ende). */
  readonly ende: string | null;
  /** Ortszeit `HH:MM`. */
  readonly uhrzeit: string;
  readonly zeitzone: string;
  readonly nachholen: Nachholregel;
  readonly eingerichtetAm: string;
  readonly fortgesetztAm?: string;
  /** Die D-Zeitsteuerung prüft aktuelle Quellen und nötige Angaben; Außenwirkungen bleiben gesperrt. */
  readonly ausfuehrung: "vorbereitung";
}

/**
 * Was ein Lauf über eine Quelle festhält: Kennung, gelesene Fassung und Status — bewusst KEIN Titel
 * und kein Inhalt. Verliert das Konto später das Leserecht, steht in seinem Verlauf nichts, was es
 * dann nicht mehr sehen dürfte.
 */
export interface LaufQuelle {
  readonly koId: string;
  readonly zustand: QuellZustand;
  readonly fassung: number | null;
  readonly status: string | null;
}

/**
 * Der Zustand einer Quelle im Augenblick des Laufs. `nicht_zugaenglich` heisst: unbekannt ODER kein
 * Leserecht (beides antwortet gleich); `geloescht`: im Papierkorb, und das Konto durfte das Objekt
 * sehen; `nicht_erreichbar`: das Lesen selbst ist gescheitert (Quellausfall, nichts ersetzt).
 */
export type QuellZustand = "gelesen" | "nicht_zugaenglich" | "geloescht" | "nicht_erreichbar";

export type KlaerungArt =
  | "parameter_fehlen"
  | "keine_quelle"
  | "quelle_geloescht"
  | "quelle_nicht_zugaenglich"
  | "quelle_nicht_erreichbar";

/** Ein gezielter Handlungsbedarf vor dem nächsten Schritt — mit dem, was die Person tun kann. */
export interface Klaerung {
  readonly art: KlaerungArt;
  readonly koId: string | null;
  readonly hinweis: string;
}

export interface FunktionsLauf {
  readonly id: string;
  /** Die Vertragsfassung, nach der dieser Lauf vorbereitet wurde. */
  readonly fassung: number;
  readonly ausloeser: "manuell" | "zeitplan";
  readonly termin?: string;
  readonly ausgeloestAm: string;
  /** Nur für DIESEN Lauf — die Funktion selbst übernimmt davon nichts. */
  readonly parameterwerte: Readonly<Partial<Record<ParameterName, string>>>;
  /** Die Rolle des Kontos im Augenblick des Laufs. */
  readonly rechte: { readonly rolle: string; readonly geprueftAm: string };
  readonly quellen: readonly LaufQuelle[];
  /** `klaerung_noetig`, sobald eine fachliche Voraussetzung (Quelle) fehlt — vor jeder Fähigkeit. */
  readonly stand: "klaerung_noetig" | "wartet_auf_faehigkeit";
  /** Was die Person klären muss — leer, wenn jede Quelle gelesen wurde. */
  readonly klaerung: readonly Klaerung[];
  /** Kennungen der Fähigkeiten, ohne die der Lauf nicht weitergeht. */
  readonly offen: readonly string[];
  /** Was dieser Lauf nach außen bewirkt hat. */
  readonly aussenwirkung: "keine";
}

export interface PersoenlicheFunktion {
  readonly id: string;
  readonly kontoId: string;
  readonly art: FunktionsArt;
  readonly stand: FunktionsStand;
  /** Älteste zuerst; die letzte ist die geltende. */
  readonly fassungen: readonly FunktionsFassung[];
  readonly zeitauftrag: Zeitauftrag | null;
  /** Älteste zuerst. */
  readonly laeufe: readonly FunktionsLauf[];
  /** Nebenläufigkeitsmarke: jede Änderung erhöht sie genau um eins. */
  readonly rev: number;
  readonly angelegtAm: string;
  readonly geaendertAm: string;
}
