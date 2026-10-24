// ================================================================================================
// produkt:20261011:assistenz-lernen-hostfortsetzung · BPA-06 — ZWEI VORFÜHRUNGEN IM P06-WEG.
// ================================================================================================
//
// Bens Befund zu d06c8487 (AC02/BPA-S06): die Ableitung aus zwei unterschiedlichen Vorführungen
// war nur als Modullogik (`entwerfeLernnotiz`) belegt, nicht im integrierten Produktweg. Diese
// Datei verbindet beides, ohne einen zweiten Lernweg:
//
//   P06-Lernsitzung (`vormachen.ts`, Rohbeobachtungen nur im Speicher des Dienstes)
//     → je `entwurf_anlegen` beginnt eine Vorführung
//     → je Beobachtung die Hostereignisse der Erfassung mit ihren ROHWERTEN (`felder`)
//     → `bereinige` (Zugangsdaten nie im Trace) → `entwerfeLernnotiz` (Ausrichtung, Parameter,
//       Entscheidungspunkte) → Änderungen der Person (`aendere`) → Vorschau
//     → bei der Bestätigung NUR Parameterdefinition und Schritte an der P06-Routine.
//
// Was in die Routine darf: Eingaben (Name, Beschriftung, Art), Schritte mit benanntem Ziel, als
// Festwert nur eine in ALLEN Vorführungen gleiche Ordnungsangabe (Art, Kategorie, Vertraulichkeit,
// Fachgebiet — sie steht schon in der P06-Schrittbeschreibung). Titel und Kernaussage sind Inhalt
// und werden IMMER Eingabe des Laufs, auch wenn sie zufällig gleich waren. Empfänger (die Prüfer
// eines Entwurfs) werden nie Festwert und ihr Setzen ist folgenreich: der Lauf hält dort an.
//
// Mit nur einer Vorführung oder ohne Rohwerte gibt es keine Ableitung; dann gilt unverändert die
// feste P06-Sicht (`assistenz-lernen-p06.ts`).
import {
  type Aenderung,
  type Bindung,
  type FunktionsParameter,
  type FunktionsSchritt,
  type HostEreignis,
  type KorrekturQuelle,
  type LernFreigabe,
  type LernSitzung,
  type Lernnotiz,
  type Vorschau,
  type Ziel,
  aendere,
  bereinige,
  entwerfeLernnotiz,
  siehtGeheimAus,
  vorschau,
} from "./assistenz-lernen";
import { korrekturQuellen, korrekturZeile } from "./assistenz-lernen-korrektur";
import type { Lernsitzung, Rohbeobachtung } from "./vormachen-lernsitzung-typen";

/**
 * Klarwerk-Web IST diese Anwendung: es gibt keine fremde Hostfassung, die sich unter der Routine
 * ändern könnte. Ein Hostwechsel betrifft die Programmadapter (Word/Finder, BPA-04).
 */
export const KLARWERK_WEB_FASSUNG = "klarwerk-web";
/** Diese Instanz ist ein Mandant; Konto und Rechte kommen aus der Sitzung. */
export const MANDANT_DIESER_INSTANZ = "instanz";
/** Das Ziel eines Laufs in Klarwerk-Web: ein neuer Entwurf in der Erfassung. */
export const ZIEL_ERFASSUNG = { kennung: "klarwerk:erfassung", fassung: "neu" } as const;

export const TITEL: Ziel = { rolle: "textbox", name: "Titel" };
export const KERNAUSSAGE: Ziel = { rolle: "textbox", name: "Kernaussage" };
export const SPEICHERN: Ziel = { rolle: "button", name: "Entwurf speichern" };
export const EINREICHEN: Ziel = { rolle: "button", name: "Zur Prüfung einreichen" };
/** Die Prüfer eines Entwurfs — die Empfänger beim Einreichen. */
export const PRUEFER: Ziel = { rolle: "combobox", name: "Prüfer" };

/** Ordnungsangaben der Erfassung: Rumpffeld und Bedienelement. */
const ORDNUNGSANGABEN: readonly (readonly [string, Ziel])[] = [
  ["type", { rolle: "combobox", name: "Art" }],
  ["category", { rolle: "combobox", name: "Kategorie" }],
  ["confidentiality", { rolle: "combobox", name: "Vertraulichkeit" }],
  ["domain", { rolle: "combobox", name: "Fachgebiet" }],
];

/** EQF-06-K02: höchstens so viele gelesene Quellen je Vorführung. */
export const QUELLEN_MAX = 5;

/** EQF-06-K02: die n-te gelesene Quelle einer Vorführung (1-basiert). */
export function quellZiel(n: number): Ziel {
  return { rolle: "link", name: `Quelle ${n}` };
}

export function istQuellZiel(z: Ziel | undefined): boolean {
  return z?.rolle === "link" && /^Quelle [1-9]\d*$/.test(z.name);
}

/** Die Bedienelemente der Erfassung, die ein Lauf in Klarwerk-Web vorfindet. */
export const KLARWERK_WEB_ZIELE: readonly Ziel[] = [
  TITEL,
  KERNAUSSAGE,
  SPEICHERN,
  EINREICHEN,
  PRUEFER,
  ...ORDNUNGSANGABEN.map(([, ziel]) => ziel),
  ...Array.from({ length: QUELLEN_MAX }, (_, i) => quellZiel(i + 1)),
];

/** Inhaltsfelder: immer Eingabe des Laufs, unter den Namen, die auch der Lauf ohne Ableitung kennt. */
const INHALT_PARAMETER: Readonly<Record<string, string>> = {
  Titel: "titel",
  Kernaussage: "inhalt",
};

/** Was aus mehreren Vorführungen abgeleitet ist — ohne einen einzigen Inhalts- oder Empfängerwert. */
export interface Ableitung {
  readonly vorfuehrungen: number;
  readonly parameter: readonly FunktionsParameter[];
  readonly schritte: readonly FunktionsSchritt[];
  /**
   * EQF-06-K03: die Korrekturen der Person mit zugeordneter Quelle (Bedeutung, Wortlaut, Zeitpunkt,
   * Schritt) — in ihrer Reihenfolge, über alle Fassungen der Routine.
   */
  readonly korrekturen?: readonly KorrekturQuelle[];
}

/** Die Ableitung in der Vorschau, mit der Erklärung in einfacher Sprache (AC03). */
export interface AbleitungsVorschau extends Ableitung {
  readonly erklaerung: Vorschau["abschnitte"];
}

const FREIGABE: LernFreigabe = {
  anwendungen: ["Klarwerk"],
  ausgeschlosseneFelder: [],
  fensterbild: false,
  abbruchRegel: "rohdaten_verwerfen",
};

/**
 * Die Hostereignisse einer Beobachtung in der Erfassung — mit Rohwerten, nur für die Ableitung.
 * `gelesen`: die in dieser Vorführung schon gelesenen Quellen (EQF-06-K02), in ihrer Reihenfolge.
 */
function ereignisse(b: Rohbeobachtung, gelesen: string[]): HostEreignis[] {
  const basis = { anwendung: "Klarwerk", fenster: "Erfassung", zeitpunkt: b.am };
  const f: Readonly<Record<string, string>> = b.felder ?? {};
  if (b.vorgang === "quelle_lesen") {
    // EQF-06-K02: das Originalereignis „Quelle n gelesen“ mit der Kennung des Wissensobjekts als
    // Wert. Gleiche Quelle in allen Vorführungen → fester Schritt, sonst Eingabe bzw. Entscheidung.
    const id = f.quelle;
    if (id === undefined || gelesen.includes(id) || gelesen.length >= QUELLEN_MAX) {
      return [];
    }
    gelesen.push(id);
    const ziel = quellZiel(gelesen.length);
    return [{ ...basis, fenster: "Wissen", art: "oeffnen", ziel, wert: id }];
  }
  if (b.vorgang === "entwurf_speichern") {
    return [{ ...basis, art: "speichern", ziel: SPEICHERN }];
  }
  if (b.vorgang === "zur_pruefung_einreichen") {
    return [{ ...basis, art: "veroeffentlichen", ziel: EINREICHEN }];
  }
  if (b.vorgang !== "entwurf_anlegen") {
    // Seite öffnen, Frage stellen: am Ergebnis bewirken sie nichts.
    return [];
  }
  const e: HostEreignis[] = [];
  const titel = f.title;
  if (titel !== undefined) {
    e.push({ ...basis, art: "eingabe", ziel: TITEL, wert: titel });
  }
  const aussage = f.statement;
  if (aussage !== undefined) {
    e.push({ ...basis, art: "eingabe", ziel: KERNAUSSAGE, wert: aussage });
  }
  for (const [feld, ziel] of ORDNUNGSANGABEN) {
    const wert = f[feld];
    if (wert !== undefined) {
      e.push({ ...basis, art: "auswahl", ziel, wert });
    }
  }
  const pruefer = f.reviewerIds;
  if (pruefer !== undefined) {
    // Prüfer benennen adressiert Menschen: Empfänger, folgenreich (AC09).
    e.push({ ...basis, art: "senden", ziel: PRUEFER, feld: "Empfänger", wert: pruefer });
  }
  e.push({ ...basis, art: "speichern", ziel: SPEICHERN });
  return e;
}

/**
 * Die nicht herausgenommenen Beobachtungen, je `entwurf_anlegen` eine neue Vorführung. EQF-06-K02:
 * Quellen werden VOR dem Anlegen gelesen — eine gelesene Quelle nach einem Anlegen beginnt die
 * nächste Vorführung.
 */
export function vorfuehrungenAus(s: Lernsitzung): Rohbeobachtung[][] {
  const vorfuehrungen: Rohbeobachtung[][] = [];
  let aktuell: Rohbeobachtung[] = [];
  for (const b of s.beobachtungen) {
    if (s.korrekturen[b.nr]?.entfernt === true) {
      continue;
    }
    const beginnt = b.vorgang === "entwurf_anlegen" || b.vorgang === "quelle_lesen";
    if (beginnt && aktuell.some((x) => x.vorgang === "entwurf_anlegen")) {
      vorfuehrungen.push(aktuell);
      aktuell = [];
    }
    aktuell.push(b);
  }
  if (aktuell.length > 0) {
    vorfuehrungen.push(aktuell);
  }
  return vorfuehrungen;
}

/** Titel und Kernaussage werden immer Eingabe des Laufs — unter den festen Namen `titel`/`inhalt`. */
function inhaltAlsEingabe(n: Lernnotiz): Lernnotiz {
  const d = n.definition;
  const umbenannt = new Map<string, string>();
  const dazu: FunktionsParameter[] = [];
  const schritte = d.schritte.map((s): FunktionsSchritt => {
    const fest = s.ziel ? INHALT_PARAMETER[s.ziel.name] : undefined;
    if (fest === undefined || !s.wert) {
      return s;
    }
    if ("parameter" in s.wert) {
      umbenannt.set(s.wert.parameter, fest);
    } else {
      dazu.push({ name: fest, beschriftung: s.ziel?.name ?? fest, art: "text" });
    }
    return { ...s, wert: { parameter: fest } };
  });
  const parameter = d.parameter.map((p) => ({ ...p, name: umbenannt.get(p.name) ?? p.name }));
  return { ...n, definition: { ...d, schritte, parameter: [...parameter, ...dazu] } };
}

/**
 * Die Ableitung einer P06-Lernsitzung in Klarwerk-Web — `null` mit weniger als zwei Vorführungen
 * oder ohne Rohwerte. Die Änderungen der Person wirken in ihrer Reihenfolge.
 */
export function leiteAb(
  s: Lernsitzung,
  aenderungen: readonly Aenderung[] = [],
): AbleitungsVorschau | null {
  if (s.host !== "klarwerk_web") {
    return null;
  }
  const vorfuehrungen = vorfuehrungenAus(s);
  const mitWerten = vorfuehrungen.every((v) =>
    v.some((b) => b.vorgang === "entwurf_anlegen" && b.felder !== undefined),
  );
  if (vorfuehrungen.length < 2 || !mitWerten) {
    return null;
  }
  const bindung: Bindung = {
    mandant: MANDANT_DIESER_INSTANZ,
    nutzer: s.kontoId,
    sitzung: s.id,
    host: "klarwerk_web",
    hostVersion: KLARWERK_WEB_FASSUNG,
    anwendung: "Klarwerk",
    fenster: "Erfassung",
    objekt: ZIEL_ERFASSUNG.kennung,
    zeitpunkt: s.angelegtAm,
  };
  // Bereinigt VOR der Ableitung: ein Wert, der nach Zugangsdaten aussieht, wird Entscheidungspunkt.
  const trace = vorfuehrungen.map((v) => {
    const gelesen: string[] = [];
    return v.flatMap((b) => ereignisse(b, gelesen)).map((e) => bereinige(e, FREIGABE));
  });
  const sitzung: LernSitzung = {
    id: s.id,
    auftrag: { text: s.zweck, vorgang: "Bericht", anwendung: "Klarwerk", fenster: "Erfassung" },
    bindung,
    freigabe: FREIGABE,
    stand: "beendet",
    vorfuehrungen: trace,
    aktuell: [],
  };
  const notiz = entwerfeLernnotiz(sitzung);
  if ("fehler" in notiz) {
    return null;
  }
  let n = inhaltAlsEingabe(notiz);
  n = aendere(n, { art: "name", wert: s.zweck });
  n = aendere(n, { art: "zweck", wert: s.zweck });
  n = aendere(n, { art: "ergebnis", wert: "Ein Entwurf in Klarwerk, den du danach prüfst." });
  for (const a of aenderungen) {
    n = aendere(n, a);
  }
  const { parameter, schritte } = n.definition;
  const korrekturen = korrekturQuellen(aenderungen);
  const erklaerung = mitKorrekturen(vorschau(n).abschnitte, korrekturen);
  return {
    vorfuehrungen: vorfuehrungen.length,
    parameter,
    schritte,
    erklaerung: [...erklaerung, ...quellenAbschnitt(vorfuehrungen)],
    ...(korrekturen.length > 0 ? { korrekturen } : {}),
  };
}

/**
 * EQF-06-K02: die gelesenen Quellen als Originalereignisse — je Vorführung Kennung und Fassung, wie
 * der Leseweg sie beantwortet hat. Nur in der Vorschau (Lernsitzung), nie Inhalt.
 */
function quellenAbschnitt(vorfuehrungen: readonly Rohbeobachtung[][]): Vorschau["abschnitte"] {
  const zeilen: string[] = [];
  for (const [i, v] of vorfuehrungen.entries()) {
    const gesehen = new Set<string>();
    for (const b of v) {
      const id = b.vorgang === "quelle_lesen" ? b.felder?.quelle : undefined;
      if (id === undefined || gesehen.has(id) || gesehen.size >= QUELLEN_MAX) {
        continue;
      }
      gesehen.add(id);
      const fassung = b.felder?.fassung ?? "unbekannt";
      zeilen.push(
        `Vorführung ${i + 1}, Quelle ${gesehen.size}: Wissensobjekt ${id} in Fassung ${fassung}.`,
      );
    }
  }
  return zeilen.length > 0 ? [{ ueberschrift: "Gelesene Quellen", zeilen }] : [];
}

/** EQF-06-K03: die Korrekturen der Person samt Quelle als eigener Abschnitt der Erklärung. */
function mitKorrekturen(
  abschnitte: Vorschau["abschnitte"],
  korrekturen: readonly KorrekturQuelle[],
): Vorschau["abschnitte"] {
  if (korrekturen.length === 0) {
    return abschnitte;
  }
  const zeilen = korrekturen.map(korrekturZeile);
  return [...abschnitte, { ueberschrift: "Deine Korrekturen", zeilen }];
}

/**
 * EQF-06-K10: eine Korrektur an der BESTÄTIGTEN Ableitung einer Routine — Grundlage der nächsten
 * Fassung. Dieselbe Änderungsregel (`aendere`) wie vor der Bestätigung; frühere Korrekturen bleiben
 * mit ihrer Quelle erhalten, die neue kommt dazu.
 */
export function aendereBestaetigteAbleitung(
  kontoId: string,
  ableitung: Ableitung,
  aenderung: Aenderung,
): Ableitung {
  const bindung: Bindung = {
    mandant: MANDANT_DIESER_INSTANZ,
    nutzer: kontoId,
    sitzung: "routine",
    host: "klarwerk_web",
    hostVersion: KLARWERK_WEB_FASSUNG,
    anwendung: "Klarwerk",
    fenster: "Erfassung",
    objekt: ZIEL_ERFASSUNG.kennung,
    zeitpunkt: aenderung.quelle?.am ?? "",
  };
  const notiz: Lernnotiz = {
    stand: "lernnotiz",
    eigentuemer: kontoId,
    definition: {
      name: "",
      zweck: "",
      ergebnis: "",
      anwendung: "Klarwerk",
      hostVersion: KLARWERK_WEB_FASSUNG,
      parameter: ableitung.parameter.map((p) => ({ ...p })),
      schritte: ableitung.schritte.map((s) => ({ ...s })),
    },
    herkunft: { sitzung: "routine", vorfuehrungen: ableitung.vorfuehrungen, bindung },
  };
  const { parameter, schritte } = aendere(notiz, aenderung).definition;
  const korrekturen = [...(ableitung.korrekturen ?? []), ...korrekturQuellen([aenderung])];
  return {
    vorfuehrungen: ableitung.vorfuehrungen,
    parameter,
    schritte,
    ...(korrekturen.length > 0 ? { korrekturen } : {}),
  };
}

const TEXT_MAX = 300;

function kurzerText(wert: unknown): string | null {
  if (typeof wert !== "string") {
    return null;
  }
  const t = wert.trim();
  return t.length > 0 && t.length <= TEXT_MAX && !siehtGeheimAus(t) ? t : null;
}

/**
 * Eine Änderung der Person an der Ableitung vor der Bestätigung (AC03), geprüft: Schritt
 * herausnehmen, als Entscheidung markieren, Festwert zur Eingabe machen, Eingabe umbenennen.
 */
export function ableitungsAenderung(roh: unknown): Aenderung | null {
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) {
    return null;
  }
  const o = roh as Record<string, unknown>;
  const nr = typeof o.nr === "number" && Number.isInteger(o.nr) && o.nr > 0 ? o.nr : null;
  if (o.art === "schritt_entfernen" && nr !== null) {
    return { art: "schritt_entfernen", nr };
  }
  // EQF-06-K03: „gehört immer dazu“ auch ohne Satz, als ausdrückliche Wahl.
  if (o.art === "als_regel" && nr !== null) {
    return { art: "als_regel", nr };
  }
  if (o.art === "als_entscheidung" && nr !== null) {
    const frage = kurzerText(o.frage);
    return frage === null ? null : { art: "als_entscheidung", nr, frage };
  }
  if (o.art === "als_eingabe" && nr !== null) {
    const beschriftung = kurzerText(o.beschriftung);
    return beschriftung === null ? null : { art: "als_eingabe", nr, beschriftung };
  }
  if (o.art === "beschriftung" && typeof o.parameter === "string") {
    const wert = kurzerText(o.wert);
    return wert === null ? null : { art: "beschriftung", parameter: o.parameter, wert };
  }
  return null;
}
