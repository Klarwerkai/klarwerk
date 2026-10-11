// ================================================================================================
// BPA-02 · DER PRODUKTIVE SPEICHERWEG — PostgreSQL und Neustart.
// ================================================================================================
//
// Der volle Produktaufbau: `migrate()` (zweimal), `buildPgServices`, `buildApp`. Die Übernahme wird
// geschrieben, App und Pool werden beendet, danach liest ein NEUER Pool mit neuen Diensten — derselbe
// Weg wie nach einem Neustart. Gemessen wird, was die In-Memory-Ablage nicht zeigen kann:
//
//   N1 · Ergebnisobjekt (Entwurf) und Eigentümer sind nach dem Neustart erreichbar; Herkunft je Beleg
//        mit Fassung ist erhalten; Entwurf, Übernahme ins Wissen und fachliche Freigabe sind getrennt
//        ausgewiesen (AC10, AC03).
//   N2 · Dieselbe Übernahme nach dem Neustart erneut (neue Vorschau, neu gelesene Quelle) →
//        derselbe Entwurf, keine Dublette (AC06); der Quellenabgleich findet ihn bei geänderter
//        Quelle, und sein Vermerk übersteht einen weiteren Neustart (AC08).
//
// INFRASTRUKTUR: `KLARWERK_PG_TEST_URL` (Datenbankname mit `test`), sonst ein Wegwerf-Container.
// Fehlt beides, SCHEITERT der Lauf — kein stiller Skip. Alle Inhalte sind erfundene Testdaten.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { belegFassung } from "../../services/app/src/technische-daten";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { DATENBLATT, HTML_SEITE, geaendert } from "./fixture";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

type App = ReturnType<typeof buildApp>;
type Kopf = { authorization: string };

const KENNWORT = "geheim12345";
const EMAIL = "anna@ventile-pg.test";
const AUFTRAG = {
  belege: [HTML_SEITE, DATENBLATT],
  ziel: { objekt: "V-17" },
  schutzklasse: "intern",
};

describe("BPA-02 · Übernahme technischer Daten gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let verwaltung: Pool | undefined;
  let datenbank = "";
  let url = "";
  const offen: { pool: Pool; app: App }[] = [];
  let entwurfId = "";
  let annaId = "";

  async function neu(): Promise<App> {
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

  /** Der Adapterweg: Vorschau, Quelle neu lesen (spätere Erfassungszeit), Übernahme mit Beleg. */
  async function uebernehmen(app: App, wer: Kopf, minuten: number) {
    const vorschau = await app.inject({
      method: "POST",
      url: "/api/technische-daten/vorschau",
      headers: wer,
      payload: { belege: AUFTRAG.belege, ziel: AUFTRAG.ziel },
    });
    expect(vorschau.statusCode, vorschau.body).toBe(200);
    const spaeter = (iso: string) => new Date(Date.parse(iso) + minuten * 60_000).toISOString();
    return app.inject({
      method: "POST",
      url: "/api/technische-daten/uebernahme",
      headers: wer,
      payload: {
        ...AUFTRAG,
        belege: AUFTRAG.belege.map((b) => ({ ...b, abgerufenAm: spaeter(b.abgerufenAm) })),
        vorschaubeleg: vorschau.json().vorschaubeleg,
      },
    });
  }

  async function anmelden(app: App): Promise<Kopf> {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: EMAIL, password: KENNWORT },
    });
    expect(res.statusCode, `Anmeldung: ${res.body}`).toBe(200);
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
    datenbank = `klarwerk_techdaten_test_${`${Date.now()}`.slice(-9)}`;
    verwaltung = new Pool({ connectionString: basis });
    await verwaltung.query(`CREATE DATABASE ${datenbank}`);
    const ziel = new URL(basis);
    ziel.pathname = `/${datenbank}`;
    url = ziel.toString();
    const pool = createPool(url);
    try {
      await migrate(pool);
      await migrate(pool);
      await buildPgServices(pool).ko.activateSearchProjectionV2();
    } finally {
      await pool.end();
    }
    const app = await neu();
    const reg = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Anna", email: EMAIL, password: KENNWORT },
    });
    expect(reg.statusCode, reg.body).toBeLessThan(300);
    await beenden(app);
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

  it("N1 · Entwurf und Eigentümer nach Neustart erreichbar, Stände getrennt", async () => {
    const erste = await neu();
    const anna = await anmelden(erste);
    annaId = (await erste.inject({ method: "GET", url: "/api/auth/me", headers: anna })).json().id;
    const res = await uebernehmen(erste, anna, 5);
    expect(res.statusCode, res.body).toBe(201);
    expect(res.json().stand).toEqual({
      entwurf: "gespeichert",
      uebernahmeInsWissen: "nicht_erfolgt",
      fachlicheFreigabe: "nicht_erteilt",
    });
    entwurfId = res.json().entwurf.id;
    expect(res.json().entwurf.eigentuemer).toBe(annaId);
    await beenden(erste);

    // Neustart: neuer Pool, neue Dienste — gelesen wird, was in PostgreSQL steht.
    const zweite = await neu();
    const wieder = await anmelden(zweite);
    const gelesen = await zweite.inject({
      method: "GET",
      url: `/api/drafts/${entwurfId}`,
      headers: wieder,
    });
    expect(gelesen.statusCode, gelesen.body).toBe(200);
    const d = gelesen.json();
    expect(d.originalAuthor).toBe(annaId);
    expect(d.payload.confidentiality).toBe("intern");
    expect(d.payload.bodyHtml).toContain("16 bar ±0,5 bar");
    expect(d.payload.bodyHtml).toContain("Nicht fachlich freigegeben");
    expect(
      (d.payload.pendingSources as { excerpt: string }[]).map((q) => q.excerpt.slice(0, 79)),
    ).toEqual([
      `Fassung sha256:${belegFassung(HTML_SEITE)}`,
      `Fassung sha256:${belegFassung(DATENBLATT)}`,
    ]);
    await beenden(zweite);
  }, 120_000);

  it("N2 · Wiederholung nach Neustart ohne Dublette; Quellenabgleich findet die Übernahme", async () => {
    expect(entwurfId, "N1 muss vorher gelaufen sein").not.toBe("");
    const app = await neu();
    const anna = await anmelden(app);
    // Neuer Prozess, neuer Schlüssel: die Vorschau wird neu geholt; die Quelle ist dieselbe Fassung.
    const nochmal = await uebernehmen(app, anna, 10);
    expect(nochmal.statusCode, nochmal.body).toBe(200);
    expect(nochmal.json().entwurf.id).toBe(entwurfId);

    const liste = await app.inject({ method: "GET", url: "/api/drafts", headers: anna });
    const eigene = (liste.json() as { payload: { title?: string } }[]).filter((x) =>
      x.payload.title?.startsWith("Technische Daten"),
    );
    expect(eigene).toHaveLength(1);

    const jetzt = geaendert(HTML_SEITE, 0, 2, "20 bar");
    const abgleich = await app.inject({
      method: "POST",
      url: "/api/technische-daten/quellenabgleich",
      headers: anna,
      payload: { beleg: jetzt },
    });
    expect(abgleich.statusCode, abgleich.body).toBe(200);
    expect(abgleich.json().betroffen).toEqual([
      expect.objectContaining({
        art: "entwurf",
        id: entwurfId,
        erfassteFassung: belegFassung(HTML_SEITE),
        aktuelleFassung: belegFassung(jetzt),
        lage: "quelle_geaendert",
      }),
    ]);
    await beenden(app);

    // Der Vermerk an der Quelle ist DAUERHAFT: nach einem weiteren Neustart steht er im Entwurf.
    const dritte = await neu();
    const wieder = await anmelden(dritte);
    const gelesen = await dritte.inject({
      method: "GET",
      url: `/api/drafts/${entwurfId}`,
      headers: wieder,
    });
    expect(gelesen.statusCode, gelesen.body).toBe(200);
    expect(gelesen.json().payload.pendingSources[0].excerpt).toContain("Lage: Quelle geändert");
    await beenden(dritte);
  }, 120_000);
});
