// ================================================================================================
// JOB 3060 · H1 — DIE GETEILTE MESSSTRECKE: die echte, gebaute App in Chromium, angemeldet.
// ================================================================================================
//
// Muster: tests/design/zielbild-validierung.test.ts (JOB 2618 D5) und zielbild-konsole-start.test.ts
// (JOB 3015 D5). Die ECHTE Anwendung (`apps/web/dist`, das Ergebnis von `./tools/build`) wird in
// Chromium unter `http://klarwerk.test/` geladen; Playwright bedient `/assets/*`, `index.html` usw.
// aus `dist` und reicht JEDEN `/api/*`-Aufruf an die ECHTE Fastify-App (`buildApp`, echte Dienste,
// echter Bestand) weiter — mit dem Bearer der echten Anmeldung. Das erste Konto ist Admin
// (`service.ts`: erstes Konto = Admin, freigegeben).
//
// Drei Dateien teilen sich diese Strecke (Hülle, Erklärtext, Funktionsinventar); die Werte des
// Mockups (`design/klarwerk/Main.dc.html`) liest jede selbst über `zielStil`/`zielProp`.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import { buildApp, buildServices } from "../../services/app/src/build-app";

export const WURZEL = resolve(process.cwd());
export const DIST = resolve(WURZEL, "apps/web/dist");
/** Das Mockup der Hülle (alle acht Artboards tragen dasselbe Kopfband; Main.dc.html ist die Quelle). */
export const ZIELBILD = "/Users/peterkohnert/klarwerk_steuerung/design/klarwerk/Main.dc.html";
export const ORIGIN = "http://klarwerk.test";

// ---- Das Zielbild lesen ---------------------------------------------------------------------------
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
/** Hex → `rgb(r, g, b)` (die Serialisierung von getComputedStyle); alles andere unveraendert. */
export function kanon(wert: string | null): string | null {
  if (wert === null) return null;
  const m = /^#([0-9a-f]{6})$/i.exec(wert.trim());
  if (!m) return wert.trim();
  const h = m[1] ?? "";
  return `rgb(${Number.parseInt(h.slice(0, 2), 16)}, ${Number.parseInt(h.slice(2, 4), 16)}, ${Number.parseInt(h.slice(4, 6), 16)})`;
}
/** `svg`-Attribute des ersten Zielbild-Symbols mit dieser Strichfarbe (width, stroke-width). */
export function zielSymbol(
  ziel: string,
  strich: string,
): { width: string; strichBreite: string } | null {
  const re = new RegExp(
    `<svg width="(\\d+)"[^>]*stroke="${strich}"[^>]*stroke-width="([^"]+)"[^>]*>`,
  );
  const m = re.exec(ziel);
  if (!m) return null;
  return { width: m[1] ?? "", strichBreite: m[2] ?? "" };
}
/** Der Wortlaut eines `<div style="…anker…">TEXT</div>` — der erste Treffer. */
export function zielText(ziel: string, anker: string): string | null {
  const re = /<div style="([^"]*)">([^<]*)(?:<|$)/g;
  for (let m = re.exec(ziel); m !== null; m = re.exec(ziel)) {
    if ((m[1] ?? "").includes(anker)) return (m[2] ?? "").trim();
  }
  return null;
}

// ---- Die echte App in Chromium -------------------------------------------------------------------
export type BrowserFn = (arg: unknown) => unknown;
export const fn = (quelle: string): BrowserFn =>
  new Function("arg", `return (${quelle})(arg);`) as BrowserFn;

export interface Route {
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
  fill(selector: string, value: string): Promise<void>;
  press(selector: string, key: string): Promise<void>;
  click(selector: string, opts?: Record<string, unknown>): Promise<void>;
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  url(): string;
  keyboard: { press(key: string): Promise<void> };
}
export interface Browser {
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
export const LESEN_PSEUDO =
  "([sel, pseudo, eig]) => { const el = document.querySelector(sel); return el ? getComputedStyle(el, pseudo).getPropertyValue(eig) : null; }";
export const TEXT =
  "(sel) => { const el = document.querySelector(sel); return el ? (el.textContent || '').trim() : null; }";

export interface Strecke {
  seite: Seite;
  browser: Browser;
  app: ReturnType<typeof buildApp>;
  services: ReturnType<typeof buildServices>;
  token: string;
  autorId: string;
  version: string;
  schliessen(): Promise<void>;
}

/**
 * Baut Server, Konto und Browser auf. `stufe2` setzt den persistierten Stufe-2-Schalter
 * (`kw.stufe2.v1`, lib/stufe2Storage.ts) VOR dem ersten Skript; `theme` den Design-Schalter
 * (`kw.designTheme`) — ohne Angabe gilt die Vorgabe des Produkts (seit JOB 3060: modern).
 */
export async function strecke(opts: {
  email: string;
  name?: string;
  stufe2?: boolean;
  theme?: "modern" | "classic";
  viewport?: { width: number; height: number };
  hinweisQuittieren?: boolean;
}): Promise<Strecke> {
  if (!existsSync(ZIELBILD)) {
    throw new Error(`Zielbild nicht lesbar: ${ZIELBILD}`);
  }
  if (!existsSync(join(DIST, "index.html"))) {
    throw new Error("apps/web/dist fehlt — vorher ./tools/build (im Tor laeuft es immer)");
  }
  const services = buildServices();
  const app = buildApp(services);
  await app.ready();
  const name = opts.name ?? "Peter Kohnert";
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name, email: opts.email, password: "geheim12345" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: opts.email, password: "geheim12345" },
  });
  const token = (login.json() as { token: string }).token;
  const me = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { authorization: `Bearer ${token}` },
  });
  const autorId = (me.json() as { id: string }).id;
  if (opts.hinweisQuittieren !== false) {
    // Der Rechtshinweis (legal/NoticeBanner.tsx) wird wie von einer wiederkehrenden Nutzerin
    // quittiert — er ist ein Band UNTER <main> und nicht Teil des Kopfbands.
    await app.inject({
      method: "POST",
      url: "/api/auth/notice",
      headers: { authorization: `Bearer ${token}` },
    });
  }

  const require = createRequire(import.meta.url);
  const { chromium } = require("playwright") as {
    chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
  };
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
  });
  const version = browser.version();
  // Das Mockup ist 1280×800 (canvas.json) — dasselbe Fenster.
  const seite = await browser.newPage({ viewport: opts.viewport ?? { width: 1280, height: 800 } });
  const init: string[] = [];
  if (opts.theme) {
    init.push(`localStorage.setItem("kw.designTheme", ${JSON.stringify(opts.theme)});`);
  }
  if (opts.stufe2) {
    init.push(`localStorage.setItem("kw.stufe2.v1", "1");`);
  }
  if (init.length > 0) {
    await seite.addInitScript(`try { ${init.join(" ")} } catch (e) {}`);
  }
  await seite.route(`${ORIGIN}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname.startsWith("/api/")) {
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
  return {
    seite,
    browser,
    app,
    services,
    token,
    autorId,
    version,
    schliessen: async () => {
      await browser.close();
      await app.close();
    },
  };
}

/** Lädt eine Route der App und wartet, bis das Kopfband steht. */
export async function oeffne(seite: Seite, pfad: string): Promise<void> {
  await seite.goto(`${ORIGIN}${pfad}`, { waitUntil: "load", timeout: 60_000 });
  await seite.waitForFunction(
    fn(`() => document.querySelector('header[data-testid="kopfband"]') !== null`),
    undefined,
    { timeout: 30_000 },
  );
}

/** Wartet, bis die Bedingung in der Seite gilt. */
export async function warteBis(seite: Seite, quelle: string, arg?: unknown): Promise<void> {
  await seite.waitForFunction(fn(quelle), arg, { timeout: 30_000 });
}
