import { existsSync } from "node:fs";
// ================================================================================================
// JOB 4271 · VORPROBE — WAS DIESE MASCHINE WIRKLICH HAT, BEVOR 10.000 EINTRÄGE ENTSTEHEN.
// ================================================================================================
//
// Diese Datei misst NICHTS AM PRODUKT. Sie beantwortet die drei Fragen, ohne deren Antwort der
// Großbestand-Nutzerweg nur geraten wäre:
//
//   1 Steht auf diesem Platz eine ECHTE PostgreSQL, und welche?
//   2 Wie lange braucht ein Wissensobjekt über den PRODUKTWEG (`KoService.create` +
//     `setValidationState`) — daraus folgt, ob 10.000 Einträge über den Produktweg überhaupt in
//     eine Laufzeit passen oder ob direkt in die Datenbank geschrieben werden muss.
//   3 Startet hier ein Chromium, und liegt `apps/web/dist`?
//
// Sie ist ausdrücklich KEINE Zusage über das Produkt und wird als solche auch nirgends zitiert.
// Ohne PostgreSQL meldet sie den Grund SICHTBAR auf stderr und überspringt — nie ein stiller Skip
// (Muster: `tests/gast-nutzerweg/gastweg-pg-im-browser.integration.test.ts:41-43`).
// KEINE PRODUKTIVDATEN: ausschliesslich eine Wegwerf-Datenbank mit `test` im Namen, am Ende entfernt.
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

const JOB = "[KLARWERK] JOB 4271 VORPROBE";
const PG_SCHEMA = "postgresql:";
const DIST = resolve(process.cwd(), "apps/web/dist");

interface Verbindung {
  host: string;
  port: string;
  user: string;
  passwort: string;
}

function zerlege(url: string): Verbindung | undefined {
  try {
    const u = new URL(url.replace(/^postgres(ql)?:/, "http:"));
    if (!u.hostname) {
      return undefined;
    }
    return {
      host: u.hostname,
      port: u.port || "5432",
      user: decodeURIComponent(u.username) || "postgres",
      passwort: decodeURIComponent(u.password),
    };
  } catch {
    return undefined;
  }
}

function pgUrl(v: Verbindung, datenbank: string): string {
  if (!datenbank.toLowerCase().includes("test")) {
    throw new Error(`${JOB}: „${datenbank}" trägt kein „test" im Namen.`);
  }
  const anmeldung = `${encodeURIComponent(v.user)}:${encodeURIComponent(v.passwort)}`;
  return `${PG_SCHEMA}//${anmeldung}@${v.host}:${v.port}/${datenbank}`;
}

describe("JOB 4271 · Vorprobe der Cloudmaschine", () => {
  let adminPool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let verfuegbar = false;
  const probeDb = `klarwerk_gross_vorprobe_test_${`${Date.now()}`.slice(-9)}`;

  beforeAll(async () => {
    const url = guardedLocalPgTestUrl();
    if (!url) {
      process.stderr.write(
        `${JOB} UEBERSPRUNGEN: keine gesicherte KLARWERK_PG_TEST_URL — ohne echte PostgreSQL ist der Großbestand nicht messbar.\n`,
      );
      return;
    }
    verbindung = zerlege(url);
    if (!verbindung) {
      process.stderr.write(
        `${JOB} UEBERSPRUNGEN: KLARWERK_PG_TEST_URL nennt keinen Rechnernamen.\n`,
      );
      return;
    }
    adminPool = new Pool({ connectionString: url });
    await adminPool.query("SELECT 1");
    await adminPool.query(`CREATE DATABASE ${probeDb}`);
    verfuegbar = true;
  }, 300_000);

  afterAll(async () => {
    if (adminPool) {
      await adminPool
        .query(`DROP DATABASE IF EXISTS ${probeDb} WITH (FORCE)`)
        .catch(() => undefined);
      await adminPool.end();
    }
  }, 120_000);

  it("V1 — Datenbank, Schreibrate über den Produktweg, Chromium, gebaute Fläche", async (ctx) => {
    if (!verfuegbar || !verbindung) {
      ctx.skip();
      return;
    }
    const pool = createPool(pgUrl(verbindung, probeDb));
    try {
      const version = await pool.query<{ v: string }>("SELECT version() AS v");
      process.stderr.write(`${JOB} PG: ${version.rows[0]?.v ?? "(unbekannt)"}\n`);

      const t0 = Date.now();
      await migrate(pool);
      process.stderr.write(`${JOB} migrate: ${Date.now() - t0} ms\n`);

      const services = buildPgServices(pool);
      const t1 = Date.now();
      const { readiness } = await services.ko.activateSearchProjectionV2();
      process.stderr.write(
        `${JOB} Projektion aktiviert: ${Date.now() - t1} ms · alle=${readiness.alle} · ${readiness.befunde.join("; ")}\n`,
      );

      const PROBE = 200;
      const t2 = Date.now();
      const ids: string[] = [];
      for (let i = 0; i < PROBE; i += 1) {
        const nr = String(i).padStart(5, "0");
        const ko = await services.ko.create({
          title: `Vorprobe ${nr}`,
          statement: `Kurzfassung ${nr}.`,
          type: "best_practice",
          category: "Handbuch",
          author: "vorprobe",
          bodyHtml: `<p>Im Protokoll steht der Vorprobebegriff (${nr}).</p>`,
        });
        ids.push(ko.id);
      }
      const anlegen = Date.now() - t2;

      const t3 = Date.now();
      for (const id of ids) {
        await services.ko.setValidationState(id, { trust: 90, status: "validiert" });
      }
      const validieren = Date.now() - t3;

      process.stderr.write(
        `${JOB} ${PROBE} Anlagen: ${anlegen} ms (${(anlegen / PROBE).toFixed(1)} ms je Eintrag) · ${PROBE} Validierungen: ${validieren} ms (${(validieren / PROBE).toFixed(1)} ms je Eintrag)\n`,
      );
      process.stderr.write(
        `${JOB} HOCHRECHNUNG 10.000 über den Produktweg: ${((((anlegen + validieren) / PROBE) * 10_000) / 1000).toFixed(0)} s\n`,
      );

      const zeilen = await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM kos");
      const projektionen = await pool.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM ko_search_projections",
      );
      process.stderr.write(
        `${JOB} kos=${zeilen.rows[0]?.n} · ko_search_projections=${projektionen.rows[0]?.n}\n`,
      );

      const treffer = await services.ko.findSearchHits({ terms: ["vorprobebegriff"], limit: 200 });
      process.stderr.write(
        `${JOB} findSearchHits("vorprobebegriff") → ${treffer.length} Treffer\n`,
      );

      // ── Chromium und gebaute Fläche ─────────────────────────────────────────────────────────
      process.stderr.write(
        `${JOB} dist/index.html vorhanden: ${existsSync(join(DIST, "index.html"))}\n`,
      );
      let browserBefund = "nicht versucht";
      try {
        const require = createRequire(import.meta.url);
        const { chromium } = require("playwright") as {
          chromium: {
            launch(
              o: Record<string, unknown>,
            ): Promise<{ close(): Promise<void>; version?: () => string }>;
          };
        };
        const t4 = Date.now();
        const browser = await chromium.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-gpu"],
        });
        browserBefund = `gestartet in ${Date.now() - t4} ms`;
        await browser.close();
      } catch (fehler) {
        browserBefund = `FEHLER: ${String(fehler).slice(0, 400)}`;
      }
      process.stderr.write(`${JOB} Chromium: ${browserBefund}\n`);

      expect(Number(zeilen.rows[0]?.n ?? "0")).toBe(PROBE);
    } finally {
      await pool.end();
    }
  }, 900_000);
});
