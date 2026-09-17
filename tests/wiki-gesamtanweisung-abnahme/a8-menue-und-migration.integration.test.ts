// ================================================================================================
// JOB 4309 · A8 — DER GANZE WEG: FRISCHE DATENBANK, MENÜ, SECHS FÄLLE, NEUSTART.
// ================================================================================================
//
// DIE FRAGE DIESER DATEI ist die Aufgabenerfüllung des Auftrags, und sie lautet nicht „lässt sich
// der Dienst rufen?" (das misst `tests/wiki-gesamtanweisung/**`) und nicht „antwortet die App auf
// diesen Adressen?" (das misst `a1-tuer-in-der-gebauten-app.test.ts`). Sie lautet:
//
//     Kann ein Mensch die Gesamtanweisung OHNE getippte Adresse und OHNE Handmigration benutzen?
//
// Beides zusammen — und nur zusammen — ist der Nutzerweg. Ohne Migration fehlen die Tabellen, ohne
// Menüpunkt findet niemand die Seite, und ein Komponententest sähe beides nicht.
//
// ------------------------------------------------------------------------------------------------
// DIE DATENBANK ENTSTEHT ALLEIN DURCH `migrate()` — das ist Lieferung 2, nicht eine Nebensache.
// ------------------------------------------------------------------------------------------------
// `PgAnweisungRepo.migriere()` wird in dieser Datei NIRGENDS gerufen. Bis JOB 4309 war das der
// einzige Weg zu den drei Tabellen (`tests/wiki-gesamtanweisung/ddl-und-restarbeit.test.ts` hielt
// die Lücke als eigenen Fall fest, und `a5-neustart.integration.test.ts` nennt den Handaufruf im
// Kopf ausdrücklich seine benannte Schwäche). Hier gibt es ihn nicht: was die Anweisung braucht,
// legt `migrate(pool)` an — derselbe Aufruf, den `services/app/src/server.ts` beim Start fährt.
// Fehlte die Stufe in der `schemas`-Liste, scheiterte A8a mit „relation … does not exist".
//
// ------------------------------------------------------------------------------------------------
// DER BROWSERWEG IST GELIEHEN, NICHT NACHGEBAUT.
// ------------------------------------------------------------------------------------------------
// Chromium startet über `starteChromium` aus `tests/gast-nutzerweg/browserweg.ts`, das Browserprofil
// kommt aus `profil`, die Tastatureingaben aus `tippeMitTastatur`/`tabBisZu`, das Warten aus
// `warte`. Eine zweite Startstelle wäre eine zweite Wahrheit darüber, wie dieses Produkt im Browser
// gemessen wird. Die Datei dort wird gelesen und benutzt, nicht geändert.
//
// ------------------------------------------------------------------------------------------------
// PRÜFGRENZE, LAUT GEMELDET — ein Skip ist hier kein Grün.
// ------------------------------------------------------------------------------------------------
// Ohne gesicherte `KLARWERK_PG_TEST_URL` und ohne Chromium wird der Grund SICHTBAR auf stderr
// gemeldet und übersprungen (Muster `gastweg-pg-im-browser.integration.test.ts:41-43`). Dass ein
// solcher Lauf NICHT als bestanden zählt, ist keine Behauptung dieser Datei, sondern eine Funktion
// mit eigenem Fall im Tor: `laufzustand.ts` / `a9-skip-zaehlt-nicht.test.ts`. Der Zeugenfall ganz
// unten läuft IMMER — er ruft nie die Datenbank — und hält den Zustand dieses Laufs fest.
//
// KEINE PRODUKTIVDATEN: ausschliesslich eine Wegwerf-Datenbank mit `test` im Namen, am Ende entfernt.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  type Browser,
  DIST,
  LIES_TEXT,
  type Seite,
  fn,
  mitFlaeche,
  profil,
  starteChromium,
  tabBisZu,
  tippeMitTastatur,
  warte,
} from "../gast-nutzerweg/browserweg";
import {
  PASSWORT,
  type Sitzung,
  type Strecke,
  ersteinrichtung,
  mussGelingen,
  starteStrecke,
  wissensobjektAnlegen,
} from "../gast-nutzerweg/strecke";
import { type Laufzustand, befundsatz, zaehltAlsBestanden } from "./laufzustand";

const MARKE = "JOB 4309 A8";
const ADMIN = "a8-admin@gesamtanweisung-4309.test";
const KO_EINS = "Ventil oeffnen (JOB 4309)";
const KO_ZWEI = "Druck pruefen (JOB 4309)";
const ANWEISUNGSTITEL = "Anlage anfahren (JOB 4309)";
const NACHWEIS_EINS = "hash-eins-4309";
const NACHWEIS_ZWEI = "hash-zwei-4309";
const VORAUSSETZUNG = "Nur bei stehender Anlage";

/** Zusammengesetzt statt ausgeschrieben — s. `tests/neuinstallation/…` (Fall N3 dort). */
const PG_SCHEMA = "postgresql:";

/** Die drei Tabellen, die `migrate()` seit JOB 4309 anlegt. Ohne sie gibt es keinen Nutzerweg. */
const ANWEISUNGSTABELLEN = [
  "gesamtanweisungen",
  "gesamtanweisung_bausteine",
  "gesamtanweisung_staende",
] as const;

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
      `${MARKE}: „${datenbank}" trägt kein „test" im Namen — diese Suite fasst ausschliesslich Wegwerf-Datenbanken an.`,
    );
  }
  const anmeldung = `${encodeURIComponent(v.user)}:${encodeURIComponent(v.passwort)}`;
  return `${PG_SCHEMA}//${anmeldung}@${v.host}:${v.port}/${datenbank}`;
}

/**
 * Die gebaute Fläche herstellen, wenn sie fehlt — einmal, mit dem echten Bündler.
 *
 * ABWEICHUNG, ausgeschrieben statt verschwiegen: dieselben Zeilen stehen in
 * `tests/gast-nutzerweg/gastweg-pg-im-browser.integration.test.ts:101-116`. Sie sind dort NICHT
 * exportiert, und jene Datei gehört einer anderen Zeile und darf hier nicht geändert werden. Es ist
 * damit KEINE zweite Bauart — es ist zweimal derselbe Aufruf `npx vite build` in `apps/web`, also
 * genau das Bündel, das auch `./tools/build` erzeugt und das ausgeliefert wird.
 */
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
    throw new Error(`${MARKE}: der Bau lief durch, aber ${DIST}/index.html fehlt weiterhin.`);
  }
  return `gebaut in ${Date.now() - begonnen} ms`;
}

/**
 * Anmeldung über die ECHTE Maske, mit der Tastatur.
 *
 * Zusammengesetzt aus den EXPORTIERTEN Bausteinen von `browserweg.ts`; die dortige `anmelden` ist
 * modulintern und liegt in einer Datei, die dieser Auftrag nur lesen darf.
 */
async function anmelden(seite: Seite, basis: string, email: string): Promise<void> {
  await seite.goto(`${basis}/`, { waitUntil: "domcontentloaded" });
  await warte(seite, `() => !!document.querySelector("#auth-email")`, `Anmeldemaske für ${email}`);
  await tippeMitTastatur(seite, "#auth-email", email, "E-Mail");
  await tippeMitTastatur(seite, "#auth-password", PASSWORT, "Passwort");
  await seite.keyboard.press("Enter");
  await warte(
    seite,
    `() => !document.querySelector("#auth-email")`,
    "die Anmeldung trägt",
    undefined,
    45_000,
  );
}

/** Ein Feld füllen, ohne den Tab-Weg zu zählen — dieser Auftrag misst die Bedienbarkeit nicht. */
async function tippeIn(seite: Seite, selektor: string, wert: string): Promise<void> {
  await warte(seite, "(s) => !!document.querySelector(s)", `Feld ${selektor}`, selektor);
  await seite.fill(selektor, wert);
}

/** Die Kennungen der Bausteine in ihrer GEZEICHNETEN Reihenfolge. */
const BAUSTEINFOLGE = `() => [...document.querySelectorAll('[data-testid="ga-lesestand-baustein"]')]
  .map((e) => e.getAttribute("data-baustein") || "")`;

/** Die Vergleichszeilen als Paare „Feld → Auswirkung", gelesen am gezeichneten DOM. */
const VERGLEICHSZEILEN = `() => [...document.querySelectorAll('[data-testid="ga-vergleich-ergebnis"] li')]
  .map((e) => ((e.textContent || "").trim() + "||" + (e.getAttribute("data-auswirkung") || "")))`;

/** Eine native Auswahl per Tastatur auf einen Wert stellen — und das Ergebnis nachmessen. */
async function waehleStand(seite: Seite, selektor: string, wert: number): Promise<void> {
  await tabBisZu(seite, selektor, 250, true);
  for (let schritt = 0; schritt < 40; schritt += 1) {
    const gesetzt = await seite.evaluate<string>(
      fn('(s) => { const e = document.querySelector(s); return e ? e.value : ""; }'),
      selektor,
    );
    if (gesetzt === String(wert)) {
      return;
    }
    await seite.keyboard.press("ArrowDown");
  }
  throw new Error(
    `${MARKE}: der Stand ${wert} liess sich in ${selektor} nicht wählen (gelesen: ${await seite.evaluate<string>(fn('(s) => { const e = document.querySelector(s); return e ? e.value : "(kein Feld)"; }'), selektor)}).`,
  );
}

/** Der Stand der Anweisung, am Draht nachgesehen. Kein Schritt des Weges, nur ein Blick. */
async function standAmDraht(api: Sitzung, id: string): Promise<{ version: number; stand: string }> {
  const antwort = mussGelingen(
    `GET /api/gesamtanweisungen/${id}`,
    await api.sende("GET", `/api/gesamtanweisungen/${id}`),
  );
  const gelesen = antwort.json as { version: number; stand: string };
  return { version: gelesen.version, stand: gelesen.stand };
}

describe("JOB 4309 A8 · die Gesamtanweisung auf einer frisch migrierten Datenbank, über das Menü", () => {
  let adminPool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let browser: Browser | undefined;
  let verfuegbar = false;
  let flaeche = "nicht hergestellt";
  let laufzustand: Laufzustand | undefined;
  const db = `klarwerk_ga4309_test_${`${Date.now()}`.slice(-9)}`;

  beforeAll(async () => {
    const url = guardedLocalPgTestUrl();
    if (!url) {
      laufzustand = {
        gelaufen: false,
        grund:
          "keine gesicherte KLARWERK_PG_TEST_URL — Migration und Browserweg sind nicht messbar",
      };
      process.stderr.write(befundsatz(MARKE, laufzustand));
      return;
    }
    verbindung = zerlege(url);
    if (!verbindung) {
      laufzustand = { gelaufen: false, grund: "KLARWERK_PG_TEST_URL nennt keinen Rechnernamen" };
      process.stderr.write(befundsatz(MARKE, laufzustand));
      return;
    }
    adminPool = new Pool({ connectionString: url });
    await adminPool.query("SELECT 1");
    await adminPool.query(`CREATE DATABASE ${db}`);
    flaeche = stelleFlaecheBereit();
    browser = await starteChromium();
    verfuegbar = true;
    laufzustand = { gelaufen: true, quelle: `${verbindung.host}:${verbindung.port}/${db}` };
    process.stderr.write(befundsatz(MARKE, laufzustand));
  }, 900_000);

  afterAll(async () => {
    await browser?.close();
    if (adminPool) {
      await adminPool.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => undefined);
      await adminPool.end();
    }
  }, 120_000);

  // ==============================================================================================
  // A8a · R1 — DIE DREI TABELLEN ENTSTEHEN ALLEIN DURCH `migrate()`.
  // ==============================================================================================
  //
  // Der kleinste mögliche Nachweis für Lieferung 2, und er steht VOR dem Browserlauf: scheitert er,
  // ist der lange Lauf darunter ohnehin nicht zu deuten. Vor JOB 4309 war er rot mit „relation
  // gesamtanweisungen does not exist", sobald jemand sie abfragte.
  it("A8a — auf einer frisch migrierten Datenbank sind die drei Anweisungstabellen da", async (ctx) => {
    if (!verfuegbar || !verbindung) {
      ctx.skip();
      return;
    }
    const pool = createPool(pgUrl(verbindung, db));
    try {
      await migrate(pool);
      for (const tabelle of ANWEISUNGSTABELLEN) {
        const da = await pool.query<{ n: string }>(
          "SELECT count(*)::text AS n FROM information_schema.tables WHERE table_schema='public' AND table_name=$1",
          [tabelle],
        );
        expect(
          da.rows[0]?.n,
          `${tabelle} fehlt nach migrate() — dann ist die Gesamtanweisung im Postgres-Betrieb nicht einsatzbereit`,
        ).toBe("1");
        // UND SIE IST WIRKLICH BENUTZBAR, nicht nur im Katalog: ein Katalogeintrag ohne lesbare
        // Tabelle wäre eine Zusage ohne Gegenstand.
        const gelesen = await pool.query<{ n: string }>(
          `SELECT count(*)::text AS n FROM ${tabelle}`,
        );
        expect(gelesen.rows[0]?.n, `${tabelle} ist nicht abfragbar`).toBe("0");
      }
      // WIEDERHOLBAR: die Anwendung migriert bei JEDEM Start erneut. Ein zweiter Lauf muss folgenlos
      // bleiben — sonst stürbe jeder Neustart an der eigenen Migration.
      await migrate(pool);
      const nochDa = await pool.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM gesamtanweisungen",
      );
      expect(nochDa.rows[0]?.n, "der zweite migrate()-Lauf hat den Bestand angefasst").toBe("0");
    } finally {
      await pool.end();
    }
  }, 180_000);

  // ==============================================================================================
  // A8b · DIE SECHS ENTSCHEIDENDEN FÄLLE — im echten Chromium, gegen die GEBAUTE Fläche.
  // ==============================================================================================
  it("A8b — (a) über das Menü anlegen · (b) Bausteine · (c) ordnen · (d) vergleichen · (e) vorlegen · (f) Lückenvermerk · Neustart", async (ctx) => {
    if (!verfuegbar || !verbindung || !browser) {
      ctx.skip();
      return;
    }
    process.stderr.write(`${MARKE} A8b läuft · Fläche: ${flaeche}\n`);
    const echterBrowser = browser;
    const zugang = pgUrl(verbindung, db);
    let pool = createPool(zugang);
    let strecke: Strecke | undefined;
    let anweisungId = "";
    let standVorOrdnen = 0;
    let standNachOrdnen = 0;
    let standNachVoraussetzung = 0;
    let folgeNachOrdnen: string[] = [];

    try {
      // ── Die Datenbank entsteht ALLEIN durch migrate(). Kein `migriere()` in dieser Datei. ──
      await migrate(pool);
      strecke = await starteStrecke({ pool, ...mitFlaeche() });
      const adminApi = (await ersteinrichtung(strecke, ADMIN)).sitzung;

      // Zwei Wissenseinträge als BAUSTEINE — angelegt am Draht, weil der Weg dorthin nicht der
      // Gegenstand dieses Auftrags ist. Ihre Fassungsnummern werden NACHGESEHEN, nicht geraten:
      // eine geratene Nummer liefe in „Diese Fassung gibt es nicht" und die Meldung zeigte auf die
      // falsche Stelle.
      const koEins = await wissensobjektAnlegen(adminApi, KO_EINS);
      const koZwei = await wissensobjektAnlegen(adminApi, KO_ZWEI);
      const fassungVon = async (koId: string): Promise<number> => {
        const antwort = mussGelingen(
          `GET /api/kos/${koId}/versions`,
          await adminApi.sende("GET", `/api/kos/${koId}/versions`),
        );
        const saetze = (antwort.json as { version: number }[]) ?? [];
        expect(
          saetze.length,
          `der Eintrag ${koId} hat keine belegte Fassung — dann ist er nicht bindbar, und der Weg unten misst etwas anderes als gemeint`,
        ).toBeGreaterThan(0);
        return Math.max(...saetze.map((s) => s.version));
      };
      const fassungEins = await fassungVon(koEins);
      const fassungZwei = await fassungVon(koZwei);

      const { kontext, seite } = await profil(echterBrowser, { width: 1280, height: 900 });
      try {
        await anmelden(seite, strecke.basis, ADMIN);

        // ══ (a) ÜBER DAS MENÜ — keine getippte Adresse. ════════════════════════════════════════
        await seite.goto(`${strecke.basis}/start`, { waitUntil: "domcontentloaded" });
        await warte(
          seite,
          `() => !!document.querySelector('[data-testid="kopfband-zahnrad"]')`,
          "das Kopfband mit dem Zahnrad",
          undefined,
          45_000,
        );
        await seite.click('[data-testid="kopfband-zahnrad"]');
        await warte(
          seite,
          `() => !!document.querySelector('[data-testid="zahnrad-menue"]')`,
          "das geöffnete Zahnrad-Menü",
        );
        await seite.click('[data-testid="zahnrad-weitere-bereiche"]');
        await warte(
          seite,
          `() => document.querySelector('[data-testid="zahnrad-weitere-bereiche"]')?.getAttribute("aria-expanded") === "true"`,
          "das aufgeklappte Untermenü „Weitere Bereiche“",
        );
        // ERST DER EINTRAG, DANN DER KLICK: wäre der Punkt nicht da, sagte die Meldung „kein
        // Menüpunkt" statt „Klick ging ins Leere".
        const menuezeile = await seite.evaluate<{ text: string; href: string } | null>(
          fn(`() => {
            const e = document.querySelector('[data-testid="bereich-gesamtanweisungen"]');
            return e ? { text: (e.innerText || "").trim(), href: e.getAttribute("href") || "" } : null;
          }`),
        );
        expect(
          menuezeile,
          "im Zahnrad-Menü steht kein Punkt „Gesamtanweisungen“ — die Seite wäre nur über eine getippte Adresse erreichbar",
        ).not.toBeNull();
        expect((menuezeile as { href: string }).href).toBe("/gesamtanweisungen");
        expect(
          (menuezeile as { text: string }).text,
          "der Menüpunkt trägt keinen Namen in Anwendersprache",
        ).toContain("Gesamtanweisungen");
        await seite.click('[data-testid="bereich-gesamtanweisungen"]');
        await warte(
          seite,
          `() => !!document.querySelector('[data-testid="ga-bereich-anlegen"]')`,
          "der Einstieg der Gesamtanweisung nach dem Klick im Menü",
          undefined,
          45_000,
        );
        expect(
          seite.url().endsWith("/gesamtanweisungen"),
          `nach dem Menüklick steht die Adresse auf ${seite.url()}`,
        ).toBe(true);

        // ══ (a) EINE ANWEISUNG ANLEGEN — über das Formular des Einstiegs. ══════════════════════
        await tippeIn(seite, "#ga-bereich-titel", ANWEISUNGSTITEL);
        await seite.click('[data-testid="ga-bereich-anlegen"] button[type="submit"]');
        await warte(
          seite,
          `() => !!document.querySelector('[data-testid="ga-seite"]')`,
          "die geöffnete Anweisung nach dem Anlegen",
          undefined,
          45_000,
        );
        anweisungId = seite.url().split("/gesamtanweisungen/")[1] ?? "";
        expect(anweisungId.length, "der Server hat keine Kennung vergeben").toBeGreaterThan(0);
        // SIE STEHT WIRKLICH IN DER DATENBANK — nicht nur auf dem Bildschirm.
        const inDerTabelle = await pool.query<{ titel: string }>(
          "SELECT titel FROM gesamtanweisungen WHERE id = $1",
          [anweisungId],
        );
        expect(inDerTabelle.rows[0]?.titel, "die angelegte Anweisung fehlt in der Tabelle").toBe(
          ANWEISUNGSTITEL,
        );

        // ══ (b) VORHANDENE FASSUNGEN ALS BAUSTEINE AUFNEHMEN. ══════════════════════════════════
        for (const [koId, fassung, nachweis] of [
          [koEins, fassungEins, NACHWEIS_EINS],
          [koZwei, fassungZwei, NACHWEIS_ZWEI],
        ] as const) {
          await tippeIn(seite, "#ga-aufnahme-koid", koId);
          await tippeIn(seite, "#ga-aufnahme-fassung", String(fassung));
          await tippeIn(seite, "#ga-aufnahme-nachweis", nachweis);
          await seite.click('[data-testid="ga-aufnahme"] button[type="submit"]');
          await warte(
            seite,
            `(n) => document.querySelectorAll('[data-testid="ga-lesestand-baustein"]').length === n`,
            `der aufgenommene Baustein ${koId}`,
            koId === koEins ? 1 : 2,
            45_000,
          );
        }
        // Die Bindung steht in der Datenbank, mit Eintrag, Fassung UND Nachweis-Hash — sonst wäre
        // „aufgenommen" eine Aussage über den Bildschirm und nicht über den Bestand.
        const bausteine = await pool.query<{
          ko_id: string;
          ko_version: number;
          nachweis_hash: string | null;
          pos: number;
        }>(
          "SELECT ko_id, ko_version, nachweis_hash, pos FROM gesamtanweisung_bausteine WHERE anweisung_id = $1 ORDER BY pos",
          [anweisungId],
        );
        expect(bausteine.rows.map((z) => z.ko_id)).toEqual([koEins, koZwei]);
        expect(bausteine.rows.map((z) => z.ko_version)).toEqual([fassungEins, fassungZwei]);
        expect(bausteine.rows.map((z) => z.nachweis_hash)).toEqual([NACHWEIS_EINS, NACHWEIS_ZWEI]);

        const folgeVorOrdnen = await seite.evaluate<string[]>(fn(BAUSTEINFOLGE));
        expect(folgeVorOrdnen.length, "die Fläche zeigt nicht zwei Bausteine").toBe(2);
        standVorOrdnen = (await standAmDraht(adminApi, anweisungId)).version;

        // ══ (c) DIE REIHENFOLGE ÄNDERN — über den Knopf der Liste. ═════════════════════════════
        // `p button:nth-of-type(1)` ist der Knopf „nach oben": die beiden Ordnungsknöpfe stehen in
        // einem eigenen `<p>` (`LesestandAnsicht.tsx`), der Übernehmen-Knopf der Voraussetzung in
        // einem `<form>`. Ohne das `p` träfe der Selektor beide, und Playwright bräche mit
        // „resolved to 2 elements" ab — eine Meldung über den Prüfstand statt über das Produkt.
        await seite.click(`[data-baustein="${folgeVorOrdnen[1]}"] p button:nth-of-type(1)`);
        await warte(
          seite,
          `(erste) => (document.querySelector('[data-testid="ga-lesestand-baustein"]')?.getAttribute("data-baustein") || "") === erste`,
          "die umgedrehte Reihenfolge auf der Fläche",
          folgeVorOrdnen[1],
          45_000,
        );
        folgeNachOrdnen = await seite.evaluate<string[]>(fn(BAUSTEINFOLGE));
        expect(folgeNachOrdnen, "die Reihenfolge hat sich nicht wirklich gedreht").toEqual([
          folgeVorOrdnen[1],
          folgeVorOrdnen[0],
        ]);
        const inDerDatenbank = await pool.query<{ ko_id: string }>(
          "SELECT ko_id FROM gesamtanweisung_bausteine WHERE anweisung_id = $1 ORDER BY pos",
          [anweisungId],
        );
        expect(
          inDerDatenbank.rows.map((z) => z.ko_id),
          "die neue Reihenfolge steht nicht in der Datenbank",
        ).toEqual([koZwei, koEins]);
        standNachOrdnen = (await standAmDraht(adminApi, anweisungId)).version;
        expect(standNachOrdnen).toBeGreaterThan(standVorOrdnen);

        // ── EINE INHALTSÄNDERUNG DANEBEN: die Voraussetzung eines Bausteins. ──────────────────
        await tippeIn(seite, `#ga-voraussetzung-${folgeNachOrdnen[0]}`, VORAUSSETZUNG);
        await seite.click(`[data-baustein="${folgeNachOrdnen[0]}"] form button[type="submit"]`);
        await warte(
          seite,
          `(t) => (document.querySelector('[data-testid="ga-lesestand"]')?.textContent || "").includes(t)`,
          "die übernommene Voraussetzung",
          VORAUSSETZUNG,
          45_000,
        );
        standNachVoraussetzung = (await standAmDraht(adminApi, anweisungId)).version;
        expect(standNachVoraussetzung).toBeGreaterThan(standNachOrdnen);

        // ══ (d) ZWEI STÄNDE VERGLEICHEN — Reihenfolge ANDERS ausgewiesen als Inhalt. ═══════════
        const vergleiche = async (von: number, bis: number): Promise<string[]> => {
          await waehleStand(seite, "#ga-vergleich-von", von);
          await waehleStand(seite, "#ga-vergleich-bis", bis);
          await warte(
            seite,
            `() => !!document.querySelector('[data-testid="ga-vergleich-ergebnis"] li')`,
            `das Vergleichsergebnis ${von} → ${bis}`,
            undefined,
            45_000,
          );
          return seite.evaluate<string[]>(fn(VERGLEICHSZEILEN));
        };
        /**
         * Die GEÄNDERTEN Zeilen — und warum hier nicht nach Feldnamen gesucht wird.
         *
         * „Voraussetzungen" steht ZWEIMAL in der Liste: einmal für die Anweisung (Kopfangabe) und
         * einmal je Baustein. Ein `find` auf den Feldnamen träfe die erste und prüfte damit die
         * falsche Zeile. Gemessen wird deshalb die MENGE der geänderten Befunde: sie sagt beides
         * zugleich — was geändert ist UND dass sonst nichts mitgefärbt wurde.
         */
        const nurGeaendert = (zeilen: readonly string[]): string[] =>
          zeilen.filter((z) => z.endsWith("||geaendert"));

        // 1. DIE REIHENFOLGEÄNDERUNG. Beide Bausteine haben die Plätze getauscht, also sind GENAU
        //    die zwei Reihenfolge-Befunde geändert — und kein einziger Inhalts- oder Fassungsbefund.
        const nachOrdnen = await vergleiche(standVorOrdnen, standNachOrdnen);
        const geaendertNachOrdnen = nurGeaendert(nachOrdnen);
        expect(
          geaendertNachOrdnen.length,
          `eine gedrehte Reihenfolge ergibt nicht genau zwei Änderungsbefunde — gelesen: ${nachOrdnen.join(" | ")}`,
        ).toBe(2);
        for (const zeile of geaendertNachOrdnen) {
          expect(
            zeile,
            "die Reihenfolgeänderung färbt einen anderen Befund mit — „Reihenfolge anders als Inhalt“ wäre dann nicht belegt",
          ).toContain("Reihenfolge ·");
        }
        // UND DER INHALT IST AUSDRÜCKLICH ALS UNVERÄNDERT AUSGEWIESEN, nicht bloss „nicht geändert":
        // eine fehlende Zeile wäre keine Aussage.
        expect(
          nachOrdnen.filter((z) => z.startsWith("Tabellenüberschriften ·")).length,
          "der Inhaltsbefund fehlt im Vergleich",
        ).toBe(2);
        for (const zeile of nachOrdnen.filter((z) => z.startsWith("Tabellenüberschriften ·"))) {
          expect(zeile).toContain("||unveraendert");
        }

        // 2. DIE INHALTSÄNDERUNG — dieselbe Anweisung, anderes Feld, anderer Befund. Genau EINE
        //    Zeile ist geändert, und es ist die Voraussetzung EINES Bausteins (Einzahl im Hinweis;
        //    die Kopfangabe der Anweisung heisst „Voraussetzungen").
        const nachVoraussetzung = await vergleiche(standNachOrdnen, standNachVoraussetzung);
        const geaendertNachVoraussetzung = nurGeaendert(nachVoraussetzung);
        expect(
          geaendertNachVoraussetzung.length,
          `eine geänderte Voraussetzung ergibt nicht genau einen Änderungsbefund — gelesen: ${nachVoraussetzung.join(" | ")}`,
        ).toBe(1);
        expect(
          geaendertNachVoraussetzung[0],
          "die geänderte Voraussetzung wird nicht als solche ausgewiesen",
        ).toContain("Voraussetzung: geändert.");
        expect(
          nachVoraussetzung
            .filter((z) => z.startsWith("Reihenfolge ·"))
            .every((z) => z.endsWith("||unveraendert")),
          "die Reihenfolge gilt als geändert, obwohl nur der Inhalt angefasst wurde — die beiden Aussagen sind vertauschbar",
        ).toBe(true);

        // 3. GLEICHER HASH HEISST „unverändert", NICHT „richtig". Der Satz steht am Bildschirm.
        const vergleichstext = (await seite.evaluate<string[]>(fn(VERGLEICHSZEILEN))).join(" ");
        expect(
          await seite.evaluate<string>(fn(LIES_TEXT)),
          "die Gleichheitsaussage nennt ihre Grenze nicht — ein gleicher Nachweis belegt Unverändertheit, nicht Richtigkeit",
        ).toContain("Das ist keine Aussage über Richtigkeit.");
        for (const verboten of ["geprüft", "bestätigt", "korrekt"]) {
          expect(
            vergleichstext,
            `der Vergleich behauptet „${verboten}“ — er darf nur Unverändertheit aussagen`,
          ).not.toContain(verboten);
        }

        // ══ (e) VORLEGEN — und die Ablehnung, wenn sich zwischendurch etwas ändert. ════════════
        //
        // DIE ÄNDERUNG KOMMT VON AUSSEN, während die Fläche ihren Stand schon gelesen hat: genau
        // die Lage, die der Auftrag verlangt („eine Änderung währenddessen"). Die Fläche schickt
        // ihren gelesenen Prüfstand mit — der Server bestätigt nur genau den unveränderten.
        const fremd = await adminApi.sende(
          "PUT",
          `/api/gesamtanweisungen/${anweisungId}/bausteine/${folgeNachOrdnen[1]}/voraussetzung`,
          { version: standNachVoraussetzung, voraussetzung: "Von anderer Stelle geändert" },
        );
        expect(fremd.status, `die fremde Änderung kam nicht durch: ${fremd.text}`).toBe(200);

        await seite.click('[data-testid="ga-entscheidung-vorlegen"]');
        await warte(
          seite,
          `() => !!document.querySelector('[data-testid="ga-entscheidung-fehler"]')`,
          "die nachvollziehbare Ablehnung des veralteten Prüfstands",
          undefined,
          45_000,
        );
        const absage = await seite.evaluate<string>(
          fn(
            '() => (document.querySelector(\'[data-testid="ga-entscheidung-fehler"]\')?.textContent || "")',
          ),
        );
        expect(
          absage,
          "die Absage nennt den Grund nicht — ein Mensch erführe nur, dass etwas schiefging",
        ).toContain("zwischenzeitlich geändert");
        // UND SIE IST WIRKLICH NICHT VORGELEGT: eine Absage, die trotzdem schreibt, wäre schlimmer
        // als keine.
        expect((await standAmDraht(adminApi, anweisungId)).stand).toBe("entwurf");

        // MIT DEM NEUEN STAND GEHT ES: neu laden, dann trägt derselbe Knopf.
        await seite.reload({ waitUntil: "domcontentloaded" });
        await warte(
          seite,
          `() => !!document.querySelector('[data-testid="ga-entscheidung-vorlegen"]')`,
          "die neu geladene Anweisung",
          undefined,
          45_000,
        );
        await seite.click('[data-testid="ga-entscheidung-vorlegen"]');
        await warte(
          seite,
          `() => !!document.querySelector('[data-testid="ga-entscheidung-annehmen"]')`,
          "die vorgelegte Anweisung mit ihren Entscheidungsknöpfen",
          undefined,
          45_000,
        );
        expect((await standAmDraht(adminApi, anweisungId)).stand).toBe("vorgelegt");
        await seite.click('[data-testid="ga-entscheidung-annehmen"]');
        await warte(
          seite,
          `() => (document.querySelector('[data-testid="ga-entscheidung-stand"]')?.textContent || "").includes("Entschieden")`,
          "die entschiedene Anweisung",
          undefined,
          45_000,
        );
        expect((await standAmDraht(adminApi, anweisungId)).stand).toBe("entschieden");

        // ══ (f) DER LÜCKENVERMERK BLEIBT SICHTBAR — auch auf der entschiedenen Anweisung. ══════
        const vermerk = await seite.evaluate<string>(
          fn(
            '() => (document.querySelector(\'[data-testid="ga-lesestand-pruefanbindung"]\')?.textContent || "")',
          ),
        );
        expect(
          vermerk,
          "der Lückenvermerk „Prüfanbindung“ ist von der Fläche verschwunden — eine Entscheidung ersetzt ihn nicht",
        ).toContain("Prüfanbindung");
        expect(vermerk).toContain("noch nicht angebunden");
      } finally {
        await kontext.close();
      }

      // ══ DER NEUSTART — derselbe Bestand, neuer Prozesszustand, dieselbe Datenbank. ═══════════
      //
      // Weggeworfen wird JEDER prozessgebundene Zustand: Anwendung, Pool und alle Ablagen. Was den
      // Übergang übersteht, hat in PostgreSQL gestanden und nirgendwo sonst. Migriert wird dabei
      // wieder NUR über `migrate()` — wie beim echten Start.
      await strecke.schliessen();
      strecke = undefined;
      await pool.end();
      pool = createPool(zugang);
      await migrate(pool);
      strecke = await starteStrecke({ pool, ...mitFlaeche() });

      const nachNeustart = await profil(echterBrowser, { width: 1280, height: 900 });
      try {
        await anmelden(nachNeustart.seite, strecke.basis, ADMIN);
        await nachNeustart.seite.goto(`${strecke.basis}/gesamtanweisungen/${anweisungId}`, {
          waitUntil: "domcontentloaded",
        });
        await warte(
          nachNeustart.seite,
          `() => document.querySelectorAll('[data-testid="ga-lesestand-baustein"]').length === 2`,
          "die beiden Bausteine nach dem Neustart",
          undefined,
          45_000,
        );
        const folge = await nachNeustart.seite.evaluate<string[]>(fn(BAUSTEINFOLGE));
        expect(
          folge,
          "nach dem Neustart steht die Reihenfolge anders — sie lag also nicht in der Datenbank",
        ).toEqual(folgeNachOrdnen);
        const text = await nachNeustart.seite.evaluate<string>(fn(LIES_TEXT));
        expect(text, "der Titel ist nach dem Neustart weg").toContain(ANWEISUNGSTITEL);
        expect(text, "die Entscheidung ist nach dem Neustart weg").toContain("Entschieden");
        expect(
          text,
          "der Lückenvermerk überlebt den Neustart nicht — er wäre dann eine Anzeigelaune",
        ).toContain("Prüfanbindung");
      } finally {
        await nachNeustart.kontext.close();
      }

      // Und die festgehaltenen Prüfstände sind noch vollzählig — der Vergleich von oben bliebe
      // sonst nach jedem Neustart ohne Gegenstück.
      const staende = await pool.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM gesamtanweisung_staende WHERE anweisung_id = $1",
        [anweisungId],
      );
      expect(Number(staende.rows[0]?.n ?? "0")).toBeGreaterThanOrEqual(standNachVoraussetzung);
    } finally {
      try {
        await strecke?.schliessen();
      } finally {
        await pool.end();
      }
    }
  }, 900_000);

  // ==============================================================================================
  // A8z · DER ZEUGE — er läuft IMMER und sagt, was dieser Lauf wirklich belegt hat.
  // ==============================================================================================
  //
  // Er fasst weder Datenbank noch Browser an und kann deshalb nicht selbst übersprungen werden. Ein
  // Lauf ohne Datenbank endet damit zwar weiterhin nicht rot (das wäre eine Betriebsentscheidung,
  // nicht die dieses Auftrags) — aber er sagt es, und er sagt ausdrücklich, dass er nichts belegt.
  it("A8z — der Laufzustand ist entschieden, und ein Skip zählt nicht als bestanden", () => {
    process.stderr.write(befundsatz(MARKE, laufzustand));
    expect(
      laufzustand,
      "kein Laufzustand — beforeAll lief nicht durch, und dann sagt der Exitcode dieses Laufs nichts über die Sache",
    ).toBeDefined();
    if (!zaehltAlsBestanden(laufzustand)) {
      // KEIN `expect(...).toBe(true)` hier: der Grund steht auf stderr und in der Rückgabe, und
      // die Betriebsentscheidung „ohne Datenbank ist das Tor rot" ist nicht die dieses Auftrags.
      // Was hier zählt: der Zustand ist BENANNT und wird nirgends als bestanden geführt.
      expect((laufzustand as { gelaufen: false; grund: string }).grund.length).toBeGreaterThan(0);
      return;
    }
    expect((laufzustand as { gelaufen: true; quelle: string }).quelle).toContain(db);
  });
});
