// ================================================================================================
// G27 WELLE 1 — IN-MEMORY UND POSTGRES SAGEN DASSELBE
// ================================================================================================
//
// Belegt: Akzeptanzkriterium 9 — In-Memory- und PostgreSQL-Verhalten stimmen überein, soweit beide
// Pfade betroffen sind.
//
// WIE DAS HIER GEMESSEN WIRD, ehrlich benannt:
//
//  1 DIE REGEL SELBST ist bei beiden Adaptern DIESELBE Funktion — `composeEffectiveSearchDocument`
//    + `matchEffectiveSearchDocument`. Der In-Memory-Adapter ruft sie; Postgres bildet sie in SQL
//    ab. Was hier an der reinen Funktion gemessen wird, gilt deshalb für beide.
//  2 DIE SQL-ABBILDUNG wird über einen Fake-Pool gegen die Regel gehalten: jede Zusage der
//    In-Memory-Fassung muss sich als Ausdruck im Statement wiederfinden (Feld für Feld).
//
// WAS DAS NICHT ERSETZT, ausdrücklich: einen echten Postgres-Lauf (Planner, Indexnutzung,
// Nebenläufigkeit am Primärschlüssel und am bedingten ON-CONFLICT-Update). Der gehört in den
// Testcontainers-Lauf (`npm run test:integration`) und steht als Restaufwand im Bericht — dasselbe
// Zugeständnis, das der bestehende Adaptertest bereits macht.
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import {
  InMemoryKoMetadataProjectionRepo,
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  KO_METADATA_PROJECTION_SCHEMA,
  type KnowledgeObject,
  KoService,
  PgKoMetadataProjectionRepo,
  PgKoSearchProjectionRepo,
  buildSearchProjection,
} from "../../services/knowledge-object";

// G27 R1: die Steuerzeile beantwortet den Control-State-Lesevorgang, den `findActive` seit R1 VOR
// jeder Suchabfrage stellt. Sie steht hier auf „V2 freigegeben" — der Normalbetrieb, dessen
// Feldregel diese Datei misst.
// G27 R1 / KW-ARCH-G27-GENERATION-UND-INTEGRITAET-09 §3: „freigegeben" heisst seit dieser
// Entscheidung Fassung UND Generation UND ein Marker, der für GENAU diese Generation gilt. Ohne die
// drei Felder wäre die Zeile hier kein Normalbetrieb mehr, sondern eine fail-closed Instanz — die
// Feldregel, die diese Datei misst, käme gar nicht erst zur Ausführung.
const AKTIVE_GENERATION = 5;
const STEUERZEILE_V2_ACTIVE = {
  active_projection_version: 2,
  target_projection_version: 2,
  projection_state: "V2_ACTIVE",
  last_successful_rebuild: "2026-08-01T00:00:00.000Z",
  last_reconcile: "2026-08-01T00:00:00.000Z",
  last_failure: null,
  build_started_at: "2026-08-01T00:00:00.000Z",
  build_finished_at: "2026-08-01T00:00:00.000Z",
  build_generation: AKTIVE_GENERATION,
  active_generation: AKTIVE_GENERATION,
  integrity_marker: `V2-READY:${AKTIVE_GENERATION}`,
  activated_at: "2026-08-01T00:00:00.000Z",
};

function fakePool(rows: Record<string, unknown>[] = []) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const query = async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.includes("ko_projection_control")) {
      return { rows: [STEUERZEILE_V2_ACTIVE], rowCount: 1 };
    }
    return { rows, rowCount: rows.length };
  };
  const pool = {
    query,
    // G27 R1 / Entscheidung 09 §2: Schreibvorgänge laufen jetzt in einer Transaktion mit gesperrter
    // Steuerzeile (`BEGIN` / `SELECT … FOR SHARE` / Anweisung / `COMMIT`) und brauchen dafür eine
    // ANGEHEFTETE Verbindung — `pool.query()` gibt je Anweisung eine beliebige aus dem Pool zurück,
    // eine Transaktion darüber wäre keine. Der Doppelgänger reicht deshalb denselben
    // aufzeichnenden Ausführer durch; `release()` ist ein No-op, weil es nichts zurückzugeben gibt.
    connect: async () => ({ query, release: () => undefined }),
  } as unknown as Pool;
  return { pool, calls };
}

// Die tatsächlich geprüfte Anweisung — nicht mehr `calls[0]`. Seit der Transaktionsklammer stehen
// `BEGIN` und der Sperr-SELECT davor; ein Zugriff über den Index misse sonst die Klammer statt der
// Zusage. Gesucht wird über einen eindeutigen Textanker, damit die Suchstelle stabil bleibt.
function anweisung(calls: { sql: string; params: unknown[] }[], teil: string) {
  return calls.find((c) => c.sql.includes(teil)) as { sql: string; params: unknown[] };
}

// Die Abfrage der Suche selbst — ohne den vorangestellten Blick auf die Steuerzeile.
function ersteSuchAbfrage(calls: { sql: string; params: unknown[] }[]) {
  return calls.find((c) => !c.sql.includes("ko_projection_control")) as {
    sql: string;
    params: unknown[];
  };
}

function ko(overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "k1",
    title: "Ventil warten",
    statement: "Quartalsweise prüfen.",
    category: "Wartung",
    tags: [],
    version: 1,
    createdAt: "2026-08-01T10:00:00.000Z",
    ...overrides,
  } as unknown as KnowledgeObject;
}

const AT = "2026-08-01T10:00:00.000Z";

describe("G27 Welle 1 · AK9 · die Metadatenprojektion verhält sich in beiden Speichern gleich", () => {
  it("In-Memory: erster Schreibvorgang ⇒ Revision 1 und `changed`", async () => {
    const repo = new InMemoryKoMetadataProjectionRepo();
    const ergebnis = await repo.upsert({
      koId: "k1",
      categoryText: "Wartung",
      tagText: "presse",
      at: AT,
    });
    expect(ergebnis.changed).toBe(true);
    expect(ergebnis.previous).toBeUndefined();
    expect(ergebnis.projection.metadataRevision).toBe(1);
  });

  it("In-Memory: identische Wiederholung ⇒ KEIN Bump, `changed` false, Zeile unangetastet", async () => {
    const repo = new InMemoryKoMetadataProjectionRepo();
    await repo.upsert({ koId: "k1", categoryText: "Wartung", tagText: "presse", at: AT });
    const zweiter = await repo.upsert({
      koId: "k1",
      categoryText: "Wartung",
      tagText: "presse",
      at: "2027-01-01T00:00:00.000Z",
    });
    expect(zweiter.changed).toBe(false);
    expect(zweiter.projection.metadataRevision).toBe(1);
    // Auch der Zeitstempel bleibt: ein idempotenter Aufruf hat die Zeile nicht berührt.
    expect(zweiter.projection.updatedAt).toBe(AT);
  });

  it("In-Memory: echte Änderung ⇒ genau EIN Bump und ein belastbares „vorher“", async () => {
    const repo = new InMemoryKoMetadataProjectionRepo();
    await repo.upsert({ koId: "k1", categoryText: "Wartung", tagText: "", at: AT });
    const zweiter = await repo.upsert({
      koId: "k1",
      categoryText: "Montage",
      tagText: "",
      at: AT,
    });
    expect(zweiter.changed).toBe(true);
    expect(zweiter.previous?.categoryText).toBe("Wartung");
    expect(zweiter.projection.metadataRevision).toBe(2);
  });

  it("Postgres: dieselbe Regel, in EINEM Statement — bedingtes DO UPDATE, +1, RETURNING", async () => {
    const { pool, calls } = fakePool();
    const repo = new PgKoMetadataProjectionRepo(pool);
    await repo.upsert({ koId: "k1", categoryText: "Wartung", tagText: "presse", at: AT });
    // Der erste Aufruf holt das Audit-„vorher“ …
    expect(calls[0]?.sql).toContain("SELECT");
    // … der zweite ist der Schreibvorgang.
    const { sql, params } = calls[1] as { sql: string; params: unknown[] };
    expect(sql).toContain("INSERT INTO ko_metadata_projections(");
    expect(sql).toContain("ON CONFLICT (ko_id) DO UPDATE SET");
    // MONOTON: die Datenbank rechnet, nicht der Anwendungscode.
    expect(sql).toContain("metadata_revision = ko_metadata_projections.metadata_revision + 1");
    // IDEMPOTENT: die Bedingung entscheidet, ob überhaupt geschrieben wird.
    expect(sql).toContain(
      "WHERE ko_metadata_projections.category_text IS DISTINCT FROM EXCLUDED.category_text",
    );
    expect(sql).toContain("OR ko_metadata_projections.tag_text IS DISTINCT FROM EXCLUDED.tag_text");
    expect(sql).toContain("RETURNING");
    // Vollständig parametrisiert — Kategorie und Schlagwörter sind Inhalt, kein SQL.
    expect(params).toEqual(["k1", "Wartung", "presse", AT]);
  });

  it("Postgres: keine zurückgegebene Zeile heißt ehrlich „nichts geändert“", async () => {
    // Der Fake-Pool liefert für JEDE Abfrage keine Zeile — genau der Fall „Bedingung griff nicht“.
    const { pool } = fakePool();
    const repo = new PgKoMetadataProjectionRepo(pool);
    const ergebnis = await repo.upsert({
      koId: "k1",
      categoryText: "Wartung",
      tagText: "",
      at: AT,
    });
    expect(ergebnis.changed).toBe(false);
  });

  it("die DDL der Metadatentabelle ist additiv, idempotent und nicht destruktiv", () => {
    expect(KO_METADATA_PROJECTION_SCHEMA).toContain(
      "CREATE TABLE IF NOT EXISTS ko_metadata_projections",
    );
    expect(KO_METADATA_PROJECTION_SCHEMA).toContain("ko_id text PRIMARY KEY");
    expect(KO_METADATA_PROJECTION_SCHEMA).toContain("metadata_revision bigint NOT NULL");
    for (const verboten of [/\bDROP\b/i, /\bALTER\b/i, /\bTRUNCATE\b/i, /\bDELETE\b/i]) {
      expect(KO_METADATA_PROJECTION_SCHEMA).not.toMatch(verboten);
    }
    const creates = KO_METADATA_PROJECTION_SCHEMA.match(/CREATE (TABLE|INDEX)/gi) ?? [];
    const idempotent =
      KO_METADATA_PROJECTION_SCHEMA.match(/CREATE (TABLE|INDEX) IF NOT EXISTS/gi) ?? [];
    expect(creates.length).toBe(idempotent.length);
    // Kategorie und Schlagwörter sind jetzt ein EIGENSTÄNDIGER Sucheinstieg — ohne die beiden
    // Trigramm-Indizes wäre die Kategoriesuche ein sequenzieller Scan.
    expect(KO_METADATA_PROJECTION_SCHEMA).toContain("gin (category_text gin_trgm_ops)");
    expect(KO_METADATA_PROJECTION_SCHEMA).toContain("gin (tag_text gin_trgm_ops)");
    expect(KO_METADATA_PROJECTION_SCHEMA).not.toMatch(/vector|embedding|pgvector/i);
    // Keine Sicherheitsklassifizierung in dieser Tabelle (S2 nimmt keine auf).
    expect(KO_METADATA_PROJECTION_SCHEMA).not.toMatch(/confidential|classification/i);
  });
});

describe("G27 Welle 1 · AK9 · die Suche bildet dieselbe Feldregel ab", () => {
  it("In-Memory: Kategorie- und Schlagworttreffer sind eigenständige Fundstellen", async () => {
    const repo = new InMemoryKoRepo();
    const dienst = new KoService({
      repo,
      versions: new InMemoryKoVersionRepo(),
      searchProjections: new InMemoryKoSearchProjectionRepo(repo),
    });
    // G27 R1: eine frische Instanz ist `UNINITIALIZED` und beantwortet keine Suche — erst der
    // vollstaendige Gate-Lauf gibt Fassung 2 frei (05 §1).
    await dienst.activateSearchProjectionV2();
    const erstellt = await dienst.create({
      title: "Ohne Zielwort",
      statement: "Kurzfassung.",
      type: "best_practice",
      category: "Kategoriewortgamma",
      tags: ["Schlagwortgamma"],
      author: "anna",
      bodyHtml: "<p>Dokumentwortgamma</p>",
    });
    const [kategorie] = await dienst.findSearchHits({ terms: ["kategoriewortgamma"] });
    const [schlagwort] = await dienst.findSearchHits({ terms: ["schlagwortgamma"] });
    const [body] = await dienst.findSearchHits({ terms: ["dokumentwortgamma"] });
    expect(kategorie?.koId).toBe(erstellt.id);
    expect(kategorie?.matched.category).toBe(true);
    expect(schlagwort?.matched.tag).toBe(true);
    expect(body?.matched.body).toBe(true);
  });

  it("Postgres: GENAU dieselben fünf Fundstellenmarken, aus den jeweils richtigen Tabellen", async () => {
    const { pool, calls } = fakePool();
    const repo = new PgKoSearchProjectionRepo(pool);
    await repo.findActive({ terms: ["kategoriewortgamma"] });
    const { sql } = ersteSuchAbfrage(calls);
    // Kurzfelder aus der Inhaltsprojektion …
    expect(sql).toContain("p.title_text ILIKE");
    expect(sql).toContain("p.statement_text ILIKE");
    expect(sql).toContain("p.caption_text ILIKE");
    // … Kategorie und Schlagwörter aus der Metadatenprojektion.
    expect(sql).toContain("COALESCE(md.category_text, '') ILIKE");
    expect(sql).toContain("COALESCE(md.tag_text, '') ILIKE");
    // Und die Fundstellen heißen in beiden Fassungen gleich.
    for (const marke of [
      "m_title_text",
      "m_statement_text",
      "m_category_text",
      "m_tag_text",
      "m_caption_text",
    ]) {
      expect(sql).toContain(marke);
    }
  });

  it("Postgres: die ODER-Bedingung deckt beide Projektionsarten ab (sonst fiele die Kategoriesuche aus)", async () => {
    const { pool, calls } = fakePool();
    const repo = new PgKoSearchProjectionRepo(pool);
    await repo.findActive({ terms: ["begriff"] });
    const { sql } = ersteSuchAbfrage(calls);
    const where = sql.slice(sql.indexOf("WHERE"), sql.indexOf("ORDER BY"));
    expect(where).toContain("p.search_text ILIKE");
    expect(where).toContain("COALESCE(md.category_text, '') ILIKE");
    expect(where).toContain("COALESCE(md.tag_text, '') ILIKE");
    // G27 R1: die Fassungsbedingung steht als EIGENES, UND-verknuepftes Glied davor — die
    // Textbedingungen bleiben untereinander ODER-verknuepft und sind eingeklammert. Ohne die
    // Klammer wuerde ein einziger ODER-Zweig die Fassungsbindung aushebeln.
    //
    // Entscheidung 09 §3 haengt die GENERATIONSBINDUNG als zweites UND-Glied daneben. Die Zusage
    // dieses Falls ist damit unveraendert und um ein Glied schaerfer: beide Bindungen stehen VOR
    // dem geklammerten ODER-Block, nicht in ihm.
    expect(where).toContain("p.projection_version = $1");
    expect(where).toContain("p.generation = $2");
    expect(where).toMatch(/p\.generation = \$2 AND \(/);
  });

  it("Postgres: die Fassungsbedingung traegt den Wert aus dem Control-State, nicht eine Konstante", async () => {
    const { pool, calls } = fakePool();
    const repo = new PgKoSearchProjectionRepo(pool);
    await repo.findActive({ terms: ["begriff"] });
    const { sql, params } = ersteSuchAbfrage(calls);
    // Parametrisiert (AK: kein interpoliertes Literal) …
    expect(sql).not.toMatch(/projection_version\s*=\s*\d/);
    // … und der erste Parameter ist genau die freigegebene Fassung der Steuerzeile.
    expect(params[0]).toBe(STEUERZEILE_V2_ACTIVE.active_projection_version);
    // Das Suchranking bleibt Zeichen fuer Zeichen, wie es war (ausdruecklich ausgeschlossener
    // Bereich, Entscheidung 04 §7).
    expect(sql).toContain(
      "ORDER BY (k.status='validiert') DESC, (k.data->>'trust')::int DESC NULLS LAST, p.ko_id",
    );
  });

  it("Postgres: die Zeile schreibt body_text und classification_snapshot mit", async () => {
    const { pool, calls } = fakePool([{ ko_id: "k1" }]);
    const repo = new PgKoSearchProjectionRepo(pool);
    const projektion = buildSearchProjection(
      ko({ bodyHtml: "<p>Dokumentwort</p>", confidentiality: "vertraulich" }),
      AT,
    );
    await repo.insert(projektion);
    const { sql, params } = anweisung(calls, "INSERT INTO ko_search_projections(");
    const spalten = (sql.match(/ko_search_projections\(([^)]+)\)/)?.[1] ?? "").split(",");
    expect(params[spalten.indexOf("body_text")]).toBe("Dokumentwort");
    const snapshot = String(params[spalten.indexOf("classification_snapshot")]);
    expect(snapshot).toContain("vertraulich");
    expect(snapshot).toContain("knowledge_object.confidentiality");
  });

  it("Postgres: was geschrieben wurde, kommt unverändert zurück (Serialisierung ist verlustfrei)", async () => {
    const original = buildSearchProjection(
      ko({ bodyHtml: "<p>Dokumentwort</p>", confidentiality: "streng_vertraulich" }),
      AT,
    );
    const { pool, calls } = fakePool([{ ko_id: "k1" }]);
    await new PgKoSearchProjectionRepo(pool).insert(original);
    const geschrieben = anweisung(calls, "INSERT INTO ko_search_projections(");
    const spalten = (geschrieben.sql.match(/ko_search_projections\(([^)]+)\)/)?.[1] ?? "").split(
      ",",
    );
    const wert = (name: string) => geschrieben.params[spalten.indexOf(name)];

    // Die Zeile, wie die Datenbank sie zurückgäbe — aus den TATSÄCHLICH geschriebenen Werten.
    const zeile = {
      ko_id: wert("ko_id"),
      ko_version: wert("ko_version"),
      projection_version: wert("projection_version"),
      search_text: wert("search_text"),
      title_text: wert("title_text"),
      statement_text: wert("statement_text"),
      caption_text: wert("caption_text"),
      body_text: wert("body_text"),
      language: wert("language"),
      content_hash: wert("content_hash"),
      status: wert("status"),
      classification_snapshot: wert("classification_snapshot"),
      created_at: wert("created_at"),
      updated_at: wert("updated_at"),
    };
    const { pool: leser, calls: leseCalls } = fakePool([zeile]);
    const zurueck = await new PgKoSearchProjectionRepo(leser).find("k1", 1);
    expect(leseCalls[0]?.sql).toContain("SELECT");
    expect(zurueck).toEqual(original);
  });
});
