// ================================================================================================
// JOB 4352 · Q — DER SICHTBARE SPEICHERKNOPF AN DER ECHTEN OBERFLÄCHE, GEGEN ECHTES POSTGRESQL.
// ================================================================================================
//
// DAS ABNAHMEKRITERIUM, wörtlich (Auftrag §4): „Ein gemessener Lauf in echtem Chromium gegen echtes
// PostgreSQL belegt das erste Kriterium an der Oberfläche" — also: Datei geladen und NICHT
// ausgewertet, Speicherknopf gedrückt, der Entwurf trägt danach den Dateiinhalt (unabhängige Probe
// in `drafts`), und die Quittung nennt die Sicherung.
//
// DIE KETTE, DIE HIER STEHT:
//     PostgreSQL-Zeile `drafts` → `PgDraftRepo` → `POST /api/drafts` über einen ECHTEN Socket
//     → die GEBAUTE Fläche → Chromium (sichtbarer Dateiwähler, sichtbarer Speicherknopf, Quittung)
//     → und zurück in dieselbe Tabelle.
//
// DER ZUSTAND IST DER REINE FALL DES AUFTRAGS: die Importart bleibt auf ihrem Vorgabewert
// („Einzelne Erkenntnisse", `fileImportMode = "points"`, `Capture.tsx`), und die KI-Auswertung wird
// NICHT gestartet. Die Fläche trägt damit eine gelesene Datei ohne einen einzigen Fund — genau die
// Lage, in der der Knopf bis JOB 4352 grau dastand und, einmal erreichbar gemacht, nur den
// Formularstand geschrieben hätte. Der Ganzdokument-Knopf der Importart „Ganzes Dokument" kommt
// hier bewusst NICHT vor: gemessen wird der andere, der allgemeine.
//
// ARBEITSTEILUNG gegenüber `speicherknopf-ganzdokument-mounted.test.tsx` daneben: DORT stehen die
// vier Zustände (mit/ohne Funde, mit/ohne Datei) an Attrappen, DOM-frei von Netz und Datenbank.
// HIER steht EIN Weg, dafür durch jede echte Grenze — Browser, Socket, Fastify, PostgreSQL. Keine
// Zeile verdoppelt die dortige Ebene; keine dortige Zeile sieht eine Datenbank.
//
// PRÜFGRENZE, LAUT GEMELDET: Ohne echte PostgreSQL wird der Grund SICHTBAR auf stderr gemeldet und
// übersprungen (Lehre 12.09., JOB 3668). Ein stiller Skip sähe aus wie ein bestandener Lauf.
// KEINE PRODUKTIVDATEN: ausschliesslich eine Wegwerf-Datenbank mit `test` im Namen, am Ende
// entfernt — und zwar erst NACH `warteAufVerbindungsende` (JOB 4265).
//
// „SICHTBAR" HEISST SICHTBAR (REGELN.md 9): jede Behauptung über etwas, das ein Mensch LIEST, geht
// durch `sichtbarZugesichert` — der Ableser sitzt auf dem texttragenden Nachkommen, und jede
// einzelne Behauptung kalibriert sich durch gezieltes Ausblenden GENAU dieses Trägers. Kein
// `textContent`.
//
// WERKZEUGE: Strecke, Browserweg, Bedienschritte des Dateiwegs und die Sichtbarkeits-Zusicherung
// werden IMPORTIERT (`gast-nutzerweg/`, `d3-dateien-durchgaengig/`, `ux19-speichern-oeffnen-reload/`,
// `import-wiederoeffnen-nutzerweg/strecke.ts`) und nicht abgeschrieben. Neu ist hier nur, was es
// noch nicht gibt: der Warteschritt auf eine GELESENE, aber nicht ausgewertete Datei und der Zugriff
// auf genau den allgemeinen Speicherknopf.
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_FILE_TEXT } from "../../apps/web/src/lib/captureFromFile";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { dateiUeberSichtbareAuswahl, satz } from "../d3-dateien-durchgaengig/d3-buehne";
import { QUELLSATZ } from "../demo-erster-nutzerweg/strecke";
import { fn } from "../design/h3-blatt-buehne";
import type { Kontext, Seite } from "../gast-nutzerweg/browserweg";
import {
  mitFlaeche,
  profil,
  starteChromium,
  tippeMitTastatur,
  warte,
} from "../gast-nutzerweg/browserweg";
import { PASSWORT, type Strecke, ersteinrichtung, starteStrecke } from "../gast-nutzerweg/strecke";
import {
  type Verbindungszeile,
  alsBefund,
  warteAufVerbindungsende,
} from "../gast-nutzerweg/verbindungsende";
import {
  type BrowserMitVersion,
  DATEI_NAME,
  SICHTBARE_QUITTUNGEN,
  type SeiteMitDialogUndRoute,
  type Verbindung,
  aufZustandWarten,
  entwurfszahl,
  entwurfszeile,
  pgUrl,
  pgVersion,
  quellAnlage,
  sichtbarZugesichert,
  stelleFlaecheBereit,
  zerlege,
} from "../import-wiederoeffnen-nutzerweg/strecke";
import {
  FALL_RAHMEN_MS,
  KLICK_KNOPF,
  type Weiche,
  dateiwegOeffnen,
  kennungAusOeffnenLink,
  wartebudget,
} from "../ux19-speichern-oeffnen-reload/ux19-buehne";

const JOB = "[KLARWERK] JOB 4352";

/** Das Konto dieser Strecke — eine leere Instanz, ein Betreiber, eine Wegwerf-Adresse. */
const KONTO = "speicherknopf@job4352.test";
/** Das Fenster: dasselbe Maß, unter dem die D3-Ketten den Dateiweg abgenommen haben (1280×800). */
const FENSTER = { width: 1280, height: 800 };
const BLATT = '[data-testid="blatt"]';

/** Der Selektor steht auf der Seite. */
const SELEKTOR_DA = "(sel) => document.querySelector(sel) !== null";

/**
 * Steht ein BETÄTIGBARER Knopf mit GENAU dieser Beschriftung auf der Seite?
 *
 * EXAKT und nicht als Teilstück: die Ganzdokument-Karte trägt auf derselben Fläche den Knopf
 * „Ganzes Dokument als Entwurf speichern" (`CAPTURE_FILE_TEXT.wholeCta`), und dieser Fall misst
 * gerade den UNTERSCHIED zwischen beiden. „Betätigbar" heisst: nicht `disabled`, nicht
 * `aria-disabled`, und im Layout vorhanden — ein grauer Knopf ist für einen Menschen kein Weg.
 */
const KNOPF_BETAETIGBAR = `(text) => {
  const alle = [...document.querySelectorAll('button')];
  return alle.some((b) =>
    (b.textContent || '').replace(/\\s+/g, ' ').trim() === text
    && !b.disabled
    && b.getAttribute('aria-disabled') !== 'true'
    && b.offsetParent !== null);
}`;

/** Klickt GENAU diesen Knopf. `false`, wenn er nicht da oder nicht betätigbar ist. */
const KLICK_KNOPF_EXAKT = `(text) => {
  const alle = [...document.querySelectorAll('button')];
  const k = alle.find((b) =>
    (b.textContent || '').replace(/\\s+/g, ' ').trim() === text
    && !b.disabled
    && b.getAttribute('aria-disabled') !== 'true'
    && b.offsetParent !== null);
  if (!k) { return false; }
  k.click();
  return true;
}`;

/** Alle Knopfbeschriftungen der Seite — für eine Meldung, die nennt, was WIRKLICH dastand. */
const KNOPFTEXTE = `() => [...document.querySelectorAll('button')].map(
  (b) => ((b.textContent || '').replace(/\\s+/g, ' ').trim()) + (b.disabled ? ' [grau]' : ''),
)`;

// ------------------------------------------------------------------------------------------------
// Der geteilte Aufbau.
// ------------------------------------------------------------------------------------------------

let adminPool: Pool | undefined;
let verbindung: Verbindung | undefined;
let verfuegbar = false;
let browser: BrowserMitVersion | undefined;
let flaeche = "nicht hergestellt";
let pool: Pool | undefined;
let strecke: Strecke | undefined;
let kontext: Kontext | undefined;
const wegwerfDb = `klarwerk_speicherknopf_test_${`${Date.now()}`.slice(-9)}`;

/** Eine Voraussetzung aus dem Aufbau — fehlt sie, scheitert der Fall LAUT. */
function brauche<T>(wert: T | undefined, was: string): T {
  if (wert === undefined) {
    throw new Error(
      `${JOB}: ${was} fehlt — der Aufbau ist nicht bis dahin gekommen. Dieser Fall ist damit NICHT gemessen (und nicht etwa bestanden).`,
    );
  }
  return wert;
}

/**
 * Anmeldung über die ECHTE Maske, ausschliesslich mit der Tastatur (kein gesetztes Token).
 *
 * LOKAL und nicht importiert: `browserweg.ts` hält seinen `anmelden`-Helfer dateiprivat
 * (`browserweg.ts:450`), und die Datei wird von JOB 4322 gehalten. Benutzt werden ausschliesslich
 * die exportierten Bausteine `warte` und `tippeMitTastatur` — derselbe Tastaturweg, kein zweiter.
 * Vorbild: `import-wiederoeffnen-pg-im-browser.integration.test.ts:251`.
 */
async function anmelden(roh: Seite): Promise<void> {
  const basis = brauche(strecke, "die Messstrecke").basis;
  await roh.goto(`${basis}/`, { waitUntil: "domcontentloaded" });
  await warte(roh, `() => !!document.querySelector("#auth-email")`, "die Anmeldemaske steht");
  await tippeMitTastatur(roh, "#auth-email", KONTO, "E-Mail");
  await tippeMitTastatur(roh, "#auth-password", PASSWORT, "Passwort");
  await roh.keyboard.press("Enter");
  await warte(roh, `() => !document.querySelector("#auth-email")`, "die Anmeldung trägt");
}

// ------------------------------------------------------------------------------------------------
// R-0017 / R-0020 / R-0156 — Werkzeuge für Q2–Q5.
// ------------------------------------------------------------------------------------------------

const ALT_TITEL = "Zahlungsziel Neukunden";
const ALT_AUSSAGE = "Bei Neukunden gilt Vorkasse, bis die erste Rechnung beglichen ist.";
const TITEL_ZUSATZ = " geprüft";
const NEUER_TITEL = `${ALT_TITEL}${TITEL_ZUSATZ}`;

/** Die Playwright-Weiche mit `fetch` (Server ausführen lassen) und `postData`. */
interface Abrufweiche {
  request(): { method(): string; url(): string; postData(): string | null };
  fetch(): Promise<unknown>;
  abort(grund?: string): Promise<void>;
  fallback(): Promise<void>;
}

/** Steht in einem Eingabefeld GENAU dieser Wert? */
const FELDWERT_DA = `(w) => [...document.querySelectorAll('input,textarea')].some((e) => e.value === w)`;
/** Enthält ein Eingabefeld diesen Text? */
const FELDWERT_ENTHAELT = `(w) => [...document.querySelectorAll('input,textarea')].some((e) => e.value.includes(w))`;
/** Steht der Satz im gelesenen Text der Seite ODER in einem Feld? */
const TEXT_ODER_FELD = `(w) => (document.body.innerText || '').replace(/\\s+/g, ' ').includes(w)
  || [...document.querySelectorAll('input,textarea')].some((e) => e.value.includes(w))`;
/** Fokussiert das Feld mit GENAU diesem Wert und setzt die Einfügemarke ans Ende. */
const FELD_FOKUS_ENDE = `(w) => {
  const f = [...document.querySelectorAll('input,textarea')].find((e) => e.value === w);
  if (!f) { return false; }
  f.focus();
  f.setSelectionRange(f.value.length, f.value.length);
  return true;
}`;
/** Fokussiert das Feld, das diesen Text ENTHÄLT, und setzt die Einfügemarke ans Ende. */
const FELD_ENTHAELT_FOKUS_ENDE = `(w) => {
  const f = [...document.querySelectorAll('input,textarea')].find((e) => e.value.includes(w));
  if (!f) { return false; }
  f.focus();
  f.setSelectionRange(f.value.length, f.value.length);
  return true;
}`;
/**
 * Klickt den Knopf mit GENAU dieser Beschriftung — auch wenn er gerade grau ist. Ein grauer Knopf
 * im Browser nimmt den Klick nicht an; genau das ist der zweite Klick eines Menschen.
 */
const KNOPF_ECHT_KLICKEN = `(text) => {
  const k = [...document.querySelectorAll('button')].find(
    (b) => (b.textContent || '').replace(/\\s+/g, ' ').trim() === text);
  if (!k) { return false; }
  k.click();
  return true;
}`;

async function neueSeite(): Promise<SeiteMitDialogUndRoute> {
  return (await brauche(
    kontext,
    "die Sitzung aus dem Aufbau",
  ).newPage()) as unknown as SeiteMitDialogUndRoute;
}

/** Legt über die echte Route der angemeldeten Sitzung einen Entwurf an (Cookie der Seite). */
async function entwurfAnlegen(
  seite: SeiteMitDialogUndRoute,
  titel: string,
  aussage: string,
): Promise<string> {
  const id = await seite.evaluate<string>(
    fn(`async ([t, s]) => {
      const r = await fetch('/api/drafts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: t, statement: s, origin: 'expert' }),
      });
      return (await r.json()).id;
    }`),
    [titel, aussage],
  );
  if (typeof id !== "string" || id.length === 0) {
    throw new Error(`${JOB}: der Ausgangsentwurf liess sich nicht anlegen.`);
  }
  return id;
}

/** Wählt über „Datei ▾" einen Weg der Erfassung (`erfassen.weg.*`). */
async function wegWaehlen(seite: SeiteMitDialogUndRoute, schluessel: string): Promise<void> {
  await seite.evaluate<boolean>(fn(KLICK_KNOPF), satz("erfassen.werkzeug.datei"));
  expect(
    await seite.evaluate<boolean>(fn(KLICK_KNOPF), satz(schluessel)),
    `der Weg «${satz(schluessel)}» liess sich nicht wählen`,
  ).toBe(true);
}

/** Die Datei ist gelesen: der Auswertungsknopf steht. */
async function aufEingelesen(seite: SeiteMitDialogUndRoute): Promise<void> {
  const auswerten = satz(CAPTURE_FILE_TEXT.searchCta);
  await aufZustandWarten(
    seite,
    `(text) => [...document.querySelectorAll('button')].some(
      (b) => (b.textContent || '').replace(/\\s+/g, ' ').trim() === text)`,
    `die Datei ist eingelesen (der Auswertungsknopf «${auswerten}» steht)`,
    auswerten,
  );
}

/** Die Speicherquittung der Datei steht. */
async function aufQuittung(seite: SeiteMitDialogUndRoute): Promise<void> {
  const quelle = satz(CAPTURE_FILE_TEXT.wholeSavedSource, { name: DATEI_NAME });
  await aufZustandWarten(
    seite,
    `(s) => (document.body.innerText || '').replace(/\\s+/g, ' ').includes(s)`,
    `die Speicherquittung «${quelle}» steht auf der Fläche`,
    quelle,
  );
}

/** Die Kennungen aller Zeilen in `drafts`, die den Satz der realen DOCX tragen. */
async function kennungenMitQuellsatz(db: Pool): Promise<string[]> {
  const antwort = await db.query<{ id: string }>(
    "SELECT id FROM drafts WHERE data::text LIKE $1 ORDER BY id",
    [`%${QUELLSATZ}%`],
  );
  return antwort.rows.map((z) => z.id);
}

/**
 * LAUF 6 (bens B6): DER SICHTBARE ABSCHLUSS DES GEMEINSAMEN SPEICHERWEGS. Formular UND Datei sind
 * gesichert, erst dann wechselt das Blatt zum Formularentwurf: der Arbeitsraum ist abgebaut, und der
 * Titel des Blattes trägt den gespeicherten Titel. Die Quittung der Datei steht dann NICHT mehr da —
 * sie gehört zum Arbeitsraum, und auf sie zu warten war der Fehler von Q2 in Lauf 5.
 */
async function aufBlattMitTitel(seite: SeiteMitDialogUndRoute, titel: string): Promise<void> {
  await aufZustandWarten(
    seite,
    `(t) => !document.querySelector('[data-testid="blatt-arbeitsraum"]')
      && document.querySelector('[data-testid="blatt-titel"]')?.value === t`,
    `das Blatt steht wieder, ohne Arbeitsraum, mit dem Titel «${titel}»`,
    titel,
  );
}

/** Steht der Arbeitsraum (Formular-/Dateiweg) noch auf der Seite? */
const ARBEITSRAUM_DA = `() => document.querySelector('[data-testid="blatt-arbeitsraum"]') !== null`;

/** Wie viele Zeilen in `drafts` tragen den Satz der realen DOCX? */
async function zeilenMitQuellsatz(db: Pool): Promise<number> {
  const antwort = await db.query<{ anzahl: string }>(
    "SELECT count(*)::text AS anzahl FROM drafts WHERE data::text LIKE $1",
    [`%${QUELLSATZ}%`],
  );
  return Number.parseInt(antwort.rows[0]?.anzahl ?? "0", 10);
}

async function warteBisAsync(bedingung: () => Promise<boolean>, was: string): Promise<void> {
  const ende = Date.now() + wartebudget("aufFlaechensatzWarten");
  while (!(await bedingung())) {
    if (Date.now() > ende) {
      throw new Error(`${JOB}: Zeitüberschreitung — ${was}`);
    }
    await new Promise((auf) => setTimeout(auf, 50));
  }
}

async function warteBis(bedingung: () => boolean, was: string): Promise<void> {
  const ende = Date.now() + wartebudget("aufFlaechensatzWarten");
  while (!bedingung()) {
    if (Date.now() > ende) {
      throw new Error(`${JOB}: Zeitüberschreitung — ${was}`);
    }
    await new Promise((auf) => setTimeout(auf, 50));
  }
}

describe("JOB 4352 Q · der sichtbare Speicherknopf im Browser, gegen echtes PostgreSQL", () => {
  beforeAll(async () => {
    const url = guardedLocalPgTestUrl();
    if (!url) {
      process.stderr.write(
        `${JOB} Q UEBERSPRUNGEN: keine gesicherte KLARWERK_PG_TEST_URL — die Kette aus Browser, echtem Socket und echter PostgreSQL ist damit nicht messbar. Der Torlauf (./tools/check) hat bewusst keine Datenbank (vitest.config.ts:33).\n`,
      );
      return;
    }
    verbindung = zerlege(url);
    if (!verbindung) {
      process.stderr.write(
        `${JOB} Q UEBERSPRUNGEN: KLARWERK_PG_TEST_URL nennt keinen Rechnernamen.\n`,
      );
      return;
    }
    await i18n.changeLanguage("de");
    adminPool = new Pool({ connectionString: url });
    await adminPool.query("SELECT 1");
    await adminPool.query(`CREATE DATABASE ${wegwerfDb}`);
    flaeche = stelleFlaecheBereit();
    browser = (await starteChromium()) as BrowserMitVersion;

    pool = createPool(pgUrl(verbindung, wegwerfDb));
    await migrate(pool);
    strecke = await starteStrecke({ pool, ...mitFlaeche() });
    await ersteinrichtung(strecke, KONTO);

    const p = await profil(browser, FENSTER);
    kontext = p.kontext;
    await anmelden(p.seite);
    await (p.seite as unknown as SeiteMitDialogUndRoute).close({ runBeforeUnload: false });

    process.stderr.write(
      `${JOB} BELEG · Chromium ${browser.version()} · Socket-Port ${new URL(strecke.basis).port} · PostgreSQL „${await pgVersion(pool)}" · Datei ${DATEI_NAME} · dist ${flaeche}\n`,
    );
    verfuegbar = true;
  }, 900_000);

  afterAll(async () => {
    await kontext?.close().catch(() => undefined);
    await browser?.close();
    await strecke?.schliessen().catch(() => undefined);
    await pool?.end().catch(() => undefined);
    // Erst der Nachweis, dann der DROP — dieselbe Begründung und derselbe eine Weg dorthin wie in
    // `gastweg-pg-im-browser.integration.test.ts:149-167` (JOB 4265).
    let rest: Verbindungszeile[] = [];
    if (adminPool) {
      const befund = await warteAufVerbindungsende(adminPool, wegwerfDb);
      rest = befund.rest;
      await adminPool
        .query(`DROP DATABASE IF EXISTS ${wegwerfDb} WITH (FORCE)`)
        .catch(() => undefined);
      await adminPool.end();
    }
    expect(
      rest,
      `beim DROP DATABASE hingen noch Verbindungen an ${wegwerfDb} — genau auf sie schiesst WITH (FORCE):\n  ${alsBefund(rest)}`,
    ).toEqual([]);
  }, 120_000);

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // Q1 · Datei geladen, NICHT ausgewertet, „Als Entwurf speichern" gedrückt.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it(
    "Q1 — reale sample.docx laden, NICHT auswerten, den allgemeinen Speicherknopf drücken: die Quittung nennt die Sicherung, und die Zeile in `drafts` trägt den Dateiinhalt",
    async (ctx) => {
      if (!verfuegbar) {
        ctx.skip();
        return;
      }
      const db = brauche(pool, "der Verbindungspool");
      const basis = brauche(strecke, "die Messstrecke").basis;
      const seite = (await brauche(
        kontext,
        "die Sitzung aus dem Aufbau",
      ).newPage()) as unknown as SeiteMitDialogUndRoute;
      try {
        await seite.goto(`${basis}/erfassen`, {
          waitUntil: "load",
          timeout: wartebudget("neuLadenAdresse"),
        });
        await aufZustandWarten(seite, SELEKTOR_DA, "das Blatt steht nach dem Laden", BLATT);

        // ---- Die Ausgangslage: LEER. Ohne diese Zeile könnte „eine Zeile in `drafts`" auch ---
        // ---- eine Zeile aus dem Aufbau sein. -------------------------------------------------
        expect(await entwurfszahl(db), "vor dem Fall steht schon ein Entwurf in `drafts`").toBe(0);

        await dateiwegOeffnen(seite);
        // Die Importart bleibt, wie sie ist: der Vorgabewert „Einzelne Erkenntnisse". Genau das ist
        // der Weg, auf dem eine gelesene Datei OHNE Auswertung stehen bleibt.
        await dateiUeberSichtbareAuswahl(seite, quellAnlage());

        // GELESEN heisst: die Fläche bietet die Auswertung an (der Block hängt an `fileText`,
        // `Capture.tsx`). AUSGEWERTET wird trotzdem nicht — der Knopf wird nie gedrückt.
        const auswerten = satz(CAPTURE_FILE_TEXT.searchCta);
        await aufZustandWarten(
          seite,
          `(text) => [...document.querySelectorAll('button')].some(
            (b) => (b.textContent || '').replace(/\\s+/g, ' ').trim() === text)`,
          `die Datei ist eingelesen (der Auswertungsknopf «${auswerten}» steht)`,
          auswerten,
        );

        // ---- DER KNOPF AUS DEM AUFTRAG: er muss überhaupt erst betätigbar sein. ---------------
        const speichern = satz("capture.saveDraft");
        expect(
          await seite.evaluate<boolean>(fn(KNOPF_BETAETIGBAR), speichern),
          `der allgemeine Speicherknopf «${speichern}» ist nicht betätigbar, obwohl eine gelesene Datei auf der Fläche liegt. Knöpfe der Seite: ${JSON.stringify(
            await seite.evaluate<string[]>(fn(KNOPFTEXTE)),
          )}`,
        ).toBe(true);

        expect(
          await seite.evaluate<boolean>(fn(KLICK_KNOPF_EXAKT), speichern),
          `«${speichern}» liess sich nicht drücken`,
        ).toBe(true);

        // ---- DIE QUITTUNG, SICHTBAR UND KALIBRIERT. ------------------------------------------
        const quelle = satz(CAPTURE_FILE_TEXT.wholeSavedSource, { name: DATEI_NAME });
        await aufZustandWarten(
          seite,
          `(s) => (document.body.innerText || '').replace(/\\s+/g, ' ').includes(s)`,
          `die Speicherquittung «${quelle}» steht auf der Fläche`,
          quelle,
        );
        await sichtbarZugesichert(
          seite,
          quelle,
          "Speicherquittung „Quelle: <Datei>, gesamtes Dokument.“",
        );
        const quittungen = await seite.evaluate<string[]>(fn(SICHTBARE_QUITTUNGEN));
        expect(
          quittungen.join(" | "),
          "keine sichtbare Meldung nennt die gesicherte Datei beim Namen",
        ).toContain(satz(CAPTURE_FILE_TEXT.wholeSaved, { name: DATEI_NAME }));

        // ---- DIE UNABHÄNGIGE PROBE: nicht die Fläche, sondern die Zeile. ---------------------
        expect(
          await entwurfszahl(db),
          "nach dem Druck steht nicht genau EIN Entwurf in `drafts` — ein zweiter wäre der leere Eintrag des Formularwegs",
        ).toBe(1);
        const kennung = await kennungAusOeffnenLink(seite);
        if (kennung === null) {
          throw new Error(
            `${JOB} Q1: nach dem Speichern steht kein Öffnen-Link mit Entwurfskennung auf der Fläche.`,
          );
        }
        const zeile = await entwurfszeile(db, kennung);
        if (zeile === null) {
          throw new Error(`${JOB} Q1: es gibt keine drafts-Zeile mit der Kennung ${kennung}.`);
        }
        expect(zeile, "der Inhalt der realen DOCX steht nicht in der drafts-Zeile").toContain(
          QUELLSATZ,
        );
        expect(zeile, "die Herkunft (Dateiname) steht nicht in der drafts-Zeile").toContain(
          DATEI_NAME,
        );
        process.stderr.write(`${JOB} Q1 GRÜN · Entwurf ${kennung} · drafts-Zeilen 1\n`);
      } finally {
        await seite.close({ runBeforeUnload: false }).catch(() => undefined);
      }
    },
    FALL_RAHMEN_MS * 3,
  );

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // R-0017 / R-0020 / R-0156 (Auftrag aufnahme:20260922:erfassen-doppelklick, Runde 2).
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  //
  // Q2–Q5 ergänzen die reale Strecke um die Fälle, die Q1 nicht misst (bens B3): Formular UND Datei
  // mit Neuladen, angehaltener Upload mit zweitem Klick und verlorener Anlage-Antwort, Uploadfehler
  // mit AUSGEFÜHRTER Korrektur. Die Leitung wird dabei ausschliesslich über Playwright-Weichen
  // verstellt — der Server, die Route und PostgreSQL sind unverändert echt. Gezählt wird an den
  // Zeilen der Tabelle `drafts`, nicht an der Fläche.
  //
  // DIESE FÄLLE SIND IM BAU NICHT AUSGEFÜHRT WORDEN (keine Datenbank, kein Dienststart auf dem
  // Produktions-Mac). Sie laufen erst im Serverprüfschritt; bis dahin gilt: nicht gemessen.

  it(
    "Q2 — geöffneter Entwurf (Formular) plus reale sample.docx, ein Druck: beide Zeilen tragen ihre bekannten Inhalte und kommen nach dem Neuladen wieder",
    async (ctx) => {
      if (!verfuegbar) {
        ctx.skip();
        return;
      }
      const db = brauche(pool, "der Verbindungspool");
      const basis = brauche(strecke, "die Messstrecke").basis;
      const seite = await neueSeite();
      try {
        await seite.goto(`${basis}/erfassen`, {
          waitUntil: "load",
          timeout: wartebudget("neuLadenAdresse"),
        });
        await aufZustandWarten(seite, SELEKTOR_DA, "das Blatt steht nach dem Laden", BLATT);
        const vorher = await entwurfszahl(db);
        const vorherDatei = await zeilenMitQuellsatz(db);
        const id = await entwurfAnlegen(seite, ALT_TITEL, ALT_AUSSAGE);

        await seite.goto(`${basis}/erfassen?draft=${encodeURIComponent(id)}`, {
          waitUntil: "load",
          timeout: wartebudget("neuLadenAdresse"),
        });
        await aufZustandWarten(seite, SELEKTOR_DA, "das Blatt steht mit dem Entwurf", BLATT);
        await wegWaehlen(seite, "erfassen.weg.formular");
        await aufZustandWarten(
          seite,
          FELDWERT_DA,
          `das Formular trägt den Titel «${ALT_TITEL}»`,
          ALT_TITEL,
        );
        // Getippt, nicht gesetzt: Titelfeld fokussieren, ans Ende, Zusatz mit der Tastatur.
        expect(await seite.evaluate<boolean>(fn(FELD_FOKUS_ENDE), ALT_TITEL)).toBe(true);
        await seite.keyboard.type(TITEL_ZUSATZ);
        await aufZustandWarten(
          seite,
          FELDWERT_DA,
          "der geänderte Titel steht im Feld",
          NEUER_TITEL,
        );

        await dateiwegOeffnen(seite);
        await dateiUeberSichtbareAuswahl(seite, quellAnlage());
        await aufEingelesen(seite);

        const vorherDateiKennungen = await kennungenMitQuellsatz(db);
        const speichern = satz("capture.saveDraft");
        expect(
          await seite.evaluate<boolean>(fn(KLICK_KNOPF_EXAKT), speichern),
          `«${speichern}» liess sich nicht drücken`,
        ).toBe(true);
        // LAUF 6 (bens B6): der tatsächlich sichtbare Abschluss — das Blatt mit dem Formularentwurf.
        await aufBlattMitTitel(seite, NEUER_TITEL);

        // ---- Unabhängige Probe: eine Zeile mehr als vorher (die Datei), der Entwurf aktualisiert.
        // `vorher` zählt vor `entwurfAnlegen`, deshalb +2: der Ausgangsentwurf und die Datei.
        expect(await entwurfszahl(db), "nicht genau zwei neue Zeilen in `drafts`").toBe(vorher + 2);
        expect(await zeilenMitQuellsatz(db), "die Datei liegt nicht genau einmal vor").toBe(
          vorherDatei + 1,
        );
        const formularZeile = await entwurfszeile(db, id);
        expect(formularZeile, "der geänderte Titel steht nicht in der Zeile").toContain(
          NEUER_TITEL,
        );
        expect(formularZeile, "die bekannte Aussage fehlt in der Zeile").toContain(ALT_AUSSAGE);
        const neueDateiKennungen = (await kennungenMitQuellsatz(db)).filter(
          (k) => !vorherDateiKennungen.includes(k),
        );
        expect(neueDateiKennungen, "nicht genau eine neue Datei-Zeile").toHaveLength(1);
        const dateiKennung = neueDateiKennungen[0] as string;
        expect(dateiKennung, "die Datei ist in den Formularentwurf geschrieben").not.toBe(id);
        const dateiZeile = await entwurfszeile(db, dateiKennung);
        expect(dateiZeile).toContain(QUELLSATZ);
        expect(dateiZeile, "die Herkunft (Dateiname) fehlt in der Datei-Zeile").toContain(
          DATEI_NAME,
        );

        // ---- Neuladen: beide Entwürfe über die Adresse wieder öffnen. -------------------------
        await seite.reload({ waitUntil: "load", timeout: wartebudget("neuLadenAdresse") });
        for (const [kennung, erwartet] of [
          [dateiKennung, QUELLSATZ],
          [id, NEUER_TITEL],
        ] as const) {
          await seite.goto(`${basis}/erfassen?draft=${encodeURIComponent(kennung)}`, {
            waitUntil: "load",
            timeout: wartebudget("neuLadenAdresse"),
          });
          await aufZustandWarten(
            seite,
            TEXT_ODER_FELD,
            `nach dem Neuladen steht «${erwartet}» auf der Fläche`,
            erwartet,
          );
        }
        process.stderr.write(`${JOB} Q2 GRÜN · Entwurf ${id} · Datei ${dateiKennung}\n`);
      } finally {
        await seite.close({ runBeforeUnload: false }).catch(() => undefined);
      }
    },
    FALL_RAHMEN_MS * 3,
  );

  it(
    "Q3 — Upload angehalten, zweiter Klick, danach geht die Anlage-Antwort verloren: kein vorzeitiger Erfolg, und nach dem erneuten Druck liegt die Datei genau EINMAL in `drafts`",
    async (ctx) => {
      if (!verfuegbar) {
        ctx.skip();
        return;
      }
      const db = brauche(pool, "der Verbindungspool");
      const basis = brauche(strecke, "die Messstrecke").basis;
      const seite = await neueSeite();
      // `ersteAnlageStatus` wird ERST gesetzt, wenn der Server die erste Anlage beantwortet hat —
      // und `antwortVerworfen` erst nach dem Abbruch. Runde 2 wartete auf den Zähler `anlagen`, der
      // schon beim EINTRITT in die Weiche stieg (bens B3, Runde 3): die Bestandsprüfung danach
      // konnte vor dem Schreiben laufen.
      const leitung = {
        uploads: 0,
        anlagen: 0,
        schluessel: [] as string[],
        ersteAnlageStatus: 0,
        antwortVerworfen: false,
      };
      let riegel: () => void = () => undefined;
      const tor = new Promise<void>((auf) => {
        riegel = auf;
      });
      try {
        await seite.route(`${basis}/api/objects`, async (route) => {
          const r = route as unknown as Abrufweiche;
          if (r.request().method() !== "POST") {
            await r.fallback();
            return;
          }
          leitung.uploads += 1;
          await tor;
          await r.fallback();
        });
        await seite.route(`${basis}/api/drafts`, async (route) => {
          const r = route as unknown as Abrufweiche;
          if (r.request().method() !== "POST") {
            await r.fallback();
            return;
          }
          leitung.anlagen += 1;
          const rumpf = JSON.parse(r.request().postData() ?? "{}") as { operationId?: string };
          leitung.schluessel.push(String(rumpf.operationId));
          if (leitung.anlagen === 1) {
            // DER ANTWORTVERLUST: der Server legt an, die Antwort erreicht die Seite nie.
            const antwort = (await r.fetch()) as { status(): number };
            leitung.ersteAnlageStatus = antwort.status();
            await r.abort("failed");
            leitung.antwortVerworfen = true;
            return;
          }
          await r.fallback();
        });
        await seite.goto(`${basis}/erfassen`, {
          waitUntil: "load",
          timeout: wartebudget("neuLadenAdresse"),
        });
        await aufZustandWarten(seite, SELEKTOR_DA, "das Blatt steht nach dem Laden", BLATT);
        const vorherDatei = await zeilenMitQuellsatz(db);
        await dateiwegOeffnen(seite);
        await dateiUeberSichtbareAuswahl(seite, quellAnlage());
        await aufEingelesen(seite);

        const speichern = satz("capture.saveDraft");
        expect(await seite.evaluate<boolean>(fn(KLICK_KNOPF_EXAKT), speichern)).toBe(true);
        await warteBis(() => leitung.uploads === 1, "der Upload hängt an der Weiche");
        // Der zweite Klick auf denselben Knopf, solange der Upload hängt.
        await seite.evaluate<boolean>(fn(KNOPF_ECHT_KLICKEN), speichern);
        await new Promise((auf) => setTimeout(auf, 500));
        expect(leitung.uploads, "der zweite Klick hat einen zweiten Upload gestartet").toBe(1);
        expect(leitung.anlagen, "angelegt, bevor der Upload fertig war").toBe(0);
        expect(
          await seite.evaluate<boolean>(
            fn(TEXT_ODER_FELD),
            satz(CAPTURE_FILE_TEXT.wholeSaved, { name: DATEI_NAME }),
          ),
          "Erfolg gemeldet, obwohl der Upload noch hängt",
        ).toBe(false);

        riegel();
        await warteBis(
          () => leitung.antwortVerworfen,
          "die erste Anlage ist vom Server beantwortet und ihre Antwort verworfen",
        );
        expect(leitung.ersteAnlageStatus, "die erste Anlage ist am Server nicht gelungen").toBe(
          201,
        );
        await warteBisAsync(
          async () => (await zeilenMitQuellsatz(db)) === vorherDatei + 1,
          "die erste Anlage liegt als Zeile in `drafts`",
        );
        // Antwort verloren: der Knopf ist wieder frei, und der Mensch drückt noch einmal.
        await aufZustandWarten(seite, KNOPF_BETAETIGBAR, "der Knopf ist wieder frei", speichern);
        expect(
          await seite.evaluate<boolean>(
            fn(TEXT_ODER_FELD),
            satz(CAPTURE_FILE_TEXT.wholeSaved, { name: DATEI_NAME }),
          ),
          "Erfolg gemeldet, obwohl die Antwort verloren ging",
        ).toBe(false);
        expect(await seite.evaluate<boolean>(fn(KLICK_KNOPF_EXAKT), speichern)).toBe(true);
        await aufQuittung(seite);

        expect(leitung.anlagen).toBe(2);
        expect(leitung.schluessel[0], "die Anlage trägt keinen Wiederholschlüssel").toMatch(
          /^create-/,
        );
        expect(leitung.schluessel[1], "die Wiederholung trägt einen anderen Schlüssel").toBe(
          leitung.schluessel[0],
        );
        expect(leitung.uploads, "das Original wurde erneut hochgeladen").toBe(1);
        expect(await zeilenMitQuellsatz(db), "die Datei liegt doppelt in `drafts`").toBe(
          vorherDatei + 1,
        );
        process.stderr.write(`${JOB} Q3 GRÜN · Anlagen 2 · Zeilen +1 · Uploads 1\n`);
      } finally {
        riegel();
        await seite.close({ runBeforeUnload: false }).catch(() => undefined);
      }
    },
    FALL_RAHMEN_MS * 3,
  );

  it(
    "Q4 — Upload scheitert (500): der Volltext ist gesichert, der Grund steht da, und die Korrektur (Entwurf öffnen, Aussage ergänzen, speichern) aktualisiert DIESELBE Zeile",
    async (ctx) => {
      if (!verfuegbar) {
        ctx.skip();
        return;
      }
      const db = brauche(pool, "der Verbindungspool");
      const basis = brauche(strecke, "die Messstrecke").basis;
      const seite = await neueSeite();
      try {
        let gescheitert = false;
        await seite.route(`${basis}/api/objects`, async (route) => {
          const r = route as unknown as Weiche;
          if (r.request().method() !== "POST" || gescheitert) {
            await r.fallback();
            return;
          }
          gescheitert = true;
          await r.fulfill({
            status: 500,
            body: JSON.stringify({ error: "Q4_TESTFEHLER", message: "Speicher nicht erreichbar" }),
            headers: { "content-type": "application/json" },
          });
        });
        await seite.goto(`${basis}/erfassen`, {
          waitUntil: "load",
          timeout: wartebudget("neuLadenAdresse"),
        });
        await aufZustandWarten(seite, SELEKTOR_DA, "das Blatt steht nach dem Laden", BLATT);
        const vorher = await entwurfszahl(db);
        await dateiwegOeffnen(seite);
        await dateiUeberSichtbareAuswahl(seite, quellAnlage());
        await aufEingelesen(seite);
        expect(
          await seite.evaluate<boolean>(fn(KLICK_KNOPF_EXAKT), satz("capture.saveDraft")),
        ).toBe(true);
        const grund = satz("capture.originalAttachFailed", { name: DATEI_NAME });
        await aufZustandWarten(seite, TEXT_ODER_FELD, `der Grund «${grund}» steht da`, grund);
        expect(await entwurfszahl(db), "nicht genau EINE neue Zeile").toBe(vorher + 1);
        const kennung = await kennungAusOeffnenLink(seite);
        if (kennung === null) {
          throw new Error(`${JOB} Q4: kein Öffnen-Link mit Entwurfskennung nach dem Speichern.`);
        }
        expect(await entwurfszeile(db, kennung), "der Volltext ist nicht gesichert").toContain(
          QUELLSATZ,
        );

        // ---- Die Korrektur, ausgeführt. ------------------------------------------------------
        await seite.goto(`${basis}/erfassen?draft=${encodeURIComponent(kennung)}`, {
          waitUntil: "load",
          timeout: wartebudget("neuLadenAdresse"),
        });
        await aufZustandWarten(seite, SELEKTOR_DA, "das Blatt steht mit dem Entwurf", BLATT);
        await wegWaehlen(seite, "erfassen.weg.formular");
        await aufZustandWarten(
          seite,
          FELDWERT_ENTHAELT,
          "die Aussage trägt den Volltext",
          QUELLSATZ,
        );
        expect(await seite.evaluate<boolean>(fn(FELD_ENTHAELT_FOKUS_ENDE), QUELLSATZ)).toBe(true);
        await seite.keyboard.type(TITEL_ZUSATZ);
        expect(
          await seite.evaluate<boolean>(fn(KLICK_KNOPF_EXAKT), satz("capture.saveDraft")),
        ).toBe(true);
        await aufZustandWarten(
          seite,
          TEXT_ODER_FELD,
          "die Aktualisierung ist quittiert",
          satz("capture.draftUpdated"),
        );
        expect(await entwurfszahl(db), "die Korrektur legte eine zweite Zeile an").toBe(vorher + 1);
        expect(
          await entwurfszeile(db, kennung),
          "die Korrektur steht nicht in DERSELBEN Zeile",
        ).toContain(TITEL_ZUSATZ.trim());
        process.stderr.write(`${JOB} Q4 GRÜN · Entwurf ${kennung} korrigiert\n`);
      } finally {
        await seite.close({ runBeforeUnload: false }).catch(() => undefined);
      }
    },
    FALL_RAHMEN_MS * 3,
  );

  it(
    "Q5 — Upload scheitert (500) UND die Anlage-Antwort geht verloren; der zweite Druck ohne Änderung nimmt denselben Vorgang wieder auf: genau EINE Zeile in `drafts`",
    async (ctx) => {
      if (!verfuegbar) {
        ctx.skip();
        return;
      }
      const db = brauche(pool, "der Verbindungspool");
      const basis = brauche(strecke, "die Messstrecke").basis;
      const seite = await neueSeite();
      const leitung = {
        uploads: 0,
        anlagen: 0,
        schluessel: [] as string[],
        rumpfe: [] as string[],
        ersteAnlageStatus: 0,
        antwortVerworfen: false,
      };
      try {
        await seite.route(`${basis}/api/objects`, async (route) => {
          const r = route as unknown as Weiche;
          if (r.request().method() !== "POST") {
            await r.fallback();
            return;
          }
          leitung.uploads += 1;
          if (leitung.uploads > 1) {
            await r.fallback();
            return;
          }
          await r.fulfill({
            status: 500,
            body: JSON.stringify({ error: "Q5_TESTFEHLER", message: "Speicher nicht erreichbar" }),
            headers: { "content-type": "application/json" },
          });
        });
        await seite.route(`${basis}/api/drafts`, async (route) => {
          const r = route as unknown as Abrufweiche;
          if (r.request().method() !== "POST") {
            await r.fallback();
            return;
          }
          leitung.anlagen += 1;
          const roh = r.request().postData() ?? "{}";
          leitung.rumpfe.push(roh);
          leitung.schluessel.push(
            String((JSON.parse(roh) as { operationId?: string }).operationId),
          );
          if (leitung.anlagen === 1) {
            const antwort = (await r.fetch()) as { status(): number };
            leitung.ersteAnlageStatus = antwort.status();
            await r.abort("failed");
            leitung.antwortVerworfen = true;
            return;
          }
          await r.fallback();
        });
        await seite.goto(`${basis}/erfassen`, {
          waitUntil: "load",
          timeout: wartebudget("neuLadenAdresse"),
        });
        await aufZustandWarten(seite, SELEKTOR_DA, "das Blatt steht nach dem Laden", BLATT);
        const vorherDatei = await zeilenMitQuellsatz(db);
        await dateiwegOeffnen(seite);
        await dateiUeberSichtbareAuswahl(seite, quellAnlage());
        await aufEingelesen(seite);

        const speichern = satz("capture.saveDraft");
        expect(await seite.evaluate<boolean>(fn(KLICK_KNOPF_EXAKT), speichern)).toBe(true);
        await warteBis(
          () => leitung.antwortVerworfen,
          "die erste Anlage ist vom Server beantwortet und ihre Antwort verworfen",
        );
        expect(leitung.ersteAnlageStatus, "die erste Anlage ist am Server nicht gelungen").toBe(
          201,
        );
        await warteBisAsync(
          async () => (await zeilenMitQuellsatz(db)) === vorherDatei + 1,
          "die erste Anlage liegt als Zeile in `drafts`",
        );
        await aufZustandWarten(seite, KNOPF_BETAETIGBAR, "der Knopf ist wieder frei", speichern);

        // Der zweite Druck — der Mensch hat NICHTS geändert.
        expect(await seite.evaluate<boolean>(fn(KLICK_KNOPF_EXAKT), speichern)).toBe(true);
        await aufQuittung(seite);

        expect(leitung.anlagen).toBe(2);
        expect(leitung.schluessel[1], "die Wiederholung trägt einen anderen Schlüssel").toBe(
          leitung.schluessel[0],
        );
        expect(leitung.rumpfe[1], "die Wiederholung schickt eine andere Nutzlast").toBe(
          leitung.rumpfe[0],
        );
        expect(leitung.uploads, "die Wiederholung hat erneut hochgeladen").toBe(1);
        expect(await zeilenMitQuellsatz(db), "Doppelbestand ohne Änderung des Menschen").toBe(
          vorherDatei + 1,
        );
        const grund = satz("capture.originalAttachFailed", { name: DATEI_NAME });
        await aufZustandWarten(seite, TEXT_ODER_FELD, `der Grund «${grund}» steht da`, grund);
        process.stderr.write(`${JOB} Q5 GRÜN · Anlagen 2 · Zeilen +1 · Uploads 1\n`);
      } finally {
        await seite.close({ runBeforeUnload: false }).catch(() => undefined);
      }
    },
    FALL_RAHMEN_MS * 3,
  );
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // Q6 · LAUF 6 (bens B5) — Formular UND Datei, Upload angehalten, zweiter Klick, danach scheitern
  // Upload und Datei-Anlage. Die Datei bleibt auf der Fläche, der erneute Druck sichert genau sie.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  //
  // Bis Lauf 5 wechselte das Blatt schon nach dem Formular-Anteil und baute den Arbeitsraum samt
  // Datei ab; scheiterte der Datei-Anteil danach, war die Datei fort. Gemessen wird hier an der
  // echten Seite, am echten Server und an den Zeilen der Tabelle `drafts`.
  it(
    "Q6 — Formular plus reale sample.docx, Upload angehalten und zweiter Klick, dann scheitern Upload und Datei-Anlage: die Datei bleibt korrigierbar auf der Fläche, der erneute Druck legt sie genau EINMAL an",
    async (ctx) => {
      if (!verfuegbar) {
        ctx.skip();
        return;
      }
      const db = brauche(pool, "der Verbindungspool");
      const basis = brauche(strecke, "die Messstrecke").basis;
      const seite = await neueSeite();
      const leitung = { uploads: 0, anlagen: 0 };
      let riegel: () => void = () => undefined;
      const tor = new Promise<void>((auf) => {
        riegel = auf;
      });
      try {
        await seite.route(`${basis}/api/objects`, async (route) => {
          const r = route as unknown as Weiche;
          if (r.request().method() !== "POST") {
            await r.fallback();
            return;
          }
          leitung.uploads += 1;
          if (leitung.uploads > 1) {
            await r.fallback();
            return;
          }
          await tor;
          await r.fulfill({
            status: 500,
            body: JSON.stringify({ error: "Q6_TESTFEHLER", message: "Speicher nicht erreichbar" }),
            headers: { "content-type": "application/json" },
          });
        });
        await seite.route(`${basis}/api/drafts`, async (route) => {
          const r = route as unknown as Weiche;
          if (r.request().method() !== "POST") {
            await r.fallback();
            return;
          }
          leitung.anlagen += 1;
          // Der Ausgangsentwurf entsteht über `entwurfAnlegen` mit derselben Route; er zählt als
          // erste Anlage und geht unverändert durch. Die ZWEITE ist die Datei — sie wird abgelehnt.
          if (leitung.anlagen === 2) {
            await r.fulfill({
              status: 500,
              body: JSON.stringify({ error: "Q6_TESTFEHLER", message: "Anlage abgelehnt" }),
              headers: { "content-type": "application/json" },
            });
            return;
          }
          await r.fallback();
        });
        await seite.goto(`${basis}/erfassen`, {
          waitUntil: "load",
          timeout: wartebudget("neuLadenAdresse"),
        });
        await aufZustandWarten(seite, SELEKTOR_DA, "das Blatt steht nach dem Laden", BLATT);
        const vorher = await entwurfszahl(db);
        const vorherDatei = await zeilenMitQuellsatz(db);
        const id = await entwurfAnlegen(seite, ALT_TITEL, ALT_AUSSAGE);
        expect(leitung.anlagen, "der Ausgangsentwurf lief nicht über die Route").toBe(1);

        await seite.goto(`${basis}/erfassen?draft=${encodeURIComponent(id)}`, {
          waitUntil: "load",
          timeout: wartebudget("neuLadenAdresse"),
        });
        await aufZustandWarten(seite, SELEKTOR_DA, "das Blatt steht mit dem Entwurf", BLATT);
        await wegWaehlen(seite, "erfassen.weg.formular");
        await aufZustandWarten(
          seite,
          FELDWERT_DA,
          `das Formular trägt den Titel «${ALT_TITEL}»`,
          ALT_TITEL,
        );
        expect(await seite.evaluate<boolean>(fn(FELD_FOKUS_ENDE), ALT_TITEL)).toBe(true);
        await seite.keyboard.type(TITEL_ZUSATZ);
        await aufZustandWarten(
          seite,
          FELDWERT_DA,
          "der geänderte Titel steht im Feld",
          NEUER_TITEL,
        );
        await dateiwegOeffnen(seite);
        await dateiUeberSichtbareAuswahl(seite, quellAnlage());
        await aufEingelesen(seite);

        const speichern = satz("capture.saveDraft");
        expect(await seite.evaluate<boolean>(fn(KLICK_KNOPF_EXAKT), speichern)).toBe(true);
        await warteBis(() => leitung.uploads === 1, "der Upload hängt an der Weiche");
        // Der Formular-Anteil ist geschrieben, bevor der Upload beginnt.
        await warteBisAsync(
          async () => ((await entwurfszeile(db, id)) ?? "").includes(NEUER_TITEL),
          "der geänderte Titel liegt in der drafts-Zeile des Entwurfs",
        );
        // Der zweite Klick, solange der Upload hängt.
        await seite.evaluate<boolean>(fn(KNOPF_ECHT_KLICKEN), speichern);
        await new Promise((auf) => setTimeout(auf, 500));
        expect(leitung.uploads, "der zweite Klick hat einen zweiten Upload gestartet").toBe(1);
        expect(leitung.anlagen, "angelegt, bevor der Upload fertig war").toBe(1);
        expect(
          await seite.evaluate<boolean>(fn(ARBEITSRAUM_DA)),
          "der Arbeitsraum ist abgebaut, obwohl die Datei noch nicht gesichert ist",
        ).toBe(true);

        riegel();
        await warteBis(() => leitung.anlagen === 2, "die Datei-Anlage wurde versucht");
        await aufZustandWarten(seite, KNOPF_BETAETIGBAR, "der Knopf ist wieder frei", speichern);
        expect(
          await seite.evaluate<boolean>(fn(ARBEITSRAUM_DA)),
          "nach dem gescheiterten Datei-Anteil ist der Arbeitsraum abgebaut",
        ).toBe(true);
        expect(
          await seite.evaluate<boolean>(fn(TEXT_ODER_FELD), DATEI_NAME),
          "die Datei steht nach dem Fehler nicht mehr auf der Fläche",
        ).toBe(true);
        expect(
          await seite.evaluate<boolean>(
            fn(TEXT_ODER_FELD),
            satz(CAPTURE_FILE_TEXT.wholeSaved, { name: DATEI_NAME }),
          ),
          "Erfolg gemeldet, obwohl die Datei-Anlage abgelehnt wurde",
        ).toBe(false);
        expect(await zeilenMitQuellsatz(db), "trotz Ablehnung liegt die Datei in `drafts`").toBe(
          vorherDatei,
        );

        // Der erneute Druck — derselbe Knopf, dieselbe Datei.
        expect(await seite.evaluate<boolean>(fn(KLICK_KNOPF_EXAKT), speichern)).toBe(true);
        await aufBlattMitTitel(seite, NEUER_TITEL);
        expect(await zeilenMitQuellsatz(db), "die Datei liegt nicht genau einmal vor").toBe(
          vorherDatei + 1,
        );
        expect(await entwurfszahl(db), "nicht genau zwei neue Zeilen in `drafts`").toBe(vorher + 2);
        expect(await entwurfszeile(db, id), "der Formularentwurf verlor seinen Titel").toContain(
          NEUER_TITEL,
        );
        process.stderr.write(
          `${JOB} Q6 GRÜN · Entwurf ${id} · Uploads ${leitung.uploads} · Anlagen ${leitung.anlagen} · Datei-Zeilen +1\n`,
        );
      } finally {
        riegel();
        await seite.close({ runBeforeUnload: false }).catch(() => undefined);
      }
    },
    FALL_RAHMEN_MS * 3,
  );
});
