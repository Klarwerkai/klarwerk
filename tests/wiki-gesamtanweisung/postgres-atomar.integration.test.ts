// ================================================================================================
// JOB 4154 R3 · DER POSTGRES-BEWEIS — EIN ERZWUNGENER HISTORIENFEHLER ROLLT ALLES ZURÜCK.
// ================================================================================================
//
// BENs Korrekturpflicht wörtlich: „Bestand und Prüfstand atomar speichern, einschließlich Anlage,
// Vorlegen und Entscheiden. Erwarteter Beleg: echter Postgres-Test erzwingt einen Fehler beim
// Historien-INSERT; sämtliche Änderungen rollen zurück. Ein erfolgreicher Wiederholversuch
// hinterlässt genau einen vollständigen Stand." Und aus seinen Promptverbesserungen:
// „Quelltextprüfungen gelten dafür nicht als Nachweis."
//
// Das ist der Grund für diese Datei. `atomare-speicherung.test.ts` daneben prüft das VERHALTEN am
// Testdouble und läuft im Tor; hier läuft eine echte Datenbank, und nur sie kann sagen, ob
// `withPgTx` wirklich klammert, was der Kommentar behauptet.
//
// ------------------------------------------------------------------------------------------------
// WIE DER FEHLER ERZWUNGEN WIRD — und warum nicht am Produktcode
// ------------------------------------------------------------------------------------------------
// Ein Riegel IM Adapter wäre wieder nur eine Nachbildung. Der Fehler kommt deshalb aus der
// Datenbank selbst: ein `BEFORE INSERT`-Trigger auf `gesamtanweisung_staende` wirft. Für den
// Adapter ist das ununterscheidbar von jedem anderen Grund, aus dem ein INSERT scheitern kann —
// Plattenfehler, Constraint, Verbindungsabbruch. Genau diese Klasse soll der Rollback decken.
//
// Danach wird an den ECHTEN Tabellen nachgelesen: Kopf, Version, Stand, Bausteinfolge, Historie.
//
// ------------------------------------------------------------------------------------------------
// LAUF UND SKIP
// ------------------------------------------------------------------------------------------------
// `*.integration.test.ts` ist aus dem Tor-Lauf ausgeschlossen (`vitest.config.ts`, `AUSSCHLUSS`)
// und läuft über `vitest.integration.config.ts`. Das Muster für Verbindung, Sicherung und den
// SICHTBAREN Skip ist wörtlich das eingeführte (`create-operation-pg.integration.test.ts:107-144`):
// lokale `KLARWERK_PG_TEST_URL` hat Vorrang und geht durch dieselbe harte Sicherung
// (`pg-test-guard.ts` — diese Suite legt Tabellen an und löscht sie, sie darf NIE eine echte
// Datenbank treffen), sonst Testcontainers, sonst Skip mit Klartext-Grund statt Fehlschlag.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { PgAnweisungRepo } from "../../services/knowledge-object/src/gesamtanweisung-repo-pg";
import type {
  Anweisung,
  AnweisungStandAufnahme,
} from "../../services/knowledge-object/src/gesamtanweisung-types";

const TABELLEN = ["gesamtanweisung_staende", "gesamtanweisung_bausteine", "gesamtanweisungen"];

function anweisung(over: Partial<Anweisung> = {}): Anweisung {
  return {
    id: "a-1",
    titel: "Wartung",
    zweck: "Sicheres Abstellen",
    geltungsbereich: "Werk 1",
    voraussetzungen: "Anlage steht still",
    bausteine: [
      { id: "b-1", position: 0, koId: "ko-a", koVersion: 1, nachweisHash: "ha" },
      { id: "b-2", position: 1, koId: "ko-b", koVersion: 2, nachweisHash: "hb" },
    ],
    stand: "entwurf",
    version: 1,
    urheber: "anna",
    erstelltAm: "2026-09-15T09:00:00.000Z",
    geaendertAm: "2026-09-15T09:00:00.000Z",
    ...over,
  };
}

function aufnahme(a: Anweisung): AnweisungStandAufnahme {
  return {
    anweisungId: a.id,
    version: a.version,
    aufgenommenAm: a.geaendertAm,
    titel: a.titel,
    zweck: a.zweck,
    geltungsbereich: a.geltungsbereich,
    voraussetzungen: a.voraussetzungen,
    bausteine: a.bausteine.map((b) => ({
      id: b.id,
      position: b.position,
      koId: b.koId,
      koVersion: b.koVersion,
      nachweisHash: b.nachweisHash,
      voraussetzung: b.voraussetzung ?? null,
      inhalt: { tabellenUeberschriften: null, abbildungen: null, geltung: null },
    })),
  };
}

describe("JOB 4154 R3: Bestand und Prüfstand rollen gegen echtes Postgres gemeinsam zurück", () => {
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
          "[KLARWERK] JOB 4154 R3 ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich.\n",
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
        "[KLARWERK] JOB 4154 R3 ÜBERSPRUNGEN: weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar.\n",
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

  /** Frische Tabellen über den ECHTEN Migrationsweg des Adapters (`migriere`). */
  async function frisch(p: Pool): Promise<PgAnweisungRepo> {
    for (const t of TABELLEN) {
      await p.query(`DROP TABLE IF EXISTS ${t} CASCADE`);
    }
    const repo = new PgAnweisungRepo(p);
    await repo.migriere();
    return repo;
  }

  /** Der erzwungene Fehler: die Datenbank selbst weist jeden Historien-INSERT ab. */
  async function historienInsertSperren(p: Pool): Promise<void> {
    await p.query(`
      CREATE OR REPLACE FUNCTION klarwerk_test_historie_sperre() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'Historie gesperrt (Prüfung JOB 4154 R3)'; END;
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

  async function bestandsbild(p: Pool) {
    const kopf = await p.query<{ version: number; stand: string; titel: string }>(
      "SELECT version,stand,titel FROM gesamtanweisungen WHERE id='a-1'",
    );
    const bausteine = await p.query<{ id: string; pos: number }>(
      "SELECT id,pos FROM gesamtanweisung_bausteine WHERE anweisung_id='a-1' ORDER BY pos",
    );
    const staende = await p.query<{ version: number }>(
      "SELECT version FROM gesamtanweisung_staende WHERE anweisung_id='a-1' ORDER BY version",
    );
    return {
      kopf: kopf.rows[0] ?? null,
      bausteine: bausteine.rows.map((r) => r.id),
      staende: staende.rows.map((r) => r.version),
    };
  }

  it("ANLEGEN: der gesperrte Historien-INSERT hinterlässt KEINE halbe Anweisung", async (ctx) => {
    const p = requirePool(ctx);
    const repo = await frisch(p);
    await historienInsertSperren(p);

    const a = anweisung();
    await expect(repo.anlegen(a, aufnahme(a))).rejects.toThrow(/Historie gesperrt/);

    // Kein Kopf, keine Bausteine, keine Historie — die Transaktion ist ganz zurückgerollt.
    expect(await bestandsbild(p)).toEqual({ kopf: null, bausteine: [], staende: [] });

    // Und der Wiederholversuch nach dem Freigeben hinterlässt GENAU EINEN vollständigen Stand.
    await historienInsertFreigeben(p);
    await repo.anlegen(a, aufnahme(a));
    expect(await bestandsbild(p)).toEqual({
      kopf: { version: 1, stand: "entwurf", titel: "Wartung" },
      bausteine: ["b-1", "b-2"],
      staende: [1],
    });
  });

  it("ÄNDERN: ein Fehler am Prüfstand rollt Kopf, Version UND Bausteinfolge zurück", async (ctx) => {
    const p = requirePool(ctx);
    const repo = await frisch(p);
    const a = anweisung();
    await repo.anlegen(a, aufnahme(a));
    const vorher = await bestandsbild(p);

    // Eine echte Änderung: andere Reihenfolge, neuer Titel, Version 2.
    const geaendert = anweisung({
      version: 2,
      titel: "Nachher",
      geaendertAm: "2026-09-15T10:00:00.000Z",
      bausteine: [
        { id: "b-2", position: 0, koId: "ko-b", koVersion: 2, nachweisHash: "hb" },
        { id: "b-1", position: 1, koId: "ko-a", koVersion: 1, nachweisHash: "ha" },
      ],
    });

    await historienInsertSperren(p);
    await expect(repo.schreiben(geaendert, 1, aufnahme(geaendert))).rejects.toThrow(
      /Historie gesperrt/,
    );

    // GENAU BENs Gegenprobe, jetzt umgekehrt: kein „Nachher", keine Version 2, Historie `[1]`
    // UND der Bestand steht unverändert auf dem Vorherstand.
    const nachher = await bestandsbild(p);
    expect(nachher).toEqual(vorher);
    expect(nachher.kopf).toEqual({ version: 1, stand: "entwurf", titel: "Wartung" });
    expect(nachher.bausteine).toEqual(["b-1", "b-2"]);
    expect(nachher.staende).toEqual([1]);
  });

  it("ÄNDERN, Wiederholversuch: genau ein vollständiger Stand, keine Dublette", async (ctx) => {
    const p = requirePool(ctx);
    const repo = await frisch(p);
    const a = anweisung();
    await repo.anlegen(a, aufnahme(a));
    const geaendert = anweisung({
      version: 2,
      titel: "Nachher",
      geaendertAm: "2026-09-15T10:00:00.000Z",
    });

    await historienInsertSperren(p);
    await expect(repo.schreiben(geaendert, 1, aufnahme(geaendert))).rejects.toThrow(
      /Historie gesperrt/,
    );
    await historienInsertFreigeben(p);

    // Auf DERSELBEN erwarteten Version 1 — der gescheiterte Versuch hat sie nicht verbraucht.
    await repo.schreiben(geaendert, 1, aufnahme(geaendert));
    expect(await bestandsbild(p)).toEqual({
      kopf: { version: 2, stand: "entwurf", titel: "Nachher" },
      bausteine: ["b-1", "b-2"],
      staende: [1, 2],
    });

    // Und der festgehaltene Stand 2 gehört wirklich zu dieser Fassung.
    const stand = await repo.standLesen("a-1", 2);
    expect(stand?.titel).toBe("Nachher");
    expect(stand?.version).toBe(2);
  });

  it("ENTSCHEIDEN: ohne Prüfstand wird nichts freigegeben", async (ctx) => {
    const p = requirePool(ctx);
    const repo = await frisch(p);
    const a = anweisung();
    await repo.anlegen(a, aufnahme(a));
    const vorgelegt = anweisung({ version: 2, stand: "vorgelegt" });
    await repo.schreiben(vorgelegt, 1, aufnahme(vorgelegt));

    const entschieden = anweisung({ version: 3, stand: "entschieden" });
    await historienInsertSperren(p);
    await expect(repo.schreiben(entschieden, 2, aufnahme(entschieden))).rejects.toThrow(
      /Historie gesperrt/,
    );

    // Der Stand ist NICHT auf „entschieden" gewandert — das ist der teuerste Fall dieser Klasse.
    const nachher = await bestandsbild(p);
    expect(nachher.kopf).toEqual({ version: 2, stand: "vorgelegt", titel: "Wartung" });
    expect(nachher.staende).toEqual([1, 2]);
  });

  it("KALIBRIERUNG: ohne Sperre läuft derselbe Weg durch — der Trigger ist die einzige Ursache", async (ctx) => {
    // Ohne diesen Fall bewiesen die vier darüber nur, dass irgendetwas scheitert.
    const p = requirePool(ctx);
    const repo = await frisch(p);
    const a = anweisung();
    await expect(repo.anlegen(a, aufnahme(a))).resolves.toBeUndefined();
    const geaendert = anweisung({ version: 2, titel: "Nachher" });
    await expect(repo.schreiben(geaendert, 1, aufnahme(geaendert))).resolves.toBeUndefined();
    expect((await bestandsbild(p)).staende).toEqual([1, 2]);
  });
});
