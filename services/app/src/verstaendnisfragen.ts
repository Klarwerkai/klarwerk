import type { Pool } from "pg";
import type { Role } from "../../auth";
import { type KnowledgeObject, responsibleOf } from "../../knowledge-object";
import { can } from "../../rbac";

// ================================================================================================
// VERSTÄNDNISFRAGEN ZU EINER GÜLTIGEN WISSENSFASSUNG (aufnahme:20260922:gesamt-lernwege, Zusatz
// vom 03.10.2026).
// ================================================================================================
//
// WAS DAS IST. Ein kurzer Fragensatz, gebunden an GENAU EINE Fassung eines Wissenseintrags (etwa
// V2). Die fachlich verantwortliche Person (Verantwortung am Eintrag, `responsibleOf`) oder eine
// Person mit Freigaberecht legt Fragen, Antwortmöglichkeiten, richtige Antworten, Erläuterung und
// die wörtliche Belegstelle an. Lernende beantworten den angenommenen Fragensatz und bekommen nach
// der Abgabe eine Rückmeldung mit Sprung an die Belegstelle.
//
// WAS DAS AUSDRÜCKLICH NICHT IST: kein Befähigungs- oder Kompetenznachweis, keine Zertifizierung,
// keine Rangliste. Lesen (Lernpfad-Haken, Kenntnisnahme), bestandene Verständnisfragen und
// praktische Befähigung bleiben drei getrennte Dinge; dieser Dienst kennt nur das mittlere.
//
// KONTOREGEL — DIE BESTEHENDE, KEINE NEUE ROLLE (dieselbe Zuordnung wie die Arbeitsanleitung,
// `routes/gesamtanweisung-routes.ts`):
//   anlegen, ändern, vorlegen   `ko.create` + Verantwortung am Eintrag (oder `ko.validate`)
//   annehmen, zurückweisen      `ko.validate`  — direkte Annahme durch die berechtigte Person;
//                               Vorlegen ist die freiwillige Zweitprüfung.
//   beantworten, eigene Ergebnisse   `ko.read`
//   Ergebnisse anderer          nur, wer den Fragensatz bearbeiten darf (Verantwortung/Freigaberecht)
// Sichtbarkeit des Eintrags entscheidet weiter allein `darfSehen` (an den Routen).
//
// BELEG STATT BEHAUPTUNG. Eine Frage ist erst veröffentlichbar, wenn ihre Belegstelle WÖRTLICH
// (Leerraum zusammengefasst) im Text der gebundenen Fassung steht — dieselbe Ankerregel, nach der
// die Wissensansicht eine Stelle anspringt (`apps/web/src/lib/belegstelle.ts`). Ohne Fundstelle
// gibt es keine Annahme und damit keine „richtige" Musterantwort. Fehlt die Quelle beim Abgeben
// (Eintrag weg, Fassung nicht mehr vergleichbar, fachlich geändert), wird NICHT bewertet.
//
// UNVERÄNDERLICHE FASSUNGEN. Jede inhaltliche Änderung ist eine neue Fragensatzversion; eine
// gespeicherte Version ändert danach nur noch ihren Status. Ein Ergebnis nennt Person, Eintrag,
// Wissensfassung, Fragensatzversion und Zeitpunkt und behält seine Bewertung — eine spätere
// Änderung von Fragen oder Quelle schreibt kein Ergebnis um und überträgt keines auf den neuen Stand.
//
// KEIN KI-AUFRUF, KEIN EXTERNER DIENST. Bewertung und Belegprüfung sind deterministisch; diese Datei
// importiert weder Reasoner noch Embedder noch einen Netzwerkweg. KI-Vorschläge für Fragen sind
// NICHT Teil dieser Lieferung (s. docs/verstaendnisfragen.md, Grenzen).

// ------------------------------------------------------------------------------------------------
// DIE GRÖSSEN
// ------------------------------------------------------------------------------------------------

export const VERSTAENDNIS_GRENZEN = {
  titel: 200,
  fragen: 30,
  optionen: 8,
  text: 2000,
  belegMin: 8,
  /** Gleich `STELLE_MAX` der Belegstelle — länger reist kein Anker in die Adresse. */
  belegMax: 600,
  versucheMax: 20,
  begruendung: 1000,
} as const;

export type FragensatzStatus = "entwurf" | "vorgelegt" | "angenommen" | "zurueckgewiesen";

export interface Antwortmoeglichkeit {
  id: string;
  text: string;
}

export interface Verstaendnisfrage {
  id: string;
  text: string;
  optionen: Antwortmoeglichkeit[];
  /** Kennungen der richtigen Antwortmöglichkeiten. */
  richtig: string[];
  erlaeuterung: string;
  /** Die wörtliche Stelle der gebundenen Fassung, aus der die Frage beantwortbar ist. */
  beleg: string;
}

/**
 * Bestehensregel und Wiederholung — sichtbar festgelegt, nie vorbelegt. `null` heisst „noch nicht
 * festgelegt" und ist nur im Entwurf zulässig.
 */
export interface Regel {
  mindestRichtig: number | null;
  /** 1 = keine Wiederholung; `"unbegrenzt"` = beliebig oft. */
  hoechstVersuche: number | "unbegrenzt" | null;
}

export interface FragensatzFassung {
  id: string;
  /** Die Fragensatzversion — steigt mit jeder inhaltlichen Änderung. */
  version: number;
  koId: string;
  /** Die gebundene Wissensfassung. */
  koVersion: number;
  titel: string;
  /** Zuordnung: in welchen Lernpfaden (Rollen) der Fragensatz erscheint. */
  rollen: Role[];
  fragen: Verstaendnisfrage[];
  regel: Regel;
  status: FragensatzStatus;
  geaendertVon: string;
  geaendertAm: string;
  vorgelegtVon: string | null;
  vorgelegtAm: string | null;
  entschiedenVon: string | null;
  entschiedenAm: string | null;
  begruendung: string | null;
}

export type Urteil = "richtig" | "falsch" | "unbeantwortet";

export interface Bewertung {
  je: { frageId: string; urteil: Urteil }[];
  richtig: number;
  fragen: number;
  unbeantwortet: number;
  /** Die Regel, nach der bewertet wurde — mitgespeichert, damit das Ergebnis für sich steht. */
  mindestRichtig: number;
  bestanden: boolean;
  unvollstaendig: boolean;
}

export interface Versuch {
  /** Vom Client je Abgabe erzeugt — dieselbe Kennung zweimal ist DERSELBE Versuch. */
  id: string;
  personId: string;
  fragensatzId: string;
  fragensatzVersion: number;
  koId: string;
  koVersion: number;
  /** Der wievielte Versuch dieser Person an dieser Fragensatzversion. */
  nummer: number;
  abgegebenAm: string;
  antworten: { frageId: string; gewaehlt: string[] }[];
  bewertung: Bewertung;
}

/** Wie die gebundene Fassung zum heutigen Eintrag steht. */
export type Quellenlage = "aktuell" | "geaendert" | "nicht_gueltig" | "fehlt";

const ROLLEN: readonly Role[] = ["viewer", "experte", "controller", "admin"];

// ------------------------------------------------------------------------------------------------
// DIE REINEN REGELN
// ------------------------------------------------------------------------------------------------

/** Leerraum zusammenfassen — dieselbe Normalform wie `passageNormal` der Belegstelle. */
export function textNormal(text: string): string {
  return text.normalize("NFC").replace(/\s+/g, " ").trim();
}

const ENTITAETEN: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Der lesbare Text eines bereinigten HTML-Körpers (Tags weg, gängige Entitäten aufgelöst). */
export function htmlText(html: string): string {
  return html
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\b[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (ganz, name: string) => {
      if (name.startsWith("#x") || name.startsWith("#X")) {
        return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
      }
      if (name.startsWith("#")) {
        return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
      }
      return ENTITAETEN[name.toLowerCase()] ?? ganz;
    });
}

type Quellteile = Pick<KnowledgeObject, "title" | "statement" | "conditions" | "measures"> & {
  bodyHtml?: string | null;
};

/** Der Text einer Fassung, in dem eine Belegstelle stehen muss. */
export function quelltext(ko: Quellteile): string {
  return textNormal(
    [
      ko.title,
      ko.statement,
      ko.bodyHtml ? htmlText(ko.bodyHtml) : "",
      ...(ko.conditions ?? []),
      ...(ko.measures ?? []),
    ].join("\n"),
  );
}

/**
 * Die fachliche Gleichheit zweier Fassungen: derselbe lesbare Inhalt. Eine reine Bestätigung
 * („Noch gültig", neue Versionsnummer ohne Inhaltsänderung) ist KEINE fachliche Änderung.
 */
export function gleicherInhalt(a: Quellteile, b: Quellteile): boolean {
  return quelltext(a) === quelltext(b);
}

/** Steht die Belegstelle wörtlich im Text? */
export function belegGefunden(beleg: string, text: string): boolean {
  const stelle = textNormal(beleg);
  return stelle.length >= VERSTAENDNIS_GRENZEN.belegMin && text.includes(stelle);
}

export type FragenBefund =
  | "frage_fehlt"
  | "zu_wenige_optionen"
  | "option_leer"
  | "keine_richtige_antwort"
  | "erlaeuterung_fehlt"
  | "beleg_fehlt"
  | "beleg_nicht_in_quelle";

export type SatzBefund =
  | "keine_fragen"
  | "regel_fehlt"
  | "regel_ungueltig"
  | "wiederholung_fehlt"
  | "wiederholung_ungueltig"
  | "quelle_geaendert"
  | "quelle_nicht_gueltig"
  | "quelle_fehlt";

const QUELLENBEFUND: Record<Exclude<Quellenlage, "aktuell">, SatzBefund> = {
  geaendert: "quelle_geaendert",
  nicht_gueltig: "quelle_nicht_gueltig",
  fehlt: "quelle_fehlt",
};

export interface Befunde {
  satz: SatzBefund[];
  fragen: { frageId: string; befunde: FragenBefund[] }[];
}

/** Ist nichts zu beanstanden? Erst dann darf der Fragensatz vorgelegt oder angenommen werden. */
export function ohneBefund(b: Befunde): boolean {
  return b.satz.length === 0 && b.fragen.every((f) => f.befunde.length === 0);
}

/**
 * Was einer Veröffentlichung im Weg steht. `text` ist der Quelltext der GEBUNDENEN Fassung — `null`,
 * wenn sie nicht vorliegt; dann kann keine Belegstelle als gefunden gelten.
 */
export function befundeFuer(
  fassung: Pick<FragensatzFassung, "fragen" | "regel">,
  text: string | null,
  lage: Quellenlage,
): Befunde {
  const satz: SatzBefund[] = [];
  if (fassung.fragen.length === 0) {
    satz.push("keine_fragen");
  }
  const { mindestRichtig, hoechstVersuche } = fassung.regel;
  if (mindestRichtig === null) {
    satz.push("regel_fehlt");
  } else if (
    !Number.isInteger(mindestRichtig) ||
    mindestRichtig < 1 ||
    mindestRichtig > Math.max(1, fassung.fragen.length)
  ) {
    satz.push("regel_ungueltig");
  }
  if (hoechstVersuche === null) {
    satz.push("wiederholung_fehlt");
  } else if (
    hoechstVersuche !== "unbegrenzt" &&
    (!Number.isInteger(hoechstVersuche) ||
      hoechstVersuche < 1 ||
      hoechstVersuche > VERSTAENDNIS_GRENZEN.versucheMax)
  ) {
    satz.push("wiederholung_ungueltig");
  }
  if (lage !== "aktuell") {
    satz.push(QUELLENBEFUND[lage]);
  }
  const fragen = fassung.fragen.map((frage) => {
    const befunde: FragenBefund[] = [];
    if (textNormal(frage.text).length === 0) {
      befunde.push("frage_fehlt");
    }
    if (frage.optionen.length < 2) {
      befunde.push("zu_wenige_optionen");
    }
    if (frage.optionen.some((o) => textNormal(o.text).length === 0)) {
      befunde.push("option_leer");
    }
    const ids = new Set(frage.optionen.map((o) => o.id));
    if (frage.richtig.length === 0 || frage.richtig.some((r) => !ids.has(r))) {
      befunde.push("keine_richtige_antwort");
    }
    if (textNormal(frage.erlaeuterung).length === 0) {
      befunde.push("erlaeuterung_fehlt");
    }
    if (textNormal(frage.beleg).length === 0) {
      befunde.push("beleg_fehlt");
    } else if (text === null || !belegGefunden(frage.beleg, text)) {
      befunde.push("beleg_nicht_in_quelle");
    }
    return { frageId: frage.id, befunde };
  });
  return { satz, fragen };
}

/**
 * Bewertet die Antworten nach der festgelegten Regel. Eine Frage ist richtig, wenn GENAU die
 * richtigen Möglichkeiten gewählt sind; ohne Wahl ist sie unbeantwortet und zählt — wie die
 * sichtbare Regel sagt — als nicht richtig. Wirft, wenn die Regel nicht vollständig ist: ohne
 * festgelegte Regel gibt es keine Bewertung.
 */
export function bewerte(
  fassung: Pick<FragensatzFassung, "fragen" | "regel">,
  antworten: readonly { frageId: string; gewaehlt: readonly string[] }[],
): Bewertung {
  const mindestRichtig = fassung.regel.mindestRichtig;
  if (mindestRichtig === null) {
    throw new VerstaendnisFehler(
      409,
      "regel_fehlt",
      "Für diesen Fragensatz ist keine Regel festgelegt.",
    );
  }
  const gewaehlt = new Map(antworten.map((a) => [a.frageId, new Set(a.gewaehlt)] as const));
  const je = fassung.fragen.map((frage) => {
    const wahl = gewaehlt.get(frage.id) ?? new Set<string>();
    const urteil: Urteil =
      wahl.size === 0
        ? "unbeantwortet"
        : wahl.size === frage.richtig.length && frage.richtig.every((r) => wahl.has(r))
          ? "richtig"
          : "falsch";
    return { frageId: frage.id, urteil };
  });
  const richtig = je.filter((e) => e.urteil === "richtig").length;
  const unbeantwortet = je.filter((e) => e.urteil === "unbeantwortet").length;
  return {
    je,
    richtig,
    fragen: je.length,
    unbeantwortet,
    mindestRichtig,
    bestanden: richtig >= mindestRichtig,
    unvollstaendig: unbeantwortet > 0,
  };
}

/** Die angenommene Version, die Lernende bearbeiten — die höchste mit Status „angenommen". */
export function gueltigeFassung(fassungen: readonly FragensatzFassung[]): FragensatzFassung | null {
  let beste: FragensatzFassung | null = null;
  for (const f of fassungen) {
    if (f.status === "angenommen" && (beste === null || f.version > beste.version)) {
      beste = f;
    }
  }
  return beste;
}

/** Die jüngste Version — an ihr wird weitergearbeitet. */
export function juengsteFassung(fassungen: readonly FragensatzFassung[]): FragensatzFassung | null {
  let juengste: FragensatzFassung | null = null;
  for (const f of fassungen) {
    if (juengste === null || f.version > juengste.version) {
      juengste = f;
    }
  }
  return juengste;
}

// ------------------------------------------------------------------------------------------------
// DIE EINGABE
// ------------------------------------------------------------------------------------------------

export interface FragensatzEingabe {
  koVersion: number;
  titel: string;
  rollen: Role[];
  regel: Regel;
  fragen: {
    text: string;
    optionen: string[];
    /** Positionen (0-basiert) der richtigen Möglichkeiten. */
    richtig: number[];
    erlaeuterung: string;
    beleg: string;
  }[];
}

function eingabefehler(message: string): VerstaendnisFehler {
  return new VerstaendnisFehler(400, "eingabe", message);
}

function textFeld(wert: unknown, grenze: number, was: string): string {
  if (wert === undefined || wert === null) {
    return "";
  }
  if (typeof wert !== "string" || wert.length > grenze) {
    throw eingabefehler(`${was} ist kein Text oder zu lang.`);
  }
  return wert.normalize("NFC").trim();
}

/**
 * Prüft den Rumpf eines Fragensatzes auf seine FORM (Typen, Längen, Grenzen) und gibt ihn bereinigt
 * zurück — oder wirft. Was fachlich fehlt (Belegstelle, richtige Antwort, Regel), ist kein
 * Formfehler: es steht danach als Befund am Entwurf und verhindert nur Vorlage und Annahme.
 */
export function pruefeEingabe(roh: unknown): FragensatzEingabe {
  if (typeof roh !== "object" || roh === null) {
    throw eingabefehler("Erwartet wird ein Fragensatz als Objekt.");
  }
  const r = roh as Record<string, unknown>;
  const koVersion = r.koVersion;
  if (typeof koVersion !== "number" || !Number.isInteger(koVersion) || koVersion < 1) {
    throw eingabefehler("Die Wissensfassung fehlt.");
  }
  const titel = textFeld(r.titel, VERSTAENDNIS_GRENZEN.titel, "Der Titel");
  if (titel.length === 0) {
    throw eingabefehler("Der Titel fehlt.");
  }
  const rollenRoh = r.rollen ?? [];
  if (!Array.isArray(rollenRoh) || rollenRoh.length > ROLLEN.length) {
    throw eingabefehler("Die Zuordnung ist keine gültige Rollenliste.");
  }
  const rollen: Role[] = [];
  for (const rolle of rollenRoh) {
    const bekannt = ROLLEN.find((x) => x === rolle);
    if (bekannt === undefined) {
      throw eingabefehler("Die Zuordnung nennt eine unbekannte Rolle.");
    }
    if (!rollen.includes(bekannt)) {
      rollen.push(bekannt);
    }
  }
  const regelRoh = (typeof r.regel === "object" && r.regel !== null ? r.regel : {}) as Record<
    string,
    unknown
  >;
  const mindest = regelRoh.mindestRichtig;
  if (mindest !== undefined && mindest !== null && typeof mindest !== "number") {
    throw eingabefehler("Die Bestehensregel ist keine Zahl.");
  }
  const versuche = regelRoh.hoechstVersuche;
  if (
    versuche !== undefined &&
    versuche !== null &&
    versuche !== "unbegrenzt" &&
    typeof versuche !== "number"
  ) {
    throw eingabefehler("Die Wiederholung ist keine Zahl und nicht „unbegrenzt“.");
  }
  const fragenRoh = r.fragen ?? [];
  if (!Array.isArray(fragenRoh) || fragenRoh.length > VERSTAENDNIS_GRENZEN.fragen) {
    throw eingabefehler(`Höchstens ${VERSTAENDNIS_GRENZEN.fragen} Fragen je Fragensatz.`);
  }
  const fragen = fragenRoh.map((eintrag, i) => {
    const f = (typeof eintrag === "object" && eintrag !== null ? eintrag : {}) as Record<
      string,
      unknown
    >;
    const optionenRoh = f.optionen ?? [];
    if (!Array.isArray(optionenRoh) || optionenRoh.length > VERSTAENDNIS_GRENZEN.optionen) {
      throw eingabefehler(
        `Frage ${i + 1}: höchstens ${VERSTAENDNIS_GRENZEN.optionen} Antwortmöglichkeiten.`,
      );
    }
    const optionen = optionenRoh.map((o) =>
      textFeld(o, VERSTAENDNIS_GRENZEN.text, `Frage ${i + 1}: eine Antwortmöglichkeit`),
    );
    const richtigRoh = f.richtig ?? [];
    if (!Array.isArray(richtigRoh)) {
      throw eingabefehler(`Frage ${i + 1}: die richtigen Antworten sind keine Liste.`);
    }
    const richtig: number[] = [];
    for (const pos of richtigRoh) {
      if (typeof pos !== "number" || !Number.isInteger(pos) || pos < 0 || pos >= optionen.length) {
        throw eingabefehler(`Frage ${i + 1}: eine richtige Antwort nennt keine Möglichkeit.`);
      }
      if (!richtig.includes(pos)) {
        richtig.push(pos);
      }
    }
    return {
      text: textFeld(f.text, VERSTAENDNIS_GRENZEN.text, `Frage ${i + 1}`),
      optionen,
      richtig: richtig.sort((a, b) => a - b),
      erlaeuterung: textFeld(
        f.erlaeuterung,
        VERSTAENDNIS_GRENZEN.text,
        `Frage ${i + 1}: die Erläuterung`,
      ),
      beleg: textFeld(f.beleg, VERSTAENDNIS_GRENZEN.belegMax, `Frage ${i + 1}: die Belegstelle`),
    };
  });
  return {
    koVersion,
    titel,
    rollen,
    regel: {
      mindestRichtig: typeof mindest === "number" ? mindest : null,
      hoechstVersuche:
        versuche === "unbegrenzt" ? "unbegrenzt" : typeof versuche === "number" ? versuche : null,
    },
    fragen,
  };
}

/** Die Fragen einer Eingabe mit stabilen Kennungen je Version (`f1…`, `o1…`). */
export function fragenAus(eingabe: FragensatzEingabe): Verstaendnisfrage[] {
  return eingabe.fragen.map((f, i) => {
    const optionen = f.optionen.map((text, j) => ({ id: `o${j + 1}`, text }));
    return {
      id: `f${i + 1}`,
      text: f.text,
      optionen,
      richtig: f.richtig.map((pos) => `o${pos + 1}`),
      erlaeuterung: f.erlaeuterung,
      beleg: f.beleg,
    };
  });
}

// ------------------------------------------------------------------------------------------------
// DIE ABLAGE
// ------------------------------------------------------------------------------------------------

export type VersuchAblage =
  | { art: "neu"; versuch: Versuch }
  | { art: "vorhanden"; versuch: Versuch }
  | { art: "nummer_belegt" };

export interface VerstaendnisfragenRepo {
  /** Legt eine neue Version ab. `false`, wenn es (Fragensatz, Version) schon gibt. */
  legeFassung(fassung: FragensatzFassung): Promise<boolean>;
  /**
   * Ändert NUR den Status-Teil einer Version, und nur, wenn sie gerade in einem der `vorher`
   * genannten Status steht (Vergleich-und-Setzen). `undefined`: nicht in diesem Status.
   */
  setzeStatus(
    id: string,
    version: number,
    vorher: readonly FragensatzStatus[],
    neu: Pick<
      FragensatzFassung,
      "status" | "vorgelegtVon" | "vorgelegtAm" | "entschiedenVon" | "entschiedenAm" | "begruendung"
    >,
  ): Promise<FragensatzFassung | undefined>;
  /** Alle Versionen eines Fragensatzes, aufsteigend. */
  fassungen(id: string): Promise<FragensatzFassung[]>;
  /** Alle Versionen aller Fragensätze zu einem Eintrag. */
  fassungenZu(koId: string): Promise<FragensatzFassung[]>;
  /** Alle Versionen aller Fragensätze, die einer Rolle zugeordnet sind (die Version entscheidet). */
  fassungenFuerRolle(rolle: Role): Promise<FragensatzFassung[]>;
  /**
   * Legt einen Versuch ab. Gibt es die Kennung schon, ändert sich nichts (`vorhanden`). Ist die
   * Versuchsnummer dieser Person an dieser Version schon belegt (gleichzeitige Abgabe), entsteht
   * nichts (`nummer_belegt`).
   */
  legeVersuch(versuch: Versuch): Promise<VersuchAblage>;
  versuch(id: string): Promise<Versuch | undefined>;
  versucheVon(personId: string): Promise<Versuch[]>;
  versucheZu(fragensatzId: string): Promise<Versuch[]>;
}

export class InMemoryVerstaendnisfragenRepo implements VerstaendnisfragenRepo {
  private readonly saetze = new Map<string, FragensatzFassung[]>();
  private readonly versuche = new Map<string, Versuch>();

  /**
   * `haltbarkeitZugesagt`: der Betrieb sagt Haltbarkeit zu (Desktop-Journal), diese Ablage kann sie
   * nicht halten. Dann lehnt sie jeden Schreibvorgang ab, statt ein Ergebnis anzunehmen und beim
   * Neustart zu verlieren — dieselbe Regel wie bei der Kenntnisnahme.
   */
  constructor(private readonly haltbarkeitZugesagt = false) {}

  private pruefeHaltbarkeit(): void {
    if (this.haltbarkeitZugesagt) {
      throw new VerstaendnisFehler(
        503,
        "nicht_haltbar",
        "Diese Instanz kann Verständnisfragen nicht dauerhaft ablegen.",
      );
    }
  }

  legeFassung(fassung: FragensatzFassung): Promise<boolean> {
    this.pruefeHaltbarkeit();
    const liste = this.saetze.get(fassung.id) ?? [];
    if (liste.some((f) => f.version === fassung.version)) {
      return Promise.resolve(false);
    }
    liste.push(structuredClone(fassung));
    liste.sort((a, b) => a.version - b.version);
    this.saetze.set(fassung.id, liste);
    return Promise.resolve(true);
  }

  setzeStatus(
    id: string,
    version: number,
    vorher: readonly FragensatzStatus[],
    neu: Parameters<VerstaendnisfragenRepo["setzeStatus"]>[3],
  ): Promise<FragensatzFassung | undefined> {
    this.pruefeHaltbarkeit();
    const f = this.saetze.get(id)?.find((x) => x.version === version);
    if (!f || !vorher.includes(f.status)) {
      return Promise.resolve(undefined);
    }
    Object.assign(f, neu);
    return Promise.resolve(structuredClone(f));
  }

  fassungen(id: string): Promise<FragensatzFassung[]> {
    return Promise.resolve((this.saetze.get(id) ?? []).map((f) => structuredClone(f)));
  }

  fassungenZu(koId: string): Promise<FragensatzFassung[]> {
    return Promise.resolve(
      [...this.saetze.values()]
        .flat()
        .filter((f) => f.koId === koId)
        .map((f) => structuredClone(f)),
    );
  }

  fassungenFuerRolle(rolle: Role): Promise<FragensatzFassung[]> {
    return Promise.resolve(
      [...this.saetze.values()]
        .flat()
        .filter((f) => f.rollen.includes(rolle))
        .map((f) => structuredClone(f)),
    );
  }

  legeVersuch(versuch: Versuch): Promise<VersuchAblage> {
    const vorhanden = this.versuche.get(versuch.id);
    if (vorhanden) {
      return Promise.resolve({ art: "vorhanden", versuch: structuredClone(vorhanden) });
    }
    this.pruefeHaltbarkeit();
    const belegt = [...this.versuche.values()].some(
      (v) =>
        v.fragensatzId === versuch.fragensatzId &&
        v.fragensatzVersion === versuch.fragensatzVersion &&
        v.personId === versuch.personId &&
        v.nummer === versuch.nummer,
    );
    if (belegt) {
      return Promise.resolve({ art: "nummer_belegt" });
    }
    this.versuche.set(versuch.id, structuredClone(versuch));
    return Promise.resolve({ art: "neu", versuch: structuredClone(versuch) });
  }

  versuch(id: string): Promise<Versuch | undefined> {
    const v = this.versuche.get(id);
    return Promise.resolve(v ? structuredClone(v) : undefined);
  }

  versucheVon(personId: string): Promise<Versuch[]> {
    return Promise.resolve(
      [...this.versuche.values()]
        .filter((v) => v.personId === personId)
        .map((v) => structuredClone(v)),
    );
  }

  versucheZu(fragensatzId: string): Promise<Versuch[]> {
    return Promise.resolve(
      [...this.versuche.values()]
        .filter((v) => v.fragensatzId === fragensatzId)
        .map((v) => structuredClone(v)),
    );
  }
}

/**
 * Zwei Tabellen. Die Fassungen: (Fragensatz, Version) eindeutig — zwei gleichzeitige Änderungen
 * desselben gelesenen Stands, eine gewinnt. Die Versuche: die Kennung ist die Sperre gegen eine
 * doppelte Abgabe; (Fragensatz, Version, Person, Nummer) eindeutig ist die Sperre gegen zwei
 * gleichzeitige Versuche über die Wiederholungsgrenze hinaus. Rein additiv und wiederholbar, kein
 * Fremdschlüssel auf `kos` (dieselbe Begründung wie bei der Kenntnisnahme: ein gelöschter Eintrag
 * nimmt seine Nachweise nicht mit).
 */
export const VERSTAENDNISFRAGEN_SCHEMA = `
CREATE TABLE IF NOT EXISTS verstaendnis_fragensaetze (
  fragensatz_id text NOT NULL,
  version integer NOT NULL,
  ko_id text NOT NULL,
  data jsonb NOT NULL,
  PRIMARY KEY (fragensatz_id, version)
);
CREATE INDEX IF NOT EXISTS idx_verstaendnis_fragensaetze_ko ON verstaendnis_fragensaetze(ko_id);
CREATE TABLE IF NOT EXISTS verstaendnis_versuche (
  versuch_id text PRIMARY KEY,
  person_id text NOT NULL,
  fragensatz_id text NOT NULL,
  fragensatz_version integer NOT NULL,
  nummer integer NOT NULL,
  abgegeben_am timestamptz NOT NULL,
  data jsonb NOT NULL,
  UNIQUE (fragensatz_id, fragensatz_version, person_id, nummer)
);
CREATE INDEX IF NOT EXISTS idx_verstaendnis_versuche_person ON verstaendnis_versuche(person_id);
CREATE INDEX IF NOT EXISTS idx_verstaendnis_versuche_satz ON verstaendnis_versuche(fragensatz_id);
`;

interface DataZeile<T> {
  data: T;
}

export class PgVerstaendnisfragenRepo implements VerstaendnisfragenRepo {
  constructor(private readonly pool: Pool) {}

  async legeFassung(fassung: FragensatzFassung): Promise<boolean> {
    const res = await this.pool.query(
      `INSERT INTO verstaendnis_fragensaetze(fragensatz_id, version, ko_id, data)
       VALUES($1,$2,$3,$4)
       ON CONFLICT (fragensatz_id, version) DO NOTHING`,
      [fassung.id, fassung.version, fassung.koId, JSON.stringify(fassung)],
    );
    return (res.rowCount ?? 0) === 1;
  }

  async setzeStatus(
    id: string,
    version: number,
    vorher: readonly FragensatzStatus[],
    neu: Parameters<VerstaendnisfragenRepo["setzeStatus"]>[3],
  ): Promise<FragensatzFassung | undefined> {
    // Ein Schritt in der Datenbank: nur der Status-Teil wird überschrieben, Inhalt und Fragen
    // bleiben, wie sie abgelegt wurden.
    const res = await this.pool.query<DataZeile<FragensatzFassung>>(
      `UPDATE verstaendnis_fragensaetze
          SET data = data || $4::jsonb
        WHERE fragensatz_id=$1 AND version=$2 AND data->>'status' = ANY($3::text[])
        RETURNING data`,
      [id, version, [...vorher], JSON.stringify(neu)],
    );
    return res.rows[0]?.data;
  }

  async fassungen(id: string): Promise<FragensatzFassung[]> {
    const res = await this.pool.query<DataZeile<FragensatzFassung>>(
      "SELECT data FROM verstaendnis_fragensaetze WHERE fragensatz_id=$1 ORDER BY version ASC",
      [id],
    );
    return res.rows.map((z) => z.data);
  }

  async fassungenZu(koId: string): Promise<FragensatzFassung[]> {
    const res = await this.pool.query<DataZeile<FragensatzFassung>>(
      "SELECT data FROM verstaendnis_fragensaetze WHERE ko_id=$1 ORDER BY fragensatz_id, version",
      [koId],
    );
    return res.rows.map((z) => z.data);
  }

  async fassungenFuerRolle(rolle: Role): Promise<FragensatzFassung[]> {
    const res = await this.pool.query<DataZeile<FragensatzFassung>>(
      `SELECT data FROM verstaendnis_fragensaetze
        WHERE data->'rollen' ? $1
        ORDER BY fragensatz_id, version`,
      [rolle],
    );
    return res.rows.map((z) => z.data);
  }

  async legeVersuch(versuch: Versuch): Promise<VersuchAblage> {
    try {
      const res = await this.pool.query(
        `INSERT INTO verstaendnis_versuche(
           versuch_id, person_id, fragensatz_id, fragensatz_version, nummer, abgegeben_am, data)
         VALUES($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (versuch_id) DO NOTHING`,
        [
          versuch.id,
          versuch.personId,
          versuch.fragensatzId,
          versuch.fragensatzVersion,
          versuch.nummer,
          versuch.abgegebenAm,
          JSON.stringify(versuch),
        ],
      );
      if ((res.rowCount ?? 0) === 1) {
        return { art: "neu", versuch };
      }
    } catch (fehler) {
      // 23505: die Nummer dieser Person an dieser Version ist inzwischen belegt.
      if ((fehler as { code?: string }).code === "23505") {
        return { art: "nummer_belegt" };
      }
      throw fehler;
    }
    const vorhanden = await this.versuch(versuch.id);
    return vorhanden ? { art: "vorhanden", versuch: vorhanden } : { art: "nummer_belegt" };
  }

  async versuch(id: string): Promise<Versuch | undefined> {
    const res = await this.pool.query<DataZeile<Versuch>>(
      "SELECT data FROM verstaendnis_versuche WHERE versuch_id=$1",
      [id],
    );
    return res.rows[0]?.data;
  }

  async versucheVon(personId: string): Promise<Versuch[]> {
    const res = await this.pool.query<DataZeile<Versuch>>(
      "SELECT data FROM verstaendnis_versuche WHERE person_id=$1 ORDER BY abgegeben_am, versuch_id",
      [personId],
    );
    return res.rows.map((z) => z.data);
  }

  async versucheZu(fragensatzId: string): Promise<Versuch[]> {
    const res = await this.pool.query<DataZeile<Versuch>>(
      `SELECT data FROM verstaendnis_versuche WHERE fragensatz_id=$1
        ORDER BY abgegeben_am, versuch_id`,
      [fragensatzId],
    );
    return res.rows.map((z) => z.data);
  }
}

// ------------------------------------------------------------------------------------------------
// DER DIENST
// ------------------------------------------------------------------------------------------------

/** Ein fachlicher Fehler dieses Vorgangs — `grund` ist die maschinenlesbare Ursache. */
export class VerstaendnisFehler extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409 | 503,
    readonly grund: string,
    message: string,
    readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "VerstaendnisFehler";
  }
}

/** Was der Dienst vom Wissensbestand braucht — `KoService` erfüllt es. */
export interface VerstaendnisKoLeser {
  get(id: string): Promise<KnowledgeObject | undefined>;
  versionsOf(id: string): Promise<readonly { version: number; snapshot: KnowledgeObject }[]>;
}

/** Der Beleg einer Entscheidung im Prüfprotokoll — strukturell, ohne den Auditdienst zu importieren. */
export interface VerstaendnisBeleg {
  record(input: {
    actor: string;
    action: string;
    target: string;
    payload: Record<string, unknown>;
  }): Promise<unknown>;
}

export interface VerstaendnisDienstDeps {
  repo: VerstaendnisfragenRepo;
  ko: VerstaendnisKoLeser;
  konten: () => Promise<readonly { id: string; name: string }[]>;
  jetzt: () => number;
  kennung: () => string;
  audit?: VerstaendnisBeleg;
}

export interface Handelnder {
  id: string;
  role: Role;
}

/** Die Lage der gebundenen Fassung samt ihrem Text (für die Belegprüfung). */
export interface Quellenstand {
  lage: Quellenlage;
  text: string | null;
}

export class VerstaendnisfragenDienst {
  constructor(private readonly deps: VerstaendnisDienstDeps) {}

  /** Bearbeiten darf, wer anlegen darf UND den Eintrag verantwortet — oder das Freigaberecht hat. */
  darfBearbeiten(user: Handelnder, ko: KnowledgeObject): boolean {
    return (
      can(user.role, "ko.create") &&
      (responsibleOf(ko) === user.id || can(user.role, "ko.validate"))
    );
  }

  darfEntscheiden(user: Handelnder): boolean {
    return can(user.role, "ko.validate");
  }

  private iso(): string {
    return new Date(this.deps.jetzt()).toISOString();
  }

  /**
   * Wie die gebundene Fassung zum heutigen Eintrag steht — und ihr Text. Fachlich geändert heisst:
   * der lesbare Inhalt der heutigen Fassung weicht ab. Liegt die gebundene Fassung nicht (mehr)
   * vor, ist sie nicht vergleichbar: `fehlt`, nie still `aktuell`.
   */
  async quellenstand(ko: KnowledgeObject | undefined, koVersion: number): Promise<Quellenstand> {
    if (!ko || ko.deletedAt) {
      return { lage: "fehlt", text: null };
    }
    let gebunden: KnowledgeObject | undefined;
    if (ko.version === koVersion) {
      gebunden = ko;
    } else {
      const fassungen = await this.deps.ko.versionsOf(ko.id);
      gebunden = fassungen.find((f) => f.version === koVersion)?.snapshot;
    }
    if (!gebunden) {
      return { lage: "fehlt", text: null };
    }
    const text = quelltext(gebunden);
    if (!gleicherInhalt(gebunden, ko)) {
      return { lage: "geaendert", text };
    }
    if (ko.status !== "validiert") {
      return { lage: "nicht_gueltig", text };
    }
    return { lage: "aktuell", text };
  }

  async befunde(fassung: FragensatzFassung, ko: KnowledgeObject | undefined): Promise<Befunde> {
    const stand = await this.quellenstand(ko, fassung.koVersion);
    return befundeFuer(fassung, stand.text, stand.lage);
  }

  private pruefeBearbeiten(user: Handelnder, ko: KnowledgeObject): void {
    if (!this.darfBearbeiten(user, ko)) {
      throw new VerstaendnisFehler(
        403,
        "nicht_verantwortlich",
        "Fragensätze bearbeitet die fachlich verantwortliche Person oder wer freigeben darf.",
      );
    }
  }

  private async pruefeGueltigeFassung(ko: KnowledgeObject, koVersion: number): Promise<void> {
    const stand = await this.quellenstand(ko, koVersion);
    if (stand.lage !== "aktuell") {
      throw new VerstaendnisFehler(
        409,
        `quelle_${stand.lage}`,
        "Ein Fragensatz gehört zu einer gültigen Fassung mit dem heutigen Inhalt des Eintrags.",
        { aktuelleFassung: ko.version },
      );
    }
  }

  async anlegen(user: Handelnder, ko: KnowledgeObject, roh: unknown): Promise<FragensatzFassung> {
    this.pruefeBearbeiten(user, ko);
    const eingabe = pruefeEingabe(roh);
    await this.pruefeGueltigeFassung(ko, eingabe.koVersion);
    const fassung = this.fassungAus(this.deps.kennung(), 1, ko.id, eingabe, user.id);
    if (!(await this.deps.repo.legeFassung(fassung))) {
      throw new VerstaendnisFehler(409, "stand_veraltet", "Dieser Fragensatz existiert bereits.");
    }
    return fassung;
  }

  private fassungAus(
    id: string,
    version: number,
    koId: string,
    eingabe: FragensatzEingabe,
    von: string,
  ): FragensatzFassung {
    return {
      id,
      version,
      koId,
      koVersion: eingabe.koVersion,
      titel: eingabe.titel,
      rollen: eingabe.rollen,
      fragen: fragenAus(eingabe),
      regel: eingabe.regel,
      status: "entwurf",
      geaendertVon: von,
      geaendertAm: this.iso(),
      vorgelegtVon: null,
      vorgelegtAm: null,
      entschiedenVon: null,
      entschiedenAm: null,
      begruendung: null,
    };
  }

  /** Alle Versionen eines Fragensatzes samt seinem Eintrag — `undefined`, wenn es ihn nicht gibt. */
  async mitKo(
    id: string,
  ): Promise<{ fassungen: FragensatzFassung[]; ko: KnowledgeObject } | undefined> {
    const fassungen = await this.deps.repo.fassungen(id);
    const erste = fassungen[0];
    if (!erste) {
      return undefined;
    }
    const ko = await this.deps.ko.get(erste.koId);
    return ko && !ko.deletedAt ? { fassungen, ko } : undefined;
  }

  private juengsteOderFehler(fassungen: FragensatzFassung[], gelesen: number): FragensatzFassung {
    const juengste = juengsteFassung(fassungen);
    if (!juengste || juengste.version !== gelesen) {
      throw new VerstaendnisFehler(
        409,
        "stand_veraltet",
        "Seit dem Öffnen wurde der Fragensatz geändert. Bitte neu laden.",
        { aktuelleVersion: juengste?.version ?? null },
      );
    }
    return juengste;
  }

  /** Jede Änderung ist eine NEUE Version im Entwurf — frühere Versionen und Ergebnisse bleiben. */
  async aendern(
    user: Handelnder,
    ko: KnowledgeObject,
    fassungen: FragensatzFassung[],
    gelesen: number,
    roh: unknown,
  ): Promise<FragensatzFassung> {
    this.pruefeBearbeiten(user, ko);
    const juengste = this.juengsteOderFehler(fassungen, gelesen);
    const eingabe = pruefeEingabe(roh);
    await this.pruefeGueltigeFassung(ko, eingabe.koVersion);
    const fassung = this.fassungAus(juengste.id, juengste.version + 1, ko.id, eingabe, user.id);
    if (!(await this.deps.repo.legeFassung(fassung))) {
      throw new VerstaendnisFehler(
        409,
        "stand_veraltet",
        "Seit dem Öffnen wurde der Fragensatz geändert. Bitte neu laden.",
      );
    }
    return fassung;
  }

  private async pruefeVeroeffentlichbar(
    fassung: FragensatzFassung,
    ko: KnowledgeObject,
  ): Promise<void> {
    const befunde = await this.befunde(fassung, ko);
    if (!ohneBefund(befunde)) {
      throw new VerstaendnisFehler(
        409,
        "befunde",
        "Der Fragensatz ist noch nicht vollständig belegt.",
        { befunde },
      );
    }
  }

  /** Vorlegen: die freiwillige Zweitprüfung — oder der Weg ohne eigenes Freigaberecht. */
  async vorlegen(
    user: Handelnder,
    ko: KnowledgeObject,
    fassungen: FragensatzFassung[],
    version: number,
  ): Promise<FragensatzFassung> {
    this.pruefeBearbeiten(user, ko);
    const juengste = this.juengsteOderFehler(fassungen, version);
    await this.pruefeVeroeffentlichbar(juengste, ko);
    const neu = await this.deps.repo.setzeStatus(juengste.id, version, ["entwurf"], {
      status: "vorgelegt",
      vorgelegtVon: user.id,
      vorgelegtAm: this.iso(),
      entschiedenVon: null,
      entschiedenAm: null,
      begruendung: null,
    });
    if (!neu) {
      throw new VerstaendnisFehler(409, "status", "Nur ein Entwurf kann vorgelegt werden.");
    }
    return neu;
  }

  async entscheiden(
    user: Handelnder,
    ko: KnowledgeObject,
    fassungen: FragensatzFassung[],
    version: number,
    entscheidung: "annehmen" | "zurueckweisen",
    begruendung: string | null,
  ): Promise<FragensatzFassung> {
    if (!this.darfEntscheiden(user)) {
      throw new VerstaendnisFehler(
        403,
        "kein_freigaberecht",
        "Entscheiden darf, wer freigeben darf.",
      );
    }
    const juengste = this.juengsteOderFehler(fassungen, version);
    if (entscheidung === "annehmen") {
      await this.pruefeVeroeffentlichbar(juengste, ko);
    } else if (!begruendung) {
      throw new VerstaendnisFehler(
        400,
        "begruendung_fehlt",
        "Eine Zurückweisung nennt ihren Grund.",
      );
    }
    const am = this.iso();
    const neu = await this.deps.repo.setzeStatus(
      juengste.id,
      version,
      entscheidung === "annehmen" ? ["entwurf", "vorgelegt"] : ["vorgelegt"],
      {
        status: entscheidung === "annehmen" ? "angenommen" : "zurueckgewiesen",
        vorgelegtVon: juengste.vorgelegtVon,
        vorgelegtAm: juengste.vorgelegtAm,
        entschiedenVon: user.id,
        entschiedenAm: am,
        begruendung,
      },
    );
    if (!neu) {
      throw new VerstaendnisFehler(
        409,
        "status",
        entscheidung === "annehmen"
          ? "Angenommen werden kann ein Entwurf oder ein vorgelegter Fragensatz."
          : "Zurückgewiesen werden kann nur ein vorgelegter Fragensatz.",
      );
    }
    await this.deps.audit?.record({
      actor: user.id,
      action:
        entscheidung === "annehmen"
          ? "verstaendnisfragen.angenommen"
          : "verstaendnisfragen.zurueckgewiesen",
      target: ko.id,
      payload: {
        fragensatzId: neu.id,
        fragensatzVersion: neu.version,
        koVersion: neu.koVersion,
        ...(neu.vorgelegtVon ? { vorgelegtVon: neu.vorgelegtVon } : {}),
      },
    });
    return neu;
  }

  fassungenZu(koId: string): Promise<FragensatzFassung[]> {
    return this.deps.repo.fassungenZu(koId);
  }

  fassungenFuerRolle(rolle: Role): Promise<FragensatzFassung[]> {
    return this.deps.repo.fassungenFuerRolle(rolle);
  }

  versucheVon(personId: string): Promise<Versuch[]> {
    return this.deps.repo.versucheVon(personId);
  }

  versucheZu(fragensatzId: string): Promise<Versuch[]> {
    return this.deps.repo.versucheZu(fragensatzId);
  }

  versuch(id: string): Promise<Versuch | undefined> {
    return this.deps.repo.versuch(id);
  }

  async kontoNamen(): Promise<Map<string, string>> {
    return new Map((await this.deps.konten()).map((k) => [k.id, k.name] as const));
  }

  /** Wie viele Versuche diese Person an dieser Version noch hat — `null`: unbegrenzt. */
  verbleibend(fassung: FragensatzFassung, eigene: readonly Versuch[]): number | null {
    const grenze = fassung.regel.hoechstVersuche;
    if (grenze === "unbegrenzt" || grenze === null) {
      return grenze === null ? 0 : null;
    }
    const genutzt = eigene.filter(
      (v) => v.fragensatzId === fassung.id && v.fragensatzVersion === fassung.version,
    ).length;
    return Math.max(0, grenze - genutzt);
  }

  /**
   * Gibt einen Versuch ab. Dieselbe Versuchskennung zweimal ergibt DENSELBEN Versuch (`bereits`),
   * auch nach Neuladen. Bewertet wird nur an der angenommenen Version mit heutiger Quelle — fehlt
   * die Quelle oder ist sie fachlich geändert, entsteht keine Bewertung.
   */
  async versuchAbgeben(
    user: Handelnder,
    ko: KnowledgeObject,
    fassungen: FragensatzFassung[],
    roh: unknown,
  ): Promise<{ versuch: Versuch; bereits: boolean }> {
    const r = (typeof roh === "object" && roh !== null ? roh : {}) as Record<string, unknown>;
    const versuchId = typeof r.versuchId === "string" ? r.versuchId.trim() : "";
    if (!/^[A-Za-z0-9-]{8,64}$/.test(versuchId)) {
      throw eingabefehler("Die Versuchskennung fehlt oder ist ungültig.");
    }
    const vorhanden = await this.deps.repo.versuch(versuchId);
    if (vorhanden) {
      if (vorhanden.personId !== user.id || vorhanden.fragensatzId !== fassungen[0]?.id) {
        throw new VerstaendnisFehler(409, "versuch_fremd", "Diese Versuchskennung ist vergeben.");
      }
      return { versuch: vorhanden, bereits: true };
    }
    const version = r.version;
    const gueltig = gueltigeFassung(fassungen);
    if (!gueltig) {
      throw new VerstaendnisFehler(
        409,
        "nicht_angenommen",
        "Dieser Fragensatz ist nicht angenommen.",
      );
    }
    if (version !== gueltig.version) {
      throw new VerstaendnisFehler(
        409,
        "stand_veraltet",
        "Inzwischen gilt eine andere Version dieses Fragensatzes. Bitte neu laden.",
        { aktuelleVersion: gueltig.version },
      );
    }
    const stand = await this.quellenstand(ko, gueltig.koVersion);
    if (stand.lage !== "aktuell") {
      throw new VerstaendnisFehler(
        409,
        `quelle_${stand.lage}`,
        "Die Quelle dieses Fragensatzes hat sich geändert oder fehlt. Bis zur fachlichen " +
          "Prüfung wird nicht bewertet.",
      );
    }
    const antwortenRoh = r.antworten ?? [];
    if (!Array.isArray(antwortenRoh) || antwortenRoh.length > VERSTAENDNIS_GRENZEN.fragen) {
      throw eingabefehler("Die Antworten sind keine gültige Liste.");
    }
    const fragen = new Map(gueltig.fragen.map((f) => [f.id, f] as const));
    const antworten: Versuch["antworten"] = [];
    for (const eintrag of antwortenRoh) {
      const a = (typeof eintrag === "object" && eintrag !== null ? eintrag : {}) as Record<
        string,
        unknown
      >;
      const frage = typeof a.frageId === "string" ? fragen.get(a.frageId) : undefined;
      if (!frage || !Array.isArray(a.gewaehlt) || antworten.some((x) => x.frageId === frage.id)) {
        throw eingabefehler("Eine Antwort nennt keine Frage dieses Fragensatzes.");
      }
      const ids = new Set(frage.optionen.map((o) => o.id));
      const gewaehlt: string[] = [];
      for (const g of a.gewaehlt) {
        if (typeof g !== "string" || !ids.has(g)) {
          throw eingabefehler("Eine Antwort nennt keine Möglichkeit dieser Frage.");
        }
        if (!gewaehlt.includes(g)) {
          gewaehlt.push(g);
        }
      }
      antworten.push({ frageId: frage.id, gewaehlt });
    }
    const eigene = await this.deps.repo.versucheVon(user.id);
    const bisher = eigene.filter(
      (v) => v.fragensatzId === gueltig.id && v.fragensatzVersion === gueltig.version,
    ).length;
    const verbleibend = this.verbleibend(gueltig, eigene);
    if (verbleibend !== null && verbleibend <= 0) {
      throw new VerstaendnisFehler(
        409,
        "versuche_erschoepft",
        "Für diese Version sind keine weiteren Versuche vorgesehen.",
      );
    }
    const versuch: Versuch = {
      id: versuchId,
      personId: user.id,
      fragensatzId: gueltig.id,
      fragensatzVersion: gueltig.version,
      koId: ko.id,
      koVersion: gueltig.koVersion,
      nummer: bisher + 1,
      abgegebenAm: this.iso(),
      antworten,
      bewertung: bewerte(gueltig, antworten),
    };
    const abgelegt = await this.deps.repo.legeVersuch(versuch);
    if (abgelegt.art === "nummer_belegt") {
      throw new VerstaendnisFehler(
        409,
        "gleichzeitig",
        "Gleichzeitig wurde ein anderer Versuch abgegeben. Bitte neu laden.",
      );
    }
    if (abgelegt.art === "vorhanden" && abgelegt.versuch.personId !== user.id) {
      throw new VerstaendnisFehler(409, "versuch_fremd", "Diese Versuchskennung ist vergeben.");
    }
    return { versuch: abgelegt.versuch, bereits: abgelegt.art === "vorhanden" };
  }
}

// ------------------------------------------------------------------------------------------------
// WAS DIE ROUTEN HINAUSGEBEN
// ------------------------------------------------------------------------------------------------

/** Die Sicht der Lernenden VOR der Abgabe: keine richtigen Antworten, keine Erläuterung, kein Beleg. */
export function lernSicht(f: FragensatzFassung) {
  return {
    id: f.id,
    version: f.version,
    koVersion: f.koVersion,
    titel: f.titel,
    regel: f.regel,
    fragen: f.fragen.map((q) => ({
      id: q.id,
      text: q.text,
      optionen: q.optionen,
    })),
  };
}

/** Die Rückmeldung zu einem Versuch: je Frage Wahl, richtige Antwort, Erläuterung und Belegstelle. */
export function rueckmeldung(versuch: Versuch, fassung: FragensatzFassung | undefined) {
  const fragen = new Map((fassung?.fragen ?? []).map((q) => [q.id, q] as const));
  const gewaehlt = new Map(versuch.antworten.map((a) => [a.frageId, a.gewaehlt] as const));
  return {
    versuchId: versuch.id,
    fragensatzId: versuch.fragensatzId,
    fragensatzVersion: versuch.fragensatzVersion,
    titel: fassung?.titel ?? null,
    koId: versuch.koId,
    koVersion: versuch.koVersion,
    nummer: versuch.nummer,
    abgegebenAm: versuch.abgegebenAm,
    bewertung: versuch.bewertung,
    fragen: versuch.bewertung.je.map((e) => {
      const q = fragen.get(e.frageId);
      return {
        frageId: e.frageId,
        urteil: e.urteil,
        text: q?.text ?? null,
        optionen: q?.optionen ?? [],
        gewaehlt: gewaehlt.get(e.frageId) ?? [],
        richtig: q?.richtig ?? [],
        erlaeuterung: q?.erlaeuterung ?? null,
        beleg: q?.beleg ?? null,
      };
    }),
  };
}

/** Die Kurzform eines Ergebnisses — für eigene Listen und die zuständige Übersicht. */
export function ergebnisKurz(versuch: Versuch) {
  return {
    versuchId: versuch.id,
    fragensatzId: versuch.fragensatzId,
    fragensatzVersion: versuch.fragensatzVersion,
    koId: versuch.koId,
    koVersion: versuch.koVersion,
    nummer: versuch.nummer,
    abgegebenAm: versuch.abgegebenAm,
    richtig: versuch.bewertung.richtig,
    fragen: versuch.bewertung.fragen,
    unbeantwortet: versuch.bewertung.unbeantwortet,
    mindestRichtig: versuch.bewertung.mindestRichtig,
    bestanden: versuch.bewertung.bestanden,
  };
}
