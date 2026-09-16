// ================================================================================================
// JOB 4223 R2 · P — DERSELBE BROWSERWEG, ABER GEGEN ECHTES POSTGRESQL. DIE GEMEINSAME KETTE.
// ================================================================================================
//
// DIES IST DIE KORREKTURPFLICHT 1 AUS BENS URTEIL ZUR RUNDE 1, wörtlich: „Chromium mit zwei
// getrennten Profilen gegen dieselbe echte PostgreSQL-Instanz; Anlegen → Arbeiten → Ablauf →
// Verlängern → erneutes Arbeiten. Erwarteter Beleg: ein ausgeführter, nicht übersprungener Lauf
// über sämtliche Stationen."
//
// Runde 1 hatte zwei getrennte Behauptungen: der Browserlauf fuhr gegen Speicherablagen
// (`gastweg-im-echten-browser.test.ts` gab keinen Pool weiter), der PostgreSQL-Lauf sprach nur HTTP
// und bediente kein Formular. „PostgreSQL → Oberfläche in derselben Kette" war damit unbewiesen,
// und die Rückgabe behauptete es trotzdem. Hier ist die Kette:
//
//     PostgreSQL-Zeile → PgUserRepo/PgSessionRepo → AuthService → HTTP-Route über einen echten
//     Socket → die gebaute Fläche → Chromium, zwei getrennte Profile → und zurück in die Spalte.
//
// DER WEG IST NICHT ABGESCHRIEBEN. Er steht genau einmal in `browserweg.ts` und wird von dieser
// Datei mit `buildPgServices(pool)` gefahren und von `gastweg-im-echten-browser.test.ts` mit
// Speicherablagen. Verschieden ist EIN Argument; alles andere ist Zeichen für Zeichen derselbe
// Ablauf. Was hier ZUSÄTZLICH gemessen wird, ist die Datenhaltung selbst: was nach jedem Schritt
// wirklich in `users.access_expires_at` und in `sessions` steht.
//
// ================================================================================================
// WARUM DIESE DATEI IHRE FLÄCHE SELBST BAUT — und warum das kein Kunstgriff ist.
// ================================================================================================
//
// Beides zusammen — echte PostgreSQL UND gebaute Fläche — gibt es in keinem fertigen Lauf:
//
//   · Der Tor-Lauf (`./tools/check`) baut `apps/web/dist`, hat aber KEINE Datenbank. Gemessen in
//     Runde 2, Arbeitsprüfung af93839890774765: `PG-PROBE roh=FEHLT gesichert=nein`. Das ist
//     Absicht — `vitest.config.ts:31-32` hält das Tor bewusst docker- und datenbankfrei.
//   · Der Integrationslauf (`--config vitest.integration.config.ts`) hat die Datenbank, aber kein
//     `dist`. Gemessen, Arbeitsprüfung f53db6d5696a4158: `roh=gesetzt … verbindet=JA distDa=false`.
//
// Also baut diese Datei die Fläche EINMAL selbst, wenn sie fehlt — mit demselben `vite build`, das
// `./tools/build` fährt, 17,6 s im selben gemessenen Lauf. Das ist die ECHTE gebaute Fläche, keine
// Attrappe und keine Abkürzung: gemessen wird danach genau das Bündel, das auch ausgeliefert wird.
// Liegt `dist` schon vor, wird nichts gebaut.
//
// PRÜFGRENZE, LAUT GEMELDET (Lehre 12.09., JOB 3668): Ohne echte PostgreSQL wird der Grund SICHTBAR
// auf stderr gemeldet und übersprungen. Ein stiller Skip sähe aus wie ein bestandener Lauf.
// KEINE PRODUKTIVDATEN: ausschliesslich eine Wegwerf-Datenbank mit `test` im Namen, am Ende entfernt.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { type Browser, DIST, fahreDenGanzenWeg, mitFlaeche, starteChromium } from "./browserweg";
import { type Strecke, ersteinrichtung, starteStrecke, wissensobjektAnlegen } from "./strecke";

const JOB = "[KLARWERK] JOB 4223";
const ADMIN = "pg-browseradmin@gastweg-4223.test";
const TITEL = "Wartungsplan aus der Datenbank (JOB 4223)";
const GAST_NAME = "Gast aus der Datenbank";
const GAST_EMAIL = "pg-browsergast@gastweg-4223.test";
const FRIST_TAG = "2031-03-14";
const VERLAENGERUNG = "2032-07-09";
const VERGANGEN = "2020-01-02";

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

describe("JOB 4223 P · der ganze Gastweg im Browser, gegen echtes PostgreSQL", () => {
  let adminPool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let verfuegbar = false;
  let browser: Browser | undefined;
  let flaeche = "nicht hergestellt";
  const gastwegDb = `klarwerk_pgbrowser_test_${`${Date.now()}`.slice(-9)}`;

  beforeAll(async () => {
    const url = guardedLocalPgTestUrl();
    if (!url) {
      process.stderr.write(
        `${JOB} P UEBERSPRUNGEN: keine gesicherte KLARWERK_PG_TEST_URL — die gemeinsame Kette aus Browser und echter PostgreSQL ist damit nicht messbar.\n`,
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
    await adminPool.query("SELECT 1");
    await adminPool.query(`CREATE DATABASE ${gastwegDb}`);
    flaeche = stelleFlaecheBereit();
    browser = await starteChromium();
    verfuegbar = true;
  }, 900_000);

  afterAll(async () => {
    await browser?.close();
    if (adminPool) {
      await adminPool
        .query(`DROP DATABASE IF EXISTS ${gastwegDb} WITH (FORCE)`)
        .catch(() => undefined);
      await adminPool.end();
    }
  }, 120_000);

  it("P1 — eine leere Datenbank, zwei Browserprofile: anlegen → arbeiten → Ablauf → verlängern → weiterarbeiten", async (ctx) => {
    if (!verfuegbar || !verbindung || !browser) {
      ctx.skip();
      return;
    }
    process.stderr.write(`${JOB} P1 läuft · Fläche: ${flaeche}\n`);
    const pool = createPool(pgUrl(verbindung, gastwegDb));
    let strecke: Strecke | undefined;
    try {
      await migrate(pool);
      strecke = await starteStrecke({ pool, ...mitFlaeche() });
      const adminApi = (await ersteinrichtung(strecke, ADMIN)).sitzung;
      await wissensobjektAnlegen(adminApi, TITEL);

      // ── Die leere Ausgangslage, in der Datenbank nachgesehen. ────────────────────────────
      const vorher = await pool.query<{ anzahl: string }>(
        "SELECT count(*)::text AS anzahl FROM users WHERE email = $1",
        [GAST_EMAIL],
      );
      expect(vorher.rows[0]?.anzahl, "das Gastkonto gibt es schon vor dem Weg").toBe("0");

      // ── DER GANZE WEG — derselbe Ablauf wie im Tor, nur mit PostgreSQL darunter. ─────────
      const befund = await fahreDenGanzenWeg({
        browser,
        strecke,
        adminApi,
        adminEmail: ADMIN,
        gastName: GAST_NAME,
        gastEmail: GAST_EMAIL,
        titel: TITEL,
        fristTag: FRIST_TAG,
        verlaengerungsTag: VERLAENGERUNG,
        vergangenerTag: VERGANGEN,
      });

      expect(befund.zeileNachAnlage.wert).toContain("befristet bis");
      expect(befund.zeileNachAnlage.wert).toContain(befund.erwarteteAnzeige);
      expect(befund.nachbarWert).not.toContain("befristet bis");
      expect([401, 403]).toContain(befund.gesperrterAbruf.status);
      expect(befund.gesperrterAbruf.rumpf).not.toContain(TITEL);

      // ── UND JETZT DIE STATION, DIE NUR HIER SICHTBAR IST: die Spalte selbst. ─────────────
      // Der Weg hat zuletzt VERLÄNGERT. In der Datenbank muss deshalb der Zeitpunkt des
      // Verlängerungstages stehen — geschrieben von einem Formular in einem Browser, gelesen
      // aus PostgreSQL. Genau diese Verbindung war in Runde 1 unbewiesen.
      const spalte = await pool.query<{ access_expires_at: string | null }>(
        "SELECT access_expires_at FROM users WHERE id = $1",
        [befund.gastId],
      );
      const gespeichert = spalte.rows[0]?.access_expires_at;
      expect(gespeichert, "in der Spalte steht kein Ablaufzeitpunkt").toBeTruthy();
      expect(
        new Date(String(gespeichert)).getFullYear(),
        `die Spalte trägt nicht den verlängerten Tag (${gespeichert})`,
      ).toBe(Number(VERLAENGERUNG.slice(0, 4)));
      // Der TAG, nicht nur das Jahr — dieselbe Schärfe wie an der Fläche.
      const inDerZeitzone = new Date(String(gespeichert));
      expect(
        `${inDerZeitzone.getFullYear()}-${String(inDerZeitzone.getMonth() + 1).padStart(2, "0")}-${String(inDerZeitzone.getDate()).padStart(2, "0")}`,
        "die Spalte trägt einen anderen Kalendertag als den gewählten",
      ).toBe(VERLAENGERUNG);

      // Der Gast ist nach der Verlängerung wieder angemeldet: seine Sitzung steht in `sessions`.
      const sitzungen = await pool.query<{ anzahl: string }>(
        "SELECT count(*)::text AS anzahl FROM sessions WHERE user_id = $1",
        [befund.gastId],
      );
      expect(
        Number(sitzungen.rows[0]?.anzahl ?? "0"),
        "nach der Verlängerung steht keine lebende Sitzungszeile in der Datenbank",
      ).toBeGreaterThan(0);

      // Und das Konto ist freigegeben — `approved` UND Befristung nebeneinander, nie verschmolzen.
      const konto = await pool.query<{ approved: boolean; role: string }>(
        "SELECT approved, role FROM users WHERE id = $1",
        [befund.gastId],
      );
      expect(konto.rows[0]?.approved).toBe(true);
      expect(konto.rows[0]?.role, "die im Formular gewählte Rolle steht in der Datenbank").toBe(
        "viewer",
      );
    } finally {
      // DER POOL WIRD IMMER BEENDET — auch wenn das Schliessen der Anwendung scheitert.
      //
      // RUNDE 3, aus BENs Neufund an Runde 2 („terminating connection due to administrator
      // command", Ursache dort ungeklärt): Stand hier `await strecke.schliessen(); await pool.end();`
      // und warf der erste Aufruf, wurde der zweite übersprungen. Dann bliebe eine offene Verbindung
      // zur Wegwerf-Datenbank stehen, und der `DROP … WITH (FORCE)` im `afterAll` schösse sie ab —
      // der Lauf endete mit genau jener Meldung, die über den Gegenstand nichts aussagt und die
      // eigentliche Ursache verdeckt. Der Schliessfehler geht deshalb NICHT verloren: er wird
      // gemerkt, der Pool wird abgeräumt, und danach wird er geworfen.
      //
      // Das INNERE `finally` und kein eigener `throw`: ein `throw` im äusseren `finally` würde den
      // Fehler des `try`-Blocks überschreiben (biome `noUnsafeFinally`) — also genau die Maskierung,
      // gegen die dieser Abschnitt gebaut ist. So läuft `pool.end()` unbedingt, und ein
      // Schliessfehler trägt sich von selbst weiter.
      try {
        await strecke?.schliessen();
      } finally {
        await pool.end();
      }
    }
  }, 900_000);
});
