// ================================================================================================
// SPACES · DER ECHTE SPEICHERWEG — PostgreSQL, Neustart, SQL-Trim vor dem LIMIT (K1, K3, K4, K6).
// ================================================================================================
//
// `spaces-api.test.ts` misst den Draht an der Speicherablage. Zwei Dinge sind erst gegen eine
// ECHTE Datenbank belegt, und genau die stehen hier:
//   K1/K4 · Space-Fassungen und der führende Space eines Artikels überleben einen Neustart
//           (neuer Pool, neue App) — mit unveränderter Fassung, Autorschaft und Historie.
//   K3/K6 · Der führende Space wirkt im SQL-Prädikat (`sqlSichtbarkeitFuer`, Liste/Tag/Suche) und
//           am Detailabruf — für Nichtmitglieder fehlt der Artikel, für Mitglieder ist er da.
//
// Der volle Produktaufbau: `migrate()` (mit `SPACES_SCHEMA`), `buildPgServices`, `buildApp`. Jede
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
import { PgSpacesRepo } from "../../services/app/src/spaces";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

type App = ReturnType<typeof buildApp>;
type Kopf = { authorization: string };

const KENNWORT = "geheim12345";
const WORT = "Kalibrierlehrenpruefung";

describe("Spaces gegen echtes PostgreSQL", () => {
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
    // Eine eigene, frische Datenbank: die Ersteinrichtung (erstes Konto = Admin) braucht eine leere
    // Kontentabelle, und kein anderer Lauf soll diesen Bestand sehen.
    datenbank = `klarwerk_spaces_test_${`${Date.now()}`.slice(-9)}`;
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

  it("Space und führender Space überleben den Neustart; der SQL-Trim lässt Nichtmitglieder aussen vor", async () => {
    // --- Erster Server: Konten, Space, Artikel, Spacewechsel mit Vorschau ---------------------
    const erste = await neueApp();
    await erste.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Ada Admin", email: "admin@spaces-pg.test", password: KENNWORT },
    });
    const admin = await anmelden(erste, "admin@spaces-pg.test");
    for (const [name, email] of [
      ["Lea Leitung", "lea@spaces-pg.test"],
      ["Erik Experte", "erik@spaces-pg.test"],
      ["Fritz Fremd", "fritz@spaces-pg.test"],
    ] as const) {
      const res = await erste.inject({
        method: "POST",
        url: "/api/users",
        headers: admin,
        payload: { name, email, password: KENNWORT, role: "experte" },
      });
      expect(res.statusCode, res.body).toBe(201);
    }
    const erik = await anmelden(erste, "erik@spaces-pg.test");
    const konten = (
      await erste.inject({ method: "GET", url: "/api/spaces/konten", headers: erik })
    ).json().konten as { id: string; name: string }[];
    const id = (name: string): string => konten.find((k) => k.name === name)?.id ?? "";

    const angelegt = await erste.inject({
      method: "POST",
      url: "/api/spaces",
      headers: admin,
      payload: {
        name: "Werkstatt Nord",
        zweck: "Prüfmittel der Werkstatt Nord.",
        verantwortlich: id("Lea Leitung"),
        zugang: "mitglieder",
        mitglieder: [{ nutzer: id("Erik Experte"), recht: "schreiben" }],
        ansichten: [{ name: "Prüfmittel", tag: "pruefmittel" }],
      },
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    const space = angelegt.json() as { id: string };

    const ko = await erste.inject({
      method: "POST",
      url: "/api/kos",
      headers: erik,
      payload: {
        confidentiality: "intern",
        title: `${WORT} am Messplatz`,
        statement: `Die ${WORT} läuft vor jeder Schicht.`,
        type: "best_practice",
        category: "Prüfmittel",
        tags: ["pruefmittel"],
      },
    });
    expect(ko.statusCode, ko.body).toBe(201);
    const koId = ko.json().id as string;
    const vorher = (
      await erste.inject({ method: "GET", url: `/api/kos/${koId}`, headers: erik })
    ).json();

    const v = await erste.inject({
      method: "POST",
      url: "/api/spaces/verschiebung/vorschau",
      headers: erik,
      payload: { koId, zielSpaceId: space.id },
    });
    expect(v.statusCode, v.body).toBe(200);
    expect(
      v
        .json()
        .verlieren.map((x: { name: string }) => x.name)
        .sort(),
    ).toEqual(["Ada Admin", "Fritz Fremd"]);
    const wechsel = await erste.inject({
      method: "POST",
      url: "/api/spaces/verschiebung",
      headers: erik,
      payload: {
        koId,
        zielSpaceId: space.id,
        basis: {
          quelleId: null,
          quelleVersion: null,
          zielId: space.id,
          zielVersion: v.json().ziel.version,
        },
      },
    });
    expect(wechsel.statusCode, wechsel.body).toBe(200);
    await beenden(erste);

    // --- Zweiter Server: neuer Pool, neue App — alles kommt aus der Datenbank ----------------
    const zweite = await neueApp();
    const lea = await anmelden(zweite, "lea@spaces-pg.test");
    const erik2 = await anmelden(zweite, "erik@spaces-pg.test");
    const fritz = await anmelden(zweite, "fritz@spaces-pg.test");
    const admin2 = await anmelden(zweite, "admin@spaces-pg.test");

    const gelesen = (
      await zweite.inject({ method: "GET", url: `/api/spaces/${space.id}`, headers: lea })
    ).json();
    expect(gelesen.space).toMatchObject({
      name: "Werkstatt Nord",
      zweck: "Prüfmittel der Werkstatt Nord.",
      verantwortlich: id("Lea Leitung"),
      zugang: "mitglieder",
      version: 1,
    });
    const bearbeitet = await zweite.inject({
      method: "PUT",
      url: `/api/spaces/${space.id}`,
      headers: lea,
      payload: { ...gelesen.space, zweck: "Prüfmittel und Kalibrierung der Werkstatt Nord." },
    });
    expect(bearbeitet.statusCode, bearbeitet.body).toBe(200);
    expect(bearbeitet.json().version).toBe(2);

    const nachher = (
      await zweite.inject({ method: "GET", url: `/api/kos/${koId}`, headers: erik2 })
    ).json();
    expect(nachher.spaceId).toBe(space.id);
    expect(nachher.version).toBe(vorher.version);
    expect(nachher.author).toBe(vorher.author);
    expect(nachher.history).toEqual(vorher.history);

    // Mitglied: Liste (SQL-Trim), Tag (SQL-Trim), Suche (Projektion + SQL-Trim), Space-Artikel.
    for (const url2 of ["/api/kos", "/api/kos?tag=pruefmittel", `/api/library/search?q=${WORT}`]) {
      const res = await zweite.inject({ method: "GET", url: url2, headers: erik2 });
      expect(res.statusCode, `${url2}: ${res.body}`).toBe(200);
      expect(res.body, `Mitglied ${url2}`).toContain(koId);
    }
    const imSpace = (
      await zweite.inject({ method: "GET", url: `/api/spaces/${space.id}/artikel`, headers: erik2 })
    ).json();
    expect(imSpace.artikel.map((a: { id: string; version: number }) => [a.id, a.version])).toEqual([
      [koId, vorher.version],
    ]);

    // Nichtmitglieder — auch der Admin: nichts in Liste, Tag und Suche; Detail 404.
    for (const [wer, kopf] of [
      ["Fritz", fritz],
      ["Admin", admin2],
    ] as const) {
      for (const url2 of [
        "/api/kos",
        "/api/kos?tag=pruefmittel",
        `/api/library/search?q=${WORT}`,
      ]) {
        const res = await zweite.inject({ method: "GET", url: url2, headers: kopf });
        expect(res.statusCode, `${wer} ${url2}: ${res.body}`).toBe(200);
        expect(res.body, `${wer} ${url2}`).not.toContain(koId);
      }
      const detail = await zweite.inject({ method: "GET", url: `/api/kos/${koId}`, headers: kopf });
      expect(detail.statusCode, wer).toBe(404);
      expect(detail.body).not.toContain(WORT);
    }
  });

  // aufnahme:20260922:gesamt-wissensprojekte — der Löschvermerk ist eine weitere Zeile. `aktuelle()`
  // muss erst die jüngste Fassung wählen und DANN den Vermerk auswerten; sonst träte Fassung 1
  // eines gelöschten Space wieder an seine Stelle. Gemessen über zwei Pools (Neustart).
  it("ein gelöschter Space fehlt in aktuelle() — auch nach dem Neustart; sein Verlauf bleibt", async () => {
    const id = `geloescht-${Date.now()}`;
    const basis = {
      id,
      name: "Altprojekt",
      zweck: "Wird gelöscht.",
      verantwortlich: "konto-1",
      zugang: "alle" as const,
      mitglieder: [],
      ansichten: [],
      angelegtVon: "konto-1",
      angelegtAm: "2026-10-08T08:00:00.000Z",
      geaendertVon: "konto-1",
      geaendertAm: "2026-10-08T08:00:00.000Z",
    };
    const erster = createPool(url);
    try {
      const repo = new PgSpacesRepo(erster);
      expect(await repo.lege({ ...basis, version: 1 })).toBe(true);
      expect((await repo.aktuelle()).map((s) => s.id)).toContain(id);
      const vermerk = { ...basis, version: 2, geloeschtAm: "2026-10-08T09:00:00.000Z" };
      expect(await repo.lege(vermerk)).toBe(true);
      expect((await repo.aktuelle()).map((s) => s.id)).not.toContain(id);
    } finally {
      await erster.end();
    }
    const zweiter = createPool(url);
    try {
      const repo = new PgSpacesRepo(zweiter);
      expect((await repo.aktuelle()).map((s) => s.id)).not.toContain(id);
      const verlauf = await repo.fassungen(id);
      expect(verlauf.map((f) => [f.version, f.geloeschtAm ?? null])).toEqual([
        [1, null],
        [2, "2026-10-08T09:00:00.000Z"],
      ]);
    } finally {
      await zweiter.end();
    }
  });

  // Nacharbeit 4 (Bens Befund): Spacewechsel und Spacelöschung laufen unter `exklusiv`. Zwei Repos
  // an ZWEI Pools stehen für zwei App-Prozesse an derselben Datenbank — die prozessweite
  // Warteschlange allein trennte sie nicht, erst die Datenbanksperre.
  it("exklusiv schliesst zwei Prozesse an derselben Datenbank gegenseitig aus", async () => {
    const poolA = createPool(url);
    const poolB = createPool(url);
    try {
      const a = new PgSpacesRepo(poolA);
      const b = new PgSpacesRepo(poolB);
      const ablauf: string[] = [];
      let zweite: Promise<void> | undefined;
      await a.exklusiv(async () => {
        ablauf.push("a-beginn");
        zweite = b.exklusiv(async () => {
          ablauf.push("b");
        });
        await new Promise((fertig) => setTimeout(fertig, 300));
        ablauf.push("a-ende");
      });
      await zweite;
      expect(ablauf).toEqual(["a-beginn", "a-ende", "b"]);
      // Auch nach einem Fehler in der Arbeit ist die Sperre wieder frei.
      await expect(
        a.exklusiv(async () => {
          throw new Error("Probe");
        }),
      ).rejects.toThrow("Probe");
      expect(await b.exklusiv(async () => "frei")).toBe("frei");
    } finally {
      await poolA.end();
      await poolB.end();
    }
  });
});
