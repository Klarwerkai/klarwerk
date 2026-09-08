// ================================================================================================
// JOB 3259 · UX-19-R2 — DER GEMEINSAME AUFBAU DER ZWEI MESSUNGEN AM ECHTEN SERVER.
// ================================================================================================
//
// Diese Datei ist KEIN Test. Sie ist der Werkzeugkasten, den
// `ganzdokument-am-echten-server.test.ts` und `vorlesehilfe-ganzdokument.test.ts` teilen — die
// Bedienschritte eines Menschen auf der H3-Bühne (`tests/design/h3-blatt-buehne.ts`) und die
// Ableser, die in der Seite laufen.
//
// WARUM DIESE BÜHNE UND KEINE ZWEITE. Codex' Prüfurteil zu JOB 3196 R2 (ben.md, Prüfpunkt 3)
// beanstandet an den Bestandsbelegen genau einen Punkt: „Speicher-API dabei gemockt; keine neue
// Persistenzwirkung beansprucht." Die gemockte Bühne (`anleitung-folgt-der-importart-mounted.
// test.tsx:74-84`) ersetzt `endpoints.drafts` vollständig — ein Erfolgskasten kann dort nie
// widerlegt werden, weil es hinter ihm niemanden gibt, den man fragen könnte. Die H3-Bühne reicht
// jeden `/api/*`-Aufruf an die ECHTE Fastify-App weiter (`h3-blatt-buehne.ts:216-252`) und kann
// denselben Bestand OHNE den Browser befragen (`frage`, :130). Genau diese zweite Frage schliesst
// die Lücke.
//
// WAS HIER LOKAL NACHDEKLARIERT WIRD — und warum die Bühnendatei unberührt bleibt (Auftrag §10).
// Die Bühne gibt ihre Seite als schmales `Seite`-Interface heraus; Playwright liefert dort eine
// vollwertige `Page`. Dieselbe Stelle, dieselbe Lösung wie in
// `tests/import-anleitung-modus/tastatur-importart-chromium.test.ts:32-35`: die zusätzlich
// gebrauchten Fähigkeiten (`keyboard`, `setInputFiles`, `click`) werden HIER als Typ nachgezogen,
// ohne der gemeinsamen Bühne etwas hinzuzufügen. Kein neues Verhalten — nur der Zugang zu dem, was
// schon da ist.
import { Buffer } from "node:buffer";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_FILE_TEXT, FILE_IMPORT_ACCEPT } from "../../apps/web/src/lib/captureFromFile";
import { CAPTURE_FRONT_DOOR_ROUTE } from "../../apps/web/src/lib/captureFrontDoor";
import { type Buehne, ORIGIN, fn } from "../design/h3-blatt-buehne";

// ------------------------------------------------------------------------------------------------
// Die nachdeklarierten Playwright-Fähigkeiten.
// ------------------------------------------------------------------------------------------------

export interface Tastatur {
  press(taste: string): Promise<void>;
}

/** Die Form, in der Playwright eine Datei OHNE Datei auf der Platte entgegennimmt. */
export interface DateiAnlage {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

export type SeiteMitDatei = Buehne["seite"] & {
  keyboard: Tastatur;
  setInputFiles(selektor: string, dateien: readonly DateiAnlage[]): Promise<void>;
  /**
   * JOB 3259 R2 (Codex-Nachführung 08.09. 16:50) — DER ECHTE ZEIGERKLICK.
   *
   * Runde 1 hat den Öffnen-Link über `evaluate(… el.click())` betätigt. Das ist KEIN Zeigerklick:
   * `HTMLElement.click()` verschickt ein Ereignis am Element vorbei an allem, was ein Mensch
   * überwinden müsste — Sichtbarkeit, Lage im Fenster, ein Deckel darüber. `page.click` fährt
   * dagegen Playwrights Bedienbarkeitsprüfung (sichtbar · stabil · empfängt Zeigerereignisse ·
   * nicht gesperrt) und schickt dann echte Maus-Ereignisse an die Stelle im Fenster. Der
   * Unterschied ist in `F4` mit einem Deckel über dem Link kalibriert: mit Deckel kommt der Klick
   * NICHT durch.
   */
  click(selektor: string, opts?: { timeout?: number }): Promise<void>;
};

/**
 * Die volle Playwright-`Route`. Die Bühne deklariert davon nur `request()` und `fulfill()` — für
 * den Fehlerfall (Auftrag §5.5) werden zusätzlich `abort()` und `fallback()` gebraucht:
 *
 *   · `fallback()` reicht den Aufruf an die BESTEHENDE Weiche der Bühne weiter, also an die echte
 *     Fastify-App. Ohne sie müsste diese Datei die Weiterleitung nachbauen — eine zweite Wahrheit.
 *   · `abort()` lässt den Aufruf scheitern, ohne eine Antwort zu erfinden.
 *
 * WARUM NICHT DER `skript`-PARAMETER DER BÜHNE (Auftrag §5.5 nennt ihn): gemessen an
 * `h3-blatt-buehne.ts:220-228` antwortet er AUSSCHLIESSLICH mit `status: 200`. Ein Fehlschlag des
 * Anlege-Aufrufs ist damit dort nicht ausdrückbar — `endpoints.drafts.create` liefe in den
 * Erfolgszweig. Die Abweichung steht in der Rückgabe.
 */
export interface Weiche {
  request(): { method(): string; url(): string };
  fulfill(r: {
    status: number;
    body: string;
    headers?: Record<string, string>;
  }): Promise<void>;
  abort(grund?: string): Promise<void>;
  fallback(): Promise<void>;
}

// ------------------------------------------------------------------------------------------------
// DIE WEICHE VOR DEM ANLEGE-AUFRUF — und ihr Zähler.
// ------------------------------------------------------------------------------------------------

/** Der gemessene Aufrufpfad des Anlegens: `endpoints.drafts.create` → `api/endpoints.ts:436`. */
export const ENTWURFS_PFAD = "/api/drafts";

/**
 * `durch`   — der Regelfall: `fallback()` reicht an die ECHTE Fastify-App weiter.
 * `langsam` — dieselbe echte Antwort, nur später. Nur damit ist der Wartezustand `wholeSaving`
 *             überhaupt ablesbar; am echten Server ist er kürzer als jede Messung.
 * `abbruch` — der Aufruf kommt gar nicht an (Netz weg). Der Zustand, den §9 „offline" nennt.
 * `fehler`  — der Server antwortet 500 im Fehlerschema aus `services/app/src/http.ts`.
 */
export type Weichenstand = "durch" | "langsam" | "abbruch" | "fehler";

/** Der Grund, den die gestellte 500-Antwort mitschickt — er MUSS beim Menschen ankommen. */
export const WEICHE_FEHLERCODE = "UX19_TESTFEHLER";
export const WEICHE_FEHLERSATZ =
  "Der Entwurf konnte nicht angelegt werden (gestellter Serverfehler UX19).";

export interface Entwurfsweiche {
  /** Der aktuell eingestellte Stand. */
  readonly stand: Weichenstand;
  setze(stand: Weichenstand): void;
  /**
   * Der Zählerstand der BEENDETEN Anlege-Aufrufe. Vor dem Klick merken, danach an
   * `warteAufAbschluss` geben — so wird gemessen, dass der POST wirklich lief.
   */
  readonly marke: number;
  /**
   * JOB 3259 R2 (Codex-Nachführung 08.09. 16:50) — WARTEN AUF DEN POST, NICHT AUF EINE LEERSTELLE.
   *
   * Runde 1 hat den Abschluss eines Speicherversuchs allein daran erkannt, dass der Wartezustand
   * `wholeSaving` NICHT (mehr) auf der Seite steht. Diese Bedingung ist auch dann erfüllt, wenn gar
   * nichts passiert ist — ein nicht angekommener Klick, ein gesperrter Knopf, eine Fläche ohne
   * Speicherweg hätten den Fehlerfall grün durchrutschen lassen. Gemessen wird deshalb hier: die
   * Weiche hat einen POST auf `/api/drafts` GESEHEN und ihn BEENDET (beantwortet oder abgebrochen).
   */
  warteAufAbschluss(marke: number, frist?: number): Promise<void>;
}

/**
 * Legt die Weiche VOR die Weiche der Bühne (Playwright prüft Routen in umgekehrter
 * Registrierungsreihenfolge) und zählt jeden Anlege-Aufruf mit.
 */
export async function entwurfsWeicheLegen(
  seite: SeiteMitDatei,
  langsamMs = 2_000,
): Promise<Entwurfsweiche> {
  let stand: Weichenstand = "durch";
  let angekommen = 0;
  let beendet = 0;

  await seite.route(`${ORIGIN}${ENTWURFS_PFAD}`, async (route) => {
    const r = route as unknown as Weiche;
    if (r.request().method() !== "POST") {
      await r.fallback();
      return;
    }
    angekommen += 1;
    try {
      if (stand === "abbruch") {
        await r.abort("failed");
        return;
      }
      if (stand === "fehler") {
        await r.fulfill({
          status: 500,
          body: JSON.stringify({ error: WEICHE_FEHLERCODE, message: WEICHE_FEHLERSATZ }),
          headers: { "content-type": "application/json" },
        });
        return;
      }
      if (stand === "langsam") {
        await new Promise((auf) => setTimeout(auf, langsamMs));
      }
      await r.fallback();
    } finally {
      beendet += 1;
    }
  });

  return {
    get stand(): Weichenstand {
      return stand;
    },
    setze(neu: Weichenstand): void {
      stand = neu;
    },
    get marke(): number {
      return beendet;
    },
    async warteAufAbschluss(marke: number, frist = 30_000): Promise<void> {
      const ende = Date.now() + frist;
      while (Date.now() < ende) {
        if (angekommen > marke && beendet > marke) {
          return;
        }
        await new Promise((auf) => setTimeout(auf, 25));
      }
      throw new Error(
        `Kein abgeschlossener POST ${ENTWURFS_PFAD}: angekommen=${angekommen}, beendet=${beendet}, erwartet > ${marke}`,
      );
    },
  };
}

// ------------------------------------------------------------------------------------------------
// Die Datei, die ein Mensch wählt.
// ------------------------------------------------------------------------------------------------

/**
 * Der Dateiname reist als `wholeSavedSource`-Platzhalter über die Fläche und als Quelle in den
 * Rumpf des Entwurfs — er ist damit selbst ein Beleg und darf nicht generisch sein.
 */
export const DATEI_NAME = "UX19-Ganzdokument-Beleg.txt";

/**
 * Die Überschrift entscheidet den Titel des Entwurfs (`wholeDocumentTitle`,
 * `captureFromFile.ts:335-348`) — deshalb steht sie hier und nicht der Zufall des Dateinamens.
 * Der zweite Absatz ist der Inhaltsbeleg: Er muss nach dem Öffnen auf der Fläche STEHEN, sonst ist
 * der Öffnen-Weg leer (Auftrag §5.3).
 */
export const DATEI_TITEL = "UX19 Ganzdokument Beleg";
export const DATEI_INHALTSSATZ =
  "Diese Zeile beweist, dass der Rumpf des Entwurfs beim Server angekommen ist.";
export const DATEI_INHALT = `# ${DATEI_TITEL}\n\n${DATEI_INHALTSSATZ}\n`;

export function dateiAnlage(name = DATEI_NAME, inhalt = DATEI_INHALT): DateiAnlage {
  return { name, mimeType: "text/plain", buffer: Buffer.from(inhalt, "utf8") };
}

// ------------------------------------------------------------------------------------------------
// Ableser, die IN der Seite laufen.
// ------------------------------------------------------------------------------------------------

/** Der sichtbare Text der ganzen Seite, Leerraum gefaltet. */
export const SEITENTEXT = `() => (document.body.textContent || '').replace(/\\s+/g, ' ').trim()`;

/**
 * Alles, was ein Mensch LESEN oder VORGELESEN bekommen kann: sichtbarer Text plus die vorgelesenen
 * Attribute. Bewusst NICHT das rohe `innerHTML` — dieselbe Begründung wie in
 * `anleitung-folgt-der-importart-mounted.test.tsx:186-198`: die technische Adresse
 * `/capture/frontdoor` steht im `href` des Öffnen-Wegs und BLEIBT dort. Verschwinden muss das Wort
 * aus dem, was jemand liest.
 */
export const LESBARER_TEXT = `() => {
  const attrs = [...document.querySelectorAll('*')].flatMap((el) =>
    ['title', 'aria-label', 'alt', 'placeholder'].map((a) => el.getAttribute(a) || ''),
  );
  return ((document.body.textContent || '') + ' ' + attrs.join(' ')).replace(/\\s+/g, ' ').trim();
}`;

/** Klickt den ersten `<button>`, dessen gefalteter Text `text` enthält. `false` = nicht gefunden. */
export const KLICK_KNOPF = `(text) => {
  const k = [...document.querySelectorAll('button')].find(
    (b) => (b.textContent || '').replace(/\\s+/g, ' ').trim().includes(text),
  );
  if (!k) { return false; }
  k.click();
  return true;
}`;

/** Klickt die Auswahlkarte (`aria-pressed`), deren Text `text` enthält. */
export const KLICK_KARTE = `(text) => {
  const k = [...document.querySelectorAll('button[aria-pressed]')].find(
    (b) => (b.textContent || '').replace(/\\s+/g, ' ').includes(text),
  );
  if (!k) { return false; }
  k.click();
  return true;
}`;

/** Der CSS-Selektor des Öffnen-Links — für den ECHTEN Zeigerklick (`page.click`). */
export const OEFFNEN_LINK_SELEKTOR = `a[href^="${CAPTURE_FRONT_DOOR_ROUTE}?draft="]`;

/** Die `href` des Öffnen-Links — oder `null`, wenn keiner da ist. */
export const OEFFNEN_LINK_HREF = `(pfad) => {
  const a = [...document.querySelectorAll('a')].find(
    (x) => (x.getAttribute('href') || '').indexOf(pfad + '?draft=') === 0,
  );
  return a ? a.getAttribute('href') : null;
}`;

/**
 * Legt einen durchsichtigen Deckel ÜBER die Seite. Er verändert am Öffnen-Link nichts — er nimmt
 * ihm nur die Zeigerereignisse. Ein echter Zeigerklick kommt damit nicht mehr durch, ein
 * `el.click()` sehr wohl: genau das trennt die beiden (Kalibrierung in F4).
 *
 * WARUM DAS GANZE FENSTER UND NICHT NUR DAS RECHTECK DES LINKS. Zwei Fassungen sind daran
 * gescheitert und beide Male aus demselben Grund: Playwright scrollt sein Ziel VOR dem Klick ins
 * Bild. Ein nach Koordinaten gesetzter Deckel — ob am Fenster (`fixed`) oder am Dokument
 * (`absolute` + Scrollversatz) — liegt danach neben dem Link, weil das Blatt in einem EIGENEN
 * Scroll-Container sitzt und keine der beiden Bezugsgrössen mitwandert. Gemessen in Runde 2: der
 * Klick ging beide Male durch. `position: fixed; inset: 0` ist von jedem Scrollen unabhängig und
 * sagt genau das, was diese Kalibrierung sagen soll: liegt etwas dazwischen, kommt ein Zeigerklick
 * nicht ans Ziel.
 */
export const DECKE_LINK_ZU = `() => {
  const deckel = document.createElement('div');
  deckel.id = 'ux19-deckel';
  deckel.style.position = 'fixed';
  deckel.style.left = '0';
  deckel.style.top = '0';
  deckel.style.right = '0';
  deckel.style.bottom = '0';
  deckel.style.zIndex = '2147483647';
  deckel.style.background = 'rgba(0,0,0,0.01)';
  document.body.appendChild(deckel);
  return document.getElementById('ux19-deckel') !== null;
}`;

/** Nimmt den Deckel wieder weg. */
export const DECKE_LINK_AUF = `() => {
  const d = document.getElementById('ux19-deckel');
  if (!d) { return false; }
  d.remove();
  return true;
}`;

/** Wo steht die Seite gerade? (Pfad samt Abfrage — die Adresszeile ohne Herkunft.) */
export const ADRESSE = "() => location.pathname + location.search";

/** Wie viele Dateieingänge des Dokument-Imports stehen auf der Fläche? Muss genau einer sein. */
export const EINGANG_ZAEHLEN = `(accept) =>
  document.querySelectorAll('input[type="file"][accept="' + accept + '"]:not([multiple])').length`;

/** Der Selektor des EINEN Dateieingangs des Dokument-Imports. */
export const DATEI_EINGANG = `input[type="file"][accept="${FILE_IMPORT_ACCEPT}"]:not([multiple])`;

/** Trägt das fokussierte Element diese `href`? (Für den Tastaturweg zum Öffnen-Link.) */
export const FOKUS_HREF = `() => {
  const el = document.activeElement;
  return el ? el.getAttribute('href') : null;
}`;

/** Der Titel im Blatt (`blatt-titel`) und der sichtbare Text der Schreibfläche (`blatt-text`). */
export const BLATT_INHALT = `() => {
  const titel = document.querySelector('[data-testid="blatt-titel"]');
  const text = document.querySelector('[data-testid="blatt-text"]');
  return {
    titel: titel && 'value' in titel ? String(titel.value) : (titel ? (titel.textContent || '') : ''),
    text: text ? (text.textContent || '').replace(/\\s+/g, ' ').trim() : '',
  };
}`;

// ------------------------------------------------------------------------------------------------
// Bedienschritte — genau der Weg, den ein Mensch geht.
// ------------------------------------------------------------------------------------------------

/**
 * Öffnet auf dem Blatt den Arbeitsraum „Aus Datei": Werkzeugzeile „Datei" → „Datei importieren".
 * Derselbe Weg wie in `tastatur-importart-chromium.test.ts:102-121` — kein zweiter Einstieg.
 */
export async function dateiwegOeffnen(seite: SeiteMitDatei): Promise<void> {
  await seite.evaluate<boolean>(fn(KLICK_KNOPF), String(i18n.t("erfassen.werkzeug.datei")));
  await seite.evaluate<boolean>(fn(KLICK_KNOPF), String(i18n.t("erfassen.weg.datei")));
  await seite.waitForFunction(
    fn(`() => document.querySelectorAll('button[aria-pressed]').length >= 2`),
    undefined,
    { timeout: 20_000 },
  );
}

/** Wählt die Importart „Ganzes Dokument übernehmen" und wartet, bis sie gedrückt ist. */
export async function ganzdokumentWaehlen(seite: SeiteMitDatei): Promise<void> {
  const ganzes = String(i18n.t(CAPTURE_FILE_TEXT.importModeWhole));
  await seite.evaluate<boolean>(fn(KLICK_KARTE), ganzes);
  await seite.waitForFunction(
    fn(`(w) => {
      const k = document.querySelector('button[aria-pressed="true"]');
      return k !== null && (k.textContent || '').includes(w);
    }`),
    ganzes,
    { timeout: 10_000 },
  );
}

/**
 * Setzt die Datei über den ECHTEN versteckten Dateieingang (derselbe `<input type=file>`, den der
 * Knopf „Datei auswählen" und die Ablagefläche klicken — `CaptureFileImport.tsx:81-87`) und wartet,
 * bis der Speichern-Knopf des Ganzdokument-Wegs da ist.
 */
export async function dateiWaehlen(
  seite: SeiteMitDatei,
  anlage: DateiAnlage = dateiAnlage(),
): Promise<void> {
  await seite.setInputFiles(DATEI_EINGANG, [anlage]);
  await seite.waitForFunction(
    fn(`(text) => [...document.querySelectorAll('button')].some(
      (b) => (b.textContent || '').replace(/\\s+/g, ' ').trim().includes(text),
    )`),
    String(i18n.t(CAPTURE_FILE_TEXT.wholeCta)),
    { timeout: 30_000 },
  );
}

/** Drückt „Ganzes Dokument als Entwurf speichern". */
export async function speichernDruecken(seite: SeiteMitDatei): Promise<boolean> {
  return seite.evaluate<boolean>(fn(KLICK_KNOPF), String(i18n.t(CAPTURE_FILE_TEXT.wholeCta)));
}

/** Wartet, bis der Erfolgskasten (`wholeSavedTitle`) auf der Fläche steht. */
export async function aufErfolgskastenWarten(seite: SeiteMitDatei, frist = 30_000): Promise<void> {
  await seite.waitForFunction(
    fn(`(text) => (document.body.textContent || '').replace(/\\s+/g, ' ').includes(text)`),
    String(i18n.t(CAPTURE_FILE_TEXT.wholeSavedTitle)),
    { timeout: frist },
  );
}

/**
 * Wartet, bis der Speicherversuch WIRKLICH zu Ende ist. Zwei Bedingungen, und die erste ist die
 * wichtige (Codex-Nachführung 08.09. 16:50):
 *   1. Die Weiche hat einen POST auf `/api/drafts` gesehen UND beendet — der Versuch hat also
 *      stattgefunden. Ohne diese Messung wäre „kein `wholeSaving` mehr da" auch dann wahr, wenn
 *      nie etwas losgelaufen ist.
 *   2. Der Wartezustand `wholeSaving` steht nicht mehr auf der Fläche — der Client ist fertig.
 */
export async function aufRuhestandWarten(
  seite: SeiteMitDatei,
  weiche: Entwurfsweiche,
  marke: number,
  frist = 30_000,
): Promise<void> {
  await weiche.warteAufAbschluss(marke, frist);
  await seite.waitForFunction(
    fn(`(w) => !(document.body.textContent || '').includes(w)`),
    String(i18n.t(CAPTURE_FILE_TEXT.wholeSaving)),
    { timeout: frist },
  );
}

/** Die Entwurfskennung aus dem Öffnen-Link — die Kennung, die der MENSCH angeboten bekommt. */
export async function kennungAusOeffnenLink(seite: SeiteMitDatei): Promise<string | null> {
  const href = await seite.evaluate<string | null>(fn(OEFFNEN_LINK_HREF), CAPTURE_FRONT_DOOR_ROUTE);
  if (href === null) {
    return null;
  }
  const roh = href.slice(`${CAPTURE_FRONT_DOOR_ROUTE}?draft=`.length);
  return decodeURIComponent(roh);
}

/** Lädt die Seite neu — ein echtes `goto`, kein Zustandsschubs. */
export async function neuLaden(seite: SeiteMitDatei, pfad = "/erfassen"): Promise<void> {
  await seite.goto(`${ORIGIN}${pfad}`, { waitUntil: "load", timeout: 60_000 });
  await seite.waitForFunction(
    fn("(sel) => document.querySelector(sel) !== null"),
    '[data-testid="blatt"]',
    { timeout: 30_000 },
  );
}

/**
 * Die Sprache dieser Bühne umstellen. Gemessen am Produkt: `i18n.ts` liest den Startwert über
 * `gespeicherteSprache()` aus `localStorage["kw.sprache"]` (`lib/sprachwahl.ts:22`, `:36-42`) —
 * kein LanguageDetector, kein Browsersprachen-Rückfall. Ein `addInitScript` setzt den Schlüssel
 * VOR jedem Skript der Seite; wirksam wird er mit dem nächsten `goto` (Muster
 * `h3-blatt-buehne.ts:212-214`, das dort das Theme setzt).
 */
export async function spracheSetzen(seite: SeiteMitDatei, sprache: string): Promise<void> {
  await seite.addInitScript(
    `try { localStorage.setItem("kw.sprache", ${JSON.stringify(sprache)}); } catch (e) {}`,
  );
  await i18n.changeLanguage(sprache);
}
