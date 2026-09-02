// ================================================================================================
// JOB 2935 · D1 — WAS DER UMBAU DER VALIDIERUNGSKARTE SICHTBAR GEMACHT HAT, gemessen an der in
// Chromium GEMOUNTETEN echten Anwendung.
// ================================================================================================
//
// WOZU DIESE DATEI NEBEN `zielbild-validierung.test.ts`: Jener Test misst die neun WERTE des
// Zielbild-Fussbands (Abstaende, Linie, Farben) und haelt sie fest. Er kann aber nicht sehen, ob das
// Fussband ueberhaupt ein Fussband IST — dieselben neun Werte waeren auch an einer schmalen Saeule
// am rechten Kartenrand messbar. Genau so war es bis zu diesem Durchgang: Entscheidung, Zuweisung
// und Verwaltung standen in einer Spalte neben dem Inhalt, und weil sie ihn auf die halbe Breite
// druckten, WURDE DER TITEL DES WISSENSOBJEKTS ABGESCHNITTEN („Project equipment design g…").
//
// Das ist der Schaden, den Pedi mit „peinlich" gemeint hat, und er ist keine Pixelfrage: auf einem
// Pruefboard ist der Titel die einzige Angabe, an der man die Karten auseinanderhaelt.
//
// DREI SAETZE, DIE DER UMBAU ZUSAGT — jeder einzeln gemessen, keiner aus dem Quelltext gelesen:
//   F1  Das Fussband liegt UNTER dem Inhalt, nicht daneben.
//   F2  Der Titel steht vollstaendig da (keine Ellipse mehr).
//   F3  Kategorie und Erstellungsangabe sind durch einen Mittelpunkt getrennt (Zielbild Z. 54) —
//       sie standen auf voller Breite sonst ohne Trenner nebeneinander.
//
// AUFBAU wie in `zielbild-validierung.test.ts`: die ECHTE Anwendung aus `apps/web/dist` in Chromium,
// jeder `/api/*`-Aufruf an die ECHTE Fastify-App, Theme „modern" ueber den Produktschalter gesetzt.
// Kein Nachbau, kein Mock — React mountet `Validation.tsx` selbst, mit einem echten Wissensobjekt.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import { buildApp, buildServices } from "../../services/app/src/build-app";

const DIST = resolve(process.cwd(), "apps/web/dist");
const ORIGIN = "http://klarwerk.test";
const HINWEIS_TEXT = "* Rückfrage und Ablehnung brauchen eine Begründung.";
// Lang genug, dass er in der alten halben Kartenbreite sicher abgeschnitten wurde.
const TITEL = "Project equipment design guide Rev. 0.91";

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
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  waitForFunction(fn: BrowserFn, arg?: unknown, opts?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(fn: BrowserFn, arg?: unknown): Promise<T>;
}
interface Browser {
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

let browser: Browser | null = null;
let seite: Seite | null = null;
let app: ReturnType<typeof buildApp> | null = null;
let fehler: string | null = null;

function distDatei(pfadname: string): { body: Buffer; typ: string } {
  const datei = join(DIST, pfadname === "/" ? "/index.html" : pfadname);
  if (existsSync(datei) && statSync(datei).isFile()) {
    return { body: readFileSync(datei), typ: MIME[extname(datei)] ?? "application/octet-stream" };
  }
  return { body: readFileSync(join(DIST, "index.html")), typ: MIME[".html"] ?? "text/html" };
}

/** In der Seite: Karte, Titel-Link, Fussband (Elternteil des Hinweises) und Erstellungsangabe messen. */
const MESSEN = `([hinweisText, titel]) => {
  const karte = document.querySelector('[data-testid="validation-row"]');
  if (!karte) return null;
  const hinweis = [...karte.querySelectorAll('p')].find((p) => (p.textContent || '').trim() === hinweisText);
  if (!hinweis) return null;
  const band = hinweis.parentElement;
  const titelEl = [...karte.querySelectorAll('a')].find((a) => (a.textContent || '').trim() === titel);
  const etiketten = karte.querySelector('[data-testid="validation-card-labels"]');
  const erstellt = etiketten
    ? [...etiketten.children].find((el) => /\\d{2}\\.\\d{2}\\.\\d{4}/.test(el.textContent || ''))
    : null;
  // Der Inhaltsblock ist das Geschwisterelement VOR dem Band — gegen ihn wird gemessen, nicht gegen
  // den Titel allein: die alte Saeule begann zwar unter der Titelzeile, stand aber neben dem Block.
  const inhalt = band.previousElementSibling;
  const kasten = (el) => { const r = el.getBoundingClientRect(); return { oben: r.top, unten: r.bottom, links: r.left, rechts: r.right, breite: r.width }; };
  return {
    karte: kasten(karte),
    band: kasten(band),
    inhalt: inhalt ? kasten(inhalt) : null,
    titel: titelEl ? kasten(titelEl) : null,
    // F2: schneidet der Titel ab? scrollWidth > clientWidth heisst: Text laenger als sein Kasten.
    titelText: titelEl ? (titelEl.textContent || '').trim() : null,
    titelUeberlauf: titelEl ? titelEl.scrollWidth - titelEl.clientWidth : null,
    // F3: der Mittelpunkt ist CSS-Inhalt (::before) — nicht im textContent, deshalb hier gelesen.
    trenner: erstellt ? getComputedStyle(erstellt, '::before').content : null,
    erstelltText: erstellt ? (erstellt.textContent || '').trim() : null,
    knoepfeImBand: [...band.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\\*/g, '').trim()).filter(Boolean),
  };
}`;

interface Kasten {
  oben: number;
  unten: number;
  links: number;
  rechts: number;
  breite: number;
}
interface Messung {
  karte: Kasten;
  band: Kasten;
  inhalt: Kasten | null;
  titel: Kasten | null;
  titelText: string | null;
  titelUeberlauf: number | null;
  trenner: string | null;
  erstelltText: string | null;
  knoepfeImBand: string[];
}
let m: Messung | null = null;

describe("JOB 2935 · D1 · die Validierungskarte traegt ihr Fussband unter dem Inhalt — echte Seite in Chromium", () => {
  beforeAll(async () => {
    try {
      if (!existsSync(join(DIST, "index.html"))) {
        throw new Error("apps/web/dist fehlt — vorher ./tools/build (im Tor laeuft es immer)");
      }
      const services = buildServices();
      app = buildApp(services);
      await app.ready();
      await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "Pedi", email: "pedi@job2935.test", password: "geheim12345" },
      });
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "pedi@job2935.test", password: "geheim12345" },
      });
      const token = (login.json() as { token: string }).token;
      const me = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { authorization: `Bearer ${token}` },
      });
      const autorId = (me.json() as { id: string }).id;
      await services.ko.create({
        title: TITEL,
        statement: "Halterungen und Profile ohne waagerechte Oberseiten ausfuehren.",
        type: "best_practice",
        category: "Allgemein",
        author: autorId,
      } as never);

      const require = createRequire(import.meta.url);
      const { chromium } = require("playwright") as {
        chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
      };
      browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
      });
      seite = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await seite.addInitScript(
        `try { localStorage.setItem("kw.designTheme", "modern"); } catch (e) {}`,
      );
      const a = app;
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
          const res = await a.inject({
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
      await seite.goto(`${ORIGIN}/validierung`, { waitUntil: "load", timeout: 60_000 });
      await seite.waitForFunction(
        fn(
          `(t) => [...document.querySelectorAll('p')].some((p) => (p.textContent || '').trim() === t)`,
        ),
        HINWEIS_TEXT,
        { timeout: 30_000 },
      );
      m = await seite.evaluate<Messung | null>(fn(MESSEN), [HINWEIS_TEXT, TITEL]);
      console.info(`JOB 2935 D1 · Messung ${JSON.stringify(m)}`);
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 3).join(" | ");
    }
  }, 120_000);

  // Dieselbe Grenze wie in `zielbild-validierung.test.ts`: das Aufraeumen (Chromium und Fastify
  // schliessen) braucht unter der Last des Gesamttors mehr als die zehn Sekunden, die vitest einem
  // Hook ohne eigene Angabe gibt. Kein Messwert haengt daran.
  afterAll(async () => {
    await browser?.close();
    await app?.close();
  }, 60_000);

  it("S · die echte Karte steht, und das Band traegt die drei Entscheidungsknoepfe", () => {
    expect(fehler).toBeNull();
    expect(m).not.toBeNull();
    expect(m?.knoepfeImBand).toEqual(
      expect.arrayContaining(["Freigeben", "Rückfrage", "Ablehnen"]),
    );
  });

  it("F1 · das Fussband liegt UNTER dem Inhaltsblock, nicht daneben — gleiche linke Kante, volle Kartenbreite", () => {
    expect(fehler).toBeNull();
    const inhalt = m?.inhalt;
    const band = m?.band;
    const karte = m?.karte;
    expect(inhalt, "Inhaltsblock vor dem Band nicht gefunden").toBeTruthy();
    if (!inhalt || !band || !karte) return;
    // Daneben hiesse: das Band beginnt auf der Hoehe des Inhalts. Darunter heisst: es beginnt erst,
    // wenn der Inhaltsblock zu Ende ist. Die alte Saeule begann zwar unterhalb der TITELZEILE —
    // gemessen gegen den ganzen Block faellt sie durch (Gegenprobe: 436 px gegen 595 px).
    expect(band.oben).toBeGreaterThanOrEqual(inhalt.unten);
    // Und sie fluchtet mit ihm: dieselbe linke Kante statt eines Einzugs von rund 220 px.
    expect(Math.abs(band.links - inhalt.links)).toBeLessThan(2);
    // Volle Breite: das Band ist nicht mehr die schmale Saeule am rechten Rand. Die Karte hat
    // Innenpolster, deshalb kein exakter Vergleich — aber deutlich mehr als die frueheren ~59 %.
    expect(band.breite / karte.breite).toBeGreaterThan(0.85);
  });

  it("F2 · der Titel steht vollstaendig da — kein Ueberlauf mehr in seinem Kasten", () => {
    expect(fehler).toBeNull();
    expect(m?.titelText).toBe(TITEL);
    // truncate schneidet mit Ellipse ab; messbar ist der Ueberlauf, nicht das „…" im Text.
    expect(m?.titelUeberlauf).toBeLessThanOrEqual(0);
  });

  it("F3 · Kategorie und Erstellungsangabe sind durch einen Mittelpunkt getrennt (Zielbild Z. 54)", () => {
    expect(fehler).toBeNull();
    expect(m?.erstelltText).toMatch(/\d{2}\.\d{2}\.\d{4}/);
    // getComputedStyle serialisiert den Inhalt als Zeichenkette in Anfuehrungszeichen.
    expect(m?.trenner).toContain("·");
  });
});
