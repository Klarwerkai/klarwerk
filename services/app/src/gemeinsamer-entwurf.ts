import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { sanitizeHtml } from "../../structure";

// ================================================================================================
// ARTIKEL-GEMEINSAM (produkt:20261007:artikel-gemeinsam) · DER GEMEINSAME ENTWURF EINES ARTIKELS.
// ================================================================================================
//
// WAS DAS IST. Mehrere Berechtigte arbeiten an EINER Arbeitsfassung desselben Artikels — erreichbar
// aus dem Artikelgespräch des Chats und aus dem Artikel selbst. Der Entwurf liegt NEBEN dem
// Wissensobjekt: solange er offen ist, liest jeder Leser unverändert die gültige Fassung des
// Artikels. Erst die Übernahme schreibt — und zwar über die VORHANDENEN Wege: `revise` mit
// `expectedVersion` (CAS) oder, bei einem freigegebenen Artikel ohne Freigaberecht, `propose`.
// Diese Datei schreibt nie selbst am Artikel; sie prüft beim Abschluss nur nach, dass der Artikel
// wirklich das trägt, was übernommen wurde.
//
// KEIN ZWEITER PRÄSENZ-/CAS-GRUNDBAU. Wer gerade anwesend ist, sagt weiterhin der vorhandene
// Bearbeitungshinweis (`bearbeitungshinweis.ts`); den Schutz der Lesefassung trägt weiterhin
// `expectedVersion`. Neu ist allein, was zwischen zwei Speichervorgängen DESSELBEN Entwurfs
// geschieht:
//
//   · Jeder Speichervorgang nennt den Arbeitsstand, auf dem er beruht (`basisRevision`). Ist das
//     der aktuelle, wird geschrieben. Ist inzwischen ein anderer gespeichert, wird ABSCHNITTSWEISE
//     drei-Wege-zusammengeführt (Basis, eigene Fassung, gespeicherte Fassung): Änderungen an
//     verschiedenen Abschnitten ergeben beide zusammen; dieselbe Änderung zählt einmal; zwei
//     verschiedene Änderungen am selben Abschnitt sind ein KONFLIKT — dann wird NICHTS geschrieben,
//     und die Antwort nennt je Konfliktstelle Basis, eigene und gespeicherte Fassung samt Urheber,
//     damit der Mensch konkret wählen kann. Still überschrieben wird nie.
//   · Geschrieben wird bedingt (`schreibe(entwurf, erwarteteRevision)`): laufen zwei
//     Speichervorgänge gleichzeitig, gewinnt einer, und der andere wird gegen den neuen Stand
//     erneut zusammengeführt.
//
// INHALT = der HTML-Rumpf des Artikels, so wie ihn der einheitliche Editor (`RichTextEditor`)
// schreibt — mit Überschriften, Listen, Tabellen, Bildern und Formatierung. ABSCHNITT = ein Block
// der obersten Ebene dieses Rumpfs (Absatz, Überschrift, Liste, Tabelle, Bild …). Jeder Rumpf geht
// vor dem Zerlegen durch DENSELBEN Sanitizer wie der Artikel selbst (`sanitizeHtml`), damit gleicher
// Inhalt gleiche Zeichen ergibt. Der Titel ist ein eigener Wert mit derselben Regel.
//
// NACHARBEIT 5 (Ben): bis hierher bearbeitete der Entwurf nur Klartext-Absätze in einer eigenen
// Textarea und schloss Artikel mit Bildern, Listen oder Tabellen aus. Das ist aufgehoben: jeder
// Artikel lässt sich gemeinsam bearbeiten, sein Inhalt bleibt vollständig erhalten.

/** Titel und Inhalt eines Arbeitsstands; `rumpf` ist kanonisches, sanitisiertes HTML. */
export interface EntwurfsStand {
  titel: string;
  rumpf: string;
}

export type EntwurfsZustand = "offen" | "uebernommen" | "eingereicht";

export type EntwurfsSchrittArt =
  | "angelegt"
  | "gespeichert"
  | "zusammengefuehrt"
  | "angeglichen"
  | "uebernommen"
  | "eingereicht";

/** Ein Eintrag im Verlauf des Entwurfs — wer, wann, was. */
export interface EntwurfsSchritt {
  revision: number;
  am: string;
  nutzerId: string;
  nutzerName: string;
  art: EntwurfsSchrittArt;
  /** Bei `uebernommen`: die entstandene Fassung des Artikels. */
  fassung?: number;
  /** Bei `eingereicht`: der Änderungsvorschlag am Artikel. */
  vorschlagId?: string;
}

export interface GemeinsamerEntwurf {
  id: string;
  koId: string;
  zustand: EntwurfsZustand;
  /** Die Fassung des Artikels, auf der der Entwurf beruht. */
  basisVersion: number;
  /** Titel und Text dieser Fassung — die Basis, wenn sich der Artikel daneben bewegt. */
  basis: EntwurfsStand;
  revision: number;
  stand: EntwurfsStand;
  /** Jeder gespeicherte Arbeitsstand — die Basis einer späteren Zusammenführung. */
  staende: Array<{ revision: number; stand: EntwurfsStand; nutzerName: string }>;
  verlauf: EntwurfsSchritt[];
  geaendertAm: string;
}

/** So viele Arbeitsstände bleiben als mögliche Basis erhalten. */
export const ENTWURF_STAENDE_MAX = 500;
/** So viele Abschnitte nimmt ein Entwurf höchstens an. */
export const ENTWURF_ABSCHNITTE_MAX = 1_000;
/** So viele Zeichen trägt ein Entwurfstext höchstens. */
export const ENTWURF_TEXT_MAX = 200_000;

export class EntwurfsFehler extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    readonly grund: string,
    message: string,
    readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "EntwurfsFehler";
  }
}

// ================================================================================================
// ABSCHNITTE, ARTIKELTEXT UND RUMPF
// ================================================================================================

/** Zerlegt einen Text in Abschnitte (Absätze, durch mindestens eine Leerzeile getrennt). */
export function abschnitte(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n/)
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

/** Der normalisierte Text: Abschnitte, getrennt durch genau eine Leerzeile. */
export function normalisiereText(text: string): string {
  return abschnitte(text).join("\n\n");
}

const ENTITAETEN: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function entschluessele(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (ganz, name: string) => {
    if (name.startsWith("#x") || name.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    }
    if (name.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
    }
    return ENTITAETEN[name.toLowerCase()] ?? ganz;
  });
}

function verschluessele(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Elemente ohne Schlussmarke — sie öffnen keine Ebene. */
const LEERE_ELEMENTE = new Set(["br", "img", "hr", "wbr", "col", "source", "input"]);

/** Dieselbe Tag-Erkennung wie der Sanitizer (Attributwerte in Anführungszeichen dürfen `>` tragen). */
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^<>"']|"[^"]*"|'[^']*')*)>/g;

/**
 * Zerlegt einen (sanitisierten) HTML-Rumpf in seine Blöcke der obersten Ebene. Text, der auf der
 * obersten Ebene ausserhalb eines Elements steht, wird zu einem eigenen Block.
 */
export function bloecke(html: string): string[] {
  const raus: string[] = [];
  let tiefe = 0;
  let start = 0;
  const re = new RegExp(TAG.source, "g");
  let m: RegExpExecArray | null = re.exec(html);
  while (m !== null) {
    const zu = m[1] === "/";
    const name = (m[2] ?? "").toLowerCase();
    const selbst = LEERE_ELEMENTE.has(name) || (m[3] ?? "").trimEnd().endsWith("/");
    if (tiefe === 0 && !zu) {
      const davor = html.slice(start, m.index).trim();
      if (davor.length > 0) {
        raus.push(davor);
      }
      if (selbst) {
        raus.push(html.slice(m.index, re.lastIndex));
        start = re.lastIndex;
      } else {
        start = m.index;
        tiefe = 1;
      }
    } else if (!selbst) {
      tiefe = zu ? Math.max(0, tiefe - 1) : tiefe + 1;
      if (zu && tiefe === 0) {
        raus.push(html.slice(start, re.lastIndex));
        start = re.lastIndex;
      }
    }
    m = re.exec(html);
  }
  const rest = html.slice(start).trim();
  if (rest.length > 0) {
    raus.push(rest);
  }
  return raus;
}

/** Der kanonische Rumpf: sanitisiert wie am Artikel, Blöcke ohne Zwischenraum aneinander. */
export function normalisiereRumpf(html: string): string {
  return bloecke(sanitizeHtml(html)).join("");
}

/** Der Rumpf zu einem Klartext — je Abschnitt ein Absatz, Zeilenumbrüche als `<br>`. */
export function rumpfAusText(text: string): string {
  return normalisiereRumpf(
    abschnitte(text)
      .map((a) => `<p>${verschluessele(a).replace(/\n/g, "<br>")}</p>`)
      .join(""),
  );
}

/** Der Klartext eines Blocks — für Aussage, Anzeige und Vergleich. */
function blockText(block: string): string {
  return entschluessele(
    block
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|h[1-6]|li|blockquote|div|figcaption|caption|th|td|tr)>/gi, "\n")
      .replace(/<[^>]*>/g, ""),
  )
    .split("\n")
    .map((z) => z.trim())
    .filter((z) => z.length > 0)
    .join("\n");
}

/** Der Klartext eines Rumpfs: je Block ein Absatz, eine Leerzeile dazwischen. */
export function textAusRumpf(rumpf: string): string {
  return bloecke(rumpf)
    .map(blockText)
    .filter((t) => t.length > 0)
    .join("\n\n");
}

/**
 * Der Inhalt eines Artikels, wie ihn der Entwurf bearbeitet: sein Rumpf (kanonisiert). Ein Artikel
 * ohne Rumpf trägt seine Aussage als Absätze.
 */
export function artikelRumpf(ko: { statement: string; bodyHtml?: string | null }): string {
  const rumpf = typeof ko.bodyHtml === "string" ? ko.bodyHtml : "";
  return rumpf.trim().length > 0 ? normalisiereRumpf(rumpf) : rumpfAusText(ko.statement);
}

/** Der Stand eines Artikels — Titel und kanonischer Rumpf. */
export function artikelStand(ko: {
  title: string;
  statement: string;
  bodyHtml?: string | null;
}): EntwurfsStand {
  return { titel: ko.title, rumpf: artikelRumpf(ko) };
}

/**
 * Was die Übernahme an `PUT /api/kos/:id` schickt (`action: "revise"` bzw. `"propose"`): Titel,
 * der vollständige Rumpf und dessen Klartext als Aussage.
 */
export function uebernahmeAenderung(stand: EntwurfsStand): {
  title: string;
  statement: string;
  bodyHtml: string;
} {
  return { title: stand.titel, statement: textAusRumpf(stand.rumpf), bodyHtml: stand.rumpf };
}

// ================================================================================================
// DIE DREI-WEGE-ZUSAMMENFÜHRUNG
// ================================================================================================

/** Ein Teil des Ergebnisses: übereinstimmend gelöst oder eine Konfliktstelle. */
export type ZusammenfuehrungsTeil =
  | { art: "geloest"; abschnitte: string[] }
  | { art: "konflikt"; basis: string[]; meine: string[]; deren: string[] };

export interface Zusammenfuehrung {
  teile: ZusammenfuehrungsTeil[];
  konflikte: number;
  /** Das Ergebnis, wenn es keinen Konflikt gibt — sonst `null`. */
  ergebnis: string[] | null;
}

/** Je Basisposition die Position in `b` mit demselben Abschnitt (längste gemeinsame Folge). */
function gemeinsameFolge(a: readonly string[], b: readonly string[]): Map<number, number> {
  const n = a.length;
  const m = b.length;
  // laenge[i * (m + 1) + j]: Länge der längsten gemeinsamen Folge von a[i..] und b[j..].
  const laenge = new Uint32Array((n + 1) * (m + 1));
  const an = (i: number, j: number): number => laenge[i * (m + 1) + j] ?? 0;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      laenge[i * (m + 1) + j] =
        a[i] === b[j] ? an(i + 1, j + 1) + 1 : Math.max(an(i + 1, j), an(i, j + 1));
    }
  }
  const paare = new Map<number, number>();
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      paare.set(i, j);
      i++;
      j++;
    } else if (an(i + 1, j) >= an(i, j + 1)) {
      i++;
    } else {
      j++;
    }
  }
  return paare;
}

const gleich = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Ein Änderungsbereich einer Seite gegenüber der Basis: `basis[bVon, bBis)` wurde durch
 * `seite[sVon, sBis)` ersetzt. Ein reines Einfügen hat `bVon === bBis`.
 */
interface Bereich {
  seite: "meine" | "deren";
  bVon: number;
  bBis: number;
  sVon: number;
  sBis: number;
}

/** Die Änderungsbereiche einer Seite — die Lücken zwischen den gemeinsamen Abschnitten. */
function bereiche(
  basis: readonly string[],
  seite: readonly string[],
  name: Bereich["seite"],
): Bereich[] {
  const raus: Bereich[] = [];
  let b = 0;
  let s = 0;
  for (const [o, m] of gemeinsameFolge(basis, seite)) {
    if (o > b || m > s) {
      raus.push({ seite: name, bVon: b, bBis: o, sVon: s, sBis: m });
    }
    b = o + 1;
    s = m + 1;
  }
  if (b < basis.length || s < seite.length) {
    raus.push({ seite: name, bVon: b, bBis: basis.length, sVon: s, sBis: seite.length });
  }
  return raus;
}

/**
 * Berühren sich zwei Bereiche an derselben Stelle der Basis? Überlappende Bereiche tun es, ebenso
 * zwei Einfügungen an derselben Stelle (ihre Reihenfolge wäre geraten). Ein Bereich, der dort
 * ENDET, wo der andere beginnt, berührt ihn nicht — das sind verschiedene Abschnitte.
 */
function beruehren(gVon: number, gBis: number, b: Bereich): boolean {
  if (b.bVon < gBis && gVon < b.bBis) {
    return true;
  }
  return gVon === gBis && b.bVon === b.bBis && b.bVon === gVon;
}

/**
 * Drei-Wege-Zusammenführung über Abschnitte (diff3 nach Änderungsbereichen). Jede Seite wird als
 * Folge von Änderungsbereichen gegen die Basis gelesen. Bereiche, die sich nicht berühren, gelten
 * unabhängig voneinander — Änderungen an verschiedenen Abschnitten werden also zusammengeführt,
 * auch wenn sie unmittelbar nebeneinander liegen. Berühren sich Bereiche beider Seiten, wird die
 * Gruppe beider Fassungen verglichen: gleich → einmal, verschieden → Konflikt.
 *
 * NACHARBEIT 2 (S5, ENTWURF_KONFLIKT bei verschiedenen Abschnitten): die erste Fassung verlangte
 * zwischen zwei Änderungen einen Abschnitt, der in ALLEN drei Fassungen unverändert steht. Hatte
 * die eine Seite Abschnitt 1 und 2, die andere Abschnitt 3 geändert, fehlte dieser Anker, und
 * verschiedene Abschnitte wurden als ein Konflikt gemeldet.
 */
export function fuehreZusammen(
  basis: readonly string[],
  meine: readonly string[],
  deren: readonly string[],
): Zusammenfuehrung {
  if (Math.max(basis.length, meine.length, deren.length) > ENTWURF_ABSCHNITTE_MAX) {
    throw new EntwurfsFehler(400, "ENTWURF_ZU_GROSS", "Der Entwurf hat zu viele Abschnitte.");
  }
  const alle = [...bereiche(basis, meine, "meine"), ...bereiche(basis, deren, "deren")].sort(
    (a, b) => a.bVon - b.bVon || a.bBis - b.bBis,
  );
  const teile: ZusammenfuehrungsTeil[] = [];
  const geloest = (stueck: readonly string[]): void => {
    if (stueck.length === 0) {
      return;
    }
    const letzter = teile[teile.length - 1];
    if (letzter?.art === "geloest") {
      letzter.abschnitte.push(...stueck);
    } else {
      teile.push({ art: "geloest", abschnitte: [...stueck] });
    }
  };
  /** Der Inhalt einer Seite über `basis[gVon, gBis)`, mit ihren Bereichen darin angewendet. */
  const fassung = (
    gruppe: readonly Bereich[],
    name: Bereich["seite"],
    gVon: number,
    gBis: number,
  ): string[] => {
    const seite = name === "meine" ? meine : deren;
    const raus: string[] = [];
    let pos = gVon;
    for (const b of gruppe) {
      if (b.seite !== name) {
        continue;
      }
      raus.push(...basis.slice(pos, b.bVon), ...seite.slice(b.sVon, b.sBis));
      pos = b.bBis;
    }
    raus.push(...basis.slice(pos, gBis));
    return raus;
  };
  let pos = 0;
  let i = 0;
  while (i < alle.length) {
    const erster = alle[i] as Bereich;
    const gruppe: Bereich[] = [erster];
    let gVon = erster.bVon;
    let gBis = erster.bBis;
    i++;
    while (i < alle.length && beruehren(gVon, gBis, alle[i] as Bereich)) {
      const naechster = alle[i] as Bereich;
      gruppe.push(naechster);
      gVon = Math.min(gVon, naechster.bVon);
      gBis = Math.max(gBis, naechster.bBis);
      i++;
    }
    geloest(basis.slice(pos, gVon));
    const m = fassung(gruppe, "meine", gVon, gBis);
    const d = fassung(gruppe, "deren", gVon, gBis);
    const vonMir = gruppe.some((b) => b.seite === "meine");
    const vonIhnen = gruppe.some((b) => b.seite === "deren");
    if (!(vonMir && vonIhnen) || gleich(m, d)) {
      geloest(vonMir ? m : d);
    } else {
      teile.push({ art: "konflikt", basis: basis.slice(gVon, gBis), meine: m, deren: d });
    }
    pos = gBis;
  }
  geloest(basis.slice(pos));
  const konflikte = teile.filter((t) => t.art === "konflikt").length;
  return {
    teile,
    konflikte,
    ergebnis:
      konflikte === 0 ? teile.flatMap((t) => (t.art === "geloest" ? t.abschnitte : [])) : null,
  };
}

/** Dieselbe Regel für einen einzelnen Wert (den Titel). */
export function fuehreWertZusammen(
  basis: string,
  meine: string,
  deren: string,
): { wert: string } | { konflikt: { basis: string; meine: string; deren: string } } {
  if (meine === basis || meine === deren) {
    return { wert: deren };
  }
  if (deren === basis) {
    return { wert: meine };
  }
  return { konflikt: { basis, meine, deren } };
}

/** Das Ergebnis einer Zusammenführung zweier Stände auf gemeinsamer Basis. */
export type StandZusammenfuehrung =
  | { ok: true; stand: EntwurfsStand }
  | {
      ok: false;
      titel: { basis: string; meine: string; deren: string } | null;
      /**
       * NACHARBEIT 7 (Ben): der konfliktfrei zusammengeführte Titel, wenn nur der INHALT in Konflikt
       * steht — sonst `null`. Ohne ihn behielte die Auflösung den eigenen alten Titel und setzte eine
       * unabhängige fremde Titeländerung beim nächsten Speichern still zurück.
       */
      titelGeloest: string | null;
      teile: ZusammenfuehrungsTeil[];
    };

export function fuehreStaendeZusammen(
  basis: EntwurfsStand,
  meine: EntwurfsStand,
  deren: EntwurfsStand,
): StandZusammenfuehrung {
  const titel = fuehreWertZusammen(basis.titel, meine.titel, deren.titel);
  const inhalt = fuehreZusammen(bloecke(basis.rumpf), bloecke(meine.rumpf), bloecke(deren.rumpf));
  if ("wert" in titel && inhalt.ergebnis !== null) {
    return { ok: true, stand: { titel: titel.wert, rumpf: inhalt.ergebnis.join("") } };
  }
  return {
    ok: false,
    titel: "konflikt" in titel ? titel.konflikt : null,
    titelGeloest: "wert" in titel ? titel.wert : null,
    teile: inhalt.teile,
  };
}

// ================================================================================================
// DIE ABLAGE — Speicher (Tests, Dev) und PostgreSQL (geteilt von allen App-Prozessen).
// ================================================================================================

export interface GemeinsamerEntwurfRepo {
  /** Der offene Entwurf dieses Artikels — höchstens einer. */
  offener(koId: string): Promise<GemeinsamerEntwurf | undefined>;
  /** Der zuletzt geänderte Entwurf dieses Artikels, offen oder abgeschlossen. */
  letzter(koId: string): Promise<GemeinsamerEntwurf | undefined>;
  /** Legt an, wenn es noch keinen offenen gibt; sonst kommt der vorhandene zurück. */
  lege(entwurf: GemeinsamerEntwurf): Promise<{ entwurf: GemeinsamerEntwurf; neu: boolean }>;
  /** Schreibt nur, wenn der gespeicherte Entwurf offen ist und `erwarteteRevision` trägt. */
  schreibe(entwurf: GemeinsamerEntwurf, erwarteteRevision: number): Promise<boolean>;
}

const kopie = (e: GemeinsamerEntwurf): GemeinsamerEntwurf =>
  JSON.parse(JSON.stringify(e)) as GemeinsamerEntwurf;

export class InMemoryGemeinsamerEntwurfRepo implements GemeinsamerEntwurfRepo {
  private readonly entwuerfe = new Map<string, GemeinsamerEntwurf>();

  offener(koId: string): Promise<GemeinsamerEntwurf | undefined> {
    for (const e of this.entwuerfe.values()) {
      if (e.koId === koId && e.zustand === "offen") {
        return Promise.resolve(kopie(e));
      }
    }
    return Promise.resolve(undefined);
  }

  letzter(koId: string): Promise<GemeinsamerEntwurf | undefined> {
    let juengster: GemeinsamerEntwurf | undefined;
    for (const e of this.entwuerfe.values()) {
      if (e.koId === koId && (!juengster || e.geaendertAm >= juengster.geaendertAm)) {
        juengster = e;
      }
    }
    return Promise.resolve(juengster ? kopie(juengster) : undefined);
  }

  async lege(entwurf: GemeinsamerEntwurf): Promise<{ entwurf: GemeinsamerEntwurf; neu: boolean }> {
    const vorhanden = await this.offener(entwurf.koId);
    if (vorhanden) {
      return { entwurf: vorhanden, neu: false };
    }
    this.entwuerfe.set(entwurf.id, kopie(entwurf));
    return { entwurf: kopie(entwurf), neu: true };
  }

  schreibe(entwurf: GemeinsamerEntwurf, erwarteteRevision: number): Promise<boolean> {
    const vorher = this.entwuerfe.get(entwurf.id);
    if (!vorher || vorher.zustand !== "offen" || vorher.revision !== erwarteteRevision) {
      return Promise.resolve(false);
    }
    this.entwuerfe.set(entwurf.id, kopie(entwurf));
    return Promise.resolve(true);
  }
}

/**
 * Eine Tabelle. REIN ADDITIV UND WIEDERHOLBAR: `CREATE TABLE/INDEX IF NOT EXISTS`, kein DROP, kein
 * Fremdschlüssel, keine Extension, kein Seed. Höchstens EIN offener Entwurf je Artikel hält der
 * partielle Unique-Index — auch über mehrere App-Prozesse.
 */
export const GEMEINSAMER_ENTWURF_SCHEMA = `
CREATE TABLE IF NOT EXISTS gemeinsame_entwuerfe (
  id text PRIMARY KEY,
  ko_id text NOT NULL,
  offen boolean NOT NULL,
  revision integer NOT NULL,
  geaendert_am timestamptz NOT NULL,
  data jsonb NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gemeinsame_entwuerfe_offen
  ON gemeinsame_entwuerfe (ko_id) WHERE offen;
`;

export class PgGemeinsamerEntwurfRepo implements GemeinsamerEntwurfRepo {
  constructor(private readonly pool: Pool) {}

  async offener(koId: string): Promise<GemeinsamerEntwurf | undefined> {
    const res = await this.pool.query<{ data: GemeinsamerEntwurf }>(
      "SELECT data FROM gemeinsame_entwuerfe WHERE ko_id = $1 AND offen",
      [koId],
    );
    return res.rows[0]?.data;
  }

  async letzter(koId: string): Promise<GemeinsamerEntwurf | undefined> {
    const res = await this.pool.query<{ data: GemeinsamerEntwurf }>(
      `SELECT data FROM gemeinsame_entwuerfe WHERE ko_id = $1
        ORDER BY geaendert_am DESC, id LIMIT 1`,
      [koId],
    );
    return res.rows[0]?.data;
  }

  async lege(entwurf: GemeinsamerEntwurf): Promise<{ entwurf: GemeinsamerEntwurf; neu: boolean }> {
    const res = await this.pool.query(
      `INSERT INTO gemeinsame_entwuerfe (id, ko_id, offen, revision, geaendert_am, data)
       VALUES ($1, $2, true, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [entwurf.id, entwurf.koId, entwurf.revision, entwurf.geaendertAm, JSON.stringify(entwurf)],
    );
    if ((res.rowCount ?? 0) === 1) {
      return { entwurf, neu: true };
    }
    const vorhanden = await this.offener(entwurf.koId);
    if (!vorhanden) {
      throw new EntwurfsFehler(
        409,
        "ENTWURF_KONKURRENZ",
        "Der Entwurf konnte nicht angelegt werden.",
      );
    }
    return { entwurf: vorhanden, neu: false };
  }

  async schreibe(entwurf: GemeinsamerEntwurf, erwarteteRevision: number): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE gemeinsame_entwuerfe
          SET offen = $3, revision = $4, geaendert_am = $5, data = $6
        WHERE id = $1 AND revision = $2 AND offen`,
      [
        entwurf.id,
        erwarteteRevision,
        entwurf.zustand === "offen",
        entwurf.revision,
        entwurf.geaendertAm,
        JSON.stringify(entwurf),
      ],
    );
    return (res.rowCount ?? 0) === 1;
  }
}

// ================================================================================================
// DER DIENST
// ================================================================================================

/** Was der Dienst vom Artikel wissen muss — genau die Felder, die er liest. */
export interface EntwurfsArtikel {
  id: string;
  title: string;
  statement: string;
  bodyHtml?: string | null;
  version: number;
  history: ReadonlyArray<{ version: number; author: string }>;
  proposals?: ReadonlyArray<{
    id: string;
    author: string;
    baseVersion: number;
    statement: string;
    bodyHtml?: string | null;
    status: string;
  }>;
}

export interface EntwurfsNutzer {
  id: string;
  name: string;
}

/** Wie oft ein Speichervorgang gegen einen gleichzeitig geschriebenen Stand neu zusammenführt. */
const SCHREIBVERSUCHE = 8;

export class GemeinsamerEntwurfDienst {
  constructor(
    private readonly ablage: GemeinsamerEntwurfRepo,
    private readonly uhr: () => number = Date.now,
    private readonly neueKennung: () => string = randomUUID,
  ) {}

  private jetzt(): string {
    return new Date(this.uhr()).toISOString();
  }

  offener(koId: string): Promise<GemeinsamerEntwurf | undefined> {
    return this.ablage.offener(koId);
  }

  letzter(koId: string): Promise<GemeinsamerEntwurf | undefined> {
    return this.ablage.letzter(koId);
  }

  /** Öffnet den Entwurf eines Artikels: den offenen oder einen neuen auf der Lesefassung. */
  async beginne(
    ko: EntwurfsArtikel,
    nutzer: EntwurfsNutzer,
  ): Promise<{ entwurf: GemeinsamerEntwurf; neu: boolean }> {
    const vorhanden = await this.ablage.offener(ko.id);
    if (vorhanden) {
      return { entwurf: vorhanden, neu: false };
    }
    const am = this.jetzt();
    const stand = artikelStand(ko);
    const entwurf: GemeinsamerEntwurf = {
      id: this.neueKennung(),
      koId: ko.id,
      zustand: "offen",
      basisVersion: ko.version,
      basis: stand,
      revision: 1,
      stand,
      staende: [{ revision: 1, stand, nutzerName: nutzer.name }],
      verlauf: [{ revision: 1, am, nutzerId: nutzer.id, nutzerName: nutzer.name, art: "angelegt" }],
      geaendertAm: am,
    };
    return this.ablage.lege(entwurf);
  }

  /**
   * Speichert einen Arbeitsstand. Beruht er auf dem aktuellen, wird er geschrieben; sonst wird er
   * mit dem inzwischen gespeicherten zusammengeführt. Ein Konflikt schreibt nichts (409).
   *
   * NACHARBEIT 5 (Ben): `entwurfId` ist Pflicht. Ein neuer Entwurf beginnt wieder bei Arbeitsstand
   * 1 — ohne die Kennung hätte eine verspätete Anfrage aus einem abgeschlossenen Entwurf den neuen
   * bei gleicher Nummer still überschrieben. Jetzt: 409 `ENTWURF_ERSETZT`, nichts geschrieben.
   *
   * `basisStand` (optional) ist der Stand, auf dem die Eingabe WIRKLICH beruht, wenn er keinem
   * gespeicherten Arbeitsstand gleicht: der Client hat einen Stand gesendet, der zusammengeführt
   * wurde, und danach weitergeschrieben. Dann ist der gesendete Stand die Basis — sonst gingen die
   * hinzugeführten fremden Änderungen beim nächsten Speichern verloren. Er verleiht keine Rechte,
   * die `basisRevision` nicht schon gibt: eine Basis gleich dem aktuellen Stand ist ein direktes
   * Schreiben, wie es jeder Aufruf mit der aktuellen Revision ohnehin darf.
   */
  async speichere(
    koId: string,
    nutzer: EntwurfsNutzer,
    eingabe: {
      entwurfId: string;
      basisRevision: number;
      titel: string;
      rumpf: string;
      basisStand?: EntwurfsStand;
    },
  ): Promise<{ entwurf: GemeinsamerEntwurf; zusammengefuehrt: boolean; unveraendert: boolean }> {
    const meine = this.pruefeStand({ titel: eingabe.titel, rumpf: eingabe.rumpf });
    const basisStand =
      eingabe.basisStand === undefined
        ? undefined
        : {
            titel: eingabe.basisStand.titel.trim(),
            rumpf: normalisiereRumpf(eingabe.basisStand.rumpf),
          };
    for (let versuch = 0; versuch < SCHREIBVERSUCHE; versuch++) {
      const e = await this.offenGenau(koId, eingabe.entwurfId);
      if (eingabe.basisRevision > e.revision || eingabe.basisRevision < 1) {
        throw new EntwurfsFehler(400, "ENTWURF_BASIS_UNGUELTIG", "Unbekannter Arbeitsstand.");
      }
      let neu: EntwurfsStand;
      let zusammengefuehrt = false;
      if (eingabe.basisRevision === e.revision && basisStand === undefined) {
        neu = meine;
      } else {
        const gespeichert = e.staende.find((s) => s.revision === eingabe.basisRevision)?.stand;
        const basis = basisStand ?? gespeichert ?? { titel: "", rumpf: "" };
        const ergebnis = fuehreStaendeZusammen(basis, meine, e.stand);
        if (!ergebnis.ok) {
          throw this.konflikt(e, eingabe.basisRevision, ergebnis);
        }
        neu = ergebnis.stand;
        zusammengefuehrt = eingabe.basisRevision !== e.revision;
      }
      if (neu.titel === e.stand.titel && neu.rumpf === e.stand.rumpf) {
        return { entwurf: e, zusammengefuehrt, unveraendert: true };
      }
      const art = zusammengefuehrt ? "zusammengefuehrt" : "gespeichert";
      const naechste = this.naechsterStand(e, neu, nutzer, art);
      if (await this.ablage.schreibe(naechste, e.revision)) {
        return { entwurf: naechste, zusammengefuehrt, unveraendert: false };
      }
    }
    throw new EntwurfsFehler(
      409,
      "ENTWURF_KONKURRENZ",
      "Zu viele gleichzeitige Speichervorgänge — bitte erneut speichern.",
    );
  }

  /**
   * Hebt den Entwurf auf eine neuere Lesefassung des Artikels (jemand hat ihn daneben geändert):
   * Basis, Entwurf und neue Lesefassung werden zusammengeführt. Ein Konflikt schreibt nichts; mit
   * `aufgeloest` übernimmt der Mensch seine Lösung als neuen Stand auf der neuen Fassung.
   */
  async gleicheAn(
    ko: EntwurfsArtikel,
    nutzer: EntwurfsNutzer,
    eingabe: { revision: number; aufgeloest?: EntwurfsStand; entwurfId?: string },
  ): Promise<GemeinsamerEntwurf> {
    const e = await this.offenGenau(ko.id, eingabe.entwurfId);
    if (eingabe.revision !== e.revision) {
      throw this.veraltet(e);
    }
    if (ko.version === e.basisVersion) {
      return e;
    }
    const lesefassung = artikelStand(ko);
    let neu: EntwurfsStand;
    if (eingabe.aufgeloest) {
      neu = this.pruefeStand(eingabe.aufgeloest);
    } else {
      const ergebnis = fuehreStaendeZusammen(e.basis, e.stand, lesefassung);
      if (!ergebnis.ok) {
        throw new EntwurfsFehler(
          409,
          "ENTWURF_ANGLEICH_KONFLIKT",
          "Die Lesefassung wurde inzwischen an denselben Stellen geändert wie der Entwurf.",
          {
            titel: ergebnis.titel,
            titelGeloest: ergebnis.titelGeloest,
            teile: ergebnis.teile,
            lesefassung: { version: ko.version },
            aktuell: { revision: e.revision },
          },
        );
      }
      neu = ergebnis.stand;
    }
    const naechste: GemeinsamerEntwurf = {
      ...this.naechsterStand(e, neu, nutzer, "angeglichen"),
      basisVersion: ko.version,
      basis: lesefassung,
    };
    const letzter = naechste.verlauf[naechste.verlauf.length - 1];
    if (letzter) {
      letzter.fassung = ko.version;
    }
    if (!(await this.ablage.schreibe(naechste, e.revision))) {
      throw this.veraltet(await this.offenGenau(ko.id));
    }
    return naechste;
  }

  /**
   * Hält fest, dass ein Arbeitsstand übernommen (neue Fassung) oder als Vorschlag eingereicht
   * wurde. Geglaubt wird das nicht: der Artikel muss genau diesen Stand tragen bzw. der Vorschlag
   * genau diesen Text. Ist der Entwurf inzwischen weitergegangen, bleibt er offen — die späteren
   * Änderungen sind dann noch nicht übernommen und gehen nicht verloren.
   */
  async schliesseAb(
    ko: EntwurfsArtikel,
    nutzer: EntwurfsNutzer,
    eingabe: { revision: number; fassung?: number; vorschlagId?: string; entwurfId?: string },
  ): Promise<GemeinsamerEntwurf> {
    for (let versuch = 0; versuch < SCHREIBVERSUCHE; versuch++) {
      const e = await this.offenGenau(ko.id, eingabe.entwurfId);
      const uebernommen = e.staende.find((s) => s.revision === eingabe.revision)?.stand;
      if (!uebernommen || eingabe.revision > e.revision) {
        throw new EntwurfsFehler(400, "ENTWURF_BASIS_UNGUELTIG", "Unbekannter Arbeitsstand.");
      }
      let naechste: GemeinsamerEntwurf;
      const am = this.jetzt();
      const weiter = eingabe.revision !== e.revision;
      if (eingabe.fassung !== undefined) {
        const belegt =
          ko.version === eingabe.fassung &&
          ko.history.some((h) => h.version === eingabe.fassung && h.author === nutzer.id) &&
          ko.title === uebernommen.titel &&
          artikelRumpf(ko) === uebernommen.rumpf;
        if (!belegt) {
          throw new EntwurfsFehler(
            409,
            "ENTWURF_ABSCHLUSS_UNBELEGT",
            "Der Artikel trägt diesen Arbeitsstand nicht als Fassung.",
          );
        }
        const schritt: EntwurfsSchritt = {
          revision: weiter ? e.revision + 1 : e.revision,
          am,
          nutzerId: nutzer.id,
          nutzerName: nutzer.name,
          art: "uebernommen",
          fassung: eingabe.fassung,
        };
        naechste = weiter
          ? {
              ...e,
              revision: e.revision + 1,
              basisVersion: eingabe.fassung,
              basis: uebernommen,
              staende: this.mitStand(e, e.revision + 1, e.stand, nutzer.name),
              verlauf: [...e.verlauf, schritt],
              geaendertAm: am,
            }
          : { ...e, zustand: "uebernommen", verlauf: [...e.verlauf, schritt], geaendertAm: am };
      } else if (eingabe.vorschlagId !== undefined) {
        const vorschlag = ko.proposals?.find((p) => p.id === eingabe.vorschlagId);
        // Ein Vorschlag trägt keinen Titel: ein geänderter Titel wäre mit ihm still verloren.
        const belegt =
          ko.title === uebernommen.titel &&
          vorschlag !== undefined &&
          vorschlag.author === nutzer.id &&
          vorschlag.baseVersion === e.basisVersion &&
          vorschlag.statement === textAusRumpf(uebernommen.rumpf) &&
          typeof vorschlag.bodyHtml === "string" &&
          normalisiereRumpf(vorschlag.bodyHtml) === uebernommen.rumpf;
        if (!belegt) {
          throw new EntwurfsFehler(
            409,
            "ENTWURF_ABSCHLUSS_UNBELEGT",
            "Der Artikel trägt keinen Vorschlag mit diesem Arbeitsstand.",
          );
        }
        const schritt: EntwurfsSchritt = {
          revision: weiter ? e.revision + 1 : e.revision,
          am,
          nutzerId: nutzer.id,
          nutzerName: nutzer.name,
          art: "eingereicht",
          vorschlagId: eingabe.vorschlagId,
        };
        naechste = weiter
          ? {
              ...e,
              revision: e.revision + 1,
              staende: this.mitStand(e, e.revision + 1, e.stand, nutzer.name),
              verlauf: [...e.verlauf, schritt],
              geaendertAm: am,
            }
          : { ...e, zustand: "eingereicht", verlauf: [...e.verlauf, schritt], geaendertAm: am };
      } else {
        throw new EntwurfsFehler(
          400,
          "ENTWURF_ABSCHLUSS_OHNE_ERGEBNIS",
          "fassung oder vorschlagId fehlt.",
        );
      }
      if (await this.ablage.schreibe(naechste, e.revision)) {
        return naechste;
      }
    }
    throw new EntwurfsFehler(409, "ENTWURF_KONKURRENZ", "Zu viele gleichzeitige Speichervorgänge.");
  }

  /**
   * Der offene Entwurf — und, wenn eine Kennung genannt ist, genau DIESER. Nennt die Anfrage einen
   * Entwurf, der inzwischen übernommen, eingereicht oder durch einen neuen ersetzt ist, wird sie mit
   * 409 `ENTWURF_ERSETZT` abgewiesen; der Client behält seine Eingabe.
   */
  private async offenGenau(koId: string, entwurfId?: string): Promise<GemeinsamerEntwurf> {
    const e = await this.ablage.offener(koId);
    if (entwurfId !== undefined && e?.id !== entwurfId) {
      throw new EntwurfsFehler(
        409,
        "ENTWURF_ERSETZT",
        "Dieser Entwurf ist abgeschlossen oder durch einen neuen ersetzt. Nichts wurde gespeichert — deine Eingabe bleibt erhalten.",
        { aktuell: e ? { id: e.id, revision: e.revision } : null },
      );
    }
    if (!e) {
      throw new EntwurfsFehler(404, "ENTWURF_FEHLT", "Zu diesem Artikel ist kein Entwurf offen.");
    }
    return e;
  }

  /** Prüft und kanonisiert einen eingereichten Stand (Titel getrimmt, Rumpf sanitisiert). */
  private pruefeStand(eingabe: EntwurfsStand): EntwurfsStand {
    const stand: EntwurfsStand = {
      titel: eingabe.titel.trim(),
      rumpf: normalisiereRumpf(eingabe.rumpf),
    };
    if (stand.titel.length === 0) {
      throw new EntwurfsFehler(400, "ENTWURF_OHNE_TITEL", "Der Titel darf nicht leer sein.");
    }
    if (stand.rumpf.length === 0) {
      throw new EntwurfsFehler(400, "ENTWURF_OHNE_TEXT", "Der Inhalt darf nicht leer sein.");
    }
    if (
      stand.rumpf.length > ENTWURF_TEXT_MAX ||
      bloecke(stand.rumpf).length > ENTWURF_ABSCHNITTE_MAX
    ) {
      throw new EntwurfsFehler(400, "ENTWURF_ZU_GROSS", "Der Entwurf ist zu groß.");
    }
    return stand;
  }

  private mitStand(
    e: GemeinsamerEntwurf,
    revision: number,
    stand: EntwurfsStand,
    nutzerName: string,
  ): GemeinsamerEntwurf["staende"] {
    return [...e.staende, { revision, stand, nutzerName }].slice(-ENTWURF_STAENDE_MAX);
  }

  private naechsterStand(
    e: GemeinsamerEntwurf,
    stand: EntwurfsStand,
    nutzer: EntwurfsNutzer,
    art: EntwurfsSchrittArt,
  ): GemeinsamerEntwurf {
    const revision = e.revision + 1;
    const am = this.jetzt();
    return {
      ...e,
      revision,
      stand,
      staende: this.mitStand(e, revision, stand, nutzer.name),
      verlauf: [...e.verlauf, { revision, am, nutzerId: nutzer.id, nutzerName: nutzer.name, art }],
      geaendertAm: am,
    };
  }

  private veraltet(e: GemeinsamerEntwurf): EntwurfsFehler {
    return new EntwurfsFehler(
      409,
      "ENTWURF_VERALTET",
      "Inzwischen wurde ein neuerer Arbeitsstand gespeichert.",
      { aktuell: { revision: e.revision } },
    );
  }

  /** Der Konflikt als Antwort: je Stelle Basis, eigene und gespeicherte Fassung samt Urheber. */
  private konflikt(
    e: GemeinsamerEntwurf,
    basisRevision: number,
    ergebnis: Extract<StandZusammenfuehrung, { ok: false }>,
  ): EntwurfsFehler {
    const seither = e.verlauf
      .filter((s) => s.revision > basisRevision)
      .map((s) => s.nutzerName)
      .filter((name, i, alle) => alle.indexOf(name) === i);
    return new EntwurfsFehler(
      409,
      "ENTWURF_KONFLIKT",
      "Derselbe Abschnitt wurde inzwischen anders geändert. Nichts wurde gespeichert — bitte je Stelle entscheiden.",
      {
        titel: ergebnis.titel,
        titelGeloest: ergebnis.titelGeloest,
        teile: ergebnis.teile,
        basisRevision,
        aktuell: {
          id: e.id,
          revision: e.revision,
          titel: e.stand.titel,
          rumpf: e.stand.rumpf,
          text: textAusRumpf(e.stand.rumpf),
        },
        seitherVon: seither,
      },
    );
  }
}
