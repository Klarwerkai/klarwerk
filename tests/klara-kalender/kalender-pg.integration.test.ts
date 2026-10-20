// ================================================================================================
// KLARA 11 (produkt:20261008:klara-kalender) · ANBINDUNG, ZUORDNUNG, SPERRMARKE GEGEN ECHTES POSTGRES.
// ================================================================================================
//
// Dieselbe Ablage wie im Betrieb (`PgKalenderZuordnungRepo`), das ausgeführte `migrate()` mit
// `KLARA_KALENDER_SCHEMA`, ein NEUER Pool je „Server“. Belegt wird, dass Anbindung, Zuordnung samt
// externer Kennung und Anbieterfassung, gespeicherter interner Termin, offene Entscheidung,
// Löschkonflikt, Sperrmarke und Laufstand einen Neustart überstehen — und dass ein fremdes Konto
// nichts davon sieht. Der Kalender ist das strenge Vertragsdouble (kein Microsoft 365); er bleibt
// über die „Neustarts“ hinweg derselbe, wie ein externer Kalender es täte.
//
// INFRASTRUKTUR: `KLARWERK_PG_TEST_URL` (Datenbankname mit `test`, s. `guardedLocalPgTestUrl`),
// sonst ein Wegwerf-Container. Fehlt beides, SCHEITERT der Lauf — kein stiller Skip.
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import {
  KalenderAnbindungDienst,
  PgKalenderZuordnungRepo,
  pruefeInternenTermin,
} from "../../services/app/src/klara-kalender-anbindung";
import { gatedPool, guardedLocalPgTestUrl } from "../../services/db-tx";
import { DOUBLE_KALENDER, StrengerTestkalender, testTermin } from "./vertragsdouble";

const ANNA = "u-pg-kalender-anna";
const BERT = "u-pg-kalender-bert";

describe("Klara 11 · Kalenderanbindung gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let url = "";
  const pools: Pool[] = [];
  const kalender = new StrengerTestkalender();
  let uhr = Date.parse("2026-10-15T08:00:00.000Z");

  /** Ein frischer Dienst auf einem frischen Pool — so sieht ein Neustart des Servers aus. */
  function neuerDienst(): KalenderAnbindungDienst {
    const pool = createPool(url);
    pools.push(pool);
    return new KalenderAnbindungDienst({
      repo: new PgKalenderZuordnungRepo(pool),
      anbieterFuer: async (kontoId) => (kontoId === ANNA ? kalender : null),
      jetzt: () => {
        uhr += 1_000;
        return uhr;
      },
    });
  }

  beforeAll(async () => {
    const lokal = guardedLocalPgTestUrl();
    if (lokal) {
      url = lokal;
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
      url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
    }
    const pool = createPool(url);
    try {
      // Zweimal: die Stufe ist wiederholbar und lässt den Bestand stehen.
      await migrate(pool);
      await migrate(pool);
      for (const tabelle of ["klara_kalender_anbindungen", "klara_kalender_zuordnungen"]) {
        await pool.query(`DELETE FROM ${tabelle} WHERE konto_id = ANY($1)`, [[ANNA, BERT]]);
      }
    } finally {
      await pool.end();
    }
  }, 180_000);

  afterAll(async () => {
    for (const pool of pools) {
      await pool.end();
    }
    await container?.stop();
  });

  it("Anbindung, Zuordnung, Pause, Löschkonflikt und Ende überstehen jeden Neustart", async () => {
    const a = await neuerDienst().verbinde(ANNA, {
      kalenderId: DOUBLE_KALENDER.id,
      umfang: "lesen_schreiben",
    });
    const t1 = pruefeInternenTermin(testTermin("ereignis-1"));
    const t2 = pruefeInternenTermin(testTermin("ereignis-2", "Audit vorbereiten"));
    const r1 = await neuerDienst().projiziere(ANNA, a.id, t1);
    expect(r1.ok).toBe(true);
    await neuerDienst().projiziere(ANNA, a.id, t2);

    // Neustart: Anbindung und Zuordnungen samt Kennung, Fassung und internem Termin sind da.
    const nachStart = neuerDienst();
    expect((await nachStart.anbindungen(ANNA)).map((x) => x.id)).toEqual([a.id]);
    const zs = await nachStart.zuordnungen(ANNA, a.id);
    expect(zs).toHaveLength(2);
    const z1 = zs.find((z) => z.ereignisId === "ereignis-1");
    expect(z1).toMatchObject({
      externeId: r1.ok ? r1.zuordnung.externeId : "",
      anbieterVersion: r1.ok ? r1.zuordnung.anbieterVersion : "",
      stand: "projiziert",
      intern: { inhalt: { titel: "Zertifikat TÜV verlängern", zeitzone: "Europe/Berlin" } },
    });

    // Externe Löschung → Abgleich aus dem gespeicherten Stand → nur dieser Lauf pausiert, dauerhaft.
    kalender.termine.delete(z1?.externeId ?? "");
    await neuerDienst().gleicheAlleAb(ANNA, a.id);
    expect(await neuerDienst().laufStand(ANNA, t1.auftragId, "ereignis-1")).toBe("pausiert");
    expect(await neuerDienst().laufStand(ANNA, t2.auftragId, "ereignis-2")).toBe("laeuft");

    // Dialogschließen über einen Neustart hinweg: weiterhin pausiert.
    await neuerDienst().entscheide(ANNA, a.id, t1, { wahl: "dialog_geschlossen" });
    expect(await neuerDienst().laufStand(ANNA, t1.auftragId, "ereignis-1")).toBe("pausiert");

    // Beenden mit Umfang: Sperrmarke dauerhaft; ein verspäteter Abgleich stellt nichts her.
    await neuerDienst().entscheide(ANNA, a.id, t1, { wahl: "beenden", umfang: "einzeltermin" });
    await neuerDienst().gleicheAlleAb(ANNA, a.id);
    const gesperrt = await neuerDienst().zuordnung(ANNA, z1?.schluessel ?? "");
    expect(gesperrt.sperrmarke).toMatchObject({ grund: "beendet", umfang: "einzeltermin" });
    expect(await neuerDienst().laufStand(ANNA, t1.auftragId, "ereignis-1")).toBe("beendet");

    // Löschkonflikt an Termin 2 überlebt den Neustart ebenso.
    const v = await neuerDienst().loeschVorschau(ANNA, a.id, t2, "einzeltermin");
    const z2 = (await neuerDienst().zuordnungen(ANNA, a.id)).find(
      (z) => z.ereignisId === "ereignis-2",
    );
    kalender.aendereExtern(z2?.externeId ?? "", { titel: "fremd geändert" });
    const r = await neuerDienst().loesche(ANNA, a.id, t2, {
      umfang: "einzeltermin",
      fassung: v.ok ? v.fassung : "",
    });
    expect(r).toMatchObject({ ok: false, grund: "version_geaendert" });
    const nachKonflikt = await neuerDienst().zuordnung(ANNA, z2?.schluessel ?? "");
    expect(nachKonflikt.entscheidung?.anlass).toBe("loeschen_veraltet");
    expect(kalender.termine.has(z2?.externeId ?? "")).toBe(true);
    expect(kalender.ohneFassung).toEqual([]);
  });

  it("ein fremdes Konto sieht weder Anbindung noch Zuordnung noch einen Laufstand", async () => {
    const fremd = neuerDienst();
    expect(await fremd.anbindungen(BERT)).toEqual([]);
    const eigene = await neuerDienst().anbindungen(ANNA);
    const id = eigene[0]?.id ?? "";
    await expect(fremd.zuordnungen(BERT, id)).rejects.toMatchObject({ status: 404 });
    const z = (await neuerDienst().zuordnungen(ANNA, id))[0];
    await expect(fremd.zuordnung(BERT, z?.schluessel ?? "")).rejects.toMatchObject({
      status: 404,
    });
    expect(await fremd.laufStand(BERT, "auftrag-zertifikat-3", "ereignis-1")).toBe("laeuft");
  });
  it("Entfernen: offene Entscheidung verhindert Löschung; bestätigtes Ende bleibt nach frischem Pool nur als inhaltsfreier Sperrbeleg", async () => {
    const d = neuerDienst();
    const a = await d.verbinde(ANNA, { kalenderId: DOUBLE_KALENDER.id, umfang: "lesen_schreiben" });
    const t = pruefeInternenTermin(
      testTermin("entfernen-1", "Privater Termintext nur bis Entfernen"),
    );
    const r = await d.projiziere(ANNA, a.id, t);
    if (!r.ok) throw new Error("Projektion fehlt");
    kalender.termine.delete(r.zuordnung.externeId ?? "");
    await d.gleicheAlleAb(ANNA, a.id);
    await expect(d.entferneAnbindung(ANNA, a.id, true)).rejects.toMatchObject({
      status: 409,
      grund: "pausiert",
    });
    expect(await d.vorkommenSperre(ANNA, t.auftragId, t.ereignisId)).toBe("pausiert");
    await d.entscheide(ANNA, a.id, t, { wahl: "beenden", umfang: "einzeltermin" });
    const vorher = [...kalender.aufrufe];
    await d.entferneAnbindung(ANNA, a.id, true);
    expect(kalender.aufrufe).toEqual(vorher);
    const neu = neuerDienst();
    await expect(neu.zuordnung(ANNA, r.zuordnung.schluessel)).rejects.toMatchObject({
      status: 404,
    });
    expect(await neu.vorkommenSperre(ANNA, t.auftragId, t.ereignisId)).toBe("beendet");
    const pool = createPool(url);
    pools.push(pool);
    const raw = (
      await pool.query<{ data: Record<string, unknown> }>(
        "SELECT data FROM klara_kalender_zuordnungen WHERE schluessel = $1",
        [r.zuordnung.schluessel],
      )
    ).rows[0]?.data;
    expect(raw).toMatchObject({
      entfernt: true,
      entscheidung: null,
      sperrmarke: { grund: "beendet", version: null },
    });
    expect(Object.keys(raw ?? {}).sort()).toEqual(
      [
        "entfernt",
        "schluessel",
        "kontoId",
        "anbindungId",
        "auftragId",
        "ereignisId",
        "sperrmarke",
        "entscheidung",
        "geaendertAm",
      ].sort(),
    );
    expect(JSON.stringify(raw)).not.toContain(t.inhalt.titel);
    expect(await new PgKalenderZuordnungRepo(pool).anbindung(ANNA, a.id)).toBeNull();
  });

  it("Entfernen wartet auf laufenden Zuordnungsschreibschritt und berücksichtigt dessen neue Entscheidung; nach Entfernen kann ein alter Schreiber nichts wieder anlegen", async () => {
    const d = neuerDienst();
    const a = await d.verbinde(ANNA, { kalenderId: DOUBLE_KALENDER.id, umfang: "lesen_schreiben" });
    const t = pruefeInternenTermin(testTermin("entfernen-race", "Race nur fiktiv"));
    const r = await d.projiziere(ANNA, a.id, t);
    if (!r.ok) throw new Error("Projektion fehlt");
    const pool = createPool(url);
    pools.push(pool);
    const andererPool = createPool(url);
    pools.push(andererPool);
    const repo = new PgKalenderZuordnungRepo(gatedPool(andererPool));
    const client = await pool.connect();
    let entfernen: Promise<unknown> | undefined;
    try {
      await client.query("BEGIN");
      const pid = (await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0]
        ?.pid;
      const schreiber = new PgKalenderZuordnungRepo({
        query: client.query.bind(client),
      } as unknown as Pool);
      await schreiber.speichere({
        ...r.zuordnung,
        stand: "pausiert",
        entscheidung: {
          anlass: "extern_geloescht",
          umfaenge: ["einzeltermin"],
          konflikte: [],
          seit: new Date(uhr).toISOString(),
          serienart: "einzel",
          externVersion: r.zuordnung.anbieterVersion,
        },
      });
      entfernen = repo.entferneAnbindung(ANNA, a.id, new Date(uhr).toISOString()).then(
        () => "unerwarteter Erfolg",
        (e) => e,
      );
      await expect
        .poll(
          async () =>
            (
              await andererPool.query<{ n: number }>(
                "SELECT count(*)::int AS n FROM pg_stat_activity WHERE $1::int = ANY(pg_blocking_pids(pid))",
                [pid],
              )
            ).rows[0]?.n ?? 0,
          { timeout: 5000 },
        )
        .toBeGreaterThan(0);
      await client.query("COMMIT");
      expect(await entfernen).toMatchObject({ status: 409, grund: "pausiert" });
      expect(await repo.anbindung(ANNA, a.id)).not.toBeNull();
      await d.entscheide(ANNA, a.id, t, {
        wahl: "fortfuehren_ohne_kalender",
        umfang: "einzeltermin",
      });
      expect(await repo.entferneAnbindung(ANNA, a.id, new Date(uhr).toISOString())).toBe(true);
      await expect(repo.speichere(r.zuordnung)).rejects.toMatchObject({ status: 404 });
      expect(await repo.zuordnung(ANNA, r.zuordnung.schluessel)).toBeNull();
    } finally {
      await client.query("ROLLBACK");
      client.release();
      if (entfernen) await entfernen;
    }
  });

  it("Entfernen am gated-pool: Fehler beim Elternlöschen rollt entfernte Zuordnungen zurück; fremdes Konto löscht nichts, Wiederholung gelingt", async () => {
    const d = neuerDienst();
    const a = await d.verbinde(ANNA, { kalenderId: DOUBLE_KALENDER.id, umfang: "lesen_schreiben" });
    const r = await d.projiziere(
      ANNA,
      a.id,
      pruefeInternenTermin(testTermin("entfernen-rollback")),
    );
    if (!r.ok) throw new Error("Projektion fehlt");
    const pool = createPool(url);
    pools.push(pool);
    const repo = new PgKalenderZuordnungRepo(gatedPool(pool));
    expect(await repo.entferneAnbindung(BERT, a.id, new Date(uhr).toISOString())).toBe(false);
    await pool.query(
      "CREATE FUNCTION d_anbindung_delete_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'D injected removal fault'; END $$",
    );
    await pool.query(
      "CREATE TRIGGER d_anbindung_delete_fault BEFORE DELETE ON klara_kalender_anbindungen FOR EACH ROW EXECUTE FUNCTION d_anbindung_delete_fault()",
    );
    try {
      await expect(repo.entferneAnbindung(ANNA, a.id, new Date(uhr).toISOString())).rejects.toThrow(
        "D injected removal fault",
      );
      expect(await repo.anbindung(ANNA, a.id)).toEqual(a);
      expect(await repo.zuordnung(ANNA, r.zuordnung.schluessel)).toEqual(r.zuordnung);
    } finally {
      await pool.query("DROP TRIGGER d_anbindung_delete_fault ON klara_kalender_anbindungen");
      await pool.query("DROP FUNCTION d_anbindung_delete_fault()");
    }
    expect(await repo.entferneAnbindung(ANNA, a.id, new Date(uhr).toISOString())).toBe(true);
    expect(await repo.zuordnung(ANNA, r.zuordnung.schluessel)).toBeNull();
    expect(await repo.entferneAnbindung(ANNA, a.id, new Date(uhr).toISOString())).toBe(false);
  });
});
