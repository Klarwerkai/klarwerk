// ================================================================================================
// KENNTNISNAHME · DIE POSTGRESQL-ABLAGE UNTER ECHTER DATENBANK.
// ================================================================================================
//
// Gegen ein frisches Postgres (Testcontainers) mit der produktiven Migration (`migrate`). Gemessen
// wird die Ablage, auf die der Betrieb sich verlässt:
//
//   P1  (K4) Zwei gleichzeitige Anforderungen derselben Fassung an dieselben Empfänger ergeben
//       genau eine Anforderung; ein Teil-Überlapp trägt nur die Neuen ein.
//   P2  (K4) Zwei gleichzeitige Bestätigungen: genau eine schreibt, beide sehen denselben Zeitpunkt;
//       eine spätere ändert nichts. Eine NEUE Ablage auf demselben Pool (Neustart) liest denselben
//       Stand.
//   P3  (K3) V2 und V3 sind getrennte Schlüssel: derselbe Empfänger bekommt V3 neu, V2 bleibt
//       mit seiner Bestätigung stehen.
//   P4  Die Migration ist wiederholbar.
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import {
  type Kenntnisnahmeanforderung,
  PgKenntnisnahmeRepo,
} from "../../services/app/src/kenntnisnahme";

describe("Kenntnisnahme · PostgreSQL-Ablage", () => {
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
    pool.options.max = 6;
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
    // Nur die eigenen Testdaten zurücksetzen; die Tabellen legt die produktive Migration an.
    await pool.query("TRUNCATE kenntnisnahme_empfaenger, kenntnisnahme_anforderungen");
  });

  const anforderung = (
    id: string,
    fassung: number,
    am = "2026-10-06T08:00:00.000Z",
  ): Kenntnisnahmeanforderung => ({
    id,
    koId: "ko-beispiel-1",
    fassung,
    angefordertVon: "konto-clara",
    angefordertAm: am,
    frist: "2026-10-07T08:00:00.000Z",
    erinnertAm: null,
  });

  it("P1 · gleichzeitige Anforderungen ergeben genau eine; Überlapp nur mit den Neuen", async () => {
    const repo = new PgKenntnisnahmeRepo(pool);
    const [a, b] = await Promise.all([
      repo.anlegen(anforderung("anf-a", 2), ["konto-erik", "konto-vera"]),
      repo.anlegen(anforderung("anf-b", 2), ["konto-erik", "konto-vera"]),
    ]);
    expect([a.angelegt, b.angelegt].sort()).toEqual([false, true]);
    const angelegt = a.angelegt ? "anf-a" : "anf-b";
    const kopf = await pool.query("SELECT id FROM kenntnisnahme_anforderungen");
    expect(kopf.rows.map((z) => z.id)).toEqual([angelegt]);

    const dritte = await repo.anlegen(anforderung("anf-c", 2), ["konto-erik", "konto-fiona"]);
    expect(dritte).toEqual({ angelegt: true, neu: ["konto-fiona"] });
    const zeilen = await pool.query(
      "SELECT empfaenger_id FROM kenntnisnahme_empfaenger ORDER BY empfaenger_id",
    );
    expect(zeilen.rows.map((z) => z.empfaenger_id)).toEqual([
      "konto-erik",
      "konto-fiona",
      "konto-vera",
    ]);
  });

  it("P2 · gleichzeitige Bestätigungen schreiben genau einmal; der Stand überlebt den Neustart", async () => {
    const repo = new PgKenntnisnahmeRepo(pool);
    await repo.anlegen(anforderung("anf-1", 2), ["konto-erik"]);
    const [eins, zwei] = await Promise.all([
      repo.bestaetigen("anf-1", "konto-erik", "2026-10-06T09:00:00.000Z"),
      repo.bestaetigen("anf-1", "konto-erik", "2026-10-06T09:00:01.000Z"),
    ]);
    expect([eins?.neu, zwei?.neu].sort()).toEqual([false, true]);
    expect(eins?.eintrag.bestaetigtAm).toBe(zwei?.eintrag.bestaetigtAm);
    const erste = eins?.eintrag.bestaetigtAm;

    const spaeter = await repo.bestaetigen("anf-1", "konto-erik", "2026-10-08T09:00:00.000Z");
    expect(spaeter).toMatchObject({ neu: false, eintrag: { bestaetigtAm: erste } });
    expect(await repo.bestaetigen("anf-1", "konto-fremd", "2026-10-06T09:00:00.000Z")).toBe(
      undefined,
    );

    // Neustart: eine neue Ablage auf derselben Datenbank.
    const neu = new PgKenntnisnahmeRepo(pool);
    expect(await neu.eintraegeFuer("konto-erik")).toEqual([
      {
        anforderungId: "anf-1",
        koId: "ko-beispiel-1",
        fassung: 2,
        empfaengerId: "konto-erik",
        bestaetigtAm: erste,
      },
    ]);
    expect(await neu.anforderung("anf-1")).toEqual(anforderung("anf-1", 2));
    await neu.erinnern("anf-1", "2026-10-06T10:00:00.000Z");
    expect((await repo.anforderung("anf-1"))?.erinnertAm).toBe("2026-10-06T10:00:00.000Z");
  });

  it("P3 · V2 und V3 sind getrennte Vorgänge desselben Empfängers", async () => {
    const repo = new PgKenntnisnahmeRepo(pool);
    await repo.anlegen(anforderung("anf-v2", 2), ["konto-erik"]);
    await repo.bestaetigen("anf-v2", "konto-erik", "2026-10-06T09:00:00.000Z");
    const v3 = await repo.anlegen(anforderung("anf-v3", 3, "2026-10-07T08:00:00.000Z"), [
      "konto-erik",
    ]);
    expect(v3).toEqual({ angelegt: true, neu: ["konto-erik"] });
    const eintraege = await repo.eintraegeFuer("konto-erik");
    eintraege.sort((a, b) => a.fassung - b.fassung);
    expect(eintraege.map((e) => [e.anforderungId, e.fassung, e.bestaetigtAm])).toEqual([
      ["anf-v2", 2, "2026-10-06T09:00:00.000Z"],
      ["anf-v3", 3, null],
    ]);
    expect((await repo.anforderungenZu("ko-beispiel-1")).map((a) => a.id).sort()).toEqual([
      "anf-v2",
      "anf-v3",
    ]);
  });

  it("P4 · die Migration läuft ein zweites Mal folgenlos", async () => {
    const repo = new PgKenntnisnahmeRepo(pool);
    await repo.anlegen(anforderung("anf-x", 2), ["konto-erik"]);
    await migrate(pool);
    expect(await repo.eintraegeZu("anf-x")).toHaveLength(1);
  });
});
