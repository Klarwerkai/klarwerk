// ================================================================================================
// ADMIN-06 · TEAMS GEGEN ECHTES POSTGRESQL — Neustart, Verlauf, Entzug am SQL-Trim (K3, K4, K5, K6).
// ================================================================================================
//
// `teams-api.test.ts` misst den Draht an der Speicherablage. Hier steht, was erst gegen eine ECHTE
// Datenbank belegt ist:
//   K6 · Teams, Mitglieder, Archivstand und der Verlauf jeder Änderung überleben einen Neustart
//        (neuer Pool, neue App) — `teams_fassungen`, angelegt von `migrate()`.
//   K3/K4 · Der Entzug über ein Team wirkt am SQL-Prädikat (Liste, Suche) und am Detailabruf — für
//        eine Sitzung, die VOR dem Entzug ausgestellt wurde; der Weg über das andere Team bleibt.
//   K5 · Nach dem Archivieren gewährt das Team nach dem Neustart nichts mehr; Autorschaft, Fassung
//        und Historie des Artikels sind unverändert.
//
// Der volle Produktaufbau: `migrate()` (mit `TEAMS_SCHEMA`), `buildPgServices`, `buildApp`. Jede
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
const WORT = "Fuehlerlehrenabgleich";

describe("Teams gegen echtes PostgreSQL", () => {
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
    datenbank = `klarwerk_teams_test_${`${Date.now()}`.slice(-9)}`;
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

  it("Teams, Mitglieder und Verlauf überleben den Neustart; Entzug und Archiv wirken am SQL-Trim", async () => {
    // --- Erster Server: Konten, zwei überlappende Teams, Space, Artikel -----------------------
    const erste = await neueApp();
    await erste.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Ada Admin", email: "ada@teams-pg.test", password: KENNWORT },
    });
    const admin = await anmelden(erste, "ada@teams-pg.test");
    for (const [name, email, role] of [
      ["Carla Controller", "carla@teams-pg.test", "controller"],
      ["Erik Experte", "erik@teams-pg.test", "experte"],
      ["Vera Viewer", "vera@teams-pg.test", "viewer"],
    ] as const) {
      const res = await erste.inject({
        method: "POST",
        url: "/api/users",
        headers: admin,
        payload: { name, email, password: KENNWORT, role },
      });
      expect(res.statusCode, res.body).toBe(201);
    }
    const carla = await anmelden(erste, "carla@teams-pg.test");
    const konten = (
      await erste.inject({ method: "GET", url: "/api/spaces/konten", headers: carla })
    ).json().konten as { id: string; name: string }[];
    const id = (name: string): string => konten.find((k) => k.name === name)?.id ?? "";

    const anlegen = async (name: string, mitglieder: string[]) => {
      const res = await erste.inject({
        method: "POST",
        url: "/api/teams",
        headers: admin,
        payload: {
          name,
          zweck: `${name} (fiktiv).`,
          verantwortlich: id("Carla Controller"),
          mitglieder,
        },
      });
      expect(res.statusCode, res.body).toBe(201);
      return res.json().id as string;
    };
    const mess = await anlegen("Messtechnik", [id("Erik Experte"), id("Vera Viewer")]);
    const zirkel = await anlegen("Qualitätszirkel", [id("Vera Viewer")]);

    const space = await erste.inject({
      method: "POST",
      url: "/api/spaces",
      headers: carla,
      payload: {
        name: "Labor",
        zweck: "Messmittel des Labors (fiktiv).",
        verantwortlich: id("Carla Controller"),
        zugang: "mitglieder",
        mitglieder: [],
        ansichten: [],
        teams: [{ team: mess, recht: "lesen" }],
      },
    });
    expect(space.statusCode, space.body).toBe(201);
    const spaceId = space.json().id as string;
    const zweiterSpace = await erste.inject({
      method: "POST",
      url: "/api/spaces",
      headers: carla,
      payload: {
        name: "Prüfstand",
        zweck: "Prüfstand (fiktiv).",
        verantwortlich: id("Carla Controller"),
        zugang: "mitglieder",
        mitglieder: [],
        ansichten: [],
        teams: [{ team: zirkel, recht: "lesen" }],
      },
    });
    expect(zweiterSpace.statusCode, zweiterSpace.body).toBe(201);
    const pruefstandId = zweiterSpace.json().id as string;

    const artikel = async (titel: string, ziel: string): Promise<string> => {
      const ko = await erste.inject({
        method: "POST",
        url: "/api/kos",
        headers: carla,
        payload: {
          confidentiality: "intern",
          title: `${WORT} ${titel}`,
          statement: `Der ${WORT} ${titel} läuft vor jeder Schicht (fiktiv).`,
          type: "best_practice",
          category: "Prüfmittel",
        },
      });
      expect(ko.statusCode, ko.body).toBe(201);
      const koId = ko.json().id as string;
      const v = await erste.inject({
        method: "POST",
        url: "/api/spaces/verschiebung/vorschau",
        headers: carla,
        payload: { koId, zielSpaceId: ziel },
      });
      expect(v.statusCode, v.body).toBe(200);
      const w = await erste.inject({
        method: "POST",
        url: "/api/spaces/verschiebung",
        headers: carla,
        payload: {
          koId,
          zielSpaceId: ziel,
          basis: {
            quelleId: null,
            quelleVersion: null,
            zielId: ziel,
            zielVersion: v.json().ziel.version,
          },
        },
      });
      expect(w.statusCode, w.body).toBe(200);
      return koId;
    };
    const koLabor = await artikel("Labor", spaceId);
    const koPruefstand = await artikel("Pruefstand", pruefstandId);

    // Der „offene Tab": Veras Sitzung, ausgestellt VOR dem Entzug, überlebt auch den Neustart.
    const veraTab = await anmelden(erste, "vera@teams-pg.test");
    expect(
      (await erste.inject({ method: "GET", url: `/api/kos/${koLabor}`, headers: veraTab }))
        .statusCode,
    ).toBe(200);
    const vorher = (
      await erste.inject({ method: "GET", url: `/api/kos/${koLabor}`, headers: carla })
    ).json();

    // Vera aus Messtechnik entfernen — regulär: Vorschau, dann Übernahme mit ihrer Grundlage.
    const vorschau = await erste.inject({
      method: "POST",
      url: `/api/teams/${mess}/vorschau`,
      headers: admin,
      payload: { mitglieder: [id("Erik Experte")] },
    });
    expect(vorschau.statusCode, vorschau.body).toBe(200);
    const entfernt = await erste.inject({
      method: "PUT",
      url: `/api/teams/${mess}`,
      headers: admin,
      payload: {
        version: 1,
        name: "Messtechnik",
        zweck: "Messtechnik (fiktiv).",
        verantwortlich: id("Carla Controller"),
        mitglieder: [id("Erik Experte")],
        grundlage: vorschau.json().grundlage,
      },
    });
    expect(entfernt.statusCode, entfernt.body).toBe(200);
    await beenden(erste);

    // --- Zweiter Server: neuer Pool, neue App — alles kommt aus der Datenbank ----------------
    const zweite = await neueApp();
    const admin2 = await anmelden(zweite, "ada@teams-pg.test");
    const erik = await anmelden(zweite, "erik@teams-pg.test");

    const liste = (
      await zweite.inject({ method: "GET", url: "/api/teams", headers: admin2 })
    ).json().teams as {
      id: string;
      name: string;
      version: number;
      mitglieder: { nutzer: string }[];
    }[];
    expect(liste.map((t) => [t.name, t.version])).toEqual([
      ["Messtechnik", 2],
      ["Qualitätszirkel", 1],
    ]);
    expect(liste[0]?.mitglieder.map((m) => m.nutzer)).toEqual([id("Erik Experte")]);
    const verlauf = (
      await zweite.inject({ method: "GET", url: `/api/teams/${mess}`, headers: admin2 })
    ).json().verlauf as { version: number; entfernt: { id: string }[] }[];
    expect(verlauf.map((v) => [v.version, v.entfernt.map((x) => x.id)])).toEqual([
      [1, []],
      [2, [id("Vera Viewer")]],
    ]);

    // Vera (die alte Sitzung): Laborartikel weg in Liste, Suche und Detail; Prüfstand über den
    // Qualitätszirkel bleibt. Erik (Mitglied) sieht den Laborartikel weiter.
    for (const pfad of ["/api/kos", `/api/library/search?q=${WORT}`]) {
      const res = await zweite.inject({ method: "GET", url: pfad, headers: veraTab });
      expect(res.statusCode, `${pfad}: ${res.body}`).toBe(200);
      expect(res.body, `Vera ${pfad}`).not.toContain(koLabor);
      expect(res.body, `Vera ${pfad}`).toContain(koPruefstand);
      const erikRes = await zweite.inject({ method: "GET", url: pfad, headers: erik });
      expect(erikRes.body, `Erik ${pfad}`).toContain(koLabor);
    }
    expect(
      (await zweite.inject({ method: "GET", url: `/api/kos/${koLabor}`, headers: veraTab }))
        .statusCode,
    ).toBe(404);
    const veraKonto = (
      (await zweite.inject({ method: "GET", url: "/api/users", headers: admin2 })).json() as {
        id: string;
        role: string;
      }[]
    ).find((u) => u.id === id("Vera Viewer"));
    expect(veraKonto?.role).toBe("viewer");

    // Archivieren des Qualitätszirkels — Folgen vorher, dann über einen dritten Neustart.
    const folgen = await zweite.inject({
      method: "POST",
      url: `/api/teams/${zirkel}/vorschau`,
      headers: admin2,
      payload: { archivieren: true },
    });
    expect(folgen.statusCode, folgen.body).toBe(200);
    expect(folgen.json().spaces).toEqual([
      { id: pruefstandId, name: "Prüfstand", recht: "lesen", verlieren: 1 },
    ]);
    const archiv = await zweite.inject({
      method: "POST",
      url: `/api/teams/${zirkel}/archivieren`,
      headers: admin2,
      payload: { version: 1, grundlage: folgen.json().grundlage },
    });
    expect(archiv.statusCode, archiv.body).toBe(200);
    await beenden(zweite);

    const dritte = await neueApp();
    const admin3 = await anmelden(dritte, "ada@teams-pg.test");
    const carla3 = await anmelden(dritte, "carla@teams-pg.test");
    const zirkelGelesen = (
      await dritte.inject({ method: "GET", url: `/api/teams/${zirkel}`, headers: admin3 })
    ).json();
    expect(zirkelGelesen.team.archiviert).toBe(true);
    expect(zirkelGelesen.verlauf.map((v: { vorgang: string }) => v.vorgang)).toEqual([
      "angelegt",
      "archiviert",
    ]);
    expect(
      (await dritte.inject({ method: "GET", url: `/api/kos/${koPruefstand}`, headers: veraTab }))
        .statusCode,
    ).toBe(404);
    const aendern = await dritte.inject({
      method: "PUT",
      url: `/api/teams/${zirkel}`,
      headers: admin3,
      payload: {
        version: 2,
        name: "Qualitätszirkel",
        zweck: "x",
        verantwortlich: id("Carla Controller"),
        mitglieder: [id("Vera Viewer"), id("Erik Experte")],
      },
    });
    expect(aendern.statusCode).toBe(409);
    expect(aendern.json().error).toBe("TEAM_ARCHIVIERT");

    // Der Artikel selbst: Autorschaft, Fassung und Historie unverändert.
    const nachher = (
      await dritte.inject({ method: "GET", url: `/api/kos/${koLabor}`, headers: carla3 })
    ).json();
    expect(nachher.author).toBe(vorher.author);
    expect(nachher.version).toBe(vorher.version);
    expect(nachher.history).toEqual(vorher.history);

    // Prüfprotokoll nach dem Neustart: alle Teamvorgänge stehen da.
    const audit = (
      await dritte.inject({ method: "GET", url: "/api/audit", headers: admin3 })
    ).json() as { action: string; target: string }[];
    expect(
      audit.filter((e) => e.action.startsWith("team.")).map((e) => [e.action, e.target]),
    ).toEqual([
      ["team.angelegt", mess],
      ["team.angelegt", zirkel],
      ["team.geaendert", mess],
      ["team.archiviert", zirkel],
    ]);
  });
});
