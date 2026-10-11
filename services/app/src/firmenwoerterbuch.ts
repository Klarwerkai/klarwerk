import type { Pool } from "pg";

// ================================================================================================
// FIRMENWÖRTERBUCH — DER VERBINDLICHE BEGRIFFSKATALOG EINER UNTERNEHMENSINSTANZ.
// ================================================================================================
//
// Auftrag `produkt:wettbewerb:20261003:firmenwoerterbuch`: ein je Unternehmen gepflegter
// Begriffskatalog mit Anwendung im Schreibablauf (Klarwerk-Editor und Klaras Word-Host). Diese
// Datei trägt den Fachkern: die Gestalt eines Eintrags, seine Prüfung, die versionierte Ablage und
// den Abgleich eines Textes gegen den Katalog. Routen: `routes/begriffe-routes.ts`.
//
// WAS DER ABGLEICH IST — UND WAS NICHT:
//   · Er ist REIN DETERMINISTISCH: Wortgrenzen-Suche nach gepflegten Benennungen. Kein Modell,
//     kein Embedder, kein externer Dienst. Diese Datei importiert nichts ausser dem pg-Typ; das
//     misst `tests/firmenwoerterbuch/begriffe-ohne-ki.test.ts`.
//   · Er sagt nur etwas über die BENENNUNG. Ein Hinweis bedeutet „hier steht eine im Katalog
//     unerwünschte Benennung", nie „diese Aussage ist richtig" — und das Fehlen eines Hinweises
//     ist kein Beleg für sachliche Richtigkeit. Validation und Konflikterkennung kennen diese
//     Datei nicht und bleiben unverändert zuständig.
//   · Er ÄNDERT NICHTS. Übernehmen oder Verwerfen geschieht ausschliesslich im Client, an genau
//     der gewählten Stelle. Bestehende Wissensobjekte, Fassungen und Freigaben werden weder
//     gelesen noch geschrieben.
//
// DE/EN: Ein Eintrag kann beide Sprachfassungen tragen — das ist die bewusst gepflegte Verknüpfung
// zu EINEM Konzept. Der Abgleich bleibt trotzdem sprachrein: eine unerwünschte deutsche Benennung
// bekommt nur die deutsche Vorzugsbezeichnung vorgeschlagen, nie die englische. Eine Übersetzung
// wird also nicht ungeprüft gleichgesetzt; sie steht nur dort, wo jemand sie gepflegt hat.
//
// GLEICHLAUTENDE BEGRIFFE: Der Geltungsbereich gehört zum Eintrag. Zwei Einträge mit derselben
// Vorzugsbezeichnung in verschiedenen Geltungsbereichen bleiben zwei Einträge; im selben
// Geltungsbereich wird die Dublette abgewiesen statt still zusammengeführt.

export const SPRACHEN = ["de", "en"] as const;
export type BegriffSprache = (typeof SPRACHEN)[number];

/** Die gepflegten Benennungen eines Konzepts in EINER Sprache. */
export interface Benennungen {
  vorzug: string;
  synonyme: string[];
  unerwuenscht: string[];
}

/** Was eine berechtigte Person pflegt. */
export interface BegriffEingabe {
  geltungsbereich: string;
  verantwortlich: string;
  definition: Partial<Record<BegriffSprache, string>>;
  bezeichnungen: Partial<Record<BegriffSprache, Benennungen>>;
}

/** Eine gespeicherte, unveränderliche Fassung eines Eintrags. */
export interface BegriffFassung extends BegriffEingabe {
  id: string;
  version: number;
  geaendertVon: string;
  geaendertAm: string;
}

export const BEGRIFF_GRENZEN = {
  feld: 120,
  benennung: 80,
  definition: 2_000,
  benennungenJeListe: 20,
  segmente: 2_000,
  zeichenGesamt: 200_000,
  kontext: 120,
} as const;

export class BegriffFehler extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "BegriffFehler";
  }
}

function text(wert: unknown): string | undefined {
  return typeof wert === "string" ? wert.normalize("NFC").replace(/\s+/g, " ").trim() : undefined;
}

function objekt(wert: unknown): Record<string, unknown> {
  return typeof wert === "object" && wert !== null ? (wert as Record<string, unknown>) : {};
}

function benennungsliste(wert: unknown, feld: string): string[] {
  if (wert === undefined || wert === null) {
    return [];
  }
  if (!Array.isArray(wert)) {
    throw new BegriffFehler("BEGRIFF_UNGUELTIG", `${feld} muss eine Liste sein.`);
  }
  const raus: string[] = [];
  for (const eintrag of wert) {
    const t = text(eintrag);
    if (t === undefined) {
      throw new BegriffFehler(
        "BEGRIFF_UNGUELTIG",
        `${feld} enthält einen Wert, der kein Text ist.`,
      );
    }
    if (t.length === 0) {
      continue;
    }
    if (t.length > BEGRIFF_GRENZEN.benennung) {
      throw new BegriffFehler(
        "BEGRIFF_UNGUELTIG",
        `${feld}: eine Benennung ist länger als ${BEGRIFF_GRENZEN.benennung} Zeichen.`,
      );
    }
    if (!raus.some((r) => r.toLocaleLowerCase() === t.toLocaleLowerCase())) {
      raus.push(t);
    }
  }
  if (raus.length > BEGRIFF_GRENZEN.benennungenJeListe) {
    throw new BegriffFehler(
      "BEGRIFF_UNGUELTIG",
      `${feld}: höchstens ${BEGRIFF_GRENZEN.benennungenJeListe} Benennungen.`,
    );
  }
  return raus;
}

/**
 * Prüft eine eingehende Pflege-Eingabe und gibt sie bereinigt zurück — oder wirft `BegriffFehler`.
 *
 * Pflicht: Geltungsbereich, verantwortliche Pflege, mindestens eine Sprachfassung mit
 * Vorzugsbezeichnung und eine Definition. Eine Definition steht nur in einer Sprache, für die es
 * auch Benennungen gibt. Innerhalb einer Sprache darf dieselbe Benennung nicht zugleich erlaubt
 * (Vorzug/Synonym) und unerwünscht sein — das wäre ein Eintrag, der sich selbst widerspricht.
 */
export function pruefeBegriffEingabe(roh: unknown): BegriffEingabe {
  if (typeof roh !== "object" || roh === null) {
    throw new BegriffFehler("BEGRIFF_UNGUELTIG", "Erwartet wird ein Begriffseintrag als Objekt.");
  }
  const r = roh as Record<string, unknown>;
  const geltungsbereich = text(r.geltungsbereich) ?? "";
  const verantwortlich = text(r.verantwortlich) ?? "";
  if (!geltungsbereich || geltungsbereich.length > BEGRIFF_GRENZEN.feld) {
    throw new BegriffFehler(
      "BEGRIFF_UNGUELTIG",
      "Der fachliche Geltungsbereich fehlt oder ist zu lang.",
    );
  }
  if (!verantwortlich || verantwortlich.length > BEGRIFF_GRENZEN.feld) {
    throw new BegriffFehler(
      "BEGRIFF_UNGUELTIG",
      "Die verantwortliche Pflege fehlt oder ist zu lang.",
    );
  }
  const rohBez = objekt(r.bezeichnungen);
  const rohDef = objekt(r.definition);
  const bezeichnungen: Partial<Record<BegriffSprache, Benennungen>> = {};
  const definition: Partial<Record<BegriffSprache, string>> = {};
  for (const sprache of SPRACHEN) {
    const b = rohBez[sprache];
    const d = text(rohDef[sprache]) ?? "";
    if (b === undefined || b === null) {
      if (d) {
        throw new BegriffFehler(
          "BEGRIFF_UNGUELTIG",
          `Definition (${sprache}) ohne Benennungen in dieser Sprache.`,
        );
      }
      continue;
    }
    if (typeof b !== "object") {
      throw new BegriffFehler("BEGRIFF_UNGUELTIG", `Benennungen (${sprache}) sind kein Objekt.`);
    }
    const bb = b as Record<string, unknown>;
    const vorzug = text(bb.vorzug) ?? "";
    if (!vorzug || vorzug.length > BEGRIFF_GRENZEN.benennung) {
      throw new BegriffFehler(
        "BEGRIFF_UNGUELTIG",
        `Die Vorzugsbezeichnung (${sprache}) fehlt oder ist zu lang.`,
      );
    }
    const synonyme = benennungsliste(bb.synonyme, `Synonyme (${sprache})`);
    const unerwuenscht = benennungsliste(bb.unerwuenscht, `Unerwünschte Benennungen (${sprache})`);
    const erlaubt = [vorzug, ...synonyme].map((x) => x.toLocaleLowerCase());
    const widerspruch = unerwuenscht.find((u) => erlaubt.includes(u.toLocaleLowerCase()));
    if (widerspruch) {
      throw new BegriffFehler(
        "BEGRIFF_WIDERSPRUECHLICH",
        `„${widerspruch}" ist zugleich erlaubt und unerwünscht (${sprache}).`,
      );
    }
    if (d.length > BEGRIFF_GRENZEN.definition) {
      throw new BegriffFehler("BEGRIFF_UNGUELTIG", `Die Definition (${sprache}) ist zu lang.`);
    }
    bezeichnungen[sprache] = {
      vorzug,
      synonyme: synonyme.filter((s) => s.toLocaleLowerCase() !== vorzug.toLocaleLowerCase()),
      unerwuenscht,
    };
    if (d) {
      definition[sprache] = d;
    }
  }
  if (Object.keys(bezeichnungen).length === 0) {
    throw new BegriffFehler(
      "BEGRIFF_UNGUELTIG",
      "Mindestens eine Sprachfassung (de oder en) mit Vorzugsbezeichnung ist nötig.",
    );
  }
  if (Object.keys(definition).length === 0) {
    throw new BegriffFehler("BEGRIFF_UNGUELTIG", "Eine Definition ist Pflicht.");
  }
  return { geltungsbereich, verantwortlich, definition, bezeichnungen };
}

function gleich(a: string, b: string): boolean {
  return a.toLocaleLowerCase() === b.toLocaleLowerCase();
}

/**
 * Ein anderer Eintrag mit derselben Vorzugsbezeichnung (gleiche Sprache) im SELBEN
 * Geltungsbereich — das wäre eine stille Doppelung. In einem ANDEREN Geltungsbereich ist dieselbe
 * Benennung ausdrücklich erlaubt: gleichlautend, aber fachlich getrennt.
 */
export function doppelterEintrag(
  bestand: readonly BegriffFassung[],
  eingabe: BegriffEingabe,
  ausser?: string,
): BegriffFassung | undefined {
  return bestand.find(
    (b) =>
      b.id !== ausser &&
      gleich(b.geltungsbereich, eingabe.geltungsbereich) &&
      SPRACHEN.some((s) => {
        const x = b.bezeichnungen[s]?.vorzug;
        const y = eingabe.bezeichnungen[s]?.vorzug;
        return x !== undefined && y !== undefined && gleich(x, y);
      }),
  );
}

// ================================================================================================
// DER ABGLEICH
// ================================================================================================

/** Ein Hinweis an genau einer Fundstelle. Bezieht sich auf GENAU EINE Fassung eines Eintrags. */
export interface BegriffsHinweis {
  begriffId: string;
  begriffVersion: number;
  sprache: BegriffSprache;
  geltungsbereich: string;
  /** Index des Textsegments (Textknoten im Editor, Absatz in Word), in dem der Fund liegt. */
  segment: number;
  /** Zeichenposition (UTF-16) im Segment, Anfang inklusive, Ende exklusive. */
  start: number;
  ende: number;
  /** Der Text an der Fundstelle, so wie er im Segment steht. */
  gefunden: string;
  /** Wie oft genau dieser Text als ganzes Wort VOR der Fundstelle im Segment steht (Word-Suche). */
  vorkommen: number;
  /**
   * Wie oft genau dieser Text als ganzes Wort im ganzen Segment steht. Das Word-Panel ersetzt nur,
   * wenn Words eigene Suche dieselbe Zahl findet — sonst wäre unklar, welche Stelle gemeint ist.
   */
  vorkommenGesamt: number;
  vorzug: string;
  definition: string | null;
  /** Dieselbe Fundstelle wird von mehreren Einträgen verschiedener Geltungsbereiche beansprucht. */
  mehrdeutig: boolean;
}

export interface BegriffsPruefung {
  hinweise: BegriffsHinweis[];
  /** Wie viele Einträge im angewandten Geltungsbereich lagen (nicht: wie viele es insgesamt gibt). */
  begriffeGeprueft: number;
  kontext: string | null;
  /**
   * Fest `false`. Der Abgleich prüft Benennungen, keine Sachverhalte — die Zahl der Hinweise,
   * auch null, ist keine Aussage über die Richtigkeit des Textes.
   */
  sachlichGeprueft: false;
}

function suchmuster(benennung: string, schalter: string): RegExp {
  const kern = benennung
    .split(" ")
    .map((teil) => teil.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  return new RegExp(`(?<![\\p{L}\\p{N}_])${kern}(?![\\p{L}\\p{N}_])`, schalter);
}

interface Spanne {
  start: number;
  ende: number;
}

function fundstellen(segment: string, benennung: string): Spanne[] {
  const raus: Spanne[] = [];
  for (const m of segment.matchAll(suchmuster(benennung, "giu"))) {
    const start = m.index ?? 0;
    raus.push({ start, ende: start + m[0].length });
  }
  return raus;
}

/** Die Anfänge aller Stellen, an denen genau dieser Text (gleiche Schreibung) als Wort steht. */
function exakteAnfaenge(segment: string, gefunden: string): number[] {
  return [...segment.matchAll(suchmuster(gefunden, "gu"))].map((m) => m.index ?? 0);
}

/** Die Einträge, die für einen Text gelten: im genannten Geltungsbereich — ohne Angabe alle. */
export function anwendbareEintraege(
  bestand: readonly BegriffFassung[],
  kontext: string | null,
): BegriffFassung[] {
  if (!kontext) {
    return [...bestand];
  }
  return bestand.filter((b) => gleich(b.geltungsbereich, kontext));
}

/**
 * Gleicht Textsegmente gegen den Katalog ab.
 *
 * Je Segment und Sprache: zuerst die ERLAUBTEN Stellen (Vorzugsbezeichnung und Synonyme aller
 * anwendbaren Einträge), dann die unerwünschten Benennungen. Ein Fund, der ganz in einer erlaubten
 * Stelle liegt, ist kein Hinweis — ein zugelassenes Synonym wird nicht als Fehler markiert.
 * Beanspruchen Einträge verschiedener Geltungsbereiche dieselbe Fundstelle, bleiben es getrennte
 * Hinweise, beide als `mehrdeutig` gekennzeichnet; die Wahl trifft der Mensch.
 */
export function begriffsHinweise(
  bestand: readonly BegriffFassung[],
  segmente: readonly string[],
  kontextRoh?: string | null,
): BegriffsPruefung {
  const kontext = text(kontextRoh ?? undefined) || null;
  const eintraege = anwendbareEintraege(bestand, kontext);
  const hinweise: BegriffsHinweis[] = [];
  segmente.forEach((segment, index) => {
    if (!segment) {
      return;
    }
    for (const sprache of SPRACHEN) {
      const erlaubt: Spanne[] = [];
      for (const e of eintraege) {
        const b = e.bezeichnungen[sprache];
        if (!b) {
          continue;
        }
        for (const benennung of [b.vorzug, ...b.synonyme]) {
          erlaubt.push(...fundstellen(segment, benennung));
        }
      }
      for (const e of eintraege) {
        const b = e.bezeichnungen[sprache];
        if (!b) {
          continue;
        }
        for (const benennung of b.unerwuenscht) {
          for (const f of fundstellen(segment, benennung)) {
            if (erlaubt.some((s) => s.start <= f.start && f.ende <= s.ende)) {
              continue;
            }
            const gefunden = segment.slice(f.start, f.ende);
            const anfaenge = exakteAnfaenge(segment, gefunden);
            hinweise.push({
              begriffId: e.id,
              begriffVersion: e.version,
              sprache,
              geltungsbereich: e.geltungsbereich,
              segment: index,
              start: f.start,
              ende: f.ende,
              gefunden,
              vorkommen: anfaenge.filter((a) => a < f.start).length,
              vorkommenGesamt: anfaenge.length,
              vorzug: b.vorzug,
              definition: e.definition[sprache] ?? null,
              mehrdeutig: false,
            });
          }
        }
      }
    }
  });
  for (const h of hinweise) {
    h.mehrdeutig = hinweise.some(
      (x) =>
        x !== h &&
        x.segment === h.segment &&
        x.start < h.ende &&
        h.start < x.ende &&
        !gleich(x.geltungsbereich, h.geltungsbereich),
    );
  }
  hinweise.sort((a, b) => a.segment - b.segment || a.start - b.start || a.ende - b.ende);
  return { hinweise, begriffeGeprueft: eintraege.length, kontext, sachlichGeprueft: false };
}

// ================================================================================================
// DIE ABLAGE — JEDE ÄNDERUNG IST EINE NEUE, UNVERÄNDERLICHE FASSUNG.
// ================================================================================================

export interface BegriffeRepo {
  /** Je Eintrag die jüngste Fassung. */
  aktuelle(): Promise<BegriffFassung[]>;
  /** Alle Fassungen eines Eintrags, aufsteigend nach Version — leer, wenn es ihn nicht gibt. */
  fassungen(id: string): Promise<BegriffFassung[]>;
  /**
   * Legt eine neue Fassung ab. `false`, wenn es diese Version schon gibt — dann hat jemand anders
   * dazwischen geschrieben, und nichts wird überschrieben.
   */
  lege(fassung: BegriffFassung): Promise<boolean>;
}

export class InMemoryBegriffeRepo implements BegriffeRepo {
  private readonly zeilen = new Map<string, BegriffFassung[]>();

  aktuelle(): Promise<BegriffFassung[]> {
    const raus: BegriffFassung[] = [];
    for (const liste of this.zeilen.values()) {
      const letzte = liste[liste.length - 1];
      if (letzte) {
        raus.push(structuredClone(letzte));
      }
    }
    return Promise.resolve(raus);
  }

  fassungen(id: string): Promise<BegriffFassung[]> {
    return Promise.resolve((this.zeilen.get(id) ?? []).map((f) => structuredClone(f)));
  }

  lege(fassung: BegriffFassung): Promise<boolean> {
    const liste = this.zeilen.get(fassung.id) ?? [];
    if (liste.some((f) => f.version === fassung.version)) {
      return Promise.resolve(false);
    }
    liste.push(structuredClone(fassung));
    liste.sort((a, b) => a.version - b.version);
    this.zeilen.set(fassung.id, liste);
    return Promise.resolve(true);
  }
}

/**
 * Die Tabelle der Fassungen. REIN ADDITIV UND WIEDERHOLBAR: `CREATE TABLE IF NOT EXISTS`, kein
 * DROP, kein DELETE, kein UPDATE, kein Fremdschlüssel, kein Seed. Der zusammengesetzte
 * Primärschlüssel ist die Nebenläufigkeitsregel: zwei Schreiber derselben Version — einer gewinnt,
 * der andere bekommt `false` und damit 409.
 */
export const BEGRIFFE_SCHEMA = `
CREATE TABLE IF NOT EXISTS begriffe_fassungen (
  begriff_id text NOT NULL,
  version integer NOT NULL,
  data jsonb NOT NULL,
  geaendert_von text NOT NULL,
  geaendert_am timestamptz NOT NULL,
  PRIMARY KEY (begriff_id, version)
);
`;

interface FassungsZeile {
  data: BegriffFassung;
}

export class PgBegriffeRepo implements BegriffeRepo {
  constructor(private readonly pool: Pool) {}

  async aktuelle(): Promise<BegriffFassung[]> {
    const res = await this.pool.query<FassungsZeile>(
      `SELECT DISTINCT ON (begriff_id) data
         FROM begriffe_fassungen
        ORDER BY begriff_id, version DESC`,
    );
    return res.rows.map((z) => z.data);
  }

  async fassungen(id: string): Promise<BegriffFassung[]> {
    const res = await this.pool.query<FassungsZeile>(
      "SELECT data FROM begriffe_fassungen WHERE begriff_id=$1 ORDER BY version ASC",
      [id],
    );
    return res.rows.map((z) => z.data);
  }

  async lege(fassung: BegriffFassung): Promise<boolean> {
    const res = await this.pool.query(
      `INSERT INTO begriffe_fassungen(begriff_id, version, data, geaendert_von, geaendert_am)
       VALUES($1,$2,$3,$4,$5)
       ON CONFLICT (begriff_id, version) DO NOTHING`,
      [
        fassung.id,
        fassung.version,
        JSON.stringify(fassung),
        fassung.geaendertVon,
        fassung.geaendertAm,
      ],
    );
    return (res.rowCount ?? 0) === 1;
  }
}
