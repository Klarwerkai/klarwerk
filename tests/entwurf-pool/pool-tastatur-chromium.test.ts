// ================================================================================================
// AUFNAHME entwurf-in-gemeinsamen-pool-geben · K2 — „IN DEN POOL GEBEN" NUR MIT DER TASTATUR, IM
// ECHTEN CHROMIUM, DE UND EN.
// ================================================================================================
//
// BENS BEFUND (Nacharbeit 2): `pool-oberflaeche-mounted.test.tsx` setzt in jsdom den Fokus
// programmatisch und erzeugt nach einem künstlichen Enter selbst den `click()`. Echte
// Tabulatornavigation und die Aktivierung durch den Browser misst sie damit nicht.
//
// DIESE DATEI GEHT DIE K2-FOLGE IM ECHTEN BROWSER, ausschliesslich mit echten Tasten:
//   Start → (Tab) Kopfband „Meine Entwürfe" → (Enter) Übersicht → (Tab) bis „In den Pool geben"
//   genau dieses Entwurfs → (Enter) → am SERVER `imPool: true`; der zweite Entwurf bleibt privat.
//
// REGELN (übernommen aus `tests/entwuerfe-verwalten/abnahmefolge-tastatur-chromium.test.ts`):
//   · KEIN `focus()`, KEIN `click()`, KEIN `dispatchEvent` aus dem Prüfcode. Die Seite wird je
//     Sprache einmal über die Adresse betreten; jeder Ortswechsel danach entsteht aus einer Taste.
//     Ein Ziel wird vom AKTUELLEN Fokus aus mit Tab erreicht (`tasteBis`); liegt es nicht im
//     Tabulatorlauf, ist der Fall rot.
//   · Der Server ist die ECHTE Fastify-App (`buildApp`) hinter jedem `/api/*`-Aufruf. „Im Pool"
//     und „bleibt privat" werden am Bestand gemessen, nicht an der Fläche.
//   · Die Beschriftung steht wörtlich da (unabhängiges Bedeutungsmerkmal) UND wird gegen den
//     i18n-Wert gehalten.
//
// WAS DIESE DATEI NICHT IST: eine menschliche Bedienung und keine Screenreader-Prüfung.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import i18n from "../../apps/web/src/i18n";
import { DRAFT_QUERY_STORAGE_KEY } from "../../apps/web/src/lib/draftListView";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const WURZEL = resolve(process.cwd());
const DIST = resolve(WURZEL, "apps/web/dist");
// `localhost`: nur dort führt Chromium einen sicheren Kontext (`crypto.randomUUID`).
const ORIGIN = "http://localhost";

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
  ".mjs": "application/javascript",
};

type BrowserFn = (arg: unknown) => unknown;
const fn = (quelle: string): BrowserFn =>
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
interface Seite {
  route(url: string, handler: (route: Route) => Promise<void>): Promise<void>;
  addInitScript(script: string): Promise<void>;
  on(ereignis: string, handler: (arg: unknown) => void): void;
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  waitForFunction(f: BrowserFn, arg?: unknown, opts?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(f: BrowserFn, arg?: unknown): Promise<T>;
  keyboard: { press(taste: string): Promise<void>; type(text: string): Promise<void> };
}
interface Browser {
  newPage(opts: Record<string, unknown>): Promise<Seite>;
  close(): Promise<void>;
}

function distDatei(pfadname: string): { body: Buffer; typ: string } {
  const rel = pfadname === "/" ? "/index.html" : pfadname;
  const datei = join(DIST, rel);
  if (existsSync(datei) && statSync(datei).isFile()) {
    return { body: readFileSync(datei), typ: MIME[extname(datei)] ?? "application/octet-stream" };
  }
  return { body: readFileSync(join(DIST, "index.html")), typ: MIME[".html"] ?? "text/html" };
}

let browser: Browser | null = null;
let app: ReturnType<typeof buildApp> | null = null;
let seite: Seite | null = null;
let token = "";
let fehler: string | null = null;
const seitenfehler: string[] = [];

async function api(
  method: "GET" | "POST",
  url: string,
  payload?: Record<string, unknown>,
): Promise<{ status: number; json: unknown }> {
  const a = app as NonNullable<typeof app>;
  const res = await a.inject({
    method,
    url,
    headers: { authorization: `Bearer ${token}` },
    ...(payload ? { payload } : {}),
  });
  return { status: res.statusCode, json: res.json() as unknown };
}

/** `imPool` des Entwurfs AM SERVER — nicht, was die Fläche glaubt. */
async function imPoolAmServer(id: string): Promise<unknown> {
  const res = await api("GET", `/api/drafts/${id}`);
  expect(res.status).toBe(200);
  return (res.json as { imPool?: unknown }).imPool;
}

const FOKUS_PASST =
  "(sel) => { const a = document.activeElement; return !!a && a !== document.body && a.matches(sel); }";
const FOKUS_BESCHREIBUNG = `() => { const a = document.activeElement; if (!a) { return '(nichts)'; } return a.tagName + ' ' + (a.getAttribute('data-testid') || '') + ' «' + (a.textContent || a.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 50) + '»'; }`;

/** Vom AKTUELLEN Fokus aus mit Tab gehen, bis das Ziel fokussiert ist — sonst rot. */
async function tasteBis(selektor: string, was: string, hoechstens = 150): Promise<void> {
  const s = seite as Seite;
  const pruefe = (): Promise<boolean> => s.evaluate<boolean>(fn(FOKUS_PASST), selektor);
  if (await pruefe()) {
    return;
  }
  for (let i = 0; i < hoechstens; i++) {
    await s.keyboard.press("Tab");
    if (await pruefe()) {
      return;
    }
  }
  const zuletzt = await s.evaluate<string>(fn(FOKUS_BESCHREIBUNG));
  throw new Error(
    `${was}: mit ${hoechstens}× Tab vom aktuellen Fokus aus nicht erreicht (zuletzt fokussiert: ${zuletzt})`,
  );
}

async function warteAuf(quelle: string, arg?: unknown, frist = 20_000): Promise<void> {
  await (seite as Seite).waitForFunction(fn(quelle), arg, { timeout: frist });
}

beforeAll(async () => {
  try {
    if (!existsSync(join(DIST, "index.html"))) {
      throw new Error("apps/web/dist fehlt — vorher ./tools/build (im Tor laeuft es immer)");
    }
    app = buildApp(buildServices());
    await app.ready();
    const post = `anna+${Math.random().toString(36).slice(2, 8)}@pool-tastatur.test`;
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Anna", email: post, password: "geheim12345" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: post, password: "geheim12345" },
    });
    token = (login.json() as { token: string }).token;

    const require = createRequire(import.meta.url);
    const { chromium } = require("playwright") as {
      chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
    };
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
    });
    seite = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    seite.on("pageerror", (e: unknown) => {
      seitenfehler.push(String(e).split("\n")[0] ?? "");
    });
    await seite.addInitScript(
      `try { localStorage.setItem("kw.designTheme", "modern"); } catch (e) {}`,
    );
    const a = app;
    await seite.route(`${ORIGIN}/**`, async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.pathname.startsWith("/api/")) {
        const k: Record<string, string> = {};
        for (const [n, v] of Object.entries(req.headers())) {
          if (!["host", "origin", "referer", "cookie"].includes(n.toLowerCase())) k[n] = v;
        }
        k.authorization = `Bearer ${token}`;
        const body = req.postData();
        const res = await a.inject({
          method: req.method() as "GET",
          url: url.pathname + url.search,
          headers: k,
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
  } catch (e) {
    fehler = String(e).split("\n").slice(0, 3).join(" | ");
  }
}, 180_000);

afterAll(async () => {
  await browser?.close();
  await app?.close();
  await i18n.changeLanguage("de");
}, 60_000);

describe("K2 · „In den Pool geben“ nur mit Tab/Enter im echten Chromium", () => {
  for (const [sprache, geben, nehmen] of [
    ["de", "In den Pool geben", "Aus dem Pool nehmen"],
    ["en", "Share to pool", "Remove from pool"],
  ] as const) {
    it(`${sprache}: Start → (Tab/Enter) Meine Entwürfe → (Tab) „${geben}“ → (Enter) → am Server im Pool, der zweite Entwurf bleibt privat`, async () => {
      expect(fehler, "Prüfstand nicht aufgebaut").toBeNull();
      const s = seite as Seite;
      await i18n.changeLanguage(sprache);

      // Je Sprache zwei eigene Entwürfe: einer wird geteilt, der andere ist die Gegenprobe.
      const anlegen = async (title: string): Promise<string> => {
        const res = await api("POST", "/api/drafts", {
          title,
          statement: "Zwischenstand an Linie 4.",
          type: "best_practice",
          category: "Anlage",
        });
        expect([200, 201]).toContain(res.status);
        return (res.json as { id: string }).id;
      };
      const ziel = await anlegen(`Pumpe P7 teilen (${sprache})`);
      const privat = await anlegen(`Notizen privat (${sprache})`);
      expect(await imPoolAmServer(ziel)).toBeUndefined();
      expect(await imPoolAmServer(privat)).toBeUndefined();

      // ── 0 · EINMAL über die Adresse; Sprache über den Speicher des Produkts, gemerkter
      // Suchfilter entfernt. Danach nur Tasten.
      await s.goto(`${ORIGIN}/start`, { waitUntil: "load", timeout: 60_000 });
      await s.evaluate(
        fn(
          `(a) => { localStorage.setItem('kw.sprache', a.sprache); localStorage.removeItem(a.schluessel); }`,
        ),
        { sprache, schluessel: DRAFT_QUERY_STORAGE_KEY },
      );
      await s.goto(`${ORIGIN}/start`, { waitUntil: "load", timeout: 60_000 });
      await warteAuf(`() => document.querySelector('[data-kopfband-punkt="entwuerfe"]') !== null`);
      expect(
        await s.evaluate<string>(fn(`() => document.documentElement.getAttribute('lang') || ''`)),
        "die Sprachwahl griff nicht",
      ).toBe(sprache);

      // ── 1 · ZUR LISTE: Tab bis zum Kopfband-Punkt, Enter.
      await tasteBis('[data-kopfband-punkt="entwuerfe"]', "Kopfband „Meine Entwürfe“");
      await s.keyboard.press("Enter");
      await warteAuf(`() => location.pathname === '/entwuerfe'`);
      // Der Knopf erscheint erst, wenn die Sitzung die Autorin bestätigt (fail-closed gilt nur für
      // Pool-Entwürfe; dieser ist noch privat und trägt ihn deshalb sofort).
      await warteAuf(
        `(id) => document.querySelector('[data-entwurf-pool="' + id + '"]') !== null`,
        ziel,
      );

      // ── 2 · DIE KLAR BENANNTE AKTION — per Tab erreicht, sichtbar fokussiert.
      const knopf = `[data-entwurf-pool="${ziel}"]`;
      await tasteBis(knopf, `„${geben}“`);
      const beschriftung = await s.evaluate<string>(
        fn(`() => (document.activeElement.textContent || '').replace(/\\s+/g, ' ').trim()`),
      );
      expect(beschriftung).toBe(geben);
      expect(beschriftung).toBe(String(i18n.t("entwurfspool.aktion.geben")));
      expect(
        await s.evaluate<string>(fn("() => document.activeElement.tagName")),
        "die Aktion ist kein echter Knopf",
      ).toBe("BUTTON");
      expect(
        await s.evaluate<string>(fn("() => getComputedStyle(document.activeElement).outlineStyle")),
        "kein sichtbarer Fokusring",
      ).not.toBe("none");

      // ── 3 · AUSLÖSEN MIT ENTER — die Aktivierung macht der Browser, nicht der Prüfcode.
      await s.keyboard.press("Enter");
      await warteAuf(
        `(a) => ((document.querySelector('[data-entwurf-pool="' + a.id + '"]') || {}).textContent || '').trim() === a.wort`,
        { id: ziel, wort: nehmen },
      );

      // ── 4 · AM SERVER: genau dieser Entwurf liegt im Pool, der zweite bleibt privat.
      expect(await imPoolAmServer(ziel)).toBe(true);
      expect(await imPoolAmServer(privat)).toBeUndefined();
      // Die Zeile sagt es mit der Marke; die Zeile des privaten Entwurfs nicht.
      const marken = await s.evaluate<{ ziel: boolean; privat: boolean }>(
        fn(
          `(a) => ({ ziel: !!document.querySelector('[data-entwurfszeile="' + a.ziel + '"] [data-testid="entwurfsliste-eintrag-pool"]'), privat: !!document.querySelector('[data-entwurfszeile="' + a.privat + '"] [data-testid="entwurfsliste-eintrag-pool"]') })`,
        ),
        { ziel, privat },
      );
      expect(marken).toEqual({ ziel: true, privat: false });
    }, 180_000);
  }

  it("P · die Seite hat während der Folge nichts geworfen", () => {
    expect(fehler, "Prüfstand nicht aufgebaut").toBeNull();
    expect(seitenfehler).toEqual([]);
  });
});
