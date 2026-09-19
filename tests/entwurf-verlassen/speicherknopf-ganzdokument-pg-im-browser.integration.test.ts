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
});
