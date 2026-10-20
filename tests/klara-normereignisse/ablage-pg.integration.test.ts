import { writeFileSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { PgKlaraFristenRepo } from "../../services/app/src/klara-fristen-ablage";
import { KlaraFristenQuellen } from "../../services/app/src/klara-fristen-quellen";
import { KlaraNormereignisDienst } from "../../services/app/src/klara-normereignisse-dienst";
import { type Konto, neuesKonto } from "../klara-quellen-nutzerweg/kette";
import { echterNotizauftrag } from "./pruefauftrag-vorrichtung";

const BEKANNTMACHUNG = "Norm N-17 v2: Ankündigung am 2026-11-01; Geltung: Werk A.";
const lauf = { gilt: () => true, sql: () => ({ und: ["true"], params: [] }) };

describe("AW21 · Normbelege im echten vorhandenen PG-Fristen-CAS", () => {
  let container: StartedTestContainer;
  let pool: ReturnType<typeof createPool>;
  let zweiterPool: ReturnType<typeof createPool>;
  let app: FastifyInstance;
  let services: ReturnType<typeof buildPgServices>;
  let admin: Konto;
  let vorSchreiben: (() => Promise<void>) | undefined;
  beforeAll(async () => {
    vi.stubEnv("KLARWERK_SKIP_KEYCHAIN", "1");
    vi.stubEnv("KLARWERK_LOCAL_LLM_URL", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    container = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_norm_test" })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    const url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_norm_test`;
    pool = createPool(url);
    zweiterPool = createPool(url);
    await migrate(pool);
    services = buildPgServices(pool);
    const echt = services.klaraFristen;
    services.klaraFristen = {
      hole: (id) => echt.hole(id),
      async speichere(s, v, b) {
        const hook = vorSchreiben;
        vorSchreiben = undefined;
        await hook?.();
        return echt.speichere(s, v, b);
      },
    };
    app = buildApp(services, { klaraErinnerungen: () => 65_000 });
    await app.ready();
    admin = await neuesKonto(app, "norm-pg-admin");
  });
  beforeEach(() => {
    vorSchreiben = undefined;
  });
  afterAll(async () => {
    await app?.close();
    await pool?.end();
    await zweiterPool?.end();
    await container?.stop();
    vi.unstubAllEnvs();
  });

  function dienst(s = services) {
    return new KlaraNormereignisDienst({
      aufgaben: s.klaraAufgaben,
      gespraeche: s.klaraGespraeche,
      repo: s.klaraFristen,
      quellen: new KlaraFristenQuellen({
        auth: s.auth,
        ko: s.ko,
        notizen: s.klaraNotizen,
        gespraeche: s.klaraGespraeche,
        spaces: s.spaces,
      }),
      ko: s.ko,
      belege: s.audit,
      auth: s.auth,
    });
  }
  async function fall() {
    const email = `norm-pg-${crypto.randomUUID()}@klarwerk.test`;
    const password = "Norm-PG-Synthetisch-2026!";
    const neu = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin.kopf,
      payload: { name: "Fiktive Normperson", email, password, role: "controller" },
    });
    expect(neu.statusCode, neu.body).toBe(201);
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    expect(login.statusCode, login.body).toBe(200);
    const headers = { authorization: `Bearer ${login.json().token}` };
    const id: string = (await app.inject({ url: "/api/auth/me", headers })).json().id;
    const quelle = await services.ko.create({
      title: "Fiktive Bekanntmachung PG",
      statement: BEKANNTMACHUNG,
      type: "technik",
      category: "Synthetische Normprüfung",
      author: id,
      confidentiality: "intern",
    });
    return { id, email, password, headers, quelle };
  }
  async function annahme(f: Awaited<ReturnType<typeof fall>>) {
    const d = dienst();
    await d.beobachten(f.id, [f.quelle.id], lauf);
    const anleitung = await services.ko.create({
      title: "Fiktive Anleitung PG",
      statement: "Alte fiktive Regel v1.",
      type: "technik",
      category: "Synthetische Normprüfung",
      author: f.id,
      confidentiality: "intern",
    });
    await services.lifecycle.couple("Norm N-17", anleitung.id, f.id);
    const freigeben = async () => {
      const r = await app.inject({
        method: "PUT",
        url: `/api/kos/${anleitung.id}`,
        headers: admin.kopf,
        payload: { action: "admin-validate", duplicateAcknowledged: true },
      });
      expect(r.statusCode, r.body).toBe(200);
      const ko = await services.ko.get(anleitung.id);
      if (!ko) throw new Error("Anleitung fehlt");
      return ko;
    };
    const bisher = await freigeben();
    await services.ko.revise(
      anleitung.id,
      { statement: "Neue ausdrücklich geprüfte fiktive Regel v2." },
      f.id,
    );
    const nachfolger = await freigeben();
    const n = (await d.sicht(f.id))[0];
    if (!n) throw new Error("Normgeschichte fehlt");
    const eingabe = {
      fassung: (await services.klaraFristen.hole(f.id))?.fassung,
      bestaetigt: true,
      bisher: { koId: bisher.id, fassung: bisher.version },
      nachfolger: { koId: nachfolger.id, fassung: nachfolger.version },
      geltung: "Werk A",
      begruendung: "Bewusste fiktive Fachentscheidung im PG-Fall.",
    };
    return { d, n, eingabe, bisher, nachfolger };
  }

  it("zwei tatsächliche Ausführer schreiben dieselbe Meldung nur einmal und erhalten den vorhandenen Fristenbestand", async () => {
    const f = await fall();
    const alterStand = { kontoId: f.id, fassung: 1, regel: null, fristen: [] };
    expect(await services.klaraFristen.speichere(alterStand, 0)).toBe(true);
    const zweiteDienste = buildPgServices(zweiterPool);
    await Promise.all([
      dienst().beobachten(f.id, [f.quelle.id], lauf),
      dienst(zweiteDienste).beobachten(f.id, [f.quelle.id], lauf),
    ]);
    const gespeichert = await services.klaraFristen.hole(f.id);
    expect(gespeichert?.fassung).toBe(2);
    expect(gespeichert?.regel).toBeNull();
    expect(gespeichert?.fristen).toEqual([]);
    expect(gespeichert?.normereignisse).toHaveLength(1);
    expect(gespeichert?.normereignisse?.[0]?.ereignisse[0]?.belege).toHaveLength(1);
  });
  it("Quelländerung unmittelbar vor SQL verwirft den alten Beleg und verarbeitet nur den frisch erneut gelesenen Stand", async () => {
    const f = await fall();
    vorSchreiben = async () => {
      await buildPgServices(zweiterPool).ko.revise(
        f.quelle.id,
        {
          statement: BEKANNTMACHUNG.replace("2026-11-01", "2026-12-01"),
        },
        f.id,
      );
    };
    await dienst().beobachten(f.id, [f.quelle.id], lauf);
    const n = (await services.klaraFristen.hole(f.id))?.normereignisse?.[0];
    expect(n?.ereignisse).toHaveLength(1);
    expect(n?.ereignisse[0]?.datum).toBe("2026-12-01");
    expect(n?.ereignisse[0]?.belege[0]?.quelle.fassung).toBe("2");
  });
  it("echter Quellenentzug an zweiter Verbindung vor INSERT hinterlässt keinen Normbeleg", async () => {
    const f = await fall();
    vorSchreiben = async () => {
      await buildPgServices(zweiterPool).ko.setQuellrechte(
        f.quelle.id,
        { stufe: "intern", leser: [] },
        f.id,
      );
    };
    await expect(dienst().beobachten(f.id, [f.quelle.id], lauf)).rejects.toMatchObject({
      status: 404,
    });
    expect(await services.klaraFristen.hole(f.id)).toBeNull();
  });
  it("tatsächlicher Rollenentzug vor Fachannahme-CAS verhindert die Entscheidung", async () => {
    const f = await fall();
    const a = await annahme(f);
    const vorher = await services.klaraFristen.hole(f.id);
    vorSchreiben = async () => {
      await zweiterPool.query("UPDATE users SET role='viewer' WHERE id=$1", [f.id]);
    };
    await expect(a.d.nehmeAbloesungAn(f.id, a.n.id, a.eingabe)).rejects.toMatchObject({
      status: 409,
    });
    expect(await services.klaraFristen.hole(f.id)).toEqual(vorher);
  });
  it("geänderte Normzuordnung bei gleicher Inhaltsversion verhindert die Fachannahme am SQL-Snapshotguard", async () => {
    const f = await fall();
    const a = await annahme(f);
    const vorher = await services.klaraFristen.hole(f.id);
    vorSchreiben = async () => {
      await zweiterPool.query(
        'UPDATE kos SET data=data || \'{"asset":null,"assets":[]}\'::jsonb WHERE id=$1',
        [a.nachfolger.id],
      );
    };
    await expect(a.d.nehmeAbloesungAn(f.id, a.n.id, a.eingabe)).rejects.toMatchObject({
      status: 409,
    });
    expect(await services.klaraFristen.hole(f.id)).toEqual(vorher);
  });
  it("echter Dump/Restore, neuer Pool/App und Anmeldung erhalten Normgeschichte/Fachannahme/Originalfassungen ohne neues Ereignis", async () => {
    const f = await fall();
    const a = await annahme(f);
    const angenommen = await a.d.nehmeAbloesungAn(f.id, a.n.id, a.eingabe);
    const e = a.n.ereignisse[0];
    if (!e) throw new Error("Ereignis fehlt");
    const p = await echterNotizauftrag(app, f.headers, BEKANNTMACHUNG);
    const bindung = await a.d.verknuepfePruefauftrag(f.id, a.n.id, e.id, {
      fassung: (await services.klaraFristen.hole(f.id))?.fassung,
      gespraechId: p.gespraechId,
      auftragId: p.auftragId,
      bestaetigt: true,
    });
    const ausUrl = `${p.pfad}/${p.auftragId}/schritte/${bindung.pruefauftrag.schluessel}/ausfuehrung`;
    const getan = await app.inject({
      method: "POST",
      url: ausUrl,
      headers: f.headers,
      payload: { nr: 1, auftragFassung: 1 },
    });
    expect(getan.statusCode, getan.body).toBe(200);
    const taskId: string = getan.json().schritt.ergebnis.id;
    const gespeichert = await services.klaraFristen.hole(f.id);
    const dump = await container.exec([
      "pg_dump",
      "--username=postgres",
      "--format=custom",
      "--file=/tmp/norm.dump",
      "klarwerk_norm_test",
    ]);
    expect(dump.exitCode, dump.output).toBe(0);
    const sha = await container.exec(["sha256sum", "/tmp/norm.dump"]);
    expect(sha.exitCode).toBe(0);
    expect(
      (await container.exec(["createdb", "--username=postgres", "norm_restore"])).exitCode,
    ).toBe(0);
    const restore = await container.exec([
      "pg_restore",
      "--username=postgres",
      "--dbname=norm_restore",
      "--no-owner",
      "/tmp/norm.dump",
    ]);
    expect(restore.exitCode, restore.output).toBe(0);
    const url = new URL(pool.options.connectionString as string);
    url.pathname = "/norm_restore";
    const neuerPool = createPool(url.toString());
    const neueServices = buildPgServices(neuerPool);
    const neueApp = buildApp(neueServices, { klaraErinnerungen: () => 65_000 });
    try {
      await neueApp.ready();
      const login = await neueApp.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: f.email, password: f.password },
      });
      expect(login.statusCode, login.body).toBe(200);
      const headers = { authorization: `Bearer ${login.json().token}` };
      expect(await new PgKlaraFristenRepo(neuerPool).hole(f.id)).toEqual(gespeichert);
      const read = await neueApp.inject({ url: "/api/me/klara/normereignisse", headers });
      expect(read.statusCode, read.body).toBe(200);
      expect(read.json().normen[0].annahmen).toEqual([angenommen.annahme]);
      const originalauftrag = await dienst(neueServices).pruefauftraege(f.id, a.n.id, e.id);
      expect(originalauftrag.gebunden).toEqual(bindung.pruefauftrag);
      expect(originalauftrag.auftraege[0]).toMatchObject({
        ergebnisVorhanden: true,
        schritt: { ergebnis: { id: taskId } },
      });
      const wiederholt = await neueApp.inject({
        method: "POST",
        url: ausUrl,
        headers,
        payload: { nr: 1, auftragFassung: 1 },
      });
      expect(wiederholt.statusCode, wiederholt.body).toBe(200);
      expect(wiederholt.json().wiederholt).toBe(true);
      expect(
        (await neueApp.inject({ url: "/api/me/klara/aufgaben", headers })).json().aufgaben,
      ).toHaveLength(1);
      for (const original of [a.bisher, a.nachfolger]) {
        const r = await neueApp.inject({
          url: `/api/me/klara/normereignisse/${a.n.id}/fassungen/${original.id}/${original.version}`,
          headers,
        });
        expect(r.statusCode, r.body).toBe(200);
        expect(r.json().aussage).toBe(original.statement);
      }
      await dienst(neueServices).beobachten(f.id, [f.quelle.id], lauf);
      expect(await neueServices.klaraFristen.hole(f.id)).toEqual(gespeichert);
      if (process.env.KLARWERK_NORM_RESTORE_BELEG)
        writeFileSync(
          process.env.KLARWERK_NORM_RESTORE_BELEG,
          `${JSON.stringify({
            dump_sha256: sha.output.trim().split(/\s+/)[0],
            pg_dump_exit: dump.exitCode,
            pg_restore_exit: restore.exitCode,
            actual_new_database_pool_app_and_login: true,
            same_node_test_process: true,
            same_norm_history_and_acceptance: true,
            exact_original_versions: true,
            same_existing_G_journal_and_original_task: true,
          })}\n`,
        );
    } finally {
      await neueApp.close();
      await neuerPool.end();
    }
  });
});
