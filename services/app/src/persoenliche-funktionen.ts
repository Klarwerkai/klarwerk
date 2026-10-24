import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { siehtGeheimAus } from "./assistenz-lernen";
import { vorkommenVon } from "./klara-erinnerung";
import {
  type Zeitplan as DZeitplan,
  SOMMERZEIT_VORGABE,
  loeseMitRegel,
} from "./klara-erinnerung-zeit";
import type { KlaraGespraech, KlaraGespraechRepo, KlaraNachricht } from "./klara-gespraech";
import {
  AUSSENAKTIONEN,
  BESCHAFFUNG_PARAMETER,
  type Eingabeweg,
  type FunktionsArt,
  type FunktionsFassung,
  type FunktionsHerkunft,
  type FunktionsLauf,
  type FunktionsParameter,
  type FunktionsStand,
  type Klaerung,
  type KlaerungArt,
  type LaufQuelle,
  type Nachholregel,
  type ParameterName,
  type PersoenlicheFunktion,
  QUELLENREGEL,
  type QuellZustand,
  type Rhythmus,
  type Zeitauftrag,
} from "./persoenliche-funktionsvertrag";
import {
  InMemoryRoutinenRepo,
  PERSOENLICHE_ROUTINEN_SCHEMA,
  PgRoutinenRepo,
  type Routine,
  type RoutinenRepo,
} from "./vormachen";

// ================================================================================================
// produkt:20261011:peter-p06:beschaffungsroutine (BES-07) — DER BESCHAFFUNGSABLAUF ALS PERSÖNLICHE
// FUNKTION.
// ================================================================================================
//
// „Nach dem konkreten Ablauf sagt der Nutzer: So möchte ich künftig Angebote für eine Verpackung
// einholen." Daraus entsteht hier ein VERSIONIERTER FUNKTIONSVERTRAG je Konto — kein technischer
// Editor, kein zweiter Assistenzkern, kein Scheduler.
//
// EIN EIGENER DATENRAUM wie das Interaktionsgedächtnis (`interaktionsgedaechtnis.ts`):
//   · Eine Funktion gehört GENAU EINEM KONTO (Eigentümer). Die Kontokennung kommt aus der Sitzung;
//     fremd und unbekannt antworten gleich (404).
//   · Der Vertrag hält Zweck, Parameter, Quellenregel, erlaubte Schritte, Außenaktionsregel,
//     Empfängerregel, Ergebnis, Fehler- und Stopregel. Jede inhaltliche Änderung ist eine NEUE
//     Fassung; die alten bleiben unverändert lesbar.
//   · Produkt, Menge, Termin, Ansprechpartner und einmalige Ausnahmen sind PARAMETER. Werte aus dem
//     Satz, mit dem die Funktion angelegt wurde, sind Beispielwerte: sie werden zurückgemeldet und
//     NICHT gespeichert — auch nicht im gespeicherten Ausgangssatz (dort stehen Platzhalter).
//   · Quellen sind Kennungen. Titel, Fassung und Status werden bei JEDEM Lauf neu gelesen, mit den
//     Leserechten des Augenblicks; ein unzugänglich gewordenes Objekt wird nicht aus altem Verlauf
//     ergänzt.
//
// WAS SPEICHERN NICHT TUT (BES-07-K04): Speichern legt keinen Lauf an, keine Wiederholung und kein
// Außenrecht. Ein Lauf entsteht nur durch den ausdrücklichen Aufruf (`laufVorbereiten`), eine Serie
// nur durch `setzeZeitauftrag`. Ein Vorschlag (Lernnotiz aus einer Beobachtung) ist nicht aufrufbar,
// bis das Konto ihn übernimmt.
//
// BEWUSST OFFEN, UND SO GEKENNZEICHNET (BES-07-K08): Die Ausführung eines Beschaffungslaufs braucht
// die Auftragsführung (BES-02), den Angebotsvergleich (BES-06) und für Versand/Antwortabruf ein
// Postfach. Keine davon ist in diesem Stand gebaut. Ein Lauf liest deshalb Quellen und heutige Rechte
// und endet im Stand `wartet_auf_faehigkeit` mit den konkret offenen Fähigkeiten — er simuliert keine
// Anfrage, keinen Versand und kein Angebot. Ebenso eine Serie: sie ist mit Zeitzonen-, Sommerzeit-
// und Nachholregel eingerichtet und in einer Vorschau berechnet; AUSGELÖST wird sie nicht, weil es
// keinen vorhandenen Zeitauftragsdienst gibt und diese Datei keinen eigenen Wecker startet.
//
// NACHARBEIT 3 (Ben, BES-S13/K01/K05/K07):
//   · „SO WIE EBEN SPEICHERN": Der vorhandene Vorgang der Assistenz ist das gespeicherte
//     Klara-Gespräch (`klara-gespraech.ts`). Mit `gespraech` („letztes" oder eine Kennung) übernimmt
//     das Speichern dessen Ablauf (die eigene Frage, die ihn nennt) und dessen Quellen
//     (Objektbezüge und Antwortquellen) — aber nur die, die das Konto JETZT sehen darf. Ein
//     kontextbezogener Satz ohne Vorgang wird gezielt abgewiesen (`kontext_fehlt`), nicht geraten.
//   · Ein Lauf ohne Quelle oder mit einer gelöschten, nicht zugänglichen oder nicht erreichbaren
//     Quelle endet in `klaerung_noetig` und nennt je Fall, was zu klären ist. Die Unterscheidung
//     gelöscht/nicht zugänglich ist dieselbe wie bei den Fundstellen (`aussage-fundstellen.ts`):
//     „gelöscht" erfährt nur, wer das Objekt sehen durfte; ein Lesefehler ist „nicht erreichbar".

export type { FunktionsArt };
export type { FunktionsStand };
export type { Eingabeweg };
export type { ParameterName };

export type { FunktionsParameter };

export { BESCHAFFUNG_PARAMETER };

/** Was ein Lauf dieser Funktion ohne weitere Rückfrage tun darf — alles intern, nichts nach außen. */
export const ERLAUBTE_SCHRITTE = [
  "quellen_lesen",
  "anforderung_entwerfen",
  "lieferantenkreis_vorschlagen",
  "anfrage_entwerfen",
  "angebote_vergleichen",
] as const;

export { AUSSENAKTIONEN };

export { QUELLENREGEL };

export const EMPFAENGERREGEL =
  "Empfänger werden bei jedem Lauf aus den heutigen Rechten bestimmt. Die Funktion speichert keine Empfänger und übernimmt keine Rechte aus der Vorführung.";
export const ERGEBNIS =
  "Nachrechenbarer Angebotsvergleich mit Quellenbeleg je Lauf. Keine Bestellung, keine Zahlung.";
export const FEHLERREGEL =
  "Fehlt ein Produkt, eine Menge, ein Termin, eine Quelle oder ein Zugang, hält der Lauf an und fragt gezielt nach; nichts wird erfunden oder aus einem alten Lauf übernommen.";
export const STOPREGEL =
  "Pausieren oder Deaktivieren verhindert jeden weiteren Lauf. Bereits versandte Nachrichten bleiben bestehen, werden aber nie automatisch wiederholt; fertige Ergebnisse bleiben erhalten.";

export type { FunktionsHerkunft };

/**
 * Ein Beschaffungsfall im Gespräch: beginnt mit einer eigenen Frage, die einen Beschaffungsablauf
 * nennt, und reicht bis vor die nächste solche Frage. Nur SEINE Nachrichten liefern Quellen.
 */
export interface VorgangsAbschnitt {
  /** Kennung der Nachricht, mit der der Fall beginnt. */
  readonly abschnitt: string;
  /** Die eigene Frage, gekürzt — nur zur Auswahl für das Konto selbst. */
  readonly text: string;
  readonly angelegtAm: string;
}

/** Was eine Vorschau bindet und das Speichern unverändert vorfinden muss. */
export interface VorgangsBindung {
  readonly gespraechId: string;
  readonly gespraechFassung: number;
  readonly abschnitt: string;
}

export type { FunktionsFassung };

export type { Rhythmus };
export type { Nachholregel };

export type { Zeitauftrag };

export type { LaufQuelle };

export type { QuellZustand };

export type { KlaerungArt };

export type { Klaerung };

export const KLAERUNG_HINWEIS: Readonly<Record<KlaerungArt, string>> = {
  parameter_fehlen:
    "Für diesen Termin fehlen aktuelle Produkt-, Mengen- oder Terminangaben. Bitte einen neuen Fall mit diesen Angaben vorbereiten; Beispielwerte werden nicht wiederholt.",
  keine_quelle:
    "Diese Funktion hat keine Quelle. Bitte unter „Meine Funktionen → Bearbeiten“ die geltende Spezifikation oder Vorgabe als Quelle übernehmen.",
  quelle_geloescht:
    "Die Quelle liegt im Papierkorb. Bitte wiederherstellen lassen oder unter „Bearbeiten“ durch die geltende Quelle ersetzen.",
  quelle_nicht_zugaenglich:
    "Die Quelle ist für dich nicht zugänglich. Bitte den Zugriff mit der verantwortlichen Person klären oder die Quelle ersetzen; aus früheren Läufen wird nichts übernommen.",
  quelle_nicht_erreichbar:
    "Die Quelle konnte gerade nicht gelesen werden. Bitte später erneut vorbereiten; ersetzt wurde nichts.",
};

const KLAERUNG_JE_ZUSTAND: Readonly<Record<Exclude<QuellZustand, "gelesen">, KlaerungArt>> = {
  geloescht: "quelle_geloescht",
  nicht_zugaenglich: "quelle_nicht_zugaenglich",
  nicht_erreichbar: "quelle_nicht_erreichbar",
};

export type { FunktionsLauf };

export type { PersoenlicheFunktion };

export interface Faehigkeit {
  readonly id: string;
  readonly titel: string;
  readonly erfuellt: boolean;
  readonly grund: string;
}

/** Was ein Beschaffungslauf braucht, um über die Vorbereitung hinauszukommen — Stand heute. */
export const BESCHAFFUNG_FAEHIGKEITEN: readonly Faehigkeit[] = [
  {
    id: "BES-02",
    titel: "Begrenzten mehrstufigen Auftrag führen",
    erfuellt: false,
    grund: "Die Auftragsführung für Beschaffung ist in diesem Stand nicht gebaut.",
  },
  {
    id: "BES-06",
    titel: "Angebote prüfen und vergleichen",
    erfuellt: false,
    grund: "Der Angebotsvergleich ist in diesem Stand nicht gebaut.",
  },
  {
    id: "postfach",
    titel: "Anfragen versenden und Antworten abrufen",
    erfuellt: false,
    grund: "Kein Postfach angebunden; Versand und Antwortabruf sind ausgeschlossen.",
  },
];

export const ZEITAUFTRAG_FAEHIGKEIT: Faehigkeit = {
  id: "zeitauftrag",
  titel: "Serie zum eingerichteten Zeitpunkt auslösen",
  erfuellt: true,
  grund:
    "Die vorhandene Zeitsteuerung löst die Prüfung mit heutigen Quellen und Rechten aus. Fehlende Laufparameter und Beschaffungsadapter bleiben als Handlungsbedarf sichtbar.",
};

export const FUNKTIONEN_MAX_JE_KONTO = 50;
export const FUNKTION_MAX_LAEUFE = 200;
export const FUNKTION_MAX_QUELLEN = 20;
export const FUNKTION_TEXT_MAX = 1_000;
export const FUNKTION_NAME_MAX = 120;
export const PARAMETER_WERT_MAX = 300;
export const STANDARD_ZEITZONE = "Europe/Berlin";

// ------------------------------------------------------------------------------------------------
// DIE ABLAGE
// ------------------------------------------------------------------------------------------------

export interface FunktionenRepo {
  eigene(kontoId: string): Promise<PersoenlicheFunktion[]>;
  hole(kontoId: string, id: string): Promise<PersoenlicheFunktion | null>;
  /**
   * Schreibt `f`, wenn die gespeicherte Funktion noch `rev - 1` trägt (bei `rev === 1`: wenn es sie
   * noch nicht gibt); sonst `false`.
   */
  schreibe(f: PersoenlicheFunktion): Promise<boolean>;
}

/** Beschaffung ist ein Fachvertrag im ursprünglichen P06-Speicher, keine zweite Registry. */
export class RoutinenFunktionenRepo implements FunktionenRepo {
  constructor(private readonly routinen: RoutinenRepo) {}
  async eigene(kontoId: string): Promise<PersoenlicheFunktion[]> {
    return (await this.routinen.routinen(kontoId)).flatMap((r) =>
      r.beschaffung ? [structuredClone(r.beschaffung)] : [],
    );
  }
  async hole(kontoId: string, id: string): Promise<PersoenlicheFunktion | null> {
    return (await this.routinen.routine(kontoId, id))?.beschaffung ?? null;
  }
  async schreibe(f: PersoenlicheFunktion): Promise<boolean> {
    const alt = await this.routinen.routine(f.kontoId, f.id);
    if ((alt?.beschaffung?.rev ?? 0) !== f.rev - 1 || (alt && !alt.beschaffung)) return false;
    const v = aktuelleFassung(f);
    const r: Routine = {
      id: f.id,
      kontoId: f.kontoId,
      titel: v.name,
      zweck: v.zweck,
      host: "klarwerk_web",
      modus: "ergebnis_zur_pruefung",
      fassung: v.version,
      schritte: [],
      herkunft: {
        sitzungId:
          v.herkunft.art === "assistenzgespraech" ? v.herkunft.gespraechId : "eigene-eingabe",
        stand: String(f.rev),
        beobachtet: 0,
        korrigiert: f.fassungen.length - 1,
      },
      bestaetigtAm: f.angelegtAm,
      firmenuebergabe: null,
      zustand: f.stand === "aktiv" ? "aktiv" : "pausiert",
      beschaffung: f,
    };
    return this.routinen.vergleicheUndLege(r, alt);
  }
}
export class InMemoryFunktionenRepo extends RoutinenFunktionenRepo {
  constructor() {
    super(new InMemoryRoutinenRepo());
  }
}
/** Kompatible Namen für die erhaltenen Originalprüfungen; es gibt nur P06s Tabelle. */
export const PERSOENLICHE_FUNKTIONEN_SCHEMA = PERSOENLICHE_ROUTINEN_SCHEMA;
export class PgFunktionenRepo extends RoutinenFunktionenRepo {
  constructor(pool: Pool) {
    super(new PgRoutinenRepo(pool));
  }
}

// ------------------------------------------------------------------------------------------------
// AUS DEM SATZ ZUM VERTRAG — OHNE MODELL, OHNE EDITOR (BES-07-K01/K02)
// ------------------------------------------------------------------------------------------------

export type FunktionsFehlerGrund =
  | "eingabe"
  | "nicht_erkannt"
  | "kontext_fehlt"
  | "gespraech_unbekannt"
  | "vorgang_mehrdeutig"
  | "abschnitt_unbekannt"
  | "vorschau_fehlt"
  | "vorgang_geaendert"
  | "quelle_unbekannt"
  | "nicht_gefunden"
  | "konflikt"
  | "voll"
  | "nicht_aufrufbar"
  | "angabe_fehlt";

export class FunktionsFehler extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    readonly grund: FunktionsFehlerGrund,
    message: string,
    readonly fehlend: readonly string[] = [],
    /** Bei `vorgang_mehrdeutig`: die Fälle des Gesprächs, aus denen das Konto wählt. */
    readonly abschnitte: readonly VorgangsAbschnitt[] = [],
  ) {
    super(message);
    this.name = "FunktionsFehler";
  }
}

export interface Beispielwert {
  readonly parameter: ParameterName;
  readonly wert: string;
}

export interface FunktionsEntwurf {
  readonly name: string;
  readonly zweck: string;
  readonly thema: string;
  readonly ausgangstext: string;
  readonly eingabeweg: Eingabeweg;
  readonly parameter: readonly FunktionsParameter[];
  readonly quellenregel: typeof QUELLENREGEL;
  readonly erlaubteSchritte: readonly string[];
  readonly aussenaktionen: typeof AUSSENAKTIONEN;
  readonly empfaengerregel: string;
  readonly ergebnis: string;
  readonly fehlerregel: string;
  readonly stopregel: string;
  /** Werte aus dem Satz — zur Kontrolle zurückgemeldet, NIE gespeichert. */
  readonly beispielwerte: readonly Beispielwert[];
  /** Der Satz nennt eine Wiederholung; eingerichtet wird sie dadurch nicht. */
  readonly wiederholungErwaehnt: boolean;
}

const PLATZHALTER: Record<ParameterName, string> = {
  produkt: "[Produkt]",
  menge: "[Menge]",
  termin: "[Termin]",
  ansprechpartner: "[Ansprechpartner]",
  ausnahme: "[Ausnahme]",
};

// Die Muster für Beispielwerte. Bewusst schlicht und vorsichtig: was hier nicht erkannt wird, bleibt
// im Satz stehen, aber auch dann wird es nur als Text gespeichert und nie als Vorgabe eines Laufs —
// die Parameter eines Laufs kommen ausschliesslich aus seinem Aufruf. Die Ausnahme steht zuletzt:
// Menge, Termin und Ansprechpartner darin sind dann schon eigene Beispielwerte.
const MUSTER: ReadonlyArray<{ parameter: ParameterName; muster: RegExp }> = [
  {
    parameter: "ansprechpartner",
    muster:
      /[\w.+-]+@[\w-]+(?:\.[\w-]+)+|\b(?:an|bei|von)\s+(?:Frau|Herrn?)\s+[A-ZÄÖÜ][\wäöüß-]+/gu,
  },
  {
    parameter: "termin",
    muster:
      /\b(?:bis\s+(?:zum\s+)?)?(?:\d{4}-\d{2}-\d{2}|\d{1,2}\.\s?\d{1,2}\.(?:\s?\d{2,4})?|KW\s?\d{1,2})/giu,
  },
  {
    parameter: "menge",
    muster:
      /\b\d+(?:[.,]\d+)?\s*(?:stück|stk\.?|kg|t|tonnen|liter|l|m|meter|paletten?|kartons?|rollen?|pakete?|einheiten)(?![\wäöüß])/giu,
  },
  {
    parameter: "ausnahme",
    muster: /\b(?:diesmal|einmalig|ausnahmsweise|nur dieses mal)\b[^,.;!?]*/giu,
  },
];

const WIEDERHOLUNG =
  /\b(?:jede[nrsm]?\s+(?:tag|woche|monat|quartal|jahr|montag|dienstag|mittwoch|donnerstag|freitag)|täglich|taeglich|wöchentlich|woechentlich|monatlich|regelmäßig|regelmaessig)\b/iu;

const ABLAUF = /\b(?:angebot|angebote|angebotsanfrage|preisanfrage|anfragen?)\b/iu;

/** Ein Satz, der sich auf den eben geführten Vorgang bezieht („So wie eben speichern"). */
const UEBERNAHME =
  /\b(?:so wie (?:eben|gerade|vorhin)|wie eben|wie gerade|wie vorhin|diesen ablauf|genau so)\b/iu;

/** Nennt der Satz einen Beschaffungsablauf? */
export function nenntAblauf(text: string): boolean {
  return ABLAUF.test(text);
}

/** Bezieht sich der Satz auf einen eben geführten Vorgang? */
export function istUebernahmesatz(text: string): boolean {
  return UEBERNAHME.test(text);
}

const THEMA =
  /\b(?:angebote?|preise|anfragen?)\s+(?:für|fuer|zu|über|ueber)\s+(?:(?:eine[nrms]?|ein|die|den|das|der|unsere?n?)\s+)?(.+?)\s+(?:einholen|anfragen|holen|ein|bekommen|erhalten)\b/iu;

function bereinige(text: string): string {
  return text.normalize("NFC").replace(/\s+/g, " ").trim();
}

/**
 * Macht aus einem gesprochenen oder getippten Satz einen Funktionsentwurf. Kein Modell: ein Satz,
 * der keinen Beschaffungsablauf nennt, wird abgelehnt statt geraten.
 */
export function entwirfFunktion(roh: unknown, wegRoh: unknown): FunktionsEntwurf {
  if (typeof roh !== "string" || bereinige(roh).length === 0) {
    throw new FunktionsFehler(400, "eingabe", "Bitte beschreibe den Ablauf in einem Satz.");
  }
  const text = bereinige(roh);
  if (siehtGeheimAus(text))
    throw new FunktionsFehler(
      400,
      "eingabe",
      "Zugangsdaten gehören nicht in eine persönliche Funktion.",
    );
  if (text.length > FUNKTION_TEXT_MAX) {
    throw new FunktionsFehler(
      400,
      "eingabe",
      `Der Satz ist höchstens ${FUNKTION_TEXT_MAX} Zeichen lang.`,
    );
  }
  const eingabeweg: Eingabeweg = wegRoh === "sprache" ? "sprache" : "text";
  if (wegRoh !== undefined && wegRoh !== "text" && wegRoh !== "sprache") {
    throw new FunktionsFehler(400, "eingabe", "eingabeweg muss text oder sprache sein.");
  }
  if (!ABLAUF.test(text) && UEBERNAHME.test(text)) {
    throw new FunktionsFehler(
      400,
      "kontext_fehlt",
      "„So wie eben“ bezieht sich auf einen Vorgang. Bitte den Vorgang aus deinem Assistenzgespräch mit übernehmen.",
    );
  }
  if (!ABLAUF.test(text)) {
    throw new FunktionsFehler(
      400,
      "nicht_erkannt",
      "Darin erkenne ich keinen Beschaffungsablauf. Beispiel: „So möchte ich künftig Angebote für eine Verpackung einholen.“",
    );
  }

  const beispielwerte: Beispielwert[] = [];
  let ausgangstext = text;
  for (const { parameter, muster } of MUSTER) {
    ausgangstext = ausgangstext.replace(muster, (treffer) => {
      beispielwerte.push({ parameter, wert: treffer.trim() });
      return PLATZHALTER[parameter];
    });
  }

  const themaTreffer = THEMA.exec(ausgangstext);
  // Ein Platzhalter im Thema ist ein Beispielwert, kein Teil der Produktgruppe.
  const ohnePlatzhalter = (themaTreffer?.[1] ?? "").replace(/\[[A-Za-zÄÖÜäöü]+\]/g, "");
  let thema = bereinige(ohnePlatzhalter);
  if (thema.length === 0 || thema.length > 80) {
    thema = "ein Produkt";
  }

  return {
    name: `Angebote für ${thema} einholen`.slice(0, FUNKTION_NAME_MAX),
    zweck: `Angebote für ${thema} quellengebunden anfragen und vergleichen. Produkt, Menge, Termin und Ansprechpartner gibst du bei jedem Aufruf neu an.`,
    thema,
    ausgangstext,
    eingabeweg,
    parameter: BESCHAFFUNG_PARAMETER,
    quellenregel: QUELLENREGEL,
    erlaubteSchritte: [...ERLAUBTE_SCHRITTE],
    aussenaktionen: AUSSENAKTIONEN,
    empfaengerregel: EMPFAENGERREGEL,
    ergebnis: ERGEBNIS,
    fehlerregel: FEHLERREGEL,
    stopregel: STOPREGEL,
    beispielwerte,
    wiederholungErwaehnt: WIEDERHOLUNG.test(text),
  };
}

// ------------------------------------------------------------------------------------------------
// ZEITZONE, SOMMERZEIT, NACHHOLEN (BES-07-K06) — die Regeln der Laufzeit (IANA über `Intl`), keine
// eigene Tabelle und kein eigener Wecker.
// ------------------------------------------------------------------------------------------------

export type TerminHinweis = "sommerzeit_verschoben" | "winterzeit_doppelt" | "monatsende";

export interface VorschauTermin {
  /** Der Kalendertag der Serie (Ortszeit). */
  readonly datum: string;
  /** Der Zeitpunkt in UTC. */
  readonly zeitpunkt: string;
  readonly hinweis: TerminHinweis | null;
}

const UHRZEIT = /^([01]\d|2[0-3]):([0-5]\d)$/;
const istDatum = (wert: unknown): wert is string =>
  typeof wert === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(wert) &&
  !Number.isNaN(Date.parse(wert)) &&
  new Date(wert).toISOString().slice(0, 10) === wert;
export { istZeitzone } from "./klara-erinnerung-zeit";
import { istZeitzone } from "./klara-erinnerung-zeit";
export function ortszeitZuUtc(
  datum: string,
  uhrzeit: string,
  zeitzone: string,
): { utcMs: number; hinweis: "sommerzeit_verschoben" | "winterzeit_doppelt" | null } {
  const r = loeseMitRegel({ datum, uhrzeit }, zeitzone, SOMMERZEIT_VORGABE);
  if (r.ms === null) throw new Error("Zeitpunkt nicht auflösbar.");
  return {
    utcMs: r.ms,
    hinweis:
      r.hinweis === "luecke_verschoben"
        ? "sommerzeit_verschoben"
        : r.hinweis === "doppelt_erste"
          ? "winterzeit_doppelt"
          : null,
  };
}
export function beschaffungsZeitplan(z: Zeitauftrag): DZeitplan {
  return {
    art: "serie",
    datum: z.beginn,
    uhrzeit: z.uhrzeit,
    wiederholung: { takt: z.rhythmus, intervall: 1, wochentage: [], bis: z.ende, anzahl: null },
  };
}
export function naechsteTermine(z: Zeitauftrag, abMs: number, anzahl = 6): VorschauTermin[] {
  return vorkommenVon(
    {
      id: "beschaffung",
      zeitplan: beschaffungsZeitplan(z),
      zeitzone: z.zeitzone,
      sommerzeit: SOMMERZEIT_VORGABE,
      ausnahmen: {},
    },
    { von: abMs, stoppNach: abMs, kuenftig: anzahl },
  )
    .filter((v): v is typeof v & { ms: number } => v.ms !== null && v.ms >= abMs)
    .slice(0, anzahl)
    .map((v) => ({
      datum: v.lokal.datum,
      zeitpunkt: new Date(v.ms).toISOString(),
      hinweis:
        v.hinweis === "luecke_verschoben"
          ? "sommerzeit_verschoben"
          : v.hinweis === "doppelt_erste"
            ? "winterzeit_doppelt"
            : z.rhythmus === "monatlich" &&
                Number(z.beginn.slice(-2)) > Number(v.lokal.datum.slice(-2))
              ? "monatsende"
              : null,
    }));
}

// ------------------------------------------------------------------------------------------------
// DER DIENST
// ------------------------------------------------------------------------------------------------

export interface FunktionSpeichernEingabe {
  text?: unknown;
  eingabeweg?: unknown;
  art?: unknown;
  name?: unknown;
  quellen?: unknown;
  /**
   * Der übernommene Vorgang — beim Speichern IMMER die Bindung aus der Vorschau: Gesprächskennung
   * (nicht „letztes"), deren Fassung, der Abschnitt und die gezeigten Quellen.
   */
  gespraech?: unknown;
  gespraechFassung?: unknown;
  abschnitt?: unknown;
  vorschauQuellen?: unknown;
  /** Nacharbeit 5: die angezeigte Definition (Name, Ausgangssatz) — Abweichung ist ein Konflikt. */
  vorschauName?: unknown;
  vorschauAusgangstext?: unknown;
}

export interface FunktionAendernEingabe {
  rev?: unknown;
  name?: unknown;
  zweck?: unknown;
  quellen?: unknown;
  stand?: unknown;
  /** Ergänzt die berechtigten Quellen EINES Falls dieses Gesprächs („letztes" oder eine Kennung). */
  gespraech?: unknown;
  abschnitt?: unknown;
}

export interface EntwurfEingabe {
  text?: unknown;
  eingabeweg?: unknown;
  quellen?: unknown;
  gespraech?: unknown;
  /** Der gewählte Fall, wenn das Gespräch mehrere enthält. */
  abschnitt?: unknown;
}

/** Ein Entwurf samt übernommener Quellen — gespeichert wird dabei nichts. */
export interface FunktionsVorbereitung {
  readonly entwurf: FunktionsEntwurf;
  readonly herkunft: FunktionsHerkunft;
  /** Was das Speichern unverändert vorfinden muss — `null` ohne übernommenen Vorgang. */
  readonly bindung: VorgangsBindung | null;
  /** Die Quellen, die das Konto jetzt sehen darf — nur Kennungen. */
  readonly quellen: readonly string[];
  /** Quellen des Vorgangs, die das Konto jetzt nicht sehen darf (nur die Zahl). */
  readonly nichtUebernommen: number;
}

export interface ZeitauftragEingabe {
  rev?: unknown;
  rhythmus?: unknown;
  beginn?: unknown;
  ende?: unknown;
  uhrzeit?: unknown;
  zeitzone?: unknown;
  nachholen?: unknown;
}

export interface LaufEingabe {
  parameter?: unknown;
}

/**
 * Was über eine Quelle gelesen werden darf: Fassung und Status, wenn sie sichtbar ist; `geloescht`,
 * wenn sie im Papierkorb liegt und das Konto sie sehen durfte; `nicht_erreichbar` bei einem
 * Lesefehler; `null` heisst: unbekannt ODER nicht zugänglich.
 */
export type QuellenLesung =
  | { readonly fassung: number; readonly status: string }
  | "geloescht"
  | "nicht_erreichbar"
  | null;

export type QuelleLesen = (koId: string) => Promise<QuellenLesung>;

function gelesen(l: QuellenLesung): l is { readonly fassung: number; readonly status: string } {
  return typeof l === "object" && l !== null;
}

export interface LaufKontext {
  readonly rolle: string;
  readonly quelleLesen: QuelleLesen;
}

export interface FunktionenDienstDeps {
  readonly repo: FunktionenRepo;
  readonly jetzt?: () => number;
  readonly neueId?: () => string;
  /** Der heutige Stand der Fähigkeiten eines Beschaffungslaufs. */
  readonly faehigkeiten?: readonly Faehigkeit[];
  /** Die vorhandene Gesprächsablage — der übernommene Vorgang. Ohne sie kein „so wie eben". */
  readonly gespraeche?: Pick<KlaraGespraechRepo, "aktuelles" | "hole">;
}

// ------------------------------------------------------------------------------------------------
// NACHARBEIT 4 (Ben, BES-S13/K01/K03) — EIN FALL, NICHT DAS GANZE GESPRÄCH.
// ------------------------------------------------------------------------------------------------
//
// Ein Gespräch kann mehrere Beschaffungsfälle enthalten (Nachrichten werden hinten angehängt). Ein
// Fall beginnt mit einer eigenen Frage, die einen Ablauf nennt, und reicht bis vor die nächste
// solche Frage. Übernommen werden Ablauf und Quellen GENAU EINES Falls: bei einem Fall dieser, bei
// mehreren nur der ausdrücklich gewählte — sonst `vorgang_mehrdeutig` mit der Auswahl. Der
// Objektbezug beim Gesprächsbeginn gehört zu keinem Fall und wird nicht übernommen.

interface Fall {
  readonly start: number;
  readonly ende: number;
  readonly frage: KlaraNachricht;
}

function faelleDes(g: KlaraGespraech): Fall[] {
  const starts = g.nachrichten
    .map((n, i) => (n.von === "du" && nenntAblauf(n.text) ? i : -1))
    .filter((i) => i >= 0);
  return starts.map((start, k) => ({
    start,
    ende: starts[k + 1] ?? g.nachrichten.length,
    frage: g.nachrichten[start] as KlaraNachricht,
  }));
}

function alsAbschnitt(f: Fall): VorgangsAbschnitt {
  return {
    abschnitt: f.frage.id,
    text: f.frage.text.slice(0, 200),
    angelegtAm: f.frage.angelegtAm,
  };
}

/** Die Wissensobjekte EINES Falls — Objektbezüge und Antwortquellen seiner Nachrichten. */
function quellenDesFalls(g: KlaraGespraech, f: Fall): string[] {
  const raus: string[] = [];
  for (const n of g.nachrichten.slice(f.start, f.ende)) {
    for (const koId of [n.objektbezug.koId, ...n.quellen]) {
      if (koId && !raus.includes(koId)) {
        raus.push(koId);
      }
    }
  }
  return raus;
}

/** Bestimmt den gemeinten Fall eindeutig — oder sagt gezielt, warum das nicht geht. */
function waehleFall(g: KlaraGespraech, wunsch: unknown): Fall {
  const faelle = faelleDes(g);
  if (faelle.length === 0) {
    throw new FunktionsFehler(
      400,
      "nicht_erkannt",
      "Im übernommenen Gespräch steht kein Beschaffungsablauf. Bitte den Ablauf in einem Satz nennen.",
    );
  }
  if (wunsch !== undefined && wunsch !== null) {
    const gewaehlt = faelle.find((f) => f.frage.id === wunsch);
    if (!gewaehlt) {
      throw new FunktionsFehler(
        404,
        "abschnitt_unbekannt",
        "Dieser Fall steht nicht (mehr) in diesem Gespräch. Bitte die Vorschau erneuern.",
      );
    }
    return gewaehlt;
  }
  if (faelle.length > 1) {
    throw new FunktionsFehler(
      409,
      "vorgang_mehrdeutig",
      `Das Gespräch enthält ${faelle.length} Beschaffungsfälle. Bitte wählen, welcher gemeint ist.`,
      [],
      faelle.map(alsAbschnitt),
    );
  }
  return faelle[0] as Fall;
}

function gleicheMenge(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

const STAND_WECHSEL: Readonly<Record<FunktionsStand, readonly FunktionsStand[]>> = {
  vorschlag: ["aktiv", "deaktiviert"],
  aktiv: ["pausiert", "deaktiviert"],
  pausiert: ["aktiv", "deaktiviert"],
  deaktiviert: ["aktiv"],
};

function text(wert: unknown): string | null {
  return typeof wert === "string" && wert.trim().length > 0 ? bereinige(wert) : null;
}

function pruefeName(wert: unknown): string {
  const name = text(wert);
  if (name === null || name.length > FUNKTION_NAME_MAX) {
    throw new FunktionsFehler(
      400,
      "eingabe",
      `Der Name ist Pflicht und höchstens ${FUNKTION_NAME_MAX} Zeichen lang.`,
    );
  }
  return name;
}

function pruefeQuellenListe(wert: unknown): string[] {
  if (!Array.isArray(wert) || wert.length > FUNKTION_MAX_QUELLEN) {
    throw new FunktionsFehler(
      400,
      "eingabe",
      `quellen ist eine Liste von höchstens ${FUNKTION_MAX_QUELLEN} Kennungen.`,
    );
  }
  const raus: string[] = [];
  for (const k of wert) {
    const kennung = text(k);
    if (kennung === null || kennung.length > 200) {
      throw new FunktionsFehler(400, "eingabe", "Jede Quelle ist eine Kennung.");
    }
    if (!raus.includes(kennung)) {
      raus.push(kennung);
    }
  }
  return raus;
}

export function aktuelleFassung(f: PersoenlicheFunktion): FunktionsFassung {
  return f.fassungen[f.fassungen.length - 1] as FunktionsFassung;
}

export class FunktionenDienst {
  private readonly repo: FunktionenRepo;
  private readonly jetzt: () => number;
  private readonly neueId: () => string;
  private readonly gespraeche: FunktionenDienstDeps["gespraeche"];
  readonly faehigkeiten: readonly Faehigkeit[];

  constructor(deps: FunktionenDienstDeps) {
    this.repo = deps.repo;
    this.jetzt = deps.jetzt ?? Date.now;
    this.neueId = deps.neueId ?? randomUUID;
    this.faehigkeiten = deps.faehigkeiten ?? BESCHAFFUNG_FAEHIGKEITEN;
    this.gespraeche = deps.gespraeche;
  }

  private jetztIso(): string {
    return new Date(this.jetzt()).toISOString();
  }

  /** Die offenen Fähigkeiten eines Laufs. Leer heisst: ausführbar. */
  offeneFaehigkeiten(): Faehigkeit[] {
    return this.faehigkeiten.filter((f) => !f.erfuellt);
  }

  /** Das übernommene Gespräch DIESES Kontos — oder `null`, wenn keines verlangt ist. */
  private async gespraechAus(kontoId: string, wunsch: unknown): Promise<KlaraGespraech | null> {
    if (wunsch === undefined || wunsch === null) {
      return null;
    }
    if (typeof wunsch !== "string" || wunsch.trim().length === 0 || wunsch.length > 200) {
      throw new FunktionsFehler(400, "eingabe", "gespraech ist „letztes“ oder eine Kennung.");
    }
    const g = !this.gespraeche
      ? null
      : wunsch === "letztes"
        ? await this.gespraeche.aktuelles(kontoId)
        : await this.gespraeche.hole(kontoId, wunsch);
    if (!g) {
      throw new FunktionsFehler(
        404,
        "gespraech_unbekannt",
        "Es gibt kein solches Gespräch unter deinem Konto, aus dem der Vorgang übernommen werden kann.",
      );
    }
    return g;
  }

  /**
   * Der Entwurf samt Quellen — mit oder ohne übernommenen Vorgang. Nichts wird gespeichert, nichts
   * läuft (BES-07-K04). Aus dem Gespräch kommen nur Quellen, die das Konto JETZT sehen darf; die
   * übrigen werden nur gezählt. Ausdrücklich genannte Quellen müssen sichtbar sein (sonst 404).
   */
  async entwurf(
    kontoId: string,
    eingabe: EntwurfEingabe,
    lesen: QuelleLesen,
  ): Promise<FunktionsVorbereitung> {
    const g = await this.gespraechAus(kontoId, eingabe.gespraech);
    const eigene = eingabe.quellen === undefined ? [] : pruefeQuellenListe(eingabe.quellen);
    await this.quellenSichtbar(eigene, lesen);
    if (g === null) {
      return {
        entwurf: entwirfFunktion(eingabe.text, eingabe.eingabeweg),
        herkunft: { art: "eingabe" },
        bindung: null,
        quellen: eigene,
        nichtUebernommen: 0,
      };
    }
    // Nacharbeit 4: genau EIN Fall des Gesprächs — eindeutig oder ausdrücklich gewählt.
    const fall = waehleFall(g, eingabe.abschnitt);
    // Der Ablauf: der eigene Satz, wenn er ihn nennt — sonst die Frage, mit der DIESER Fall begann.
    // „So wie eben speichern" nennt ihn nicht und nimmt deshalb den des Falls.
    const satz = typeof eingabe.text === "string" ? bereinige(eingabe.text) : "";
    const ablauf = nenntAblauf(satz) ? satz : fall.frage.text;
    const quellen = [...eigene];
    let nichtUebernommen = 0;
    for (const koId of quellenDesFalls(g, fall)) {
      if (quellen.includes(koId)) {
        continue;
      }
      if (quellen.length < FUNKTION_MAX_QUELLEN && gelesen(await lesen(koId))) {
        quellen.push(koId);
      } else {
        nichtUebernommen += 1;
      }
    }
    const bindung: VorgangsBindung = {
      gespraechId: g.id,
      gespraechFassung: g.fassung,
      abschnitt: fall.frage.id,
    };
    return {
      entwurf: entwirfFunktion(ablauf.slice(0, FUNKTION_TEXT_MAX), eingabe.eingabeweg),
      herkunft: { art: "assistenzgespraech", ...bindung },
      bindung,
      quellen,
      nichtUebernommen,
    };
  }

  eigene(kontoId: string): Promise<PersoenlicheFunktion[]> {
    return this.repo.eigene(kontoId);
  }

  async hole(kontoId: string, id: string): Promise<PersoenlicheFunktion> {
    const f = await this.repo.hole(kontoId, id);
    if (!f) {
      throw new FunktionsFehler(404, "nicht_gefunden", "Funktion nicht gefunden.");
    }
    return f;
  }

  private async quellenSichtbar(quellen: readonly string[], lesen: QuelleLesen): Promise<void> {
    for (const koId of quellen) {
      if (!gelesen(await lesen(koId))) {
        throw new FunktionsFehler(
          404,
          "quelle_unbekannt",
          `Die Quelle ${koId} ist nicht vorhanden, gelöscht, gerade nicht lesbar oder für dich nicht zugänglich.`,
        );
      }
    }
  }

  /**
   * Speichert die Funktion. Legt KEINEN Lauf und KEINE Serie an und gibt kein Außenrecht. Ein
   * `vorschlag` (Lernnotiz) ist erst nach ausdrücklicher Übernahme aufrufbar. Mit `gespraech`
   * („so wie eben") werden Ablauf und berechtigte Quellen des Vorgangs übernommen.
   */
  async speichern(
    kontoId: string,
    eingabe: FunktionSpeichernEingabe,
    lesen: QuelleLesen,
  ): Promise<{
    funktion: PersoenlicheFunktion;
    beispielwerte: readonly Beispielwert[];
    nichtUebernommen: number;
  }> {
    if (eingabe.art !== undefined && eingabe.art !== "favorit" && eingabe.art !== "vorschlag") {
      throw new FunktionsFehler(400, "eingabe", "art muss favorit oder vorschlag sein.");
    }
    // Nacharbeit 4: gespeichert wird genau, was die Vorschau zeigte. Mit Vorgang verlangt das
    // Speichern deshalb die Bindung der Vorschau — Kennung statt „letztes", Fassung, Fall und die
    // gezeigten Quellen — und weist jede Abweichung als Konflikt ab, statt still anderes zu speichern.
    const mitVorgang = eingabe.gespraech !== undefined && eingabe.gespraech !== null;
    if (
      mitVorgang &&
      (eingabe.gespraech === "letztes" ||
        typeof eingabe.gespraechFassung !== "number" ||
        typeof eingabe.abschnitt !== "string" ||
        !Array.isArray(eingabe.vorschauQuellen) ||
        typeof eingabe.vorschauName !== "string" ||
        typeof eingabe.vorschauAusgangstext !== "string")
    ) {
      throw new FunktionsFehler(
        400,
        "vorschau_fehlt",
        "Zum Speichern eines übernommenen Vorgangs bitte zuerst die Vorschau zeigen und deren Gespräch, Fassung, Fall, Quellen und Definition mitgeben.",
      );
    }
    const { entwurf, herkunft, bindung, quellen, nichtUebernommen } = await this.entwurf(
      kontoId,
      eingabe,
      lesen,
    );
    if (bindung !== null) {
      // Rechte und Quellen werden JETZT erneut geprüft (`entwurf` liest sie neu).
      const gezeigt = pruefeQuellenListe(eingabe.vorschauQuellen);
      if (
        bindung.gespraechFassung !== eingabe.gespraechFassung ||
        !gleicheMenge(gezeigt, quellen)
      ) {
        throw new FunktionsFehler(
          409,
          "vorgang_geaendert",
          "Das Gespräch oder deine Rechte an seinen Quellen haben sich seit der Vorschau geändert. Bitte die Vorschau erneuern; gespeichert wurde nichts.",
        );
      }
    }
    // Nacharbeit 5 (Ben): ein nach der Vorschau geänderter Text (getippt oder diktiert) ergäbe eine
    // andere Definition als die angezeigte. Sie wird gegen Name und Ausgangssatz der Vorschau
    // geprüft; mit Vorgang immer (Pflicht oben), ohne Vorgang, sobald die Vorschau mitgeschickt wird.
    const gezeigtName = eingabe.vorschauName;
    const gezeigtSatz = eingabe.vorschauAusgangstext;
    if (
      (gezeigtName !== undefined && gezeigtName !== entwurf.name) ||
      (gezeigtSatz !== undefined && gezeigtSatz !== entwurf.ausgangstext)
    ) {
      throw new FunktionsFehler(
        409,
        "vorgang_geaendert",
        "Der Text wurde seit der Vorschau geändert. Bitte die Vorschau erneuern; gespeichert wurde nichts.",
      );
    }
    const art: FunktionsArt = eingabe.art === "vorschlag" ? "vorschlag" : "favorit";
    const name = eingabe.name === undefined ? entwurf.name : pruefeName(eingabe.name);
    if ((await this.repo.eigene(kontoId)).length >= FUNKTIONEN_MAX_JE_KONTO) {
      throw new FunktionsFehler(
        409,
        "voll",
        `Höchstens ${FUNKTIONEN_MAX_JE_KONTO} persönliche Funktionen je Konto.`,
      );
    }
    const jetzt = this.jetztIso();
    const funktion: PersoenlicheFunktion = {
      id: this.neueId(),
      kontoId,
      art,
      stand: art === "vorschlag" ? "vorschlag" : "aktiv",
      fassungen: [
        {
          version: 1,
          herkunft,
          name,
          zweck: entwurf.zweck,
          thema: entwurf.thema,
          ablauf: "angebote_einholen",
          ausgangstext: entwurf.ausgangstext,
          eingabeweg: entwurf.eingabeweg,
          parameter: entwurf.parameter,
          quellen: [...quellen],
          quellenregel: entwurf.quellenregel,
          erlaubteSchritte: entwurf.erlaubteSchritte,
          aussenaktionen: entwurf.aussenaktionen,
          empfaengerregel: entwurf.empfaengerregel,
          ergebnis: entwurf.ergebnis,
          fehlerregel: entwurf.fehlerregel,
          stopregel: entwurf.stopregel,
          angelegtAm: jetzt,
        },
      ],
      zeitauftrag: null,
      laeufe: [],
      rev: 1,
      angelegtAm: jetzt,
      geaendertAm: jetzt,
    };
    await this.schreibe(funktion);
    return { funktion, beispielwerte: entwurf.beispielwerte, nichtUebernommen };
  }

  private async schreibe(f: PersoenlicheFunktion): Promise<void> {
    if (siehtGeheimAus(JSON.stringify(f)))
      throw new FunktionsFehler(
        400,
        "eingabe",
        "Zugangsdaten gehören nicht in eine persönliche Funktion.",
      );
    if (!(await this.repo.schreibe(f))) {
      throw new FunktionsFehler(
        409,
        "konflikt",
        "Die Funktion wurde inzwischen an anderer Stelle geändert. Bitte neu laden.",
      );
    }
  }

  private async holeMitRev(kontoId: string, id: string, rev: unknown) {
    const f = await this.hole(kontoId, id);
    if (typeof rev !== "number" || !Number.isSafeInteger(rev)) {
      throw new FunktionsFehler(400, "eingabe", "rev ist Pflicht (die zuletzt gesehene Marke).");
    }
    if (rev !== f.rev) {
      throw new FunktionsFehler(
        409,
        "konflikt",
        "Die Funktion wurde inzwischen an anderer Stelle geändert. Bitte neu laden.",
      );
    }
    return f;
  }

  /**
   * Ändern, Pausieren, Fortsetzen, Deaktivieren, Übernehmen eines Vorschlags. Name, Zweck oder
   * Quellen ergeben eine NEUE Fassung; der Stand allein nicht. Läufe bleiben, wie sie waren.
   */
  async aendere(
    kontoId: string,
    id: string,
    eingabe: FunktionAendernEingabe,
    lesen: QuelleLesen,
  ): Promise<PersoenlicheFunktion> {
    const alt = await this.holeMitRev(kontoId, id, eingabe.rev);
    const fassung = aktuelleFassung(alt);
    const name = eingabe.name === undefined ? fassung.name : pruefeName(eingabe.name);
    let zweck = fassung.zweck;
    if (eingabe.zweck !== undefined) {
      const neu = text(eingabe.zweck);
      if (neu === null || neu.length > FUNKTION_TEXT_MAX) {
        throw new FunktionsFehler(
          400,
          "eingabe",
          `Der Zweck ist höchstens ${FUNKTION_TEXT_MAX} Zeichen lang.`,
        );
      }
      zweck = neu;
    }
    let quellen = fassung.quellen;
    if (eingabe.quellen !== undefined) {
      quellen = pruefeQuellenListe(eingabe.quellen);
      await this.quellenSichtbar(
        quellen.filter((q) => !fassung.quellen.includes(q)),
        lesen,
      );
    }
    // Quellen aus EINEM Fall eines Gesprächs ergänzen (Nacharbeit 4: eindeutig oder gewählt) — nur
    // die, die das Konto jetzt sehen darf.
    const g = await this.gespraechAus(kontoId, eingabe.gespraech);
    if (g !== null) {
      const fall = waehleFall(g, eingabe.abschnitt);
      const ergaenzt = [...quellen];
      for (const koId of quellenDesFalls(g, fall)) {
        const frei = ergaenzt.length < FUNKTION_MAX_QUELLEN && !ergaenzt.includes(koId);
        if (frei && gelesen(await lesen(koId))) {
          ergaenzt.push(koId);
        }
      }
      quellen = ergaenzt;
    }
    let stand = alt.stand;
    if (eingabe.stand !== undefined && eingabe.stand !== alt.stand) {
      const ziel = eingabe.stand as FunktionsStand;
      if (!STAND_WECHSEL[alt.stand].includes(ziel)) {
        throw new FunktionsFehler(
          400,
          "eingabe",
          `Von ${alt.stand} geht es nur nach ${STAND_WECHSEL[alt.stand].join(" oder ")}.`,
        );
      }
      stand = ziel;
    }
    const vertragGeaendert =
      name !== fassung.name ||
      zweck !== fassung.zweck ||
      quellen.length !== fassung.quellen.length ||
      quellen.some((q, i) => q !== fassung.quellen[i]);
    const jetzt = this.jetztIso();
    const neu: PersoenlicheFunktion = {
      ...alt,
      stand,
      zeitauftrag:
        stand === "aktiv" && alt.stand === "pausiert" && alt.zeitauftrag
          ? { ...alt.zeitauftrag, fortgesetztAm: jetzt }
          : alt.zeitauftrag,
      // Ein übernommener Vorschlag ist ab jetzt ein Favorit.
      art: alt.art === "vorschlag" && stand === "aktiv" ? "favorit" : alt.art,
      fassungen: vertragGeaendert
        ? [
            ...alt.fassungen,
            { ...fassung, version: fassung.version + 1, name, zweck, quellen, angelegtAm: jetzt },
          ]
        : alt.fassungen,
      rev: alt.rev + 1,
      geaendertAm: jetzt,
    };
    await this.schreibe(neu);
    return neu;
  }

  /**
   * Richtet die Serie AUSDRÜCKLICH ein (BES-07-K06). Sie wird gespeichert und berechnet, aber nicht
   * im gemeinsamen D-Takt zur Vorbereitung ausgelöst; kein Angebotsergebnis wird simuliert.
   */
  async setzeZeitauftrag(
    kontoId: string,
    id: string,
    eingabe: ZeitauftragEingabe,
  ): Promise<{ funktion: PersoenlicheFunktion; vorschau: VorschauTermin[] }> {
    const alt = await this.holeMitRev(kontoId, id, eingabe.rev);
    if (alt.stand === "vorschlag" || alt.stand === "deaktiviert") {
      throw new FunktionsFehler(
        409,
        "nicht_aufrufbar",
        "Eine Serie braucht eine übernommene, nicht deaktivierte Funktion.",
      );
    }
    if (eingabe.rhythmus !== "woechentlich" && eingabe.rhythmus !== "monatlich") {
      throw new FunktionsFehler(400, "eingabe", "rhythmus muss woechentlich oder monatlich sein.");
    }
    if (!istDatum(eingabe.beginn)) {
      throw new FunktionsFehler(400, "eingabe", "beginn ist ein Datum JJJJ-MM-TT.");
    }
    let ende: string | null = null;
    if (eingabe.ende !== undefined && eingabe.ende !== null) {
      if (!istDatum(eingabe.ende) || eingabe.ende < eingabe.beginn) {
        throw new FunktionsFehler(400, "eingabe", "ende ist ein Datum JJJJ-MM-TT ab beginn.");
      }
      ende = eingabe.ende;
    }
    if (typeof eingabe.uhrzeit !== "string" || !UHRZEIT.test(eingabe.uhrzeit)) {
      throw new FunktionsFehler(400, "eingabe", "uhrzeit ist eine Ortszeit HH:MM.");
    }
    const zeitzone = eingabe.zeitzone === undefined ? STANDARD_ZEITZONE : eingabe.zeitzone;
    if (!istZeitzone(zeitzone)) {
      throw new FunktionsFehler(400, "eingabe", "zeitzone ist keine bekannte Zeitzone.");
    }
    if (eingabe.nachholen !== "einmal" && eingabe.nachholen !== "nie") {
      throw new FunktionsFehler(400, "eingabe", "nachholen muss einmal oder nie sein.");
    }
    const jetzt = this.jetztIso();
    const zeitauftrag: Zeitauftrag = {
      rhythmus: eingabe.rhythmus,
      beginn: eingabe.beginn,
      ende,
      uhrzeit: eingabe.uhrzeit,
      zeitzone,
      nachholen: eingabe.nachholen,
      eingerichtetAm: jetzt,
      ausfuehrung: "vorbereitung",
    };
    const neu: PersoenlicheFunktion = {
      ...alt,
      zeitauftrag,
      rev: alt.rev + 1,
      geaendertAm: jetzt,
    };
    await this.schreibe(neu);
    return { funktion: neu, vorschau: naechsteTermine(zeitauftrag, this.jetzt()) };
  }

  async entferneZeitauftrag(
    kontoId: string,
    id: string,
    rev: unknown,
  ): Promise<PersoenlicheFunktion> {
    const alt = await this.holeMitRev(kontoId, id, rev);
    const neu: PersoenlicheFunktion = {
      ...alt,
      zeitauftrag: null,
      rev: alt.rev + 1,
      geaendertAm: this.jetztIso(),
    };
    await this.schreibe(neu);
    return neu;
  }

  vorschau(f: PersoenlicheFunktion): VorschauTermin[] {
    return f.zeitauftrag ? naechsteTermine(f.zeitauftrag, this.jetzt()) : [];
  }

  /**
   * Der ausdrückliche manuelle Aufruf (BES-07-K05). Er nimmt die Parameter DIESES Aufrufs, liest
   * jede Quelle jetzt mit den Rechten von jetzt und hält Rolle und Zeitpunkt fest. Aus früheren
   * Läufen wird nichts übernommen. Er endet ehrlich bei der ersten fehlenden Fähigkeit; nach außen
   * geschieht nichts.
   */
  async laufVorbereiten(
    kontoId: string,
    id: string,
    eingabe: LaufEingabe,
    kontext: LaufKontext,
  ): Promise<{ funktion: PersoenlicheFunktion; lauf: FunktionsLauf }> {
    return this.bereiteLauf(kontoId, id, eingabe, kontext);
  }

  /** Nur der gemeinsame Zeitsteuerungsanschluss ruft dies auf; nie ein Feld aus dem HTTP-Rumpf. */
  async zeitLauf(
    kontoId: string,
    id: string,
    kontext: LaufKontext,
    termin: string,
  ): Promise<{ funktion: PersoenlicheFunktion; lauf: FunktionsLauf }> {
    const vorhanden = await this.hole(kontoId, id);
    const lauf = vorhanden.laeufe.find((l) => l.termin === termin);
    if (lauf) return { funktion: vorhanden, lauf };
    return this.bereiteLauf(kontoId, id, {}, kontext, termin);
  }

  private async bereiteLauf(
    kontoId: string,
    id: string,
    eingabe: LaufEingabe,
    kontext: LaufKontext,
    termin?: string,
  ): Promise<{ funktion: PersoenlicheFunktion; lauf: FunktionsLauf }> {
    const alt = await this.hole(kontoId, id);
    if (alt.stand !== "aktiv") {
      throw new FunktionsFehler(
        409,
        "nicht_aufrufbar",
        alt.stand === "pausiert"
          ? "Die Funktion ist pausiert. Erst fortsetzen, dann aufrufen."
          : alt.stand === "deaktiviert"
            ? "Die Funktion ist deaktiviert."
            : "Ein Vorschlag ist erst nach deiner Übernahme aufrufbar.",
      );
    }
    if (alt.laeufe.length >= FUNKTION_MAX_LAEUFE) {
      throw new FunktionsFehler(409, "voll", "Diese Funktion hat die Höchstzahl an Läufen.");
    }
    const fassung = aktuelleFassung(alt);
    const roh =
      eingabe.parameter && typeof eingabe.parameter === "object"
        ? (eingabe.parameter as Record<string, unknown>)
        : {};
    const werte: Partial<Record<ParameterName, string>> = {};
    for (const p of fassung.parameter) {
      const wert = text(roh[p.name]);
      if (wert !== null) {
        if (siehtGeheimAus(wert))
          throw new FunktionsFehler(
            400,
            "eingabe",
            "Zugangsdaten gehören nicht in Funktionsparameter.",
          );
        if (wert.length > PARAMETER_WERT_MAX) {
          throw new FunktionsFehler(
            400,
            "eingabe",
            `${p.bezeichnung} ist höchstens ${PARAMETER_WERT_MAX} Zeichen lang.`,
          );
        }
        werte[p.name] = wert;
      }
    }
    const fehlend = fassung.parameter.filter((p) => p.pflicht && !werte[p.name]);
    if (fehlend.length > 0 && !termin) {
      const liste = fehlend.map((p) => p.bezeichnung).join(", ");
      throw new FunktionsFehler(
        400,
        "angabe_fehlt",
        `Für diesen Lauf fehlt: ${liste}.`,
        fehlend.map((p) => p.name),
      );
    }
    const jetzt = this.jetztIso();
    const quellen: LaufQuelle[] = [];
    // R07/K05: eine fehlende Quelle ist eine fachliche Lücke, keine Adapterfrage — sie wird gezielt
    // als Handlungsbedarf benannt und verschwindet nicht hinter den offenen Fähigkeiten.
    const klaerung: Klaerung[] =
      fehlend.length > 0
        ? [{ art: "parameter_fehlen", koId: null, hinweis: KLAERUNG_HINWEIS.parameter_fehlen }]
        : [];
    if (fassung.quellen.length === 0) {
      klaerung.push({ art: "keine_quelle", koId: null, hinweis: KLAERUNG_HINWEIS.keine_quelle });
    }
    for (const koId of fassung.quellen) {
      let lesung: QuellenLesung;
      try {
        lesung = await kontext.quelleLesen(koId);
      } catch {
        lesung = "nicht_erreichbar";
      }
      if (gelesen(lesung)) {
        quellen.push({ koId, zustand: "gelesen", fassung: lesung.fassung, status: lesung.status });
        continue;
      }
      const zustand = lesung ?? "nicht_zugaenglich";
      const art = KLAERUNG_JE_ZUSTAND[zustand];
      quellen.push({ koId, zustand, fassung: null, status: null });
      klaerung.push({ art, koId, hinweis: KLAERUNG_HINWEIS[art] });
    }
    const lauf: FunktionsLauf = {
      id: this.neueId(),
      fassung: fassung.version,
      ausloeser: termin ? "zeitplan" : "manuell",
      ...(termin ? { termin } : {}),
      ausgeloestAm: jetzt,
      parameterwerte: werte,
      rechte: { rolle: kontext.rolle, geprueftAm: jetzt },
      quellen,
      stand: klaerung.length > 0 ? "klaerung_noetig" : "wartet_auf_faehigkeit",
      klaerung,
      offen: this.offeneFaehigkeiten().map((f) => f.id),
      aussenwirkung: "keine",
    };
    const neu: PersoenlicheFunktion = {
      ...alt,
      laeufe: [...alt.laeufe, lauf],
      rev: alt.rev + 1,
      geaendertAm: jetzt,
    };
    await this.schreibe(neu);
    return { funktion: neu, lauf };
  }
}
