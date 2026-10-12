// ================================================================================================
// ADMIN-12 · KOMMUNIKATIONSREGELN · DIE ABLAGE UNTER ECHTER DATENBANK.
// ================================================================================================
//
// Gegen ein frisches Postgres (Testcontainers) mit der produktiven Migration (`migrate`). Gemessen
// wird die Ablage, an der Regeln, persönliche Abwahl und Zustellstatus hängen — fiktive Kennungen,
// kein Mailversand.
//
//   P1  (K6) Eine gespeicherte Fassung gilt nach Neustart (neue Ablage, neuer Dienst auf demselben
//       Pool); zwei gleichzeitige Änderungen derselben Fassung — genau eine gewinnt.
//   P2  (K1/K5) Persönliche Abwahl: Upsert je Konto und Ereignis, gezielte Abfrage je Kreis.
//   P3  (K4/K5) Zustellstatus: kein doppeltes Anlegen; zwei gleichzeitige Wiederaufnahmen
//       beanspruchen jede Mailzeile genau einmal; nur „angelegt" wird „zugestellt".
//   P4  (K5) Im Transaktionskontext des Vermerks: ein Rollback hinterlässt keinen Zustellstatus.
//   P5  Die Migration ist wiederholbar.
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import {
  KommunikationDienst,
  PgKommunikationRepo,
  type ZustellZeile,
} from "../../services/app/src/kommunikationsregeln";
import { withPgTx } from "../../services/db-tx";

describe("ADMIN-12 · PostgreSQL-Ablage der Kommunikationsregeln", () => {
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
    await pool.query(
      "TRUNCATE kommunikationsregel_fassungen, meldungsregel_persoenlich, meldung_zustellstatus",
    );
  });

  const dienst = (repo: PgKommunikationRepo): KommunikationDienst =>
    new KommunikationDienst({
      repo,
      mailEingerichtet: () => true,
      kontoNamen: async () => new Map([["konto-ada", "Ada Admin"]]),
      jetzt: () => Date.UTC(2026, 9, 10, 8, 0, 0),
    });

  const zeile = (
    vermerkId: string,
    empfaengerId: string,
    kanal: "glocke" | "mail",
  ): ZustellZeile => ({
    vermerkId,
    koId: `ko-${vermerkId}`,
    empfaengerId,
    kanal,
    status: "angelegt",
    angelegtAm: new Date(Date.UTC(2026, 9, 10, 8, 0, 0)).toISOString(),
    versuchAm: null,
    ergebnisAm: null,
    grund: null,
  });

  it("P1 · eine Fassung überlebt den Neustart; gleichzeitig gewinnt genau eine Änderung", async () => {
    const erst = dienst(new PgKommunikationRepo(pool));
    const { nachher } = await erst.speichern(
      { version: 0, vorgaben: { veroeffentlichung: { haeufigkeit: "taeglich" } } },
      "konto-ada",
    );
    expect(nachher.version).toBe(1);

    // Neustart: neue Ablage, neuer Dienst auf demselben Pool.
    const neu = dienst(new PgKommunikationRepo(pool));
    const geltend = await neu.regeln();
    expect(geltend.version).toBe(1);
    expect(geltend.vorgaben.veroeffentlichung).toEqual({
      abwaehlbar: true,
      haeufigkeit: "taeglich",
      mail: false,
    });
    expect((await neu.uebersicht()).geaendertVon).toEqual({ id: "konto-ada", name: "Ada Admin" });

    // Zwei Verwaltende speichern gleichzeitig auf Fassung 1 — die Ablage nimmt genau eine an.
    const [a, b] = await Promise.allSettled([
      neu.speichern({ version: 1, vorgaben: { veroeffentlichung: { abwaehlbar: false } } }, "a"),
      erst.speichern({ version: 1, vorgaben: { wirkung: { abwaehlbar: false } } }, "b"),
    ]);
    const erfolge = [a, b].filter((r) => r.status === "fulfilled");
    expect(erfolge).toHaveLength(1);
    expect((await neu.fassungen()).map((f) => f.version)).toEqual([2, 1]);
  });

  it("P2 · persönliche Abwahl: Upsert je Konto und Ereignis, Abfrage je Kreis", async () => {
    const repo = new PgKommunikationRepo(pool);
    const am = new Date(Date.UTC(2026, 9, 10, 8, 0, 0)).toISOString();
    await repo.persoenlichSetzen("konto-erik", {
      ereignis: "veroeffentlichung",
      abgewaehlt: true,
      geaendertAm: am,
    });
    await repo.persoenlichSetzen("konto-vera", {
      ereignis: "veroeffentlichung",
      abgewaehlt: true,
      geaendertAm: am,
    });
    await repo.persoenlichSetzen("konto-vera", {
      ereignis: "veroeffentlichung",
      abgewaehlt: false,
      geaendertAm: am,
    });
    const neu = new PgKommunikationRepo(pool);
    expect(await neu.persoenlich("konto-vera")).toEqual([
      { ereignis: "veroeffentlichung", abgewaehlt: false, geaendertAm: am },
    ]);
    expect(
      await neu.abgewaehlteKonten("veroeffentlichung", ["konto-erik", "konto-vera", "konto-ada"]),
    ).toEqual(new Set(["konto-erik"]));
    expect(await neu.abgewaehlteKonten("veroeffentlichung", [])).toEqual(new Set());
  });

  it("P3 · Zustellstatus: keine Doppelten, jede Mail genau einmal beansprucht, Glocke nur von angelegt", async () => {
    const repo = new PgKommunikationRepo(pool);
    const zeilen = [
      zeile("v1", "konto-erik", "glocke"),
      zeile("v1", "konto-erik", "mail"),
      zeile("v1", "konto-vera", "mail"),
      zeile("v1", "konto-fiona", "mail"),
    ];
    await repo.statusAnlegen(zeilen);
    await repo.statusAnlegen(zeilen);
    expect(await repo.statusFuer("v1")).toHaveLength(4);

    // Zwei Wiederaufnahmen gleichzeitig: zusammen genau drei Mailzeilen, keine doppelt.
    const am = new Date(Date.UTC(2026, 9, 10, 9, 0, 0)).toISOString();
    const [x, y] = await Promise.all([
      repo.mailBeanspruchen("v1", am),
      repo.mailBeanspruchen("v1", am),
    ]);
    const beansprucht = [...x, ...y].map((z) => z.empfaengerId).sort();
    expect(beansprucht).toEqual(["konto-erik", "konto-fiona", "konto-vera"]);
    expect(await repo.mailBeanspruchen("v1", am)).toEqual([]);

    await repo.ergebnis("v1", "konto-erik", "mail", "zugestellt", null, am);
    await repo.ergebnis("v1", "konto-vera", "mail", "fehlgeschlagen", "mailserver_abgelehnt", am);
    // Ein Ergebnis überschreibt kein früheres.
    await repo.ergebnis("v1", "konto-vera", "mail", "zugestellt", null, am);
    await repo.glockeZugestellt("konto-erik", ["v1"], am);
    await repo.glockeZugestellt("konto-erik", ["v1"], am);

    const stand = new Map(
      (await new PgKommunikationRepo(pool).statusFuer("v1")).map((z) => [
        `${z.empfaengerId}/${z.kanal}`,
        z,
      ]),
    );
    expect(stand.get("konto-erik/glocke")).toMatchObject({ status: "zugestellt", ergebnisAm: am });
    expect(stand.get("konto-erik/mail")).toMatchObject({ status: "zugestellt", versuchAm: am });
    expect(stand.get("konto-vera/mail")).toMatchObject({
      status: "fehlgeschlagen",
      grund: "mailserver_abgelehnt",
    });
    // Beansprucht, aber ohne Ergebnis (Abbruch mitten im Versand): bleibt „angelegt", wird nie
    // ein zweites Mal beansprucht.
    expect(stand.get("konto-fiona/mail")).toMatchObject({ status: "angelegt", versuchAm: am });
  });

  it("P4 · im Transaktionskontext: ein Rollback hinterlässt keinen Zustellstatus", async () => {
    const repo = new PgKommunikationRepo(pool);
    await expect(
      withPgTx(pool, async (tx) => {
        await repo.statusAnlegen([zeile("abgelehnt", "konto-erik", "glocke")], tx);
        throw new Error("fachliche Ablehnung nach dem Anlegen");
      }),
    ).rejects.toThrow("fachliche Ablehnung");
    expect(await repo.statusFuer("abgelehnt")).toEqual([]);
    const gueltig = zeile("gueltig", "konto-erik", "glocke");
    await withPgTx(pool, (tx) => repo.statusAnlegen([gueltig], tx));
    expect(await repo.statusFuer("gueltig")).toHaveLength(1);
  });

  it("P5 · die Migration ist wiederholbar", async () => {
    await migrate(pool);
    await migrate(pool);
    const tabellen = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN ('kommunikationsregel_fassungen', 'meldungsregel_persoenlich',
                            'meldung_zustellstatus')
       ORDER BY table_name`,
    );
    expect(tabellen.rows.map((r) => r.table_name)).toEqual([
      "kommunikationsregel_fassungen",
      "meldung_zustellstatus",
      "meldungsregel_persoenlich",
    ]);
  });
});
