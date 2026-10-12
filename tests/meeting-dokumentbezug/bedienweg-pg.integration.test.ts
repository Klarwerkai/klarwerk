// ================================================================================================
// BPA-16 · DER BEDIENWEG GEGEN ECHTES POSTGRESQL (Nacharbeit 2, Bens Befund 1: dauerhafte Ablage).
// ================================================================================================
//
// Dieselben Helfer wie `bedienweg.test.ts`, aber `buildPgServices(pool)` gegen einen echten
// PostgreSQL-Container mit dem echten Migrationslauf (`migrate`, Stufe
// `MEETING_DOKUMENTBEZUG_SCHEMA`). Gemessen wird, was die Speicherfassung nicht zeigen kann:
//   P1 · der Meetingbezug samt Rückmeldung überlebt einen Neustart der App (zweite App-Instanz,
//        derselbe Pool) und ist dort aus Folie und Zeitstelle erreichbar;
//   P2 · bedingtes Schreiben — eine veraltete Version überschreibt den Stand nicht.
// Ohne Container-Laufzeit wird übersprungen (sichtbar, mit Grund), nicht grün gemeldet.
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { PgMeetingBezugAblage } from "../../services/app/src/meeting-dokumentbezug-ablage";
import { adapterUmgebungSetzen, appAufbauen, neuesKonto } from "../klara-quellen-nutzerweg/kette";
import { anfrage, kontoId, meetingAufbauen } from "./app-helfer";

adapterUmgebungSetzen();

let container: StartedTestContainer | null = null;
let pool: Pool | null = null;
const apps: FastifyInstance[] = [];

beforeAll(async () => {
  try {
    container = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    const url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
    const p = createPool(url);
    await migrate(p);
    pool = p;
  } catch (fehler) {
    const grund = fehler instanceof Error ? fehler.message : String(fehler);
    process.stderr.write(`[KLARWERK] BPA-16 PG-BEDIENWEG ÜBERSPRUNGEN: ${grund}\n`);
  }
}, 180_000);

afterAll(async () => {
  for (const app of apps) {
    await app.close();
  }
  await pool?.end();
  await container?.stop();
});

describe("BPA-16 · Meetingbezug in PostgreSQL", () => {
  it("P1 · Rückmeldung überlebt den Neustart und bleibt aus Folie und Zeitstelle erreichbar", async (ctx) => {
    const p = pool;
    if (!p) {
      ctx.skip();
      return;
    }
    const a = await appAufbauen(true, () => buildPgServices(p));
    apps.push(a.app);
    const vortragende = await neuesKonto(a.app, "vortragende-pg", a.admin);
    const teilnehmer = await neuesKonto(a.app, "teilnehmer-pg", a.admin);
    const lage = await meetingAufbauen(a.app, vortragende, [await kontoId(a.app, teilnehmer)]);
    const basis = `/api/meetings/${lage.meetingId}`;
    const r2 = await anfrage(a.app, vortragende, "POST", `${basis}/rueckmeldungen`, {
      mitschriftId: lage.mitschrift,
      stelleId: "r2",
      art: "vorschlag",
      text: "Zahlenquelle ergänzen",
    });
    expect(r2.status, r2.body).toBe(201);

    const zeile = await p.query<{ version: number }>(
      "SELECT version FROM meeting_dokumentbezuege WHERE meeting_id=$1",
      [lage.meetingId],
    );
    expect(zeile.rows[0]?.version).toBeGreaterThan(1);

    // Neustart: eine zweite App-Instanz über demselben Pool; die Sitzungen liegen in PostgreSQL.
    const zweite = buildApp(buildPgServices(p));
    apps.push(zweite);
    await zweite.ready();
    const ausFolie = await anfrage(
      zweite,
      teilnehmer,
      "GET",
      `${basis}/folien/${lage.nordOriginal}/257`,
    );
    expect(ausFolie.status, ausFolie.body).toBe(200);
    expect(ausFolie.json.rueckmeldungen.map((s: { id: string }) => s.id)).toEqual([r2.json.id]);
    const ausZeit = await anfrage(zweite, teilnehmer, "GET", `${basis}/zeitstellen/127000`);
    expect(ausZeit.json.rueckmeldungen[0]).toMatchObject({
      id: r2.json.id,
      folie: { dateiId: lage.nordKopie, sldId: "257" },
      aenderung: { status: "offen", ziel: { dateiId: lage.nordOriginal, sldId: "257" } },
    });
  });

  it("P2 · bedingtes Schreiben: eine veraltete Version überschreibt nichts", async (ctx) => {
    const p = pool;
    if (!p) {
      ctx.skip();
      return;
    }
    const ablage = new PgMeetingBezugAblage(p);
    const zustand = {
      meeting: { meetingId: "mt-pg-p2", zeitbasis: "z", ocrErlaubt: false },
      saetze: [],
      originale: [],
      fassungen: [],
      originalVon: [],
      wechsel: [],
      mitschriften: [],
      meldungen: [],
      aenderungen: [],
    };
    const eintrag = {
      meetingId: "mt-pg-p2",
      titel: "P2",
      eigner: "konto-a",
      teilnehmer: ["konto-b"],
      version: 1,
      angelegtAm: "2026-10-11T00:00:00.000Z",
      zustand,
    };
    expect(await ablage.anlegen(eintrag)).toBe(true);
    expect(await ablage.anlegen(eintrag)).toBe(false);
    expect(await ablage.ersetzen({ ...eintrag, titel: "neu", version: 2 }, 1)).toBe(true);
    expect(await ablage.ersetzen({ ...eintrag, titel: "veraltet", version: 2 }, 1)).toBe(false);
    expect((await ablage.lesen("mt-pg-p2"))?.titel).toBe("neu");
    expect((await ablage.fuerKonto("konto-b")).map((z) => z.meetingId)).toContain("mt-pg-p2");
    expect((await ablage.fuerKonto("konto-c")).map((z) => z.meetingId)).not.toContain("mt-pg-p2");
  });
});
