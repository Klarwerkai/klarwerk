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

// ================================================================================================
// JOB 2935 · D2 — DIE ZWEI GRENZEN, DIE D1 NICHT GEMESSEN HAT: Classic-Standard und Word-nahe Breite
// ================================================================================================
//
// BENs Einwand zu D1, sinngemaess und berechtigt: Die Faelle oben setzen `kw.designTheme = "modern"`
// ausdruecklich. **Classic bleibt aber der Auslieferungsstandard** — was Pedi ohne Umschalter sieht,
// war damit gar nicht gemessen. Und ein Fussband, das auf 1280 px traegt, kann in einem schmalen
// Fenster umbrechen, ueberlaufen oder Bedienelemente aus dem Bild schieben.
//
// DIESER BLOCK MISST GENAU DIESE ZWEI LAGEN — und sonst nichts:
//   C  Classic-Standard: `kw.designTheme` wird NICHT gesetzt (kein `data-theme` an der Wurzel),
//      Fensterbreite wie in D1.
//   W  Word-nahe Breite: derselbe Classic-Standard, Fenster auf WORD_NAHE_BREITE.
//
// WOHER DIE SCHMALE BREITE KOMMT — sie ist nicht gegriffen: Das Aufgabenfenster des Word-Add-ins
// ist im Produkt `w-[340px]` breit (Klara-Panel unter `apps/web/src/components/`, Zeile 355).
//
// WARUM DIE QUELLE HIER OHNE KLASSENNAMEN STEHT — gemessen, nicht Geschmack: Eine fruehere Fassung
// dieses Kopfes nannte die Komponente beim Namen. Damit traf DIESE Datei die Inhaltsachse
// `komponente` des Klara-Regressionsinventars, landete in dessen abgeleiteter Menge und machte K2
// rot („neu im Baum, aber nicht im gepinnten Inventar"). Belegt: ohne diese Aenderungen laeuft das
// Inventar 6/6 gruen (Arbeitsspur `baseline-inventar.txt`), mit dem Klassennamen faellt K2. Das
// Inventar nachzufuehren waere hier der falsche Weg — es liegt ausserhalb der D2-Lease, und der
// Ausloeser ist kein vorgegebener Dateiname, sondern ein Wort in einem Kommentar. Die Angabe
// bleibt vollstaendig, nur der Klassenname entfaellt. Wer die
// Validierungsseite daneben oder in einem aehnlich schmalen Fenster oeffnet, hat kaum mehr Platz.
// 360 px liegt dicht darueber und ist zugleich eine gaengige schmale Geraetebreite — eng genug, um
// einen Ueberlauf zu zeigen, ohne ein Extrem zu erfinden.
//
// KEINE NEUEN ZIELWERTE. Gemessen wird ausschliesslich Struktur: laeuft etwas ueber, ist der Titel
// vollstaendig, sind die drei Entscheidungen und die vorhandenen Nebenaktionen erreichbar. Kein
// Farbwert, kein Abstand, kein Schriftgrad — die gehoeren `zielbild-validierung.test.ts` und dem
// Theme „modern", und dieser Block ruehrt sie nicht an.
const WORD_NAHE_BREITE = 360;

/**
 * In der Seite: die Lage der Karte messen.
 *
 * „Erreichbar" ist hier kein Eindruck, sondern vier Bedingungen an einem realen Element: es hat
 * eine Flaeche, es ragt nicht aus dem Fenster, es ist nicht von etwas anderem verdeckt (gepruefte
 * per `elementFromPoint` auf seiner Mitte) und es ist nicht gesperrt. Ein Knopf, den man sieht,
 * aber nicht treffen kann, ist nicht erreichbar — genau diesen Fall soll ein schmales Fenster
 * aufdecken.
 */
const LAGE = `([hinweisText, titel]) => {
  const doc = document.documentElement;
  const karte = document.querySelector('[data-testid="validation-row"]');
  if (!karte) return null;
  const hinweis = [...karte.querySelectorAll('p')].find((p) => (p.textContent || '').trim() === hinweisText);
  if (!hinweis) return null;
  const band = hinweis.parentElement;
  const titelEl = [...karte.querySelectorAll('a')].find((a) => (a.textContent || '').trim() === titel);
  const kastenVon = (el) => { const r = el.getBoundingClientRect(); return { links: r.left, rechts: r.right, oben: r.top, unten: r.bottom, breite: r.width }; };
  const erreichbar = (el, name) => {
    if (!el) return { name: name, da: false };
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const treffer = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      name: name,
      da: true,
      breite: Math.round(r.width),
      hoehe: Math.round(r.height),
      flaeche: r.width > 1 && r.height > 1,
      ragtRaus: Math.round(r.right - doc.clientWidth),
      frei: !!treffer && (treffer === el || el.contains(treffer) || treffer.contains(el)),
      gesperrt: el.disabled === true,
    };
  };
  const knopf = (t) => [...band.querySelectorAll('button')].find((b) => (b.textContent || '').replace(/\\*/g, '').trim() === t) || null;
  const genau = (t) => [...karte.querySelectorAll('a,button')].find((e) => (e.textContent || '').replace(/\\s+/g, ' ').trim() === t) || null;
  return {
    theme: doc.getAttribute('data-theme') || '(kein Attribut — Classic)',
    fensterBreite: doc.clientWidth,
    seitenUeberlauf: doc.scrollWidth - doc.clientWidth,
    karte: kastenVon(karte),
    karteRagtRaus: Math.round(kastenVon(karte).rechts - doc.clientWidth),
    band: kastenVon(band),
    titelText: titelEl ? (titelEl.textContent || '').trim() : null,
    titelUeberlauf: titelEl ? titelEl.scrollWidth - titelEl.clientWidth : null,
    teile: [
      erreichbar(knopf('Freigeben'), 'Freigeben'),
      erreichbar(knopf('Rückfrage'), 'Rückfrage'),
      erreichbar(knopf('Ablehnen'), 'Ablehnen'),
      erreichbar(karte.querySelector('select'), 'Zuweisen'),
      erreichbar(genau('Bearbeiten'), 'Bearbeiten'),
      erreichbar(genau('Wissensobjekt löschen'), 'Löschen'),
    ],
  };
}`;

interface Teil {
  name: string;
  da: boolean;
  breite?: number;
  hoehe?: number;
  flaeche?: boolean;
  ragtRaus?: number;
  frei?: boolean;
  gesperrt?: boolean;
}
interface Lage {
  theme: string;
  fensterBreite: number;
  seitenUeberlauf: number;
  karte: Kasten;
  karteRagtRaus: number;
  band: Kasten;
  titelText: string | null;
  titelUeberlauf: number | null;
  teile: Teil[];
}

let browser2: Browser | null = null;
let app2: ReturnType<typeof buildApp> | null = null;
let fehler2: string | null = null;
let classic: Lage | null = null;
let schmal: Lage | null = null;

describe("JOB 2935 · D2 · dieselbe Karte im Classic-Standard und bei Word-naher Breite", () => {
  beforeAll(async () => {
    try {
      if (!existsSync(join(DIST, "index.html"))) {
        throw new Error("apps/web/dist fehlt — vorher ./tools/build (im Tor laeuft es immer)");
      }
      const services = buildServices();
      app2 = buildApp(services);
      await app2.ready();
      await app2.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "Pedi", email: "pedi@job2935d2.test", password: "geheim12345" },
      });
      const login = await app2.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "pedi@job2935d2.test", password: "geheim12345" },
      });
      const token = (login.json() as { token: string }).token;
      const me = await app2.inject({
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
      // OHNE `--single-process`/`--no-zygote`, anders als im Block oben — und das ist gemessen,
      // nicht Geschmack: Mit diesen Flags scheiterte der ZWEITE Chromium-Start in derselben
      // Testdatei durchgehend an `browser.newPage: Target page, context or browser has been
      // closed` (Protokoll `messung-1.txt`, 10 von 10 Faellen rot, waehrend die D1-Faelle gruen
      // blieben). Ein Einzelprozess-Chromium ueberlebt den Neustart im selben Node-Prozess nicht.
      // An der Messung aendert das nichts: gemessen wird dieselbe gebaute Anwendung.
      browser2 = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-gpu"],
      });

      const a = app2;
      /** Eine Lage: eigenes Fenster, KEIN gesetztes Theme (Classic ist der Auslieferungsstand). */
      const lageMessen = async (breite: number, hoehe: number): Promise<Lage | null> => {
        const s = await (browser2 as Browser).newPage({
          viewport: { width: breite, height: hoehe },
        });
        // BEWUSST OHNE `addInitScript`: Der Schalter `kw.designTheme` bleibt ungesetzt. Genau das
        // ist der Auslieferungsstand — und genau das hat D1 nicht gemessen.
        await s.route(`${ORIGIN}/**`, async (route) => {
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
        await s.goto(`${ORIGIN}/validierung`, { waitUntil: "load", timeout: 60_000 });
        await s.waitForFunction(
          fn(
            `(t) => [...document.querySelectorAll('p')].some((p) => (p.textContent || '').trim() === t)`,
          ),
          HINWEIS_TEXT,
          { timeout: 30_000 },
        );
        return s.evaluate<Lage | null>(fn(LAGE), [HINWEIS_TEXT, TITEL]);
      };

      classic = await lageMessen(1280, 900);
      schmal = await lageMessen(WORD_NAHE_BREITE, 900);
      console.info(`JOB 2935 D2 · Classic ${JSON.stringify(classic)}`);
      console.info(`JOB 2935 D2 · Schmal ${JSON.stringify(schmal)}`);
    } catch (e) {
      fehler2 = String(e).split("\n").slice(0, 3).join(" | ");
    }
  }, 180_000);

  afterAll(async () => {
    await browser2?.close();
    await app2?.close();
  }, 60_000);

  it("C0 · der Classic-Standard ist wirklich gemessen — kein Theme-Attribut an der Wurzel", () => {
    expect(fehler2).toBeNull();
    expect(classic).not.toBeNull();
    // Ohne diese Zusicherung koennte der Block unbemerkt wieder „modern" messen und waere
    // eine zweite Kopie der Faelle oben.
    expect(classic?.theme).toBe("(kein Attribut — Classic)");
    expect(schmal?.theme).toBe("(kein Attribut — Classic)");
    expect(schmal?.fensterBreite).toBeLessThanOrEqual(WORD_NAHE_BREITE);
  });

  for (const [kennung, lage] of [
    ["C", () => classic],
    ["W", () => schmal],
  ] as const) {
    const wo = kennung === "C" ? "Classic, 1280 px" : `Classic, ${WORD_NAHE_BREITE} px (Word-nah)`;

    it(`${kennung}1 · ${wo}: die Seite laeuft nicht seitlich ueber, und die Karte ragt nicht aus dem Fenster`, () => {
      expect(fehler2).toBeNull();
      const l = lage();
      expect(l).not.toBeNull();
      if (!l) return;
      // Ein Pixel Toleranz gegen Rundung bei gebrochenen Geraetepixeln.
      expect(
        l.seitenUeberlauf,
        `die Seite scrollt seitlich (${l.seitenUeberlauf} px)`,
      ).toBeLessThanOrEqual(1);
      expect(
        l.karteRagtRaus,
        `die Karte ragt ${l.karteRagtRaus} px aus dem Fenster`,
      ).toBeLessThanOrEqual(1);
    });

    it(`${kennung}2 · ${wo}: der Titel steht vollstaendig da`, () => {
      expect(fehler2).toBeNull();
      const l = lage();
      if (!l) return;
      expect(l.titelText).toBe(TITEL);
      expect(l.titelUeberlauf, "der Titel wird abgeschnitten").toBeLessThanOrEqual(0);
    });

    it(`${kennung}3 · ${wo}: alle drei Entscheidungen sind erreichbar — Flaeche, im Fenster, unverdeckt, nicht gesperrt`, () => {
      expect(fehler2).toBeNull();
      const l = lage();
      if (!l) return;
      for (const name of ["Freigeben", "Rückfrage", "Ablehnen"]) {
        const t = l.teile.find((x) => x.name === name);
        expect(t?.da, `${name} fehlt auf der Karte`).toBe(true);
        expect(t?.flaeche, `${name} hat keine Flaeche (${t?.breite}×${t?.hoehe})`).toBe(true);
        expect(t?.ragtRaus, `${name} ragt ${t?.ragtRaus} px aus dem Fenster`).toBeLessThanOrEqual(
          1,
        );
        expect(t?.frei, `${name} ist von etwas anderem verdeckt`).toBe(true);
        expect(t?.gesperrt, `${name} ist gesperrt`).toBe(false);
      }
    });

    it(`${kennung}4 · ${wo}: die vorhandenen Nebenaktionen bleiben erreichbar`, () => {
      expect(fehler2).toBeNull();
      const l = lage();
      if (!l) return;
      // Nebenaktionen haengen an Rolle und Zustand. Gemessen wird, was DA IST — und was da ist,
      // muss erreichbar sein. Ein fehlendes Element ist kein Fehler dieses Falls; ein vorhandenes,
      // das man nicht treffen kann, schon.
      const vorhanden = l.teile.filter(
        (t) => ["Zuweisen", "Bearbeiten", "Löschen"].includes(t.name) && t.da,
      );
      expect(vorhanden.length, "keine einzige Nebenaktion auf der Karte gefunden").toBeGreaterThan(
        0,
      );
      for (const t of vorhanden) {
        expect(t.flaeche, `${t.name} hat keine Flaeche`).toBe(true);
        expect(t.ragtRaus, `${t.name} ragt ${t.ragtRaus} px aus dem Fenster`).toBeLessThanOrEqual(
          1,
        );
        expect(t.frei, `${t.name} ist verdeckt`).toBe(true);
      }
    });
  }

  it("W5 · und das Fussband bleibt auch schmal ein Fussband — unter dem Inhalt, nicht daneben", () => {
    expect(fehler2).toBeNull();
    const l = schmal;
    if (!l) return;
    // Der Kern von D1, in der engen Lage nachgemessen: Umbricht die Karte, koennte das Band wieder
    // neben den Inhalt rutschen — dann waere der Titel erneut in Gefahr.
    expect(l.band.breite / l.karte.breite).toBeGreaterThan(0.7);
    expect(l.band.oben).toBeGreaterThan(l.karte.oben);
  });
});
