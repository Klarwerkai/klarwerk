import { writeFileSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import type { KlaraErinnerungLaufbericht } from "../../services/app/src/klara-erinnerung";
import type { PflegeVorlage } from "../../services/app/src/klara-wissenspflege";
import { SPACES_SPERRE } from "../../services/app/src/spaces";
import { type Konto, neuesKonto } from "../klara-quellen-nutzerweg/kette";

describe("AW20 · echte PG-Pflegewirkung auf vorhandener Zeit-/Notizablage", () => {
  let container: StartedTestContainer;
  let pool: ReturnType<typeof createPool>;
  let zweiterPool: ReturnType<typeof createPool>;
  let app: FastifyInstance;
  let services: ReturnType<typeof buildPgServices>;
  let admin: Konto;
  let lauf: () => Promise<KlaraErinnerungLaufbericht>;
  let vorNotiz: (() => Promise<void>) | undefined;
  let nachNotiz: (() => Promise<void>) | undefined;
  beforeAll(async () => {
    container = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_pflege_test" })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    const url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_pflege_test`;
    pool = createPool(url);
    zweiterPool = createPool(url);
    await migrate(pool);
    vi.stubEnv("KLARWERK_SKIP_KEYCHAIN", "1");
    vi.stubEnv("KLARWERK_LOCAL_LLM_URL", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-20T06:59:00.000Z"));
    services = buildPgServices(pool);
    const original = services.klaraNotizen.lege.bind(services.klaraNotizen);
    services.klaraNotizen.lege = async (notiz, bedingung) => {
      const hook = vorNotiz;
      vorNotiz = undefined;
      await hook?.();
      const geschrieben = await original(notiz, bedingung);
      if (geschrieben) {
        const danach = nachNotiz;
        nachNotiz = undefined;
        await danach?.();
      }
      return geschrieben;
    };
    app = buildApp(services, {
      klaraErinnerungen: (fn) => {
        lauf = fn;
        return 65_000;
      },
    });
    await app.ready();
    admin = await neuesKonto(app, "pflege-pg-admin");
  }, 120_000);
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-10-20T06:59:00.000Z"));
    vorNotiz = undefined;
    nachNotiz = undefined;
  });
  afterAll(async () => {
    await app?.close();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    await pool?.end();
    await zweiterPool?.end();
    await container?.stop();
  });

  async function fall(vorlage: PflegeVorlage) {
    const email = `pflege-pg-${crypto.randomUUID()}@klarwerk.test`;
    const password = "Pflege-PG-Synthetisch-2026!";
    const neu = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin.kopf,
      payload: { name: "Fiktive Pflegeperson", email, password, role: "experte" },
    });
    expect(neu.statusCode, neu.body).toBe(201);
    const anmeldung = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    expect(anmeldung.statusCode, anmeldung.body).toBe(200);
    const headers = { authorization: `Bearer ${anmeldung.json().token}` };
    const me = await app.inject({ url: "/api/auth/me", headers });
    const kontoId: string = me.json().id;
    const ko = await services.ko.create({
      title: "Fiktive Anleitung A-4",
      statement: "Synthetischer erster Quellstand.",
      type: "technik",
      category: "Fiktive PG-Pflege",
      author: kontoId,
      confidentiality: "intern",
    });
    await services.lifecycle.requestRevalidation(ko.id, kontoId);
    const e = await app.inject({
      method: "POST",
      url: "/api/me/klara/erinnerungen",
      headers,
      payload: {
        vorgang: `pflege-pg-${crypto.randomUUID()}`,
        titel: "Fiktive begrenzte Pflege",
        aktion: "routine_bericht",
        routine: { wissenspflege: { vorlage, quellen: [ko.id] } },
        zeitzone: "Europe/Berlin",
        zeitplan: {
          art: "serie",
          datum: "2026-10-20",
          uhrzeit: "09:00",
          wiederholung: { takt: "taeglich", intervall: 1, bis: "2026-10-23", anzahl: null },
        },
        verpasst: { regel: "nachholen", grenzeMinuten: 30 },
      },
    });
    expect(e.statusCode, e.body).toBe(201);
    return { kontoId, email, password, headers, ko, e: e.json().erinnerung };
  }
  async function notizen(kontoId: string) {
    return services.klaraNotizen.liste(kontoId, { woerter: [], art: null, limit: 100 });
  }
  const faellig = () => vi.setSystemTime(new Date("2026-10-20T07:01:00.000Z"));

  it.each(["offene_pruefungen", "quellaenderung", "aktualitaet"] as const)(
    "%s speichert tatsächliche Quellenfassung, Originalnotiz und internen Beleg genau einmal",
    async (vorlage) => {
      const f = await fall(vorlage);
      if (vorlage === "quellaenderung")
        await services.ko.revise(
          f.ko.id,
          { statement: "Synthetische zweite Quellfassung." },
          f.kontoId,
        );
      faellig();
      await lauf();
      expect(await notizen(f.kontoId)).toHaveLength(1);
      const [l] = await services.klaraErinnerungen.laeufe.fuerErinnerung(f.e.id, 20);
      expect(l?.ergebnis.routine).toMatchObject({
        wissenspflege: { stand: "vorbereitet", vorlage },
        notizId: (await notizen(f.kontoId))[0]?.id,
      });
      expect(await services.klaraErinnerungen.meldungen.fuerKonto(f.kontoId, 20)).toHaveLength(1);
      await lauf();
      expect(await notizen(f.kontoId)).toHaveLength(1);
    },
  );

  it("tatsächlicher Quellrechteentzug unmittelbar vor Notiz-INSERT verhindert Bericht und Meldung", async () => {
    const f = await fall("aktualitaet");
    vorNotiz = async () => {
      await zweiterPool.query(
        'UPDATE kos SET data=jsonb_set(data,\'{quellrechte}\',\'{"stufe":"intern","leser":[]}\'::jsonb) WHERE id=$1',
        [f.ko.id],
      );
    };
    faellig();
    await lauf();
    expect(await notizen(f.kontoId)).toEqual([]);
    expect(await services.klaraErinnerungen.meldungen.fuerKonto(f.kontoId, 20)).toEqual([]);
    expect(
      (await services.klaraErinnerungen.erinnerungen.hole(f.kontoId, f.e.id))?.erinnerung.status,
    ).toBe("pausiert");
  });

  it("tatsächlicher Kontoentzug unmittelbar vor Notiz-INSERT verhindert den alten Auftrag", async () => {
    const f = await fall("aktualitaet");
    vorNotiz = async () => {
      await zweiterPool.query("UPDATE users SET approved=false WHERE id=$1", [f.kontoId]);
    };
    faellig();
    await lauf();
    expect(await notizen(f.kontoId)).toEqual([]);
    expect(await services.klaraErinnerungen.meldungen.fuerKonto(f.kontoId, 20)).toEqual([]);
    expect(
      (await services.klaraErinnerungen.erinnerungen.hole(f.kontoId, f.e.id))?.erinnerung.status,
    ).toBe("pausiert");
  });

  it("aktiver PG-Einzelabbruch unmittelbar vor Pflege-INSERT sperrt die Wirkung", async () => {
    const f = await fall("offene_pruefungen");
    vorNotiz = async () => {
      const [l] = await services.klaraErinnerungen.laeufe.fuerErinnerung(f.e.id, 20);
      expect(l).toBeTruthy();
      expect(
        await services.klaraErinnerungen.brecheLaufAb?.(
          f.kontoId,
          f.e.id,
          l!.vorkommenId,
          f.e.fassung,
          Date.now(),
          services.klaraNotizen,
        ),
      ).toBe(true);
    };
    faellig();
    await lauf();
    expect(await notizen(f.kontoId)).toEqual([]);
    expect(await services.klaraErinnerungen.meldungen.fuerKonto(f.kontoId, 20)).toEqual([]);
    expect((await services.klaraErinnerungen.laeufe.fuerErinnerung(f.e.id, 20))[0]?.status).toBe(
      "abgebrochen",
    );
  });

  it("echter Notiz-Schreibfehler erzeugt keinen Pflegeerfolg und gibt vorhandene Space-Sperre frei", async () => {
    const f = await fall("aktualitaet");
    // Trigger auf ausschließlich diesen fiktiven Auftrag begrenzen, unabhängig von Pool-Sitzungsvariablen.
    await pool.query("CREATE TABLE pflege_test_abbruch_konto (id text PRIMARY KEY)");
    await pool.query("INSERT INTO pflege_test_abbruch_konto VALUES ($1)", [f.kontoId]);
    await pool.query(
      "CREATE OR REPLACE FUNCTION pflege_test_abbruch() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM pflege_test_abbruch_konto WHERE id=NEW.konto_id) THEN RAISE EXCEPTION 'Pflegeprobe'; END IF; RETURN NEW; END $$",
    );
    await pool.query(
      "CREATE TRIGGER pflege_test_abbruch BEFORE INSERT ON klara_notizen FOR EACH ROW EXECUTE FUNCTION pflege_test_abbruch()",
    );
    try {
      faellig();
      await lauf();
      expect(await notizen(f.kontoId)).toEqual([]);
      const [l] = await services.klaraErinnerungen.laeufe.fuerErinnerung(f.e.id, 20);
      expect(l?.status).toBe("fehlgeschlagen");
      expect(l?.ergebnis.routine).toBeUndefined();
      const client = await zweiterPool.connect();
      try {
        const frei = await client.query<{ frei: boolean }>(
          "SELECT pg_try_advisory_lock($1::bigint) AS frei",
          [SPACES_SPERRE],
        );
        expect(frei.rows[0]?.frei).toBe(true);
        await client.query("SELECT pg_advisory_unlock($1::bigint)", [SPACES_SPERRE]);
      } finally {
        client.release();
      }
    } finally {
      await pool.query("DROP TRIGGER pflege_test_abbruch ON klara_notizen");
      await pool.query("DROP FUNCTION pflege_test_abbruch()");
      await pool.query("DROP TABLE pflege_test_abbruch_konto");
      await services.klaraErinnerungen.entferneKomplett?.(f.kontoId, f.e.id);
    }
  });

  it("ein neuer tatsächlicher Prüfstand zwischen Notiz und Meldung verhindert veralteten Pflegeerfolg und erhält die Originalnotiz", async () => {
    const f = await fall("offene_pruefungen");
    nachNotiz = async () => {
      await zweiterPool.query("UPDATE lifecycle_pending SET stand=stand+1 WHERE ko_id=$1", [
        f.ko.id,
      ]);
    };
    faellig();
    await lauf();
    const [bericht] = await notizen(f.kontoId);
    expect(bericht).toBeTruthy();
    expect(bericht?.inhalt).toContain("Offene Folgeprüfung, Stand 1");
    const [l] = await services.klaraErinnerungen.laeufe.fuerErinnerung(f.e.id, 20);
    expect(l).toMatchObject({
      status: "fehlgeschlagen",
      ergebnis: { grund: "quelle_geaendert", routine: { notizId: bericht?.id } },
    });
    expect(
      (await services.klaraErinnerungen.meldungen.fuerKonto(f.kontoId, 20)).filter(
        (m) => m.routine,
      ),
    ).toEqual([]);
  });

  it("echter Dump/Restore und neue App erhalten Watch-Baseline, Originalbericht und Meldungsidentität ohne Wiederholung", async () => {
    const f = await fall("quellaenderung");
    await services.ko.revise(
      f.ko.id,
      { statement: "Synthetische zweite Quellfassung." },
      f.kontoId,
    );
    faellig();
    await lauf();
    const [bericht] = await notizen(f.kontoId);
    expect(bericht).toBeTruthy();
    const meldungen = await services.klaraErinnerungen.meldungen.fuerKonto(f.kontoId, 20);
    const dump = await container.exec([
      "pg_dump",
      "--username=postgres",
      "--format=custom",
      "--file=/tmp/pflege.dump",
      "klarwerk_pflege_test",
    ]);
    expect(dump.exitCode, dump.output).toBe(0);
    const sha = await container.exec(["sha256sum", "/tmp/pflege.dump"]);
    expect(sha.exitCode).toBe(0);
    const neu = await container.exec(["createdb", "--username=postgres", "pflege_restore"]);
    expect(neu.exitCode, neu.output).toBe(0);
    const restore = await container.exec([
      "pg_restore",
      "--username=postgres",
      "--dbname=pflege_restore",
      "--no-owner",
      "/tmp/pflege.dump",
    ]);
    expect(restore.exitCode, restore.output).toBe(0);
    const url = new URL(pool.options.connectionString as string);
    url.pathname = "/pflege_restore";
    const neuerPool = createPool(url.toString());
    const neueServices = buildPgServices(neuerPool);
    let neuerLauf: (() => Promise<KlaraErinnerungLaufbericht>) | undefined;
    const neueApp = buildApp(neueServices, {
      klaraErinnerungen: (fn) => {
        neuerLauf = fn;
        return 65_000;
      },
    });
    try {
      await neueApp.ready();
      const anmeldung = await neueApp.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: f.email, password: f.password },
      });
      expect(anmeldung.statusCode, anmeldung.body).toBe(200);
      const headers = { authorization: `Bearer ${anmeldung.json().token}` };
      const vorher = (await neueApp.inject({ url: "/api/me/klara/notizen", headers })).json()
        .notizen;
      expect(vorher).toHaveLength(1);
      expect(vorher[0].id).toBe(bericht?.id);
      vi.setSystemTime(new Date("2026-10-21T07:01:00.000Z"));
      if (!neuerLauf)
        throw new Error("Wiederhergestellte App hat keinen vorhandenen Routinenlauf gebunden.");
      await neuerLauf();
      expect(
        (
          await neueServices.klaraNotizen.liste(f.kontoId, { woerter: [], art: null, limit: 100 })
        ).map((n) => n.id),
      ).toEqual([bericht?.id]);
      expect(await neueServices.klaraErinnerungen.meldungen.fuerKonto(f.kontoId, 20)).toEqual(
        meldungen,
      );
      const e = await neueServices.klaraErinnerungen.erinnerungen.hole(f.kontoId, f.e.id);
      expect(e?.erinnerung.routine?.wissenspflege?.ausgangsstand).toEqual([
        { id: f.ko.id, fassung: 1 },
      ]);
      if (process.env.KLARWERK_PFLEGE_RESTORE_BELEG)
        writeFileSync(
          process.env.KLARWERK_PFLEGE_RESTORE_BELEG,
          `${JSON.stringify({ dump_sha256: sha.output.trim().split(/\s+/)[0], pg_dump_exit: dump.exitCode, pg_restore_exit: restore.exitCode, actual_new_database_pool_app_and_login: true, same_node_test_process: true, same_original_report_id: true, same_one_notification: true, baseline_preserved: true, no_old_model_or_host_or_scheduler_replay: true }, null, 2)}\n`,
        );
    } finally {
      await neueApp.close();
      await neuerPool.end();
    }
  });
});
