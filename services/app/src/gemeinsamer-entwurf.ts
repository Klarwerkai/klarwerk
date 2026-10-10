import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

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
// ABSCHNITT = ein durch eine Leerzeile getrennter Absatz des Artikeltextes. Der Titel ist ein
// eigener Wert mit derselben Regel. Ein Artikel, dessen Rumpf mehr trägt als Absätze (Bilder,
// Tabellen, Listen, Überschriften), wird hier NICHT gemeinsam bearbeitet
// (`ENTWURF_REICHER_INHALT`): das Zurückschreiben als Absätze würde diesen Inhalt still entfernen.

/** Titel und Text eines Arbeitsstands; `text` normalisiert (Abschnitte, je eine Leerzeile). */
export interface EntwurfsStand {
  titel: string;
  text: string;
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

/** Ein Rumpf aus nichts als Absätzen mit Klartext und Zeilenumbrüchen. */
const EINFACHER_RUMPF = /^(?:\s*<p>(?:[^<]|<br\s*\/?>)*<\/p>)*\s*$/i;

export type RumpfArt = "keiner" | "einfach" | "reich";

/**
 * Der Text eines Artikels, wie ihn der Entwurf bearbeitet — und welche Art Rumpf er hat. Ohne
 * Rumpf ist es die Aussage; bei einem einfachen Rumpf sind es seine Absätze; ein reicher Rumpf
 * wird nicht zerlegt (`reich`), weil sein Zurückschreiben Inhalt entfernen würde.
 */
export function artikelText(ko: { statement: string; bodyHtml?: string | null }): {
  text: string;
  rumpf: RumpfArt;
} {
  const rumpf = typeof ko.bodyHtml === "string" ? ko.bodyHtml : "";
  if (rumpf.trim().length === 0) {
    return { text: normalisiereText(ko.statement), rumpf: "keiner" };
  }
  if (!EINFACHER_RUMPF.test(rumpf)) {
    return { text: normalisiereText(ko.statement), rumpf: "reich" };
  }
  const absaetze: string[] = [];
  for (const treffer of rumpf.matchAll(/<p>((?:[^<]|<br\s*\/?>)*)<\/p>/gi)) {
    absaetze.push(entschluessele((treffer[1] ?? "").replace(/<br\s*\/?>/gi, "\n")));
  }
  return { text: normalisiereText(absaetze.join("\n\n")), rumpf: "einfach" };
}

/** Der Rumpf zu einem Entwurfstext — je Abschnitt ein Absatz, Zeilenumbrüche als `<br>`. */
export function rumpfAusText(text: string): string {
  return abschnitte(text)
    .map((a) => `<p>${verschluessele(a).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/**
 * Was die Übernahme an `PUT /api/kos/:id` schickt (`action: "revise"` bzw. `"propose"`). Hat der
 * Artikel einen einfachen Rumpf, wird er mitgeschrieben — sonst läse der Leser weiter den alten.
 */
export function uebernahmeAenderung(
  stand: EntwurfsStand,
  rumpf: RumpfArt,
): { title: string; statement: string; bodyHtml?: string } {
  return {
    title: stand.titel,
    statement: stand.text,
    ...(rumpf === "einfach" ? { bodyHtml: rumpfAusText(stand.text) } : {}),
  };
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
      teile: ZusammenfuehrungsTeil[];
    };

export function fuehreStaendeZusammen(
  basis: EntwurfsStand,
  meine: EntwurfsStand,
  deren: EntwurfsStand,
): StandZusammenfuehrung {
  const titel = fuehreWertZusammen(basis.titel, meine.titel, deren.titel);
  const text = fuehreZusammen(
    abschnitte(basis.text),
    abschnitte(meine.text),
    abschnitte(deren.text),
  );
  if ("wert" in titel && text.ergebnis !== null) {
    return { ok: true, stand: { titel: titel.wert, text: text.ergebnis.join("\n\n") } };
  }
  return { ok: false, titel: "konflikt" in titel ? titel.konflikt : null, teile: text.teile };
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
    const { text, rumpf } = artikelText(ko);
    if (rumpf === "reich") {
      throw new EntwurfsFehler(
        409,
        "ENTWURF_REICHER_INHALT",
        "Dieser Artikel enthält mehr als Absätze (etwa Bilder, Tabellen oder Listen). Der gemeinsame Entwurf bearbeitet nur Titel und Absätze und würde diesen Inhalt beim Übernehmen entfernen — bitte im Artikel selbst bearbeiten.",
      );
    }
    const am = this.jetzt();
    const stand: EntwurfsStand = { titel: ko.title, text };
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
   */
  async speichere(
    koId: string,
    nutzer: EntwurfsNutzer,
    eingabe: { basisRevision: number; titel: string; text: string },
  ): Promise<{ entwurf: GemeinsamerEntwurf; zusammengefuehrt: boolean; unveraendert: boolean }> {
    const meine: EntwurfsStand = {
      titel: eingabe.titel.trim(),
      text: normalisiereText(eingabe.text),
    };
    if (meine.titel.length === 0) {
      throw new EntwurfsFehler(400, "ENTWURF_OHNE_TITEL", "Der Titel darf nicht leer sein.");
    }
    if (meine.text.length === 0) {
      throw new EntwurfsFehler(400, "ENTWURF_OHNE_TEXT", "Der Text darf nicht leer sein.");
    }
    if (
      meine.text.length > ENTWURF_TEXT_MAX ||
      abschnitte(meine.text).length > ENTWURF_ABSCHNITTE_MAX
    ) {
      throw new EntwurfsFehler(400, "ENTWURF_ZU_GROSS", "Der Entwurf ist zu groß.");
    }
    for (let versuch = 0; versuch < SCHREIBVERSUCHE; versuch++) {
      const e = await this.offenOder404(koId);
      if (eingabe.basisRevision > e.revision || eingabe.basisRevision < 1) {
        throw new EntwurfsFehler(400, "ENTWURF_BASIS_UNGUELTIG", "Unbekannter Arbeitsstand.");
      }
      let neu: EntwurfsStand;
      let zusammengefuehrt = false;
      if (eingabe.basisRevision === e.revision) {
        neu = meine;
      } else {
        const basis = e.staende.find((s) => s.revision === eingabe.basisRevision)?.stand ?? {
          titel: "",
          text: "",
        };
        const ergebnis = fuehreStaendeZusammen(basis, meine, e.stand);
        if (!ergebnis.ok) {
          throw this.konflikt(e, eingabe.basisRevision, ergebnis);
        }
        neu = ergebnis.stand;
        zusammengefuehrt = true;
      }
      if (neu.titel === e.stand.titel && neu.text === e.stand.text) {
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
    eingabe: { revision: number; aufgeloest?: EntwurfsStand },
  ): Promise<GemeinsamerEntwurf> {
    const e = await this.offenOder404(ko.id);
    if (eingabe.revision !== e.revision) {
      throw this.veraltet(e);
    }
    if (ko.version === e.basisVersion) {
      return e;
    }
    const { text, rumpf } = artikelText(ko);
    if (rumpf === "reich") {
      throw new EntwurfsFehler(
        409,
        "ENTWURF_REICHER_INHALT",
        "Die aktuelle Lesefassung enthält mehr als Absätze; der gemeinsame Entwurf kann sie nicht aufnehmen.",
      );
    }
    const lesefassung: EntwurfsStand = { titel: ko.title, text };
    let neu: EntwurfsStand;
    if (eingabe.aufgeloest) {
      neu = {
        titel: eingabe.aufgeloest.titel.trim(),
        text: normalisiereText(eingabe.aufgeloest.text),
      };
      if (neu.titel.length === 0 || neu.text.length === 0) {
        throw new EntwurfsFehler(
          400,
          "ENTWURF_OHNE_TEXT",
          "Titel und Text dürfen nicht leer sein.",
        );
      }
    } else {
      const ergebnis = fuehreStaendeZusammen(e.basis, e.stand, lesefassung);
      if (!ergebnis.ok) {
        throw new EntwurfsFehler(
          409,
          "ENTWURF_ANGLEICH_KONFLIKT",
          "Die Lesefassung wurde inzwischen an denselben Stellen geändert wie der Entwurf.",
          {
            titel: ergebnis.titel,
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
      throw this.veraltet(await this.offenOder404(ko.id));
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
    eingabe: { revision: number; fassung?: number; vorschlagId?: string },
  ): Promise<GemeinsamerEntwurf> {
    for (let versuch = 0; versuch < SCHREIBVERSUCHE; versuch++) {
      const e = await this.offenOder404(ko.id);
      const uebernommen = e.staende.find((s) => s.revision === eingabe.revision)?.stand;
      if (!uebernommen || eingabe.revision > e.revision) {
        throw new EntwurfsFehler(400, "ENTWURF_BASIS_UNGUELTIG", "Unbekannter Arbeitsstand.");
      }
      let naechste: GemeinsamerEntwurf;
      const am = this.jetzt();
      const weiter = eingabe.revision !== e.revision;
      if (eingabe.fassung !== undefined) {
        const artikel = artikelText(ko);
        const belegt =
          ko.version === eingabe.fassung &&
          ko.history.some((h) => h.version === eingabe.fassung && h.author === nutzer.id) &&
          ko.title === uebernommen.titel &&
          artikel.text === uebernommen.text;
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
          vorschlag.statement === uebernommen.text;
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

  private async offenOder404(koId: string): Promise<GemeinsamerEntwurf> {
    const e = await this.ablage.offener(koId);
    if (!e) {
      throw new EntwurfsFehler(404, "ENTWURF_FEHLT", "Zu diesem Artikel ist kein Entwurf offen.");
    }
    return e;
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
        teile: ergebnis.teile,
        basisRevision,
        aktuell: { revision: e.revision, titel: e.stand.titel, text: e.stand.text },
        seitherVon: seither,
      },
    );
  }
}
