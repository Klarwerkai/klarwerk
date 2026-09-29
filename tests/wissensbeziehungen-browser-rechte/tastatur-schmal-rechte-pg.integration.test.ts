// ================================================================================================
// GRAPH-BROWSER-RECHTE · DIESELBE STRECKE GEGEN POSTGRESQL — und die 500-Probe dort, wo sie auftrat.
// ================================================================================================
//
// `strecke.ts` fährt hier unverändert, nur mit einem echten `Pool`: Setzen und Widerrufen per
// Tastatur bei 360 px, Neuladen, Gegenseite, Rechteentzug an offener Sitzung. Zusätzlich wird jede
// Station an der Tabelle `ko_kanten` nachgelesen — mit eigener Verbindung, nicht über die Anwendung.
//
// DIE 500-PROBE GEHÖRT HIERHER: der historische Befund (JOB 4328 R1, Arbeitsprüfung
// 9b5f98b21ece44fea6340ee5410a6823) trat gegen PostgreSQL bei offenem Graphen auf — „beim DRITTEN
// von 101 Grenzobjekten … 500 INTERNAL", Ursache nicht aufgeklärt, weil das Serverprotokoll nicht
// herauskam. Hier hängt der Mitschreiber an der Instanz (`strecke.ts`, `onError`/`onResponse`):
// tritt der 500 auf, wird dieser Fall ROT und nennt Adresse, Anlagennummer und — wenn geworfen —
// den Fehler. Grün heisst: in diesem Lauf nicht reproduziert. Das schliesst den Altbefund nicht
// allgemein, und so steht es auch in der Rückgabe.
//
// PRÜFGRENZE, SICHTBAR: ohne PostgreSQL (weder `KLARWERK_PG_TEST_URL` noch Container) oder ohne
// Chromium steht der Grund auf stderr, und der Zeuge sagt, dass nichts belegt ist.
//
// KEINE PRODUKTIVDATEN: die Datenbank trägt `test` im Namen (`pgUrl`) und wird am Ende entfernt.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { type Verbindung, pgUrl, zerlege } from "../beziehungs-restore-nutzerweg/vorrichtung";
import { type Browser, starteChromium } from "../gast-nutzerweg/browserweg";
import { stelleFlaecheBereit } from "../gesamtanweisung-nutzerweg/weg";
import {
  type Laufzustand,
  befundsatz,
  zaehltAlsBestanden,
} from "../wiki-gesamtanweisung-abnahme/laufzustand";
import {
  MARKE,
  PROBE_ANLAGEN,
  type Protokoll,
  baueAuf,
  fahreStrecke,
  protokollzeile,
} from "./strecke";

const DATENBANK = `klarwerk_wbr_${`${Date.now()}`.slice(-8)}_test`;

describe(`${MARKE} · PostgreSQL im echten Chromium`, () => {
  let zustand: Laufzustand | undefined;
  let container: StartedTestContainer | undefined;
  let verwaltung: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let browser: Browser | undefined;
  let pgFassung = "";
  let protokoll: Protokoll | undefined;

  beforeAll(async () => {
    let url = guardedLocalPgTestUrl() ?? "";
    let quelle = url ? "lokale Testinstanz" : "";
    let grund = "";
    if (!url && process.env.KLARWERK_PG_TEST_URL) {
      grund = "KLARWERK_PG_TEST_URL wurde von der Testdatenbank-Sicherung abgelehnt";
    } else if (!url) {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
        url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
        quelle = "Testcontainer postgres:16-alpine";
      } catch (fehler) {
        grund = `weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar (${String(fehler)})`;
      }
    }
    if (url) {
      verbindung = zerlege(url);
      if (!verbindung) {
        grund = "die Test-URL nennt keinen Rechnernamen";
      } else {
        // AB HIER WIRD NICHTS MEHR GEFANGEN: jeder Aufbaufehler färbt rot.
        verwaltung = new Pool({ connectionString: url });
        const v = await verwaltung.query<{ version: string }>("SELECT version() AS version");
        pgFassung = (v.rows[0]?.version ?? "unbekannt").split(" ").slice(0, 2).join(" ");
        await verwaltung.query(`CREATE DATABASE ${DATENBANK}`);
        process.stderr.write(`${MARKE}: gebaute Fläche — ${stelleFlaecheBereit()}\n`);
        browser = await starteChromium();
        zustand = { gelaufen: true, quelle: `${quelle}, ${pgFassung}, Datenbank ${DATENBANK}` };
      }
    }
    zustand ??= { gelaufen: false, grund };
    process.stderr.write(befundsatz(`${MARKE.replace("[KLARWERK] ", "")} PG`, zustand));
  }, 900_000);

  afterAll(async () => {
    await browser?.close().catch(() => undefined);
    await verwaltung
      ?.query(`DROP DATABASE IF EXISTS ${DATENBANK} WITH (FORCE)`)
      .catch(() => undefined);
    await verwaltung?.end().catch(() => undefined);
    await container?.stop().catch(() => undefined);
    process.stderr.write(befundsatz(`${MARKE.replace("[KLARWERK] ", "")} PG`, zustand));
    if (protokoll) {
      process.stderr.write(`${protokollzeile(protokoll)} PostgreSQL=${pgFassung}\n`);
    }
  }, 300_000);

  it("Tastatur, 360 px, Neuladen, Widerruf und Rechteentzug gegen PostgreSQL — nachgelesen an ko_kanten — und die 500-Probe bei offenem Graphen", async () => {
    if (!zaehltAlsBestanden(zustand) || !verbindung || !browser) {
      process.stderr.write(befundsatz(`${MARKE.replace("[KLARWERK] ", "")} PG`, zustand));
      return;
    }
    const pool = createPool(pgUrl(verbindung, DATENBANK));
    pool.on("error", (fehler) => {
      process.stderr.write(`${MARKE} HINWEIS: Verbindung endete — ${String(fehler)}\n`);
    });
    await migrate(pool);
    const aufbau = await baueAuf(pool);
    try {
      protokoll = await fahreStrecke({ browser, aufbau, pool, probe: true });
      expect(protokoll.pgStatus, "ko_kanten: gesetzt → widerrufen; verborgen bleibt aktiv").toEqual(
        ["aktiv", "widerrufen", "aktiv"],
      );
      expect(protokoll.kachelnAnker).toEqual([2, 2, 1]);
      expect(protokoll.controllerFlaeche).toEqual([1, 0]);
      expect(protokoll.controllerApi).toEqual([1, 0]);
      expect(
        { status: protokoll.probe?.status, serverfehler: protokoll.probe?.serverfehler },
        "500-Probe gegen PostgreSQL bei offenem Graphen",
      ).toEqual({ status: { "201": PROBE_ANLAGEN }, serverfehler: [] });
      expect(aufbau.serverfehler, "Serverfehler während der ganzen Strecke").toEqual([]);
    } finally {
      await aufbau.strecke.schliessen();
      await pool.end().catch(() => undefined);
    }
  }, 1_200_000);

  it("Zeuge: der Lauf sagt selbst, ob er gelaufen ist — ein Skip ist kein Grün", () => {
    process.stderr.write(befundsatz(`${MARKE.replace("[KLARWERK] ", "")} PG ZEUGE`, zustand));
    expect(zustand, "beforeAll hat keinen Laufzustand hinterlassen").toBeDefined();
    if (!zaehltAlsBestanden(zustand)) {
      expect(protokoll, "ohne Voraussetzungen darf kein Protokoll entstanden sein").toBeUndefined();
      return;
    }
    expect(
      protokoll,
      "die Voraussetzungen lagen vor — dann MUSS die Strecke gefahren sein",
    ).toBeDefined();
    expect(protokoll?.ablage).toBe("PostgreSQL");
  });
});
