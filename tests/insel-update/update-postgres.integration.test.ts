// ================================================================================================
// JOB 4012 · DIE POSTGRES-VARIANTE — die Sicherung ist hier ein echter `pg_dump`, kein Dateikopieren.
// ================================================================================================
//
// WARUM SIE GETRENNT STEHT: `update-mit-netz.test.ts` misst den Journalbetrieb der Insel; dort ist
// die Sicherung eine Kopie mit Pruefsumme. Im Serverbetrieb ist sie ein Aufruf von
// `scripts/backup/backup.sh` — und der braucht eine erreichbare Datenbank UND `pg_dump` auf dem
// Pfad. Beides ist im hermetischen Tor nicht zugesagt, deshalb liegt diese Datei im
// Integrationslauf (`npm run test:integration`) und nicht im Gate.
//
// DAS GERUEST IST DAS EINGEFUEHRTE (wie `tests/entwurfs-papierkorb/papierkorb-pg.integration.test.ts`):
// lokale Test-URL mit Vorrang, sonst Testcontainers, sonst ein SICHTBARER Skip auf stderr. Ein
// stiller Skip saehe aus wie ein bestandener Lauf — genau die Sorte Gruen, die dieser Auftrag
// abschafft.
//
// KEINE PRODUKTIVDATEN: die Datenbank ist entweder ein Wegwerf-Container oder eine ausdrueckliche
// Test-URL, deren Name `test` enthalten muss (`guardedLocalPgTestUrl`). Es wird nur GELESEN
// (`pg_dump`); dieser Weg schreibt in der Datenbank nichts.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  type Insel,
  UPDATE_SH,
  WURZEL,
  aktivesRelease,
  gesundheit,
  legeInselAn,
  raeumeAb,
  schreibeRelease,
  setzeCurrent,
  umgebung,
} from "./insel-probe";

const ALT = "klarwerk-insel-alt";
const NEU = "klarwerk-insel-neu";

describe("JOB 4012 · Update im Postgres-Betrieb", () => {
  let container: StartedTestContainer | undefined;
  let url: string | undefined;
  let verfuegbar = false;
  let insel: Insel | undefined;

  beforeAll(async () => {
    if (spawnSync("pg_dump", ["--version"], { encoding: "utf8" }).status !== 0) {
      process.stderr.write(
        "[KLARWERK] JOB 4012 ÜBERSPRUNGEN: pg_dump nicht gefunden — ohne postgresql-client gibt es keine Sicherung zu messen.\n",
      );
      return;
    }
    const lokal = guardedLocalPgTestUrl();
    if (lokal) {
      url = lokal;
    } else if (process.env.KLARWERK_PG_TEST_URL) {
      return;
    } else {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
        url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
      } catch {
        process.stderr.write(
          "[KLARWERK] JOB 4012 ÜBERSPRUNGEN: weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar.\n",
        );
        return;
      }
    }
    if (url !== undefined) {
      const pool = new Pool({ connectionString: url });
      try {
        await pool.query("SELECT 1");
        verfuegbar = true;
      } catch {
        process.stderr.write("[KLARWERK] JOB 4012 ÜBERSPRUNGEN: keine Verbindung zur Datenbank.\n");
      } finally {
        await pool.end();
      }
    }
  }, 180_000);

  afterAll(async () => {
    if (insel !== undefined) {
      raeumeAb(insel);
      insel = undefined;
    }
    await container?.stop();
  });

  it("P1 · backup.sh schreibt einen Dump mit Pruefsumme, dann erst wird umgeschaltet", async (ctx) => {
    if (!verfuegbar || url === undefined) {
      ctx.skip();
      return;
    }
    insel = await legeInselAn();
    schreibeRelease(insel.releases, { name: ALT, appVersion: "1.0.0" });
    setzeCurrent(insel, ALT);
    const eingang = join(insel.wurzel, "eingang");
    mkdirSync(eingang, { recursive: true });
    schreibeRelease(eingang, { name: NEU, appVersion: "1.1.0" });

    const lauf = spawnSync("bash", [UPDATE_SH, join(eingang, NEU)], {
      cwd: WURZEL,
      env: { ...umgebung(insel), DATABASE_URL: url },
      encoding: "utf8",
      timeout: 120_000,
    });
    const ausgabe = `${lauf.stdout ?? ""}${lauf.stderr ?? ""}`;
    const ergebnis =
      (lauf.stdout ?? "")
        .split("\n")
        .filter((z) => z.trim() !== "")
        .at(-1) ?? "";

    expect(lauf.status, ausgabe).toBe(0);
    const dump = /^Update auf 1\.1\.0 aktiv, Sicherung (.+)$/.exec(ergebnis)?.[1] ?? "";
    expect(dump, `Ergebniszeile war: ${ergebnis}`).toMatch(/klarwerk-.*\.dump$/);
    expect(existsSync(dump)).toBe(true);
    expect(existsSync(`${dump}.sha256`)).toBe(true);
    expect(aktivesRelease(insel)).toBe(NEU);
    expect((await gesundheit(insel))?.version).toBe("1.1.0");
  }, 180_000);

  it("P2 · ohne erreichbare Datenbank scheitert die Sicherung und es wird nicht umgeschaltet", async (ctx) => {
    if (!verfuegbar) {
      ctx.skip();
      return;
    }
    insel = await legeInselAn();
    schreibeRelease(insel.releases, { name: ALT, appVersion: "1.0.0" });
    setzeCurrent(insel, ALT);
    const eingang = join(insel.wurzel, "eingang");
    mkdirSync(eingang, { recursive: true });
    schreibeRelease(eingang, { name: NEU, appVersion: "1.1.0" });

    const lauf = spawnSync("bash", [UPDATE_SH, join(eingang, NEU)], {
      cwd: WURZEL,
      env: {
        ...umgebung(insel),
        DATABASE_URL: "postgresql://niemand:falsch@127.0.0.1:1/klarwerk_test",
      },
      encoding: "utf8",
      timeout: 120_000,
    });
    const ergebnis =
      (lauf.stdout ?? "")
        .split("\n")
        .filter((z) => z.trim() !== "")
        .at(-1) ?? "";

    expect(lauf.status).toBe(2);
    expect(ergebnis).toBe("Update abgebrochen, Vorversion 1.0.0 läuft weiter, Grund: sicherung");
    expect(aktivesRelease(insel)).toBe(ALT);
    expect(existsSync(join(insel.releases, NEU))).toBe(false);
  }, 180_000);
});
