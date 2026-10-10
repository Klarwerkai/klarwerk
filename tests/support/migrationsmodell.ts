import { createHash } from "node:crypto";
import type { Risikoklasse } from "../../services/app/src/migrationsbeleg";

// ==================================================================================================
// JOB 727 · D2 — DAS PRÜFMODELL DER MIGRATIONSSTUFEN.
// ==================================================================================================
//
// R-1349: Dieses Modell stand bis hierher in `services/app/src/migrationsbeleg.ts`. Kein Produktweg
// hat es gerufen — es klassifiziert den Quelltext der Stufen, damit `db.migrate.test.ts` die
// ausgeschriebene Sollliste gegen das tatsächliche Risiko jeder Stufe halten kann. Es liegt deshalb
// bei den Tests, unverändert im Inhalt. Im Produkt geblieben sind die beiden Listen, die das
// Release-Werkzeug `scripts/insel/schema-vertrag.mjs` aus dem Quelltext liest.
//
// WAS DIESES MODELL AUSDRÜCKLICH NICHT IST: ein Migrationsjournal. Es weiß nicht, ob eine Stufe
// gelaufen ist, wann sie lief, ob sie abbrach oder ob gerade eine läuft. Deshalb heißt das Ergebnis
// `Strukturbeleg` und trägt kein einziges Zustandsfeld (BEN an BASIC4 727/D1).

const RANG: Readonly<Record<Risikoklasse, number>> = {
  ADDITIV: 0,
  TRANSFORMIEREND: 1,
  IRREVERSIBEL: 2,
};

/**
 * Die Marker, an denen eine Stufe ihr Risiko verrät.
 *
 * JEDER EINZELNE IST AM BESTAND GEPRÜFT, und zwei Kandidaten sind bewusst NICHT dabei:
 *
 *   · `ALTER COLUMN` — steht heute in drei rein additiven Stufen (`ANSWER_SNAPSHOT_SCHEMA`,
 *     `EXTERNAL_SOURCE_SCHEMA`, `IMPORT_RUN_SCHEMA`) und würde sie falsch anklagen.
 *   · `DO UPDATE` — der Rumpf eines `ON CONFLICT`-Upserts ist keine Umschreibung des Bestands.
 *     Das Muster für `UPDATE` verlangt deshalb eine Zielangabe zwischen `UPDATE` und `SET`; in
 *     `DO UPDATE SET` steht dort nichts, und es trifft nicht.
 *
 * Ein Marker, der im Bestand schon vorkäme, würde eine additive Stufe als transformierend melden —
 * und ein Wächter, der bei jedem zweiten Lauf grundlos rot ist, wird abgeschaltet statt gelesen.
 */
export const RISIKOMARKER: ReadonlyArray<{
  readonly name: string;
  readonly muster: RegExp;
  readonly klasse: Risikoklasse;
}> = [
  { name: "DROP TABLE", muster: /\bDROP\s+TABLE\b/i, klasse: "IRREVERSIBEL" },
  { name: "TRUNCATE", muster: /\bTRUNCATE\b/i, klasse: "IRREVERSIBEL" },
  { name: "DROP COLUMN", muster: /\bDROP\s+COLUMN\b/i, klasse: "IRREVERSIBEL" },
  { name: "DELETE FROM", muster: /\bDELETE\s+FROM\b/i, klasse: "IRREVERSIBEL" },
  { name: "DROP INDEX", muster: /\bDROP\s+INDEX\b/i, klasse: "TRANSFORMIEREND" },
  { name: "UPDATE", muster: /\bUPDATE\s+[A-Za-z_"][\w".]*\s+SET\b/i, klasse: "TRANSFORMIEREND" },
];

/** Die Marker, die in diesem Quelltext wirklich vorkommen — in der Reihenfolge oben, stabil. */
export function markerVon(ddl: string): readonly string[] {
  return RISIKOMARKER.filter((m) => m.muster.test(ddl)).map((m) => m.name);
}

/** Die höchste Klasse, die ein vorkommender Marker verlangt. Ohne Marker: `ADDITIV`. */
export function klassifiziereStufe(ddl: string): Risikoklasse {
  let klasse: Risikoklasse = "ADDITIV";
  for (const marker of RISIKOMARKER) {
    if (marker.muster.test(ddl) && RANG[marker.klasse] > RANG[klasse]) {
      klasse = marker.klasse;
    }
  }
  return klasse;
}

/**
 * Trägt dieser Quelltext überhaupt eine Strukturstufe?
 *
 * HIER SASS DIE LÜCKE. Der Wächter fragte bis JOB 727 nur nach `CREATE TABLE` — eine reine
 * ALTER-Stufe fiel schweigend durch, und es gibt vier davon. Die Frage lautet deshalb: legt sie an
 * ODER ändert sie eine bestehende Tabelle.
 */
export function istStrukturstufe(ddl: string): boolean {
  return /\bCREATE\s+TABLE\b/i.test(ddl) || /\bALTER\s+TABLE\b/i.test(ddl);
}

/** Eine Stufe, wie der Aufrufer sie vorlegt: Kennung plus der Quelltext, der wirklich läuft. */
export interface Stufeneingabe {
  readonly stufe: string;
  readonly ddl: string;
}

/** Eine Stufe im Beleg. `ordinal` ist ihre Stellung in der ausgeführten Reihenfolge, ab 0. */
export interface Belegstufe {
  readonly stufe: string;
  readonly ordinal: number;
  readonly risiko: Risikoklasse;
  readonly marker: readonly string[];
  /** SHA-256 des Quelltextes dieser Stufe. Ändert sich der Text, ändert sich der Hash. */
  readonly quellhash: string;
}

/**
 * Der Strukturbeleg. Kein Zustand, kein Zeitpunkt, keine Aussage über Ausführung — siehe Kopf.
 */
export interface Strukturbeleg {
  readonly stufen: readonly Belegstufe[];
  /** SHA-256 über die kanonische Zeile jeder Stufe. Gleiche Eingabe, gleicher Hash. */
  readonly beleghash: string;
  /** Die höchste Risikoklasse über alle Stufen — die Klasse des Gesamtlaufs. */
  readonly hoechstesRisiko: Risikoklasse;
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Erzeugt den Beleg. Rein: keine Uhr, kein Zufall, keine Ablage, kein Netz.
 *
 * Die kanonische Zeile je Stufe ist `ordinal|stufe|risiko|quellhash`. Sie ist bewusst mager: der
 * Quelltext selbst geht NICHT in den Belegtext ein, nur sein Hash — ein Beleg soll keine DDL
 * transportieren.
 */
export function erzeugeStrukturbeleg(eingaben: readonly Stufeneingabe[]): Strukturbeleg {
  const stufen: Belegstufe[] = eingaben.map((eingabe, ordinal) => ({
    stufe: eingabe.stufe,
    ordinal,
    risiko: klassifiziereStufe(eingabe.ddl),
    marker: markerVon(eingabe.ddl),
    quellhash: sha256(eingabe.ddl),
  }));
  const kanonisch = stufen
    .map((s) => `${s.ordinal}|${s.stufe}|${s.risiko}|${s.quellhash}`)
    .join("\n");
  let hoechstesRisiko: Risikoklasse = "ADDITIV";
  for (const s of stufen) {
    if (RANG[s.risiko] > RANG[hoechstesRisiko]) {
      hoechstesRisiko = s.risiko;
    }
  }
  return { stufen, beleghash: sha256(kanonisch), hoechstesRisiko };
}
