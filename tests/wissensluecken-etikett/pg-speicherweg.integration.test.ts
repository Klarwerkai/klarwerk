// ================================================================================================
// R-0291 / R-0773 · DER PRODUKTIVE SPEICHERWEG — PostgreSQL, Neustart, Zusammenführen, Bearbeiten.
// ================================================================================================
//
// BEN (Nacharbeit 3): die Vertragstests liefen auf den Speicher-Ablagen von `buildServices`; der
// Postgres-Weg (`PgGapRepo` mit `belegbedarf` im jsonb, `PgNulltrefferRepo` mit `ask_nulltreffer`)
// war nicht belegt. Hier läuft der volle Produktaufbau: `migrate()` (mit `ASK_SCHEMA`, zweimal —
// die Stufe ist wiederholbar), `buildPgServices`, `buildApp`. Gelesen wird nach dem Schreiben über
// NEUE Pools und neue Dienste — derselbe Weg wie nach einem Neustart.
//
//   P1 · Belegbedarf wird gespeichert, bleibt beim Zusammenführen derselben Frage (askCount 2)
//        und beim Zuweisen/Priorisieren erhalten und überlebt den Neustart.
//   P2 · Nulltreffer mit und ohne Eingrenzung werden getrennt gezählt und überleben den Neustart;
//        jede Person liest nur ihre eigenen.
//
// INFRASTRUKTUR: `KLARWERK_PG_TEST_URL` (Datenbankname mit `test`), sonst ein Wegwerf-Container.
// Fehlt beides, SCHEITERT der Lauf — kein stiller Skip. Alle Inhalte sind erfundene Testdaten.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

type App = ReturnType<typeof buildApp>;
type Services = ReturnType<typeof buildPgServices>;
type Kopf = { authorization: string };
type Sicht = { id: string; belegbedarf?: string[]; askCount?: number; redacted?: boolean };
type Nulltreffer = { begriff: string; anzahl: number; eingrenzung: Record<string, string> };

const KENNWORT = "geheim12345";
const TITEL = "Turbinenwartung Kesselhaus";
const FRAGE_TORE =
  "Welche Schutzausruestung ist bei der Turbinenwartung im Druckbehaelter vorgeschrieben?";
const FRAGE_LEER = "Wie oft wird der Abscheider an Linie Zeta gespuelt?";

describe("Belegbedarf und Nulltreffer gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let verwaltung: Pool | undefined;
  let datenbank = "";
  let url = "";
  const offen: { pool: Pool; app: App }[] = [];

  async function neu(): Promise<{ app: App; services: Services }> {
    const pool = createPool(url);
    const services = buildPgServices(pool);
    const app = buildApp(services);
    await app.ready();
    offen.push({ pool, app });
    return { app, services };
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

  /** Ein GET mit Sitzung — 200 ist Pflicht, sonst misst der Fall nichts. */
  async function lesen(app: App, pfad: string, wer: Kopf): Promise<unknown> {
    const res = await app.inject({ method: "GET", url: pfad, headers: wer });
    expect(res.statusCode, `${pfad}: ${res.body}`).toBe(200);
    return res.json();
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
    datenbank = `klarwerk_luecken_test_${`${Date.now()}`.slice(-9)}`;
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
    // Konten: Anna (erstes Konto = Admin) und Bert (Experte).
    const { app } = await neu();
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Anna", email: "anna@luecken-pg.test", password: KENNWORT },
    });
    const anna = await anmelden(app, "anna@luecken-pg.test");
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: anna,
      payload: { name: "Bert", email: "bert@luecken-pg.test", password: KENNWORT, role: "experte" },
    });
    expect(res.statusCode, res.body).toBe(201);
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

  it("P1 · Belegbedarf: gespeichert, beim Zusammenführen und Bearbeiten erhalten, nach Neustart gelesen", async () => {
    const erste = await neu();
    const konten = await erste.services.auth.listUsers();
    const annaId = konten.find((k) => k.email === "anna@luecken-pg.test")?.id ?? "";
    expect(annaId, "KALIBRIERUNG: das Konto existiert").not.toBe("");
    await erste.services.ko.create({
      title: TITEL,
      statement: "Zustaendigkeit liegt beim Schichtleiter.",
      type: "best_practice",
      category: "Wartung",
      author: annaId,
    } as never);

    const leer = await erste.services.ask.ask(FRAGE_LEER, annaId, "de");
    expect(leer.result.answered).toBe(false);
    expect(leer.gap?.belegbedarf).toEqual(["wissensobjekt"]);
    const tore = await erste.services.ask.ask(FRAGE_TORE, annaId, "de");
    expect(tore.result.answered).toBe(false);
    expect(tore.gap?.belegbedarf).toEqual(["freigabe", "stufe", "volltext"]);
    // Zusammenführen: dieselbe Frage in anderer Schreibung zählt hoch (ON CONFLICT … jsonb_set).
    const nochmal = await erste.services.ask.ask(`${FRAGE_TORE.toUpperCase()}!!`, annaId, "de");
    expect(nochmal.gap?.id, "KALIBRIERUNG: zusammengeführt").toBe(tore.gap?.id);
    // Bearbeiten: zuweisen und priorisieren schreiben die Zeile neu (UPDATE gaps SET data).
    const id = tore.gap?.id ?? "";
    await erste.services.ask.assignGap(id, annaId);
    await erste.services.ask.setGapPriority(id, "hoch", annaId);
    await beenden(erste.app);

    // Neustart: neuer Pool, neue Dienste — gelesen wird, was in PostgreSQL steht.
    const zweite = await neu();
    const offene = (await zweite.services.ask.listGaps()).filter((g) => g.status === "offen");
    const zusammengefuehrt = offene.find((g) => g.id === id);
    expect(zusammengefuehrt?.askCount).toBe(2);
    expect(zusammengefuehrt?.assignee).toBe(annaId);
    expect(zusammengefuehrt?.priority).toBe("hoch");
    expect(zusammengefuehrt?.belegbedarf).toEqual(["freigabe", "stufe", "volltext"]);
    expect(offene.find((g) => g.id === leer.gap?.id)?.belegbedarf).toEqual(["wissensobjekt"]);
    // Und über die Route: die berechtigte Sicht trägt den Befund, die fremde nicht.
    const anna = await anmelden(zweite.app, "anna@luecken-pg.test");
    const bert = await anmelden(zweite.app, "bert@luecken-pg.test");
    const eigene = (await lesen(zweite.app, "/api/gaps", anna)) as Sicht[];
    const eigeneSicht = eigene.find((g) => g.id === id);
    expect(eigeneSicht?.belegbedarf).toEqual(["freigabe", "stufe", "volltext"]);
    expect(eigeneSicht?.askCount).toBe(2);
    const fuerBert = (await lesen(zweite.app, "/api/gaps", bert)) as Sicht[];
    const fremd = fuerBert.find((g) => g.id === id);
    expect(fremd, "KALIBRIERUNG: Bert sieht die Lücke (redigiert)").toBeDefined();
    expect(fremd?.redacted).toBe(true);
    expect("belegbedarf" in (fremd ?? {})).toBe(false);
    await beenden(zweite.app);
  }, 120_000);

  it("P2 · Nulltreffer mit und ohne Eingrenzung: getrennt gezählt, nach Neustart gelesen, nur die eigenen", async () => {
    const erste = await neu();
    const anna = await anmelden(erste.app, "anna@luecken-pg.test");
    const suchen = [
      "q=Abscheiderspuelung",
      `q=${encodeURIComponent("ABSCHEIDERSPUELUNG!")}`,
      "q=Abscheiderspuelung&tag=Linie-Zeta",
    ];
    for (const query of suchen) {
      const treffer = await lesen(erste.app, `/api/library/search?${query}`, anna);
      expect(treffer, `KALIBRIERUNG: kein Treffer für ${query}`).toEqual([]);
    }
    await beenden(erste.app);

    const zweite = await neu();
    const annaNeu = await anmelden(zweite.app, "anna@luecken-pg.test");
    const bert = await anmelden(zweite.app, "bert@luecken-pg.test");
    const liste = (await lesen(zweite.app, "/api/library/nulltreffer", annaNeu)) as Nulltreffer[];
    expect(liste).toHaveLength(2);
    const ohne = liste.find((e) => Object.keys(e.eingrenzung).length === 0);
    const mit = liste.find((e) => Object.keys(e.eingrenzung).length > 0);
    expect(ohne?.anzahl, "zwei Schreibweisen, ein Eintrag").toBe(2);
    expect(mit?.anzahl).toBe(1);
    expect(mit?.eingrenzung).toEqual({ tag: "Linie-Zeta" });
    expect(await lesen(zweite.app, "/api/library/nulltreffer", bert)).toEqual([]);
    await beenden(zweite.app);
  }, 120_000);
});
