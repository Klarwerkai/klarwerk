// ================================================================================================
// VERÖFFENTLICHUNG · DIE ZUSTELLUNGSABLAGE UNTER ECHTER DATENBANK (Ben, Nacharbeit 8).
// ================================================================================================
//
// Gegen ein frisches Postgres (Testcontainers) mit der produktiven Migration (`migrate`). Gemessen
// wird die Ablage, an der der angekündigte Empfängerkreis hängt:
//
//   Z1  (K1/K3) Nur angelegte Empfänger bekommen Zustellungen; eine Wiederholung legt nichts
//       doppelt an; eine NEUE Ablage auf demselben Pool (Neustart) liest denselben Stand.
//   Z2  (K3) Je Konto: ALLE hervorgehobenen und nur die jüngsten `fenster` gewöhnlichen — fremde
//       Zustellungen zählen nicht gegen das Fenster.
//   Z3  Die Migration ist wiederholbar.
//   Z4  (K3, Ben Nacharbeit 11) Im Transaktionskontext des Vermerks: ein Rollback hinterlässt keine
//       Zustellung.
//   Z5  Verwaiste Zeilen lassen sich gezielt (je Vermerk und Empfänger) entfernen.
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import {
  PgVeroeffentlichungsZustellungRepo,
  type VeroeffentlichungsZustellung,
} from "../../services/app/src/veroeffentlichung";
import { withPgTx } from "../../services/db-tx";

describe("Veröffentlichung · PostgreSQL-Zustellungsablage", () => {
  let container: StartedTestContainer | undefined;
  let pool: Pool;

  beforeAll(async () => {
    container = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    pool = createPool(
      `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`,
    );
    await migrate(pool);
  });

  afterAll(async () => {
    try {
      await pool?.end();
    } finally {
      await container?.stop();
    }
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE veroeffentlichung_zustellungen");
  });

  const zustellung = (
    vermerkId: string,
    empfaengerId: string,
    sekunde: number,
    hervorgehoben: boolean,
  ): VeroeffentlichungsZustellung => ({
    vermerkId,
    koId: `ko-${vermerkId}`,
    empfaengerId,
    am: new Date(Date.UTC(2026, 9, 9, 8, 0, sekunde)).toISOString(),
    hervorgehoben,
  });

  it("Z1 · nur der angelegte Kreis, keine Doppelten, Stand überlebt eine neue Ablage", async () => {
    const repo = new PgVeroeffentlichungsZustellungRepo(pool);
    const kreis = [zustellung("v1", "konto-ada", 0, true), zustellung("v1", "konto-vera", 0, true)];
    await repo.anlegen(kreis);
    await repo.anlegen(kreis);
    const neu = new PgVeroeffentlichungsZustellungRepo(pool);
    expect(await neu.fuer("konto-ada", 100)).toEqual([kreis[0]]);
    expect(await neu.fuer("konto-vera", 100)).toEqual([kreis[1]]);
    expect(await neu.fuer("konto-erik", 100)).toEqual([]);
  });

  it("Z2 · alle hervorgehobenen plus die jüngsten gewöhnlichen dieses Kontos", async () => {
    const repo = new PgVeroeffentlichungsZustellungRepo(pool);
    await repo.anlegen([zustellung("wichtig", "konto-erik", 0, true)]);
    const gewoehnlich = Array.from({ length: 5 }, (_, i) =>
      zustellung(`normal-${i}`, "konto-erik", i + 1, false),
    );
    await repo.anlegen(gewoehnlich);
    // Fremde Zustellungen zählen nicht gegen Eriks Fenster.
    await repo.anlegen(
      Array.from({ length: 10 }, (_, i) => zustellung(`fremd-${i}`, "konto-vera", i + 10, false)),
    );
    const geliefert = await repo.fuer("konto-erik", 3);
    expect(geliefert.map((z) => z.vermerkId).sort()).toEqual(
      ["normal-2", "normal-3", "normal-4", "wichtig"].sort(),
    );
  });

  it("Z4 · im Transaktionskontext: ein Rollback hinterlässt keine Zustellung (Ben, Nacharbeit 11)", async () => {
    const repo = new PgVeroeffentlichungsZustellungRepo(pool);
    await expect(
      withPgTx(pool, async (tx) => {
        await repo.anlegen([zustellung("abgelehnt", "konto-erik", 0, false)], tx);
        throw new Error("fachliche Ablehnung nach dem Anlegen");
      }),
    ).rejects.toThrow("fachliche Ablehnung");
    expect(await repo.fuer("konto-erik", 100)).toEqual([]);
    await withPgTx(pool, (tx) => repo.anlegen([zustellung("gueltig", "konto-erik", 1, false)], tx));
    expect((await repo.fuer("konto-erik", 100)).map((z) => z.vermerkId)).toEqual(["gueltig"]);
  });

  it("Z5 · verwaiste Zeilen lassen sich gezielt entfernen", async () => {
    const repo = new PgVeroeffentlichungsZustellungRepo(pool);
    await repo.anlegen([
      zustellung("verwaist", "konto-erik", 0, false),
      zustellung("gueltig", "konto-erik", 1, false),
      zustellung("verwaist", "konto-vera", 0, false),
    ]);
    await repo.entfernen([{ vermerkId: "verwaist", empfaengerId: "konto-erik" }]);
    expect((await repo.fuer("konto-erik", 100)).map((z) => z.vermerkId)).toEqual(["gueltig"]);
    expect((await repo.fuer("konto-vera", 100)).map((z) => z.vermerkId)).toEqual(["verwaist"]);
  });

  it("Z3 · die Migration ist wiederholbar", async () => {
    await expect(migrate(pool)).resolves.toBeUndefined();
  });
});
