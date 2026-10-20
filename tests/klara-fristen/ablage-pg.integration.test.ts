import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { FRISTEN_PRUEFSTAND, type FristenStand } from "../../services/app/src/klara-fristen";
import {
  KLARA_FRISTEN_SCHEMA,
  type KlaraFristenRepo,
  PgKlaraFristenRepo,
} from "../../services/app/src/klara-fristen-ablage";
import type { NotizSchreibbedingung } from "../../services/app/src/klara-notiz";
import { type Aufbau, appAufbauen } from "../klara-quellen-nutzerweg/kette";

describe("AW19 · PostgreSQL, Quellenbindung und tatsächliche Konkurrenz", () => {
  let container: StartedTestContainer;
  let pool: ReturnType<typeof createPool>;
  let zweiterPool: ReturnType<typeof createPool>;
  let aufbau: Aufbau;
  let services: ReturnType<typeof buildPgServices>;
  let vorSchreiben: (() => Promise<void>) | undefined;
  beforeAll(async () => {
    container = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_fristen_test" })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    const url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_fristen_test`;
    pool = createPool(url);
    zweiterPool = createPool(url);
    await migrate(pool);
    await pool.query(KLARA_FRISTEN_SCHEMA);
    const echt = new PgKlaraFristenRepo(pool);
    const beobachtet: KlaraFristenRepo = {
      hole: (id) => echt.hole(id),
      speichere: async (s: FristenStand, v: number, b?: NotizSchreibbedingung) => {
        const hook = vorSchreiben;
        vorSchreiben = undefined;
        await hook?.();
        return echt.speichere(s, v, b);
      },
    };
    aufbau = await appAufbauen(true, () => {
      services = buildPgServices(pool);
      services.klaraFristen = beobachtet;
      return services;
    });
  }, 120_000);
  afterAll(async () => {
    await aufbau?.app.close();
    await pool?.end();
    await zweiterPool?.end();
    await container?.stop();
  });

  async function fall(name: string) {
    const email = `${name}-${crypto.randomUUID()}@klarwerk.test`;
    const password = "Fristen-PG-Synthetisch-2026!";
    const angelegt = await aufbau.app.inject({
      method: "POST",
      url: "/api/users",
      headers: aufbau.admin.kopf,
      payload: { name, email, password, role: "experte" },
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    const angemeldet = await aufbau.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    expect(angemeldet.statusCode, angemeldet.body).toBe(200);
    const token: string = angemeldet.json().token;
    const konto = { email, token, kopf: { authorization: `Bearer ${token}` } };
    const me = await aufbau.app.inject({ url: "/api/auth/me", headers: konto.kopf });
    const kontoId: string = me.json().id;
    const n = await aufbau.app.inject({
      method: "POST",
      url: "/api/me/klara/notizen",
      headers: konto.kopf,
      payload: {
        vorgang: `fristen-pg-${crypto.randomUUID()}`,
        weg: "geschrieben",
        titel: "Synthetische Lizenz",
        inhalt: "Lizenz L-17: Ablaufdatum 2027-04-30.",
        objektbezug: {
          pfad: "/kalender",
          seitenName: "Mein Kalender",
          objekt: "PG-Fristenprüfung",
        },
      },
    });
    expect(n.statusCode, n.body).toBe(201);
    const notizId: string = n.json().notiz.id;
    const payload = {
      fassung: 0,
      regel: {
        aktiv: true,
        bereich: "persoenlich",
        zeitzone: "Europe/Berlin",
        quellen: [{ art: "notiz", id: notizId }],
        arten: ["ablauf"],
        aenderung: "aktualisieren",
        widerruf: "unzuverlaessig_ohne_vorlauf",
        wiederpruefung: "relevante_aenderung_klaeren",
        pruefstand: FRISTEN_PRUEFSTAND,
      },
    };
    return {
      konto,
      kontoId,
      password,
      notizId,
      speichern: () =>
        aufbau.app.inject({
          method: "PUT",
          url: "/api/me/klara/fristen/regel",
          headers: konto.kopf,
          payload,
        }),
    };
  }

  it("speichert dauerhaft, liest mit neuem Pool identisch und lässt bei konkurrierendem CAS genau einen Stand zu", async () => {
    const f = await fall("fristen-pg-dauerhaft");
    const r = await f.speichern();
    expect(r.statusCode, r.body).toBe(200);
    const wiederholt = await aufbau.app.inject({
      method: "POST",
      url: "/api/me/klara/fristen/aktualisieren",
      headers: f.konto.kopf,
    });
    expect(wiederholt.statusCode, wiederholt.body).toBe(200);
    expect(wiederholt.json().fassung).toBe(r.json().fassung);
    const neuerPool = createPool(pool.options.connectionString as string);
    try {
      const a = new PgKlaraFristenRepo(neuerPool);
      const s = await a.hole(f.kontoId);
      expect(s).toEqual(r.json());
      if (!s) throw new Error("Gespeicherter Stand fehlt");
      const b = new PgKlaraFristenRepo(zweiterPool);
      const ergebnisse = await Promise.all([
        a.speichere({ ...s, fassung: s.fassung + 1 }, s.fassung),
        b.speichere({ ...s, fassung: s.fassung + 1 }, s.fassung),
      ]);
      expect(ergebnisse.filter(Boolean)).toHaveLength(1);
      expect((await b.hole(f.kontoId))?.fristen).toHaveLength(1);
    } finally {
      await neuerPool.end();
    }
  });

  it("verweigert tatsächliches INSERT, wenn die gelesene Quelle unmittelbar davor geändert wurde", async () => {
    const f = await fall("fristen-pg-quellrennen");
    vorSchreiben = async () => {
      await zweiterPool.query(
        "UPDATE klara_notizen SET fassung=fassung+1,data=jsonb_set(jsonb_set(data,'{fassung}',to_jsonb(fassung+1)),'{inhalt}',to_jsonb('Lizenz L-17: Ablaufdatum 2027-05-30.'::text)) WHERE id=$1",
        [f.notizId],
      );
    };
    const r = await f.speichern();
    expect(r.statusCode, r.body).toBe(409);
    expect(await new PgKlaraFristenRepo(zweiterPool).hole(f.kontoId)).toBeNull();
  });

  it("verweigert tatsächliches INSERT beim unmittelbar davor gesperrten Konto", async () => {
    const f = await fall("fristen-pg-kontorennen");
    vorSchreiben = async () => {
      await zweiterPool.query("UPDATE users SET approved=false WHERE id=$1", [f.kontoId]);
    };
    expect((await f.speichern()).statusCode).toBe(409);
    expect(await new PgKlaraFristenRepo(zweiterPool).hole(f.kontoId)).toBeNull();
  });

  it("prüft Wissensobjekt und heutige Quellenrechte auch beim tatsächlichen Schreiben", async () => {
    const f = await fall("fristen-pg-quellrechte");
    const ko = await services.ko.create({
      title: "Synthetische Lizenzquelle",
      statement: "Lizenz L-17: Ablaufdatum 2027-04-30.",
      type: "best_practice",
      category: "Fristen-Prüfung",
      author: "synthetischer-autor",
      confidentiality: "intern",
    });
    const regel = {
      aktiv: true,
      bereich: "persoenlich",
      zeitzone: "Europe/Berlin",
      quellen: [{ art: "wissensobjekt", id: ko.id }],
      arten: ["ablauf"],
      aenderung: "aktualisieren",
      widerruf: "unzuverlaessig_ohne_vorlauf",
      wiederpruefung: "relevante_aenderung_klaeren",
      pruefstand: FRISTEN_PRUEFSTAND,
    };
    await services.ko.setOwnership(ko.id, { owner: f.kontoId }, f.kontoId);
    const speichern = (fassung: number) =>
      aufbau.app.inject({
        method: "PUT",
        url: "/api/me/klara/fristen/regel",
        headers: f.konto.kopf,
        payload: { fassung, regel },
      });
    const vorher = await speichern(0);
    expect(vorher.statusCode, vorher.body).toBe(200);
    expect(vorher.json().fristen).toHaveLength(1);
    vorSchreiben = async () => {
      await zweiterPool.query(
        'UPDATE kos SET data=jsonb_set(data,\'{quellrechte}\',\'{"stufe":"intern","leser":[]}\'::jsonb) WHERE id=$1',
        [ko.id],
      );
    };
    expect((await speichern(vorher.json().fassung)).statusCode).toBe(409);
    expect((await new PgKlaraFristenRepo(zweiterPool).hole(f.kontoId))?.fassung).toBe(
      vorher.json().fassung,
    );
    const sicht = await aufbau.app.inject({ url: "/api/me/klara/fristen", headers: f.konto.kopf });
    expect(sicht.statusCode).toBe(200);
    expect(sicht.json().fristen).toEqual([]);
  });

  it("rollt Schreibfehler zurück und gibt die Quell-/Kontensperren wieder frei", async () => {
    const f = await fall("fristen-pg-rollback");
    await pool.query(
      "CREATE FUNCTION fristen_test_abbruch() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetischer Fristen-Schreibfehler'; END $$",
    );
    await pool.query(
      "CREATE TRIGGER fristen_test_abbruch BEFORE INSERT ON klara_fristen FOR EACH ROW EXECUTE FUNCTION fristen_test_abbruch()",
    );
    try {
      const r = await f.speichern();
      expect(r.statusCode).toBe(500);
      expect(await new PgKlaraFristenRepo(zweiterPool).hole(f.kontoId)).toBeNull();
      await zweiterPool.query("SET statement_timeout='2000ms'");
      expect(
        (
          await zweiterPool.query("UPDATE users SET approved=approved WHERE id=$1 RETURNING id", [
            f.kontoId,
          ])
        ).rowCount,
      ).toBe(1);
    } finally {
      await pool.query("DROP TRIGGER fristen_test_abbruch ON klara_fristen");
      await pool.query("DROP FUNCTION fristen_test_abbruch()");
    }
  });

  it("echter Dump/Restore erhält Regel, manuelle Korrektur und Ablehnung; neue App liest dieselben Fristen", async () => {
    const f = await fall("fristen-pg-restore");
    const notiz = await aufbau.app.inject({
      method: "PUT",
      url: `/api/me/klara/notizen/${f.notizId}`,
      headers: f.konto.kopf,
      payload: {
        fassung: 1,
        inhalt: "Lizenz L-17: Ablaufdatum 2027-04-30.\nZertifikat Z-8: Ablaufdatum 2027-12-31.",
      },
    });
    expect(notiz.statusCode, notiz.body).toBe(200);
    const start = await f.speichern();
    expect(start.statusCode, start.body).toBe(200);
    const lizenz = start
      .json()
      .fristen.find((x: { objekt: { kennung: string } }) => x.objekt.kennung === "L-17");
    const zertifikat = start
      .json()
      .fristen.find((x: { objekt: { kennung: string } }) => x.objekt.kennung === "Z-8");
    const korrektur = await aufbau.app.inject({
      method: "POST",
      url: `/api/me/klara/fristen/${lizenz.id}/aktion`,
      headers: f.konto.kopf,
      payload: {
        fassung: lizenz.fassung,
        aktion: "korrigieren",
        datum: { art: "datum", datum: "2027-06-30" },
      },
    });
    expect(korrektur.statusCode, korrektur.body).toBe(200);
    const verworfen = await aufbau.app.inject({
      method: "POST",
      url: `/api/me/klara/fristen/${zertifikat.id}/aktion`,
      headers: f.konto.kopf,
      payload: { fassung: zertifikat.fassung, aktion: "verwerfen" },
    });
    expect(verworfen.statusCode, verworfen.body).toBe(200);
    const vorher = await aufbau.app.inject({ url: "/api/me/klara/fristen", headers: f.konto.kopf });
    const kalenderVorher = await aufbau.app.inject({
      url: "/api/me/kalender",
      headers: f.konto.kopf,
    });
    expect(kalenderVorher.json().eintraege).toHaveLength(1);
    const dump = await container.exec([
      "pg_dump",
      "--username=postgres",
      "--format=custom",
      "--file=/tmp/fristen-sicherung.dump",
      "klarwerk_fristen_test",
    ]);
    expect(dump.exitCode, dump.output).toBe(0);
    const summe = await container.exec(["sha256sum", "/tmp/fristen-sicherung.dump"]);
    expect(summe.exitCode).toBe(0);
    const datenbank = await container.exec(["createdb", "--username=postgres", "fristen_restore"]);
    expect(datenbank.exitCode, datenbank.output).toBe(0);
    const restore = await container.exec([
      "pg_restore",
      "--username=postgres",
      "--dbname=fristen_restore",
      "--no-owner",
      "/tmp/fristen-sicherung.dump",
    ]);
    expect(restore.exitCode, restore.output).toBe(0);
    const ziel = new URL(pool.options.connectionString as string);
    ziel.pathname = "/fristen_restore";
    const neuerPool = createPool(ziel.toString());
    const neueApp = buildApp(buildPgServices(neuerPool));
    try {
      await neueApp.ready();
      const anmeldung = await neueApp.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: f.konto.email, password: f.password },
      });
      expect(anmeldung.statusCode, anmeldung.body).toBe(200);
      const headers = { authorization: `Bearer ${anmeldung.json().token}` };
      const nachher = await neueApp.inject({ url: "/api/me/klara/fristen", headers });
      expect(nachher.statusCode, nachher.body).toBe(200);
      expect(nachher.json()).toEqual(vorher.json());
      const kalenderNachher = await neueApp.inject({ url: "/api/me/kalender", headers });
      expect(kalenderNachher.json().eintraege).toEqual(kalenderVorher.json().eintraege);
      const neuGelesen = await neueApp.inject({
        method: "POST",
        url: "/api/me/klara/fristen/aktualisieren",
        headers,
      });
      expect(neuGelesen.statusCode, neuGelesen.body).toBe(200);
      expect(neuGelesen.json()).toEqual(vorher.json());
      if (process.env.KLARWERK_FRISTEN_RESTORE_BELEG)
        writeFileSync(
          process.env.KLARWERK_FRISTEN_RESTORE_BELEG,
          `${JSON.stringify({ dump_sha256: summe.output.trim().split(/\s+/)[0], actual_dump_exit: dump.exitCode, actual_restore_exit: restore.exitCode, new_pool_and_app: true, same_test_process: true, fristen: 2, sichtbare_kalenderfristen: 1, regel_korrektur_ablehnung_verlauf_identisch: true, neuabruf_ohne_neue_fassung_oder_wiederbelebung: true, old_scheduler_model_host_general_runs: false }, null, 2)}\n`,
        );
    } finally {
      await neueApp.close();
      await neuerPool.end();
    }
  });
});
import { writeFileSync } from "node:fs";
