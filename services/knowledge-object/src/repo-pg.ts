import type { Pool } from "pg";
import { type Queryable, type TxContext, pgQueryable, poolQueryable, withPgTx } from "../../db-tx";
import type {
  EvidenceRepo,
  KoCandidateQuery,
  KoFilter,
  KoRepo,
  KoSichtbarkeitstrim,
  KoVersionRepo,
} from "./repo";
import {
  type AiCheck,
  type EvidenceRecord,
  type KnowledgeObject,
  KoError,
  type KoVersionSnapshot,
} from "./types";

// SCRUM-362 / AG-03-DBINDEX: die Such-Ausdrücke des Ask-Prefilters (PgKoRepo.findCandidates) als EINE
// Quelle der Wahrheit. Query-Builder UND Indexdefinition leiten beide hieraus ab → Query-Shape und
// Index-Pfad bleiben garantiert deckungsgleich (kein Drift). Jeweils ein GIN-Trigramm-Index (pg_trgm)
// macht das `ILIKE '%term%'` (auch mit führendem Wildcard) indexierbar.
const KO_CANDIDATE_SEARCH: ReadonlyArray<{ index: string; expr: string }> = [
  { index: "idx_kos_title_trgm", expr: "data->>'title'" },
  { index: "idx_kos_statement_trgm", expr: "data->>'statement'" },
  { index: "idx_kos_category_trgm", expr: "data->>'category'" },
  { index: "idx_kos_tags_trgm", expr: "(data->'tags')::text" },
  // WP-RETEST7 R5: der Fragen-Prefilter matcht auch die persistierten Bild-Fußnoten
  // (captionTexts-Suchfeld, WP-BILD-1g) — gleicher ILIKE-/GIN-Trigramm-Weg, kein bodyHtml.
  { index: "idx_kos_captions_trgm", expr: "(data->'captionTexts')::text" },
];

// Die reinen Such-Ausdrücke (für den Query-Builder + Tests, die Query↔Index-Deckung prüfen).
export const KO_CANDIDATE_SEARCH_EXPRESSIONS: readonly string[] = KO_CANDIDATE_SEARCH.map(
  (s) => s.expr,
);

// GIN-Trigramm-Index-DDL je Such-Ausdruck (idempotent, nicht destruktiv).
const KO_CANDIDATE_SEARCH_INDEX_DDL = KO_CANDIDATE_SEARCH.map(
  ({ index, expr }) =>
    `CREATE INDEX IF NOT EXISTS ${index} ON kos USING gin ((${expr}) gin_trgm_ops);`,
).join("\n");

// ================================================================================================
// JOB 2706 D1 (Review R2-30) — DER SCHNELLE BILDABRUF, NEU GEBAUT AUF DEM HEUTIGEN STAND.
// Vorlage: 2685 D5 (GRUEN, EXT1) — die Loesung, nicht die Zeilen.
// ================================================================================================
//
// DER INDEX DER TRAEGERSUCHE: ein GIN auf dem `attachments`-Feld (jsonb_path_ops: klein, und genau
// fuer `@>` gebaut). Er traegt die Arme 1 und 4 von KO_ANHANG_TRAEGER_SQL (aktueller Stand und
// Versions-Schnappschuesse), weil die Abfrage die Arme als UNION stellt statt als ODER — ein ODER mit
// einem nicht indexierbaren Arm (LIKE ueber bodyHtml) liest Postgres als Ganzes sequenziell.
// Additiv, idempotent, kein DROP, kein ALTER: derselbe Bauplatz wie die Trigramm-Indizes darueber.
const KO_ANHANG_TRAEGER_INDEX_DDL = `CREATE INDEX IF NOT EXISTS idx_kos_anhang_traeger ON kos USING gin ((data->'attachments') jsonb_path_ops);`;

// DER SCHREIBSTAND IN DERSELBEN TRANSAKTION WIE DAS FACHLICHE SCHREIBEN.
//
// Eine SEQUENZ taugt dafuer nicht (BEN an 2685 D4): Sequenzen sind nicht transaktional — ein
// `nextval` nach dem Schreiben laesst ein Fenster „Daten sichtbar, alter Stand", eines VOR dem
// Commit dreht es nur um („neuer Stand, Daten noch unsichtbar", sogar stabil cachebar); und
// `last_value` ist vor dem ersten `nextval` schon 1. Deshalb eine EIN-ZEILEN-TABELLE, deren Zaehler
// in DERSELBEN Transaktion erhoeht wird wie das fachliche Schreiben (`withPgTx`; bei uebergebener
// `tx` auf dem Client des Aufrufers). Datenaenderung und Standaenderung werden mit EINEM Commit
// gemeinsam sichtbar; vorher sieht jede andere Verbindung beides alt, danach beides neu — einen
// Zwischenpunkt gibt es nicht. Startwert 0, erste Mutation → 1. Die Zeile ist eine
// Serialisierungsstelle fuer Schreiber (Zeilensperre bis Commit) — Schreiben ist selten, Lesen ist
// sperrfrei (READ COMMITTED). Additiv (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`), keine neue
// Stufe: `klassifiziereStufe(KO_SCHEMA)` bleibt ADDITIV (der `UPDATE` steht NICHT im Schema,
// sondern als Laufzeitanweisung hier).
export const KO_SCHREIBSTAND_TABELLE_DDL = `CREATE TABLE IF NOT EXISTS ko_schreibstand (
  id smallint PRIMARY KEY CHECK (id = 1),
  stand bigint NOT NULL
);
INSERT INTO ko_schreibstand(id, stand) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;`;
export const KO_SCHREIBSTAND_ERHOEHEN_SQL =
  "UPDATE ko_schreibstand SET stand = stand + 1 WHERE id = 1";
export const KO_SCHREIBSTAND_LESEN_SQL =
  "SELECT stand::text AS stand FROM ko_schreibstand WHERE id = 1";

// Postgres-Adapter für knowledge-object. Vollobjekt als JSONB; Filterspalten indiziert.
// SCRUM-362: pg_trgm + GIN-Trigramm-Indizes machen den Ask-Prefilter (ILIKE auf title/statement/
// category/tags) indexierbar. Alle Statements sind idempotent (IF NOT EXISTS) und nicht destruktiv;
// die bestehenden idx_kos_type/idx_kos_status bleiben unverändert.
export const KO_SCHEMA = `
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE TABLE IF NOT EXISTS kos (
  id text PRIMARY KEY,
  type text NOT NULL,
  status text NOT NULL,
  category text NOT NULL,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_kos_type ON kos(type);
CREATE INDEX IF NOT EXISTS idx_kos_status ON kos(status);
${KO_CANDIDATE_SEARCH_INDEX_DDL}
${KO_ANHANG_TRAEGER_INDEX_DDL}
${KO_SCHREIBSTAND_TABELLE_DDL}
`;

// WP-SHIP8-CLOSE-4 (bens ROT-1B): DB-erzwungener Idempotenzanker des Import-Accepts — als EIGENE,
// ADDITIVE Migrationsstufe NACH KO_SCHEMA (KO_SCHEMA selbst bleibt per Test gepinnt frei von
// ALTER-Statements; ADD COLUMN IF NOT EXISTS ist additiv und idempotent, nichts wird entfernt).
// Generated-Spalte + partieller UNIQUE-Index: höchstens EIN KO je Import-Kandidat — BEWUSST OHNE
// deletedAt-Ausschluss (auch ein getrashtes KO hält seinen Anker; der Recovery-Vertrag adoptiert
// es statt ein zweites anzulegen). Ein später Insert eines abgelösten Laufs kollidiert hier hart
// und wird vom Accept-Pfad zur idempotenten Adoption statt zum Doppel-KO.
export const KO_IMPORT_ANCHOR_SCHEMA = `
ALTER TABLE kos
  ADD COLUMN IF NOT EXISTS import_candidate_id text
  GENERATED ALWAYS AS (data->>'importCandidateId') STORED;
CREATE UNIQUE INDEX IF NOT EXISTS kos_import_candidate_uq
  ON kos (import_candidate_id)
  WHERE import_candidate_id IS NOT NULL;
`;

// AUFTRAG-mega20 Block A: DB-erzwungener Idempotenzanker der ERSTANLAGE aus Dokumenten — dieselbe
// Form wie KO_IMPORT_ANCHOR_SCHEMA und aus demselben Grund: eine eigene, ADDITIVE Migrationsstufe
// nach KO_SCHEMA (das selbst per Test gepinnt frei von ALTER-Statements bleibt), Generated-Spalte +
// partieller UNIQUE-Index. BEWUSST OHNE deletedAt-Ausschluss: auch ein getrashtes Objekt hält
// seinen Vorgang, sonst erzeugte eine Wiederholung nach dem Löschen ein zweites.
// ============================================================================================
// AUFTRAG-mega22 Block G — DIE EINDEUTIGKEIT WIRD ACTOR-GEBUNDEN.
// ============================================================================================
//
// DER BEFUND (ben, gegen meine Einschätzung aus mega21, und er trägt): die DB-WEITE Eindeutigkeit
// der Vorgangskennung ist keine Unbequemlichkeit, sondern eine gezielte DENIAL-KANTE. Ein Nutzer
// mit `ko.create` und einem gültigen Dokument kann vorhersehbare Kennungen reservieren und einen
// anderen Client dauerhaft aus seinem Vorgang drängen. Ein flächiges Ausschöpfen des Kennungsraums
// ist unrealistisch — gezieltes Belegen VORHERSEHBARER Kennungen ist es nicht.
//
// DIE ÄNDERUNG: die Eindeutigkeit gilt je (VORGANGSKENNUNG, EIGENTÜMER) statt DB-weit. Damit ist
// der Kennungsraum PRO ANFRAGENDEM privat, und die Belegung verliert ihre Grundlage, statt nur
// erschwert zu werden. Die Zusage „höchstens EIN Objekt je Vorgang" bleibt DB-erzwungen — sie
// lautet jetzt nur genauer: höchstens eines je Vorgang DIESES Anfragenden, und das ist die Zusage,
// die überhaupt gemeint war.
//
// DIE MIGRATION IST ADDITIV, mit EINER Ausnahme, die benannt gehört: der alte Index
// `kos_create_operation_uq` wird GELÖSCHT. Ihn stehen zu lassen hiesse, die Denial-Kante zu
// behalten — er würde weiterhin DB-weit abweisen und die neue Regel wäre wirkungslos. `DROP INDEX
// IF EXISTS` ist idempotent; es entfernt eine Einschränkung und keine Daten.
//
// ALTZEILEN (Vorgangskennung ohne Vorgangs-Datensatz, also ohne `actor`) bekommen im Index den
// leeren String als Eigentümer (COALESCE). Zwei Wirkungen, beide gewollt:
//   · Zwei Altzeilen derselben Kennung kollidieren weiterhin — die alte Zusage bleibt für sie.
//   · Eine Altzeile blockiert einen NEUEN, actor-gebundenen Vorgang derselben Kennung nicht am
//     Index. Sie wird aber vom Nachschlag GEFUNDEN (findByCreateOperation), und der Adoptionspfad
//     entscheidet über den alten `author`-Vergleich — es kann also trotzdem kein zweites Objekt zu
//     einem Altvorgang entstehen. Der Index ist hier nicht die einzige Verteidigungslinie.
//
// BEWUSST WEITERHIN OHNE deletedAt-Ausschluss, aus demselben Grund wie zuvor: gäbe Soft Delete die
// Kennung frei, könnte ein Wiederholversuch ein zweites Objekt erzeugen.
export const KO_CREATE_OPERATION_SCHEMA = `
ALTER TABLE kos
  ADD COLUMN IF NOT EXISTS create_operation_id text
  GENERATED ALWAYS AS (data->>'createOperationId') STORED;
ALTER TABLE kos
  ADD COLUMN IF NOT EXISTS create_operation_actor text
  GENERATED ALWAYS AS (data->'createOperation'->>'actor') STORED;
DROP INDEX IF EXISTS kos_create_operation_uq;
CREATE UNIQUE INDEX IF NOT EXISTS kos_create_operation_owner_uq
  ON kos (create_operation_id, COALESCE(create_operation_actor, ''))
  WHERE create_operation_id IS NOT NULL;
`;

// Der Constraint-Name, den Postgres bei der Kollision meldet — als EINE Quelle der Wahrheit für DDL
// und Fehlerübersetzung (insert unten). Zwei Kopien wären zwei Gelegenheiten, sie auseinanderlaufen
// zu lassen, und die Übersetzung fiele dann still auf „unerwarteter Fehler" zurück.
const KO_CREATE_OPERATION_CONSTRAINT = "kos_create_operation_owner_uq";

// ================================================================================================
// AUFTRAG-BASIC-380 — DIE DREI SCHLÜSSELSPALTEN, OHNE DIE DER TRIM NICHT IN DAS SQL PASST.
// ================================================================================================
//
// WOFÜR SIE DA SIND. Papierkorb- und Sichtbarkeitsprädikat müssen VOR dem `LIMIT` wirken, also in
// der Datenquelle (BASIC 379 §1.2/§2.5). Das Prädikat entsteht in `services/app/src/sichtbarkeit.ts`
// (`sqlSichtbarkeitFuer`) und fragt genau drei Dinge: die Vertraulichkeitsstufe, den Autor und ob
// das Objekt im Papierkorb liegt. Alle drei liegen heute nur im JSONB-Dokument.
//
// WARUM ECHTE SPALTEN UND KEIN AUSDRUCK IM PRÄDIKAT. Zwei Gründe, und der erste ist der wichtigere:
//
//   1. DIE STUFENGRENZE DARF NICHT ZWEIMAL AUSGELEGT WERDEN. `normalizeConfidentiality`
//      (confidentiality.ts:15-17) sagt: alles außer 'vertraulich'/'streng_vertraulich' ist
//      'intern'. Stünde derselbe CASE als Ausdruck in jeder Abfrage, wäre er an jeder Fundstelle
//      neu abschreibbar — genau die zweite Wahrheit, gegen die `sichtbarkeit.ts:39-41` gebaut ist.
//      Als GENERIERTE Spalte gibt es ihn genau einmal, und die Datenbank hält ihn.
//   2. Ein Ausdruck über `data->>` ist nicht index-gedeckt. `idx_kos_sichtbarkeit` deckt den Trim.
//
// DAS HAUSMUSTER, WÖRTLICH ÜBERNOMMEN: dieselbe Form wie KO_IMPORT_ANCHOR_SCHEMA (:62-69) und
// KO_CREATE_OPERATION_SCHEMA (:107-118) — eine EIGENE, additive Migrationsstufe nach KO_SCHEMA
// (das per Test gepinnt frei von ALTER-Statements bleibt), `ADD COLUMN IF NOT EXISTS`, generiert
// und damit ohne jeden Schreibweg, der sie auseinanderlaufen lassen könnte.
//
// WAS SIE NICHT TUT: sie ändert KEINE Zeile in `kos.data`, sie löscht nichts, sie leitet nichts ab,
// was nicht schon dasteht. Rückrollen heißt „Feature aus" — die Spalten dürfen stehen bleiben, weil
// sie nur ableiten (BASIC 379 §5.5).
//
// UND DIE BENANNTE LÜCKE IM MIGRATIONSWÄCHTER: `db.migrate.test.ts` sammelt nur *_SCHEMA-Konstanten,
// deren Template ein `CREATE TABLE` trägt. Diese hier trägt keines und wird vom generischen Wächter
// NICHT erfasst — sie hängt deshalb an einem eigens benannten Pin (T-M-3, db.migrate.test.ts).
export const KO_SICHTBARKEIT_SCHEMA = `
ALTER TABLE kos
  ADD COLUMN IF NOT EXISTS confidentiality_key text
  GENERATED ALWAYS AS (
    CASE WHEN data->>'confidentiality' IN ('vertraulich','streng_vertraulich')
         THEN data->>'confidentiality' ELSE 'intern' END
  ) STORED;
ALTER TABLE kos
  ADD COLUMN IF NOT EXISTS author_key text
  GENERATED ALWAYS AS (data->>'author') STORED;
ALTER TABLE kos
  ADD COLUMN IF NOT EXISTS deleted_at_key text
  GENERATED ALWAYS AS (data->>'deletedAt') STORED;
CREATE INDEX IF NOT EXISTS idx_kos_sichtbarkeit
  ON kos (confidentiality_key, author_key)
  WHERE deleted_at_key IS NULL;
`;

// SCRUM-159: unveränderliche KO-Version-Snapshots. PK (ko_id, version) + ON CONFLICT DO NOTHING
// garantieren, dass eine einmal geschriebene Version nie überschrieben wird.
export const KO_VERSIONS_SCHEMA = `
CREATE TABLE IF NOT EXISTS ko_versions (
  ko_id text NOT NULL,
  version int NOT NULL,
  snapshot jsonb NOT NULL,
  at text NOT NULL,
  author text NOT NULL,
  note text NOT NULL,
  PRIMARY KEY (ko_id, version)
);
CREATE INDEX IF NOT EXISTS idx_ko_versions_anhang_traeger ON ko_versions USING gin ((snapshot->'attachments') jsonb_path_ops);
`;

// SCRUM-160: Evidence-Records für Quellen/Anhänge, separat vom KO-JSON.
export const KO_EVIDENCE_SCHEMA = `
CREATE TABLE IF NOT EXISTS ko_evidence (
  id text PRIMARY KEY,
  ko_id text NOT NULL,
  ko_version int NOT NULL,
  kind text NOT NULL,
  data jsonb NOT NULL,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ko_evidence_ko_id ON ko_evidence(ko_id);
CREATE INDEX IF NOT EXISTS idx_ko_evidence_kind ON ko_evidence(kind);
CREATE INDEX IF NOT EXISTS idx_ko_evidence_object_id ON ko_evidence ((data->>'objectId'));
`;

interface DataRow {
  data: KnowledgeObject;
}

// ================================================================================================
// JOB 2706 D1 (Review R2-30) — DIE TRAEGERSUCHE EINES ANHANGS, IN SQL.
// ================================================================================================
//
// WAS `beurteileAnhang` (services/app/src/sichtbarkeit.ts) an JEDEM Wissensobjekt prueft — und was
// deshalb hier, Arm fuer Arm, dieselbe Frage an die Datenbank ist:
//
//   1. `zuordnungAmObjekt`:  `attachments.some(a => a.objectId === objectId)`
//                              → `data->'attachments' @> '[{"objectId": …}]'`
//   2. `zuordnungAmObjekt`:  `bodyHtml.includes(objectId)`
//                              → `data->>'bodyHtml' LIKE '%…%'` (Teilzeichenfolge, Gross/Klein exakt;
//                              `%`, `_` und `\` in der Kennung sind entwertet, s. anhangTraegerParameter)
//   3. Belegkette:            `beleg.objectId === objectId`   → `ko_evidence.data->>'objectId' = …`
//   4. Fassungen:             `zuordnungInFassung` ist „keine", sobald `zuordnungAmObjekt` am
//                              Schnappschuss „keine" ist — also dieselben Arme 1 und 2 auf
//                              `ko_versions.snapshot`.
//
// OBERMENGE, NIE TEILMENGE. Jeder Arm ist mindestens so weit wie sein Praedikat in Node (Arm 2 ist
// an einer Stelle weiter: ein `bodyHtml`, das kein String ist, faellt in Node durch und kann per
// `->>` hier treffen — ein Objekt zu viel, das der Aufrufer sofort wieder aussortiert). In die
// andere Richtung gibt es keinen Fall: was Node findet, findet auch dieser Ausdruck.
//
// DIE VIER ARME ALS UNION, FUER MEHRERE KENNUNGEN AUF EINMAL, MIT INDEX. Als UNION von
// Kennungsmengen darf der Planer jeden Arm fuer sich loesen: Arm 1 und Arm 4a ueber die GIN-Indizes
// `idx_kos_anhang_traeger` / `idx_ko_versions_anhang_traeger` (jsonb_path_ops, `@>`), Arm 3 ueber
// `idx_ko_evidence_object_id`. Arm 2 und Arm 4b (`LIKE`) bleiben Scans — ein Trigramm-Index ueber
// `bodyHtml` wuerde die Base64-Bilder trigrammieren und waere so gross wie der Bestand. Das ist die
// ehrliche Restgroesse: die Fliesstext-Arme lesen weiterhin O(Bestand) je Abfrage, aber nur die
// TREFFER verlassen die Datenbank — nicht mehr der ganze Bestand samt Bildern je Bild.
//
// MEHRERE KENNUNGEN: eine Wissensobjekt-Seite mit zehn Bildern fragt zehnmal an. Der
// Kandidaten-Speicher (services/app/src/sichtbarkeit.ts) fragt deshalb fuer die Geschwister eines
// Traegers in EINER Abfrage — `= ANY`, `LIKE ANY`, `@> ANY`. Die Antwort ist eine Obermenge fuer
// JEDE der Kennungen; der Aufrufer legt je Kennung dieselben Praedikate an wie bisher.
//
// Der Beleg der Gleichheit des URTEILS an allen Faellen, die sichtbarkeit.ts unterscheidet, liegt in
// tests/app/job2685-traegersuche-gleichheit.test.ts; der Beleg mit Mengengleichheit gegen ein
// echtes Postgres in tests/ko/job2685-anhang-traeger.integration.test.ts (Docker).
export const KO_ANHANG_TRAEGER_SQL = `SELECT data FROM kos WHERE id IN (
  SELECT id FROM kos WHERE data->'attachments' @> ANY($1::jsonb[])
  UNION SELECT id FROM kos WHERE data->>'bodyHtml' LIKE ANY($2::text[])
  UNION SELECT ko_id FROM ko_evidence WHERE data->>'objectId' = ANY($3::text[])
  UNION SELECT ko_id FROM ko_versions
         WHERE snapshot->'attachments' @> ANY($1::jsonb[]) OR snapshot->>'bodyHtml' LIKE ANY($2::text[])
)`;

// Die drei Parameter zu KO_ANHANG_TRAEGER_SQL, je Kennung ein Element: das Enthaltenseins-Muster
// fuer `attachments`, das LIKE-Muster (Kennung als Teilzeichenfolge, LIKE-Sonderzeichen mit `\`
// entwertet — das Standard-Entwertungszeichen von Postgres) und die rohe Kennung fuer die Belegkette.
export function anhangTraegerParameter(
  objectIds: readonly string[],
): [string[], string[], string[]] {
  const eindeutig = [...new Set(objectIds)];
  return [
    eindeutig.map((objectId) => JSON.stringify([{ objectId }])),
    eindeutig.map((objectId) => `%${objectId.replace(/[\\%_]/g, (zeichen) => `\\${zeichen}`)}%`),
    eindeutig,
  ];
}

// AUFTRAG-mega20 Block A: erkennt GENAU eine Unique-Verletzung an GENAU einem Constraint.
// SQLSTATE 23505 allein reicht nicht — an derselben Tabelle hängt auch kos_import_candidate_uq,
// und dessen Kollision bedeutet etwas anderes (Import-Adoption, WP-SHIP8-CLOSE-4). Der Constraint-
// Name entscheidet, nicht der Fehlercode.
function isUniqueViolation(err: unknown, constraint: string): boolean {
  if (!err || typeof err !== "object") {
    return false;
  }
  const candidate = err as { code?: unknown; constraint?: unknown };
  return String(candidate.code) === "23505" && String(candidate.constraint) === constraint;
}

export class PgKoRepo implements KoRepo {
  constructor(private readonly pool: Pool) {}

  async insert(ko: KnowledgeObject): Promise<void> {
    try {
      // JOB 2706 D1: Schreiben und Schreibstand in EINER Transaktion — gemeinsam sichtbar mit dem
      // Commit (s. KO_SCHREIBSTAND_TABELLE_DDL).
      await withPgTx(this.pool, async (tx) => {
        const q = pgQueryable(tx);
        await q.query("INSERT INTO kos(id,type,status,category,data) VALUES($1,$2,$3,$4,$5)", [
          ko.id,
          ko.type,
          ko.status,
          ko.category,
          JSON.stringify(ko),
        ]);
        await q.query(KO_SCHREIBSTAND_ERHOEHEN_SQL);
      });
    } catch (err) {
      // AUFTRAG-mega20 Block A: die Unique-Kollision des ERZEUGUNGS-Ankers wird in einen
      // Domänenfehler übersetzt — und NUR sie. Ohne diese Übersetzung käme beim Aufrufer ein roher
      // Postgres-Fehler (SQLSTATE 23505) an, den der Adoptionspfad nicht von einem beliebigen
      // Infrastrukturfehler unterscheiden könnte; er müsste dann entweder blind adoptieren (falsch)
      // oder gar nicht (das Duplikat entstünde wieder). Jeder andere Fehler fliegt unverändert
      // weiter — insbesondere wird hier NICHTS geschluckt und nichts umetikettiert.
      if (isUniqueViolation(err, KO_CREATE_OPERATION_CONSTRAINT)) {
        throw new KoError(
          "CREATE_ANCHOR_TAKEN",
          "Für diesen Erzeugungs-Vorgang existiert bereits ein Wissensobjekt.",
        );
      }
      throw err;
    }
  }

  async findById(id: string): Promise<KnowledgeObject | undefined> {
    const res = await this.pool.query<DataRow>("SELECT data FROM kos WHERE id=$1", [id]);
    return res.rows[0]?.data;
  }

  // AUFTRAG-mega20 Block A: indexgestützter Nachschlag über die Generated-Spalte (kein Full-Scan,
  // kein JSONB-Ausdruck zur Laufzeit). Getrashte Objekte zählen mit — der Index kennt keinen
  // deletedAt-Ausschluss, und diese Abfrage darf keinen erfinden.
  // AUFTRAG-mega22 Block G: actor-gebunden. Gefunden wird der EIGENE Vorgang ODER eine Altzeile
  // ohne Eigentümer (s. KO_CREATE_OPERATION_SCHEMA); die exakte Übereinstimmung gewinnt, damit eine
  // Altzeile den eigenen, neuen Vorgang nicht verdeckt. Beide Zweige laufen über denselben
  // partiellen Unique-Index — der führende Spaltenausdruck ist `create_operation_id`.
  async findByCreateOperation(
    operationId: string,
    actor: string,
  ): Promise<KnowledgeObject | undefined> {
    const res = await this.pool.query<DataRow>(
      `SELECT data FROM kos
        WHERE create_operation_id=$1
          AND (create_operation_actor = $2 OR create_operation_actor IS NULL)
        ORDER BY (create_operation_actor IS NULL)
        LIMIT 1`,
      [operationId, actor],
    );
    return res.rows[0]?.data;
  }

  // JOB 2696 (R2-34): EINE Zeile über den partiellen Unique-Index `kos_import_candidate_uq` statt
  // eines Bestandsdurchlaufs mit `bodyHtml`. Dieselbe Bauform wie `findByCreateOperation` darüber.
  //
  // KEIN `deletedAt`-Ausschluss — bewusst, und aus demselben Grund, aus dem der Index ihn nicht hat:
  // Auch ein getrashtes Objekt hält seinen Import-Anker. Fände die Suche es nicht, legte der
  // Wiederholversuch ein zweites an. `LIMIT 1` ist keine Auswahl unter mehreren, sondern die
  // Aussage des Index: zu einer Kennung gibt es höchstens ein Objekt.
  async findByImportCandidateId(candidateId: string): Promise<KnowledgeObject | undefined> {
    const res = await this.pool.query<DataRow>(
      "SELECT data FROM kos WHERE import_candidate_id=$1 LIMIT 1",
      [candidateId],
    );
    return res.rows[0]?.data;
  }

  // SCRUM-509 R3: optimistische Concurrency auf DB-Ebene (Compare-and-Set auf der gespeicherten
  // rowVersion in `data`). Der Write greift NUR, wenn die gespeicherte rowVersion der vom Aufrufer
  // gelesenen entspricht; sonst rowCount 0 → STALE_WRITE (kein Überschreiben eines fremden Writes).
  // Alt-Zeilen ohne Feld → COALESCE 0. Bei Erfolg wird rowVersion monoton erhöht. Kein Row-Lock nötig:
  // der bedingte UPDATE ist selbst atomar.
  // JOB 2704 D1 (R2-35): MIT tx läuft der bedingte UPDATE auf demselben Client wie Snapshot,
  // Projektion und Audit (mutateKoTx in EINER withPgTx-Klammer) — ohne tx wie bisher über den Pool.
  //
  // JOB 2706 D2 (R2-30, auf 2704 gesetzt): bedingter UPDATE und Schreibstand laufen IMMER in einer
  // Transaktion — mit uebergebener `tx` in der des Aufrufers (mutateKoTx: Commit dort), sonst in
  // einer eigenen. STALE_WRITE rollt beides zurueck; ein Schreiben ohne Treffer erhoeht den Stand
  // nicht. Nie ueber den Pool nebenher — das waere wieder ein Fenster (Muster `delete`).
  async update(ko: KnowledgeObject, tx?: TxContext): Promise<void> {
    const expected = ko.rowVersion ?? 0;
    const next = JSON.stringify({ ...ko, rowVersion: expected + 1 });
    const lauf = async (queryable: Queryable): Promise<void> => {
      const res = await queryable.query(
        "UPDATE kos SET type=$2,status=$3,category=$4,data=$5 WHERE id=$1 AND COALESCE((data->>'rowVersion')::int,0)=$6",
        [ko.id, ko.type, ko.status, ko.category, next, expected],
      );
      if (res.rowCount === 0) {
        throw new KoError(
          "STALE_WRITE",
          "Nebenläufige Änderung — bitte erneut lesen und anwenden.",
        );
      }
      await queryable.query(KO_SCHREIBSTAND_ERHOEHEN_SQL);
    };
    if (tx) {
      await lauf(pgQueryable(tx));
      return;
    }
    await withPgTx(this.pool, (eigene) => lauf(pgQueryable(eigene)));
  }

  // SCRUM-523 P.3 (WP-A2): ohne tx die normale Pool-Query (heutiges Verhalten); MIT tx (vom Aufrufer
  // aus derselben withPgTx-Klammer wie z. B. PgAuditRepo.append) läuft die Query auf demselben Client
  // — damit committen/rollbacken beide Schreiber ATOMAR zusammen (services/db-tx).
  //
  // SCRUM-523 P.3 (WP-A3, externer Review): rowCount MUSS geprüft werden. Ein wiederholter/
  // konkurrierender Purge (KO bereits gelöscht) darf NIE als Erfolg durchgehen — sonst committet
  // purgeKo (service.ts) einen ko.purged-Beleg, obwohl 0 Zeilen gelöscht wurden ("Audit ohne echtes
  // Delete"). Bei 0 gelöschten Zeilen wirft delete() NOT_FOUND; innerhalb der withTx-Klammer von
  // purgeKo führt das zum ROLLBACK, bevor audit.record läuft — kein Geister-Beleg.
  //
  // JOB 2706 D1: der Schreibstand steigt auf DEMSELBEN Client wie das Loeschen — mit uebergebener
  // `tx` in der Transaktion des Aufrufers (Commit dort), sonst in einer eigenen. Nie ueber den Pool
  // nebenher: das waere wieder ein Fenster.
  async delete(id: string, tx?: TxContext): Promise<void> {
    const lauf = async (queryable: Queryable): Promise<void> => {
      const res = await queryable.query("DELETE FROM kos WHERE id=$1", [id]);
      if (res.rowCount === 0) {
        throw new KoError("NOT_FOUND", "Wissensobjekt nicht gefunden.");
      }
      await queryable.query(KO_SCHREIBSTAND_ERHOEHEN_SQL);
    };
    if (tx) {
      await lauf(pgQueryable(tx));
      return;
    }
    await withPgTx(this.pool, (eigene) => lauf(pgQueryable(eigene)));
  }

  // FUNKE-FIX2 P0 (bens ROT-1, Blocker 1): ATOMARER Trust-Inkrement direkt in der DB — LEAST deckelt
  // bei maxTrust, rowVersion klettert mit (schützt vor stillem Clobbern durch einen nebenläufigen
  // Voll-Write). KEIN Read-modify-write → zwei gleichzeitige Danke verschiedener Nutzer zählen BEIDE.
  // MIT tx (vom Aufrufer aus derselben withPgTx-Klammer wie PgAuditRepo.appendOnce) läuft der Inkrement
  // auf demselben Client → Audit-CAS und Trust committen/rollbacken ATOMAR zusammen (services/db-tx).
  // 0 betroffene Zeilen (KO fehlt/getrasht) → undefined; der Aufrufer rollt den gekoppelten Audit zurück.
  async bumpTrust(
    id: string,
    step: number,
    maxTrust: number,
    tx?: TxContext,
  ): Promise<number | undefined> {
    const queryable: Queryable = tx ? pgQueryable(tx) : poolQueryable(this.pool);
    const res = await queryable.query<{ trust: number }>(
      `UPDATE kos
         SET data = jsonb_set(
           jsonb_set(data, '{trust}', to_jsonb(LEAST($3::int, COALESCE((data->>'trust')::int, 0) + $2::int))),
           '{rowVersion}', to_jsonb(COALESCE((data->>'rowVersion')::int, 0) + 1))
       WHERE id = $1 AND NOT (data ? 'deletedAt')
       RETURNING (data->>'trust')::int AS trust`,
      [id, step, maxTrust],
    );
    return res.rows[0]?.trust;
  }

  // Gemeinsamer Filterbau für list()/listForSearch() — identische WHERE-Logik, andere Projektion.
  //
  // AUFTRAG-BASIC-380: der optionale Sicherheitstrim reiht sich HIER ein, in dieselbe WHERE-Klausel
  // wie die Fachfilter — und damit in dieselbe Anweisung, die ein späterer Abfragevertrag mit
  // `LIMIT`, Cursor und Zählern versehen würde. Das ist der ganze Punkt (Gate `G-TRIM-SQL`): ein
  // Nachfiltern in Node über einem bereits gedeckelten Ergebnis liefert kurze Seiten, überspringende
  // Cursor und Zähler, die eine Existenzauskunft sind.
  //
  // Er steht bewusst ZULETZT: die Fachfilter behalten damit ihre Platzhalternummern, und der Trim
  // setzt seine eigenen dahinter fort. Kein Aufrufer muss Nummern raten.
  private buildListFilter(
    filter: KoFilter,
    trim?: KoSichtbarkeitstrim,
  ): { where: string; params: unknown[] } {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter.type) {
      params.push(filter.type);
      clauses.push(`type=$${params.length}`);
    }
    if (filter.status) {
      params.push(filter.status);
      clauses.push(`status=$${params.length}`);
    }
    if (filter.category) {
      params.push(filter.category);
      clauses.push(`category=$${params.length}`);
    }
    if (filter.tag) {
      // Containment auf dem JSONB-Tag-Array (eindeutig, kein Platzhalter-Konflikt mit `?`).
      params.push(JSON.stringify([filter.tag]));
      clauses.push(`data->'tags' @> $${params.length}::jsonb`);
    }
    if (trim) {
      // Der Trim rendert sein Prädikat selbst — dieser Adapter kennt die Regel nicht und soll sie
      // nicht kennen (G-TRIM-EINS: sie entsteht an EINER Stelle, neben `darfSehen`).
      clauses.push(trim.sql("kos", params.length + 1));
      params.push(...trim.params);
    }
    return { where: clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "", params };
  }

  // AUFTRAG-BASIC-391: mit injiziertem Trim stehen Papierkorb- und Sichtbarkeitsprädikat in der
  // WHERE-Klausel DIESER Anweisung — vor jeder Zählung und vor jedem Deckel. Die Projektion bleibt
  // bewusst `SELECT data` (volle Sicht): die body-freie Projektion gilt weiterhin NUR dem Suchpfad,
  // und `bodyHtml` aus `GET /api/kos` zu entfernen ist ein eigener, kompatibilitätsgeprüfter
  // Auftrag (O-379-5). Ohne Trim ist die Abfrage zeichengleich der bisherigen.
  async list(filter: KoFilter, trim?: KoSichtbarkeitstrim): Promise<KnowledgeObject[]> {
    const { where, params } = this.buildListFilter(filter, trim);
    const res = await this.pool.query<DataRow>(`SELECT data FROM kos${where}`, params);
    return res.rows.map((row) => row.data);
  }

  // JOB 2706 D1 (Review R2-30): der Schreibstand der Datenbank — die eine Zeile in
  // `ko_schreibstand`, gelesen unter READ COMMITTED: sie zeigt genau den Stand, der mit den zuletzt
  // committeten Daten zusammengehoert (s. KO_SCHREIBSTAND_TABELLE_DDL). O(1) je Bildabruf, sperrfrei.
  async anhangSchreibstand(): Promise<string> {
    const res = await this.pool.query<{ stand: string }>(KO_SCHREIBSTAND_LESEN_SQL);
    return String(res.rows[0]?.stand ?? "");
  }

  // JOB 2706 D1: die Traegersuche eines Anhangs — EINE Abfrage, vier Fundorte, und nur die Treffer
  // verlassen die Datenbank. Vertrag an `KoRepo.listAnhangTraeger` (repo.ts); die vier Arme in
  // KO_ANHANG_TRAEGER_SQL. Vorher: `SELECT data FROM kos` ohne WHERE — der ganze Bestand samt
  // Base64-Bildern je Bildabruf (`list()` darueber, ueber `KoService.list` aus build-app.ts).
  async listAnhangTraeger(objectId: string): Promise<KnowledgeObject[]> {
    return this.listAnhangTraegerFuer([objectId]);
  }

  // Dieselbe Frage fuer MEHRERE Kennungen in EINER Abfrage (Vertrag an
  // `KoRepo.listAnhangTraegerFuer`). Leere Eingabe → leere Antwort, ohne Datenbankrunde.
  async listAnhangTraegerFuer(objectIds: readonly string[]): Promise<KnowledgeObject[]> {
    if (objectIds.length === 0) {
      return [];
    }
    const res = await this.pool.query<DataRow>(
      KO_ANHANG_TRAEGER_SQL,
      anhangTraegerParameter(objectIds),
    );
    return res.rows.map((row) => row.data);
  }

  // WP-BILD-1g (bens sammel14-ROT): Suchpfad-Projektion AN DER DATENQUELLE — Postgres entfernt
  // bodyHtml (mit potenziell megabyte-großen base64-Bildern) bereits im SELECT; der Riesen-String
  // verlässt die Datenbank für die Suche gar nicht erst. Gleiche Filterlogik wie list().
  // AUFTRAG-BASIC-380: mit injiziertem Trim steht das Papierkorb- und Sichtbarkeitsprädikat in der
  // WHERE-Klausel DIESER Anweisung — vor jedem Deckel, den ein Abfragevertrag später anhängt. Ohne
  // Trim ist die Abfrage zeichengleich die bisherige.
  async listForSearch(filter: KoFilter, trim?: KoSichtbarkeitstrim): Promise<KnowledgeObject[]> {
    const { where, params } = this.buildListFilter(filter, trim);
    const res = await this.pool.query<DataRow>(
      `SELECT data - 'bodyHtml' AS data FROM kos${where}`,
      params,
    );
    return res.rows.map((row) => row.data);
  }

  // G27: gezielter Mehrfach-Nachschlag zu einer bekannten Id-Menge (s. KoRepo.listByIds).
  // EINE Abfrage über den Primärschlüssel (`= ANY`), body-frei projiziert — kein N+1 und kein
  // Voll-Load des Bestands, nachdem die Suchprojektion die Menge bereits eingegrenzt hat.
  async listByIds(ids: readonly string[]): Promise<KnowledgeObject[]> {
    if (ids.length === 0) {
      return [];
    }
    const res = await this.pool.query<DataRow>(
      "SELECT data - 'bodyHtml' AS data FROM kos WHERE id = ANY($1::text[])",
      [[...new Set(ids)]],
    );
    return res.rows.map((row) => row.data);
  }

  // WP-BILD-1g/1h: Backfill des ABGELEITETEN captionTexts-Suchfelds (Legacy-KOs). WP-BILD-1h
  // (bens sammel15-ROT 1): ATOMAR NUR-WENN-FELD-FEHLT — ein einziges bedingtes UPDATE, kein
  // Read-Modify-Write. Damit kann ein spät ankommender Backfill mit ALTEM Scan die frischen
  // captionTexts eines nebenläufigen revise (Voll-Write setzt das Feld immer) NIE clobbern:
  // der Voll-Write gewinnt per Konstruktion. Weiterhin ohne rowVersion-CAS/Version/Audit
  // (reiner Cache-Write eines abgeleiteten Felds).
  // WP-D11b (bens patches53-GELB): rowCount sagt ehrlich, ob DIESER Aufruf geschrieben hat —
  // 0 heißt: das Feld war schon da (nebenläufiger Voll-Write) und der Aufrufer lädt nach.
  async setAiCheck(id: string, aiCheck: AiCheck): Promise<boolean> {
    // WP-SUBMIT-ASYNC: schmaler Feld-Patch (nur aiCheck) auf einem existierenden, nicht
    // getrashten KO — kein Voll-Write, kein Versions-/Audit-Pfad (reiner Job-Status).
    const res = await this.pool.query(
      "UPDATE kos SET data = jsonb_set(data, '{aiCheck}', $2::jsonb) WHERE id=$1 AND NOT (data ? 'deletedAt')",
      [id, JSON.stringify(aiCheck)],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async resolveAiCheck(
    id: string,
    patch: Omit<AiCheck, "requestedAt">,
    expectedKoVersion?: number,
  ): Promise<boolean> {
    // WP-SUBMIT-ASYNC: BEDINGT (CAS-schonend wie setCaptionTexts) — EIN UPDATE, nur wenn der
    // Status noch pending ist; der Merge (||) erhält requestedAt und patcht ausschließlich das
    // aiCheck-Feld. Ein nebenläufiger revise (Voll-Write) verliert dadurch nie Daten.
    // WP-SHIP8-FINAL (bens Bedingung 2): mit expectedKoVersion zusätzlich versionsgebunden —
    // der pending-Vermerk muss die Version tragen UND das KO muss noch auf ihr stehen ($3 NULL
    // = Bestandsverhalten fuer Altbestand/unbedingte Aufrufe).
    const res = await this.pool.query(
      `UPDATE kos SET data = jsonb_set(data, '{aiCheck}', (data->'aiCheck') || $2::jsonb)
       WHERE id=$1 AND data->'aiCheck'->>'status' = 'pending'
         AND ($3::int IS NULL OR (
           (data->'aiCheck'->>'koVersion')::int = $3::int AND (data->>'version')::int = $3::int
         ))`,
      [id, JSON.stringify(patch), expectedKoVersion ?? null],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async setCaptionTexts(id: string, captionTexts: string[]): Promise<boolean> {
    const res = await this.pool.query(
      "UPDATE kos SET data = jsonb_set(data, '{captionTexts}', $2::jsonb) WHERE id=$1 AND NOT (data ? 'captionTexts')",
      [id, JSON.stringify(captionTexts)],
    );
    return (res.rowCount ?? 0) > 0;
  }

  // SCRUM-361 / AG-03 / FR-ASK-02 / NFR-PERF-03: datenquellennahe Kandidaten-Vorauswahl für Ask.
  // Statt alle KOs zu laden, filtert die DB ODER-weise über die (bereits tokenisierten) Inhalts-Terme
  // auf den vorhandenen Feldern (title/statement/category/tags) — vollständig PARAMETRISIERT (kein
  // SQL-Injection-Risiko; die Terme sind reine Inhaltstoken ohne Wildcards). Reihenfolge: validierte
  // KOs zuerst, dann höherer Trust → relevante validierte Treffer bleiben unter dem LIMIT erhalten.
  // KEINE Volltext-Engine, KEINE Embeddings, KEINE Migration: nur ILIKE/JSONB auf vorhandenen Spalten.
  // Die feine Relevanz-/Status-/Trust-Endsortierung übernimmt der Reasoner (`selectCandidates`).
  async findCandidates(query: KoCandidateQuery): Promise<KnowledgeObject[]> {
    const terms = query.terms.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0);
    if (terms.length === 0) {
      return [];
    }
    const limit = Math.max(0, Math.floor(query.limit));
    const params: unknown[] = [];
    const ors: string[] = [];
    for (const term of terms) {
      params.push(`%${term}%`);
      const p = `$${params.length}`;
      // SCRUM-362: ODER-Treffer über GENAU die Ausdrücke, für die GIN-Trigramm-Indizes existieren
      // (KO_CANDIDATE_SEARCH_EXPRESSIONS) → jedes `<expr> ILIKE $p` ist über den passenden Index
      // bedienbar. Ein Term genügt; Teilstring-Match über Titel/Aussage/Kategorie/Tags(JSONB-Text).
      const clause = KO_CANDIDATE_SEARCH_EXPRESSIONS.map((expr) => `${expr} ILIKE ${p}`).join(
        " OR ",
      );
      ors.push(`(${clause})`);
    }
    params.push(limit);
    const limitP = `$${params.length}`;
    // ORDER BY: validierte zuerst, dann Trust absteigend (NULLS LAST schützt vor fehlendem Trust-
    // Feld); harte Begrenzung über LIMIT. Alle Werte sind Parameter, kein eingebetteter Term.
    // WP-SAMMEL21-FIX (bens Fix 3): DATENSPARENDE PROJEKTION wie listForSearch — bis zu 200
    // Kandidaten je Frage würden sonst ihr volles bodyHtml (potenziell megabyte-große base64-
    // Bilder) aus der DB ziehen. `data - 'bodyHtml'` entfernt es bereits im SELECT; Titel/
    // Statement/captionTexts (genau die Matching-/Antwortfelder des Ask-Pfads) bleiben drin.
    const sql = `SELECT data - 'bodyHtml' AS data FROM kos WHERE ${ors.join(" OR ")} ORDER BY (status='validiert') DESC, (data->>'trust')::int DESC NULLS LAST LIMIT ${limitP}`;
    const res = await this.pool.query<DataRow>(sql, params);
    return res.rows.map((row) => row.data);
  }
}

interface SnapshotRow {
  snapshot: KnowledgeObject;
  version: number;
  at: string;
  author: string;
  note: string;
}

// SCRUM-159: Postgres-Adapter der KO-Version-Snapshots (append-only, nie überschreibend).
export class PgKoVersionRepo implements KoVersionRepo {
  constructor(private readonly pool: Pool) {}

  // JOB 2704 D1 (R2-35): MIT tx auf dem Transaktionsclient von mutateKoTx — der Snapshot committet
  // oder verschwindet zusammen mit dem kos-UPDATE; es gibt keine Version n+1 ohne Snapshot mehr.
  // JOB 2706 D2: Schreiben und Schreibstand in EINER Transaktion — mit `tx` in der des Aufrufers,
  // sonst in einer eigenen (s. repo-pg.ts Kopf, Muster `PgKoRepo.update/delete`).
  async append(snapshot: KoVersionSnapshot, tx?: TxContext): Promise<void> {
    const lauf = async (queryable: Queryable): Promise<void> => {
      await queryable.query(
        `INSERT INTO ko_versions(ko_id,version,snapshot,at,author,note)
       VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (ko_id, version) DO NOTHING`,
        [
          snapshot.koId,
          snapshot.version,
          JSON.stringify(snapshot.snapshot),
          snapshot.at,
          snapshot.author,
          snapshot.note,
        ],
      );
      await queryable.query(KO_SCHREIBSTAND_ERHOEHEN_SQL);
    };
    if (tx) {
      await lauf(pgQueryable(tx));
      return;
    }
    await withPgTx(this.pool, (eigene) => lauf(pgQueryable(eigene)));
  }

  async listByKo(koId: string): Promise<KoVersionSnapshot[]> {
    const res = await this.pool.query<SnapshotRow>(
      "SELECT snapshot,version,at,author,note FROM ko_versions WHERE ko_id=$1 ORDER BY version",
      [koId],
    );
    return res.rows.map((row) => ({
      koId,
      version: row.version,
      snapshot: row.snapshot,
      at: row.at,
      author: row.author,
      note: row.note,
    }));
  }

  // SCRUM-507 R3: kompensierender Rollback eines noch nicht committeten Snapshots (s. KoVersionRepo).
  async remove(koId: string, version: number): Promise<void> {
    // JOB 2706 D1: auch die Ruecknahme aendert den Traegerbestand — Stand in derselben Transaktion.
    await withPgTx(this.pool, async (tx) => {
      const q = pgQueryable(tx);
      await q.query("DELETE FROM ko_versions WHERE ko_id=$1 AND version=$2", [koId, version]);
      await q.query(KO_SCHREIBSTAND_ERHOEHEN_SQL);
    });
  }
}

interface EvidenceRow {
  data: EvidenceRecord;
}

// SCRUM-160: Postgres-Adapter der Evidence-Records (append-only, nie überschreibend).
export class PgEvidenceRepo implements EvidenceRepo {
  constructor(private readonly pool: Pool) {}

  async append(record: EvidenceRecord): Promise<void> {
    // JOB 2706 D1: Schreiben und Schreibstand in EINER Transaktion (s. repo-pg.ts Kopf).
    await withPgTx(this.pool, async (tx) => {
      const q = pgQueryable(tx);
      await q.query(
        `INSERT INTO ko_evidence(id,ko_id,ko_version,kind,data,created_at)
       VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
        [
          record.id,
          record.koId,
          record.koVersion,
          record.kind,
          JSON.stringify(record),
          record.createdAt,
        ],
      );
      await q.query(KO_SCHREIBSTAND_ERHOEHEN_SQL);
    });
  }

  async listByKo(koId: string): Promise<EvidenceRecord[]> {
    const res = await this.pool.query<EvidenceRow>(
      "SELECT data FROM ko_evidence WHERE ko_id=$1 ORDER BY created_at,id",
      [koId],
    );
    return res.rows.map((row) => row.data);
  }

  // SCRUM-169: jüngste Evidence über alle KOs (read-only, defensiv limitiert).
  async recent(limit: number): Promise<EvidenceRecord[]> {
    const res = await this.pool.query<EvidenceRow>(
      "SELECT data FROM ko_evidence ORDER BY created_at DESC,id DESC LIMIT $1",
      [Math.max(0, limit)],
    );
    return res.rows.map((row) => row.data);
  }
}
