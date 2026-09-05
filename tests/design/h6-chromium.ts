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
          body: res.body,
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

export async function beende(stand: Stand): Promise<void> {
  await stand.browser?.close();
  await stand.app?.close();
}

export function zielbildText(): string {
  return existsSync(ZIELBILD) ? readFileSync(ZIELBILD, "utf8") : "";
}
