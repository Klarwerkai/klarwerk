import { createHash } from "node:crypto";

// ==================================================================================================
// JOB 727 · D2 — DIE INVENTUR DER MIGRATIONSSTUFEN. NICHT MEHR, UND DAS AUSDRÜCKLICH.
// ==================================================================================================
//
// WAS DIESES MODUL IST: ein reines Modell. Es nimmt die Stufen, wie sie im Quelltext stehen, und
// sagt für jede: ihre stabile Kennung, ihre Stellung in der Reihenfolge, den Hash ihres Quelltextes
// und ihre Risikoklasse. Aus denselben Eingaben entsteht immer derselbe Beleg.
//
// WAS ES AUSDRÜCKLICH NICHT IST — und dieser Absatz ist die wichtigste Zeile der Datei:
//
//   ES IST KEIN MIGRATIONSJOURNAL. Es weiß nicht, ob eine Stufe gelaufen ist, wann sie lief, ob sie
//   abbrach oder ob gerade eine läuft. Es kennt keinen Zeitpunkt, keinen Zustand und keine
//   Persistenz. Wer aus diesem Beleg liest, welche Stufen auf einer Instanz WIRKLICH angewandt
//   wurden, liest etwas hinein, das nicht darin steht.
//
// BEN hat genau diese Verwechslung an BASIC4 727/D1 gerügt: „Ein Hash über einen solchen
// Eingabedatensatz macht ihn deterministisch, aber nicht zu unabhängiger Migrationsevidenz." Das
// stimmt. Deshalb heißt das Ergebnis hier `Strukturbeleg` und nicht `Migrationsbeleg-Journal`, und
// deshalb trägt es kein einziges Zustandsfeld.
//
// WOFÜR ES DANN GUT IST: Es macht die Menge der Stufen und ihr Risiko STATISCH PRÜFBAR. Der
// Wächter in `db.migrate.test.ts` vergleicht die untenstehende ausgeschriebene Sollliste gegen die
// tatsächlich ausgeführte Liste in `db.ts` — in beide Richtungen. Eine vergessene Stufe fällt auf,
// eine überzählige auch, und eine Stufe, die still destruktiv wird, ebenfalls.

/**
 * Wie weit eine Stufe zurückgenommen werden kann.
 *
 * `ADDITIV` — sie legt an. Ein zweiter Lauf ist folgenlos, ein Rückbau wäre möglich.
 * `TRANSFORMIEREND` — sie ersetzt etwas, das wieder aufgebaut werden kann (typisch: ein Index
 *   wird durch einen umfassenderen abgelöst). Zwischen Abbau und Aufbau liegt ein Fenster ohne
 *   die Zusage, die der alte Zustand trug.
 * `IRREVERSIBEL` — sie nimmt etwas weg, das der Code nicht zurückholen kann: eine Spalte, Zeilen,
 *   eine Tabelle. Ein Rückweg führt hier über ein Backup oder gar nicht.
 */
export type Risikoklasse = "ADDITIV" | "TRANSFORMIEREND" | "IRREVERSIBEL";

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

/**
 * DIE AUSGESCHRIEBENE SOLLLISTE — Kennung und erwartete Risikoklasse, in der Reihenfolge von
 * `db.ts`.
 *
 * WARUM AUSGESCHRIEBEN UND NICHT ABGELEITET: Eine Liste, die sich selbst aus dem Code erzeugt,
 * bestätigt jede Änderung, auch die unbeabsichtigte. Diese hier muss von Hand mitgeführt werden —
 * genau deshalb fällt auf, wenn eine Stufe verschwindet, hinzukommt oder still ihr Risiko ändert.
 *
 * DIE ZWEI NICHT-ADDITIVEN STUFEN sind kein Versehen im Bestand, sondern gewollte Migrationen; sie
 * stehen hier, damit ihre Wirkung benannt ist und nicht erst im Betrieb auffällt.
 */
export const MIGRATIONS_SOLLLISTE: ReadonlyArray<{
  readonly stufe: string;
  readonly risiko: Risikoklasse;
}> = [
  { stufe: "AUTH_SCHEMA", risiko: "ADDITIV" },
  { stufe: "KO_SCHEMA", risiko: "ADDITIV" },
  { stufe: "KO_IMPORT_ANCHOR_SCHEMA", risiko: "ADDITIV" },
  // Löst den blinden Unique-Index durch einen umfassenderen ab (`DROP INDEX` + `CREATE`).
  { stufe: "KO_CREATE_OPERATION_SCHEMA", risiko: "TRANSFORMIEREND" },
  { stufe: "KO_SICHTBARKEIT_SCHEMA", risiko: "ADDITIV" },
  { stufe: "KO_VERSIONS_SCHEMA", risiko: "ADDITIV" },
  { stufe: "KO_SEARCH_PROJECTION_SCHEMA", risiko: "ADDITIV" },
  { stufe: "KO_METADATA_PROJECTION_SCHEMA", risiko: "ADDITIV" },
  { stufe: "KO_PROJECTION_CONTROL_SCHEMA", risiko: "ADDITIV" },
  { stufe: "KO_EVIDENCE_SCHEMA", risiko: "ADDITIV" },
  { stufe: "AUDIT_SCHEMA", risiko: "ADDITIV" },
  { stufe: "AUDIT_EVENT_ID_SCHEMA", risiko: "ADDITIV" },
  // JOB 498 D8: die fünfte ALTER-only-Stufe. `ADD COLUMN IF NOT EXISTS ... NOT NULL DEFAULT 1`
  // legt an und schreibt nichts um — kein Marker aus RISIKOMARKER trifft.
  { stufe: "AUDIT_HASH_VERSION_SCHEMA", risiko: "ADDITIV" },
  { stufe: "CAPTURE_SCHEMA", risiko: "ADDITIV" },
  { stufe: "ASK_SCHEMA", risiko: "ADDITIV" },
  { stufe: "ANSWER_SNAPSHOT_SCHEMA", risiko: "ADDITIV" },
  { stufe: "VALIDATION_SCHEMA", risiko: "ADDITIV" },
  { stufe: "CONFLICTS_SCHEMA", risiko: "ADDITIV" },
  { stufe: "OVERLAP_SCHEMA", risiko: "ADDITIV" },
  { stufe: "OVERLAP_SETTINGS_SCHEMA", risiko: "ADDITIV" },
  { stufe: "LIFECYCLE_SCHEMA", risiko: "ADDITIV" },
  { stufe: "OBJECTSTORE_SCHEMA", risiko: "ADDITIV" },
  // Baut `source_version` bei cast-unsicherer Alt-Expression NEU auf (`DROP COLUMN ... CASCADE`),
  // entfernt Alt-Dubletten vor dem Unique-Index (`DELETE FROM`) und ersetzt zwei Indizes.
  { stufe: "IMPORT_CANDIDATES_SCHEMA", risiko: "IRREVERSIBEL" },
  { stufe: "EXTERNAL_SOURCE_SCHEMA", risiko: "ADDITIV" },
  { stufe: "IMPORT_RUN_SCHEMA", risiko: "ADDITIV" },
  { stufe: "MODEL_RUNS_SCHEMA", risiko: "ADDITIV" },
  { stufe: "NOTIFICATION_SEEN_SCHEMA", risiko: "ADDITIV" },
  { stufe: "ASSIST_PRESETS_SCHEMA", risiko: "ADDITIV" },
  { stufe: "REASONER_POLICY_SCHEMA", risiko: "ADDITIV" },
  { stufe: "KLARA_SESSION_SCHEMA", risiko: "ADDITIV" },
  { stufe: "KLARA_CONSENT_SCHEMA", risiko: "ADDITIV" },
  { stufe: "VALIDATION_SETTINGS_SCHEMA", risiko: "ADDITIV" },
  { stufe: "EXTERNAL_KNOWLEDGE_SCHEMA", risiko: "ADDITIV" },
  { stufe: "UPLOAD_LIMITS_SCHEMA", risiko: "ADDITIV" },
];

/**
 * Migrationen, die KEINE DDL-Konstante sind und deshalb in keiner `schemas`-Liste stehen.
 *
 * `migrateAuthTokensAtRest` läuft in `server.ts` unmittelbar NACH `migrate()`. Sie löscht
 * abgelaufene Sitzungen und Reset-Marken (`DELETE FROM`) und schreibt Klartext-Tokens in-place zu
 * Hashes um (`UPDATE ... SET`). Ein Hash ist nicht umkehrbar — diese Stufe ist der eine Fall im
 * Bestand, für den es keinen Rückweg gibt, auch nicht theoretisch.
 *
 * SIE STEHT HIER, WEIL BEN IHR AUSKLAMMERN GERÜGT HAT: „Ausklammern beseitigt das Risiko nicht."
 */
export const IRREVERSIBLE_DATENMIGRATIONEN: ReadonlyArray<{
  readonly stufe: string;
  readonly ort: string;
  readonly risiko: Risikoklasse;
  readonly grund: string;
}> = [
  {
    stufe: "migrateAuthTokensAtRest",
    ort: "services/auth/src/repo-pg.ts",
    risiko: "IRREVERSIBEL",
    grund: "hasht Tokens in-place und loescht abgelaufene Zeilen; ein Hash ist nicht umkehrbar",
  },
];
