// ================================================================================================
// produkt:20261011:peter-p14 · Nacharbeit 5 — GEGEN ECHTES POSTGRESQL.
// ================================================================================================
//
// Drei Belege, die erst gegen eine echte Datenbank tragen:
//
//   1. ZEITMESSUNG (Bens Befund 4, Prüfnachtrag B-07 „Timing repräsentativ, In-Memory-ms keine
//      Produktlatenz"). Lea liest Liste und Suche über HTTP — vor und nach einer für sie
//      unsichtbaren Einzeländerung, nach einem grossen unsichtbaren Zuwachs und (Gegenprobe) nach
//      einem gleich grossen SICHTBAREN Zuwachs. Gemessen werden Antwort UND Dauer.
//
//      MESSBEDINGUNGEN (so steht es auch im Bericht `task.meta.zeitmessung`):
//        · PostgreSQL 16 (Wegwerf-Container `postgres:16-alpine` oder `KLARWERK_PG_TEST_URL`),
//          eigene frische Datenbank, `migrate()` + Suchprojektion v2, voller Produktaufbau
//          `buildApp(buildPgServices(pool))`.
//        · Anfrage über `app.inject` — Fastify-Routing, Anmeldung, Rechteerhebung, SQL, Serialisierung;
//          OHNE Netzwerk, TLS und Browser. Das ist Serverlatenz, keine Ende-zu-Ende-Zeit.
//        · Je Zustand und Weg erst `AUFWAERMEN` Läufe (verworfen), dann `LAEUFE` gemessene Läufe
//          nacheinander, `process.hrtime.bigint()`; berichtet werden Median und 90. Perzentil in ms.
//        · Keine Parallellast; Rechner und Container sind nicht exklusiv — Werte sind Grössenordnungen.
//
//      WAS BEHAUPTET WIRD: (a) Die ANTWORTEN sind vor/nach der unsichtbaren Einzeländerung und
//      dem unsichtbaren Zuwachs zeichengleich; die sichtbare Gegenprobe ändert sie. (b) Eine
//      unsichtbare EINZELÄNDERUNG liegt im Rauschen (grosszügige Schranke, s. unten). NICHT
//      behauptet: dass ein grosser unsichtbarer ZUWACHS zeitlich unsichtbar wäre — die Abfrage prüft
//      jede Zeile des Bestands gegen das Rechteprädikat, die Dauer wächst mit dem Gesamtbestand. Der
//      gemessene Unterschied wird berichtet und ist als Restseitenkanal benannt.
//
//   2. SQL-PARITÄT des bereichsgebundenen Existenzrechts (`bereichsTrim` = `darfSehen` mit
//      Bereichsblick und genau diesem Space).
//
//   3. LERNVERLAUF DER HALBWERTSZEITEN: die neue Spalte `oeffentlich` übersteht den Speicherweg; ein
//      Altverlauf ohne Angabe (NULL) zählt beim Lernen nicht.
//
// INFRASTRUKTUR wie `tests/spaces/spaces-pg.integration.test.ts`: fehlt beides, SCHEITERT der Lauf.
// Alle Namen, Konten und Inhalte sind erfundene Testdaten.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { bereichsTrim, bereichsblick } from "../../services/app/src/existenzhinweis";
import type { SessionUser } from "../../services/app/src/http";
import { darfSehen, sqlSichtbarkeitFuer } from "../../services/app/src/sichtbarkeit";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { PgKoRepo } from "../../services/knowledge-object";
import { halbwertszeitenAusVerlauf } from "../../services/knowledge-object/src/frische";
import { PgHalbwertszeitVerlauf } from "../../services/knowledge-object/src/halbwertszeit-verlauf";

type App = ReturnType<typeof buildApp>;
type Dienste = ReturnType<typeof buildPgServices>;
type Kopf = { authorization: string };

const KENNWORT = "geheim12345";
const WORT = "Drehmomentschluesselpruefung";
const AUFWAERMEN = 10;
const LAEUFE = 60;
const ZUWACHS = 400;

function perzentil(werte: readonly number[], p: number): number {
  const s = [...werte].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? Number.NaN;
}

describe("P14 · Nacharbeit 5 gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let verwaltung: Pool | undefined;
  let datenbank = "";
  let url = "";
  let pool: Pool | undefined;
  let app: App;
  let dienste: Dienste;

  async function anmelden(email: string): Promise<Kopf> {
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
    datenbank = `klarwerk_p14_test_${`${Date.now()}`.slice(-9)}`;
    verwaltung = new Pool({ connectionString: basis });
    await verwaltung.query(`CREATE DATABASE ${datenbank}`);
    const ziel = new URL(basis);
    ziel.pathname = `/${datenbank}`;
    url = ziel.toString();
    pool = createPool(url);
    await migrate(pool);
    await migrate(pool); // wiederholbar — auch die neue Spalte
    dienste = buildPgServices(pool);
    await dienste.ko.activateSearchProjectionV2();
    app = buildApp(dienste);
    await app.ready();
  }, 300_000);

  afterAll(async () => {
    await app?.close();
    await pool?.end();
    if (verwaltung) {
      await verwaltung
        .query(`DROP DATABASE IF EXISTS ${datenbank} WITH (FORCE)`)
        .catch(() => undefined);
      await verwaltung.end();
    }
    await container?.stop();
  }, 120_000);

  it("Zeitmessung: Leas Antworten sind gleich, eine unsichtbare Einzeländerung liegt im Rauschen — Gegenprobe sichtbar", async ({
    task,
  }) => {
    // --- Aufbau über HTTP: Ada (Admin), Carla (Controller), Lea (Experte) -----------------------
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Ada Admin", email: "ada@p14.test", password: KENNWORT },
    });
    const ada = await anmelden("ada@p14.test");
    for (const [name, email, role] of [
      ["Carla Controller", "carla@p14.test", "controller"],
      ["Lea Leitung", "lea@p14.test", "experte"],
    ] as const) {
      const res = await app.inject({
        method: "POST",
        url: "/api/users",
        headers: ada,
        payload: { name, email, password: KENNWORT, role },
      });
      expect(res.statusCode, res.body).toBe(201);
    }
    const carla = await anmelden("carla@p14.test");
    const lea = await anmelden("lea@p14.test");
    const konten = (
      await app.inject({ method: "GET", url: "/api/spaces/konten", headers: carla })
    ).json().konten as { id: string; name: string }[];
    const id = (name: string) => konten.find((k) => k.name === name)?.id ?? "";
    const space = async (name: string, partner: string, mitglieder: unknown[]) => {
      const res = await app.inject({
        method: "POST",
        url: "/api/spaces",
        headers: carla,
        payload: {
          name,
          zweck: `Austausch mit ${partner}.`,
          verantwortlich: id("Carla Controller"),
          zugang: "mitglieder",
          mitglieder,
          ansichten: [],
          partner,
        },
      });
      expect(res.statusCode, res.body).toBe(201);
      return res.json().id as string;
    };
    const alpha = await space("Partner Alpha", "Alpha GmbH", [
      { nutzer: id("Lea Leitung"), recht: "lesen" },
    ]);
    const beta = await space("Partner Beta", "Beta AG", []);
    const lege = async (titel: string, spaceId?: string) => {
      const ko = await dienste.ko.create({
        title: `${WORT} ${titel}`,
        statement: `Der ${WORT} ${titel} läuft vor jeder Schicht.`,
        type: "best_practice",
        category: "Messtechnik",
        author: id("Carla Controller"),
        confidentiality: "intern",
      });
      if (spaceId) {
        await dienste.ko.setLeadingSpace(ko.id, spaceId, id("Carla Controller"), null);
      }
      return ko.id;
    };
    for (let i = 0; i < 40; i++) {
      await lege(`Eigen ${i}`);
      await lege(`Alpha ${i}`, alpha);
      await lege(`Beta ${i}`, beta);
    }

    // --- Messung ------------------------------------------------------------------------------
    const wege = {
      liste: "/api/kos?firmenbereich=eigen,partner,oeffentlich",
      suche: `/api/library/search?q=${WORT}`,
    };
    const miss = async () => {
      const aus: Record<string, { koerper: string; medianMs: number; p90Ms: number }> = {};
      for (const [weg, pfad] of Object.entries(wege)) {
        let koerper = "";
        const dauern: number[] = [];
        for (let lauf = 0; lauf < AUFWAERMEN + LAEUFE; lauf++) {
          const start = process.hrtime.bigint();
          const res = await app.inject({ method: "GET", url: pfad, headers: lea });
          const ms = Number(process.hrtime.bigint() - start) / 1e6;
          expect(res.statusCode, res.body).toBe(200);
          koerper = res.body;
          if (lauf >= AUFWAERMEN) {
            dauern.push(ms);
          }
        }
        aus[weg] = {
          koerper,
          medianMs: perzentil(dauern, 50),
          p90Ms: perzentil(dauern, 90),
        };
      }
      return aus;
    };
    const zustand = (m: Awaited<ReturnType<typeof miss>>) =>
      Object.fromEntries(
        Object.entries(m).map(([w, v]) => [w, { medianMs: v.medianMs, p90Ms: v.p90Ms }]),
      );

    const basis = await miss();
    // Unsichtbare Einzeländerung: eine neue Fassung in Beta und ein neuer Beta-Eintrag.
    const betaEins = await lege("BetaNeu", beta);
    const neueFassung = { statement: "Beta prüft künftig zweimal." };
    await dienste.ko.revise(betaEins, neueFassung, id("Carla Controller"));
    const einzeln = await miss();
    // Grosser unsichtbarer Zuwachs.
    for (let i = 0; i < ZUWACHS; i++) {
      await lege(`BetaMasse ${i}`, beta);
    }
    const zuwachs = await miss();
    // GEGENPROBE: derselbe Zuwachs, aber für Lea sichtbar (Alpha).
    for (let i = 0; i < ZUWACHS; i++) {
      await lege(`AlphaMasse ${i}`, alpha);
    }
    const sichtbar = await miss();

    const messung = {
      bedingungen: {
        datenbank: "PostgreSQL 16 (Container oder KLARWERK_PG_TEST_URL), frische Datenbank",
        weg: "app.inject (Fastify, Anmeldung, Rechte, SQL, Serialisierung; ohne Netz/TLS/Browser)",
        aufwaermen: AUFWAERMEN,
        laeufe: LAEUFE,
        bestand: { sichtbarFuerLea: 80, unsichtbarFuerLea: 40, zuwachs: ZUWACHS },
      },
      basis: zustand(basis),
      unsichtbareEinzelaenderung: zustand(einzeln),
      unsichtbarerZuwachs: zustand(zuwachs),
      sichtbarerZuwachsGegenprobe: zustand(sichtbar),
    };
    (task.meta as Record<string, unknown>).zeitmessung = messung;
    console.info(`P14 Zeitmessung ${JSON.stringify(messung)}`);

    for (const weg of Object.keys(wege)) {
      // (a) Antworten: unsichtbar → zeichengleich; sichtbar → anders (die Messung trägt).
      expect(einzeln[weg]?.koerper, weg).toBe(basis[weg]?.koerper);
      expect(zuwachs[weg]?.koerper, weg).toBe(basis[weg]?.koerper);
      expect(sichtbar[weg]?.koerper, weg).not.toBe(basis[weg]?.koerper);
      // (b) Die unsichtbare Einzeländerung liegt im Rauschen: Median höchstens 50 % plus 5 ms über
      // der Basis. Grosszügig gewählt — die Schranke soll einen echten Mehraufwand je verborgenem
      // Treffer (etwa ein Nachladen) fangen, nicht Messrauschen.
      const b = basis[weg]?.medianMs ?? Number.NaN;
      expect(einzeln[weg]?.medianMs ?? Number.NaN, weg).toBeLessThanOrEqual(b * 1.5 + 5);
    }
  }, 600_000);

  it("Existenzrecht: `bereichsTrim` in SQL ist dieselbe Menge wie `darfSehen` mit Bereichsblick", async () => {
    const p = pool as Pool;
    const repo = new PgKoRepo(p);
    const alle = await repo.list({});
    const spaces = [
      ...new Set(alle.flatMap((k) => (typeof k.spaceId === "string" ? [k.spaceId] : []))),
    ];
    expect(spaces.length).toBeGreaterThanOrEqual(2);
    let mitTreffer = 0;
    for (const role of ["viewer", "experte", "controller"] as const) {
      const user: SessionUser = { id: "u-fremd", role, spaceLesbar: new Set() };
      for (const s of spaces) {
        const blick = bereichsblick(user, s);
        const erwartet = alle
          .filter((k) => !k.deletedAt && k.spaceId === s && darfSehen(blick, k))
          .map((k) => k.id)
          .sort();
        const trim = bereichsTrim(sqlSichtbarkeitFuer(blick), s);
        const ausSql = (await repo.listForSearch({}, trim)).map((k) => k.id).sort();
        expect(ausSql, `${role} · ${s}`).toEqual(erwartet);
        if (erwartet.length > 0) {
          mitTreffer += 1;
        }
      }
    }
    expect(mitTreffer).toBeGreaterThan(0);
  });

  it("Lernverlauf: `oeffentlich` übersteht den Speicherweg; Altverlauf (NULL) zählt nicht", async () => {
    const p = pool as Pool;
    const verlauf = new PgHalbwertszeitVerlauf(p);
    const zeile = (koId: string, oeffentlich?: boolean) => ({
      koId,
      ende: "2026-01-10T00:00:00.000Z",
      kategorie: "p14-lernprobe",
      tage: 40,
      erfasst: "2026-01-10T00:00:00.000Z",
      ...(oeffentlich === undefined ? {} : { oeffentlich }),
    });
    await verlauf.ergaenze([
      zeile("lp-1", true),
      zeile("lp-2", true),
      zeile("lp-3", true),
      zeile("lp-4", false),
    ]);
    await p.query(
      "INSERT INTO ko_halbwertszeit_beobachtungen(ko_id, ende, kategorie, tage, erfasst) VALUES($1,$2,$3,$4,$5)",
      ["lp-alt", "2026-01-10T00:00:00.000Z", "p14-lernprobe", 40, "2026-01-10T00:00:00.000Z"],
    );
    const gelesen = (await verlauf.alle()).filter((e) => e.kategorie === "p14-lernprobe");
    const nach = Object.fromEntries(gelesen.map((e) => [e.koId, e.oeffentlich]));
    expect(nach).toEqual({
      "lp-1": true,
      "lp-2": true,
      "lp-3": true,
      "lp-4": false,
      "lp-alt": undefined,
    });
    expect(halbwertszeitenAusVerlauf(gelesen).get("p14-lernprobe")).toEqual({
      tage: 40,
      beobachtungen: 3,
    });
  });
});
