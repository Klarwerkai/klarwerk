// ================================================================================================
// JOB 4324 · P — IMPORT → VERLASSEN MIT QUITTUNG → NEUE SITZUNG → WIEDERÖFFNEN, GEGEN ECHTES PG.
// ================================================================================================
//
// DIE LÜCKE, GEGEN DIE DIESE DATEI STEHT, hat der Prüfer selbst benannt (`archiv/4231/runde-2/
// ben.md:22`, Prüfpunkt 3): „Echter Arbeitsraum und Toast werden gemountet; Inhalt und
// Originalverweis werden im ATTRAPPIERTEN Bestand geprüft. Echte Persistenz und Wiederöffnen im
// Browser sind damit nicht bewiesen." `:28`: „NICHT GEPRÜFT: … Chromium-Dateiweg mit echter
// Persistenz und Wiederöffnen." Lieferung 9 des Auftrags 4231 blieb ausdrücklich offen.
//
// WAS ES HEUTE GIBT UND WARUM ES NICHT REICHT — beides am Basisstand gelesen:
//   · `tests/datei-verlassen-quittung/quittung-dateiwege-mounted.test.tsx:1` trägt
//     `// @vitest-environment jsdom` und prüft den Bestand über `nutzlastJeTitel(...)` und
//     `server.objekte` — ein Attrappen-Server, keine Datenbank, kein Browser.
//   · `tests/d3-dateien-durchgaengig/pdf-durchgaengig-chromium.test.ts` fährt Dateiauswahl,
//     Speichern und Neuladen wirklich in Chromium — aber auf der H3-Bühne, und die leitet JEDEN
//     `/api/`-Aufruf per `app.inject` in dieselbe App (`tests/design/h3-blatt-buehne.ts:273-300`):
//     kein Socket, keine Datenbank, keine zweite Sitzung, kein Verlassen-Weg, kein Fehlerfall.
//
// DIE KETTE, DIE HIER STEHT:
//     PostgreSQL-Zeile `drafts` → `PgDraftRepo` → `GET/POST /api/drafts` über einen ECHTEN Socket
//     → die GEBAUTE Fläche → Chromium (sichtbarer Dateiwähler, Wache, Toast, Blatt) → eine NEUE
//     Sitzung mit leerem Profil → und zurück in dieselbe Zeile.
//
// ================================================================================================
// RUNDE 2 · WARUM FÜNF FÄLLE UND NICHT EINER — BENs KORREKTURPFLICHT 1 ZUR RUNDE 1.
// ================================================================================================
//
// Runde 1 hatte alle Stationen in EINEM `it`. Zwei Dinge waren daran falsch, und BEN hat beide
// gemessen:
//
//  1. STATION (b) STAND AUF DEM KOPF. Der Verlassen-Weg scheitert am unveränderten Produkt (Grund
//     mit Datei:Zeile bei `P2` unten). Runde 1 hat daraus eine POSITIVE Soll-Erwartung gemacht:
//     sie verlangte die ABWESENHEIT des Speicherknopfs und war deshalb grün. BEN wörtlich: „Ein
//     ehrlich gemeldeter Produktfehler darf im Abnahmetest nicht zur positiven Soll-Erwartung
//     werden." Seine Sollprobe (Cloud-Lauf `677eb7cfe72bec9e1a42910c`) machte genau das sichtbar:
//     „Entwurf speichern und wechseln muss angeboten werden (Auftrag 5.2b): expected false to be
//     true". `P2` verlangt ab jetzt wieder DAS ZUGESAGTE — Speicherknopf, Quittung
//     `capture.leaveDraft.doneSaved`, neue Zeile K2 — und ist damit ROT, bis das Produkt repariert
//     ist. Repariert wird hier nichts (Auftrag §4: „Reparatur ist ein eigener Auftrag").
//
//  2. EIN ROTES (b) HÄTTE ALLES ANDERE MITGERISSEN. Steht alles in einem `it`, ist mit dem ersten
//     Fehlschlag auch (c), (d) und (e) ungemessen — der Prüfer könnte die belegten Teilstrecken
//     nicht einzeln abnehmen. Jede Station ist deshalb ein eigener Fall mit eigener Seite und
//     eigenen Nachweisen. `P4` und `P5` bauen sich sogar ihre EIGENE Sitzung auf und hängen nur
//     noch an der Kennung K1 aus `P1`; fehlt sie, scheitern sie LAUT (`brauche`), statt still zu
//     überspringen.
//
// PRÜFGRENZE, LAUT GEMELDET: Ohne echte PostgreSQL wird der Grund SICHTBAR auf stderr gemeldet und
// übersprungen (Lehre 12.09., JOB 3668). Ein stiller Skip sähe aus wie ein bestandener Lauf.
// KEINE PRODUKTIVDATEN: ausschliesslich eine Wegwerf-Datenbank mit `test` im Namen, am Ende
// entfernt — und zwar erst NACH `warteAufVerbindungsende` (JOB 4265).
//
// „SICHTBAR" HEISST SICHTBAR (REGELN.md 9): jede Behauptung über etwas, das ein Mensch LIEST, geht
// durch `sichtbarZugesichert` — Ableser auf dem texttragenden Nachkommen, und jede einzelne
// Behauptung kalibriert sich durch gezieltes Ausblenden GENAU dieses Trägers. Kein `textContent`.
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_FILE_TEXT } from "../../apps/web/src/lib/captureFromFile";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  aufEingelesenWarten,
  dateiUeberSichtbareAuswahl,
  quellenanzeige,
  satz,
} from "../d3-dateien-durchgaengig/d3-buehne";
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
import {
  PASSWORT,
  type Sitzung,
  type Strecke,
  ersteinrichtung,
  starteStrecke,
} from "../gast-nutzerweg/strecke";
import {
  type Verbindungszeile,
  alsBefund,
  warteAufVerbindungsende,
} from "../gast-nutzerweg/verbindungsende";
import {
  FALL_RAHMEN_MS,
  dateiwegOeffnen,
  flaechensatz,
  ganzdokumentWaehlen,
  kennungAusOeffnenLink,
  speichernDruecken,
  wartebudget,
} from "../ux19-speichern-oeffnen-reload/ux19-buehne";
import {
  type BrowserMitVersion,
  DATEI_NAME,
  JOB,
  LESEWEICHE_FEHLERSATZ,
  SELEKTOR_DA,
  SELEKTOR_WEG,
  SICHTBARE_QUITTUNGEN,
  type SeiteMitDialogUndRoute,
  type Verbindung,
  aufSichtbarkeitWarten,
  aufZustandWarten,
  ausblenden,
  einblenden,
  entwurfszahl,
  entwurfszeile,
  kalibrierungHerkunft,
  kalibrierungScharf,
  klickKnopf,
  leseweicheLegen,
  nichtSichtbarZugesichert,
  persistierteQuellenzeile,
  pgUrl,
  pgVersion,
  quellAnlage,
  sichtbarZugesichert,
  stelleFlaecheBereit,
  zerlege,
} from "./strecke";

/** Das Konto dieser Strecke — eine leere Instanz, ein Betreiber, eine Wegwerf-Adresse. */
const KONTO = "import-wiederoeffnen@job4324.test";
/** Das Fenster: dasselbe Maß, unter dem die D3-Ketten den Dateiweg abgenommen haben (1280×800). */
const FENSTER = { width: 1280, height: 800 };
/** Der Titel, den der vorbereitete Entwurf E2 trägt — er muss im Blatt ankommen. */
const E2_TITEL = "Entwurf";

const VERLASSEN_KNOPF = '[data-testid="capture-entwurf-verlassen"]';
const BLATT = '[data-testid="blatt"]';
const ENTWURF_OFFEN = '[data-testid="blatt-entwurf-offen"]';
/** Die Marke, mit der dieser Lauf das Titelfeld des Expertenformulars wiederfindet (s. unten). */
const TITELMARKE = '[data-kw4324="expertentitel"]';

/** Der Schalter der Gegenproben (Auftrag §5 Lieferung 3; beide Formen s. `strecke.ts`). */
const KALIBRIERUNG = kalibrierungScharf();

/** Der Titel im Blatt (`blatt-titel` ist ein Eingabefeld — sein `value` zählt, nicht sein Text). */
const BLATT_TITEL_WERT = `(w) => {
  const el = document.querySelector('[data-testid="blatt-titel"]');
  return !!el && 'value' in el && String(el.value) === w;
}`;

/** Der SICHTBARE Text der Schreibfläche — `innerText`, nicht `textContent` (REGELN.md 9). */
const BLATT_SICHTBARER_TEXT = `() => {
  const el = document.querySelector('[data-testid="blatt-text"]');
  return el ? (el.innerText || '').replace(/\\s+/g, ' ').trim() : '';
}`;

/** Steht ein Knopf mit diesem Text auf der Fläche? */
const KNOPF_DA = `(text) => [...document.querySelectorAll('button')].some(
  (b) => (b.textContent || '').replace(/\\s+/g, ' ').trim().includes(text),
)`;

/**
 * Ist die Entwurfsfläche wirklich aufgeklappt?
 *
 * GEFRAGT WIRD NACH DEM RÜCKWEG-EINTRAG („Zurück", `Blatt.tsx:2361`) und NICHT nach der Marke oder
 * einer der drei Lagen. Der Grund ist genau die Falle, gegen die diese ganze Prüfung steht: die
 * Marke fehlt bei fehlgeschlagenem Laden, und die drei Lagen (lädt/leer/gestört) fehlen bei einer
 * erfolgreich geladenen, nicht leeren Liste. Beides zusammen wäre also „nicht da" auch dann, wenn
 * die Fläche offensteht — und die Abwesenheitsprüfung darunter behauptete wieder etwas, das sie
 * nicht gemessen hat. Der Rückweg-Eintrag steht IMMER, sobald `mehrFlaeche !== null`.
 */
const ENTWURFSFLAECHE_OFFEN = `(zurueck) => [...document.querySelectorAll('button')].some(
  (b) => (b.textContent || '').replace(/\\s+/g, ' ').trim().indexOf(zurueck) !== -1,
)`;

/**
 * Markiert das Titelfeld des Expertenformulars (`Capture.tsx:6489-6492`, `<Field label={t(
 * "capture.fTitle")}><TextInput …/></Field>`, gerendert als `<label><span>…</span><input/></label>`,
 * `components/ui.tsx:186-193`).
 *
 * WARUM EINE MARKE UND KEIN SELEKTOR: das Feld trägt keine `data-testid`, und ein Selektor über die
 * Baumgestalt („das dritte `input` der Karte") wäre eine Zusicherung über das Layout statt über das
 * Feld. Gesucht wird deshalb genau das, was ein Mensch sucht — die Beschriftung —, und das Ergebnis
 * bekommt eine Marke, an der der Zeigerzugriff danach ansetzt. Gesetzt wird ein DATENATTRIBUT: es
 * ändert weder Stil noch Verhalten noch Zustand des Produkts.
 */
const TITELFELD_MARKIEREN = `(beschriftung) => {
  const labels = document.querySelectorAll('label');
  for (let i = 0; i < labels.length; i += 1) {
    const span = labels[i].querySelector(':scope > span');
    if (!span || (span.textContent || '').replace(/\\s+/g, ' ').trim() !== beschriftung) { continue; }
    const feld = labels[i].querySelector('input');
    if (!feld) { continue; }
    feld.setAttribute('data-kw4324', 'expertentitel');
    return true;
  }
  return false;
}`;

/** Der Wert des markierten Titelfeldes. */
const TITELFELD_WERT = `() => {
  const el = document.querySelector('[data-kw4324="expertentitel"]');
  return el ? String(el.value) : '(kein Feld)';
}`;

// ------------------------------------------------------------------------------------------------
// Der geteilte Aufbau. Was zwischen den Fällen weitergegeben wird, steht HIER und nirgends sonst.
// ------------------------------------------------------------------------------------------------

let adminPool: Pool | undefined;
let verbindung: Verbindung | undefined;
let verfuegbar = false;
let browser: BrowserMitVersion | undefined;
let flaeche = "nicht hergestellt";
let pool: Pool | undefined;
let strecke: Strecke | undefined;
let adminApi: Sitzung | undefined;
let kontextA: Kontext | undefined;
/** Jede Station, die sich eine eigene Sitzung baut, legt ihren Kontext hier ab — `afterAll` räumt. */
const eigeneKontexte: Kontext[] = [];
const wegwerfDb = `klarwerk_importwieder_test_${`${Date.now()}`.slice(-9)}`;

/** Was `P1` erarbeitet und die späteren Stationen brauchen. */
let k1: string | undefined;
let zeileK1NachA: string | undefined;
/** Der sichtbare Blattinhalt nach dem Neuladen (`P3`) — die Bezugsgrösse für `P4` und `P5`. */
let inhaltNachC: string | undefined;

/** Die Befunde der Gegenproben; `P6` macht den Kalibrierungslauf damit rot. */
const gegenproben: string[] = [];

/** Eine Voraussetzung aus einem früheren Fall — fehlt sie, scheitert der Fall LAUT. */
function brauche<T>(wert: T | undefined, was: string): T {
  if (wert === undefined) {
    throw new Error(
      `${JOB}: ${was} fehlt — der Fall, der es erarbeitet, ist nicht bis dahin gekommen. Dieser Fall ist damit NICHT gemessen (und nicht etwa bestanden).`,
    );
  }
  return wert;
}

/**
 * Anmeldung über die ECHTE Maske, ausschliesslich mit der Tastatur (kein gesetztes Token).
 *
 * LOKAL und nicht importiert: `browserweg.ts` hält seinen `anmelden`-Helfer dateiprivat
 * (`browserweg.ts:435`), und die Datei darf nicht angefasst werden (JOB 4322 hält sie). Benutzt
 * werden ausschliesslich die exportierten Bausteine `warte` und `tippeMitTastatur` — derselbe
 * Tastaturweg, kein zweiter.
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

/** Eine Adresse anfahren und warten, bis das Blatt steht. */
async function gehe(s: SeiteMitDialogUndRoute, pfad: string): Promise<void> {
  const basis = brauche(strecke, "die Messstrecke").basis;
  await s.goto(`${basis}${pfad}`, {
    waitUntil: "load",
    timeout: wartebudget("neuLadenAdresse"),
  });
  await aufZustandWarten(s, SELEKTOR_DA, `das Blatt steht nach dem Laden von ${pfad}`, BLATT);
}

/**
 * Eine FRISCHE Seite desselben Profils.
 *
 * Warum nicht dieselbe weiterfahren: der Dateiweg lässt eine geänderte Fläche zurück, und die hängt
 * an `useUnloadGuard` (`Capture.tsx:2985`). Ein `goto` liefe dann in einen `beforeunload`-Dialog,
 * den der Prüfstand entscheiden müsste — gemessen würde danach seine Entscheidung, nicht das
 * Produkt. Die Kekse bleiben: sie gehören dem Kontext, nicht der Seite.
 */
async function frischeSeite(kontext: Kontext): Promise<SeiteMitDialogUndRoute> {
  return (await kontext.newPage()) as unknown as SeiteMitDialogUndRoute;
}

/**
 * Zusichern, dass die Entwurfsfläche wirklich aufgeklappt ist.
 *
 * SIE WIRD ÜBER DIE ADRESSE GEÖFFNET (`?entwuerfe=1`, `Blatt.tsx:1795-1802`) und nicht über einen
 * Klick auf `blatt-werkzeug-entwuerfe`. Beides ruft DASSELBE `entwuerfeAufklappen`
 * (`Blatt.tsx:1773`); der Adressweg ist der, den der Zugang „Meine Entwürfe" der Startseite nimmt,
 * und er überlebt jedes `reload()` — der Fehlerfall braucht die Fläche nach drei Neuladungen.
 *
 * GEMESSEN, warum der Klickweg hier nicht taugt (Cloud-Lauf `1ae2f5febadc1304a456d7f0`): ein
 * Zeigerklick auf das Werkzeug öffnete die Fläche in diesem Lauf nicht — 30 016 ms vergeblich
 * gewartet. Ein Prüfstand, der an seinem eigenen Öffnungsweg hängt, misst den falschen Gegenstand;
 * der Adressweg ist derselbe Öffnungsweg ohne diese Unsicherheit. Dass die Fläche WIRKLICH offen
 * ist, wird trotzdem nicht geglaubt, sondern hier nachgemessen — sonst wäre die Abwesenheit der
 * Marke wieder nur die Abwesenheit der ganzen Fläche (BENs Prüflücke 6).
 */
async function entwurfsflaecheMussOffenSein(s: SeiteMitDialogUndRoute): Promise<void> {
  await aufZustandWarten(
    s,
    ENTWURFSFLAECHE_OFFEN,
    `die Entwurfsfläche ist aufgeklappt (der Rückweg-Eintrag «${satz("erfassen.mehr.zurueck")}» steht)`,
    satz("erfassen.mehr.zurueck"),
  );
}

/** Eine Gegenprobe: verstellen, die UNVERÄNDERTE Zusicherung laufen lassen, zurücknehmen, merken. */
async function gegenprobe(
  name: string,
  verstelle: () => Promise<void>,
  zuruecknehmen: () => Promise<void>,
  pruefe: () => Promise<void>,
): Promise<void> {
  if (!KALIBRIERUNG) {
    return;
  }
  await verstelle();
  let rot: string | null = null;
  try {
    await pruefe();
  } catch (e) {
    rot = String(e).split("\n").slice(0, 3).join(" · ");
  }
  await zuruecknehmen();
  gegenproben.push(
    rot === null
      ? `${name}: BLIEB GRÜN — die Zusicherung misst ihren Gegenstand nicht.`
      : `${name} → ROT: ${rot}`,
  );
}

describe("JOB 4324 P · der Import-Wiederöffnen-Nutzerweg im Browser, gegen echtes PostgreSQL", () => {
  beforeAll(async () => {
    const url = guardedLocalPgTestUrl();
    if (!url) {
      process.stderr.write(
        `${JOB} P UEBERSPRUNGEN: keine gesicherte KLARWERK_PG_TEST_URL — die Kette aus Browser, echtem Socket und echter PostgreSQL ist damit nicht messbar. Der Torlauf (./tools/check) hat bewusst keine Datenbank (vitest.config.ts:33).\n`,
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
    await i18n.changeLanguage("de");
    adminPool = new Pool({ connectionString: url });
    await adminPool.query("SELECT 1");
    await adminPool.query(`CREATE DATABASE ${wegwerfDb}`);
    flaeche = stelleFlaecheBereit();
    browser = (await starteChromium()) as BrowserMitVersion;

    pool = createPool(pgUrl(verbindung, wegwerfDb));
    await migrate(pool);
    strecke = await starteStrecke({ pool, ...mitFlaeche() });
    adminApi = (await ersteinrichtung(strecke, KONTO)).sitzung;

    const p = await profil(browser, FENSTER);
    kontextA = p.kontext;
    await anmelden(p.seite);
    await (p.seite as unknown as SeiteMitDialogUndRoute).close({ runBeforeUnload: false });

    process.stderr.write(
      `${JOB} BELEG · Chromium ${browser.version()} · Socket-Port ${new URL(strecke.basis).port} · PostgreSQL „${await pgVersion(pool)}" · Datei ${DATEI_NAME} · dist ${flaeche} · Gegenproben ${kalibrierungHerkunft()}\n`,
    );
    verfuegbar = true;
  }, 900_000);

  afterAll(async () => {
    for (const k of eigeneKontexte) {
      await k.close().catch(() => undefined);
    }
    await kontextA?.close().catch(() => undefined);
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
  // P1 · (a) IMPORT — reale DOCX über den SICHTBAREN Dateiwähler, und die Zeile in `drafts`.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it(
    "P1 (a) — reale sample.docx über den sichtbaren Dateiwähler importieren und speichern: die Fläche quittiert es, und die Zeile steht in `drafts`",
    async (ctx) => {
      if (!verfuegbar) {
        ctx.skip();
        return;
      }
      const db = brauche(pool, "der Verbindungspool");
      const seite = await frischeSeite(brauche(kontextA, "die Sitzung aus dem Aufbau"));
      try {
        await gehe(seite, "/erfassen");
        await dateiwegOeffnen(seite);
        await ganzdokumentWaehlen(seite);
        // Der SICHTBARE Knopf `capture-file-pick` und das `filechooser`-Ereignis — kein
        // `setInputFiles` am versteckten Eingang, kein `evaluate`-Klick (d3-buehne.ts:229-237).
        await dateiUeberSichtbareAuswahl(seite, quellAnlage());
        await aufEingelesenWarten(seite, DATEI_NAME);
        await sichtbarZugesichert(
          seite,
          satz(CAPTURE_FILE_TEXT.wholeSourceNote, { name: DATEI_NAME }),
          "Einlese-Quittung mit Dateiname",
        );

        expect(await speichernDruecken(seite), "der Speichern-Knopf war nicht betätigbar").toBe(
          true,
        );
        await aufSichtbarkeitWarten(
          seite,
          flaechensatz(CAPTURE_FILE_TEXT.wholeSavedTitle),
          "Erfolgskasten des Ganzdokument-Wegs",
        );
        await sichtbarZugesichert(
          seite,
          satz(CAPTURE_FILE_TEXT.wholeSavedSource, { name: DATEI_NAME }),
          "Speicherquittung „Quelle: <Datei>, gesamtes Dokument.“",
        );

        const kennung = await kennungAusOeffnenLink(seite);
        if (kennung === null) {
          throw new Error(
            `${JOB} (a): nach dem Speichern steht kein Öffnen-Link mit Entwurfskennung auf der Fläche.`,
          );
        }

        // Die unabhängige Probe: nicht die Fläche, sondern die Zeile.
        expect(
          await entwurfszahl(db),
          "nach dem Import steht nicht genau EIN Entwurf in `drafts`",
        ).toBe(1);
        const zeile = await entwurfszeile(db, kennung);
        if (zeile === null) {
          throw new Error(`${JOB} (a): es gibt keine drafts-Zeile mit der Kennung ${kennung}.`);
        }
        expect(zeile, "der Inhalt der realen DOCX steht nicht in der drafts-Zeile").toContain(
          QUELLSATZ,
        );
        expect(zeile, "die Herkunft (Dateiname) steht nicht in der drafts-Zeile").toContain(
          DATEI_NAME,
        );

        // Erst NACH allen Zusicherungen weitergeben — ein halb belegter Stand wäre für die
        // folgenden Fälle eine Voraussetzung, die niemand geprüft hat.
        k1 = kennung;
        zeileK1NachA = zeile;
        process.stderr.write(`${JOB} P1 (a) GRÜN · K1 ${kennung} · drafts-Zeilen 1\n`);
      } finally {
        await seite.close({ runBeforeUnload: false }).catch(() => undefined);
      }
    },
    FALL_RAHMEN_MS * 3,
  );

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // P2 · (b) VERLASSEN MIT QUITTUNG — LIEFERUNG 9 AUS JOB 4231. DER SOLLFALL.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  //
  // DIESER FALL VERLANGT DAS ZUGESAGTE UND WAR BIS JOB 4335 ROT. Das war Absicht (BENs
  // Korrekturpflicht 1 zur Runde 1) und das erwartete Ergebnis von JOB 4324 (§4: „Findet die Strecke
  // einen Produktfehler, wird er in der Rückgabe mit Datei und Zeile benannt und der Fall bleibt
  // rot"). Seine Erwartungen sind seither Zeichen für Zeichen dieselben; repariert wurde das
  // PRODUKT, nicht der Fall.
  //
  // WAS GEMESSEN WAR — nicht vermutet (Runde 1, Cloud-Lauf ca3e6cf2528dec2e180ecf3a: 30 009 ms
  // vergeblich gewartet; BENs eigene Sollprobe 677eb7cfe72bec9e1a42910c: „expected false to be
  // true"; JOB 4335 vor der Reparatur noch einmal: Lauf a2365ab83a0645cc83fb34f8). Die Kette des
  // Befunds, wie sie bis dahin lief:
  //
  //   `Capture.tsx:2914` `hasPendingFileImport = (Boolean(fileName) || fileText.trim().length > 0)
  //                       && !hasUnsavedFilePoints && !fileQueue`
  //   → `Capture.tsx:2957` legt daraus den Grund `capture.unsavable.file` in `unsavableDirtyReasons`
  //   → `Capture.tsx:3170` meldet ihn der Wache
  //   → `NavGuardContext.tsx:411-437` rendert daraufhin den Zweig OHNE „Entwurf speichern und
  //     wechseln": es gibt dort nur „Hier bleiben" und „Verwerfen und wechseln".
  //
  // `hasUnsavedFilePoints` (`Capture.tsx:2779`) ist NUR wahr, wenn eine Auswertung gelaufen ist und
  // Funde vorliegen; die geht über `POST /api/reasoner` mit `task: "extract"`
  // (`api/endpoints.ts:844-857`) und braucht ein echtes Modell. Der jsdom-Fall erreichte den
  // Speicherzweig deshalb nur mit attrappierter Auswertung — genau diese Lücke schliesst seit
  // JOB 4335 der Fall B1 in `quittung-dateiwege-mounted.test.tsx` (Auswertung ohne Funde).
  //
  // DER WIDERSPRUCH, der die Reparatur zu einem eigenen Auftrag machte: der Speicher-Rückruf der
  // Wache TRÄGT die Ganzdokument-Datei ausdrücklich (`Capture.tsx:3290`
  // `await fileWholeDraft.mutateAsync(dateiTraeger.eingabe)`, JOB 3770/4231), und `dateiTraeger`
  // entsteht auch ganz ohne Funde (`Capture.tsx:1171-1179`). Der Zweig KONNTE die Datei sichern —
  // `unsavableDirtyReasons` nahm der Wache nur die Möglichkeit, ihn anzubieten. JOB 4335 stellt
  // `hasPendingFileImport` deshalb auf denselben Begriff um (`ganzdokumentEingabe === null`).
  //
  // ── ZWEITER BEFUND, JOB 4335, GEMESSEN — WARUM DIESER FALL DANACH IMMER NOCH ROT IST ──────────
  //
  // Seit der Reparatur steht der Knopf da und ist betätigbar (Zeile unten grün). Was danach
  // geschieht, gehört einem ANDEREN Fehler, und er liegt tiefer: auf `/erfassen` melden ZWEI
  // Bauteile eine Wache an denselben EINEN Platz —
  //
  //   `Capture.tsx:3199` `setGuard({ … save: Eintrag + Ganzdokument + Punkte … })`
  //   `components/erfassen/Blatt.tsx:1526` `setGuard({ … save: die eigene Blatt-Mutation … })`
  //
  // `NavGuardContext.tsx` hält dafür genau EINEN Platz (`guardRef.current`, `:202`); beide Effekte
  // hängen an ihrer jeweiligen Mutation und laufen deshalb bei JEDEM Render ihres Bauteils neu. Wer
  // zuletzt gelaufen ist, gewinnt — und weil `Capture` im Baum UNTER `Blatt` hängt, gewinnt bei
  // jedem gemeinsamen Render das Blatt. Genau das tritt beim Öffnen des Dialogs ein.
  //
  // GEMESSEN (JOB 4335, Cloud-Lauf `1287ff58cd6080c8e332b91f`, Diagnose danach bytegleich
  // zurückgenommen): unmittelbar nach dem Klick auf „Entwurf speichern und wechseln" stehen die
  // Quittungen `["Entwurf gespeichert.", "Entwurf verlassen. Die Änderungen seit dem Öffnen sind
  // verworfen, der gespeicherte Entwurf ist unverändert."]`, die Zahl der `drafts`-Zeilen bleibt 2.
  // „Entwurf gespeichert." ist `fd.toastSaved` (`Blatt.tsx:1150`) — Capture meldet an einem offenen
  // Entwurf „Entwurf aktualisiert." (`Capture.tsx:2271`), und ein Anlegen hätte eine dritte Zeile
  // gemacht. Es hat also die Wache des BLATTS gespeichert: sie schreibt den Blattstand in E2, trägt
  // die Datei nicht, und die Quittung sagt danach wahrheitsgemäß „verworfen".
  //
  // DIESER FALL BLEIBT DESHALB ROT und wird NICHT abgeschwächt: er hält die Zusage fest, bis der
  // zweite Befund repariert ist (eigener Auftrag — er verlangt `NavGuardContext.tsx` bzw.
  // `Blatt.tsx`, beide ausserhalb der Zielpfade von JOB 4335).
  //
  // DIE MELDUNG BESCHREIBT, WAS STATTDESSEN DASTEHT. Ein „expected false to be true" ohne den
  // wirklich gerenderten Dialog liesse den nächsten Leser raten.
  it(
    "P2 (b) — Entwurf fortsetzen, Titel leeren, Datei laden, verlassen: die Wache bietet „Entwurf speichern und wechseln“, quittiert „gesichert“ und legt K2 an",
    async (ctx) => {
      if (!verfuegbar) {
        ctx.skip();
        return;
      }
      const db = brauche(pool, "der Verbindungspool");
      const api = brauche(adminApi, "die API-Sitzung des Betreibers");
      const kennungK1 = brauche(k1, "die Kennung K1 aus P1 (a)");
      const standK1 = brauche(zeileK1NachA, "der Stand von K1 nach P1 (a)");
      const seite = await frischeSeite(brauche(kontextA, "die Sitzung aus dem Aufbau"));
      try {
        // E2 wird über die echte Route vorbereitet und nicht über die Fläche: er ist die
        // AUSGANGSLAGE dieser Station, nicht ihr Gegenstand. Die Nutzlast ist genau die, die
        // `saveDraft` ohne Eingabe schreibt (`Capture.tsx:2205`, `:2222`): Titel, leere Aussage,
        // KEINE Vertraulichkeitsstufe.
        const antwort = await api.sende("POST", "/api/drafts", {
          title: E2_TITEL,
          statement: "",
          origin: "expert",
        });
        expect([200, 201], `E2 anlegen: ${antwort.status} ${antwort.text.slice(0, 400)}`).toContain(
          antwort.status,
        );
        const e2 = (antwort.json as { id: string }).id;
        const zeileE2Vorher = await entwurfszeile(db, e2);
        expect(zeileE2Vorher, "E2 steht nicht in der Datenbank").not.toBeNull();

        await gehe(seite, `/erfassen?draft=${encodeURIComponent(e2)}`);
        await aufZustandWarten(
          seite,
          BLATT_TITEL_WERT,
          `das Blatt trägt den Titel des fortgesetzten Entwurfs E2 («${E2_TITEL}»)`,
          E2_TITEL,
        );

        // Das Expertenformular über das Menü „Datei ▾" öffnen — derselbe Einstieg, den
        // `dateiwegOeffnen` für „Datei importieren" nimmt (`ux19-buehne.ts:865-873`).
        expect(
          await klickKnopf(seite, satz("erfassen.werkzeug.datei")),
          "das Menü „Datei ▾“ war nicht betätigbar",
        ).toBe(true);
        await aufZustandWarten(
          seite,
          KNOPF_DA,
          `der Menüeintrag «${satz("erfassen.weg.formular")}» steht`,
          satz("erfassen.weg.formular"),
        );
        expect(
          await klickKnopf(seite, satz("erfassen.weg.formular")),
          "der Weg „Formular (Experten)“ war nicht betätigbar",
        ).toBe(true);
        // Der Verlassen-Knopf steht NUR am geöffneten Entwurf (`Capture.tsx:4564`) — dass er
        // dasteht, ist damit der Beleg, dass die Adresse den Entwurf wirklich geöffnet hat.
        await aufZustandWarten(
          seite,
          SELEKTOR_DA,
          "der Verlassen-Knopf des geöffneten Entwurfs steht (der Entwurf ist im Arbeitsraum offen)",
          VERLASSEN_KNOPF,
        );

        // Den Titel leeren: ab hier hat der Eintrags-Zweig der Wache nichts mehr zu sichern
        // (`draftHasContent`, `Capture.tsx:2742-2748`) — E2 bleibt deshalb unberührt, und die
        // Quittung hängt ALLEIN am Dateizweig. Genau das war BENs vorgeführter Weg zu JOB 4231.
        expect(
          await seite.evaluate<boolean>(fn(TITELFELD_MARKIEREN), satz("capture.fTitle")),
          `das Titelfeld des Expertenformulars («${satz("capture.fTitle")}») war nicht auffindbar`,
        ).toBe(true);
        await seite.fill(TITELMARKE, "");
        expect(
          await seite.evaluate<string>(fn(TITELFELD_WERT)),
          "das Titelfeld des Expertenformulars ist nach dem Leeren nicht leer",
        ).toBe("");

        await dateiwegOeffnen(seite);
        await ganzdokumentWaehlen(seite);
        await dateiUeberSichtbareAuswahl(seite, quellAnlage());
        await aufEingelesenWarten(seite, DATEI_NAME);

        await aufZustandWarten(
          seite,
          SELEKTOR_DA,
          "der Verlassen-Knopf steht auch im Dateiweg",
          VERLASSEN_KNOPF,
        );
        await seite.click(VERLASSEN_KNOPF, { timeout: wartebudget("zeigerklick") });

        // Der Dialog der Wache steht — welcher Zweig, entscheidet das Produkt.
        await aufSichtbarkeitWarten(
          seite,
          satz("nav.guard.stay"),
          "Dialog der Wache (Knopf „Hier bleiben“)",
        );

        // ── DIE ZUSAGE DES AUFTRAGS (§5 Lieferung 2b). Diese Zeile ist seit JOB 4335 grün; der
        //    Fall bleibt danach an der Quittung rot (zweiter Befund, oben ausgeschrieben). ─────
        const wacheSpeichern = satz("nav.guard.save");
        const stattdessen = [
          `Titel «${satz("nav.guard.unsavableTitle")}» ${
            (await seite.evaluate<boolean>(fn(KNOPF_DA), satz("nav.guard.unsavableTitle")))
              ? "steht"
              : "steht nicht"
          }`,
          `Grund «${satz("capture.unsavable.file", { name: DATEI_NAME })}»`,
          `Wege «${satz("nav.guard.stay")}» und «${satz("nav.guard.discard")}»`,
          `sichtbare Quittungen ${JSON.stringify(await seite.evaluate<string[]>(fn(SICHTBARE_QUITTUNGEN)))}`,
        ].join(" · ");
        expect(
          await seite.evaluate<boolean>(fn(KNOPF_DA), wacheSpeichern),
          `PRODUKTBEFUND (b): die Wache bietet «${wacheSpeichern}» NICHT an — der Weg aus Auftrag §5 Lieferung 2(b) ist damit versperrt und die Quittung «${satz("capture.leaveDraft.doneSaved")}» unerreichbar. Was stattdessen dasteht: ${stattdessen}. Ursache im Produkt: Capture.tsx:2914 (hasPendingFileImport) → Capture.tsx:2957 (capture.unsavable.file) → Capture.tsx:3170 → NavGuardContext.tsx:411-437`,
        ).toBe(true);

        expect(
          await klickKnopf(seite, wacheSpeichern),
          `«${wacheSpeichern}» war im Dialog der Wache nicht betätigbar`,
        ).toBe(true);

        // Die Quittung: SICHTBAR, und sie sagt „gesichert" — nicht „verworfen". Der Toast steht
        // 4 000 ms (`ToastContext.tsx:28`); deshalb wird er sofort gelesen und sofort kalibriert.
        const gespeichert = satz("capture.leaveDraft.doneSaved");
        const verworfen = satz("capture.leaveDraft.done");
        await aufSichtbarkeitWarten(seite, gespeichert, "Quittung des Verlassen-Wegs");
        const quittungen = (await seite.evaluate<string[]>(fn(SICHTBARE_QUITTUNGEN))).join(" | ");
        expect(quittungen, "die sichtbare Quittung nennt nicht den Speicher-Satz").toContain(
          gespeichert,
        );
        expect(
          quittungen,
          "die Quittung behauptet „verworfen“, obwohl gespeichert wurde",
        ).not.toContain(verworfen);
        await sichtbarZugesichert(
          seite,
          gespeichert,
          "Quittung „… sind im gespeicherten Entwurf gesichert.“",
        );

        // Die Datenbank: eine NEUE Zeile K2 mit Datei und Inhalt, E2 und K1 unverändert.
        expect(
          await entwurfszahl(db),
          "nach dem Verlassen stehen nicht genau drei Entwürfe (K1, E2, K2) in `drafts`",
        ).toBe(3);
        expect(
          await entwurfszeile(db, e2),
          "der gespeicherte Entwurf E2 wurde beim Verlassen verändert — genau das darf der Dateizweig nicht tun",
        ).toBe(zeileE2Vorher);
        expect(
          await entwurfszeile(db, kennungK1),
          "die Zeile K1 hat sich beim Verlassen verändert",
        ).toBe(standK1);
        const uebrige = await db.query<{ id: string; data: unknown }>(
          "SELECT id, data FROM drafts WHERE id <> $1 AND id <> $2",
          [kennungK1, e2],
        );
        expect(
          uebrige.rows.length,
          "das Verlassen hat keinen (oder mehr als einen) neuen Entwurf angelegt",
        ).toBe(1);
        const k2 = JSON.stringify(uebrige.rows[0]?.data);
        expect(k2, "der beim Verlassen gesicherte Entwurf trägt den Dateiinhalt nicht").toContain(
          QUELLSATZ,
        );
        expect(k2, "der beim Verlassen gesicherte Entwurf trägt die Herkunft nicht").toContain(
          DATEI_NAME,
        );
      } finally {
        await seite.close({ runBeforeUnload: false }).catch(() => undefined);
      }
    },
    FALL_RAHMEN_MS * 3,
  );

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // P3 · (c) NEULADEN — was nach `reload()` dasteht, liegt in PostgreSQL und nicht im Formular.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it(
    "P3 (c) — den gespeicherten Entwurf öffnen und neu laden: Inhalt und Herkunft stehen sichtbar wieder da",
    async (ctx) => {
      if (!verfuegbar) {
        ctx.skip();
        return;
      }
      const kennung = brauche(k1, "die Kennung K1 aus P1 (a)");
      const seite = await frischeSeite(brauche(kontextA, "die Sitzung aus dem Aufbau"));
      try {
        const quellenzeile = persistierteQuellenzeile(DATEI_NAME);
        await gehe(seite, `/erfassen?draft=${encodeURIComponent(kennung)}`);
        await aufSichtbarkeitWarten(seite, QUELLSATZ, "Inhalt aus der realen DOCX");
        await seite.reload({ waitUntil: "load", timeout: wartebudget("neuLadenAdresse") });
        await aufZustandWarten(seite, SELEKTOR_DA, "das Blatt steht nach dem Neuladen", BLATT);
        await aufSichtbarkeitWarten(seite, QUELLSATZ, "Inhalt nach dem Neuladen");
        await sichtbarZugesichert(seite, QUELLSATZ, "Inhalt aus sample.docx nach dem Neuladen");
        await sichtbarZugesichert(
          seite,
          quellenzeile,
          "Quellenanzeige (Herkunft) nach dem Neuladen",
        );
        expect(
          await quellenanzeige(seite),
          "die Quellenanzeige nennt den Dateinamen nicht",
        ).toContain(DATEI_NAME);
        const gelesen = await seite.evaluate<string>(fn(BLATT_SICHTBARER_TEXT));
        expect(gelesen, "die Schreibfläche ist nach dem Neuladen leer").toContain(QUELLSATZ);
        inhaltNachC = gelesen;

        // Gegenprobe (i): den texttragenden Nachkommen der Quellenanzeige ausblenden → (c) rot.
        await gegenprobe(
          "(i) Quellenanzeige per display:none ausgeblendet",
          async () => {
            await ausblenden(seite, quellenzeile, "display");
          },
          async () => {
            await einblenden(seite);
          },
          async () => {
            await sichtbarZugesichert(
              seite,
              quellenzeile,
              "Quellenanzeige (Herkunft) nach dem Neuladen",
            );
          },
        );
        process.stderr.write(`${JOB} P3 (c) GRÜN · K1 ${kennung}\n`);
      } finally {
        await seite.close({ runBeforeUnload: false }).catch(() => undefined);
      }
    },
    FALL_RAHMEN_MS * 3,
  );

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // P4 · (d) NEUE SITZUNG — leeres Profil, echte Anmeldung, derselbe Bestand.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it(
    "P4 (d) — neues leeres Browserprofil, erneut anmelden: Inhalt, Herkunft und Dateiname sind dieselben wie vorher, und die Zeile ist unverändert",
    async (ctx) => {
      if (!verfuegbar) {
        ctx.skip();
        return;
      }
      const db = brauche(pool, "der Verbindungspool");
      const kennung = brauche(k1, "die Kennung K1 aus P1 (a)");
      const vorher = brauche(inhaltNachC, "der sichtbare Blattinhalt aus P3 (c)");
      const neu = await profil(brauche(browser, "der Browser"), FENSTER);
      eigeneKontexte.push(neu.kontext);
      const seite = neu.seite as unknown as SeiteMitDialogUndRoute;
      // DAS PROFIL IST WIRKLICH LEER — sonst wäre „neue Sitzung" nur behauptet.
      expect(
        (await neu.kontext.cookies()).length,
        "das frische Profil bringt schon Kekse mit — dann ist es keine neue Sitzung",
      ).toBe(0);
      await anmelden(neu.seite);
      await gehe(seite, `/erfassen?draft=${encodeURIComponent(kennung)}`);
      await aufSichtbarkeitWarten(seite, QUELLSATZ, "Inhalt in der neuen Sitzung");
      await sichtbarZugesichert(seite, QUELLSATZ, "Inhalt aus sample.docx in der neuen Sitzung");
      await sichtbarZugesichert(
        seite,
        persistierteQuellenzeile(DATEI_NAME),
        "Quellenanzeige (Herkunft) in der neuen Sitzung",
      );
      expect(
        await seite.evaluate<string>(fn(BLATT_SICHTBARER_TEXT)),
        "der sichtbare Inhalt der neuen Sitzung weicht von dem nach (c) ab",
      ).toBe(vorher);
      expect(
        await quellenanzeige(seite),
        "die Quellenanzeige der neuen Sitzung nennt den Dateinamen nicht",
      ).toContain(DATEI_NAME);
      expect(
        await entwurfszeile(db, kennung),
        "die Zeile K1 hat sich zwischen (a) und der neuen Sitzung verändert",
      ).toBe(brauche(zeileK1NachA, "der Stand von K1 nach P1 (a)"));
      process.stderr.write(`${JOB} P4 (d) GRÜN · K1 ${kennung}\n`);
    },
    FALL_RAHMEN_MS * 3,
  );

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // P5 · (e) FEHLERFALL DER WIEDERHERSTELLUNG — am Netz erzeugt, nicht im Produkt.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  //
  // RUNDE 2, BENs PRÜFLÜCKE 6: „kein aktiver Entwurf" war in Runde 1 durch die blosse ABWESENHEIT
  // von `blatt-entwurf-offen` nicht bewiesen — die Marke rendert nur in der aufgeklappten
  // Entwurfsfläche (`Blatt.tsx:2365-2380`) und fehlt deshalb auch bei geladenem Entwurf, solange
  // sie zu ist. Ab jetzt wird sie GEÖFFNET und ZUERST POSITIV nachgewiesen (e0): bei erfolgreich
  // geladenem K1 steht die Marke sichtbar da. Erst danach zählt ihr Fehlen als Aussage.
  it(
    "P5 (e) — antwortet der Server beim Wiederöffnen mit einem Fehler, sieht der Mensch den Fehlersatz, es ist kein Entwurf offen, und die Zeile ist danach Byte für Byte dieselbe",
    async (ctx) => {
      if (!verfuegbar) {
        ctx.skip();
        return;
      }
      const db = brauche(pool, "der Verbindungspool");
      const basis = brauche(strecke, "die Messstrecke").basis;
      const kennung = brauche(k1, "die Kennung K1 aus P1 (a)");
      const standK1 = brauche(zeileK1NachA, "der Stand von K1 nach P1 (a)");
      const neu = await profil(brauche(browser, "der Browser"), FENSTER);
      eigeneKontexte.push(neu.kontext);
      const seite = neu.seite as unknown as SeiteMitDialogUndRoute;
      // Die Adresse trägt BEIDE Befehle: den fortzusetzenden Entwurf und den Auftrag, die
      // Entwurfsfläche aufzuklappen (`?entwuerfe=1`, `Blatt.tsx:1795-1802`). So steht die Marke
      // `blatt-entwurf-offen` nach JEDEM Neuladen zur Prüfung bereit, ohne einen zweiten Handgriff.
      const adresse = `/erfassen?draft=${encodeURIComponent(kennung)}&entwuerfe=1`;
      const ladefehler = satz("fd.errLoadFailed");

      await anmelden(neu.seite);

      // ── e0: die POSITIVE Kalibrierung der Abwesenheitsprüfung (BENs Prüflücke 6). ──────────
      await gehe(seite, adresse);
      await aufSichtbarkeitWarten(seite, QUELLSATZ, "Inhalt des geladenen Entwurfs");
      await entwurfsflaecheMussOffenSein(seite);
      expect(
        await seite.evaluate<boolean>(fn(SELEKTOR_DA), ENTWURF_OFFEN),
        "am ERFOLGREICH geladenen Entwurf fehlt die Marke „Entwurf geöffnet“ — dann sagt ihr Fehlen im Fehlerfall gar nichts",
      ).toBe(true);
      await sichtbarZugesichert(seite, satz("fd.draftOpen"), "Marke „Vordertür-Entwurf geöffnet“");
      const zeilenVorher = await entwurfszahl(db);

      const weiche = await leseweicheLegen(seite, basis, kennung);

      // ── e1: der Server antwortet 500 im Fehlerschema aus `services/app/src/http.ts:130`.
      //
      // WAS HIER SICHTBAR WIRD, und warum es NICHT `fd.errLoadFailed` ist: `Blatt.tsx:219-224`
      // (`ladeFehlerMeldung`) gibt den Rückfallsatz NUR beim clientseitigen Abbruch
      // (`code === "TIMEOUT" && status === 408`) zurück; bei jeder anderen `ApiError` gewinnt die
      // SERVERMELDUNG (`api/client.ts:37-43`). Der Auftrag erwartet an dieser Stelle beide Male
      // `fd.errLoadFailed`; gemessen ist das Gegenteil, und es ist kein Produktfehler, sondern die
      // ausdrückliche Regel des Hauses („die Servermeldung gewinnt", JOB 2705). Gemessen wird
      // deshalb, was WIRKLICH dasteht — s. ABWEICHUNGEN in der Rückgabe.
      weiche.setze("fehler");
      await seite.reload({ waitUntil: "load", timeout: wartebudget("neuLadenAdresse") });
      await aufZustandWarten(seite, SELEKTOR_DA, "das Blatt steht auch nach dem Fehlschlag", BLATT);
      await aufSichtbarkeitWarten(
        seite,
        LESEWEICHE_FEHLERSATZ,
        "Fehlersatz der Wiederherstellung (500)",
      );
      await sichtbarZugesichert(
        seite,
        LESEWEICHE_FEHLERSATZ,
        "Fehlersatz der Wiederherstellung (500)",
        "visibility",
      );
      await nichtSichtbarZugesichert(seite, QUELLSATZ, "Inhalt nach dem Fehlschlag (500)");
      await entwurfsflaecheMussOffenSein(seite);
      expect(
        await seite.evaluate<boolean>(fn(SELEKTOR_WEG), ENTWURF_OFFEN),
        "die Marke „Entwurf geöffnet“ steht in der AUFGEKLAPPTEN Entwurfsfläche, obwohl nichts geladen wurde",
      ).toBe(true);
      expect(
        await entwurfszeile(db, kennung),
        "die Zeile K1 hat sich durch den gescheiterten Ladeversuch (500) verändert",
      ).toBe(standK1);
      expect(
        weiche.zaehler.angekommen,
        "die Leseweiche hat keinen GET gesehen — der Fehler war gar nicht auf dem Weg",
      ).toBeGreaterThan(0);

      // Gegenprobe (ii): den Fehlersatz-Träger per visibility:hidden ausblenden → (e) rot.
      await gegenprobe(
        "(ii) Fehlersatz-Träger per visibility:hidden ausgeblendet",
        async () => {
          await ausblenden(seite, LESEWEICHE_FEHLERSATZ, "visibility");
        },
        async () => {
          await einblenden(seite);
        },
        async () => {
          await sichtbarZugesichert(
            seite,
            LESEWEICHE_FEHLERSATZ,
            "Fehlersatz der Wiederherstellung (500)",
            "visibility",
          );
        },
      );

      // ── e2: der Aufruf kommt gar nicht an (Netz weg) → der übersetzte Rückfallsatz.
      weiche.setze("abbruch");
      const vorAbbruch = weiche.zaehler.angekommen;
      await seite.reload({ waitUntil: "load", timeout: wartebudget("neuLadenAdresse") });
      await aufZustandWarten(seite, SELEKTOR_DA, "das Blatt steht auch nach dem Netzabriss", BLATT);
      await aufSichtbarkeitWarten(
        seite,
        ladefehler,
        "Fehlersatz der Wiederherstellung (Netzabriss)",
      );
      await sichtbarZugesichert(
        seite,
        ladefehler,
        "Fehlersatz „Der Entwurf konnte nicht geladen werden. Es wurde nichts gespeichert.“",
        "visibility",
      );
      await nichtSichtbarZugesichert(seite, QUELLSATZ, "Inhalt nach dem Netzabriss");
      await entwurfsflaecheMussOffenSein(seite);
      expect(
        await seite.evaluate<boolean>(fn(SELEKTOR_WEG), ENTWURF_OFFEN),
        "die Marke „Entwurf geöffnet“ steht in der AUFGEKLAPPTEN Entwurfsfläche, obwohl der Abruf abgebrochen wurde",
      ).toBe(true);
      expect(
        await entwurfszeile(db, kennung),
        "die Zeile K1 hat sich durch den abgebrochenen Ladeversuch verändert",
      ).toBe(standK1);
      expect(
        weiche.zaehler.angekommen,
        "der abgebrochene GET war gar nicht unterwegs",
      ).toBeGreaterThan(vorAbbruch);

      // ── e3: Weiche weg → derselbe Entwurf lädt wieder. Ohne diesen Schritt bliebe offen, ob
      //        der Fehlerfall etwas dauerhaft zerstört hat.
      await weiche.abraeumen();
      await seite.reload({ waitUntil: "load", timeout: wartebudget("neuLadenAdresse") });
      await aufZustandWarten(
        seite,
        SELEKTOR_DA,
        "das Blatt steht nach dem Entfernen der Weiche",
        BLATT,
      );
      await aufSichtbarkeitWarten(seite, QUELLSATZ, "Inhalt nach dem Entfernen der Weiche");
      await sichtbarZugesichert(seite, QUELLSATZ, "Inhalt nach dem Entfernen der Weiche");
      expect(
        await seite.evaluate<string>(fn(BLATT_SICHTBARER_TEXT)),
        "nach dem Fehlerfall ist der Inhalt ein anderer als davor",
      ).toBe(brauche(inhaltNachC, "der sichtbare Blattinhalt aus P3 (c)"));

      // ── Die Bilanz DIESER Station: kein stiller Neuanlauf, kein Verlust.
      //
      // GEMESSEN WIRD DIE DIFFERENZ, nicht eine absolute Zahl. Die absolute Zahl gehört zu `P2`:
      // sie hängt davon ab, ob der Verlassen-Weg K2 angelegt hat, und das ist DORT der Gegenstand.
      // Stünde sie hier, trüge dieser Fall eine fremde Zusage mit — und wäre mit `P2` zugleich rot,
      // ohne dass am Fehlerfall etwas falsch wäre.
      const zeilenNachher = await entwurfszahl(db);
      expect(
        zeilenNachher,
        `der Fehlerfall hat die Zahl der Entwürfe verändert (vorher ${zeilenVorher}, nachher ${zeilenNachher}) — ein stiller Neuanlauf oder ein Verlust`,
      ).toBe(zeilenVorher);
      expect(
        await entwurfszeile(db, kennung),
        "K1 ist am Ende des Fehlerfalls nicht mehr die Zeile von nach (a)",
      ).toBe(standK1);

      // Gegenprobe (iii): die erwartete Zeilenzahl um eins verstellen → rot.
      await gegenprobe(
        "(iii) erwartete Zeilenzahl in `drafts` um eins verstellt",
        async () => undefined,
        async () => undefined,
        async () => {
          expect(
            await entwurfszahl(db),
            `die Tabelle \`drafts\` trägt nicht genau ${zeilenVorher + 1} Zeilen`,
          ).toBe(zeilenVorher + 1);
        },
      );
      process.stderr.write(
        `${JOB} P5 (e) GRÜN · K1 ${kennung} · drafts-Zeilen ${zeilenNachher} (unverändert)\n`,
      );
    },
    FALL_RAHMEN_MS * 4,
  );

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // P6 · DIE GEGENPROBEN — nur mit gesetztem Schalter, und dann ABSICHTLICH rot.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it("P6 — die drei Gegenproben (Auftrag §5 Lieferung 3)", (ctx) => {
    if (!verfuegbar) {
      ctx.skip();
      return;
    }
    if (!KALIBRIERUNG) {
      process.stderr.write(
        `${JOB} P6 OHNE SCHALTER: die Gegenproben sind AUS (${kalibrierungHerkunft()}). Sie sind ein eigener, absichtlich roter Lauf — im Regellauf bleibt deshalb kein roter Fall stehen. NICHT GELAUFEN heisst NICHT BESTANDEN.\n`,
      );
      return;
    }
    throw new Error(
      `${JOB} KALIBRIERUNG: dieser Fall ist ABSICHTLICH rot — er belegt, dass die Zusicherungen an ihrem Gegenstand hängen.\n${gegenproben.join("\n")}`,
    );
  });
});
