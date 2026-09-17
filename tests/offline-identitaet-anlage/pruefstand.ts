// ================================================================================================
// JOB 4322 · DER PRÜFSTAND DER STRECKE — Verbindung, gebaute Fläche, Chromium, Wegwerf-Datenbank.
// ================================================================================================
//
// ER STEHT IN EINER EIGENEN DATEI und nicht im Hauptfall, weil die Kalibrierungsdatei denselben
// Aufbau braucht. Würde sie ihn aus der Testdatei importieren, liefe deren `describe` ein zweites
// Mal mit — der Hauptfall stünde dann doppelt im Bericht, einmal unter falschem Namen.
//
// KEINE PRODUKTIVDATEN: ausschliesslich Wegwerf-Datenbanken mit „test" im Namen, je Fall neu
// angelegt und am Ende entfernt.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { Pool } from "pg";
import { expect } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { DIST, mitFlaeche, starteChromium } from "../gast-nutzerweg/browserweg";
import { type Strecke, ersteinrichtung, starteStrecke } from "../gast-nutzerweg/strecke";
import {
  type Verbindungszeile,
  alsBefund,
  warteAufVerbindungsende,
} from "../gast-nutzerweg/verbindungsende";
import { type BrowserMitFassung, kontenAnlegen } from "./offlineweg";

export const JOB = "[KLARWERK] JOB 4322";
export const CHEF = "chef@offlineweg-4322.test";
export const A_MAIL = "anna@offlineweg-4322.test";
export const B_MAIL = "bert@offlineweg-4322.test";
export const TITEL_A = "Ventil bei Ueberdruck (JOB 4322)";

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
      `${JOB}: „${datenbank}" trägt kein „test" im Namen — diese Suite fasst ausschliesslich Wegwerf-Datenbanken an.`,
    );
  }
  const anmeldung = `${encodeURIComponent(v.user)}:${encodeURIComponent(v.passwort)}`;
  return `${PG_SCHEMA}//${anmeldung}@${v.host}:${v.port}/${datenbank}`;
}

/**
 * Die gebaute Fläche herstellen, wenn sie fehlt — einmal, mit dem echten Bündler.
 *
 * Beides zusammen — echte PostgreSQL UND gebautes `apps/web/dist` — gibt es in keinem fertigen
 * Lauf; die ausführliche Messung dazu steht in
 * `tests/gast-nutzerweg/gastweg-pg-im-browser.integration.test.ts:25-39`. Es ist derselbe
 * `vite build`, den auch `./tools/build` fährt — die echte Auslieferung, keine Attrappe.
 *
 * ================================================================================================
 * `NODE_ENV=production` IST HIER KEIN ZIERRAT — ohne diese Zeile ist das Gebaute ein ANDERES BÜNDEL.
 * ================================================================================================
 *
 * GEMESSEN, nicht vermutet (Arbeitsprüfung 51a71b4e70c749b6a32d129fec42e57f, 17.09.): Vitest setzt
 * im eigenen Prozess `NODE_ENV=test`; ein von dort gestarteter `vite build` erbt das, und Vite
 * bildet `isProduction` aus `process.env.NODE_ENV`. `import.meta.env.PROD` steht dann auf `false` —
 * und `apps/web/src/main.tsx:63` registriert den Dienstarbeiter ausdrücklich NUR unter `PROD`. Im
 * ausgelieferten Bündel fehlte die Registrierung daraufhin vollständig; gemessen am Eintrittsbündel
 * `/assets/index-*.js`: `nenntSw: false, nenntRegister: false`, Länge 1 896 271 Zeichen.
 *
 * Ohne den Dienstarbeiter gibt es kein Neuladen ohne Netz (`apps/web/public/sw.js:45`) — Station (b)
 * wäre schlicht nicht fahrbar, und zwar an der VORRICHTUNG und nicht an der Zusage. Der echte
 * Auslieferungsweg (`tools/build` → `npx vite build`, und der Docker-Stage darüber) läuft ohne
 * `NODE_ENV=test`; diese Zeile stellt also den Zustand her, der ausgeliefert wird, statt einen
 * eigenen zu erfinden.
 *
 * DIESELBE FALLE STEHT UNBEHOBEN IN `gastweg-pg-im-browser.integration.test.ts:107` — dort fällt sie
 * nicht auf, weil jener Weg den Dienstarbeiter nicht braucht. Sie ist in der Rückgabe benannt; die
 * Datei liegt ausserhalb der Zielpfade dieses Auftrags.
 */
export function stelleFlaecheBereit(): string {
  if (existsSync(join(DIST, "index.html"))) {
    return "war schon da";
  }
  const begonnen = Date.now();
  execFileSync("npx", ["vite", "build"], {
    cwd: join(resolve(process.cwd()), "apps/web"),
    env: { ...process.env, NODE_ENV: "production" },
    stdio: "pipe",
    timeout: 600_000,
  });
  if (!existsSync(join(DIST, "index.html"))) {
    throw new Error(`${JOB}: der Bau lief durch, aber ${DIST}/index.html fehlt weiterhin.`);
  }
  return `gebaut in ${Date.now() - begonnen} ms`;
}

export interface Pruefstand {
  verfuegbar: boolean;
  verbindung: Verbindung | undefined;
  adminPool: Pool | undefined;
  browser: BrowserMitFassung | undefined;
  flaeche: string;
}

/**
 * Verbindung prüfen, Fläche herstellen, Chromium starten.
 *
 * AB DER STEHENDEN VERBINDUNG WIRD NICHTS MEHR VERSCHLUCKT (Lehre JOB 4299 R1, 17.09.): Scheitert
 * danach die Datenbankanlage, der Bau oder der Browserstart, ist das ein FEHLER und kein fehlender
 * Prüfstand — der Aufruf wirft, und der Lauf wird rot. Übersprungen wird ausschliesslich, wenn es
 * gar keine gesicherte Testdatenbank gibt; der Grund steht dann SICHTBAR auf stderr.
 */
export async function pruefstandAufbauen(marke: string): Promise<Pruefstand> {
  const stand: Pruefstand = {
    verfuegbar: false,
    verbindung: undefined,
    adminPool: undefined,
    browser: undefined,
    flaeche: "nicht hergestellt",
  };
  const url = guardedLocalPgTestUrl();
  if (!url) {
    process.stderr.write(
      `${JOB} ${marke} UEBERSPRUNGEN: keine gesicherte KLARWERK_PG_TEST_URL — die gemeinsame Kette aus Chromium und echter PostgreSQL ist damit nicht messbar.\n`,
    );
    return stand;
  }
  stand.verbindung = zerlege(url);
  if (!stand.verbindung) {
    process.stderr.write(
      `${JOB} ${marke} UEBERSPRUNGEN: KLARWERK_PG_TEST_URL nennt keinen Rechnernamen.\n`,
    );
    return stand;
  }
  stand.adminPool = new Pool({ connectionString: url });
  await stand.adminPool.query("SELECT 1");
  stand.flaeche = stelleFlaecheBereit();
  stand.browser = (await starteChromium()) as BrowserMitFassung;
  stand.verfuegbar = true;
  return stand;
}

export async function pruefstandAbbauen(stand: Pruefstand | undefined): Promise<void> {
  await stand?.browser?.close().catch(() => undefined);
  await stand?.adminPool?.end().catch(() => undefined);
}

export interface Welt {
  pool: Pool;
  strecke: Strecke;
  browser: BrowserMitFassung;
  aId: string;
  bId: string;
}

/**
 * Eine FRISCHE Wegwerf-Datenbank je Fall, mit eigener Anwendung und eigenem Socket.
 *
 * Je Fall und nicht je Datei: die Stationen zählen Zeilen in `drafts` ABSOLUT („0", „genau 1",
 * „weiterhin 1"). Zwei Fälle in derselben Datenbank zählten einander mit, und ein roter Fall sagte
 * dann nichts mehr darüber, welcher Schritt ihn verursacht hat.
 */
export async function inFrischerDatenbank<T>(
  stand: Pruefstand,
  marke: string,
  arbeit: (welt: Welt) => Promise<T>,
): Promise<T> {
  const verbindung = stand.verbindung as Verbindung;
  const adminPool = stand.adminPool as Pool;
  const browser = stand.browser as BrowserMitFassung;
  const db = `klarwerk_offlineweg_test_${marke.toLowerCase()}_${`${Date.now()}`.slice(-9)}`;
  await adminPool.query(`CREATE DATABASE ${db}`);
  const pool = createPool(pgUrl(verbindung, db));
  let strecke: Strecke | undefined;
  try {
    await migrate(pool);
    strecke = await starteStrecke({ pool, ...mitFlaeche() });
    const chef = (await ersteinrichtung(strecke, CHEF)).sitzung;
    const kennungen = await kontenAnlegen(chef, [
      { name: "Anna", email: A_MAIL },
      { name: "Bert", email: B_MAIL },
    ]);
    const aId = String(kennungen[A_MAIL]);
    const bId = String(kennungen[B_MAIL]);
    expect(aId, "A und B sind dasselbe Konto — der Fall misst dann nichts").not.toBe(bId);
    return await arbeit({ pool, strecke, browser, aId, bId });
  } finally {
    // DER POOL WIRD IMMER BEENDET — auch wenn das Schliessen der Anwendung scheitert; und erst
    // DANACH fällt die Datenbank. Dieselbe Bauform und dieselbe Begründung wie in
    // `gastweg-pg-im-browser.integration.test.ts:250-269`: ein `throw` im äusseren `finally` würde
    // den Fehler des Falls überschreiben, deshalb die geschachtelten `finally` ohne eigenen Wurf.
    try {
      try {
        await strecke?.schliessen();
      } finally {
        await pool.end();
      }
    } finally {
      const befund = await warteAufVerbindungsende(adminPool, db).catch(() => undefined);
      const rest: Verbindungszeile[] = befund?.rest ?? [];
      await adminPool.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => undefined);
      if (rest.length > 0) {
        process.stderr.write(
          `${JOB} ${marke}: beim DROP DATABASE hingen noch Verbindungen an ${db} — ${alsBefund(rest)}\n`,
        );
      }
    }
  }
}
