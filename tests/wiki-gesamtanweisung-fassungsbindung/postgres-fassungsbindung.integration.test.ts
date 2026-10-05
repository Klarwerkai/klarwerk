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
//      Version, nachweislich gleichzeitig am CAS der Datenbank; Bestand und Historie tragen danach
//      genau den Gewinner. Dies ist die dauerhafte Fassung von BENs R5-Probe (Aufnahme 20260922).
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
import type { Anweisung } from "../../services/knowledge-object/src/gesamtanweisung-types";
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

  /**
   * Wartet, bis `anzahl` Schreiber am Zeilenschloss des Kopfes stehen — erst dann ist bewiesen,
   * dass beide GLEICHZEITIG unterwegs sind und die Vorprüfung im Dienst schon hinter sich haben.
   */
  async function wartendeSchreiber(p: Pool, anzahl: number): Promise<void> {
    const frist = Date.now() + 15_000;
    for (;;) {
      const res = await p.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'
            AND query LIKE 'UPDATE gesamtanweisungen%'`,
      );
      if ((res.rows[0]?.n ?? 0) >= anzahl) {
        return;
      }
      if (Date.now() > frist) {
        throw new Error(`Nur ${res.rows[0]?.n ?? 0} von ${anzahl} Schreibern am Schloss.`);
      }
      await new Promise((r) => setTimeout(r, 25));
    }
  }

  // JOB 4154 R5 · BENs unabhängige Probe, hier dauerhaft. Das Original lag nur unter `/private/tmp`
  // und ist nicht erhalten; übernommen ist seine gemessene Aussage („genau ein Gewinner, ein
  // Konflikt und passende Historie", `archiv/4154/runde-5/ben.md`, Punkt 6).
  //
  // WARUM EIN HALTER: ohne ihn kann der zweite Aufruf erst lesen, wenn der erste schon committet
  // hat — dann entscheidet die Vorprüfung im Dienst (`pruefeVersion`) und der CAS der Datenbank
  // bliebe ungeprüft. Der Halter sperrt die Kopfzeile, beide Aufrufe lesen Version 1, bestehen die
  // Vorprüfung und stehen am `UPDATE … WHERE version=$9`. Erst dann wird losgelassen; NUR die
  // WHERE-Klausel kann jetzt noch einen der beiden abweisen.
  //
  // GEGENPROBE: in `PgAnweisungRepo.schreiben` die Bedingung `AND version=$9` entfernen — dann
  // gewinnen beide, und „genau ein Gewinner" wird rot.
  it("KONKURRIERENDER CAS: zwei Aufnahmen auf demselben Stand — genau ein Gewinner", async (ctx) => {
    const p = requirePool(ctx);
    const { dienst, repo } = await frisch(p);
    const a = await dienst.anlegen({ titel: "Wartung" }, "anna");

    const halter = await p.connect();
    let ergebnisse: PromiseSettledResult<Anweisung>[];
    try {
      await halter.query("BEGIN");
      await halter.query("SELECT 1 FROM gesamtanweisungen WHERE id=$1 FOR UPDATE", [a.id]);
      const laeufe = Promise.allSettled([
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
      await wartendeSchreiber(p, 2);
      await halter.query("COMMIT");
      ergebnisse = await laeufe;
    } finally {
      await halter.query("ROLLBACK").catch(() => undefined);
      halter.release();
    }

    const gewonnen = ergebnisse.filter(
      (e): e is PromiseFulfilledResult<Anweisung> => e.status === "fulfilled",
    );
    const verloren = ergebnisse.filter((e): e is PromiseRejectedResult => e.status === "rejected");
    expect(gewonnen).toHaveLength(1);
    expect(verloren).toHaveLength(1);
    // Der Verlierer erfährt den Stand, an dem er gescheitert ist — den des Gewinners.
    expect(verloren[0]?.reason).toMatchObject({
      code: "CONFLICT",
      aktuell: { stand: "entwurf", version: 2 },
    });

    const sieger = gewonnen[0]?.value;
    const siegerBaustein = sieger?.bausteine[0];
    expect(sieger?.bausteine).toHaveLength(1);
    const verliererHash = siegerBaustein?.nachweisHash === "h-1" ? "h-2" : "h-1";

    // BESTAND: genau die bestätigte Änderung des Gewinners — Fassung UND Nachweis.
    const zeilen = await p.query<{ id: string; ko_version: number; nachweis_hash: string }>(
      "SELECT id,ko_version,nachweis_hash FROM gesamtanweisung_bausteine WHERE anweisung_id=$1",
      [a.id],
    );
    expect(zeilen.rows).toEqual([
      {
        id: siegerBaustein?.id,
        ko_version: siegerBaustein?.koVersion,
        nachweis_hash: siegerBaustein?.nachweisHash,
      },
    ]);
    expect(await bild(p, a.id)).toMatchObject({ kopf: { version: 2, stand: "entwurf" } });

    // HISTORIE: genau ein zusätzlicher Stand, und der trägt den Gewinner.
    expect(await repo.staende(a.id)).toEqual([1, 2]);
    const stand2 = await repo.standLesen(a.id, 2);
    expect(stand2?.bausteine.map((b) => [b.id, b.koVersion, b.nachweisHash])).toEqual([
      [siegerBaustein?.id, siegerBaustein?.koVersion, siegerBaustein?.nachweisHash],
    ]);

    // Vom Verlierer steht nirgends etwas — weder im Bestand noch in der Historie.
    const historie = await p.query("SELECT aufnahme FROM gesamtanweisung_staende");
    expect(JSON.stringify([zeilen.rows, historie.rows])).not.toContain(verliererHash);

    // KEIN VERLORENER BESTÄTIGTER INHALT: was der Gewinner bestätigt bekam, liest man wieder.
    const gelesen = await dienst.lesen(a.id, ANNA);
    expect(gelesen.version).toBe(sieger?.version);
    expect(gelesen.bausteine.map((b) => [b.id, b.koVersion, b.nachweisHash])).toEqual([
      [siegerBaustein?.id, siegerBaustein?.koVersion, siegerBaustein?.nachweisHash],
    ]);
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
