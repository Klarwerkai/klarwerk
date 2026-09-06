// ================================================================================================
// JOB 3117 · UX-13 — DIE BÜHNE FÜR DAS SCHMALE PROFIL: die gebaute Seite in Chromium, bei 320 px.
// ================================================================================================
//
// WARUM EINE EIGENE BÜHNE UND NICHT `tests/design/h6-chromium.ts`:
// Der H6-Aufbau meldet ein FEST VERDRAHTETES Konto an („Pedi", `pedi@job3065.test`). Genau daran
// wäre der Schaden von UX-13 unsichtbar: „Pedi" ist so kurz, dass es auch bei 320 px in die Zeile
// passt. Gemessen werden muss das Konto der Gegenprüfung N-0030 („Codex Abnahme",
// `codex-abnahme@demo.klarwerk`) und ein noch längeres. Diese Datei ändert `h6-chromium.ts`
// deshalb NICHT, sondern benutzt seine Bausteine (`DIST`, `ORIGIN`, `fn`) und bringt nur das mit,
// was dort fehlt: ein wählbares Konto, eine änderbare Fensterbreite und eine änderbare Sprache.
//
// EIN BROWSER, MEHRERE APPS. Mehr Chromium-Instanzen kippen im Gesamttor fremde Browsertests
// (Begründung in `h6-chromium.ts:317-324`). Ein zweites Konto entsteht deshalb nicht über einen
// zweiten Browser, sondern über eine zweite Fastify-Instanz: die Weiche liest App und Bearer bei
// JEDEM Aufruf aus `buehne.aktuell`, `wechsleKonto` tauscht beides und lädt die Seite neu.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join } from "node:path";

import { buildApp, buildServices } from "../../services/app/src/build-app";
import { type BrowserFn, DIST, ORIGIN, fn } from "../design/h6-chromium";

/** Der Speicherschlüssel der Sprachwahl (`apps/web/src/lib/sprachwahl.ts:22`). */
const SPRACHE_STORAGE_KEY = "kw.sprache";

export interface Konto {
  name: string;
  email: string;
}

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
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  waitForFunction(fn: BrowserFn, arg?: unknown, opts?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(fn: BrowserFn, arg?: unknown): Promise<T>;
  on(ereignis: string, hoerer: (arg: unknown) => void): void;
}

interface Browser {
  version(): string;
  newPage(opts: Record<string, unknown>): Promise<Seite>;
  close(): Promise<void>;
}

type App = ReturnType<typeof buildApp>;

export interface Buehne {
  browser: Browser | null;
  seite: Seite | null;
  /** Die App, die die Weiche gerade bedient, samt Bearer des angemeldeten Kontos. */
  aktuell: { app: App; token: string } | null;
  /** Alle gestarteten Instanzen — jede wird am Ende geschlossen. */
  apps: App[];
  fehler: string | null;
  version: string;
  theme: string;
  seitenfehler: string[];
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

/** Eine frische Instanz, deren ERSTES Konto (= Administrator) `konto` ist — samt Bearer. */
async function neueApp(konto: Konto): Promise<{ app: App; token: string }> {
  const app = buildApp(buildServices());
  await app.ready();
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: konto.name, email: konto.email, password: "job3117geheim" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: konto.email, password: "job3117geheim" },
  });
  return { app, token: (login.json() as { token: string }).token };
}

export async function starteBuehne(konto: Konto, breite: number, hoehe: number): Promise<Buehne> {
  const buehne: Buehne = {
    browser: null,
    seite: null,
    aktuell: null,
    apps: [],
    fehler: null,
    version: "",
    theme: "",
    seitenfehler: [],
  };
  try {
    if (!existsSync(join(DIST, "index.html"))) {
      throw new Error("apps/web/dist fehlt — vorher ./tools/build (im Tor läuft es immer)");
    }
    const erste = await neueApp(konto);
    buehne.apps.push(erste.app);
    buehne.aktuell = erste;

    const require = createRequire(import.meta.url);
    const { chromium } = require("playwright") as {
      chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
    };
    buehne.browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
    });
    buehne.version = buehne.browser.version();
    const seite = await buehne.browser.newPage({ viewport: { width: breite, height: hoehe } });
    buehne.seite = seite;
    seite.on("pageerror", (e) => buehne.seitenfehler.push(String(e).slice(0, 200)));
    // Dasselbe Thema wie in den H6-Messungen — die Gegenprüfung N-0030 lief auf „Modern".
    await seite.addInitScript(
      `try { localStorage.setItem("kw.designTheme", "modern"); } catch (e) {}`,
    );
    await seite.route(`${ORIGIN}/**`, async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.pathname.startsWith("/api/")) {
        const stand = buehne.aktuell;
        if (stand === null) {
          await route.fulfill({ status: 503, body: "{}" });
          return;
        }
        const kopf: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.headers())) {
          if (!["host", "origin", "referer", "cookie"].includes(k.toLowerCase())) kopf[k] = v;
        }
        kopf.authorization = `Bearer ${stand.token}`;
        const body = req.postData();
        const res = await stand.app.inject({
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
    await oeffneProfil(buehne);
    buehne.theme = await seite.evaluate<string>(
      fn(`() => document.documentElement.getAttribute('data-theme') || 'classic (kein Attribut)'`),
    );
  } catch (e) {
    buehne.fehler = String(e).split("\n").slice(0, 3).join(" | ");
  }
  return buehne;
}

/** `/profil` öffnen und warten, bis die Zeilenkarte wirklich steht. */
export async function oeffneProfil(buehne: Buehne): Promise<void> {
  const seite = buehne.seite;
  if (seite === null) {
    return;
  }
  await seite.goto(`${ORIGIN}/profil`, { waitUntil: "load", timeout: 60_000 });
  await seite.waitForFunction(
    fn(
      `() => document.querySelector('[data-testid="zeile-email"]') !== null
        && document.querySelector('[data-testid="zeile-abmelden"]') !== null`,
    ),
    undefined,
    { timeout: 30_000 },
  );
}

/** Fensterbreite ändern und die Seite neu aufbauen lassen (kein zweiter Browser). */
export async function setzeBreite(buehne: Buehne, breite: number, hoehe: number): Promise<void> {
  const seite = buehne.seite;
  if (seite === null || buehne.fehler !== null) {
    return;
  }
  try {
    await seite.setViewportSize({ width: breite, height: hoehe });
    await oeffneProfil(buehne);
  } catch (e) {
    buehne.fehler = String(e).split("\n").slice(0, 3).join(" | ");
  }
}

/** Die Sprachwahl des Produkts setzen (`kw.sprache`) und neu laden. */
export async function setzeSprache(buehne: Buehne, sprache: string): Promise<void> {
  const seite = buehne.seite;
  if (seite === null || buehne.fehler !== null) {
    return;
  }
  try {
    await seite.evaluate<null>(
      fn(
        "([schluessel, wert]) => { try { localStorage.setItem(schluessel, wert); } catch (e) {} return null; }",
      ),
      [SPRACHE_STORAGE_KEY, sprache],
    );
    await oeffneProfil(buehne);
  } catch (e) {
    buehne.fehler = String(e).split("\n").slice(0, 3).join(" | ");
  }
}

/** Ein anderes Konto: frische Instanz, deren erstes Konto `konto` ist — dann Seite neu aufbauen. */
export async function wechsleKonto(buehne: Buehne, konto: Konto): Promise<void> {
  if (buehne.seite === null || buehne.fehler !== null) {
    return;
  }
  try {
    const naechste = await neueApp(konto);
    buehne.apps.push(naechste.app);
    buehne.aktuell = naechste;
    await oeffneProfil(buehne);
  } catch (e) {
    buehne.fehler = String(e).split("\n").slice(0, 3).join(" | ");
  }
}

export async function beendeBuehne(buehne: Buehne): Promise<void> {
  await buehne.browser?.close();
  for (const app of buehne.apps) {
    await app.close();
  }
}
