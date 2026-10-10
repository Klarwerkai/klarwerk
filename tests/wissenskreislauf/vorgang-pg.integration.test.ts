// ================================================================================================
// produkt:20261010:wissenskreislauf-schliessen — DER VORGANG GEGEN ECHTES POSTGRESQL.
// ================================================================================================
//
// Neu am Speicherweg sind zwei Anweisungen in `PgGapRepo`, und beide tragen eine Zusage, die nur
// eine echte Datenbank belegen kann:
//
//   Q1 · Mehrere Fragende derselben offenen Frage — auch GLEICHZEITIG — landen in EINER Zeile:
//        `askCount` zählt jede Frage, `weitereFragende` nennt jede weitere Person genau einmal und
//        nie den Ersteller (`INSERT … ON CONFLICT` + `UPDATE … jsonb_set`, eine Anweisung).
//   Q2 · Zwei gleichzeitige fachliche Abschlüsse schreiben höchstens EINEN (`updateWennOffen`:
//        `UPDATE … WHERE status = 'offen'`); ein Abschluss ohne vorgeschriebene Fachfreigabe
//        schreibt nichts. Nach einem Neustart (neuer Pool, neue Dienste) stehen Abschluss, Fassung
//        und je Fragendem genau eine Erfolgsmeldung da.
//
// INFRASTRUKTUR wie `tests/wissensluecken-etikett/pg-speicherweg.integration.test.ts`:
// `KLARWERK_PG_TEST_URL` (Datenbankname mit `test`), sonst ein Wegwerf-Container. Fehlt beides,
// SCHEITERT der Lauf — kein stiller Skip. Alle Kennungen und Inhalte sind erfundene Testdaten.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

const FRAGE = "Wie wird der Zyrlax-Kreislauf der Quorbit-Presse nach dem Stillstand eingestellt?";
const ALLE = (): boolean => true;

describe("Wissenskreislauf gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let verwaltung: Pool | undefined;
  let datenbank = "";
  let url = "";
  const pools: Pool[] = [];

  function dienste() {
    const pool = createPool(url);
    pools.push(pool);
    return { pool, services: buildPgServices(pool) };
  }

  beforeAll(async () => {
    let basis: string;
    const lokal = guardedLocalPgTestUrl();
    if (lokal) {
      basis = lokal;
    } else if (process.env.KLARWERK_PG_TEST_URL) {
      throw new Error(
        "KLARWERK_PG_TEST_URL abgelehnt (Grund auf stderr) — kein Container-Rückfall",
      );
    } else {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
      } catch (cause) {
        throw new Error("Weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar", {
          cause,
        });
      }
      basis = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
    }
    datenbank = `klarwerk_kreislauf_test_${`${Date.now()}`.slice(-9)}`;
    verwaltung = new Pool({ connectionString: basis });
    await verwaltung.query(`CREATE DATABASE ${datenbank}`);
    const ziel = new URL(basis);
    ziel.pathname = `/${datenbank}`;
    url = ziel.toString();
    const pool = createPool(url);
    try {
      await migrate(pool);
      await buildPgServices(pool).ko.activateSearchProjectionV2();
    } finally {
      await pool.end();
    }
  }, 300_000);

  afterAll(async () => {
    for (const p of pools) {
      await p.end().catch(() => undefined);
    }
    if (verwaltung) {
      await verwaltung
        .query(`DROP DATABASE IF EXISTS ${datenbank} WITH (FORCE)`)
        .catch(() => undefined);
      await verwaltung.end();
    }
    await container?.stop();
  }, 120_000);

  it("Q1/Q2 · eine Zeile für alle Fragenden, höchstens ein Abschluss, Meldungen nach Neustart", async () => {
    const { pool, services } = dienste();
    const frage = (wer: string) => services.ask.ask(FRAGE, wer, "de", undefined, ALLE);

    // Q1 — der Ersteller, dann drei weitere Personen GLEICHZEITIG, eine davon doppelt.
    const erste = await frage("frida-pg");
    const gapId = erste.gap?.id ?? "";
    expect(gapId, "KALIBRIERUNG: die Frage bleibt unbeantwortet und wird eine Lücke").not.toBe("");
    const parallel = await Promise.all([
      frage("fritz-pg"),
      frage("greta-pg"),
      frage("hans-pg"),
      frage("fritz-pg"),
    ]);
    expect(parallel.map((r) => r.gap?.id)).toEqual([gapId, gapId, gapId, gapId]);
    const zeile = await pool.query<{ data: { askCount: number; weitereFragende: string[] } }>(
      "SELECT data FROM gaps WHERE id = $1",
      [gapId],
    );
    expect(zeile.rows[0]?.data.askCount).toBe(5);
    expect([...(zeile.rows[0]?.data.weitereFragende ?? [])].sort()).toEqual([
      "fritz-pg",
      "greta-pg",
      "hans-pg",
    ]);
    const anzahl = await pool.query("SELECT 1 FROM gaps WHERE data->>'compareKey' = $1", [
      erste.gap?.compareKey ?? "",
    ]);
    expect(anzahl.rowCount, "keine Kopie der Lücke").toBe(1);

    // Q2 — ohne Fachfreigabe schreibt der Abschluss nichts.
    const ko = await services.ko.create({
      title: "Kälteanlage im Wiederanlauf hochfahren",
      statement: "Ventil V7 erst bei Druckausgleich öffnen, dann Pumpe P2 starten.",
      type: "best_practice",
      category: "Instandhaltung",
      author: "fachmann-pg",
    });
    const fachmann = { id: "fachmann-pg", sichtbar: ALLE };
    await expect(services.ask.closeGap(gapId, ko.id, fachmann)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    for (let i = 0; i < ko.neededValidations; i++) {
      await services.validation.rate(ko.id, `pruefer-pg-${i}`, "up");
    }
    // Zwei gleichzeitige Abschlüsse: genau einer schreibt, beide sehen denselben Abschluss.
    const [a, b] = await Promise.all([
      services.ask.closeGap(gapId, ko.id, fachmann),
      services.ask.closeGap(gapId, ko.id, fachmann),
    ]);
    expect(a.abschluss).toEqual(b.abschluss);
    expect(await services.audit.list({ action: "gap.closed" })).toHaveLength(1);

    // Neustart: neuer Pool, neue Dienste — gelesen wird, was in PostgreSQL steht.
    const zweite = dienste().services;
    const gelesen = (await zweite.ask.listGaps()).find((g) => g.id === gapId);
    expect(gelesen?.status).toBe("geschlossen");
    expect(gelesen?.abschluss).toMatchObject({ art: "fachlich", koId: ko.id, koVersion: 1 });
    for (const wer of ["frida-pg", "fritz-pg", "greta-pg", "hans-pg"]) {
      const geloest = (await zweite.ask.gapMeldungenFuer(wer, ALLE)).filter(
        (m) => m.art === "geloest",
      );
      expect(geloest, wer).toHaveLength(1);
      expect(geloest[0]?.koId).toBe(ko.id);
    }
    expect(await zweite.ask.gapMeldungenFuer("unbeteiligt-pg", ALLE)).toEqual([]);
    // Die Wiederholungsfrage nutzt denselben Eintrag und legt keine neue Zeile an.
    const wieder = await zweite.ask.ask(FRAGE, "ida-pg", "de", undefined, ALLE);
    expect(wieder.gap).toBeNull();
    expect(wieder.geloesteLuecke?.koId).toBe(ko.id);
  }, 180_000);
});
