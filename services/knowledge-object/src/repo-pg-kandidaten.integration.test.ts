import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  BESTAND,
  ERWARTETE_REIHENFOLGE,
  TERME,
} from "../../../tests/live-check-postgres-prefilter/bestand";
import { guardedLocalPgTestUrl } from "../../db-tx";
import { InMemoryKoRepo } from "./repo";
import { KO_SCHEMA, PgKoRepo } from "./repo-pg";

// ================================================================================================
// JOB 3583 · V1 — DIESELBE RANGFOLGE IN DER ECHTEN DATENBANK WIE IM SPEICHERBESTAND.
// ================================================================================================
//
// WORUM ES GEHT. Der Live-Check übergibt beiden Adaptern DIESELBE Wortliste und DASSELBE `limit`
// (services/app/src/knowledge-check.ts, `terms()` → `deps.ko.findCandidates`). JOB 3574 hat die
// Wirkung der zwölf Suchwörter am Speicherbestand gemessen; LIVE läuft Postgres. Sortiert Postgres
// anders, ist keine Messung von 3574 für den echten Nutzer bewiesen.
//
// DER MASSSTAB IST DER SPEICHERBESTAND, nicht diese Datei: jeder Fall fragt BEIDE Adapter mit
// demselben Bestand und vergleicht die Kennungen IN REIHENFOLGE. `InMemoryKoRepo` wird dabei nur
// gelesen (repo.ts:577-606: Term-Trefferzahl ↓, validiert zuerst, Trust ↓, dann `limit`).
//
// WARUM HIER NICHT ÜBERSPRUNGEN WIRD, obwohl es das Haus sonst tut (repo-pg.integration.test.ts:99).
// Diese Datei existiert zu genau einem Zweck: die Rangfolge an einer echten Datenbank zu BELEGEN.
// Ein Skip wäre hier kein milder Ausfall, sondern die stille Grünbehauptung, gegen die der Auftrag
// (§7 A3) ausdrücklich steht: „Kein `skip`, kein aufgeweichter Fall, keine Grünbehauptung aus dem
// Strukturwächter." Fehlt Postgres, sagt jeder Fall im Klartext, dass der Beleg NICHT geführt ist.
// Der reguläre Torlauf ist davon unberührt — Integrationstests laufen nur unter `test:integration`
// (vitest.config.ts:32).
//
// Der Aufbau ist der vorhandene und KEIN zweiter: lokale Instanz über die Sicherung
// `guardedLocalPgTestUrl` (services/db-tx/src/pg-test-guard.ts), sonst Testcontainers — wörtlich
// die Reihenfolge aus `repo-pg.integration.test.ts:55-92`.

// Bestand, Suchwörter und erwartete Rangfolge stehen in
// `tests/live-check-postgres-prefilter/bestand.ts` — DIESELBEN, mit denen der reguläre Lauf den
// Massstab misst (`speicher-rangfolge.test.ts`). Eine zweite Abschrift gäbe es nur, damit sie eines
// Tages auseinanderlaufen kann.

describe("JOB 3583 · V1: PgKoRepo.findCandidates wählt wie InMemoryKoRepo (echtes Postgres)", () => {
  let container: StartedTestContainer | undefined;
  let pool: Pool | undefined;
  let speicher: InMemoryKoRepo | undefined;
  let grund = "";

  beforeAll(async () => {
    const localUrl = guardedLocalPgTestUrl();
    if (localUrl) {
      try {
        pool = new Pool({ connectionString: localUrl });
        await pool.query("SELECT 1");
      } catch (err) {
        pool = undefined;
        grund = `KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich: ${String(err)}`;
      }
    } else if (process.env.KLARWERK_PG_TEST_URL) {
      // Die Sicherung hat die URL abgelehnt (Grund steht auf stderr) — kein Testcontainers-Ersatz:
      // der Aufrufer wollte ausdrücklich eine bestimmte Instanz.
      grund = "KLARWERK_PG_TEST_URL wurde von der Testdatenbank-Sicherung abgelehnt.";
    } else {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
        pool = new Pool({
          connectionString: `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`,
        });
      } catch (err) {
        grund = `Kein Docker-Daemon / kein Postgres-Container: ${String(err)}`;
      }
    }
    if (!pool) {
      return;
    }
    await pool.query("DROP TABLE IF EXISTS kos CASCADE");
    await pool.query(KO_SCHEMA);
    const pg = new PgKoRepo(pool);
    const mem = new InMemoryKoRepo();
    for (const eintrag of BESTAND) {
      await pg.insert(eintrag);
      await mem.insert(eintrag);
    }
    speicher = mem;
  });

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  /**
   * Ohne erreichbares Postgres wird hier NICHT übersprungen, sondern im Klartext gesagt, dass der
   * Beleg fehlt (Auftrag §7 A3).
   */
  function beideAdapter(): { pg: PgKoRepo; speicher: InMemoryKoRepo } {
    if (!pool || !speicher) {
      throw new Error(
        `JOB 3583 V1 NICHT BELEGT: ohne erreichbares Postgres ist die Rangfolge des Prefilters nicht messbar. ${grund}`,
      );
    }
    return { pg: new PgKoRepo(pool), speicher };
  }

  async function beide(
    terms: readonly string[],
    limit: number,
  ): Promise<{ postgres: string[]; imSpeicher: string[] }> {
    const { pg, speicher: mem } = beideAdapter();
    const frage = { terms: [...terms], limit };
    return {
      postgres: (await pg.findCandidates(frage)).map((k) => k.id),
      imSpeicher: (await mem.findCandidates(frage)).map((k) => k.id),
    };
  }

  it("MESSUNG · derselbe Bestand, dieselben zwölf Wörter, dasselbe Limit → dieselben Kennungen", async () => {
    const { postgres, imSpeicher } = await beide(TERME, 3);
    // Der Speicherbestand ist der Massstab; die Zahlenfolge steht zusätzlich literal da, damit ein
    // gleichzeitiger Fehler in BEIDEN Adaptern nicht als Gleichheit durchginge.
    expect(imSpeicher).toEqual(ERWARTETE_REIHENFOLGE.slice(0, 3));
    expect(postgres).toEqual(imSpeicher);
    // Der Kern des Auftrags: das score-starke, NICHT validierte Objekt überlebt den Deckel.
    expect(postgres).toContain("stark-offen");
  });

  it("auch ohne Deckel ist die ganze Reihenfolge dieselbe", async () => {
    const { postgres, imSpeicher } = await beide(TERME, 10);
    expect(imSpeicher).toEqual(ERWARTETE_REIHENFOLGE);
    expect(postgres).toEqual(imSpeicher);
  });

  it("bei GLEICHER Trefferzahl bleibt validiert vor offen und höherer Trust vorn", async () => {
    // `pumpe` trifft genau zwei Objekte, beide mit Trefferzahl 1: das validierte muss überleben.
    // Das ist der Bestandsfall repo-candidates.test.ts:54-70 an einer echten Datenbank.
    const eins = await beide(["pumpe"], 1);
    expect(eins.imSpeicher).toEqual(["validiert-zwei"]);
    expect(eins.postgres).toEqual(eins.imSpeicher);
    const beideTreffer = await beide(["pumpe"], 5);
    expect(beideTreffer.imSpeicher).toEqual(["validiert-zwei", "stark-offen"]);
    expect(beideTreffer.postgres).toEqual(beideTreffer.imSpeicher);
  });

  it("ein Term, der in mehreren Feldern DESSELBEN Objekts steht, zählt EINMAL", async () => {
    // `offen-klein` trägt `leitung` im Titel UND in der Aussage. Alle drei Treffer haben deshalb
    // die Trefferzahl 1, und es entscheiden validiert und Trust. Zählte Postgres je FELD statt je
    // TERM, käme `offen-klein` mit 2 vor das validierte `validiert-hoch` — genau die Verstellung
    // der Gegenprobe A8.
    const { postgres, imSpeicher } = await beide(["leitung", "wartung"], 5);
    expect(imSpeicher).toEqual(["validiert-hoch", "offen-klein", "stark-offen"]);
    expect(postgres).toEqual(imSpeicher);
  });

  it("der Deckel ist hart: nie mehr Zeilen als `limit`", async () => {
    for (const limit of [1, 2, 4]) {
      const { postgres, imSpeicher } = await beide(TERME, limit);
      expect(postgres).toHaveLength(limit);
      expect(postgres).toEqual(imSpeicher);
    }
  });

  it("Zustandsmodell: leere Terme, kein Treffer und limit 0 → leere Liste, kein All-Pool", async () => {
    expect(await beide([], 10)).toEqual({ postgres: [], imSpeicher: [] });
    expect(await beide(["aktienkurs"], 10)).toEqual({ postgres: [], imSpeicher: [] });
    expect(await beide(TERME, 0)).toEqual({ postgres: [], imSpeicher: [] });
  });

  // ----------------------------------------------------------------------------------------------
  // LIEFERUNG 5 — DIE FELDGRENZEN-ABWEICHUNG: GEMESSEN, BENANNT, NICHT GEÄNDERT.
  // ----------------------------------------------------------------------------------------------
  // `koCandidateText` (repo.ts:253-255) fügt Titel, Aussage, Schlagworte, Kategorie und Bildfussnoten
  // zu EINEM Text zusammen und sucht den Term darin; Postgres prüft dieselben Felder EINZELN
  // (repo-pg.ts:23-31). Ein Term, der über eine Feldgrenze reicht, trifft deshalb nur im
  // Speicherbestand. Dieser Fall HÄLT die Abweichung fest, statt sie zu beheben — die Behebung wäre
  // eine Änderung an `repo.ts` oder an `KO_CANDIDATE_SEARCH` und ist ausdrücklich nicht Gegenstand
  // dieses Auftrags (§10). Ob sie im Alltag der zwölf Suchwörter überhaupt auftreten kann, misst
  // tests/live-check-postgres-prefilter/feldgrenzen-messung.test.ts im regulären Lauf.
  it("BEKANNTE ABWEICHUNG: ein Term über eine Feldgrenze trifft nur im Speicherbestand", async () => {
    const { postgres, imSpeicher } = await beide(["winter frostgefahr"], 10);
    expect(imSpeicher).toEqual(["stark-offen"]);
    expect(postgres).toEqual([]);
  });
});
