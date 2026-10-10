// ================================================================================================
// INSTANZTRENNUNG · ZWEI ANLAGEN, EINE DATENBANK — GEGEN ECHTES POSTGRESQL UND DEN ECHTEN START.
// ================================================================================================
//
// R-0597: „Auf einer Klarwerk-Instanz … läuft niemals mehr als eine Firma. Jede Firma bekommt einen
// eigenen produktiven Datenraum." R-0790: „die Datengrenze ist die Grenze der Anlage." R-0860:
// „Zwei Anlagen desselben Anbieters teilen sich keine Zustände; die Trennung ist erzwungen, nicht
// nur vereinbart."
//
// GEMESSEN WIRD, WAS EIN BETREIBER FALSCH MACHEN KANN: eine zweite Anlage (anderer Hostname in
// `APP_BASE_URL`, also eine andere Firma) mit derselben `DATABASE_URL` starten. Erwartet ist, dass
// `services/app/src/server.ts` — der echte Prozess, nicht `buildApp` — VOR dem ersten Socket
// abbricht und die erste Anlage unberührt weiterstarten kann.
//
// P1 und P2 messen `bindeInstanz` an echter PostgreSQL (nach `migrate()`), P3 und P4 den Prozess.
//
// INFRASTRUKTUR: `KLARWERK_PG_TEST_URL` (Datenbankname mit `test`, s. `guardedLocalPgTestUrl`),
// sonst ein Wegwerf-Container. Fehlt beides, SCHEITERT der Lauf — kein stiller Skip. Die Fälle
// arbeiten in EIGENEN Wegwerfdatenbanken: eine Bindungszeile in der gemeinsamen Testdatenbank
// liesse jeden anderen Prozesstest mit anderer `APP_BASE_URL` scheitern.
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { createServer } from "node:net";
import { join } from "node:path";
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import {
  type Instanzbefund,
  InstanzbindungError,
  bindeInstanz,
  bindeInstanzVorMigration,
} from "../../services/app/src/instanzbindung";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

const WURZEL = join(__dirname, "..", "..");
const ANLAGE_A = "https://wissen.firma-a.test";
const ANLAGE_B = "https://wissen.firma-b.test";
const DB_FUNKTION = "klarwerk_test_instanztrennung_p1";
const DB_GLEICHZEITIG = "klarwerk_test_instanztrennung_p2";
const DB_PROZESS = "klarwerk_test_instanztrennung_p3";
const DB_STAND = "klarwerk_test_instanztrennung_p5";
const DB_ADRESSE = "klarwerk_test_instanztrennung_p6";

/** Dieselbe Verbindungszeichenkette mit anderem Datenbanknamen. */
function mitDatenbank(url: string, name: string): string {
  const treffer = /^([^:]+:\/\/[^/?#]*\/)([^/?#]*)(.*)$/.exec(url);
  if (!treffer) {
    throw new Error("Die Verbindungszeichenkette trägt keinen lesbaren Datenbanknamen.");
  }
  return `${treffer[1]}${name}${treffer[3]}`;
}

function freierPort(): Promise<number> {
  return new Promise((fertig, fehler) => {
    const s = createServer();
    s.once("error", fehler);
    s.listen(0, "127.0.0.1", () => {
      const adresse = s.address();
      const port = typeof adresse === "object" && adresse ? adresse.port : 0;
      s.close(() => fertig(port));
    });
  });
}

interface Startausgang {
  /** `bereit`: /health antwortete. `beendet`: der Prozess endete, bevor er antwortete. */
  art: "bereit" | "beendet";
  code: number | null;
  ausgabe: string;
}

/**
 * Startet `server.ts` als echten Prozess mit vollständig neu gebauter Umgebung (kein
 * `...process.env`) und wartet, bis er antwortet oder endet. Ein bereiter Prozess wird danach
 * beendet — gemessen ist allein, OB er hochkam.
 */
async function starteAnlage(datenbankUrl: string, appBaseUrl: string): Promise<Startausgang> {
  const port = await freierPort();
  const prozess: ChildProcessWithoutNullStreams = spawn(
    "node",
    ["--import", "tsx", "services/app/src/server.ts"],
    {
      cwd: WURZEL,
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? "",
        TMPDIR: process.env.TMPDIR ?? "/tmp",
        KLARWERK_SKIP_KEYCHAIN: "1",
        KLARWERK_LOG_LEVEL: "warn",
        NODE_ENV: "production",
        EXTERNAL_SEARCH: "off",
        DATABASE_URL: datenbankUrl,
        APP_BASE_URL: appBaseUrl,
        PORT: String(port),
      },
    },
  );
  const protokoll: string[] = [];
  prozess.stdout.on("data", (d) => protokoll.push(String(d)));
  prozess.stderr.on("data", (d) => protokoll.push(String(d)));
  const beendet = new Promise<void>((fertig) => prozess.once("exit", () => fertig()));
  const laeuft = (): boolean => prozess.exitCode === null && prozess.signalCode === null;

  const ablauf = Date.now() + 90_000;
  try {
    while (Date.now() < ablauf) {
      if (!laeuft()) {
        await beendet;
        return { art: "beendet", code: prozess.exitCode, ausgabe: protokoll.join("") };
      }
      try {
        const antwort = await fetch(`http://127.0.0.1:${port}/health`);
        if (antwort.ok) {
          return { art: "bereit", code: null, ausgabe: protokoll.join("") };
        }
      } catch {
        // noch nicht am Socket — weiter warten.
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(
      `Der Prozess kam binnen 90 s weder hoch noch endete er.\n${protokoll.join("")}`,
    );
  } finally {
    if (laeuft()) {
      prozess.kill("SIGTERM");
      const frist = setTimeout(() => prozess.kill("SIGKILL"), 20_000);
      await beendet;
      clearTimeout(frist);
    }
  }
}

describe("Instanztrennung · zwei Anlagen an einer Datenbank", () => {
  let container: StartedTestContainer | undefined;
  let verwaltung: Pool | undefined;
  let basisUrl = "";
  const pools: Pool[] = [];

  function neuerPool(url: string): Pool {
    const pool = createPool(url);
    pools.push(pool);
    return pool;
  }

  /** Legt die Wegwerfdatenbank frisch an und migriert sie, wie der Start es täte. */
  async function frischeDatenbank(name: string): Promise<string> {
    const v = verwaltung as Pool;
    await v.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await v.query(`CREATE DATABASE ${name}`);
    const url = mitDatenbank(basisUrl, name);
    // Zweimal: die Stufe ist wiederholbar.
    await migrate(neuerPool(url));
    await migrate(neuerPool(url));
    return url;
  }

  /**
   * Eine Datenbank, an der Anlage A NUR die Bindungsstufe gefahren und sich gebunden hat — der
   * abweichende Softwarestand in seiner schärfsten Form. Keine andere Schemastufe.
   */
  async function nurGebundeneDatenbank(name: string, anlage: string): Promise<string> {
    const v = verwaltung as Pool;
    await v.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await v.query(`CREATE DATABASE ${name}`);
    const url = mitDatenbank(basisUrl, name);
    await expect(bindeInstanzVorMigration(neuerPool(url), anlage)).resolves.toMatchObject({
      art: "gebunden",
    });
    return url;
  }

  /** Tabellen, Spalten und Extensions im Schema `public` — der messbare Migrationsstand. */
  async function schemaStand(
    url: string,
  ): Promise<{ tabellen: string[]; spalten: number; extensions: string[] }> {
    const pool = neuerPool(url);
    const tabellen = await pool.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1",
    );
    const spalten = await pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = 'public'",
    );
    const extensions = await pool.query<{ extname: string }>(
      "SELECT extname FROM pg_extension WHERE extname <> 'plpgsql' ORDER BY 1",
    );
    return {
      tabellen: tabellen.rows.map((z) => z.table_name),
      spalten: spalten.rows[0]?.n ?? -1,
      extensions: extensions.rows.map((z) => z.extname),
    };
  }

  async function bindungszeilen(url: string): Promise<string[]> {
    const res = await neuerPool(url).query<{ anlage: string }>(
      "SELECT anlage FROM instanz_bindung",
    );
    return res.rows.map((z) => z.anlage);
  }

  beforeAll(async () => {
    const lokal = guardedLocalPgTestUrl();
    if (lokal) {
      basisUrl = lokal;
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
      basisUrl = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
    }
    verwaltung = createPool(basisUrl);
    await verwaltung.query("SELECT 1");
  }, 180_000);

  afterAll(async () => {
    for (const pool of pools) {
      await pool.end().catch(() => undefined);
    }
    for (const db of [DB_FUNKTION, DB_GLEICHZEITIG, DB_PROZESS, DB_STAND, DB_ADRESSE]) {
      await verwaltung?.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => undefined);
    }
    await verwaltung?.end();
    await container?.stop();
  });

  it("P1 · die erste Anlage bindet, dieselbe startet weiter, eine fremde wird abgewiesen", async () => {
    const url = await frischeDatenbank(DB_FUNKTION);
    expect(await bindungszeilen(url)).toEqual([]);

    await expect(bindeInstanz(neuerPool(url), ANLAGE_A)).resolves.toEqual({
      art: "gebunden",
      anlage: "wissen.firma-a.test",
    });
    // Neuer Pool = neuer Start. Anderes Schema und anderer Port sind dieselbe Anlage.
    const gleicheAnlage = bindeInstanz(neuerPool(url), "http://wissen.firma-a.test:3001");
    await expect(gleicheAnlage).resolves.toEqual({ art: "passt", anlage: "wissen.firma-a.test" });
    await expect(bindeInstanz(neuerPool(url), ANLAGE_B)).rejects.toBeInstanceOf(
      InstanzbindungError,
    );
    // Die Abweisung ändert nichts: genau eine Zeile, weiterhin Anlage A.
    expect(await bindungszeilen(url)).toEqual(["wissen.firma-a.test"]);
  });

  it("P2 · gleichzeitiger Erststart zweier Anlagen: genau eine gewinnt, die andere wird abgewiesen", async () => {
    const url = await frischeDatenbank(DB_GLEICHZEITIG);
    const ergebnisse = await Promise.allSettled([
      bindeInstanz(neuerPool(url), ANLAGE_A),
      bindeInstanz(neuerPool(url), ANLAGE_B),
    ]);
    const erfolgreich = ergebnisse.filter((e) => e.status === "fulfilled");
    const abgewiesen = ergebnisse.filter((e) => e.status === "rejected");
    expect(erfolgreich).toHaveLength(1);
    expect(abgewiesen).toHaveLength(1);
    expect((abgewiesen[0] as PromiseRejectedResult).reason).toBeInstanceOf(InstanzbindungError);
    const gewinner = (erfolgreich[0] as PromiseFulfilledResult<Instanzbefund>).value;
    expect(gewinner.art).toBe("gebunden");
    expect(await bindungszeilen(url)).toEqual([gewinner.art === "gebunden" ? gewinner.anlage : ""]);
  });

  it("P3 · echter Start: Anlage B bricht an der Datenbank von Anlage A ab, Anlage A startet weiter", async () => {
    const url = await frischeDatenbank(DB_PROZESS);

    const erstA = await starteAnlage(url, ANLAGE_A);
    expect(erstA.art, erstA.ausgabe).toBe("bereit");
    expect(await bindungszeilen(url)).toEqual(["wissen.firma-a.test"]);

    const fremdB = await starteAnlage(url, ANLAGE_B);
    expect(fremdB.art, `Anlage B kam an der Datenbank von A hoch:\n${fremdB.ausgabe}`).toBe(
      "beendet",
    );
    expect(fremdB.code).toBe(1);
    expect(fremdB.ausgabe).toContain("Serverstart fehlgeschlagen: InstanzbindungError");
    // R-0623 (main): die Startfehlerzeile trägt Typ, Code und Herkunft, nie die Meldung — die
    // Hostnamen stehen deshalb nicht in der Zeile. Welche Anlage gebunden ist, sagt die Datenbank
    // (`SELECT anlage FROM instanz_bindung`, Betreiberanleitung §7); hier über `herkunft` belegt,
    // dass der Abbruch aus der Bindungsprüfung kommt.
    expect(fremdB.ausgabe).toContain("herkunft services/app/src/instanzbindung.ts:");
    // Keine Verbindungszeichenkette in der Meldung — sie trägt das Datenbankkennwort.
    expect(fremdB.ausgabe).not.toContain(url);

    // Gegenkontrolle: die Abweisung hat Anlage A nichts genommen.
    const wiederA = await starteAnlage(url, ANLAGE_A);
    expect(wiederA.art, wiederA.ausgabe).toBe("bereit");
    expect(await bindungszeilen(url)).toEqual(["wissen.firma-a.test"]);
  });

  it("P4 · bewusster Umzug: erst nach ausdrücklichem Lösen der Bindung startet die neue Adresse", async () => {
    // Baut auf P3 auf: die Datenbank ist an Anlage A gebunden.
    const url = mitDatenbank(basisUrl, DB_PROZESS);
    expect(await bindungszeilen(url)).toEqual(["wissen.firma-a.test"]);

    await neuerPool(url).query("DELETE FROM instanz_bindung");
    const neu = await starteAnlage(url, ANLAGE_B);
    expect(neu.art, neu.ausgabe).toBe("bereit");
    expect(await bindungszeilen(url)).toEqual(["wissen.firma-b.test"]);
  });

  // BEN, Nacharbeit 2, Befund 2: die fremde Anlage führte bis dahin ALLE Migrationen aus, bevor ihre
  // Bindung geprüft wurde. Nachgestellt ist der abweichende Softwarestand in seiner schärfsten Form:
  // Anlage A hat an ihrer Datenbank NUR die Bindungsstufe gefahren — jede andere Stufe, die Anlage B
  // kennt, wäre für A eine fremde Schemaänderung. Danach darf dort nichts außer der Bindung stehen.
  it("P5 · fremde Anlage mit anderem Migrationsstand verändert das Schema der gebundenen Datenbank nicht", async () => {
    const url = await nurGebundeneDatenbank(DB_STAND, ANLAGE_A);
    const vorher = await schemaStand(url);
    expect(vorher.tabellen).toEqual(["instanz_bindung"]);

    const fremdB = await starteAnlage(url, ANLAGE_B);
    expect(fremdB.art, `Anlage B kam an der Datenbank von A hoch:\n${fremdB.ausgabe}`).toBe(
      "beendet",
    );
    expect(fremdB.code).toBe(1);
    expect(fremdB.ausgabe).toContain("Serverstart fehlgeschlagen: InstanzbindungError");

    // Die Gegenprobe des Befunds: keine Tabelle, keine Extension, keine Spalte dazugekommen.
    expect(await schemaStand(url)).toEqual(vorher);
    expect(await bindungszeilen(url)).toEqual(["wissen.firma-a.test"]);
  });

  // BEN, Nacharbeit 2, Befund 1: eine gesetzte, aber unlesbare APP_BASE_URL umging die Bindung.
  it("P6 · Produktionsstart mit unlesbarer APP_BASE_URL bricht an einer fremd gebundenen Datenbank ab — ohne Migration", async () => {
    const url = await nurGebundeneDatenbank(DB_ADRESSE, ANLAGE_A);
    const vorher = await schemaStand(url);

    const fehlkonfiguriert = await starteAnlage(url, "kein-url");
    expect(
      fehlkonfiguriert.art,
      `Start mit unlesbarer Adresse kam hoch:\n${fehlkonfiguriert.ausgabe}`,
    ).toBe("beendet");
    expect(fehlkonfiguriert.code).toBe(1);
    expect(fehlkonfiguriert.ausgabe).toContain("Serverstart fehlgeschlagen: InstanzadresseError");

    expect(await schemaStand(url)).toEqual(vorher);
    expect(await bindungszeilen(url)).toEqual(["wissen.firma-a.test"]);
  });
});
