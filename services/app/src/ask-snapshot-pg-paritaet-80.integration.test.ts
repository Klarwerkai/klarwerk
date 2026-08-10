import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../db-tx";
import { buildPgServices } from "./build-app";
import { migrate } from "./db";

// ================================================================================================
// AUFTRAG 80 — DIE ECHTE POSTGRESQL-PARITAET DES W3-C1-SCHREIBWEGS
// ================================================================================================
//
// WAS IN RUECKGABE 76 OFFENBLIEB UND WARUM ES ZAEHLT. Der Beleg-Schreibweg wurde dort produktiv
// verdrahtet und mit InMemory belegt; die Zusage gegen einen echten Server fehlte ausdruecklich.
// Der Unterschied ist nicht Formsache: `buildPgServices` konstruiert ANDERE Adapter als
// `buildServices`, und ob die Antwort dort wirklich eine Zeile in `answer_records` und
// `answer_snapshots` hinterlaesst, hat bis hierher niemand gemessen.
//
// DIESE DATEI KENNT KEINEN SKIP. Auftrag 80 Akzeptanz 1 verlangt eine echte Verbindung ohne
// Ersatzablage und ohne InMemory-Rueckfall. Ist keine Datenbank erreichbar, SCHEITERT der Lauf
// laut — eine uebersprungene Paritaetsprobe waere genau die Art von gruener Zeile, die nichts
// belegt und trotzdem so aussieht.
//
// EIGENES SCHEMA STATT `public`: der Lauf legt seinen Datenraum selbst an, arbeitet ausschliesslich
// darin und raeumt ihn nachweislich wieder ab. So kann er weder fremde Testdaten sehen noch eigene
// hinterlassen.

const SCHEMA = `w3c1_80_${process.pid}`;

describe("Auftrag 80: buildPgServices schreibt den Answer-Beleg wirklich in PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let adminPool: Pool | undefined;
  let pool: Pool | undefined;
  let services: ReturnType<typeof buildPgServices> | undefined;

  beforeAll(async () => {
    const localUrl = guardedLocalPgTestUrl();
    let url = localUrl;
    if (!url) {
      container = await new GenericContainer("postgres:16-alpine")
        .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk" })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
        .start();
      url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk`;
    }

    adminPool = new Pool({ connectionString: url });
    // KEIN Skip, KEIN Fallback: eine nicht erreichbare Datenbank ist ein Fehlschlag.
    await adminPool.query("SELECT 1");
    await adminPool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await adminPool.query(`CREATE SCHEMA ${SCHEMA}`);

    // ZWEI POOLS, UND DAS IST KEIN LUXUS. Ein `SET search_path` per `pool.query` gilt nur fuer die
    // EINE Verbindung, die der Pool gerade herausgibt — der naechste Aufruf kann eine andere
    // erwischen und steht wieder in `public`. Genau daran ist der erste Lauf dieser Datei
    // gescheitert (`relation "ko_projection_control" does not exist`). Der Suchpfad gehoert deshalb
    // in die VERBINDUNGSOPTIONEN, damit ausnahmslos jede Verbindung im eigenen Schema landet.
    pool = new Pool({ connectionString: url, options: `-c search_path=${SCHEMA}` });
    await migrate(pool);

    // Die produktive Pg-Komposition wird EINMAL gebaut und geteilt: die Suchprojektion kennt einen
    // Zustandsautomaten, der ein zweites `V2_BUILDING` aus `V2_READY` zu Recht verweigert.
    services = buildPgServices(pool);
    await services.ko.activateSearchProjectionV2();

    // ============================================================================================
    // AUFTRAG 89 — EIN ECHTER BESTAND, WEIL EINE ZUSICHERUNG OHNE EVIDENZ NICHTS ZUSICHERT.
    // ============================================================================================
    //
    // DER BEFUND, DER DIESE ZEILEN ERZWUNGEN HAT: bis Auftrag 89 fragte diese Datei gegen einen
    // LEEREN Wissensbestand. Die Antwort trug damit null Evidenzreferenzen, der Snapshot stand auf
    // PENDING_EVIDENCE — und jede Aussage ueber `knowledgeObjectVersion` waere ueber eine leere
    // Menge gelaufen, also immer wahr und immer wertlos. Die Luecke aus BEN 82 Befund 2 haette sich
    // hier nicht einmal ausdruecken lassen.
    //
    // Deshalb bekommt der Lauf ein Wissensobjekt, das die Frage unten wirklich trifft. Erst damit
    // entsteht getragene Evidenz, erst damit ist INCOMPLETE der richtige Status, und erst damit
    // beisst die Gegenmutation M6.
    await services.ko.create({
      title: "Wartungshinweis Portalanlage",
      statement: "Die Verschraubung der Grundplatte wird quartalsweise nachgezogen.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
    });
  }, 180_000);

  afterAll(async () => {
    // BELEGTES CLEANUP: erst abraeumen, dann nachsehen, dass wirklich nichts blieb.
    await pool?.end();
    if (adminPool) {
      await adminPool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
      const rest = await adminPool.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM information_schema.schemata WHERE schema_name = $1",
        [SCHEMA],
      );
      if (rest.rows[0]?.n !== "0") {
        throw new Error(`Cleanup unvollstaendig: Schema ${SCHEMA} existiert noch.`);
      }
    }
    await adminPool?.end();
    await container?.stop();
  }, 120_000);

  function db(): Pool {
    if (!pool) {
      throw new Error("keine PostgreSQL-Verbindung");
    }
    return pool;
  }

  function app(): ReturnType<typeof buildPgServices> {
    if (!services) {
      throw new Error("keine Pg-Komposition");
    }
    return services;
  }

  it("die Tabellen des Belegs stehen im eigenen Schema — migrate() hat sie angelegt", async () => {
    const res = await db().query<{ t: string }>(
      `SELECT c.relname AS t FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relkind = 'r'
          AND c.relname IN ('answer_records','answer_snapshots')
        ORDER BY c.relname`,
      [SCHEMA],
    );
    expect(res.rows.map((r) => r.t)).toEqual(["answer_records", "answer_snapshots"]);
    // Ausgangslage: leer. Ohne diese Zeile koennte jeder spaetere Befund aus einem Vorlauf stammen.
    const leer = await db().query<{ n: string }>("SELECT count(*)::text AS n FROM answer_records");
    expect(leer.rows[0]?.n).toBe("0");
  });

  it("ein Antwortlauf ueber buildPgServices schreibt GENAU einen Record und Revision 1", async () => {
    // Die Frage trifft den in `beforeAll` angelegten Bestand — nur so traegt der Beleg Evidenz.
    const out = await app().ask.ask(
      "Wie oft wird die Verschraubung der Grundplatte nachgezogen?",
      "anna",
      "de",
    );
    expect(out.answerId, "der produktive Pg-Aufbau muss einen Beleg schreiben").not.toBeNull();
    if (!out.answerId) {
      throw new Error("keine answerId");
    }

    // DIE EIGENTLICHE PARITAETSAUSSAGE: nicht das Repo wird befragt, sondern die DATENBANK.
    const records = await db().query<{ answer_id: string; im_rumpf: string }>(
      "SELECT answer_id, data->>'answerId' AS im_rumpf FROM answer_records",
    );
    expect(records.rows.map((r) => r.answer_id)).toEqual([out.answerId]);
    // BEN 79 §6 verlangt dieselbe Identitaet in Rueckgabe, Record UND Snapshot. Bei
    // `answer_records` ist `answer_id` eine GEWOEHNLICHE Spalte — sie kann vom JSON-Rumpf
    // abweichen, ohne dass die Datenbank protestiert. Deshalb wird der Rumpf mitgeprueft.
    expect(records.rows[0]?.im_rumpf).toBe(out.answerId);

    const snaps = await db().query<{ answer_id: string; snapshot_revision_key: string }>(
      "SELECT answer_id, snapshot_revision_key FROM answer_snapshots ORDER BY snapshot_revision_key",
    );
    expect(snaps.rows).toHaveLength(1);
    expect(snaps.rows[0]?.answer_id).toBe(out.answerId);
    expect(snaps.rows[0]?.snapshot_revision_key).toBe("1");
  });

  it("der persistierte Beleg traegt null mit dem HEUTE richtigen Grund", async () => {
    const zeile = await db().query<{ data: Record<string, unknown> }>(
      "SELECT data FROM answer_snapshots LIMIT 1",
    );
    const data = zeile.rows[0]?.data;
    expect(data).toBeDefined();
    expect(data?.validationDecisionRef).toBeNull();
    expect(data?.validationDecisionRefReason).toBe("w3c_no_decision_carrier");
    // Der seit Freeze 67 erledigte Grund darf in KEINEM neuen Snapshot stehen.
    expect(data?.validationDecisionRefReason).not.toBe("w3b_findbyseq_missing");
    expect(data?.resolutionId).toBeNull();
    expect(data?.resolutionIdReason).toBe("w1_not_on_answer_path");

    // ============================================================================================
    // AUFTRAG 89 (BEN 82, Befund 2) — DIESE DATEI TRUG DIESELBE LUECKE WIE DER 76er VERTRAG.
    // ============================================================================================
    //
    // Hier stand nur `not.toBe("COMPLETE")`. BEN 82 hat den Befund am Freeze-76-Test erhoben und
    // diese Datei ausdruecklich ausgeklammert, weil sie nicht zu jenem Freeze gehoert. Das war fuer
    // den Kontrollrahmen richtig — und es hiess nicht, dass die Zusicherung hier besser waere. Sie
    // war es nicht: eine erfundene KO-Fassung macht die Evidenz primaergebunden, der Status wird
    // PARTIAL, und PARTIAL ist nicht COMPLETE. Die Probe haette geschwiegen.
    //
    // Gepinnt wird jetzt auch hier, was der Dienst WIRKLICH in die Datenbank schreibt.
    const evidenz = data?.evidence as { knowledgeObjectVersion: number | null }[] | undefined;
    expect(evidenz?.length, "ohne Evidenz waere die Aussage leer").toBeGreaterThan(0);
    for (const e of evidenz ?? []) {
      expect(e.knowledgeObjectVersion, "eine erfundene Fassung waere eine Luege").toBeNull();
    }
    expect(data?.status).toBe("INCOMPLETE");
    // Die alte, schwaechere Zusage bleibt zusaetzlich stehen — sie ist nicht falsch, nur zu wenig.
    expect(data?.status).not.toBe("COMPLETE");
  });

  it("ein zweiter Antwortlauf ist eine ANDERE Antwort — auch in der Datenbank", async () => {
    const zweite = await app().ask.ask("Eine andere Frage", "bea", "de");
    if (!zweite.answerId) {
      throw new Error("keine answerId");
    }

    const records = await db().query<{ answer_id: string }>(
      "SELECT answer_id FROM answer_records ORDER BY answer_id",
    );
    expect(records.rows).toHaveLength(2);
    const ids = new Set(records.rows.map((r) => r.answer_id));
    expect(ids.size, "zwei Laeufe, zwei Identitaeten").toBe(2);
    expect(ids.has(zweite.answerId)).toBe(true);

    // Jede Antwort hat GENAU EINE Revision 1 — keine zweite Revision, keine Waise.
    const je = await db().query<{ answer_id: string; n: string }>(
      "SELECT answer_id, count(*)::text AS n FROM answer_snapshots GROUP BY answer_id",
    );
    expect(je.rows).toHaveLength(2);
    for (const r of je.rows) {
      expect(r.n).toBe("1");
    }
  });

  it("die DB-seitige Revisionsidentitaet greift — ein zweiter Snapshot derselben Revision scheitert", async () => {
    const vorhanden = await db().query<{ answer_id: string }>(
      "SELECT answer_id FROM answer_snapshots LIMIT 1",
    );
    const answerId = vorhanden.rows[0]?.answer_id;
    expect(answerId).toBeDefined();
    // GEGENPROBE am rohen SQL, ohne Adapter: der Unique-Index aus Freeze 59/61 muss halten.
    await expect(
      db().query("INSERT INTO answer_snapshots(snapshot_key,data) VALUES($1,$2::jsonb)", [
        `${answerId}@1-zweit`,
        JSON.stringify({ answerId, snapshotRevision: 1 }),
      ]),
    ).rejects.toThrow(/unique|duplicate/i);
  });
});
