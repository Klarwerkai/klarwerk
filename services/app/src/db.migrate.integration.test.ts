import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PgUserRepo, type User } from "../../auth";
import {
  type KnowledgeObject,
  KoService,
  PgKoRepo,
  PgKoSearchProjectionRepo,
  SEARCH_PROJECTION_VERSION,
  buildSearchProjection,
} from "../../knowledge-object";
import { PgKlaraSessionRepo } from "../../reasoner";
import { createPool, migrate } from "./db";
import {
  KLARA_SESSION_CONFLICT_MESSAGE,
  KLARA_SESSION_INACTIVITY_MS,
  KLARA_SINGLE_TENANT_ID,
  type KlaraBindung,
  type KlaraPolicyQuelle,
  KlaraSessionService,
} from "./services/klara-session-service";

// SCRUM-496 (die Lehre): migrate() brach auf der Beta beim Boot mit "42601 syntax error at or near
// overlaps" ab — OVERLAPS ist ein reserviertes Postgres-Keyword, das unquotierte CREATE TABLE war
// ungültig. Der statische Migrate-Test prüft nur REFERENZEN, nicht die SQL-Gültigkeit. Dieser Test
// fährt das GESAMTE migrate()-DDL einmal gegen ein echtes Postgres — ein Syntaxfehler in irgendeinem
// Modul-Schema fällt damit im CI-Gate auf, nicht erst im Prod-Deploy. Braucht Docker (Testcontainers);
// läuft unter `npm run test:integration` (CI-Job "integration"), nicht im schnellen Root-Gate.
describe("SCRUM-496: migrate() ist gültiges SQL gegen echtes Postgres", () => {
  let container: StartedTestContainer;

  beforeAll(async () => {
    container = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk" })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
  });

  afterAll(async () => {
    await container?.stop();
  });

  it("migrate() legt alle Modul-Tabellen ohne Syntaxfehler an (idempotent)", async () => {
    const url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk`;
    const pool = createPool(url);
    try {
      // Der eigentliche Test: würde ein Modul-DDL ungültige Syntax tragen (z. B. ein reservierter
      // Tabellenname), wirft dieser Aufruf — genau der Boot-Abbruch, den die Beta zeigte.
      await expect(migrate(pool)).resolves.toBeUndefined();
      // Zweiter Lauf beweist die Idempotenz (CREATE TABLE IF NOT EXISTS).
      await expect(migrate(pool)).resolves.toBeUndefined();

      // Die zuvor kaputte Tabelle existiert jetzt unter unkritischem Namen und ist abfragbar.
      const overlaps = await pool.query("SELECT id, data FROM ko_overlaps");
      expect(overlaps.rowCount).toBe(0);
      const settings = await pool.query("SELECT key, min_confidence FROM overlap_settings");
      expect(settings.rowCount).toBe(0);
    } finally {
      await pool.end();
    }
  });

  // SCRUM-504 (P0): der partielle Unique-Index erzwingt DB-nativ „höchstens ein Bootstrap-Admin". Beweist
  // gegen ECHTES Postgres, dass parallele Claims genau EINEN Gewinner haben (die COUNT+INSERT-Race ist
  // geschlossen) und dass ein zweiter bootstrap_admin=true strukturell unmöglich ist.
  it("SCRUM-504: partieller Unique-Index → genau ein Bootstrap-Admin trotz paralleler Claims", async () => {
    const url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk`;
    const pool = createPool(url);
    try {
      await migrate(pool);
      await pool.query("DELETE FROM users"); // leere Instanz simulieren
      const repo = new PgUserRepo(pool);
      const mkUser = (i: number): User => ({
        id: `u${i}`,
        name: `N${i}`,
        email: `u${i}@x.de`,
        passwordSalt: "s",
        passwordHash: "h",
        role: "admin",
        approved: true,
        createdAt: new Date(0).toISOString(),
      });
      // Viele gleichzeitige Claims (echte Nebenläufigkeit über den Pool).
      const claims = await Promise.all(
        Array.from({ length: 10 }, (_, i) => repo.tryClaimBootstrapAdmin(mkUser(i))),
      );
      expect(claims.filter(Boolean)).toHaveLength(1); // genau EIN Gewinner
      // Verlierer fügen per ON CONFLICT DO NOTHING nichts ein → genau eine Zeile, genau ein Bootstrap.
      const bootstrap = await pool.query<{ c: number }>(
        "SELECT count(*)::int AS c FROM users WHERE bootstrap_admin",
      );
      expect(bootstrap.rows[0]?.c).toBe(1);
      const total = await pool.query<{ c: number }>("SELECT count(*)::int AS c FROM users");
      expect(total.rows[0]?.c).toBe(1);
      // Direkter Constraint-Beweis: ein zweiter bootstrap_admin=true verletzt den Index.
      await expect(
        pool.query(
          `INSERT INTO users(id,name,email,password_salt,password_hash,role,approved,created_at,bootstrap_admin)
           VALUES('x2','x2','x2@x.de','s','h','admin',true,'t',true)`,
        ),
      ).rejects.toThrow();
    } finally {
      await pool.end();
    }
  });

  // ==============================================================================================
  // W2-A (KW-W2-17, Anschluss PRO 280) — DIE IMPORT-LAUF-TABELLEN ENTSTEHEN WIRKLICH
  // ==============================================================================================
  //
  // Der statische Wächter (`db.migrate.test.ts`) prüft nur, DASS `IMPORT_RUN_SCHEMA` in der
  // migrate()-Liste REFERENZIERT ist — nicht, ob sein DDL gegen einen echten Server durchläuft und
  // was es dabei anlegt. Zwei generierte Spalten, ein Fremdschlüssel und zwei CHECKs entstehen über
  // `DO $$`-Blöcke; ob die wirklich greifen, entscheidet der Server. Ein Constraint, der nur
  // existiert, aber nicht beißt, wäre ein falsches Grün — deshalb wird jeder von ihnen zusätzlich
  // mit einem verletzenden INSERT geprüft.
  //
  // ABGRENZUNG: Dieser Test prüft die WIRKUNG DER MIGRATION, nicht das Repo-Verhalten. Die drei
  // BEN-147-Pflichtlücken (verwaiste Referenzen im In-Memory-Repo, ungeprüfte negative Zähler im
  // PG-Repo, kopierter Fachinhalt beim INSERT) bleiben ausdrücklich offen und werden hier weder
  // berührt noch geheilt.
  it("W2-A: migrate() legt die Import-Lauf-Tabellen mit Spalten, Constraints und Indizes an", async () => {
    const url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk`;
    const pool = createPool(url);
    try {
      await migrate(pool);
      // Definierter Ausgangspunkt im Wegwerf-Container (Kind zuerst, der Fremdschlüssel bindet).
      await pool.query("DELETE FROM import_run_item_refs");
      await pool.query("DELETE FROM import_runs");

      // 1 Beide Tabellen existieren und sind abfragbar.
      const laeufe = await pool.query("SELECT import_id, data, status, source_system FROM import_runs");
      expect(laeufe.rowCount).toBe(0);
      const refs = await pool.query("SELECT import_id, ordinal, data FROM import_run_item_refs");
      expect(refs.rowCount).toBe(0);

      // 2 Die wesentlichen Spalten — Typ, Nullbarkeit und die beiden GENERATED-Spalten.
      const spalten = await pool.query<{
        table_name: string;
        column_name: string;
        data_type: string;
        is_nullable: string;
        is_generated: string;
      }>(
        `SELECT table_name, column_name, data_type, is_nullable, is_generated
           FROM information_schema.columns
          WHERE table_name IN ('import_runs','import_run_item_refs')
          ORDER BY table_name, column_name`,
      );
      const spalte = (t: string, c: string) =>
        spalten.rows.find((r) => r.table_name === t && r.column_name === c);
      expect(spalte("import_runs", "import_id")).toMatchObject({
        data_type: "text",
        is_nullable: "NO",
      });
      expect(spalte("import_runs", "data")).toMatchObject({ data_type: "jsonb", is_nullable: "NO" });
      // `status` ist abgeleitet UND nicht nullbar — beides zusammen ist die Zusage.
      expect(spalte("import_runs", "status")).toMatchObject({
        data_type: "text",
        is_nullable: "NO",
        is_generated: "ALWAYS",
      });
      expect(spalte("import_runs", "source_system")).toMatchObject({ is_generated: "ALWAYS" });
      expect(spalte("import_run_item_refs", "ordinal")).toMatchObject({
        data_type: "integer",
        is_nullable: "NO",
      });
      expect(spalte("import_run_item_refs", "data")).toMatchObject({ data_type: "jsonb" });

      // 3 Die benannten Constraints stehen — Primärschlüssel, Fremdschlüssel und beide CHECKs.
      const constraints = await pool.query<{ conname: string; contype: string }>(
        `SELECT conname, contype FROM pg_constraint
          WHERE conrelid IN ('import_runs'::regclass, 'import_run_item_refs'::regclass)`,
      );
      const typVon = (n: string) => constraints.rows.find((r) => r.conname === n)?.contype;
      expect(typVon("import_runs_status_ck")).toBe("c");
      expect(typVon("import_run_item_refs_lauf_fk")).toBe("f");
      expect(typVon("import_run_item_refs_element_ck")).toBe("c");
      expect(constraints.rows.filter((r) => r.contype === "p")).toHaveLength(2);

      // 4 Die beiden Indizes der Migration.
      const indizes = await pool.query<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes
          WHERE tablename IN ('import_runs','import_run_item_refs')`,
      );
      const indexnamen = indizes.rows.map((r) => r.indexname);
      expect(indexnamen).toContain("idx_import_runs_quelle");
      expect(indexnamen).toContain("idx_import_run_item_refs_lauf");

      // 5 Die generierten Spalten leiten wirklich ab: `source_system` wird getrimmt und
      //    kleingeschrieben, `status` gespiegelt. Der Server rechnet, nicht der Aufrufer.
      await pool.query(
        `INSERT INTO import_runs(import_id, data) VALUES ('ir-1', $1::jsonb)`,
        [
          JSON.stringify({
            importId: "ir-1",
            sourceSystem: "  Confluence  ",
            startedAt: "2026-01-01T00:00:00.000Z",
            status: "QUEUED",
          }),
        ],
      );
      const abgeleitet = await pool.query<{ status: string; source_system: string }>(
        "SELECT status, source_system FROM import_runs WHERE import_id = 'ir-1'",
      );
      expect(abgeleitet.rows[0]).toEqual({ status: "QUEUED", source_system: "confluence" });

      // 6 `import_runs_status_ck` beißt: ein unbekannter Status wird abgewiesen.
      await expect(
        pool.query(`INSERT INTO import_runs(import_id, data) VALUES ('ir-bad', $1::jsonb)`, [
          JSON.stringify({
            importId: "ir-bad",
            sourceSystem: "confluence",
            startedAt: "2026-01-01T00:00:00.000Z",
            status: "NICHT_VORGESEHEN",
          }),
        ]),
      ).rejects.toThrow();

      // 7 Der Fremdschlüssel beißt: eine Elementreferenz ohne Lauf kommt nicht in die Tabelle.
      await expect(
        pool.query(
          `INSERT INTO import_run_item_refs(import_id, ordinal, data) VALUES ('gibt-es-nicht', 0, $1::jsonb)`,
          [JSON.stringify({ candidateItemId: "c1", itemOutcome: "CREATED" })],
        ),
      ).rejects.toThrow();

      // 8 `import_run_item_refs_element_ck` beißt in allen drei Teilbedingungen.
      const refDaten = { candidateItemId: "c1", itemOutcome: "CREATED" };
      await expect(
        pool.query(
          `INSERT INTO import_run_item_refs(import_id, ordinal, data) VALUES ('ir-1', -1, $1::jsonb)`,
          [JSON.stringify(refDaten)],
        ),
      ).rejects.toThrow();
      await expect(
        pool.query(
          `INSERT INTO import_run_item_refs(import_id, ordinal, data) VALUES ('ir-1', 0, $1::jsonb)`,
          [JSON.stringify({ candidateItemId: "   ", itemOutcome: "CREATED" })],
        ),
      ).rejects.toThrow();
      await expect(
        pool.query(
          `INSERT INTO import_run_item_refs(import_id, ordinal, data) VALUES ('ir-1', 0, $1::jsonb)`,
          [JSON.stringify({ candidateItemId: "c1", itemOutcome: "ERFUNDEN" })],
        ),
      ).rejects.toThrow();

      // 9 Die gültige Referenz geht durch, und der zusammengesetzte Primärschlüssel hält.
      await pool.query(
        `INSERT INTO import_run_item_refs(import_id, ordinal, data) VALUES ('ir-1', 0, $1::jsonb)`,
        [JSON.stringify(refDaten)],
      );
      await expect(
        pool.query(
          `INSERT INTO import_run_item_refs(import_id, ordinal, data) VALUES ('ir-1', 0, $1::jsonb)`,
          [JSON.stringify(refDaten)],
        ),
      ).rejects.toThrow();
      const bestand = await pool.query<{ c: number }>(
        "SELECT count(*)::int AS c FROM import_run_item_refs",
      );
      expect(bestand.rows[0]?.c).toBe(1);
    } finally {
      await pool.end();
    }
  });

  // ==============================================================================================
  // G27 WELLE 1 / DETAILENTSCHEIDUNG J — DIE ADDITIVE V1→V2-MIGRATION, GEGEN ECHTES POSTGRES
  // ==============================================================================================
  //
  // WARUM DIESER TEST NUR HIER STEHEN KANN. Die Zusage lautet: eine Umgebung, die
  // `ko_search_projections` BEREITS in Fassung 1 trägt, wird durch `migrate()` additiv V2-fähig.
  // Genau diese Ausgangslage lässt sich mit keinem Fake-Pool und keinem SQL-Textvergleich
  // herstellen — ob `CREATE TABLE IF NOT EXISTS` an einer bestehenden Tabelle wirklich ein No-op
  // ist, ob `ADD COLUMN IF NOT EXISTS` sie wirklich nachrüstet, ob der V2-Insert davor wirklich
  // scheitert und danach wirklich durchgeht, entscheidet der Server. Der Textvergleich im
  // schnellen Tor (`tests/ko/g27-welle1-v1-v2-migration.test.ts`) prüft die FORM der Migration;
  // dieser Lauf prüft ihre WIRKUNG.
  //
  // Das DROP im Aufbau ist AUSDRÜCKLICH Testaufbau und kein Migrationsweg: es stellt die V1-
  // Ausgangslage in einem Wegwerf-Container her. Die Migration selbst enthält kein DROP — das ist
  // im schnellen Tor gepinnt.
  it("Abschnitt J: bestehende V1-Tabelle → additive Migration → V2-Insert → deterministischer Nachzug", async () => {
    const url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk`;
    const pool = createPool(url);
    try {
      await migrate(pool);

      // ---------------------------------------------------------------------------------------
      // 1) DIE REALE AUSGANGSLAGE: die Tabelle existiert in Fassung 1.
      //    Ohne `body_text`, ohne `classification_snapshot`, mit den beiden Legacy-Textspalten als
      //    echten NOT-NULL-Spalten OHNE Default (so trug sie Fassung 1) und nur zwei Indizes.
      // ---------------------------------------------------------------------------------------
      await pool.query("DROP TABLE IF EXISTS ko_search_projections");
      await pool.query(`
        CREATE TABLE ko_search_projections (
          ko_id text NOT NULL,
          ko_version int NOT NULL,
          projection_version int NOT NULL,
          search_text text NOT NULL,
          title_text text NOT NULL,
          statement_text text NOT NULL,
          category_text text NOT NULL,
          tag_text text NOT NULL,
          caption_text text NOT NULL,
          language text NOT NULL,
          content_hash text NOT NULL,
          status text NOT NULL,
          created_at text NOT NULL,
          updated_at text NOT NULL,
          PRIMARY KEY (ko_id, ko_version)
        );
        CREATE INDEX idx_ko_search_projections_search_trgm
          ON ko_search_projections USING gin (search_text gin_trgm_ops);
        CREATE INDEX idx_ko_search_projections_hash
          ON ko_search_projections(content_hash);
      `);

      const altesKo: KnowledgeObject = {
        id: "v1-bestand",
        title: "Altbestand Spezialpresse",
        statement: "Aussage aus der Fassung 1.",
        bodyHtml: "<p>ALTBESTANDSWORT im Dokumenttext</p>",
        conditions: [],
        measures: [],
        type: "best_practice",
        category: "Altkategorie",
        tags: ["altschlagwort"],
        confidence: 0,
        trust: 0,
        status: "offen",
        version: 1,
        originalAuthor: "anna",
        author: "anna",
        neededValidations: 1,
        assignments: [],
        asset: null,
        createdAt: "2024-03-01T08:00:00.000Z",
        history: [],
        comments: [],
        attachments: [],
        sources: [],
      } as unknown as KnowledgeObject;
      await new PgKoRepo(pool).insert(altesKo);
      // Die V1-Projektionszeile — Kategorie/Schlagwörter noch im Inhalt, kein Dokumenttext.
      await pool.query(
        `INSERT INTO ko_search_projections
           (ko_id,ko_version,projection_version,search_text,title_text,statement_text,
            category_text,tag_text,caption_text,language,content_hash,status,created_at,updated_at)
         VALUES ($1,1,1,$2,$3,$4,$5,$6,'','und','v1-hash','vollstaendig',$7,$7)`,
        [
          altesKo.id,
          `${altesKo.title}\n${altesKo.statement}\nAltkategorie altschlagwort`,
          altesKo.title,
          altesKo.statement,
          "Altkategorie",
          "altschlagwort",
          altesKo.createdAt,
        ],
      );

      // ---------------------------------------------------------------------------------------
      // 2) GEGENPROBE: gegen das UNMIGRIERTE V1-Schema scheitert der V2-Insert — genau der Abbruch,
      //    den ein reines `CREATE TABLE IF NOT EXISTS` in einer V1-Umgebung erzeugt hätte.
      // ---------------------------------------------------------------------------------------
      const projektionsRepo = new PgKoSearchProjectionRepo(pool);
      const neuesKo = { ...altesKo, id: "v2-neu", title: "Neuanlage nach V2" } as KnowledgeObject;
      await expect(
        projektionsRepo.insert(buildSearchProjection(neuesKo, "2026-08-02T10:00:00.000Z")),
      ).rejects.toThrow(/body_text|column/i);

      // ---------------------------------------------------------------------------------------
      // 3) DIE MIGRATION — additiv, an der bestehenden Tabelle.
      // ---------------------------------------------------------------------------------------
      await expect(migrate(pool)).resolves.toBeUndefined();

      const spalten = await pool.query<{
        column_name: string;
        is_nullable: string;
        column_default: string | null;
      }>(
        `SELECT column_name, is_nullable, column_default FROM information_schema.columns
          WHERE table_name = 'ko_search_projections' ORDER BY column_name`,
      );
      const nach = new Map(spalten.rows.map((r) => [r.column_name, r]));
      // Die beiden neuen Spalten sind da …
      for (const spalte of ["body_text", "classification_snapshot"]) {
        expect(nach.get(spalte), `${spalte} wurde nicht nachgerüstet`).toBeDefined();
        expect(nach.get(spalte)?.is_nullable).toBe("NO");
        // … und ihr Default behauptet nichts: der Leerwert, keine Einstufung, kein `verified`.
        expect(nach.get(spalte)?.column_default).toMatch(/^''::text$/);
      }
      // … und KEINE Spalte der Fassung 1 ist verschwunden.
      for (const spalte of ["category_text", "tag_text", "search_text", "content_hash"]) {
        expect(nach.get(spalte), `${spalte} der Fassung 1 fehlt`).toBeDefined();
      }
      // Der dritte Index (Arbeitsliste des Mischbestands) ist ebenfalls additiv dazugekommen.
      const indizes = await pool.query<{ indexname: string }>(
        "SELECT indexname FROM pg_indexes WHERE tablename = 'ko_search_projections'",
      );
      expect(indizes.rows.map((r) => r.indexname)).toContain("idx_ko_search_projections_pversion");

      // ---------------------------------------------------------------------------------------
      // 4) DIE BESTANDSZEILE IST UNVERSEHRT — UND WEITERHIN EINDEUTIG FASSUNG 1.
      //    Die Schemamigration hat sie nachgerüstet, nicht umgedeutet: kein Default macht sie zu
      //    einer vollständigen oder gar geprüften V2-Zeile.
      // ---------------------------------------------------------------------------------------
      const bestand = await pool.query<{
        projection_version: number;
        body_text: string;
        classification_snapshot: string;
        search_text: string;
        content_hash: string;
      }>(
        `SELECT projection_version, body_text, classification_snapshot, search_text, content_hash
           FROM ko_search_projections WHERE ko_id = $1`,
        [altesKo.id],
      );
      expect(bestand.rowCount).toBe(1);
      expect(bestand.rows[0]?.projection_version).toBe(1);
      expect(bestand.rows[0]?.body_text).toBe("");
      expect(bestand.rows[0]?.classification_snapshot).toBe("");
      expect(bestand.rows[0]?.content_hash).toBe("v1-hash");
      // Und die Lesart des Adapters ist fail-safe: keine Einstufung, keine bestätigte Geschichte.
      const gelesen = await projektionsRepo.find(altesKo.id, 1);
      expect(gelesen?.projectionVersion).toBe(1);
      expect(gelesen?.classificationSnapshot.value).toBe("none");
      expect(gelesen?.classificationSnapshot.historicalConfidence).toBe("unknown");

      // ---------------------------------------------------------------------------------------
      // 5) DER V2-INSERT GEHT JETZT DURCH — gegen dieselbe, nur additiv erweiterte Tabelle.
      // ---------------------------------------------------------------------------------------
      await new PgKoRepo(pool).insert(neuesKo);
      const v2Projektion = buildSearchProjection(neuesKo, "2026-08-02T10:00:00.000Z");
      expect(await projektionsRepo.insert(v2Projektion)).toBe(true);
      const zurueck = await projektionsRepo.find(neuesKo.id, 1);
      expect(zurueck?.projectionVersion).toBe(SEARCH_PROJECTION_VERSION);
      expect(zurueck?.bodyText).toBe(v2Projektion.bodyText);
      expect(zurueck?.contentHash).toBe(v2Projektion.contentHash);
      // Die vollständige Beleglage überlebt Schreiben und Lesen verlustfrei (Voraussetzung dafür,
      // dass der Hashschutz aus Abschnitt J an der Zeile überhaupt prüfbar ist).
      expect(zurueck?.classificationSnapshot).toEqual(v2Projektion.classificationSnapshot);

      // ---------------------------------------------------------------------------------------
      // 6) WIEDERHOLTE MIGRATION BLEIBT GRÜN UND VERÄNDERT NICHTS (Idempotenz, echt gemessen).
      // ---------------------------------------------------------------------------------------
      await expect(migrate(pool)).resolves.toBeUndefined();
      await expect(migrate(pool)).resolves.toBeUndefined();
      const nachWiederholung = await pool.query<{ projection_version: number; ko_id: string }>(
        "SELECT ko_id, projection_version FROM ko_search_projections ORDER BY ko_id",
      );
      expect(nachWiederholung.rows).toEqual([
        { ko_id: "v1-bestand", projection_version: 1 },
        { ko_id: "v2-neu", projection_version: SEARCH_PROJECTION_VERSION },
      ]);

      // ---------------------------------------------------------------------------------------
      // 7) ERST DER BENANNTE NACHZUG HEBT DIE V1-ZEILE — deterministisch und wiederholbar.
      // ---------------------------------------------------------------------------------------
      const dienst = new KoService({
        repo: new PgKoRepo(pool),
        searchProjections: projektionsRepo,
      });
      const bilanz = await dienst.backfillSearchProjections({ limit: 50 });
      expect(bilanz.v2Migriert).toBe(1);
      expect(bilanz.gescheitert).toBe(0);

      const nachzug = await projektionsRepo.find(altesKo.id, 1);
      expect(nachzug?.projectionVersion).toBe(SEARCH_PROJECTION_VERSION);
      // Der Dokumenttext ist jetzt wirklich in der neuen Spalte …
      expect(nachzug?.bodyText).toContain("ALTBESTANDSWORT");
      // … die Klassifizierung ist als Rekonstruktion gekennzeichnet, nie als bestätigt …
      expect(nachzug?.classificationSnapshot.provenance).toBe("reconstructed_from_current_ko");
      expect(nachzug?.classificationSnapshot.historicalConfidence).toBe("unknown");
      expect(nachzug?.classificationSnapshot.capturedAt).toBe(altesKo.createdAt);
      // … und `created_at` der Zeile blieb erhalten (neu abgeleitet, nicht neu geboren).
      expect(nachzug?.createdAt).toBe(altesKo.createdAt);

      // Zweiter Nachzug: nichts mehr zu tun. Dritter Weg (Rebuild): derselbe Hash.
      expect(await dienst.backfillSearchProjections({ limit: 50 })).toEqual({
        geprueft: 0,
        geschrieben: 0,
        v2Migriert: 0,
        gescheitert: 0,
      });
      await dienst.rebuildSearchProjections();
      expect((await projektionsRepo.find(altesKo.id, 1))?.contentHash).toBe(nachzug?.contentHash);
    } finally {
      await pool.end();
    }
  });

  // ============================================================================================
  // W1 S4 R2 — KLARA-SITZUNG, AUFLÖSUNG UND ZUSTIMMUNG GEGEN ECHTES POSTGRES (BEN ROT-2/3/4)
  // ============================================================================================
  //
  // WARUM DAS HIER STEHT UND NICHT IM DIENST-TEST. Drei der acht Sperrbefunde sind Zusagen, die
  // eine InMemory-Ablage NICHT belegen kann, weil sie gar keine Nebenläufigkeit und keine
  // Eindeutigkeitsregel kennt:
  //
  //   ROT-2 Die resolutionId muss den Prozess überleben und an die Versionen gebunden sein.
  //   ROT-3 Höchstens EINE gültige Zustimmung je Sitzung — und das muss die DATENBANK erzwingen,
  //         nicht der Anwendungscode. Ein Anwendungscheck verliert jedes Rennen.
  //   ROT-4 Ablauf und Sitzungsfenster liegen in Spalten, nicht in einem Prozessgedächtnis.
  //
  // Der Zeitteil ist bewusst NICHT hier: die Uhr lässt sich gegen einen Container nicht stellen.
  // Er steht in `klara-session-service.test.ts`; hier wird belegt, dass die SPALTEN existieren und
  // tragen. Diese Trennung ist die ehrliche Aufteilung, nicht eine Lücke.
  it("W1 S4 R2: Auflösung überlebt, und die DB erzwingt höchstens eine gültige Zustimmung", async () => {
    const url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk`;
    const pool = createPool(url);
    try {
      await migrate(pool);

      // --- ROT-2/ROT-4: die Spalten sind wirklich da -----------------------------------------
      const sitzungsSpalten = await pool.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'klara_sessions'`,
      );
      const namen = sitzungsSpalten.rows.map((r) => r.column_name);
      for (const spalte of [
        "session_id",
        "actor_id",
        "addin_instance_id",
        "document_context_id",
        "resolution_id",
        "consent_state",
        "created_at",
        "last_activity_at",
        "expires_at",
      ]) {
        expect(namen, `klara_sessions.${spalte} fehlt`).toContain(spalte);
      }
      const consentSpalten = await pool.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
          WHERE table_name = 'klara_session_consents'`,
      );
      expect(consentSpalten.rows.map((r) => r.column_name)).toContain("resolution_id");

      // --- ROT-2: die Auflösung überlebt Schreiben und Lesen ---------------------------------
      await pool.query(
        `INSERT INTO klara_sessions
           (session_id, tenant_id, actor_id, addin_instance_id, document_context_id,
            resolution_id, policy_version, configuration_version, consent_state,
            created_at, last_activity_at, expires_at)
         VALUES ('s-1','t-1','a-1','i-1','doc-s-1','res-1','pol-1','cfg-1','none',
                 '2026-08-02T10:00:00.000Z','2026-08-02T10:00:00.000Z','2026-08-02T10:15:00.000Z')`,
      );
      const gelesen = await pool.query<{
        resolution_id: string;
        expires_at: string;
        last_activity_at: string;
      }>(
        `SELECT resolution_id, expires_at, last_activity_at
           FROM klara_sessions WHERE session_id = 's-1'`,
      );
      expect(gelesen.rows[0]?.resolution_id).toBe("res-1");
      // ROT-4: das Sitzungsfenster liegt in Spalten, nicht in einem Prozessgedächtnis — und es
      // ist gleitend, also muss `last_activity_at` getrennt von `created_at` fortschreibbar sein.
      expect(gelesen.rows[0]?.expires_at).toBe("2026-08-02T10:15:00.000Z");
      await pool.query(
        `UPDATE klara_sessions SET last_activity_at = '2026-08-02T10:05:00.000Z',
           expires_at = '2026-08-02T10:20:00.000Z' WHERE session_id = 's-1'`,
      );
      const geschoben = await pool.query<{ expires_at: string }>(
        "SELECT expires_at FROM klara_sessions WHERE session_id = 's-1'",
      );
      expect(geschoben.rows[0]?.expires_at).toBe("2026-08-02T10:20:00.000Z");

      // --- ROT-3: die EINDEUTIGKEIT liegt in der Datenbank -----------------------------------
      // Der entscheidende Nachweis. Zwei gültige Zustimmungen zur selben Sitzung sind strukturell
      // unmöglich — auch dann, wenn zwei Anfragen gleichzeitig kämen und beide „keine vorhanden"
      // gelesen hätten. Genau dieses Rennen konnte ein Anwendungscheck nicht schliessen.
      const consent = (id: string, status: string) =>
        pool.query(
          `INSERT INTO klara_session_consents
             (consent_id, session_id, tenant_id, actor_id, document_context_id, consent_scope,
              allowed_payload_classes, provider_class, provider_binding_id, model_reference,
              policy_version, configuration_version, granted_at, expires_at, status, resolution_id)
           VALUES ($1,'s-1','t-1','a-1','doc-s-1','session','question','external','b-1','m-1',
                   'pol-1','cfg-1','2026-08-02T10:00:00.000Z','2026-08-02T10:15:00.000Z',$2,'res-1')`,
          [id, status],
        );
      await consent("c-1", "granted");
      await expect(consent("c-2", "granted")).rejects.toThrow(/unique|duplicate/i);

      // Die Gegenprobe, ohne die der Index auch „gar nichts geht" bedeuten könnte: entwertete
      // Zustimmungen dürfen beliebig viele nebeneinander stehen — der Index ist PARTIELL.
      await expect(consent("c-3", "revoked")).resolves.toBeDefined();
      await expect(consent("c-4", "revoked")).resolves.toBeDefined();

      // Und nach dem Entwerten der gültigen darf wieder genau eine gültige entstehen.
      await pool.query(
        "UPDATE klara_session_consents SET status='invalidated' WHERE consent_id='c-1'",
      );
      await expect(consent("c-5", "granted")).resolves.toBeDefined();
      const gueltige = await pool.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM klara_session_consents WHERE session_id='s-1' AND status='granted'",
      );
      expect(gueltige.rows[0]?.n).toBe("1");
    } finally {
      await pool.end();
    }
  });

  // ============================================================================================
  // W1 S4 R3 — DER DOKUMENT-REBIND GEGEN ECHTES POSTGRES (BEN-BERICHT 17, ROT-1)
  // ============================================================================================
  //
  // WARUM DIESER FALL NÖTIG WURDE. Der Rebind war in R2 über den Dienst belegt — aber
  // ausschliesslich gegen `InMemoryKlaraSessionRepo`, dessen `updateSession()` die VOLLSTÄNDIGE
  // Struktur ersetzt und deshalb jedes Feld mitschreibt, auch eines, das der SQL-Adapter gar nicht
  // kennt. Der produktive Adapter listete `document_context_id` nicht in seiner SET-Liste; die
  // Sitzung behielt in PostgreSQL die ALTE Dokumentbindung, während der Server dem Client eine neue
  // bestätigte. BEN hat genau das reproduziert (Bericht 17, Abschnitt 2).
  //
  // Ein Spalten- oder SQL-Textvergleich hätte den Befund NICHT gefunden: das SQL war gültig, die
  // Spalte existierte, die Migration war grün. Nur der Weg über den ECHTEN Adapter — schreiben,
  // Verbindung wechseln, wieder lesen — macht den Unterschied zwischen „zurückgegeben" und
  // „persistiert" sichtbar. Deshalb steht der Fall hier und nicht im Dienst-Test.
  //
  // Die Uhr ist gestellt, aber das prüft hier NICHTS: sie macht den Lauf nur unabhängig von der
  // Wanduhr des Containers. Die Fristenprüfung bleibt wie gehabt im Dienst-Test.
  it("W1 S4 R3: der Dokument-Rebind wird in PostgreSQL wirklich persistiert (BEN ROT-1)", async () => {
    const url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk`;
    const pool = createPool(url);
    // Der zweite Pool ist der eigentliche Beweisträger von Kriterium 6: eigene Verbindungen, eigenes
    // Repo, eigener Dienst — nichts kann aus dem Prozessgedächtnis des ersten Wegs stammen.
    const zweiterPool = createPool(url);
    try {
      await migrate(pool);

      const jetzt = Date.parse("2026-08-02T11:00:00.000Z");
      // Eine Instanz, deren effektive Answer-Bindung wirklich extern ist — nur dann ist überhaupt
      // eine Zustimmung möglich, und nur dann lässt sich zeigen, dass der Rebind sie entwertet.
      const quelle: KlaraPolicyQuelle = {
        choice: "cloud",
        source: "default",
        effectiveAnswerProvider: "cloud",
        cloudConfigured: true,
        localConfigured: false,
        providerLabel: "Cloud-Anbieter",
        modelLabel: "cloud-modell",
        localProviderLabel: "Lokaler Anbieter",
      };
      let zaehler = 0;
      const dienstMit = (repo: PgKlaraSessionRepo) =>
        new KlaraSessionService({
          repo,
          policy: () => quelle,
          now: () => jetzt,
          newId: () => `r3-${++zaehler}`,
        });
      const dienst = dienstMit(new PgKlaraSessionRepo(pool));

      // --- Ausgangslage: Sitzung auf einem TEMPORÄREN Kontext, mit erteilter Zustimmung ---------
      const start = await dienst.createSession("anna", "instanz-1", {
        kind: "unsaved",
        clientDocumentNonce: "nonce-r3",
      });
      const alteBindung = {
        actorId: "anna",
        addinInstanceId: "instanz-1",
        documentContextId: start.documentContextId,
      };
      expect(start.documentContextId).toMatch(/^doc-t-/);
      const mitConsent = await dienst.grantConsent(start.sessionId, alteBindung);
      expect(mitConsent.consentState).toBe("granted");

      // --- Der Rebind: dasselbe Dokument wird gespeichert, also ist es ein ANDERER Kontext ------
      const nach = await dienst.rebindDocumentContext(start.sessionId, alteBindung, {
        kind: "saved",
        hostDocumentId: "r3-jetzt-gespeichert",
      });
      const neueBindung = { ...alteBindung, documentContextId: nach.documentContextId };
      expect(nach.documentContextId).toMatch(/^doc-s-/);
      expect(nach.documentContextId).not.toBe(start.documentContextId);
      expect(nach.resolution.resolutionId).not.toBe(start.resolution.resolutionId);

      // --- KRITERIUM 1: die Zeile in PostgreSQL trägt die NEUE Bindung ---------------------------
      // Der direkte Blick in die Spalte. Genau hier stand vor der Korrektur noch `doc-t-…`, also
      // die Kennung, die der Server soeben für ungültig erklärt hatte.
      const zeile = await pool.query<{ document_context_id: string; resolution_id: string | null }>(
        "SELECT document_context_id, resolution_id FROM klara_sessions WHERE session_id=$1",
        [start.sessionId],
      );
      expect(zeile.rows[0]?.document_context_id).toBe(nach.documentContextId);
      expect(zeile.rows[0]?.resolution_id).toBe(nach.resolution.resolutionId);

      // --- KRITERIUM 6: neue Kennung und neue Resolution überleben Repo- UND Dienstwechsel -------
      const zweiterDienst = dienstMit(new PgKlaraSessionRepo(zweiterPool));
      const wiedergelesen = await zweiterDienst.getSession(start.sessionId, neueBindung);
      expect(wiedergelesen.documentContextId).toBe(nach.documentContextId);
      expect(wiedergelesen.resolution.resolutionId).toBe(nach.resolution.resolutionId);

      // --- KRITERIUM 4: die ALTE Kennung endet in derselben generischen Klasse -------------------
      // „Generisch" heisst: ununterscheidbar von einer Sitzung, die es nie gab. Ein eigener Text
      // („falsches Dokument") wäre bereits eine Existenzauskunft.
      const alt = await zweiterDienst
        .getSession(start.sessionId, alteBindung)
        .then(() => null)
        .catch((e: { code?: string; message?: string }) => e);
      const nieDagewesen = await zweiterDienst
        .getSession("gibt-es-nicht", neueBindung)
        .then(() => null)
        .catch((e: { code?: string; message?: string }) => e);
      expect(alt?.code).toBe("NOT_FOUND");
      expect(nieDagewesen?.code).toBe("NOT_FOUND");
      expect(alt?.message).toBe(nieDagewesen?.message);

      // --- KRITERIUM 5: kein Zustand wandert in den neuen Dokumentkontext -----------------------
      // Die Zustimmung ist entwertet, und zwar in der Datenbank: keine einzige `granted`-Zeile
      // bleibt übrig. Die Historie bleibt stehen — sie trägt den ALTEN Kontext und belegt damit,
      // dass für den neuen nie eine Zustimmung bestand.
      const consents = await new PgKlaraSessionRepo(zweiterPool).alleConsents(start.sessionId);
      expect(consents).toHaveLength(1);
      expect(consents[0]?.status).toBe("invalidated");
      expect(consents[0]?.documentContextId).toBe(start.documentContextId);
      const gueltigeNachRebind = await pool.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM klara_session_consents WHERE session_id=$1 AND status='granted'",
        [start.sessionId],
      );
      expect(gueltigeNachRebind.rows[0]?.n).toBe("0");
      expect(wiedergelesen.consentState).toBe("invalidated");
    } finally {
      await zweiterPool.end();
      await pool.end();
    }
  });
  // ============================================================================================
  // W1 S4 R4 (KW-S4-21 §8) — DIE ACHT PFLICHT-RACES GEGEN ECHTES POSTGRESQL
  // ============================================================================================
  //
  // WARUM SIE HIER STEHEN UND NICHT IM DIENST-TEST. R3 kam durch alle Tore, weil die einzige
  // Nebenlaeufigkeitsprobe gegen eine In-Memory-Ablage lief, die einen Lost Update gar nicht
  // zeigen KANN. Diese acht Faelle fahren denselben produktiven Adapter, den die Auslieferung
  // benutzt, gegen einen echten Server — mit zwei Verbindungen, zwei Repos und zwei Diensten.
  //
  // DER TAKT IST DETERMINISTISCH UND OHNE `sleep`. `HaltRepo` haelt GENAU EINEN benannten
  // Uebergang unmittelbar vor seinem Schreibvorgang an; freigegeben wird er erst, wenn der
  // konkurrierende Uebergang vollstaendig committet ist. Das ist BENs Reihenfolge, nur
  // verallgemeinert auf alle sieben Uebergaenge.
  describe("W1 S4 R4 · KW-S4-21 §8 · Pflicht-Races gegen echtes PostgreSQL", () => {
    type UebergangName =
      | "touchSession"
      | "rebindSession"
      | "grantConsent"
      | "revokeConsent"
      | "closeSession"
      | "invalidateSession"
      | "refreshResolution";

    class HaltRepo extends PgKlaraSessionRepo {
      private ziel: UebergangName | undefined;
      private erreichtSignal: (() => void) | undefined;
      private weiter: Promise<void> | undefined;
      private freigabe: (() => void) | undefined;

      haltAn(ziel: UebergangName): { erreicht: Promise<void>; freigeben: () => void } {
        this.ziel = ziel;
        const erreicht = new Promise<void>((res) => {
          this.erreichtSignal = res;
        });
        this.weiter = new Promise<void>((res) => {
          this.freigabe = res;
        });
        return { erreicht, freigeben: () => this.freigabe?.() };
      }

      private async vielleicht(name: UebergangName): Promise<void> {
        if (this.ziel === name) {
          this.ziel = undefined;
          this.erreichtSignal?.();
          await this.weiter;
        }
      }

      override async touchSession(
        ...a: Parameters<PgKlaraSessionRepo["touchSession"]>
      ): Promise<boolean> {
        await this.vielleicht("touchSession");
        return super.touchSession(...a);
      }

      override async rebindSession(
        ...a: Parameters<PgKlaraSessionRepo["rebindSession"]>
      ): Promise<boolean> {
        await this.vielleicht("rebindSession");
        return super.rebindSession(...a);
      }

      override async grantConsent(
        ...a: Parameters<PgKlaraSessionRepo["grantConsent"]>
      ): Promise<boolean> {
        await this.vielleicht("grantConsent");
        return super.grantConsent(...a);
      }

      override async revokeConsent(
        ...a: Parameters<PgKlaraSessionRepo["revokeConsent"]>
      ): Promise<boolean> {
        await this.vielleicht("revokeConsent");
        return super.revokeConsent(...a);
      }

      override async closeSession(
        ...a: Parameters<PgKlaraSessionRepo["closeSession"]>
      ): Promise<boolean> {
        await this.vielleicht("closeSession");
        return super.closeSession(...a);
      }

      override async invalidateSession(
        ...a: Parameters<PgKlaraSessionRepo["invalidateSession"]>
      ): Promise<boolean> {
        await this.vielleicht("invalidateSession");
        return super.invalidateSession(...a);
      }

      override async refreshResolution(
        ...a: Parameters<PgKlaraSessionRepo["refreshResolution"]>
      ): Promise<boolean> {
        await this.vielleicht("refreshResolution");
        return super.refreshResolution(...a);
      }
    }

    const CLOUD: KlaraPolicyQuelle = {
      choice: "cloud",
      source: "default",
      effectiveAnswerProvider: "cloud",
      cloudConfigured: true,
      localConfigured: false,
      providerLabel: "Cloud-Anbieter",
      modelLabel: "cloud-modell",
      localProviderLabel: "Lokaler Anbieter",
    };

    /**
     * Eine Uhr, die MEHRERE Dienste teilen koennen. In der Auslieferung lesen alle Instanzen
     * dieselbe Wanduhr; ein Test, der zwei Diensten zwei verschiedene Zeiten gibt, prueft eine
     * Lage, die es nicht gibt. Wo der Ablauf Teil des Rennens ist, wird die Uhr deshalb geteilt.
     */
    function neueUhr(): { jetzt: number } {
      return { jetzt: Date.parse("2026-08-02T12:00:00.000Z") };
    }

    /** Ein Dienst mit gestellter Uhr und benannten Kennungen — beides nur fuer Determinismus. */
    function dienstMit(repo: PgKlaraSessionRepo, praefix: string, uhr = neueUhr()) {
      let zaehler = 0;
      let quelle: KlaraPolicyQuelle = { ...CLOUD };
      return {
        dienst: new KlaraSessionService({
          repo,
          policy: () => quelle,
          now: () => uhr.jetzt,
          newId: () => `${praefix}-${++zaehler}`,
        }),
        vorspulen: (ms: number) => {
          uhr.jetzt += ms;
        },
        umkonfigurieren: (next: Partial<KlaraPolicyQuelle>) => {
          quelle = { ...quelle, ...next };
        },
      };
    }

    function url(): string {
      return `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk`;
    }

    /** Sitzung auf temporaerem Kontext, wahlweise mit erteilter Zustimmung. */
    async function aufsetzen(
      dienst: KlaraSessionService,
      nonce: string,
      mitConsent: boolean,
    ): Promise<{ sessionId: string; bindung: KlaraBindung; documentContextId: string }> {
      const s = await dienst.createSession("anna", "instanz-1", {
        kind: "unsaved",
        clientDocumentNonce: nonce,
      });
      const bindung = {
        actorId: "anna",
        addinInstanceId: "instanz-1",
        documentContextId: s.documentContextId,
      };
      if (mitConsent) {
        await dienst.grantConsent(s.sessionId, bindung);
      }
      return { sessionId: s.sessionId, bindung, documentContextId: s.documentContextId };
    }

    async function zeile(
      pool: ReturnType<typeof createPool>,
      sessionId: string,
    ): Promise<{
      document_context_id: string;
      resolution_id: string | null;
      consent_state: string;
      closed_at: string | null;
      expires_at: string;
      session_revision: string;
    }> {
      const res = await pool.query(
        `SELECT document_context_id, resolution_id, consent_state, closed_at, expires_at,
                session_revision::text AS session_revision
           FROM klara_sessions WHERE session_id=$1`,
        [sessionId],
      );
      return res.rows[0];
    }

    async function grantedZeilen(
      pool: ReturnType<typeof createPool>,
      sessionId: string,
    ): Promise<number> {
      const res = await pool.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM klara_session_consents WHERE session_id=$1 AND status='granted'",
        [sessionId],
      );
      return Number(res.rows[0]?.n ?? "-1");
    }

    async function mitPools(
      lauf: (
        pool: ReturnType<typeof createPool>,
        repoA: HaltRepo,
        repoB: PgKlaraSessionRepo,
      ) => Promise<void>,
    ): Promise<void> {
      const pool = createPool(url());
      const poolA = createPool(url());
      const poolB = createPool(url());
      try {
        await migrate(pool);
        await lauf(pool, new HaltRepo(poolA), new PgKlaraSessionRepo(poolB));
      } finally {
        await poolA.end();
        await poolB.end();
        await pool.end();
      }
    }

    it("Race 1 · Touch gegen Rebind: alte Bindung, Resolution und Consent kehren nie zurueck", async () => {
      await mitPools(async (pool, repoA, repoB) => {
        const a = dienstMit(repoA, "r1a");
        const b = dienstMit(repoB, "r1b");
        const { sessionId, bindung, documentContextId } = await aufsetzen(b.dienst, "r1", true);

        const halt = repoA.haltAn("touchSession");
        const laufendA = a.dienst.getSession(sessionId, bindung);
        await halt.erreicht;

        const nach = await b.dienst.rebindDocumentContext(sessionId, bindung, {
          kind: "saved",
          hostDocumentId: "r4-race1",
        });
        halt.freigeben();

        // Der ueberholte Request antwortet NICHT aus seinem veralteten Stand: seine Bindung traegt
        // nicht mehr, und das ist dieselbe generische Klasse wie eine nie vorhandene Sitzung.
        await expect(laufendA).rejects.toMatchObject({ code: "NOT_FOUND" });

        const z = await zeile(pool, sessionId);
        expect(z.document_context_id).toBe(nach.documentContextId);
        expect(z.resolution_id).toBe(nach.resolution.resolutionId);
        expect(z.consent_state).toBe("invalidated");
        expect(z.document_context_id).not.toBe(documentContextId);
        expect(await grantedZeilen(pool, sessionId)).toBe(0);

        // Die neue Bindung traegt, die alte endet generisch — beides ueber einen frischen Dienst.
        const c = dienstMit(new PgKlaraSessionRepo(pool), "r1c");
        const neueBindung = { ...bindung, documentContextId: nach.documentContextId };
        expect((await c.dienst.getSession(sessionId, neueBindung)).documentContextId).toBe(
          nach.documentContextId,
        );
        const alt = await c.dienst.getSession(sessionId, bindung).catch((e) => e);
        const nie = await c.dienst.getSession("gibt-es-nicht", neueBindung).catch((e) => e);
        expect(alt.code).toBe("NOT_FOUND");
        expect(alt.message).toBe(nie.message);
      });
    });

    it("Race 2 · Grant gegen Rebind: der Grant verliert; kein uebertragener Consent", async () => {
      await mitPools(async (pool, repoA, repoB) => {
        const a = dienstMit(repoA, "r2a");
        const b = dienstMit(repoB, "r2b");
        const { sessionId, bindung } = await aufsetzen(b.dienst, "r2", false);

        const halt = repoA.haltAn("grantConsent");
        const laufendA = a.dienst.grantConsent(sessionId, bindung);
        await halt.erreicht;

        const nach = await b.dienst.rebindDocumentContext(sessionId, bindung, {
          kind: "saved",
          hostDocumentId: "r4-race2",
        });
        halt.freigeben();

        await expect(laufendA).rejects.toMatchObject({
          code: "CONFLICT",
          internalCode: "KLARA_SESSION_CONFLICT",
        });

        const z = await zeile(pool, sessionId);
        expect(z.document_context_id).toBe(nach.documentContextId);
        expect(z.consent_state).not.toBe("granted");
        // Der neue Dokumentkontext hat NIE eine Zustimmung getragen.
        expect(await grantedZeilen(pool, sessionId)).toBe(0);
        const alle = await new PgKlaraSessionRepo(pool).alleConsents(sessionId);
        for (const c of alle) {
          expect(c.documentContextId).not.toBe(nach.documentContextId);
        }
      });
    });

    it("Race 3 · Revoke gegen Grant: genau einer gewinnt, der Verlierer erhaelt Konflikt", async () => {
      await mitPools(async (pool, repoA, repoB) => {
        const a = dienstMit(repoA, "r3a");
        const b = dienstMit(repoB, "r3b");
        const { sessionId, bindung } = await aufsetzen(b.dienst, "r3", true);

        const halt = repoA.haltAn("grantConsent");
        const laufendA = a.dienst.grantConsent(sessionId, bindung);
        await halt.erreicht;

        await b.dienst.revokeConsent(sessionId, bindung);
        halt.freigeben();

        await expect(laufendA).rejects.toMatchObject({
          code: "CONFLICT",
          internalCode: "KLARA_SESSION_CONFLICT",
        });
        const z = await zeile(pool, sessionId);
        expect(z.consent_state).toBe("revoked");
        expect(await grantedZeilen(pool, sessionId)).toBe(0);
      });
    });

    it("Race 4 · Close gegen Touch: die geschlossene Sitzung wird nie verlaengert", async () => {
      await mitPools(async (pool, repoA, repoB) => {
        const a = dienstMit(repoA, "r4a");
        const b = dienstMit(repoB, "r4b");
        const { sessionId, bindung } = await aufsetzen(b.dienst, "r4", false);
        const vorher = await zeile(pool, sessionId);

        const halt = repoA.haltAn("touchSession");
        // Die Uhr von A steht spaeter: sein Touch WUERDE die Frist verlaengern, wenn er durchkaeme.
        a.vorspulen(60_000);
        const laufendA = a.dienst.getSession(sessionId, bindung);
        await halt.erreicht;

        await b.dienst.closeSession(sessionId, bindung);
        halt.freigeben();

        await expect(laufendA).rejects.toMatchObject({ code: "CONFLICT" });
        const z = await zeile(pool, sessionId);
        expect(z.closed_at).not.toBeNull();
        expect(z.expires_at).toBe(vorher.expires_at);
      });
    });

    it("Race 5 · Ablauf/Invalidierung gegen Refresh: ein alter Refresh weckt nichts wieder", async () => {
      await mitPools(async (pool, repoA, repoB) => {
        // GETEILTE Uhr: der Ablauf ist Teil dieses Rennens, und beide Instanzen lesen in der
        // Auslieferung dieselbe Zeit.
        const uhr = neueUhr();
        const a = dienstMit(repoA, "r5a", uhr);
        const b = dienstMit(repoB, "r5b", uhr);
        const { sessionId, bindung } = await aufsetzen(b.dienst, "r5", true);
        const vorher = await zeile(pool, sessionId);

        // A soll refreshen (Policywechsel) — und wird dabei angehalten.
        a.umkonfigurieren({ source: "db" });
        const halt = repoA.haltAn("refreshResolution");
        const laufendA = a.dienst.getSession(sessionId, bindung);
        await halt.erreicht;

        // B laeuft in den Ablauf und entwertet die Zustimmung.
        b.vorspulen(KLARA_SESSION_INACTIVITY_MS + 1);
        await expect(b.dienst.getSession(sessionId, bindung)).rejects.toMatchObject({
          code: "CONFLICT",
        });
        halt.freigeben();

        await expect(laufendA).rejects.toMatchObject({ code: "CONFLICT" });
        const z = await zeile(pool, sessionId);
        expect(z.consent_state).toBe("expired");
        expect(z.resolution_id).toBe(vorher.resolution_id);
        expect(await grantedZeilen(pool, sessionId)).toBe(0);
      });
    });

    it("Race 6 · Policy-Refresh gegen Rebind: die neue Bindung wird nie ueberschrieben", async () => {
      await mitPools(async (pool, repoA, repoB) => {
        const a = dienstMit(repoA, "r6a");
        const b = dienstMit(repoB, "r6b");
        const { sessionId, bindung, documentContextId } = await aufsetzen(b.dienst, "r6", true);

        a.umkonfigurieren({ source: "db" });
        const halt = repoA.haltAn("refreshResolution");
        const laufendA = a.dienst.getSession(sessionId, bindung);
        await halt.erreicht;

        const nach = await b.dienst.rebindDocumentContext(sessionId, bindung, {
          kind: "saved",
          hostDocumentId: "r4-race6",
        });
        halt.freigeben();
        await laufendA.catch(() => undefined);

        const z = await zeile(pool, sessionId);
        // DAS ist die Zusage: die Bindung des Rebinds steht, der ueberholte Refresh hat sie nicht
        // angefasst — und die entwertete Zustimmung ist nicht wieder aufgelebt.
        expect(z.document_context_id).toBe(nach.documentContextId);
        expect(z.document_context_id).not.toBe(documentContextId);
        expect(z.consent_state).toBe("invalidated");
        expect(await grantedZeilen(pool, sessionId)).toBe(0);
      });
    });

    it("Race 7 · CAS-Verlust: generischer Konflikt ohne Existenz-, Bindungs- oder Zustandsleck", async () => {
      await mitPools(async (pool, repoA, repoB) => {
        const a = dienstMit(repoA, "r7a");
        const b = dienstMit(repoB, "r7b");
        const { sessionId, bindung } = await aufsetzen(b.dienst, "r7", true);
        const vorher = await zeile(pool, sessionId);

        const halt = repoA.haltAn("grantConsent");
        const laufendA = a.dienst.grantConsent(sessionId, bindung);
        await halt.erreicht;
        await b.dienst.revokeConsent(sessionId, bindung);
        halt.freigeben();

        const fehler = (await laufendA.then(
          () => undefined,
          (e: { code: string; message: string; internalCode?: string }) => e,
        )) as { code: string; message: string; internalCode?: string };

        // Nach aussen: der eine generische Konflikt (HTTP 409 ueber die vorhandene Abbildung).
        expect(fehler.code).toBe("CONFLICT");
        expect(fehler.message).toBe(KLARA_SESSION_CONFLICT_MESSAGE);
        // Nach innen unterscheidbar — dieser Wert wird nie serialisiert.
        expect(fehler.internalCode).toBe("KLARA_SESSION_CONFLICT");
        // Kein Leck: weder Kennungen noch Zustaende stehen in der Meldung.
        for (const geheim of [
          sessionId,
          bindung.actorId,
          bindung.addinInstanceId,
          bindung.documentContextId,
          vorher.resolution_id ?? "-",
        ]) {
          expect(fehler.message).not.toContain(geheim);
        }
        for (const wort of ["geschlossen", "abgelaufen", "Dokument", "Resolution", "Actor"]) {
          expect(fehler.message).not.toContain(wort);
        }
      });
    });

    it("Race 8 · Rebind-Atomaritaet: EIN Revisionsschritt, nie eine Mischbindung", async () => {
      await mitPools(async (pool, _repoA, repoB) => {
        const b = dienstMit(repoB, "r8b");
        const { sessionId, bindung, documentContextId } = await aufsetzen(b.dienst, "r8", true);
        const vorher = await zeile(pool, sessionId);

        const nach = await b.dienst.rebindDocumentContext(sessionId, bindung, {
          kind: "saved",
          hostDocumentId: "r4-race8",
        });
        const z = await zeile(pool, sessionId);

        // GENAU EIN Schritt. Der Zweischritt aus R3 (erst `resolution_id = null`, danach die neue)
        // haette zwei erzeugt — und dazwischen eine aktive Sitzung ohne Resolution hinterlassen.
        expect(Number(z.session_revision)).toBe(Number(vorher.session_revision) + 1);
        expect(z.resolution_id).not.toBeNull();
        expect(z.resolution_id).toBe(nach.resolution.resolutionId);
        expect(z.resolution_id).not.toBe(vorher.resolution_id);
        expect(z.document_context_id).toBe(nach.documentContextId);
        expect(z.document_context_id).not.toBe(documentContextId);
        expect(z.consent_state).toBe("invalidated");
        // Die Historie bleibt am ALTEN Kontext — nichts wurde uebertragen.
        const alle = await new PgKlaraSessionRepo(pool).alleConsents(sessionId);
        expect(alle).toHaveLength(1);
        expect(alle[0]?.status).toBe("invalidated");
        expect(alle[0]?.documentContextId).toBe(documentContextId);
      });
    });

    // ==========================================================================================
    // W1 S4 R5 (KW-S4-21 §5, BEN-Bericht 24) — DIE ANTWORT GEHOERT ZUSAMMEN
    // ==========================================================================================
    //
    // Die acht Races oben pruefen die SCHREIBSEITE: kein veralteter Write rollt eine neuere
    // Bindung zurueck. BEN hat in Freeze 23 gezeigt, dass die LESESEITE davon unberuehrt blieb —
    // ein Statusabruf mit verlorenem Touch baute seine Antwort weiterhin mit dem Consentstand von
    // VOR dem Rennen. Diese zwei Faelle schliessen genau diese Luecke, mit derselben Haltestelle
    // (`touchSession`) und demselben deterministischen Takt.
    it("Race 9 · Status gegen Revoke: Response und Persistenz beide `revoked`", async () => {
      await mitPools(async (pool, repoA, repoB) => {
        const a = dienstMit(repoA, "r9a");
        const b = dienstMit(repoB, "r9b");
        const { sessionId, bindung } = await aufsetzen(b.dienst, "r9", true);

        const halt = repoA.haltAn("touchSession");
        const statusP = a.dienst.getSession(sessionId, bindung);
        await halt.erreicht;

        await b.dienst.revokeConsent(sessionId, bindung);
        halt.freigeben();

        const status = await statusP;
        // BENs gemessener Widerspruch war: consentState `revoked` UND
        // externalConsentGranted `true` im SELBEN Antwortobjekt.
        expect(status.consentState).toBe("revoked");
        expect(status.resolution.externalConsentGranted).toBe(false);

        const z = await zeile(pool, sessionId);
        expect(z.consent_state).toBe("revoked");
        expect(await grantedZeilen(pool, sessionId)).toBe(0);
        // Antwort und Bestand stammen aus DEMSELBEN Stand.
        expect(status.resolution.resolutionId).toBe(z.resolution_id);
      });
    });

    it("Race 10 · Status gegen Grant: kein vor dem CAS-Verlust gelesener Consentstand", async () => {
      await mitPools(async (pool, repoA, repoB) => {
        const a = dienstMit(repoA, "r10a");
        const b = dienstMit(repoB, "r10b");
        // Ausgangslage BEWUSST ohne Zustimmung: der veraltete Stand waere „keine Zustimmung".
        const { sessionId, bindung } = await aufsetzen(b.dienst, "r10", false);

        const halt = repoA.haltAn("touchSession");
        const statusP = a.dienst.getSession(sessionId, bindung);
        await halt.erreicht;

        await b.dienst.grantConsent(sessionId, bindung);
        halt.freigeben();

        const status = await statusP;
        expect(status.consentState).toBe("granted");
        expect(status.resolution.externalConsentGranted).toBe(true);

        const z = await zeile(pool, sessionId);
        expect(z.consent_state).toBe("granted");
        expect(await grantedZeilen(pool, sessionId)).toBe(1);
        expect(status.resolution.resolutionId).toBe(z.resolution_id);
      });
    });

    // ==========================================================================================
    // W1 S4 R5 — DAS CAS SELBST, UNMASKIERBAR
    // ==========================================================================================
    //
    // WARUM DIESER FALL NÖTIG WURDE, und zwar durch die R5-Korrektur selbst: die neue
    // Antwortprüfung in `getSession` fängt einen Teil derselben Fehlbedienungen ab wie das CAS.
    // In der CAS-Mutationsprobe hat das messbar zwei der sechs zuvor roten Races (1 und 7) grün
    // werden lassen — nicht weil das CAS schwächer wäre, sondern weil eine zweite, unabhängige
    // Sicherung davorsteht. Genau das darf die Evidenz für die ERSTE Sicherung nicht verwässern.
    //
    // Dieser Fall ruft die produktiven Übergänge DIREKT, ohne Dienst und ohne Antwortweg. Keine
    // spätere Prüfschicht kann ihn maskieren: er misst ausschliesslich, ob ein Schreibvorgang mit
    // veralteter Revision null Zeilen trifft und die Zeile unangetastet lässt.
    it("Race 11 · das CAS weist jede veraltete Revision ab (ohne Dienst, unmaskierbar)", async () => {
      const pool = createPool(url());
      try {
        await migrate(pool);
        const repo = new PgKlaraSessionRepo(pool);
        const b = dienstMit(repo, "r11");
        const { sessionId } = await aufsetzen(b.dienst, "r11", true);

        const stand = await repo.findSession(sessionId);
        if (!stand) {
          throw new Error("Sitzung fehlt");
        }
        const veraltet = stand.revision - 1;
        const vorher = await zeile(pool, sessionId);

        // W1 S4 R6A (BEN-Bericht 30, Befund B): hier stand „Alle sieben Übergänge" — aufgerufen
        // wurden aber nur sechs, `grantConsent` fehlte. Der Kommentar behauptete damit mehr als der
        // Code prüfte. Jetzt sind es wirklich sieben; die Zusage und der Test decken sich.
        //
        // Der veraltete Grant braucht einen vollständigen Consent-Datensatz — er soll ja am CAS
        // scheitern und nicht schon an einem unvollständigen Rumpf.
        const veralteterConsent = {
          consentId: "c-r11-veraltet",
          sessionId,
          tenantId: KLARA_SINGLE_TENANT_ID,
          actorId: "anna",
          documentContextId: stand.documentContextId,
          consentScope: "session",
          allowedPayloadClasses: ["question"],
          providerClass: "external",
          providerBindingId: "b-veraltet",
          modelReference: "m-veraltet",
          providerReference: "p-veraltet",
          policyVersion: stand.policyVersion,
          configurationVersion: stand.configurationVersion,
          grantedAt: "2099-01-01T00:00:00.000Z",
          expiresAt: "2099-01-01T00:15:00.000Z",
          revokedAt: null,
          status: "granted" as const,
          resolutionId: stand.resolutionId,
        };

        // Alle sieben Übergänge, jeder mit einer um eins zu alten Revision. Keiner darf greifen.
        expect(
          await repo.touchSession(
            sessionId,
            veraltet,
            "2099-01-01T00:00:00.000Z",
            "2099-01-01T00:15:00.000Z",
          ),
        ).toBe(false);
        expect(await repo.grantConsent(sessionId, veraltet, veralteterConsent)).toBe(false);
        expect(
          await repo.rebindSession(sessionId, veraltet, {
            documentContextId: "doc-s-veraltet",
            resolutionId: "res-veraltet",
            policyVersion: "pol-veraltet",
            configurationVersion: "cfg-veraltet",
            lastActivityAt: "2099-01-01T00:00:00.000Z",
            expiresAt: "2099-01-01T00:15:00.000Z",
            consentState: "invalidated",
            revokedAt: "2099-01-01T00:00:00.000Z",
          }),
        ).toBe(false);
        expect(
          await repo.revokeConsent(sessionId, veraltet, {
            lastActivityAt: "2099-01-01T00:00:00.000Z",
            expiresAt: "2099-01-01T00:15:00.000Z",
            revokedAt: "2099-01-01T00:00:00.000Z",
          }),
        ).toBe(false);
        expect(
          await repo.closeSession(sessionId, veraltet, {
            closedAt: "2099-01-01T00:00:00.000Z",
            lastActivityAt: "2099-01-01T00:00:00.000Z",
          }),
        ).toBe(false);
        expect(
          await repo.invalidateSession(sessionId, veraltet, {
            consentState: "expired",
            revokedAt: "2099-01-01T00:00:00.000Z",
          }),
        ).toBe(false);
        expect(
          await repo.refreshResolution(sessionId, veraltet, {
            resolutionId: "res-veraltet",
            policyVersion: "pol-veraltet",
            configurationVersion: "cfg-veraltet",
          }),
        ).toBe(false);

        // Die Zeile ist bitgleich geblieben — kein Feld, keine Revision hat sich bewegt.
        const nachher = await zeile(pool, sessionId);
        expect(nachher).toEqual(vorher);
        expect(await grantedZeilen(pool, sessionId)).toBe(1);
        // R6A: der abgewiesene Grant hat auch auf der Consent-Seite NICHTS hinterlassen — weder
        // eine zweite Zeile noch eine Entwertung der bestehenden. Die Transaktion rollte ganz zurück.
        const consentsNachAbweisung = await repo.alleConsents(sessionId);
        expect(consentsNachAbweisung).toHaveLength(1);
        expect(consentsNachAbweisung[0]?.consentId).not.toBe("c-r11-veraltet");
        expect(consentsNachAbweisung[0]?.status).toBe("granted");

        // Gegenprobe, ohne die „liefert immer false" auch ein kaputtes CAS wäre: mit der
        // AKTUELLEN Revision greift derselbe Übergang sofort.
        expect(
          await repo.touchSession(
            sessionId,
            stand.revision,
            "2026-08-02T12:10:00.000Z",
            "2026-08-02T12:25:00.000Z",
          ),
        ).toBe(true);
        expect(Number((await zeile(pool, sessionId)).session_revision)).toBe(stand.revision + 1);

        // R6A: dieselbe Gegenprobe für den siebten Übergang — mit der jetzt AKTUELLEN Revision
        // greift der Grant wirklich. Ohne sie bewiese das `false` oben nur, dass die Methode
        // ueberhaupt nichts tut.
        const nachTouch = await repo.findSession(sessionId);
        if (!nachTouch) {
          throw new Error("Sitzung fehlt");
        }
        expect(
          await repo.grantConsent(sessionId, nachTouch.revision, {
            ...veralteterConsent,
            consentId: "c-r11-aktuell",
            grantedAt: "2026-08-02T12:11:00.000Z",
            expiresAt: "2026-08-02T12:26:00.000Z",
          }),
        ).toBe(true);
        const nachGrant = await zeile(pool, sessionId);
        expect(Number(nachGrant.session_revision)).toBe(nachTouch.revision + 1);
        expect(nachGrant.consent_state).toBe("granted");
        // Die R2-Zusage traegt unveraendert: die alte Zeile wurde entwertet, nicht verdoppelt.
        expect(await grantedZeilen(pool, sessionId)).toBe(1);
        const alleNachGrant = await repo.alleConsents(sessionId);
        expect(alleNachGrant).toHaveLength(2);
        expect(alleNachGrant.filter((c) => c.status === "granted")[0]?.consentId).toBe(
          "c-r11-aktuell",
        );
      } finally {
        await pool.end();
      }
    });

    // ==========================================================================================
    // W1 S4 R6B (KW-S4-23) — CONSENT-BINDUNG GEGEN ECHTES POSTGRESQL
    // ==========================================================================================
    //
    // Dieselben Pflichtgegenproben wie in der Dienstbatterie, hier gegen den echten Server.
    // Akzeptanzkriterium 7 verlangt genau diese Paritaet: eine Zusage, die nur in einer der beiden
    // Ablagen gilt, ist keine Zusage. Der Unterschied, den nur dieser Lauf zeigt: dass die
    // Entwertung WIRKLICH in der Datenbank landet und ein veralteter Schreiber sie nicht
    // zurueckholt.
    it("R6B-1 · Policywechsel invalidiert den Consent und blockiert die externe Ausfuehrung", async () => {
      await mitPools(async (pool, _repoA, repoB) => {
        const b = dienstMit(repoB, "r6b1");
        const { sessionId, bindung } = await aufsetzen(b.dienst, "r6b1", true);
        const vorher = await zeile(pool, sessionId);
        expect(vorher.consent_state).toBe("granted");

        // Nur die autoritative Konfiguration wechselt — kein Rebind, kein Widerruf.
        b.umkonfigurieren({ source: "db" });
        const nach = await b.dienst.getSession(sessionId, bindung);

        expect(nach.resolution.externalConsentGranted).toBe(false);
        expect(nach.consentState).toBe("invalidated");

        const z = await zeile(pool, sessionId);
        expect(z.consent_state).toBe("invalidated");
        expect(await grantedZeilen(pool, sessionId)).toBe(0);

        const tor = await b.dienst.pruefeExterneAusfuehrung(sessionId, bindung);
        expect(tor.erlaubt).toBe(false);
        expect(tor.erlaubt === false && tor.grund).toBe("CONSENT_RECONFIRMATION_REQUIRED");
      });
    });

    it("R6B-2 · eine veraltete Revision kann den entwerteten Consent nicht zurueckbringen", async () => {
      await mitPools(async (pool, _repoA, repoB) => {
        const b = dienstMit(repoB, "r6b2");
        const { sessionId, bindung } = await aufsetzen(b.dienst, "r6b2", true);
        const alt = await repoB.findSession(sessionId);
        if (!alt) {
          throw new Error("Sitzung fehlt");
        }

        b.umkonfigurieren({ source: "db" });
        await b.dienst.getSession(sessionId, bindung);

        // Der veraltete Schreiber trifft null Zeilen — die Entwertung haelt.
        expect(
          await repoB.grantConsent(sessionId, alt.revision, {
            consentId: "c-r6b-zurueck",
            sessionId,
            tenantId: KLARA_SINGLE_TENANT_ID,
            actorId: "anna",
            documentContextId: alt.documentContextId,
            consentScope: "session",
            allowedPayloadClasses: ["question"],
            providerClass: "external",
            providerBindingId: "b",
            modelReference: "m",
            providerReference: "p",
            policyVersion: alt.policyVersion,
            configurationVersion: alt.configurationVersion,
            grantedAt: "2026-08-02T12:00:00.000Z",
            expiresAt: alt.expiresAt,
            revokedAt: null,
            status: "granted",
            resolutionId: alt.resolutionId,
          }),
        ).toBe(false);

        const z = await zeile(pool, sessionId);
        expect(z.consent_state).toBe("invalidated");
        expect(await grantedZeilen(pool, sessionId)).toBe(0);
      });
    });

    it("R6B-3 · identische Aufloesung ohne Versionswechsel behaelt den Consent", async () => {
      await mitPools(async (pool, _repoA, repoB) => {
        const b = dienstMit(repoB, "r6b3");
        const { sessionId, bindung } = await aufsetzen(b.dienst, "r6b3", true);
        for (let i = 0; i < 3; i++) {
          const nach = await b.dienst.getSession(sessionId, bindung);
          expect(nach.resolution.externalConsentGranted).toBe(true);
          expect(nach.consentState).toBe("granted");
        }
        expect((await zeile(pool, sessionId)).consent_state).toBe("granted");
        expect(await grantedZeilen(pool, sessionId)).toBe(1);
      });
    });

    it("R6B-4 · unvollstaendige Bindung (Altbestandszeile ohne provider_reference) → blocked", async () => {
      await mitPools(async (pool, _repoA, repoB) => {
        const b = dienstMit(repoB, "r6b4");
        const { sessionId, bindung } = await aufsetzen(b.dienst, "r6b4", true);

        // Genau der Altbestand aus R2..R6A: die Spalte existiert, die Zeile traegt sie nicht.
        await pool.query(
          "UPDATE klara_session_consents SET provider_reference = NULL WHERE session_id = $1",
          [sessionId],
        );

        const tor = await b.dienst.pruefeExterneAusfuehrung(sessionId, bindung);
        expect(tor.erlaubt).toBe(false);
        expect(tor.erlaubt === false && tor.grund).toBe("CONSENT_RECONFIRMATION_REQUIRED");
        expect(tor.erlaubt === false && !tor.deckung.gedeckt && tor.deckung.grund).toBe(
          "bindung_unvollstaendig",
        );
        // Fail-safe auch in der Datenbank.
        expect((await zeile(pool, sessionId)).consent_state).toBe("invalidated");
        expect(await grantedZeilen(pool, sessionId)).toBe(0);
      });
    });

    it("R6B-5 · das Tor unterscheidet Zustimmungsproblem und Blockade der Aufloesung", async () => {
      await mitPools(async (_pool, _repoA, repoB) => {
        const b = dienstMit(repoB, "r6b5");
        const { sessionId, bindung } = await aufsetzen(b.dienst, "r6b5", true);
        const tor = await b.dienst.pruefeExterneAusfuehrung(sessionId, bindung);
        // Die Zustimmung DECKT; geblockt wird die Auflösung selbst.
        expect(tor.erlaubt).toBe(false);
        expect(tor.erlaubt === false && tor.deckung.gedeckt).toBe(true);
        expect(tor.erlaubt === false && tor.grund).toBe("external_not_migrated");
      });
    });

    it("R6B-6 · die Spalte provider_reference ist additiv da und wird beim Grant gefuellt", async () => {
      await mitPools(async (pool, _repoA, repoB) => {
        const b = dienstMit(repoB, "r6b6");
        const { sessionId } = await aufsetzen(b.dienst, "r6b6", true);
        const spalten = await pool.query<{ column_name: string; is_nullable: string }>(
          `SELECT column_name, is_nullable FROM information_schema.columns
            WHERE table_name = 'klara_session_consents' AND column_name = 'provider_reference'`,
        );
        expect(spalten.rows[0]?.column_name).toBe("provider_reference");
        // BEWUSST nullable — Altbestand traegt sie nicht, und ein Vorgabewert waere erfunden.
        expect(spalten.rows[0]?.is_nullable).toBe("YES");

        // Gebunden wird der Anbieter, den die AUFLOESUNG wirklich meldet — nicht der
        // Admin-Wunsch. Bei blockierter externer Ausfuehrung ist das der deterministische
        // Anbieter, und genau er gehoert in die Bindung: der Consent bindet, was gilt.
        const status = await b.dienst.getSession(sessionId, {
          actorId: "anna",
          addinInstanceId: "instanz-1",
          documentContextId: (await zeile(pool, sessionId)).document_context_id,
        });
        const zeilen = await pool.query<{ provider_reference: string | null }>(
          "SELECT provider_reference FROM klara_session_consents WHERE session_id=$1",
          [sessionId],
        );
        expect(zeilen.rows[0]?.provider_reference).toBe(status.resolution.provider);
        expect(zeilen.rows[0]?.provider_reference).not.toBeNull();
      });
    });
  });
});
