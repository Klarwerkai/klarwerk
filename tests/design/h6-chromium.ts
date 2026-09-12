// ================================================================================================
// JOB 3065 H6 — DIE ECHTE SEITE IN CHROMIUM: der gemeinsame Aufbau der drei H6-Messungen.
// ================================================================================================
//
// Muster: `tests/design/zielbild-validierung.test.ts` (JOB 2618 D5). Die ECHTE Anwendung aus
// `apps/web/dist` (das Ergebnis von `./tools/build`) wird in Chromium geladen; Playwright bedient
// `/assets/*` und `index.html` aus `dist` und reicht JEDEN `/api/*`-Aufruf an die ECHTE Fastify-App
// (`buildApp`, echte Dienste, echter Bestand) weiter — mit dem Bearer der echten Anmeldung. Kein
// Mock, kein Nachbau: React mountet `Admin.tsx` beziehungsweise `Profile.tsx` selbst.
//
// Das THEME wird ausdrücklich gesetzt (`localStorage["kw.designTheme"] = "modern"`, der Schalter des
// Produkts) und in der Seite nachgemessen — das Zielbild `Admin.dc.html` ist die Werkbank-Palette.
//
// Diese Datei enthält KEINE Zusicherung. Sie ist der Aufbau, damit die drei Messdateien nicht
// dreimal denselben Browser hochfahren müssen.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import { buildApp, buildServices } from "../../services/app/src/build-app";

export const WURZEL = resolve(process.cwd());
export const DIST = resolve(WURZEL, "apps/web/dist");
/** Das Zielbild liegt im Steuerungsordner (Pflichtquelle des Auftrags), nicht im Produkt. */
export const ZIELBILD = "/Users/peterkohnert/klarwerk_steuerung/design/klarwerk/Admin.dc.html";
/**
 * JOB 3065 R2 — WARUM `https` UND NICHT `http`:
 *
 * Der erste Lauf des Funktionsinventars, das den Demodaten-Seed WIRKLICH drückt, stürzte in der
 * Seite ab: `TypeError: crypto.randomUUID is not a function`. Der Aufrufer ist die Erfolgsmeldung
 * (`app/ToastContext.tsx:36`), und `crypto.randomUUID` gibt es nur in einem SICHEREN Kontext —
 * `http://klarwerk.test` ist keiner. Im Betrieb läuft die Anwendung über https bzw. localhost
 * (beides sicher), der Absturz ist also ein Artefakt der Messumgebung, kein Produktfehler. Statt ihn
 * zu umgehen, misst dieser Prüfstand jetzt in derselben Art von Kontext wie der Betrieb.
 */
export const ORIGIN = "https://klarwerk.test";

// ---- Zielbild lesen ------------------------------------------------------------------------------
/** Der erste `style="…"`-Block, der den Anker enthält. */
export function zielStil(ziel: string, anker: string): string | null {
  const re = /style="([^"]*)"/g;
  for (let m = re.exec(ziel); m !== null; m = re.exec(ziel)) {
    if ((m[1] ?? "").includes(anker)) return m[1] ?? null;
  }
  return null;
}
export function zielProp(stil: string | null, eigenschaft: string): string | null {
  if (stil === null) return null;
  return new RegExp(`(?:^|[;\\s])${eigenschaft}\\s*:\\s*([^;]+)`).exec(stil)?.[1]?.trim() ?? null;
}
/** Hex → `rgb(r, g, b)` (die Serialisierung von getComputedStyle); alles andere unverändert. */
export function kanon(wert: string | null): string | null {
  if (wert === null) return null;
  const m = /^#([0-9a-f]{6})$/i.exec(wert.trim());
  if (!m) return wert.trim();
  const h = m[1] ?? "";
  return `rgb(${Number.parseInt(h.slice(0, 2), 16)}, ${Number.parseInt(h.slice(2, 4), 16)}, ${Number.parseInt(h.slice(4, 6), 16)})`;
}

/**
 * Ein Schatten als Zahlenfolge je Lage — CSS schreibt die Farbe VOR die Längen, `getComputedStyle`
 * schreibt sie DAHINTER, und der Browser ergänzt die Streuung (`0px`). Ein Zeichenvergleich wäre
 * deshalb immer rot; verglichen wird die Bedeutung: Farbe plus Versatz/Weichzeichnung/Streuung.
 */
export function schattenLagen(wert: string): { farbe: string; masse: number[] }[] {
  const lagen: { farbe: string; masse: number[] }[] = [];
  // Lagen trennen: Kommas INNERHALB von rgba(...) zählen nicht.
  const teile: string[] = [];
  let tiefe = 0;
  let aktuell = "";
  for (const z of wert) {
    if (z === "(") tiefe += 1;
    if (z === ")") tiefe -= 1;
    if (z === "," && tiefe === 0) {
      teile.push(aktuell);
      aktuell = "";
      continue;
    }
    aktuell += z;
  }
  if (aktuell.trim() !== "") teile.push(aktuell);
  for (const teil of teile) {
    const farbe = /rgba?\(([^)]*)\)/.exec(teil)?.[1] ?? "";
    const ohneFarbe = teil.replace(/rgba?\([^)]*\)/, " ");
    const masse = [...ohneFarbe.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
    // Streuung ergänzen, wenn die Vorlage sie weglässt (CSS-Vorgabe: 0).
    while (masse.length < 4) masse.push(0);
    const kanonFarbe = farbe
      .split(",")
      .map((s) => s.trim())
      .join(", ");
    // Tailwind setzt für Ring/Offset zwei VOLLSTÄNDIG DURCHSICHTIGE Platzhalterlagen vor den
    // eigentlichen Schatten (`var(--tw-ring-offset-shadow, 0 0 #0000), …`). Sie zeichnen nichts;
    // sie mitzuvergleichen hieße, eine Bauform von Tailwind zum Zielbildwert zu erklären. Eine
    // echte Schattenlage ist nie durchsichtig — die Zusage verliert dadurch nichts.
    const alpha = Number(kanonFarbe.split(", ")[3] ?? "1");
    if (alpha === 0) {
      continue;
    }
    lagen.push({ farbe: kanonFarbe, masse: masse.slice(0, 4) });
  }
  return lagen;
}

// ---- Die echte App in Chromium -------------------------------------------------------------------
export type BrowserFn = (arg: unknown) => unknown;
export const fn = (quelle: string): BrowserFn =>
  new Function("arg", `return (${quelle})(arg);`) as BrowserFn;

interface Route {
  request(): {
    url(): string;
    method(): string;
    postData(): string | null;
    headers(): Record<string, string>;
  };
  fulfill(r: {
    status: number;
    body: string | Buffer;
    contentType?: string;
    headers?: Record<string, string>;
  }): Promise<void>;
}
export interface Seite {
  route(url: string, handler: (route: Route) => Promise<void>): Promise<void>;
  addInitScript(script: string): Promise<void>;
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  waitForFunction(fn: BrowserFn, arg?: unknown, opts?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(fn: BrowserFn, arg?: unknown): Promise<T>;
  on(ereignis: string, hoerer: (arg: unknown) => void): void;
  /**
   * JOB 3587: die Pause ZWISCHEN zwei Abfragen eines Zustands — nicht die Wartezeit AUF ihn. Der
   * Unterschied steht bei `setzeSprache` unten; gewartet wird dort auf `<html lang>`, diese
   * Millisekunden halten nur die Abfrageschleife davon ab, den Browser zu belagern.
   */
  waitForTimeout(ms: number): Promise<void>;
}
interface Browser {
  version(): string;
  newPage(opts: Record<string, unknown>): Promise<Seite>;
  close(): Promise<void>;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function distDatei(pfadname: string): { body: Buffer; typ: string } {
  const rel = pfadname === "/" ? "/index.html" : pfadname;
  const datei = join(DIST, rel);
  if (existsSync(datei) && statSync(datei).isFile()) {
    return { body: readFileSync(datei), typ: MIME[extname(datei)] ?? "application/octet-stream" };
  }
  // SPA: jeder Seitenpfad bekommt index.html
  return { body: readFileSync(join(DIST, "index.html")), typ: MIME[".html"] ?? "text/html" };
}

export interface Stand {
  /** JOB 3130: dieselbe echte Antwort gezielt verzögern oder für eine Gegenprobe verstellen. */
  antworten: { vorAuslieferung?: (url: URL, body: string) => Promise<string> };
  /** Sollwerte der echten App vor dem Öffnen; unabhängig vom danach gerenderten Inhalt. */
  wirkungszahlen(): Promise<number[]>;
  browser: Browser | null;
  seite: Seite | null;
  app: ReturnType<typeof buildApp> | null;
  fehler: string | null;
  version: string;
  theme: string;
  /** Fehler, die die Seite selbst geworfen hat (`pageerror`). */
  seitenfehler: string[];
  /**
   * JOB 3065 R2 — DIE EINGESPEISTE STÖRUNG (BENs Korrekturpflicht 2).
   *
   * Solange hier ein Pfadanfang steht, antwortet die Weiche darauf mit 503 statt die echte App zu
   * fragen. Damit lässt sich der Fehlerweg einer EINZELNEN Quelle am gebauten Produkt messen —
   * nicht simuliert, sondern an derselben Fläche, die der Nutzer sieht.
   */
  stoerung: string | null;
  /** Wie oft jeder `/api`-Pfad wirklich abgerufen wurde — der Beleg, dass „Erneut" wirkt. */
  abrufe: Map<string, number>;
}

/** In der Seite: CSS-Pfad eines Elements (nth-child-Kette bis body) — der Selektor als Beleg. */
export const PFAD_FN = `(el) => {
  const teile = [];
  let e = el;
  while (e && e.nodeType === 1 && e !== document.body) {
    const p = e.parentElement;
    const i = Array.prototype.indexOf.call(p.children, e) + 1;
    teile.unshift(e.tagName.toLowerCase() + ':nth-child(' + i + ')');
    e = p;
  }
  return 'body > ' + teile.join(' > ');
}`;

export const LESEN =
  "([sel, eig]) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).getPropertyValue(eig) : null; }";

/**
 * Startet die echte App in Chromium, meldet einen Admin an und öffnet `pfad`.
 * `warteAuf` ist ein Selektor, der beweist, dass die Seite wirklich steht.
 */
export async function starte(
  pfad: string,
  warteAuf: string,
  breite = 1280,
  hoehe = 900,
  /**
   * Optionaler Bestand VOR dem ersten Seitenaufbau — über die echten Routen der echten App.
   * (JOB 3065 R2: das Funktionsinventar braucht einen NICHT freigegebenen Nutzer, sonst gibt es
   * den Knopf „Freigeben" gar nicht und sein Posten wäre unprüfbar.)
   */
  vorbereiten?: (app: ReturnType<typeof buildApp>) => Promise<void>,
): Promise<Stand> {
  const stand: Stand = {
    antworten: {},
    wirkungszahlen: async () => {
      throw new Error("Wirkungsquelle noch nicht bereit");
    },
    browser: null,
    seite: null,
    app: null,
    fehler: null,
    version: "",
    theme: "",
    seitenfehler: [],
    stoerung: null,
    abrufe: new Map<string, number>(),
  };
  try {
    if (!existsSync(join(DIST, "index.html"))) {
      throw new Error("apps/web/dist fehlt — vorher ./tools/build (im Tor läuft es immer)");
    }
    const services = buildServices();
    const app = buildApp(services);
    stand.app = app;
    await app.ready();
    // Das ERSTE Konto einer frischen Instanz ist der Admin (Ersteinrichtung).
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Pedi", email: "pedi@job3065.test", password: "geheim12345" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "pedi@job3065.test", password: "geheim12345" },
    });
    const token = (login.json() as { token: string }).token;
    stand.wirkungszahlen = async () => {
      const antwort = await app.inject({
        method: "GET",
        url: "/api/me/impact",
        headers: { authorization: `Bearer ${token}` },
      });
      if (antwort.statusCode !== 200) throw new Error(`Wirkungsquelle: HTTP ${antwort.statusCode}`);
      const daten = antwort.json() as Record<string, unknown>;
      return ["contributions", "validated", "cited", "helpfulReceived"].map((feld) => {
        const wert = daten[feld];
        if (typeof wert !== "number" || !Number.isInteger(wert) || wert < 0)
          throw new Error(`Wirkungsquelle: ${feld} ist keine Zählung`);
        return wert;
      });
    };
    if (vorbereiten) {
      await vorbereiten(app);
    }

    const require = createRequire(import.meta.url);
    const { chromium } = require("playwright") as {
      chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
    };
    stand.browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
    });
    stand.version = stand.browser.version();
    const seite = await stand.browser.newPage({ viewport: { width: breite, height: hoehe } });
    stand.seite = seite;
    seite.on("pageerror", (e) => stand.seitenfehler.push(String(e).slice(0, 200)));
    // Der Theme-Schalter des Produkts, VOR dem ersten Skript gesetzt (mega40, lib/designTheme.ts).
    await seite.addInitScript(
      `try { localStorage.setItem("kw.designTheme", "modern"); } catch (e) {}`,
    );
    await seite.route(`${ORIGIN}/**`, async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.pathname.startsWith("/api/")) {
        stand.abrufe.set(url.pathname, (stand.abrufe.get(url.pathname) ?? 0) + 1);
        // Die eingespeiste Störung: derselbe Weg, dieselbe Fläche, nur eine kaputte Antwort.
        if (stand.stoerung !== null && url.pathname.startsWith(stand.stoerung)) {
          await route.fulfill({
            status: 503,
            body: JSON.stringify({ error: "job3065-stoerung" }),
            headers: { "content-type": "application/json" },
          });
          return;
        }
        const kopf: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.headers())) {
          if (!["host", "origin", "referer", "cookie"].includes(k.toLowerCase())) kopf[k] = v;
        }
        kopf.authorization = `Bearer ${token}`;
        const body = req.postData();
        const res = await app.inject({
          method: req.method() as "GET",
          url: url.pathname + url.search,
          headers: kopf,
          ...(body !== null ? { payload: body } : {}),
        });
        await route.fulfill({
          status: res.statusCode,
          body: stand.antworten.vorAuslieferung
            ? await stand.antworten.vorAuslieferung(url, res.body)
            : res.body,
          headers: {
            "content-type": (res.headers["content-type"] as string) ?? "application/json",
          },
        });
        return;
      }
      const d = distDatei(url.pathname);
      await route.fulfill({ status: 200, body: d.body, contentType: d.typ });
    });
    await seite.goto(`${ORIGIN}${pfad}`, { waitUntil: "load", timeout: 60_000 });
    await seite.waitForFunction(fn("(s) => document.querySelector(s) !== null"), warteAuf, {
      timeout: 30_000,
    });
    stand.theme = await seite.evaluate<string>(
      fn(`() => document.documentElement.getAttribute('data-theme') || 'classic (kein Attribut)'`),
    );
  } catch (e) {
    stand.fehler = String(e).split("\n").slice(0, 3).join(" | ");
  }
  return stand;
}

/**
 * Dieselbe Seite auf eine andere Route führen — statt einen zweiten Browser zu starten.
 *
 * WARUM DAS WICHTIG IST: Im Gesamttor laufen über 1200 Testdateien gleichzeitig, darunter mehrere
 * echte Chromium-Messungen. Jede zusätzliche Instanz kostet Speicher, und die Quittung kam prompt:
 * ein Volllauf mit fünf H6-Instanzen ließ fremde Browsertests mit „Target page, context or browser
 * has been closed" umfallen. Eine Instanz je Messdatei genügt — /admin und /profil teilen sie sich.
 */
export async function wechsle(stand: Stand, pfad: string, warteAuf: string): Promise<void> {
  const seite = stand.seite;
  if (seite === null || stand.fehler !== null) {
    return;
  }
  try {
    await seite.goto(`${ORIGIN}${pfad}`, { waitUntil: "load", timeout: 60_000 });
    await seite.waitForFunction(fn("(s) => document.querySelector(s) !== null"), warteAuf, {
      timeout: 30_000,
    });
  } catch (e) {
    stand.fehler = String(e).split("\n").slice(0, 3).join(" | ");
  }
}

// ==================================================================================================
// JOB 3587 · DIE SPRACHWAHL WOHNT AUCH AN DIESEM PRÜFSTAND IN DER VORRICHTUNG — EINMAL, HIER.
// ==================================================================================================
//
// WARUM HIER UND NICHT IN DEN TESTDATEIEN. Derselbe Griff, den JOB 3576 für den anderen Prüfstand
// gemacht hat (`tests/design/h4-harness.ts:344-352`): `tests/d1-meine-entwuerfe/`
// `zugang-schmal-chromium.test.ts:260-281` hatte sich den Weg „Speicher setzen, neu laden, warten"
// selbst gebaut, und die nächste Datei, die eine Sprache braucht, hätte ihn abgeschrieben. Die
// zweite Abschrift ist die, die beim nächsten Umbau vergessen wird. Wer die Sprache für eine ANDERE
// h6-Fläche braucht, übergibt hier seinen Warteanker, statt sich einen zweiten Setzer zu bauen.
//
// WARUM ES TROTZDEM ZWEI SETZER IM HAUS GIBT (hier und `h4-harness.ts:403`), und das kein Doppel
// ist: es sind zwei getrennte Bühnen mit je eigenem Stand-Typ, eigener Seite und eigenem
// Warteanker — h4 wartet auf die Ortszeile der Bibliothek, h6 auf den Anker, den der Aufrufer
// nennt. Ein gemeinsamer dritter Setzer müsste beide Stände kennen; das wäre eine Abstraktion über
// genau zwei Fälle. Was wirklich EINE Quelle hat, ist der Speicherschlüssel des Produkts, und der
// steht im Produkt (`apps/web/src/lib/sprachwahl.ts:23`).
//
// ADDITIV: `starte` bleibt unverändert und setzt von sich aus KEINE Sprache. Was ohne Zutun gilt,
// ist damit weiterhin die Vorgabe des Produkts (`lib/sprachwahl.ts:26`, `STANDARD_SPRACHE = "de"`)
// — alle Bestandsläufe dieses Prüfstands messen weiter Deutsch.

/** Der Speicherschlüssel der Sprachwahl des Produkts (`apps/web/src/lib/sprachwahl.ts:23`). */
const SPRACHE_SCHLUESSEL = "kw.sprache";

/** Wie lange auf die angewandte Sprache gewartet wird, bevor der Schritt aufgibt. */
const SPRACHE_FRIST_MS = 30_000;

/** Der Abstand zwischen zwei Blicken auf den Zustand — keine Wartezeit AUF ihn. */
const SPRACHE_TAKT_MS = 100;

/** In der Seite: die Sprachwahl des Produkts in den Speicher schreiben. */
const SPRACHE_SETZEN =
  "([schluessel, wert]) => { try { localStorage.setItem(schluessel, wert); } catch (e) {} return null; }";

/** In der Seite: die angewandte Sprache und der Warteanker mit dem Text, den er wirklich zeigt. */
const SPRACHE_LESEN = `(sel) => {
  const anker = document.querySelector(sel);
  return {
    lang: document.documentElement.lang,
    da: anker !== null,
    text: anker ? (anker.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 160) : null,
  };
}`;

/**
 * Die Sprachwahl des Produkts setzen, die Seite neu laden und warten, bis die Sprache WIRKLICH
 * angewandt ist.
 *
 * Der Rückkehrpunkt ist ein ZUSTAND und keine Frist (Lehre JOB 3152 T1b): gewartet wird, bis das
 * Produkt selbst sagt, dass es diese Sprache spricht (`<html lang>`, gesetzt von
 * `apps/web/src/lib/htmlLang.ts`) UND der übergebene Anker gezeichnet ist. Ein `waitForTimeout` an
 * dieser Stelle wäre auf einem leeren Rechner zu lang und auf einem vollen zu kurz.
 *
 * DER ANKER IST FLÄCHENUNABHÄNGIG und kommt vom Aufrufer — voreingestellt ist das Kopfband, das auf
 * JEDER Fläche dieses Prüfstands steht. Damit trägt der Schritt `/start` ebenso wie `/admin` oder
 * `/profil`, ohne dass jemand eine zweite Fassung braucht.
 *
 * GEWARTET WIRD AUSDRÜCKLICH NICHT AUF DIE ERWARTETEN BESCHRIFTUNGEN, so naheliegend das wäre. Ein
 * Setzer, der auf sie wartet, verwandelt JEDE falsche Übersetzung in eine Zeitüberschreitung — und
 * nimmt dem aufrufenden Fall die Aussage weg, die er treffen soll: er könnte nie mehr mit
 * „erwartet X, gefunden Y" rot werden. Gemessen, nicht befürchtet: genau das ist JOB 3576 in
 * seiner ersten Fassung passiert (`h4-harness.ts:387-392`). Der Setzer stellt die Lage her, der
 * Fall urteilt.
 *
 * VIER AUSGÄNGE, alle mit dem, was ein Mensch zum Weiterkommen braucht:
 *   · die Seite meldet einen `pageerror` → Ende mit dessen Text (§9: keine Wartezeit verstreichen
 *     lassen, wenn die Fläche schon kaputt ist); gezählt werden nur NEUE Fehler dieses Schritts.
 *     GEWACHT WIRD AB DEM ERSTEN AUGENBLICK, auch WÄHREND der Aufbau noch läuft — das ist BENs
 *     Korrekturpflicht 3 an Runde 1: dort stand die Fehlerprüfung hinter dem `await goto(...)`, und
 *     eine Seite, die beim Aufbau abstürzt und dann hängt, kam als Navigations-Zeitüberschreitung
 *     heraus. Gemessen in `tests/chr-navigation-sprachen/sprachschritt-ausgaenge.test.ts`, Fall A2:
 *     vorher 4004 ms bis zum Ende der Navigation, jetzt der Text des Fehlers.
 *   · der Aufbau selbst scheitert → Ende mit dem Pfad UND dem Fehler des Aufbaus.
 *   · die Frist läuft ab, der Anker stand aber da → erwartete Sprache, angewandte Sprache, zuletzt
 *     gelesener Text, Wartedauer, Zahl der Blicke.
 *   · die Frist läuft ab und der Anker war nie da → dieselbe Meldung, zusätzlich als
 *     „lastabhaengig" gekennzeichnet (Lehre JOB 3138): dann ist die FLÄCHE nicht fertig geworden.
 *     Die zuletzt gelesene Sprache steht auch dann dabei (BENs zweiter Fund: sie wurde gelesen und
 *     weggeworfen) — sie ist die einzige Angabe, mit der sich „Seite nicht fertig" von „Sprache kam
 *     nicht an" unterscheiden lässt.
 *
 * ZURÜCK KOMMT DIE GEMESSENE LAGE, und zwar die vom RÜCKKEHRPUNKT, also vor jedem weiteren
 * Seitenaufbau. Das ist der Unterschied zwischen einer Zusage und einem Gefühl: in der Messdatei
 * folgt auf diesen Schritt immer ein `messe(...)` mit eigenem Neuaufbau, und der wendet die Sprache
 * seinerseits an — ein Schritt, der GAR NICHT wartet, blieb dort grün (BENs Gegenprobe A). Wer
 * `setzeSprache` benutzt, prüft die Sprache am Rückgabewert, nicht am nächsten Aufbau.
 */
export interface SprachLage {
  /** Die verlangte Sprache. */
  sprache: string;
  /** `<html lang>` am Rückkehrpunkt — gelesen VOR jedem weiteren Seitenaufbau. */
  lang: string;
  /** Was der Warteanker am Rückkehrpunkt zeigte (gekürzt auf 160 Zeichen). */
  text: string;
  /** Wie lange auf den Zustand gewartet wurde, in ms. */
  wartedauer: number;
  /** Wie viele Blicke der Zustand gebraucht hat (1 = beim ersten Blick schon da). */
  versuche: number;
}

const pause = (ms: number): Promise<void> =>
  new Promise((fertig) => {
    setTimeout(fertig, ms);
  });

export async function setzeSprache(
  stand: Stand,
  sprache: string,
  pfad = "/start",
  warteAuf = 'header[data-testid="kopfband"]',
  /** Nur für die Prüfung der Ausgänge selbst: kürzere Frist, engerer Takt. */
  optionen: { fristMs?: number; taktMs?: number } = {},
): Promise<SprachLage> {
  const frist = optionen.fristMs ?? SPRACHE_FRIST_MS;
  const takt = optionen.taktMs ?? SPRACHE_TAKT_MS;
  const seite = stand.seite;
  if (seite === null) {
    throw new Error(`Bühne steht nicht: ${stand.fehler ?? "unbekannt"}`);
  }
  const fehlerVorher = stand.seitenfehler.length;
  const neuerSeitenfehler = (): string | undefined => stand.seitenfehler.slice(fehlerVorher)[0];
  await seite.evaluate(fn(SPRACHE_SETZEN), [SPRACHE_SCHLUESSEL, sprache]);

  // Die Wahl wirkt erst beim nächsten Aufbau (`lib/sprachwahl.ts:35`, `i18n.ts`): der Neuaufbau ist
  // Teil dieses Schritts, eine Messung ohne ihn wäre eine Messung der alten Sprache.
  //
  // AUFBAU UND FEHLERWACHE LAUFEN NEBENEINANDER. Die Wache zählt mit einer eigenen Uhr (`pause`)
  // und nicht über die Seite: eine Seite, die im Aufbau hängt, beantwortet keinen Seitenaufruf
  // mehr — eine Wache, die dafür die Seite fragen müsste, hinge mit ihr.
  let aufbauFertig = false;
  const aufbau = (async (): Promise<string | null> => {
    try {
      await seite.goto(`${ORIGIN}${pfad}`, { waitUntil: "load", timeout: 60_000 });
      return null;
    } catch (e) {
      return `der Aufbau von ${pfad} scheiterte: ${String(e)}`;
    } finally {
      aufbauFertig = true;
    }
  })();
  const wache = (async (): Promise<string | null> => {
    for (;;) {
      const fehler = neuerSeitenfehler();
      if (fehler !== undefined) {
        return fehler;
      }
      if (aufbauFertig) {
        return null;
      }
      await pause(Math.min(takt, 50));
    }
  })();
  const zuerst = await Promise.race([aufbau, wache]);
  // Der Seitenfehler hat immer den Vorrang: er sagt, WARUM der Aufbau nichts wurde.
  const fehlerJetzt = neuerSeitenfehler();
  if (fehlerJetzt !== undefined) {
    throw new Error(
      `Sprache ${sprache}: die Seite meldete einen Fehler statt der Fläche — ${fehlerJetzt}`,
    );
  }
  if (zuerst !== null) {
    throw new Error(`Sprache ${sprache}: ${zuerst}`);
  }

  const wartenAb = Date.now();
  let zuletztLang: string | null = null;
  let zuletztText: string | null = null;
  let ankerGesehen = false;
  let versuche = 0;
  for (;;) {
    const fehler = neuerSeitenfehler();
    if (fehler !== undefined) {
      throw new Error(
        `Sprache ${sprache}: die Seite meldete einen Fehler statt der Fläche — ${fehler}`,
      );
    }
    versuche += 1;
    const gelesen = await seite.evaluate<{
      lang: string;
      da: boolean;
      text: string | null;
    }>(fn(SPRACHE_LESEN), warteAuf);
    // Die gelesene Sprache wird IMMER gemerkt, auch ohne Anker: das Produkt hat geantwortet.
    zuletztLang = gelesen.lang;
    if (gelesen.da) {
      ankerGesehen = true;
      zuletztText = gelesen.text;
      if (gelesen.lang === sprache) {
        return {
          sprache,
          lang: gelesen.lang,
          text: gelesen.text ?? "",
          wartedauer: Date.now() - wartenAb,
          versuche,
        };
      }
    }
    if (Date.now() - wartenAb >= frist) {
      break;
    }
    await seite.waitForTimeout(takt);
  }
  const gewartet = Date.now() - wartenAb;
  const kopf = `Sprache ${sprache}: nach ${gewartet} ms und ${versuche} Blicken`;
  const erwartet = `erwartet <html lang="${sprache}">`;
  const anker = `Anker „${warteAuf}" auf ${pfad}`;
  const gelesen = `zuletzt gelesen lang=${zuletztLang ?? "—"}${zuletztText === null ? "" : ` · „${zuletztText}"`}`;
  // Die Lage entscheidet über die Aussage: stand der Anker nie da, ist über die FLÄCHE nichts
  // gesagt — dann ist die Umgebung nicht fertig geworden und nicht das Produkt falsch.
  throw new Error(
    ankerGesehen
      ? `${kopf} hat die Seite die Sprache nicht angewandt (${erwartet}, ${anker}, ${gelesen}).`
      : `${kopf} war der ${anker} überhaupt nicht da (${erwartet}, ${gelesen}) — lastabhaengig: die Seite ist nicht fertig geworden, über die FLÄCHE ist damit nichts gesagt.`,
  );
}

export async function beende(stand: Stand): Promise<void> {
  await stand.browser?.close();
  await stand.app?.close();
}

export function zielbildText(): string {
  return existsSync(ZIELBILD) ? readFileSync(ZIELBILD, "utf8") : "";
}
