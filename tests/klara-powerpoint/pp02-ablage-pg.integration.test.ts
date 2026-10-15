import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import type { Datenpunkt } from "../../services/app/src/praesentation-daten";
import { PgDatenpunktAblage } from "../../services/app/src/praesentation-daten-ablage";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

// produkt:20261015:klara-powerpoint-datenherkunft (PP-02) · die Ablage der Datenpunkte gegen echtes
// PostgreSQL (K3: die Daten-/Evidenzgrundlage wird gehalten, nicht nur im Arbeitsspeicher).
// Gemessen wird, was die Speicherfassung nicht zeigen kann: Herkunft, Prüfungen, Bindungen und
// Korrekturen überleben einen NEUSTART (neuer Pool, neue Ablage), das bedingte Schreiben verwirft
// einen veralteten Stand, und die Suche nach Bindungen an einen Anhang trifft über das gespeicherte
// JSON. Die produktive Migration legt die Tabelle an (zweimal ohne Fehler). Datenbank wie
// `office-ablage.integration.test.ts`: zuerst die abgesicherte Prüfinstanz, sonst ein
// Wegwerf-Container; sonst scheitert der Aufbau — kein Überspringen. Alle Zeilen tragen ein eigenes
// Präfix und werden danach entfernt.
describe("PP-02 · Datenpunkte unter echtem Postgres", () => {
  let container: StartedTestContainer | undefined;
  let url: string;
  let pool: Pool;
  const praefix = `itest-${randomUUID()}`;
  const ko = `${praefix}-ko`;

  const datenpunkt = (id: string, anhangId: string): Datenpunkt => ({
    id,
    heimatKoId: ko,
    fassung: 1,
    stand: 1,
    art: "zahl",
    wert: "1.500 T€",
    zahl: 1500,
    einheit: "T€",
    zeitraum: "Q4 2025",
    erfassung: "direkt",
    quelle: {
      koId: ko,
      koFassung: 2,
      anhangId,
      objectId: `${praefix}-obj`,
      dateiFassung: "a".repeat(64),
    },
    fundstelle: {
      art: "tabellenzelle",
      sldId: "256",
      shapeId: "4",
      folienPosition: 1,
      folienTitel: "Ergebnis Q4 2025",
      elementName: "Tabelle Kennzahlen",
      zeile: 2,
      spalte: 3,
      zeilenkopf: "Umsatz",
      spaltenkopf: "Q4",
      zitat: "1.500 T€",
    },
    erfasstVon: "anna",
    erfasstAm: "2026-10-15T12:00:00.000Z",
    pruefungen: [
      {
        id: `${id}-p1`,
        dimension: "erkennung",
        ergebnis: "bestanden",
        grund: "Wert steht an der Fundstelle.",
        von: "klarwerk:pptx-leser",
        am: "2026-10-15T12:00:00.000Z",
        datenFassung: 1,
        fingerabdruck: "f".repeat(64),
      },
    ],
    bindungen: [
      {
        id: `${id}-b1`,
        koId: ko,
        anhangId,
        objectId: `${praefix}-obj`,
        dateiFassung: "a".repeat(64),
        artikelFassung: 2,
        sldId: "256",
        shapeId: "4",
        zeile: 2,
        spalte: 3,
        folienPosition: 1,
        folienTitel: "Ergebnis Q4 2025",
        elementName: "Tabelle Kennzahlen",
        datenFassung: 1,
        von: "anna",
        am: "2026-10-15T12:00:00.000Z",
      },
    ],
    korrekturen: [],
  });

  beforeAll(async () => {
    const lokal = guardedLocalPgTestUrl();
    if (lokal) {
      url = lokal;
    } else if (process.env.KLARWERK_PG_TEST_URL) {
      throw new Error(
        "Postgres-Aufbau: KLARWERK_PG_TEST_URL von der Testsicherung abgelehnt; keine Ablagemessung",
      );
    } else {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
      } catch (cause) {
        throw new Error("Postgres-Aufbau: Containerstart fehlgeschlagen; keine Ablagemessung", {
          cause,
        });
      }
      url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
    }
    pool = createPool(url);
    await migrate(pool);
    await migrate(pool);
  });

  afterAll(async () => {
    try {
      await pool?.query("DELETE FROM praesentation_datenpunkte WHERE heimat_ko = $1", [ko]);
      await pool?.end();
    } finally {
      await container?.stop();
    }
  });

  it("P1: Herkunft, Prüfung und Bindung überleben einen Neustart; Bindungssuche über das JSON", async () => {
    const vorher = new PgDatenpunktAblage(pool);
    const dp = datenpunkt(`${praefix}-dp1`, `${praefix}-anh`);
    expect(await vorher.anlegen(dp)).toBe(true);
    expect(await vorher.anlegen(dp)).toBe(false);
    expect(await vorher.anlegen(datenpunkt(`${praefix}-dp2`, `${praefix}-anderer`))).toBe(true);

    const neuerPool = createPool(url);
    try {
      const nachher = new PgDatenpunktAblage(neuerPool);
      expect(await nachher.lesen(dp.id)).toEqual(dp);
      expect((await nachher.vonArtikel(ko)).map((d) => d.id)).toEqual([
        `${praefix}-dp1`,
        `${praefix}-dp2`,
      ]);
      expect((await nachher.gebundenAn(ko, `${praefix}-anh`)).map((d) => d.id)).toEqual([dp.id]);
      expect(await nachher.gebundenAn(ko, `${praefix}-fehlt`)).toEqual([]);
    } finally {
      await neuerPool.end();
    }
  });

  it("P2: bedingtes Schreiben — ein veralteter Stand überschreibt nichts", async () => {
    const ablage = new PgDatenpunktAblage(pool);
    const dp = datenpunkt(`${praefix}-dp3`, `${praefix}-anh`);
    await ablage.anlegen(dp);
    const korrigiert: Datenpunkt = {
      ...dp,
      fassung: 2,
      stand: 2,
      zeitraum: "Q4 2025 (Oktober bis Dezember)",
      korrekturen: [
        {
          fassung: 2,
          felder: ["zeitraum"],
          vorher: { zeitraum: "Q4 2025" },
          grund: "präzisiert",
          von: "anna",
          am: "2026-10-15T12:05:00.000Z",
        },
      ],
    };
    expect(await ablage.ersetzen(korrigiert, 1)).toBe(true);
    expect(await ablage.ersetzen({ ...korrigiert, stand: 3, wert: "9 T€" }, 1)).toBe(false);
    expect(await ablage.lesen(dp.id)).toEqual(korrigiert);
  });
});
