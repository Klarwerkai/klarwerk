// ================================================================================================
// VORLAGEN GEGEN ECHTES POSTGRESQL — Neustart erhält Standard, Fassungen, Vorgaben, Nutzung
// (produkt:20261007:templates-default).
// ================================================================================================
//
// `vorlagen-api.test.ts` misst den Draht an der Speicherablage. Hier steht, was erst gegen eine
// ECHTE Datenbank belegt ist: nach einem Neustart (neuer Pool, neue App) sind persönlicher Standard
// (K1), geteilte Vorlage mit beiden Fassungen (K3/K10), Space-Vorgabe (K8) und der Bezug eines
// Beitrags auf seine Fassung (K5/K10) noch da — `vorlagen_fassungen`, angelegt von `migrate()`.
// Die Pflichtprüfung wirkt nach dem Neustart weiter (K8).
//
// Der volle Produktaufbau: `migrate()` (mit `VORLAGEN_SCHEMA`), `buildPgServices`, `buildApp`. Jede
// Ausführung bekommt eine EIGENE, frische Datenbank (erstes Konto = Admin) und räumt sie danach ab.
// Alle Namen und Inhalte sind erfundene Testdaten.
//
// INFRASTRUKTUR: `KLARWERK_PG_TEST_URL` (Datenbankname mit `test`, s. `guardedLocalPgTestUrl`),
// sonst ein Wegwerf-Container. Fehlt beides, SCHEITERT der Lauf — kein stiller Skip.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

type App = ReturnType<typeof buildApp>;
type Kopf = { authorization: string };

// Fiktives Testkennwort einer Wegwerf-Datenbank.
const KENNWORT = "testkonto-123";

describe("Vorlagen gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let verwaltung: Pool | undefined;
  let datenbank = "";
  let url = "";
  const offen: { pool: Pool; app: App }[] = [];

  async function neueApp(): Promise<App> {
    const pool = createPool(url);
    const app = buildApp(buildPgServices(pool));
    await app.ready();
    offen.push({ pool, app });
    return app;
  }

  async function beenden(app: App): Promise<void> {
    const i = offen.findIndex((o) => o.app === app);
    const eintrag = offen[i];
    if (eintrag) {
      offen.splice(i, 1);
      await eintrag.app.close();
      await eintrag.pool.end();
    }
  }

  async function anmelden(app: App, email: string): Promise<Kopf> {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: KENNWORT },
    });
    expect(res.statusCode, `Anmeldung ${email}: ${res.body}`).toBe(200);
    return { authorization: `Bearer ${res.json().token}` };
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
    datenbank = `klarwerk_vorlagen_test_${`${Date.now()}`.slice(-9)}`;
    verwaltung = new Pool({ connectionString: basis });
    await verwaltung.query(`CREATE DATABASE ${datenbank}`);
    const ziel = new URL(basis);
    ziel.pathname = `/${datenbank}`;
    url = ziel.toString();
    const pool = createPool(url);
    try {
      // Zweimal: die Stufen sind wiederholbar und lassen den Bestand stehen.
      await migrate(pool);
      await migrate(pool);
      await buildPgServices(pool).ko.activateSearchProjectionV2();
    } finally {
      await pool.end();
    }
  }, 300_000);

  afterAll(async () => {
    for (const o of [...offen]) {
      await beenden(o.app);
    }
    if (verwaltung) {
      await verwaltung
        .query(`DROP DATABASE IF EXISTS ${datenbank} WITH (FORCE)`)
        .catch(() => undefined);
      await verwaltung.end();
    }
    await container?.stop();
  }, 120_000);

  it("Standard, geteilte Vorlage mit Fassungen, Space-Vorgabe und Nutzung überleben den Neustart", async () => {
    // --- Erster Server -----------------------------------------------------------------------
    const erste = await neueApp();
    await erste.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Ada Admin", email: "ada@vorlagen-pg.test", password: KENNWORT },
    });
    const admin = await anmelden(erste, "ada@vorlagen-pg.test");
    for (const [name, email, role] of [
      ["Erik Experte", "erik@vorlagen-pg.test", "experte"],
      ["Mia Monteurin", "mia@vorlagen-pg.test", "experte"],
    ] as const) {
      const res = await erste.inject({
        method: "POST",
        url: "/api/users",
        headers: admin,
        payload: { name, email, password: KENNWORT, role },
      });
      expect(res.statusCode, res.body).toBe(201);
    }
    const erik = await anmelden(erste, "erik@vorlagen-pg.test");
    const konten = (
      await erste.inject({ method: "GET", url: "/api/spaces/konten", headers: admin })
    ).json().konten as { id: string; name: string }[];
    const id = (n: string) => konten.find((k) => k.name === n)?.id ?? "";
    const space = await erste.inject({
      method: "POST",
      url: "/api/spaces",
      headers: admin,
      payload: {
        name: "Instandhaltung",
        zweck: "Fiktiver Arbeitsraum.",
        verantwortlich: id("Ada Admin"),
        zugang: "mitglieder",
        mitglieder: [
          { nutzer: id("Erik Experte"), recht: "schreiben" },
          { nutzer: id("Mia Monteurin"), recht: "schreiben" },
        ],
        ansichten: [],
      },
    });
    expect(space.statusCode, space.body).toBe(201);
    const spaceId = space.json().id as string;

    expect(
      (
        await erste.inject({
          method: "PUT",
          url: "/api/vorlagen/standard",
          headers: erik,
          payload: { vorlageId: "std-faq" },
        })
      ).statusCode,
    ).toBe(200);
    const vorgabe = await erste.inject({
      method: "PUT",
      url: `/api/vorlagen/space-vorgaben/${spaceId}`,
      headers: admin,
      payload: { version: 0, mindestensTags: 1, pflichtKategorie: false },
    });
    expect(vorgabe.statusCode, vorgabe.body).toBe(200);
    const angelegt = await erste.inject({
      method: "POST",
      url: "/api/vorlagen",
      headers: erik,
      payload: {
        name: "Pumpenwechsel",
        geltung: "space",
        spaceId,
        felder: [{ id: "lage", titel: "Ausgangslage", hinweis: "Welche Pumpe? …", pflicht: true }],
      },
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    const vorlageId = angelegt.json().id as string;
    const beitrag = await erste.inject({
      method: "POST",
      url: "/api/kos",
      headers: erik,
      payload: {
        confidentiality: "intern",
        type: "best_practice",
        title: "Pumpe P-7 tauschen",
        statement: "Fiktive Aussage.",
        category: "Allgemein",
        tags: ["Pumpe"],
        bodyHtml: "<h2>Pumpenwechsel</h2><h3>Ausgangslage</h3><p>P-7 leckt.</p>",
        vorlage: { id: vorlageId, version: 1, spaceId },
      },
    });
    expect(beitrag.statusCode, beitrag.body).toBe(201);
    const koId = beitrag.json().id as string;
    expect(beitrag.json().spaceId).toBe(spaceId);
    const v2 = await erste.inject({
      method: "PUT",
      url: `/api/vorlagen/${vorlageId}`,
      headers: erik,
      payload: {
        version: 1,
        name: "Pumpenwechsel",
        geltung: "space",
        spaceId,
        felder: [
          { id: "lage", titel: "Ausgangslage", hinweis: "Welche Pumpe? …", pflicht: true },
          { id: "danach", titel: "Prüfung danach", hinweis: "Dicht? …", pflicht: true },
        ],
      },
    });
    expect(v2.statusCode, v2.body).toBe(200);
    await beenden(erste);

    // --- Zweiter Server, selbe Datenbank -------------------------------------------------------
    const zweite = await neueApp();
    const erik2 = await anmelden(zweite, "erik@vorlagen-pg.test");
    const mia2 = await anmelden(zweite, "mia@vorlagen-pg.test");
    const start = await zweite.inject({
      method: "GET",
      url: "/api/vorlagen/start",
      headers: erik2,
    });
    expect(start.json().quelle).toBe("persoenlich");
    expect(start.json().vorlage.id).toBe("std-faq");
    const fassungen = (
      await zweite.inject({ method: "GET", url: `/api/vorlagen/${vorlageId}`, headers: mia2 })
    ).json().fassungen as { version: number }[];
    expect(fassungen.map((f) => f.version)).toEqual([1, 2]);
    const nutzung = (
      await zweite.inject({ method: "GET", url: `/api/vorlagen/nutzung/${koId}`, headers: mia2 })
    ).json().nutzung;
    expect(nutzung).toEqual(expect.objectContaining({ version: 1, aktuelleVersion: 2 }));
    expect(nutzung.felder.map((f: { titel: string }) => f.titel)).toEqual(["Ausgangslage"]);
    const ko = (
      await zweite.inject({ method: "GET", url: `/api/kos/${koId}`, headers: mia2 })
    ).json();
    expect(ko.spaceId).toBe(spaceId);
    expect(ko.bodyHtml).toContain("P-7 leckt.");
    // Die Space-Vorgabe wirkt weiter: ohne Tag wird nicht eingereicht.
    const ohneTag = await zweite.inject({
      method: "POST",
      url: "/api/kos",
      headers: mia2,
      payload: {
        confidentiality: "intern",
        type: "best_practice",
        title: "Pumpe P-8 tauschen",
        statement: "Fiktive Aussage.",
        category: "Allgemein",
        bodyHtml:
          "<h2>Pumpenwechsel</h2><h3>Ausgangslage</h3><p>P-8.</p><h3>Prüfung danach</h3><p>Dicht.</p>",
        vorlage: { id: vorlageId, version: 2, spaceId },
      },
    });
    expect(ohneTag.statusCode, ohneTag.body).toBe(400);
    expect(ohneTag.json().befunde).toEqual([expect.objectContaining({ art: "tags_fehlen" })]);
    await beenden(zweite);
  }, 120_000);
});
