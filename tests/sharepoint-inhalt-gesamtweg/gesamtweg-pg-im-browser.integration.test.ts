// ================================================================================================
// JOB 4295 · P — DIESELBE STRECKE, ABER GEGEN ECHTES POSTGRESQL. DIE GEMEINSAME KETTE.
// ================================================================================================
//
// Die Kette, die hier zusammenhängt und bis JOB 4232 an zwei Stellen unterbrochen war:
//
//     Graph-Vertragsdouble → Route → Adapter → Mapper → Import-Kern → PostgreSQL-Zeile →
//     HTTP über einen ECHTEN Socket → die gebaute Fläche → Chromium, frisches Profil, Tastatur →
//     Prüf-Warteschlange → `GET /api/kos/:id` → und unabhängig davon zurück in die Tabelle.
//
// DER WEG IST NICHT ABGESCHRIEBEN. Er steht genau einmal in `strecke.ts` und wird von dieser Datei
// mit `buildPgServices(pool)` gefahren und von `gesamtweg-im-echten-browser.test.ts` mit
// Speicherablagen. Verschieden ist EIN Argument. Was hier ZUSÄTZLICH gemessen wird, ist die
// Datenhaltung selbst: was nach der Annahme WIRKLICH in `kos` steht — Text, Herkunftsanker, Stand.
//
// ================================================================================================
// WARUM DIESE DATEI IHRE FLÄCHE SELBST BAUT — Bauform wörtlich wie `gastweg-pg-im-browser…:25-43`.
// ================================================================================================
//
// Beides zusammen — echte PostgreSQL UND gebaute Fläche — gibt es in keinem fertigen Lauf: Das Tor
// baut `dist` und hat keine Datenbank (`vitest.config.ts:31-32` hält es bewusst docker- und
// datenbankfrei); der Integrationslauf hat die Datenbank und kein `dist`. Also baut diese Datei die
// Fläche EINMAL selbst, wenn sie fehlt — mit demselben `vite build`, das `./tools/build` fährt.
// Liegt `dist` schon vor, wird nichts gebaut.
//
// PRÜFGRENZE, LAUT GEMELDET (Lehre 12.09., JOB 3668): Ohne echte PostgreSQL wird der Grund SICHTBAR
// auf stderr gemeldet und übersprungen. Ein stiller Skip sähe aus wie ein bestandener Lauf. Auf dem
// heutigen Prüfplatz ist `KLARWERK_PG_TEST_URL` erfahrungsgemäss NICHT gesetzt
// (`PRIORITAETEN.md`, Zeile OFFICE-PG-ABNAHME) — deshalb trägt `gesamtweg-im-echten-browser.test.ts`
// den Nachweis und diese Datei den Beleg, dass dieselbe Strecke auch gegen PG läuft, sobald die
// Datenbank da ist.
//
// KEINE PRODUKTIVDATEN: ausschliesslich eine Wegwerf-Datenbank mit `test` im Namen, am Ende entfernt.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { type Browser, DIST, starteChromium } from "../gast-nutzerweg/browserweg";
import { type Strecke, ersteinrichtung } from "../gast-nutzerweg/strecke";
import {
  DOWNLOAD,
  JOB,
  NOTIZ,
  QUELLSTAND,
  TEXT,
  type Uebersetzer,
  doppel,
  fahreDenGesamtweg,
  klartext,
  portVon,
  protokollzeile,
  raeumeNetzAb,
  schreibeProtokoll,
  spanneNetzAuf,
  starteAnwendung,
} from "./strecke";

const ADMIN = "pg-gesamtweg-admin@sharepoint-4295.test";

const katalog = i18n.getFixedT("de");
const t: Uebersetzer = (schluessel, werte) =>
  werte === undefined ? katalog(schluessel) : katalog(schluessel, werte);

/** Zusammengesetzt statt ausgeschrieben — s. `tests/neuinstallation/…` (Fall N3 dort). */
const PG_SCHEMA = "postgresql:";

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
    throw new Error(
      `${JOB}: „${datenbank}“ trägt kein „test“ im Namen — diese Suite fasst ausschliesslich Wegwerf-Datenbanken an.`,
    );
  }
  const anmeldung = `${encodeURIComponent(v.user)}:${encodeURIComponent(v.passwort)}`;
  return `${PG_SCHEMA}//${anmeldung}@${v.host}:${v.port}/${datenbank}`;
}

/** Die gebaute Fläche herstellen, wenn sie fehlt — einmal, mit dem echten Bündler. */
function stelleFlaecheBereit(): string {
  if (existsSync(join(DIST, "index.html"))) {
    return "war schon da";
  }
  const begonnen = Date.now();
  execFileSync("npx", ["vite", "build"], {
    cwd: join(resolve(process.cwd()), "apps/web"),
    stdio: "pipe",
    timeout: 600_000,
  });
  if (!existsSync(join(DIST, "index.html"))) {
    throw new Error(`${JOB}: der Bau lief durch, aber ${DIST}/index.html fehlt weiterhin.`);
  }
  return `gebaut in ${Date.now() - begonnen} ms`;
}

describe("JOB 4295 P · der SharePoint-Inhaltsweg im Browser, gegen echtes PostgreSQL", () => {
  let adminPool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let verfuegbar = false;
  let browser: Browser | undefined;
  let flaeche = "nicht hergestellt";
  let pgVersion = "unbekannt";
  const gesamtwegDb = `klarwerk_spgesamt_test_${`${Date.now()}`.slice(-9)}`;

  beforeAll(async () => {
    const url = guardedLocalPgTestUrl();
    if (!url) {
      process.stderr.write(
        `${JOB} P UEBERSPRUNGEN: keine gesicherte KLARWERK_PG_TEST_URL — die gemeinsame Kette aus Browser und echter PostgreSQL ist damit nicht messbar. Der Nachweis derselben Strecke liegt in tests/sharepoint-inhalt-gesamtweg/gesamtweg-im-echten-browser.test.ts (Speicherablagen).\n`,
      );
      return;
    }
    verbindung = zerlege(url);
    if (!verbindung) {
      process.stderr.write(
        `${JOB} P UEBERSPRUNGEN: KLARWERK_PG_TEST_URL nennt keinen Rechnernamen.\n`,
      );
      return;
    }
    adminPool = new Pool({ connectionString: url });
    const version = await adminPool.query<{ version: string }>("SELECT version() AS version");
    pgVersion = (version.rows[0]?.version ?? "unbekannt").split(" ").slice(0, 2).join(" ");
    await adminPool.query(`CREATE DATABASE ${gesamtwegDb}`);
    flaeche = stelleFlaecheBereit();
    spanneNetzAuf();
    browser = await starteChromium();
    verfuegbar = true;
  }, 900_000);

  afterAll(async () => {
    try {
      await browser?.close();
    } finally {
      raeumeNetzAb();
      if (adminPool) {
        await adminPool
          .query(`DROP DATABASE IF EXISTS ${gesamtwegDb} WITH (FORCE)`)
          .catch(() => undefined);
        await adminPool.end();
      }
    }
  }, 120_000);

  it("P1 — dieselbe Strecke, dieselben Schritte: der Text der Datei steht danach WIRKLICH in der Tabelle", async (ctx) => {
    if (!verfuegbar || !verbindung || !browser) {
      ctx.skip();
      return;
    }
    process.stderr.write(`${JOB} P1 läuft · Fläche: ${flaeche} · PostgreSQL: ${pgVersion}\n`);
    const pool = createPool(pgUrl(verbindung, gesamtwegDb));
    let strecke: Strecke | undefined;
    try {
      await migrate(pool);
      strecke = await starteAnwendung({ pool });
      await ersteinrichtung(strecke, ADMIN);

      // ── Die leere Ausgangslage, in der Datenbank nachgesehen. ────────────────────────────
      const vorher = await pool.query<{ anzahl: string }>(
        "SELECT count(*)::text AS anzahl FROM kos WHERE data->>'title' = $1",
        [NOTIZ.name],
      );
      expect(vorher.rows[0]?.anzahl, "das Objekt gibt es schon vor dem Weg").toBe("0");

      // ── DER GANZE WEG — derselbe Ablauf wie im Tor, nur mit PostgreSQL darunter. ─────────
      const befund = await fahreDenGesamtweg({
        browser,
        strecke,
        t,
        adminEmail: ADMIN,
      });
      expect(befund.gelesenerText).toBe(TEXT.replace("\n", " "));
      expect(befund.herkunft).toEqual({
        provider: "SharePoint",
        url: NOTIZ.webUrl,
        sourceVersion: QUELLSTAND,
      });
      expect(befund.zweiterImport.kartenMitDemNamen).toBe(1);
      // Dieselben sichtbaren Stationen wie im Tor-Lauf — sie hängen nicht an der Ablage, und
      // genau deshalb werden sie hier mitgemessen statt vorausgesetzt.
      expect(befund.objektseite.titel).toBe(NOTIZ.name);
      for (const zeile of TEXT.split("\n")) {
        expect(befund.objektseite.text, `„${zeile}“ fehlt am wieder geöffneten Objekt`).toContain(
          zeile,
        );
      }
      expect(befund.objektseite.quellen).toContain("SharePoint");
      expect(befund.objektseite.quellen).toContain(NOTIZ.webUrl);
      expect(befund.zustaende.leerSatz).toBe(t("imp.sharepoint.leer"));
      expect(befund.zustaende.nichtFrischSatz).toBe(t("imp.sharepoint.nichtFrisch"));

      // ── UND JETZT DIE STATION, DIE NUR HIER SICHTBAR IST: die Zeile selbst. ──────────────
      // Unabhängig von der Route gelesen: nicht die Antwort des Servers wird noch einmal
      // befragt, sondern der Bestand, den sie behauptet. Genau diese Verbindung war unbewiesen.
      const zeile = await pool.query<{ data: { bodyHtml?: string | null; sources?: unknown } }>(
        "SELECT data FROM kos WHERE id = $1",
        [befund.koId],
      );
      const daten = zeile.rows[0]?.data;
      expect(daten, "zu diesem Objekt steht keine Zeile in der Datenbank").toBeTruthy();
      expect(klartext(daten?.bodyHtml), "in der Datenbank steht nicht der Text der Datei").toBe(
        TEXT.replace("\n", " "),
      );
      const quellen = (daten?.sources ?? []) as {
        provider?: string | null;
        externalId?: string;
        url?: string | null;
        sourceVersion?: number;
      }[];
      const anker = quellen.find((q) => q.externalId === NOTIZ.id);
      expect(anker?.provider, "in der Zeile fehlt die Herkunft").toBe("SharePoint");
      expect(anker?.url, "in der Zeile fehlt die Originaladresse").toBe(NOTIZ.webUrl);
      expect(anker?.sourceVersion, "in der Zeile fehlt der Quellstand").toBe(QUELLSTAND);

      // GENAU EIN Objekt zu dieser Quelle — der Wiederholimport hat auch in der Tabelle nichts
      // verdoppelt, nicht nur in der Liste im Browser.
      const anzahl = await pool.query<{ anzahl: string }>(
        "SELECT count(*)::text AS anzahl FROM kos WHERE data->>'title' = $1",
        [NOTIZ.name],
      );
      expect(anzahl.rows[0]?.anzahl, "der Wiederholimport hat ein zweites Objekt angelegt").toBe(
        "1",
      );

      expect(doppel.fremdeAufrufe).toEqual([]);
      expect(doppel.downloadAufrufe.every((d) => d.url.startsWith(DOWNLOAD))).toBe(true);

      schreibeProtokoll(
        protokollzeile({
          browser,
          port: portVon(strecke),
          flaeche,
          datenhaltung: `PostgreSQL ${pgVersion}`,
          befund,
        }),
      );
    } finally {
      // DER POOL WIRD IMMER BEENDET — auch wenn das Schliessen der Anwendung scheitert
      // (Begründung wörtlich wie `gastweg-pg-im-browser.integration.test.ts:239-253`: sonst
      // schösse der `DROP … WITH (FORCE)` eine offene Verbindung ab, und der Lauf endete mit
      // einer Meldung, die über den Gegenstand nichts aussagt).
      try {
        await strecke?.schliessen();
      } finally {
        await pool.end();
      }
    }
  }, 1_200_000);
});
