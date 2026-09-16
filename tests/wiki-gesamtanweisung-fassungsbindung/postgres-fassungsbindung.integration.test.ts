// ================================================================================================
// JOB 4233 · TEST 9 — GEGEN ECHTES POSTGRESQL: DIE ABGELEHNTE FASSUNG HINTERLÄSST KEINE ZEILE.
// ================================================================================================
//
// DREI SACHEN, die nur eine echte Datenbank beantworten kann (Lieferung 9 und 10 des Auftrags):
//
//   1. Die abgelehnte Fassung hinterlässt WIRKLICH keine Zeile in `gesamtanweisung_bausteine` und
//      keinen neuen Stand in `gesamtanweisung_staende`. Ein Testdouble kann das nur nachbilden;
//      hier wird in den Tabellen nachgesehen.
//   2. Der KONKURRIERENDE CAS — BENs Bestellung aus JOB 4154 R5 (PROMPTVERBESSERUNG, wörtlich):
//      „Den konkurrierenden CAS-Fall und den Historienfehler beim Vorlegen dauerhaft gegen echtes
//      Postgres prüfen: genau ein Gewinner beziehungsweise unveränderter Vorherbestand;
//      Wiederholung erzeugt genau einen vollständigen Stand." Zwei Aufnahmen auf DERSELBEN gelesenen
//      Version, gleichzeitig abgeschickt.
//   3. Der Historienfehler beim VORLEGEN, erzwungen aus der Datenbank selbst (Trigger), wie in
//      `tests/wiki-gesamtanweisung/postgres-atomar.integration.test.ts` — dort für Anlegen und
//      Ändern, hier für den Weg, den dieser Auftrag anfasst.
//
// LAUF UND SKIP wörtlich im eingeführten Muster: lokale `KLARWERK_PG_TEST_URL` mit harter Sicherung
// (`guardedLocalPgTestUrl`), sonst Testcontainers, sonst SICHTBARER Skip mit Klartextgrund. Ein
// übersprungener Lauf ist nie ein bestandener — er steht als „übersprungen" in der Rückgabe.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { PgAnweisungRepo } from "../../services/knowledge-object/src/gesamtanweisung-repo-pg";
import { GesamtanweisungDienst } from "../../services/knowledge-object/src/gesamtanweisung-service";
import { eintrag, kennungen, koLeser, sichtbarAls, uhr } from "../wiki-gesamtanweisung/pruefstand";

const TABELLEN = ["gesamtanweisung_staende", "gesamtanweisung_bausteine", "gesamtanweisungen"];

const TEXT_EINS = "Erst absperren, dann entlüften.";

const EINTRAEGE = [
  eintrag({ id: "ko-a", title: "Anlage entlüften", version: 2 }, [
    { version: 1, bodyHtml: `<h2>Absperren</h2><p>${TEXT_EINS}</p>` },
    { version: 2, bodyHtml: "<p>Zweite Fassung.</p>" },
  ]),
];

const ANNA = sichtbarAls({ id: "anna", darfPruefen: true });

describe("JOB 4233: die Fassungsbindung gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let pool: Pool | undefined;
  let available = false;

  beforeAll(async () => {
    const localUrl = guardedLocalPgTestUrl();
    if (localUrl) {
      try {
        pool = new Pool({ connectionString: localUrl });
        await pool.query("SELECT 1");
        available = true;
        return;
      } catch {
        process.stderr.write(
          "[KLARWERK] JOB 4233 ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich.\n",
        );
        available = false;
        return;
      }
    }
    if (process.env.KLARWERK_PG_TEST_URL) {
      // Die Sicherung hat die URL abgelehnt (Grund steht auf stderr) — KEIN Container-Rückfall.
      available = false;
      return;
    }
    try {
      container = await new GenericContainer("postgres:16-alpine")
        .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
        .start();
      pool = new Pool({
        connectionString: `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`,
      });
      available = true;
    } catch {
      process.stderr.write(
        "[KLARWERK] JOB 4233 ÜBERSPRUNGEN: weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar.\n",
      );
      available = false;
    }
  }, 180_000);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  function requirePool(ctx: { skip: () => void }): Pool {
    if (!available || !pool) {
      ctx.skip();
      throw new Error("unreachable"); // ctx.skip() bricht ab; nur fürs Typing
    }
    return pool;
  }

  /** Frische Tabellen über den ECHTEN Migrationsweg des Adapters, dazu der ECHTE Dienst. */
  async function frisch(
    p: Pool,
  ): Promise<{ repo: PgAnweisungRepo; dienst: GesamtanweisungDienst }> {
    for (const t of TABELLEN) {
      await p.query(`DROP TABLE IF EXISTS ${t} CASCADE`);
    }
    const repo = new PgAnweisungRepo(p);
    await repo.migriere();
    return {
      repo,
      dienst: new GesamtanweisungDienst({
        repo,
        ko: koLeser(EINTRAEGE),
        jetzt: uhr(),
        kennung: kennungen("b"),
      }),
    };
  }

  async function bild(p: Pool, id: string) {
    const kopf = await p.query<{ version: number; stand: string }>(
      "SELECT version,stand FROM gesamtanweisungen WHERE id=$1",
      [id],
    );
    const bausteine = await p.query<{ ko_version: number }>(
      "SELECT ko_version FROM gesamtanweisung_bausteine WHERE anweisung_id=$1 ORDER BY pos",
      [id],
    );
    const staende = await p.query<{ version: number }>(
      "SELECT version FROM gesamtanweisung_staende WHERE anweisung_id=$1 ORDER BY version",
      [id],
    );
    return {
      kopf: kopf.rows[0] ?? null,
      fassungen: bausteine.rows.map((r) => r.ko_version),
      staende: staende.rows.map((r) => r.version),
    };
  }

  async function historienInsertSperren(p: Pool): Promise<void> {
    await p.query(`
      CREATE OR REPLACE FUNCTION klarwerk_test_historie_sperre() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'Historie gesperrt (Prüfung JOB 4233)'; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER klarwerk_test_historie_sperre_trg
        BEFORE INSERT ON gesamtanweisung_staende
        FOR EACH ROW EXECUTE FUNCTION klarwerk_test_historie_sperre();
    `);
  }

  async function historienInsertFreigeben(p: Pool): Promise<void> {
    await p.query(
      "DROP TRIGGER IF EXISTS klarwerk_test_historie_sperre_trg ON gesamtanweisung_staende",
    );
  }

  it("die abgelehnte Fassung hinterlässt KEINE Zeile und KEINEN neuen Stand", async (ctx) => {
    const p = requirePool(ctx);
    const { dienst } = await frisch(p);
    const a = await dienst.anlegen({ titel: "Wartung" }, "anna");
    const vorher = await bild(p, a.id);
    expect(vorher).toEqual({ kopf: { version: 1, stand: "entwurf" }, fassungen: [], staende: [1] });

    await expect(
      dienst.bausteinAufnehmen(
        a.id,
        a.version,
        { koId: "ko-a", koVersion: 999, nachweisHash: "h" },
        ANNA,
      ),
    ).rejects.toMatchObject({ code: "INVALID" });

    expect(await bild(p, a.id)).toEqual(vorher);

    // Und die erlaubte Aufnahme erzeugt GENAU EINEN neuen Stand und GENAU EINE Zeile.
    await dienst.bausteinAufnehmen(
      a.id,
      a.version,
      { koId: "ko-a", koVersion: 1, nachweisHash: "h-1" },
      ANNA,
    );
    expect(await bild(p, a.id)).toEqual({
      kopf: { version: 2, stand: "entwurf" },
      fassungen: [1],
      staende: [1, 2],
    });
  });

  it("der gebundene Text kommt aus dem Eintragsbestand, nicht aus der Anweisungstabelle", async (ctx) => {
    const p = requirePool(ctx);
    const { dienst } = await frisch(p);
    const a = await dienst.anlegen({ titel: "Wartung" }, "anna");
    await dienst.bausteinAufnehmen(
      a.id,
      a.version,
      { koId: "ko-a", koVersion: 1, nachweisHash: "h-1" },
      ANNA,
    );

    const stand = await dienst.lesen(a.id, ANNA);
    expect(stand.bausteine[0]?.rumpfHtml).toContain(TEXT_EINS);

    // KEINE ZWEITE DOKUMENTWAHRHEIT: der festgehaltene Prüfstand trägt den Rumpf nicht.
    const staende = await p.query<{ aufnahme: unknown }>(
      "SELECT aufnahme FROM gesamtanweisung_staende WHERE anweisung_id=$1",
      [a.id],
    );
    expect(JSON.stringify(staende.rows)).not.toContain(TEXT_EINS);
  });

  it("KONKURRIERENDER CAS: zwei Aufnahmen auf demselben Stand — genau ein Gewinner", async (ctx) => {
    const p = requirePool(ctx);
    const { dienst } = await frisch(p);
    const a = await dienst.anlegen({ titel: "Wartung" }, "anna");

    const ergebnisse = await Promise.allSettled([
      dienst.bausteinAufnehmen(
        a.id,
        a.version,
        { koId: "ko-a", koVersion: 1, nachweisHash: "h-1" },
        ANNA,
      ),
      dienst.bausteinAufnehmen(
        a.id,
        a.version,
        { koId: "ko-a", koVersion: 2, nachweisHash: "h-2" },
        ANNA,
      ),
    ]);

    const gewonnen = ergebnisse.filter((e) => e.status === "fulfilled");
    const verloren = ergebnisse.filter((e) => e.status === "rejected");
    expect(gewonnen).toHaveLength(1);
    expect(verloren).toHaveLength(1);
    expect((verloren[0] as PromiseRejectedResult).reason).toMatchObject({ code: "CONFLICT" });

    // GENAU EIN Baustein und GENAU EIN zusätzlicher Stand — kein halber Schreibvorgang daneben.
    const nachher = await bild(p, a.id);
    expect(nachher.kopf).toEqual({ version: 2, stand: "entwurf" });
    expect(nachher.fassungen).toHaveLength(1);
    expect(nachher.staende).toEqual([1, 2]);
  });

  it("HISTORIENFEHLER BEIM VORLEGEN: der Vorherbestand bleibt vollständig", async (ctx) => {
    const p = requirePool(ctx);
    const { dienst } = await frisch(p);
    const a = await dienst.anlegen({ titel: "Wartung" }, "anna");
    const mit = await dienst.bausteinAufnehmen(
      a.id,
      a.version,
      { koId: "ko-a", koVersion: 1, nachweisHash: "h-1" },
      ANNA,
    );
    const vorher = await bild(p, a.id);
    expect(vorher).toEqual({
      kopf: { version: 2, stand: "entwurf" },
      fassungen: [1],
      staende: [1, 2],
    });

    await historienInsertSperren(p);
    await expect(dienst.vorlegen(mit.id, mit.version, ANNA)).rejects.toThrow(/Historie gesperrt/);
    expect(await bild(p, a.id)).toEqual(vorher);

    // Wiederholung nach dem Freigeben: GENAU EIN vollständiger Stand kommt hinzu.
    await historienInsertFreigeben(p);
    const vorgelegt = await dienst.vorlegen(mit.id, mit.version, ANNA);
    expect(vorgelegt.stand).toBe("vorgelegt");
    expect(await bild(p, a.id)).toEqual({
      kopf: { version: 3, stand: "vorgelegt" },
      fassungen: [1],
      staende: [1, 2, 3],
    });
  });
});
