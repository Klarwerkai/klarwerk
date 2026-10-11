// ================================================================================================
// ADMIN-07 · SPACES VERWALTEN GEGEN ECHTES POSTGRESQL — Zustand nach Neustart (K1, K5, K6).
// ================================================================================================
//
// `spaces-verwaltung-api.test.ts` misst den Draht an der Speicherablage. Hier steht, was erst gegen
// eine ECHTE Datenbank belegt ist:
//   K1 · Gruppe und Spaceregeln stehen nach Neustart (neuer Pool, neue App) unverändert da.
//   K5 · Archivstatus, Vorgang und Begründung überleben den Neustart; im Archiv bleibt die Pflege
//        gesperrt; die Wiederaufnahme steht danach im Verlauf.
//   K6 · Die Bestandszuordnung (führender Space am Artikel) und ihr Protokoll (Prüfprotokoll in PG)
//        sind nach Neustart prüfbar; der Unberechtigte findet den Artikel weder per Suche noch Link.
//
// Der volle Produktaufbau: `migrate()`, `buildPgServices`, `buildApp`; eine EIGENE, frische
// Datenbank je Lauf, danach abgeräumt. Alle Namen und Inhalte sind erfundene Testdaten.
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

const KENNWORT = "geheim12345";
const WORT = "Gewindelehrenpflege";

describe("ADMIN-07 · Spaces verwalten gegen echtes PostgreSQL", () => {
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
    datenbank = `klarwerk_spaces_admin_test_${`${Date.now()}`.slice(-9)}`;
    verwaltung = new Pool({ connectionString: basis });
    await verwaltung.query(`CREATE DATABASE ${datenbank}`);
    const ziel = new URL(basis);
    ziel.pathname = `/${datenbank}`;
    url = ziel.toString();
    const pool = createPool(url);
    try {
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

  it("Gruppe, Regeln, Archiv mit Begründung und Bestandsprotokoll überleben den Neustart", async () => {
    // --- Erster Server -----------------------------------------------------------------------
    const erste = await neueApp();
    await erste.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Ada Admin", email: "admin@admin07-pg.test", password: KENNWORT },
    });
    const admin = await anmelden(erste, "admin@admin07-pg.test");
    for (const [name, email] of [
      ["Lea Leitung", "lea@admin07-pg.test"],
      ["Fritz Fremd", "fritz@admin07-pg.test"],
    ] as const) {
      const res = await erste.inject({
        method: "POST",
        url: "/api/users",
        headers: admin,
        payload: { name, email, password: KENNWORT, role: "experte" },
      });
      expect(res.statusCode, res.body).toBe(201);
    }
    const lea = await anmelden(erste, "lea@admin07-pg.test");
    const konten = (
      await erste.inject({ method: "GET", url: "/api/spaces/konten", headers: lea })
    ).json().konten as { id: string; name: string }[];
    const leaId = konten.find((k) => k.name === "Lea Leitung")?.id ?? "";
    expect(leaId).not.toBe("");

    const angelegt = await erste.inject({
      method: "POST",
      url: "/api/spaces",
      headers: admin,
      payload: {
        name: "Gewindeprüfung",
        zweck: "Gewindelehren und ihre Pflege.",
        verantwortlich: leaId,
        zugang: "mitglieder",
        mitglieder: [],
        ansichten: [],
        gruppe: "Messmittel",
        regeln: "Jede Lehre trägt ein Prüfdatum.",
      },
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    const spaceId = angelegt.json().id as string;

    // Bestand: ein Artikel der Zuständigen ohne Space, per Tag zugeordnet.
    const ko = await erste.inject({
      method: "POST",
      url: "/api/kos",
      headers: lea,
      payload: {
        confidentiality: "intern",
        title: `${WORT} am Prüfplatz`,
        statement: `Die ${WORT} läuft monatlich.`,
        type: "best_practice",
        category: "Prüfmittel",
        tags: ["gewinde-bestand"],
      },
    });
    expect(ko.statusCode, ko.body).toBe(201);
    const koId = ko.json().id as string;
    const regeln = [{ tag: "gewinde-bestand", zielSpaceId: spaceId }];
    const plan = await erste.inject({
      method: "POST",
      url: "/api/spaces/bestand/vorschau",
      headers: admin,
      payload: { regeln },
    });
    expect(plan.statusCode, plan.body).toBe(200);
    expect(plan.json().zuordnungen.map((z: { koId: string }) => z.koId)).toEqual([koId]);
    const zu = await erste.inject({
      method: "POST",
      url: "/api/spaces/bestand/zuordnung",
      headers: admin,
      payload: { regeln, grundlage: plan.json().grundlage },
    });
    expect(zu.statusCode, zu.body).toBe(200);

    // Archivieren mit Folgen und Begründung.
    const folgen = (
      await erste.inject({
        method: "POST",
        url: `/api/spaces/${spaceId}/archivierung/vorschau`,
        headers: lea,
        payload: {},
      })
    ).json();
    expect(folgen.darfArchivieren, JSON.stringify(folgen)).toBe(true);
    const archiv = await erste.inject({
      method: "POST",
      url: `/api/spaces/${spaceId}/archivieren`,
      headers: lea,
      payload: {
        version: folgen.version,
        grundlage: folgen.grundlage,
        begruendung: "Lehren gehen an das Zentrallabor.",
      },
    });
    expect(archiv.statusCode, archiv.body).toBe(200);
    await beenden(erste);

    // --- Zweiter Server: alles aus der Datenbank -----------------------------------------------
    const zweite = await neueApp();
    const lea2 = await anmelden(zweite, "lea@admin07-pg.test");
    const admin2 = await anmelden(zweite, "admin@admin07-pg.test");
    const fritz = await anmelden(zweite, "fritz@admin07-pg.test");

    const gelesen = (
      await zweite.inject({ method: "GET", url: `/api/spaces/${spaceId}`, headers: lea2 })
    ).json();
    expect(gelesen.space).toMatchObject({
      gruppe: "Messmittel",
      regeln: "Jede Lehre trägt ein Prüfdatum.",
      archiviert: true,
      vorgang: "archiviert",
      version: 2,
    });
    expect(gelesen.fassungen.at(-1)).toMatchObject({
      vorgang: "archiviert",
      begruendung: "Lehren gehen an das Zentrallabor.",
    });
    const pflege = await zweite.inject({
      method: "PUT",
      url: `/api/spaces/${spaceId}`,
      headers: lea2,
      payload: { ...gelesen.space, zweck: "Im Archiv geändert." },
    });
    expect(pflege.statusCode).toBe(409);

    // Bestand: führender Space am Artikel, Protokoll aus dem Prüfprotokoll.
    const artikel = (
      await zweite.inject({ method: "GET", url: `/api/kos/${koId}`, headers: lea2 })
    ).json();
    expect(artikel.spaceId).toBe(spaceId);
    const prot = (
      await zweite.inject({ method: "GET", url: "/api/spaces/bestand/protokoll", headers: admin2 })
    ).json();
    expect(prot.laeufe).toHaveLength(1);
    expect(prot.laeufe[0].zugeordnet).toEqual([{ koId, zielSpaceId: spaceId }]);
    // KALIBRIERUNG: die Zuständige findet ihn in der Suche (SQL-Trim), Fritz weder dort noch direkt.
    const leaSuche = await zweite.inject({
      method: "GET",
      url: `/api/library/search?q=${WORT}`,
      headers: lea2,
    });
    expect(leaSuche.body).toContain(koId);
    for (const url2 of [`/api/kos/${koId}`, `/api/library/search?q=${WORT}`]) {
      const res = await zweite.inject({ method: "GET", url: url2, headers: fritz });
      expect(res.body, `Fritz ${url2}`).not.toContain(WORT);
    }

    // Wiederaufnahme nach Neustart, im Verlauf mit Begründung.
    const wieder = await zweite.inject({
      method: "POST",
      url: `/api/spaces/${spaceId}/wiederaufnehmen`,
      headers: lea2,
      payload: { version: 2, begruendung: "Zentrallabor verschoben." },
    });
    expect(wieder.statusCode, wieder.body).toBe(200);
    const verlauf = (
      await zweite.inject({ method: "GET", url: `/api/spaces/${spaceId}`, headers: lea2 })
    ).json().fassungen as { vorgang: string; begruendung: string | null }[];
    expect(verlauf.map((f) => f.vorgang)).toEqual(["angelegt", "archiviert", "wiederaufgenommen"]);
    expect(verlauf.at(-1)?.begruendung).toBe("Zentrallabor verschoben.");
  });
});
