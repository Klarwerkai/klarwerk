// ================================================================================================
// JOB 3004 · D1 — DIE KLARA-ANTWORTKARTE IM WORD-PANEL, GEMESSEN AN DER ECHTEN FLAECHE IN CHROMIUM.
// ================================================================================================
//
// PEDIS SATZ (27.08.): „ich kann dieses verschachtelte und schlechte Design nicht mehr sehen.“
// PEDIS ZEILE D1: Antwortzustand wie `Main.dc.html` — „nicht aehnlich, sondern in jedem tragenden
// Wert gleich, an der echten gebauten Flaeche in Chromium nachgemessen".
//
// WIE DIE ECHTE FLAECHE HIER LAEUFT (Muster JOB 2618 D5, zielbild-validierung.test.ts):
//   · Die ECHTE Auslieferung `apps/web/dist/word-addin/taskpane.html` (Ergebnis von ./tools/build)
//     wird in Chromium unter `http://klarwerk.test/word-addin/taskpane.html` geladen. Playwright
//     bedient jede Datei aus `dist` und reicht JEDEN `/api/*`-Aufruf an die ECHTE Fastify-App
//     (`buildApp`, echte Dienste, echter Bestand) weiter — mit dem Bearer der echten Anmeldung.
//   · Das externe office.js wird NICHT geladen (leeres Skript statt Egress): das Panel erkennt
//     daraus ehrlich „kein Office“ und nimmt den Eingabefeld-Weg — genau der Weg, den ein Mensch
//     im Browser geht. Kein Mock des Panels, kein Nachbau der Flaeche.
//   · Der ANTWORTZUSTAND entsteht echt: ein validiertes Wissensobjekt ueber POST /api/kos +
//     admin-validate, dann eine Frage im Panel getippt und `#ask-btn` geklickt — die Antwort kommt
//     ueber POST /api/ask (retrieval-only), die Quellen ueber GET /api/kos/:id.
//   · Gemessen wird per `getComputedStyle` an den REALEN Elementen; jedes Element ist durch einen
//     CSS-Pfad belegt, der rueckwaerts (`document.querySelector`) dasselbe Element liefert.
//
// EIN VERGLEICH JE WERT. Sollwerte werden aus `Main.dc.html` GELESEN und ohne Renderer kanonisiert
// (Hex → rgb(), Schatten in Chromiums Serialisierung, unitless line-height × font-size). Werte des
// Zielbilds, die bewusst NICHT verglichen werden, stehen unten als OFFENER Wert mit Begruendung —
// gemessen und protokolliert, nicht stillschweigend weggelassen.
//
// KALIBRIERUNG: Fall S verlangt, dass JEDES Element gefunden und aufgeloest ist — ein fehlendes
// Element ist ein Fehlschlag, kein „0 von 0 gruen“. Die Gegenprobe (eine Mutation in taskpane.html
// macht genau den einen Fall rot, dessen Name den Wert traegt; Ruecknahme, Hashgleichheit) laeuft
// AUSSEN — je Mutation ./tools/build, Lauf, Ruecknahme — und steht in der Rueckgabe des Auftrags.
//
// DER „+n“-CHIP (Zielbild Z.44): auf dem Wort-Weg nennt der Server IMMER genau eine tragende Quelle
// (services/reasoner/src/provider.ts, `sources: [best.id]`) — ueber die Route ist der Chip also
// nicht erreichbar. Er wird deshalb am Ende ueber die ECHTE Renderfunktion des Panels
// (`resolveAskSources` → `renderAskSources`) mit DREI echten Wissensobjekten aus GET /api/kos/:id
// gezeichnet und dann gemessen. Kein Mock: dieselben Funktionen, dieselbe Route, echte Objekte.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import { buildApp, buildServices } from "../../services/app/src/build-app";

const WURZEL = resolve(process.cwd());
const DIST = resolve(WURZEL, "apps/web/dist");
const ZIELBILD =
  "/Users/peterkohnert/Documents/Projekt_klarwerk/DESIGN_ZIELBILD_20260827/Main.dc.html";
const ORIGIN = "http://klarwerk.test";
const PANEL = `${ORIGIN}/word-addin/taskpane.html`;
const OFFICE_JS = "https://appsforoffice.microsoft.com/**";
// Das Artboard „Antwortkarte“ (canvas.json): 360 × 720 — das Fenster der Messung.
const ARTBOARD = { breite: 360, hoehe: 720 };

// Das echte Wissensobjekt und die Frage, die es trifft (dasselbe Paar wie in
// tests/app/mega79-klara-antwort-ohne-modell.test.ts — dort ueber die Route belegt).
const FRAGE = "Ventil Wartung Druck entlasten";
const AUSSAGE = "Ventil vor der Wartung entlasten und den Druck pruefen.";
const TITEL = "Ventil entlasten vor Wartung";

// ---- Das Zielbild lesen: Anker je Element (Main.dc.html Z.22-57) -----------------------------------
function zielStil(ziel: string, anker: string): string | null {
  const re = /style="([^"]*)"/g;
  for (let m = re.exec(ziel); m !== null; m = re.exec(ziel)) {
    if ((m[1] ?? "").includes(anker)) return m[1] ?? null;
  }
  return null;
}
function zielProp(stil: string | null, eigenschaft: string): string | null {
  if (stil === null) return null;
  return new RegExp(`(?:^|[;\\s])${eigenschaft}\\s*:\\s*([^;]+)`).exec(stil)?.[1]?.trim() ?? null;
}
/** Sichtbarer Wortlaut des Elements, dessen style-Attribut den Anker traegt. */
function zielText(ziel: string, anker: string): string | null {
  const i = ziel.indexOf(anker);
  if (i < 0) return null;
  const m = /^[^>]*>([^<]*)</.exec(ziel.slice(i));
  return m?.[1]?.trim() ?? null;
}
/** Hex → `rgb(r, g, b)` (die Serialisierung von getComputedStyle); alles andere unveraendert. */
function kanon(wert: string | null): string | null {
  if (wert === null) return null;
  const m = /^#([0-9a-f]{6})$/i.exec(wert.trim());
  if (!m) return wert.trim();
  const h = m[1] ?? "";
  return `rgb(${Number.parseInt(h.slice(0, 2), 16)}, ${Number.parseInt(h.slice(2, 4), 16)}, ${Number.parseInt(h.slice(4, 6), 16)})`;
}
/** `0 1px 2px rgba(…), …` → Chromiums Serialisierung `rgba(…) 0px 1px 2px 0px, …`. */
function kanonSchatten(wert: string | null): string | null {
  if (wert === null) return null;
  return wert
    .split(/,(?![^(]*\))/)
    .map((s) => s.trim())
    .map((s) => {
      const farbe = /rgba?\([^)]*\)|#[0-9a-f]{3,8}/i.exec(s)?.[0] ?? "";
      const laengen = s
        .replace(farbe, "")
        .trim()
        .split(/\s+/)
        .map((l) => (l === "0" ? "0px" : l));
      while (laengen.length < 4) laengen.push("0px");
      return `${kanon(farbe)} ${laengen.join(" ")}`;
    })
    .join(", ");
}
/** Kurzschreibweisen wie `10px 0`: Chromium serialisiert die nackte Null als `0px`. */
function kanonLaenge(wert: string | null | undefined): string | null {
  if (wert === null || wert === undefined) return null;
  return wert
    .trim()
    .split(/\s+/)
    .map((t) => (t === "0" ? "0px" : t))
    .join(" ");
}
/** Unitless line-height × font-size → Pixel, wie getComputedStyle sie liefert. */
function kanonZeilenhoehe(lineHeight: string | null, fontSize: string | null): string | null {
  if (lineHeight === null || fontSize === null) return null;
  const lh = Number.parseFloat(lineHeight);
  const fs = Number.parseFloat(fontSize);
  if (Number.isNaN(lh) || Number.isNaN(fs) || /px$/.test(lineHeight)) return lineHeight;
  return `${Math.round(lh * fs * 1000) / 1000}px`;
}
/** `1px solid #E9E5DE` → die drei Einzelwerte, wie border-top-* sie liefern. */
function kanonRand(wert: string | null): { breite: string; stil: string; farbe: string } | null {
  if (wert === null) return null;
  const t = wert.trim().split(/\s+/);
  return { breite: t[0] ?? "", stil: t[1] ?? "", farbe: kanon(t[2] ?? null) ?? "" };
}

const Z_PILLE = "padding: 9px 12px; background: #FFFFFF";
const Z_PILLE_TEXT = "text-overflow: ellipsis";
const Z_KARTE = "padding: 18px 16px 16px";
const Z_TEXT = "font-size: 16px; line-height: 1.55";
const Z_SUP = "font-size: 10px; color: #9C5009; font-weight: 700";
const Z_HERKUNFT = "border-top: 1px solid #E9E5DE; padding-top: 12px";
const Z_HERKUNFT_ZEILE = "letter-spacing: 0.4px";
const Z_CHIPS = "flex-wrap: wrap; gap: 6px";
const Z_CHIP = "gap: 6px; padding: 5px 9px";
const Z_CHIP_TITEL = "font-size: 11.5px; color: #1A2233; font-weight: 600";
const Z_CHIP_FASSUNG = "font-size: 10.5px; color: #525B6B";
const Z_CHIP_MEHR = "border-radius: 8px; font-size: 11.5px; color: #525B6B";
const Z_AKTIONEN = "margin: 12px 16px 0; display: flex; gap: 8px";
const Z_EINFUEGEN = "background: #C2500A; color: #FFFFFF";
const Z_KOPIEREN = "background: #FFFFFF; color: #1A2233; border: 1px solid #E9E5DE";
const Z_FUSS = "margin-top: auto; padding: 12px 16px";
const Z_FUSS_TEXT = "font-size: 11px; color: #525B6B";
const STIFT_PFAD = "M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z";
const DOKUMENT_PFAD = "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z";
const LEITSATZ = "Keine KI-Antwort ohne Beleg · Vertrauliches bleibt vertraulich";

// ---- Die echte Flaeche in Chromium ---------------------------------------------------------------
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
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  waitForFunction(fn: BrowserFn, arg?: unknown, opts?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(fn: BrowserFn, arg?: unknown): Promise<T>;
  fill(selector: string, value: string): Promise<void>;
  click(selector: string): Promise<void>;
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

let browser: Browser | null = null;
let seite: Seite | null = null;
let app: ReturnType<typeof buildApp> | null = null;
let fehler: string | null = null;
let version = "";
let koId = "";
let weitereKoIds: string[] = [];

/** In der Seite: CSS-Pfad eines Elements (nth-child-Kette bis body) — der Selektor als Beleg. */
const PFAD_FN = `(el) => {
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
/** In der Seite: die realen Elemente der Antwortflaeche finden, Selektoren rueckwaerts aufloesen. */
const ELEMENTE = `(pfadFnSrc) => {
  const pfad = eval('(' + pfadFnSrc + ')');
  const g = (id) => document.getElementById(id);
  const q = (el, sel) => (el ? el.querySelector(sel) : null);
  const roh = {
    pille: g('ask-frage-zeile-btn'),
    pilleText: g('ask-frage-zeile'),
    pilleStift: q(g('ask-frage-zeile-btn'), 'svg'),
    karte: g('antwortkarte'),
    text: g('ask-answer-edit'),
    herkunft: g('ask-sources-block'),
    herkunftZeile: g('antwortkarte-herkunft-zeile'),
    chips: g('ask-sources'),
    chip: q(g('ask-sources'), 'li.quelle-chip'),
    chipIcon: q(g('ask-sources'), 'li.quelle-chip svg'),
    chipTitel: q(g('ask-sources'), 'li.quelle-chip .quelle-chip-titel'),
    chipFassung: q(g('ask-sources'), 'li.quelle-chip .quelle-chip-fassung'),
    aktionen: g('antwortkarte-aktionen'),
    einfuegen: g('ask-insert-btn'),
    kopieren: g('ask-copy-btn'),
    fuss: g('antwortkarte-fuss'),
    fussHinweis: g('antwortkarte-fuss-hinweis'),
    neueFrage: g('ask-neue-frage-btn'),
    leitsatz: g('klara-leitsatz'),
    frageKarte: g('ask-karte'),
    frageFeld: g('ask-input'),
  };
  const out = {};
  let aufgeloest = true;
  for (const k of Object.keys(roh)) {
    const el = roh[k];
    out[k] = el ? pfad(el) : null;
    if (el && document.querySelector(out[k]) !== el) aufgeloest = false;
  }
  out.aufgeloest = aufgeloest;
  return out;
}`;
const LESEN =
  "([sel, eig]) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).getPropertyValue(eig) : null; }";
const TEXT =
  "(sel) => { const el = document.querySelector(sel); return el ? (el.textContent || '').replace(/\\s+/g, ' ').trim() : null; }";
const SICHTBAR =
  "(sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return getComputedStyle(el).display !== 'none' && r.width > 0 && r.height > 0; }";
const PFAD_D =
  "(sel) => { const el = document.querySelector(sel); const p = el ? el.querySelector('path') : null; return p ? p.getAttribute('d') : null; }";
const ATTR =
  "([sel, name]) => { const el = document.querySelector(sel); return el ? el.getAttribute(name) : null; }";
const KANTEN_FN =
  "(sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { links: r.left, rechts: r.right, oben: r.top, unten: r.bottom, breite: r.width }; }";
interface Kanten {
  links: number;
  rechts: number;
  oben: number;
  unten: number;
  breite: number;
}

interface Selektoren {
  pille: string | null;
  pilleText: string | null;
  pilleStift: string | null;
  karte: string | null;
  text: string | null;
  herkunft: string | null;
  herkunftZeile: string | null;
  chips: string | null;
  chip: string | null;
  chipIcon: string | null;
  chipTitel: string | null;
  chipFassung: string | null;
  aktionen: string | null;
  einfuegen: string | null;
  kopieren: string | null;
  fuss: string | null;
  fussHinweis: string | null;
  neueFrage: string | null;
  leitsatz: string | null;
  frageKarte: string | null;
  frageFeld: string | null;
  aufgeloest: boolean;
}
let sel: Selektoren | null = null;

function distDatei(pfadname: string): { body: Buffer; typ: string } {
  const rel = pfadname === "/" ? "/index.html" : pfadname;
  const datei = join(DIST, rel);
  if (existsSync(datei) && statSync(datei).isFile()) {
    return { body: readFileSync(datei), typ: MIME[extname(datei)] ?? "application/octet-stream" };
  }
  return { body: readFileSync(join(DIST, "index.html")), typ: MIME[".html"] ?? "text/html" };
}

describe("JOB 3004 · D1 · die Klara-Antwortkarte — die echte taskpane.html aus dist, in Chromium, im echten Antwortzustand", () => {
  beforeAll(async () => {
    try {
      const panelDatei = join(DIST, "word-addin/taskpane.html");
      if (!existsSync(panelDatei)) {
        throw new Error("apps/web/dist/word-addin/taskpane.html fehlt — vorher ./tools/build");
      }
      const services = buildServices();
      app = buildApp(services);
      await app.ready();
      await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "Pedi", email: "pedi@job3004.test", password: "geheim12345" },
      });
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "pedi@job3004.test", password: "geheim12345" },
      });
      const token = (login.json() as { token: string }).token;
      const headers = { authorization: `Bearer ${token}` };
      // Das validierte Wissensobjekt — die eine tragende Quelle der Antwort.
      const anlegen = async (title: string, statement: string): Promise<string> => {
        const res = await app?.inject({
          method: "POST",
          url: "/api/kos",
          headers,
          payload: { title, statement, type: "best_practice", category: "Wartung" },
        });
        const id = (res?.json() as { id: string }).id;
        await app?.inject({
          method: "PUT",
          url: `/api/kos/${id}`,
          headers,
          payload: { action: "admin-validate" },
        });
        return id;
      };
      koId = await anlegen(TITEL, AUSSAGE);
      // Zwei weitere echte Objekte — nur fuer den „+n“-Chip am Ende (s. Kopf).
      weitereKoIds = [
        await anlegen("Design Guide Halterungen", "Halterungen ohne waagerechte Oberseiten."),
        await anlegen("HD Handbook Reinigung", "Reinigungszonen taeglich pruefen."),
      ];
      await services.aiCheckWorker?.idle();

      const require = createRequire(import.meta.url);
      const { chromium } = require("playwright") as {
        chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
      };
      browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
      });
      version = browser.version();
      // Das Aufgabenfenster von Word: 360 breit wie das Artboard (canvas.json), hoch genug.
      seite = await browser.newPage({
        viewport: { width: ARTBOARD.breite, height: ARTBOARD.hoehe },
      });
      const a = app;
      await seite.route(OFFICE_JS, async (route) => {
        await route.fulfill({ status: 200, body: "", contentType: "application/javascript" });
      });
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
      await seite.goto(PANEL, { waitUntil: "load", timeout: 60_000 });
      // Angemeldet (echter GET /api/auth/me) und der Fragen-Knopf frei.
      await seite.waitForFunction(
        fn(`() => { const b = document.getElementById('ask-btn'); return !!b && !b.disabled; }`),
        undefined,
        { timeout: 30_000 },
      );
      // Die echte Frage ueber das echte Eingabefeld und den echten Knopf.
      await seite.fill("#ask-input", FRAGE);
      await seite.click("#ask-btn");
      // Antwortzustand: der Antwortbereich ist sichtbar UND die Quellen sind aufgeloest (die
      // Aktionen werden erst dann frei — dasselbe Tor wie fuer den Menschen).
      await seite.waitForFunction(
        fn(
          `() => { const b = document.getElementById('ask-answer-block'); const c = document.getElementById('ask-copy-btn'); return !!b && b.className.indexOf('hidden') === -1 && !!c && !c.disabled; }`,
        ),
        undefined,
        { timeout: 30_000 },
      );
      sel = await seite.evaluate<Selektoren | null>(fn(ELEMENTE), PFAD_FN);
      console.info(
        `JOB 3004 D1 · Chromium ${version} · ${PANEL} · KO ${koId} · Selektoren ${JSON.stringify(sel)}`,
      );
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 3).join(" | ");
    }
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
    await app?.close();
  }, 60_000);

  const ziel = existsSync(ZIELBILD) ? readFileSync(ZIELBILD, "utf8") : "";

  async function messen(
    selektor: string | null | undefined,
    eigenschaft: string,
  ): Promise<string | null> {
    expect(fehler, "Seite nicht gemountet").toBeNull();
    expect(selektor, "reales Element nicht gefunden").toBeTruthy();
    return (seite as Seite).evaluate<string | null>(fn(LESEN), [selektor, eigenschaft]);
  }
  async function text(selektor: string | null | undefined): Promise<string | null> {
    expect(fehler, "Seite nicht gemountet").toBeNull();
    expect(selektor, "reales Element nicht gefunden").toBeTruthy();
    return (seite as Seite).evaluate<string | null>(fn(TEXT), selektor);
  }
  async function sichtbar(selektor: string | null | undefined): Promise<boolean | null> {
    expect(fehler, "Seite nicht gemountet").toBeNull();
    expect(selektor, "reales Element nicht gefunden").toBeTruthy();
    return (seite as Seite).evaluate<boolean | null>(fn(SICHTBAR), selektor);
  }
  async function kanten(selektor: string | null | undefined): Promise<Kanten> {
    expect(fehler, "Seite nicht gemountet").toBeNull();
    expect(selektor, "reales Element nicht gefunden").toBeTruthy();
    return (seite as Seite).evaluate<Kanten>(fn(KANTEN_FN), selektor);
  }
  const rand = (anker: string, eig = "border") => kanonRand(zielProp(zielStil(ziel, anker), eig));
  /** Der Seitenrand der Vorlage (16px), aus `margin: 12px 16px 0` der Pille gelesen. */
  const RAND = Number.parseFloat(zielProp(zielStil(ziel, Z_PILLE), "margin")?.split(" ")[1] ?? "");
  /** Linke und rechte Kante eines Elements gegen den Rand des 360px-Fensters. */
  function kantenGegenRand(k: Kanten, name: string): void {
    expect(Math.abs(k.links - RAND), `${name}: linke Kante ${k.links}`).toBeLessThan(1);
    expect(
      Math.abs(ARTBOARD.breite - RAND - k.rechts),
      `${name}: rechte Kante ${k.rechts}`,
    ).toBeLessThan(1);
  }

  it("S · die echte Flaeche steht: Antwortzustand erreicht, JEDES Element gefunden, Selektoren rueckwaerts aufloesbar", () => {
    expect(fehler).toBeNull();
    expect(sel).not.toBeNull();
    const s = sel as Selektoren;
    const fehlend = Object.entries(s)
      .filter(([k, v]) => k !== "aufgeloest" && v === null)
      .map(([k]) => k);
    expect(fehlend, "Elemente des Zielbilds fehlen in der geladenen Seite").toEqual([]);
    expect(s.aufgeloest).toBe(true);
    expect(s.karte).toMatch(/^body > /);
  });

  // ---- Frage-Pille (Zielbild Z.22-25) ----------------------------------------------------------
  it("P1 · fragepille-grund #FFFFFF — background-color an der realen Pille", async () => {
    expect(await messen(sel?.pille, "background-color")).toBe(
      kanon(zielProp(zielStil(ziel, Z_PILLE), "background")),
    );
  });
  it("P2 · fragepille-rand 1px solid #E9E5DE — border-top-* an der realen Pille", async () => {
    const soll = rand(Z_PILLE);
    expect(await messen(sel?.pille, "border-top-width")).toBe(soll?.breite);
    expect(await messen(sel?.pille, "border-top-style")).toBe(soll?.stil);
    expect(await messen(sel?.pille, "border-top-color")).toBe(soll?.farbe);
  });
  it("P3 · fragepille-radius 10px — border-radius an der realen Pille", async () => {
    expect(await messen(sel?.pille, "border-radius")).toBe(
      zielProp(zielStil(ziel, Z_PILLE), "border-radius"),
    );
  });
  it("P4 · fragepille-innenabstand 9px 12px — padding an der realen Pille", async () => {
    expect(await messen(sel?.pille, "padding")).toBe(
      kanonLaenge(zielProp(zielStil(ziel, Z_PILLE), "padding")),
    );
  });
  it("P5 · fragepille-symbolabstand 8px — gap an der realen Pille", async () => {
    expect(await messen(sel?.pille, "gap")).toBe(zielProp(zielStil(ziel, Z_PILLE), "gap"));
  });
  it("P6 · fragepille-aussenmass 12px 16px 0 — margin (alle Komponenten) an der realen Pille, Kanten 16px vom Fensterrand", async () => {
    expect(await messen(sel?.pille, "margin")).toBe(
      kanonLaenge(zielProp(zielStil(ziel, Z_PILLE), "margin")),
    );
    kantenGegenRand(await kanten(sel?.pille), "Pille");
  });
  it("P7 · fragepille-schriftgrad 13px — font-size am realen Fragetext", async () => {
    expect(await messen(sel?.pilleText, "font-size")).toBe(
      zielProp(zielStil(ziel, Z_PILLE_TEXT), "font-size"),
    );
  });
  it("P8 · fragepille-schriftfarbe #525B6B — color am realen Fragetext", async () => {
    expect(await messen(sel?.pilleText, "color")).toBe(
      kanon(zielProp(zielStil(ziel, Z_PILLE_TEXT), "color")),
    );
  });
  it("P9 · fragepille-einzeilig (nowrap · hidden · ellipsis) — am realen Fragetext", async () => {
    const stil = zielStil(ziel, Z_PILLE_TEXT);
    expect(await messen(sel?.pilleText, "white-space")).toBe(zielProp(stil, "white-space"));
    expect(await messen(sel?.pilleText, "overflow-x")).toBe(zielProp(stil, "overflow"));
    expect(await messen(sel?.pilleText, "text-overflow")).toBe(zielProp(stil, "text-overflow"));
  });
  it("P10 · fragepille-stift (SVG M17 3a2.8…, 14px) — im realen Pillen-Knopf", async () => {
    expect(ziel).toContain(STIFT_PFAD);
    const s = seite as Seite;
    expect(await s.evaluate<string | null>(fn(PFAD_D), sel?.pilleStift)).toBe(STIFT_PFAD);
    expect(await s.evaluate<string | null>(fn(ATTR), [sel?.pilleStift, "width"])).toBe("14");
  });
  it("P11 · fragepille-wortlaut — die Pille traegt die gestellte Frage", async () => {
    expect(await text(sel?.pilleText)).toBe(FRAGE);
  });

  // ---- Antwortkarte (Zielbild Z.27) ---------------------------------------------------------------
  it("K1 · antwortkarte-radius 12px — border-radius an der realen Karte", async () => {
    expect(await messen(sel?.karte, "border-radius")).toBe(
      zielProp(zielStil(ziel, Z_KARTE), "border-radius"),
    );
  });
  it("K2 · antwortkarte-schatten (0 1px 2px … , 0 8px 24px -12px …) — box-shadow an der realen Karte", async () => {
    expect(await messen(sel?.karte, "box-shadow")).toBe(
      kanonSchatten(zielProp(zielStil(ziel, Z_KARTE), "box-shadow")),
    );
  });
  it("K3 · antwortkarte-innenabstand 18px 16px 16px — padding an der realen Karte", async () => {
    expect(await messen(sel?.karte, "padding")).toBe(
      kanonLaenge(zielProp(zielStil(ziel, Z_KARTE), "padding")),
    );
  });
  it("K4 · antwortkarte-grund #FFFFFF — background-color an der realen Karte", async () => {
    expect(await messen(sel?.karte, "background-color")).toBe(
      kanon(zielProp(zielStil(ziel, Z_KARTE), "background")),
    );
  });
  it("K5 · antwortkarte-rand 1px solid #E9E5DE — border-top-* an der realen Karte", async () => {
    const soll = rand(Z_KARTE);
    expect(await messen(sel?.karte, "border-top-width")).toBe(soll?.breite);
    expect(await messen(sel?.karte, "border-top-style")).toBe(soll?.stil);
    expect(await messen(sel?.karte, "border-top-color")).toBe(soll?.farbe);
  });
  it("K6 · antwortkarte-aussenmass 14px 16px 0 — margin (alle Komponenten) an der realen Karte, Kanten 16px vom Fensterrand", async () => {
    expect(await messen(sel?.karte, "margin")).toBe(
      kanonLaenge(zielProp(zielStil(ziel, Z_KARTE), "margin")),
    );
    kantenGegenRand(await kanten(sel?.karte), "Karte");
  });
  it("K7 · antwortkarte-innenraster 14px (flex-Spalte) — gap an der realen Karte", async () => {
    const stil = zielStil(ziel, Z_KARTE);
    expect(await messen(sel?.karte, "display")).toBe(zielProp(stil, "display"));
    expect(await messen(sel?.karte, "flex-direction")).toBe(zielProp(stil, "flex-direction"));
    expect(await messen(sel?.karte, "gap")).toBe(zielProp(stil, "gap"));
  });

  // ---- Antworttext (Zielbild Z.28-29) -------------------------------------------------------------
  it("T1 · antworttext-schriftgrad 16px — font-size am realen Antwortfeld", async () => {
    expect(await messen(sel?.text, "font-size")).toBe(
      zielProp(zielStil(ziel, Z_TEXT), "font-size"),
    );
  });
  it("T2 · antworttext-zeilenhoehe 1.55 (= 24.8px) — line-height am realen Antwortfeld", async () => {
    const stil = zielStil(ziel, Z_TEXT);
    expect(await messen(sel?.text, "line-height")).toBe(
      kanonZeilenhoehe(zielProp(stil, "line-height"), zielProp(stil, "font-size")),
    );
  });
  it("T3 · antworttext-farbe #1A2233 — color am realen Antwortfeld", async () => {
    expect(await messen(sel?.text, "color")).toBe(kanon(zielProp(zielStil(ziel, Z_TEXT), "color")));
  });
  it("T4 · antworttext-ohne-rahmen (Text, kein Formularfeld) — border/padding/background am realen Antwortfeld", async () => {
    expect(await messen(sel?.text, "border-top-width")).toBe("0px");
    expect(await messen(sel?.text, "padding")).toBe("0px");
    expect(await messen(sel?.text, "background-color")).toBe("rgba(0, 0, 0, 0)");
  });
  it("T5 · antworttext-wortlaut — das Feld traegt die woertliche Aussage der Quelle", async () => {
    expect(fehler).toBeNull();
    const wert = await (seite as Seite).evaluate<string | null>(
      fn("(sel) => { const el = document.querySelector(sel); return el ? el.value : null; }"),
      sel?.text,
    );
    expect(wert).toBe(AUSSAGE);
  });

  // ---- Herkunftszeile und Chips (Zielbild Z.31-45) ----------------------------------------------
  it("H1 · herkunft-trennlinie 1px solid #E9E5DE — border-top-* am realen Herkunftsblock", async () => {
    const soll = rand(Z_HERKUNFT, "border-top");
    expect(await messen(sel?.herkunft, "border-top-width")).toBe(soll?.breite);
    expect(await messen(sel?.herkunft, "border-top-style")).toBe(soll?.stil);
    expect(await messen(sel?.herkunft, "border-top-color")).toBe(soll?.farbe);
  });
  it("H2 · herkunft-oberabstand 12px — padding-top am realen Herkunftsblock", async () => {
    expect(await messen(sel?.herkunft, "padding-top")).toBe(
      zielProp(zielStil(ziel, Z_HERKUNFT), "padding-top"),
    );
  });
  it("H3 · herkunft-innenraster 8px — gap am realen Herkunftsblock", async () => {
    expect(await messen(sel?.herkunft, "gap")).toBe(zielProp(zielStil(ziel, Z_HERKUNFT), "gap"));
  });
  it("H4 · herkunft-schriftgrad 11px — font-size an der realen Herkunftszeile", async () => {
    expect(await messen(sel?.herkunftZeile, "font-size")).toBe(
      zielProp(zielStil(ziel, Z_HERKUNFT_ZEILE), "font-size"),
    );
  });
  it("H5 · herkunft-laufweite 0.4px — letter-spacing an der realen Herkunftszeile", async () => {
    expect(await messen(sel?.herkunftZeile, "letter-spacing")).toBe(
      zielProp(zielStil(ziel, Z_HERKUNFT_ZEILE), "letter-spacing"),
    );
  });
  it("H6 · herkunft-farbe #525B6B — color an der realen Herkunftszeile", async () => {
    expect(await messen(sel?.herkunftZeile, "color")).toBe(
      kanon(zielProp(zielStil(ziel, Z_HERKUNFT_ZEILE), "color")),
    );
  });
  it("H7 · herkunft-wortlaut „Aus freigegebenem Firmenwissen“ — an der realen Herkunftszeile", async () => {
    const soll = zielText(ziel, Z_HERKUNFT_ZEILE);
    expect(soll).toBe("Aus freigegebenem Firmenwissen");
    expect(await text(sel?.herkunftZeile)).toBe(soll);
  });
  it("C1 · chips-abstand 6px (flex, wrap) — gap/flex-wrap an der realen Chip-Reihe", async () => {
    const stil = zielStil(ziel, Z_CHIPS);
    expect(await messen(sel?.chips, "display")).toBe(zielProp(stil, "display"));
    expect(await messen(sel?.chips, "flex-wrap")).toBe(zielProp(stil, "flex-wrap"));
    expect(await messen(sel?.chips, "gap")).toBe(zielProp(stil, "gap"));
  });
  it("C2 · chip-innenabstand 5px 9px — padding am realen Chip", async () => {
    expect(await messen(sel?.chip, "padding")).toBe(
      kanonLaenge(zielProp(zielStil(ziel, Z_CHIP), "padding")),
    );
  });
  it("C3 · chip-grund #FAF8F5 — background-color am realen Chip", async () => {
    expect(await messen(sel?.chip, "background-color")).toBe(
      kanon(zielProp(zielStil(ziel, Z_CHIP), "background")),
    );
  });
  it("C4 · chip-rand 1px solid #E9E5DE — border-top-* am realen Chip", async () => {
    const soll = rand(Z_CHIP);
    expect(await messen(sel?.chip, "border-top-width")).toBe(soll?.breite);
    expect(await messen(sel?.chip, "border-top-style")).toBe(soll?.stil);
    expect(await messen(sel?.chip, "border-top-color")).toBe(soll?.farbe);
  });
  it("C5 · chip-radius 8px — border-radius am realen Chip", async () => {
    expect(await messen(sel?.chip, "border-radius")).toBe(
      zielProp(zielStil(ziel, Z_CHIP), "border-radius"),
    );
  });
  it("C6 · chip-layout flex · align-items center · gap 6px — Layoutart UND wirksamer Abstand Symbol → Titel → Fassung am realen Chip", async () => {
    const stil = zielStil(ziel, Z_CHIP);
    // Der berechnete `gap` allein sagt nichts: ohne Flex-Darstellung hat er keine Wirkung (ben,
    // Runde 4 — `#ask-sources li { display: block }` schlug die Klasse). Deshalb Layoutart UND
    // Geometrie an den drei echten Kindern.
    expect(await messen(sel?.chip, "display")).toBe(zielProp(stil, "display"));
    expect(await messen(sel?.chip, "align-items")).toBe(zielProp(stil, "align-items"));
    expect(await messen(sel?.chip, "gap")).toBe(zielProp(stil, "gap"));
    const soll = Number.parseFloat(zielProp(stil, "gap") ?? "");
    const symbol = await kanten(sel?.chipIcon);
    const titel = await kanten(sel?.chipTitel);
    const fassung = await kanten(sel?.chipFassung);
    // Symbol → Titel: dieselbe Zeile, 6px Kantenabstand.
    expect(Math.abs(titel.links - symbol.rechts - soll)).toBeLessThan(0.5);
    expect(
      Math.abs((symbol.oben + symbol.unten) / 2 - (titel.oben + titel.unten) / 2),
    ).toBeLessThan(2);
    // Titel → Fassung: 6px Kantenabstand — nebeneinander (Spaltenluecke) oder, wenn die Fassung
    // im 360px-Fenster umbricht (flex-wrap), untereinander (Zeilenluecke). Beides ist der gap.
    const nebeneinander = Math.abs(fassung.oben - titel.oben) < 2;
    const abstand = nebeneinander ? fassung.links - titel.rechts : fassung.oben - titel.unten;
    expect(Math.abs(abstand - soll)).toBeLessThan(0.5);
    console.info(
      `JOB 3004 D1 · C6 · Titel → Fassung ${nebeneinander ? "nebeneinander" : "umgebrochen"}: ${abstand.toFixed(2)}px (Soll ${soll}px)`,
    );
  });
  it("C7 · chip-dokumentsymbol (SVG M14 2H6…, 13px) — im realen Chip", async () => {
    expect(ziel).toContain(DOKUMENT_PFAD);
    const s = seite as Seite;
    expect(await s.evaluate<string | null>(fn(PFAD_D), sel?.chipIcon)).toBe(DOKUMENT_PFAD);
    expect(await s.evaluate<string | null>(fn(ATTR), [sel?.chipIcon, "width"])).toBe("13");
  });
  it("C8 · chip-titel 11.5px · 600 · #1A2233 — am realen Chip-Titel", async () => {
    const stil = zielStil(ziel, Z_CHIP_TITEL);
    expect(await messen(sel?.chipTitel, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await messen(sel?.chipTitel, "font-weight")).toBe(zielProp(stil, "font-weight"));
    expect(await messen(sel?.chipTitel, "color")).toBe(kanon(zielProp(stil, "color")));
  });
  it("C9 · chip-titel-wortlaut „1 · <Titel>“ — Nummer und ECHTER Titel der Quelle", async () => {
    expect(await text(sel?.chipTitel)).toBe(`1 · ${TITEL}`);
  });
  it("C10 · chip-fassung 10.5px · #525B6B — an der realen Fassungsangabe", async () => {
    const stil = zielStil(ziel, Z_CHIP_FASSUNG);
    expect(await messen(sel?.chipFassung, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await messen(sel?.chipFassung, "color")).toBe(kanon(zielProp(stil, "color")));
  });
  it("C11 · chip-ist-quelle — der Chip verlinkt das ECHTE Wissensobjekt (Deep-Link auf /wissen/<id>)", async () => {
    expect(fehler).toBeNull();
    const href = await (seite as Seite).evaluate<string | null>(
      fn(
        "(sel) => { const a = document.querySelector(sel + ' a'); return a ? a.getAttribute('href') : null; }",
      ),
      sel?.chip,
    );
    expect(href).toContain(koId);
  });

  // ---- Aktionsleiste (Zielbild Z.49-52) -----------------------------------------------------------
  it("A1 · aktionen-aussenmass 12px 16px 0 · abstand 8px — margin (alle Komponenten), gap, Kanten 16px vom Fensterrand an der realen Leiste", async () => {
    const stil = zielStil(ziel, Z_AKTIONEN);
    expect(await messen(sel?.aktionen, "display")).toBe(zielProp(stil, "display"));
    expect(await messen(sel?.aktionen, "gap")).toBe(zielProp(stil, "gap"));
    expect(await messen(sel?.aktionen, "margin")).toBe(kanonLaenge(zielProp(stil, "margin")));
    kantenGegenRand(await kanten(sel?.aktionen), "Aktionsleiste");
  });
  it("A2 · einfuegen-grund #C2500A · schrift #FFFFFF — am realen Einfuegen-Knopf", async () => {
    const stil = zielStil(ziel, Z_EINFUEGEN);
    expect(await messen(sel?.einfuegen, "background-color")).toBe(
      kanon(zielProp(stil, "background")),
    );
    expect(await messen(sel?.einfuegen, "color")).toBe(kanon(zielProp(stil, "color")));
  });
  it("A3 · einfuegen-radius 10px · 13.5px · 600 · 10px 0 — am realen Einfuegen-Knopf", async () => {
    const stil = zielStil(ziel, Z_EINFUEGEN);
    expect(await messen(sel?.einfuegen, "border-radius")).toBe(zielProp(stil, "border-radius"));
    expect(await messen(sel?.einfuegen, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await messen(sel?.einfuegen, "font-weight")).toBe(zielProp(stil, "font-weight"));
    expect(await messen(sel?.einfuegen, "padding")).toBe(kanonLaenge(zielProp(stil, "padding")));
    expect(await messen(sel?.einfuegen, "text-align")).toBe(zielProp(stil, "text-align"));
  });
  it("A4 · einfuegen-ohne-leuchten — box-shadow none am realen Einfuegen-Knopf (Zielbild kennt keinen)", async () => {
    expect(zielProp(zielStil(ziel, Z_EINFUEGEN), "box-shadow")).toBeNull();
    expect(await messen(sel?.einfuegen, "box-shadow")).toBe("none");
  });
  it("A5 · kopieren-grund #FFFFFF · schrift #1A2233 · rand hairline — am realen Kopieren-Knopf", async () => {
    const stil = zielStil(ziel, Z_KOPIEREN);
    const soll = kanonRand(zielProp(stil, "border"));
    expect(await messen(sel?.kopieren, "background-color")).toBe(
      kanon(zielProp(stil, "background")),
    );
    expect(await messen(sel?.kopieren, "color")).toBe(kanon(zielProp(stil, "color")));
    expect(await messen(sel?.kopieren, "border-top-width")).toBe(soll?.breite);
    expect(await messen(sel?.kopieren, "border-top-color")).toBe(soll?.farbe);
  });
  it("A6 · kopieren-radius 10px · 13.5px · 10px 0 — am realen Kopieren-Knopf", async () => {
    const stil = zielStil(ziel, Z_KOPIEREN);
    expect(await messen(sel?.kopieren, "border-radius")).toBe(zielProp(stil, "border-radius"));
    expect(await messen(sel?.kopieren, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await messen(sel?.kopieren, "padding")).toBe(kanonLaenge(zielProp(stil, "padding")));
  });
  it("A7 · zwei gleich breite Knoepfe nebeneinander (flex: 1) — Kanten der realen Knoepfe", async () => {
    expect(fehler).toBeNull();
    const k = await (seite as Seite).evaluate<{ e: number; k: number; gleicheZeile: boolean }>(
      fn(
        "([a, b]) => { const r1 = document.querySelector(a).getBoundingClientRect(); const r2 = document.querySelector(b).getBoundingClientRect(); return { e: r1.width, k: r2.width, gleicheZeile: Math.abs(r1.top - r2.top) < 1 }; }",
      ),
      [sel?.einfuegen, sel?.kopieren],
    );
    expect(k.gleicheZeile).toBe(true);
    expect(Math.abs(k.e - k.k)).toBeLessThan(1);
    expect(k.e).toBeGreaterThan(100);
  });
  it("A8 · aktionen-wortlaut „In Word einfügen“ / „Kopieren“ — dieselben Knoepfe wie heute", async () => {
    expect(await text(sel?.einfuegen)).toBe(zielText(ziel, Z_EINFUEGEN));
    expect(await text(sel?.kopieren)).toBe(zielText(ziel, Z_KOPIEREN));
  });

  // ---- Fusszeile (Zielbild Z.54-57) ---------------------------------------------------------------
  it("F1 · fuss-innenabstand 12px 16px · space-between — an der realen Fusszeile", async () => {
    const stil = zielStil(ziel, Z_FUSS);
    expect(await messen(sel?.fuss, "padding")).toBe(kanonLaenge(zielProp(stil, "padding")));
    expect(await messen(sel?.fuss, "display")).toBe(zielProp(stil, "display"));
    expect(await messen(sel?.fuss, "justify-content")).toBe(zielProp(stil, "justify-content"));
    expect(await messen(sel?.fuss, "align-items")).toBe(zielProp(stil, "align-items"));
    // Die Fusszeile spannt die volle Breite; ihr Text beginnt 16px vom Fensterrand, der Knopf endet dort.
    const f = await kanten(sel?.fuss);
    expect(Math.abs(f.links)).toBeLessThan(1);
    expect(Math.abs(f.rechts - ARTBOARD.breite)).toBeLessThan(1);
    expect(Math.abs((await kanten(sel?.fussHinweis)).links - RAND)).toBeLessThan(1);
    expect(Math.abs(ARTBOARD.breite - RAND - (await kanten(sel?.neueFrage)).rechts)).toBeLessThan(
      1,
    );
  });
  it("F2 · fuss-hinweis 11px · #525B6B · „Wörtlich zitiert · fachlich prüfen“ — am realen Hinweis", async () => {
    const stil = zielStil(ziel, Z_FUSS_TEXT);
    expect(await messen(sel?.fussHinweis, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await messen(sel?.fussHinweis, "color")).toBe(kanon(zielProp(stil, "color")));
    expect(await text(sel?.fussHinweis)).toBe(zielText(ziel, Z_FUSS_TEXT));
  });
  it("F3 · neue-frage 11px · #525B6B · „Neue Frage“ — am realen Knopf rechts", async () => {
    const stil = zielStil(ziel, Z_FUSS_TEXT);
    expect(await messen(sel?.neueFrage, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await messen(sel?.neueFrage, "color")).toBe(kanon(zielProp(stil, "color")));
    expect(await text(sel?.neueFrage)).toBe("Neue Frage");
    expect(ziel).toContain(">Neue Frage<");
  });
  it("F4 · neue-frage rechtsbuendig — der reale Knopf schliesst mit der rechten Fusskante ab", async () => {
    expect(fehler).toBeNull();
    const k = await (seite as Seite).evaluate<{
      fussRechts: number;
      knopfRechts: number;
      hinweisLinks: number;
      fussLinks: number;
    }>(
      fn(
        "([f, n, h]) => { const rf = document.querySelector(f).getBoundingClientRect(); const rn = document.querySelector(n).getBoundingClientRect(); const rh = document.querySelector(h).getBoundingClientRect(); return { fussRechts: rf.right, knopfRechts: rn.right, hinweisLinks: rh.left, fussLinks: rf.left }; }",
      ),
      [sel?.fuss, sel?.neueFrage, sel?.fussHinweis],
    );
    expect(Math.abs(k.fussRechts - 16 - k.knopfRechts)).toBeLessThan(2);
    expect(Math.abs(k.hinweisLinks - 16 - k.fussLinks)).toBeLessThan(2);
  });

  // ---- Der Leitsatz (Auftrag §5.7 — nicht im Zielbild, kommt hinzu) --------------------------------
  it("L1 · leitsatz „Keine KI-Antwort ohne Beleg · Vertrauliches bleibt vertraulich“ — sichtbar auf der Flaeche, unter der Fusszeile des Zielbilds", async () => {
    expect(await text(sel?.leitsatz)).toBe(LEITSATZ);
    expect(await sichtbar(sel?.leitsatz)).toBe(true);
    // Er verdraengt die Fusszeile des Zielbilds nicht: beide sichtbar, Leitsatz DARUNTER.
    expect(await sichtbar(sel?.fussHinweis)).toBe(true);
    const k = await (seite as Seite).evaluate<{ fussUnten: number; leitsatzOben: number }>(
      fn(
        "([f, l]) => ({ fussUnten: document.querySelector(f).getBoundingClientRect().bottom, leitsatzOben: document.querySelector(l).getBoundingClientRect().top })",
      ),
      [sel?.fuss, sel?.leitsatz],
    );
    expect(k.leitsatzOben).toBeGreaterThanOrEqual(k.fussUnten - 1);
  });

  // ---- Gesamtkomposition (Ben, Runde 3): EINE Flaeche, kein zweiter Bearbeitungsweg daneben -------
  it("G1 · Gesamtkomposition: sichtbare Kinder der Antwortflaeche sind genau Pille · Karte · Aktionen · Fusszeile · Leitsatz; Frage-Karte und Eingabefeld verborgen; kein unerwartetes Geschwister im Fragen-Bereich", async () => {
    expect(fehler).toBeNull();
    const lage = await (seite as Seite).evaluate<{
      zone: string[];
      bereich: string[];
      frageKarte: boolean | null;
      frageFeld: boolean | null;
    }>(
      fn(`() => {
        const sichtbar = (el) => { const r = el.getBoundingClientRect(); return getComputedStyle(el).display !== 'none' && r.height > 0 && r.width > 0; };
        const kinder = (id) => [...document.getElementById(id).children].filter(sichtbar).map((el) => el.id || el.tagName.toLowerCase());
        const g = (id) => document.getElementById(id);
        return { zone: kinder('ask-answer-block'), bereich: kinder('section-ask'), frageKarte: g('ask-karte') ? sichtbar(g('ask-karte')) : null, frageFeld: g('ask-input') ? sichtbar(g('ask-input')) : null };
      }`),
    );
    expect(lage.zone).toEqual([
      "ask-frage-zeile-btn",
      "antwortkarte",
      "antwortkarte-aktionen",
      "antwortkarte-fuss",
      "klara-leitsatz",
    ]);
    expect(lage.frageKarte, "die Frage-Karte ist im Antwortzustand sichtbar").toBe(false);
    expect(lage.frageFeld, "das Eingabefeld ist im Antwortzustand sichtbar").toBe(false);
    // Um die Antwortflaeche herum: das Begriffsbild (KA1) darueber, Pruef-/Regelsatz (mega81/mega75)
    // und die Zuruf-Karte (KA6) darunter — Flaechen anderer Auftraege, hier GEPINNT, damit kein
    // weiteres Geschwister still hinzukommt.
    expect(lage.bereich).toEqual([
      "ka1-block",
      "ask-answer-block",
      "ask-review-notice",
      "ask-rule-note",
      "ka6-block",
    ]);
  });
  it("G2 · Gesamtgeometrie 360×720: Antwortflaeche ueber die volle Fensterbreite, kein Ueberlauf, Reihenfolge Pille → Karte → Aktionen → Fusszeile → Leitsatz von oben nach unten", async () => {
    expect(fehler).toBeNull();
    const masse = await (seite as Seite).evaluate<{
      scrollBreite: number;
      fensterBreite: number;
      fensterHoehe: number;
    }>(
      fn(
        "() => ({ scrollBreite: document.documentElement.scrollWidth, fensterBreite: window.innerWidth, fensterHoehe: window.innerHeight })",
      ),
    );
    expect(masse.fensterBreite).toBe(ARTBOARD.breite);
    expect(masse.fensterHoehe).toBe(ARTBOARD.hoehe);
    expect(masse.scrollBreite).toBeLessThanOrEqual(ARTBOARD.breite);
    const zone = await kanten("#ask-answer-block");
    expect(Math.abs(zone.links)).toBeLessThan(1);
    expect(Math.abs(zone.breite - ARTBOARD.breite)).toBeLessThan(1);
    let vorher = Number.NEGATIVE_INFINITY;
    for (const el of [sel?.pille, sel?.karte, sel?.aktionen, sel?.fuss, sel?.leitsatz]) {
      const k = await kanten(el);
      expect(k.oben).toBeGreaterThanOrEqual(vorher);
      vorher = k.unten - 1;
    }
  });

  // ---- Die Wahrheiten, die nicht fallen duerfen (Verlustliste §5.2) — sichtbar oder bereit ------
  it("W1 · Einstufung, Konfliktlage und KI-Kennzeichnung leben IN der Karte; Kopier-Rueckfall und Bearbeitbarkeit bleiben", async () => {
    expect(fehler).toBeNull();
    const s = seite as Seite;
    const lage = await s.evaluate<Record<string, string | boolean | null>>(
      fn(`() => {
        const g = (id) => document.getElementById(id);
        const karte = g('antwortkarte');
        const drin = (id) => !!(karte && g(id) && karte.contains(g(id)));
        const sichtbar = (id) => { const el = g(id); if (!el) return null; const r = el.getBoundingClientRect(); return getComputedStyle(el).display !== 'none' && r.height > 0; };
        return {
          einstufungInKarte: drin('ask-evidence-note'), einstufungSichtbar: sichtbar('ask-evidence-note'),
          einstufungText: (g('ask-evidence-note') || {}).textContent || '',
          konfliktInKarte: drin('ask-conflict-line'), konfliktSichtbar: sichtbar('ask-conflict-line'),
          vorbehaltInKarte: drin('ask-caveat-line'),
          kiHinweisInKarte: drin('ask-ai-notice'),
          kiHinweisKlasse: (g('ask-ai-notice') || {}).className || '',
          bearbeitbar: !!g('ask-answer-edit') && !g('ask-answer-edit').readOnly && !g('ask-answer-edit').disabled,
          rueckfallDa: !!g('ask-copy-fallback') && !!g('ask-copy-fallback-text'),
          hinweisDa: !!g('ask-answer-edit-hint'),
          hinweisBeschreibt: (g('ask-answer-edit') || {}).getAttribute && g('ask-answer-edit').getAttribute('aria-describedby') === 'ask-answer-edit-hint',
          luecke: !!g('ask-gap-block') && g('ask-gap-block').className.indexOf('hidden') !== -1,
          reviewSichtbar: sichtbar('ask-review-notice'), regelSichtbar: sichtbar('ask-rule-note'),
          statusSichtbarWennGefuellt: !!g('ask-status'),
        };
      }`),
    );
    expect(lage.einstufungInKarte).toBe(true);
    expect(lage.einstufungSichtbar).toBe(true);
    expect(String(lage.einstufungText)).toMatch(/^Einstufung: /);
    expect(lage.konfliktInKarte).toBe(true);
    expect(lage.konfliktSichtbar).toBe(true);
    expect(lage.vorbehaltInKarte).toBe(true);
    expect(lage.kiHinweisInKarte).toBe(true);
    // retrieval-only: der Server setzt kein aiGenerated — der Satz bleibt verborgen (mega81).
    expect(lage.kiHinweisKlasse).toBe("muted hidden");
    expect(lage.bearbeitbar).toBe(true);
    expect(lage.rueckfallDa).toBe(true);
    expect(lage.hinweisDa).toBe(true);
    expect(lage.hinweisBeschreibt).toBe(true);
    expect(lage.luecke).toBe(true);
    // Pruefhinweis und Regelsatz sind im Antwortzustand sichtbar (mega75 C: „bei JEDER Antwort“).
    expect(lage.reviewSichtbar).toBe(true);
    expect(lage.regelSichtbar).toBe(true);
    expect(lage.statusSichtbarWennGefuellt).toBe(true);
  });

  // ---- Die offenen Werte: PROTOKOLL, kein Vergleich. Sie werden am realen Element gemessen und
  //      mit Grund ausgegeben; ein gruener Fall hier sagt nur „gemessen und begruendet“, nie „gleich“.
  const OFFEN: [string, () => Promise<string | null>, string, string][] = [
    [
      "fuss-lage margin-top auto",
      () => messen(sel?.fuss, "margin-top"),
      zielProp(zielStil(ziel, Z_FUSS), "margin-top") ?? "",
      "die 720px-Flexspalte des Artboards ist die Huelle (D4); das Panel scrollt heute als Fluss",
    ],
    [
      "antworttext-fussnoten (sup 10px #9C5009 700)",
      () => messen(sel?.text, "font-size"),
      `${zielProp(zielStil(ziel, Z_SUP), "font-size")} ${kanon(zielProp(zielStil(ziel, Z_SUP), "color"))} ${zielProp(zielStil(ziel, Z_SUP), "font-weight")}`,
      "der Server liefert Klartext ohne Satz-zu-Quelle-Zuordnung (eine tragende Quelle je Antwort); Marken je Satz waeren erfunden",
    ],
    [
      "chip-fassung-wortlaut (Rev. 0.91 / Q1-2025)",
      () => text(sel?.chipFassung),
      zielText(ziel, Z_CHIP_FASSUNG) ?? "",
      "das Wissensobjekt traegt keine Dokumentrevision; die Fassung nennt den ECHTEN Bearbeitungsstatus und das belegte Stand-Datum",
    ],
  ];
  for (const [name, lesen, soll, grund] of OFFEN) {
    it(`PROTOKOLL (kein Vergleich) · ${name} — offener Wert, am realen Element gemessen, begruendet`, async () => {
      const ist = await lesen();
      expect(ist, "reales Element liefert keinen Wert").not.toBeNull();
      console.info(
        `JOB 3004 D1 · OFFEN · ${name}: Zielbild ${soll} · Seite ${ist} · ${ist === soll ? "GLEICH" : "abweichend"} · ${grund}`,
      );
    });
  }

  // ---- Verhalten: Pille fuehrt zurueck zum Bearbeiten, „Neue Frage“ leert ----------------------
  it("V1 · Klick auf die Pille: die Frage steht wieder im Eingabefeld, die Antwortflaeche tritt zurueck", async () => {
    expect(fehler).toBeNull();
    const s = seite as Seite;
    await s.click(sel?.pille ?? "");
    const lage = await s.evaluate<{
      eingabe: string;
      eingabeSichtbar: boolean;
      antwortVerborgen: boolean;
    }>(
      fn(
        `() => { const i = document.getElementById('ask-input'); const r = i.getBoundingClientRect(); const k = document.getElementById('ask-karte').getBoundingClientRect(); return { eingabe: i.value, eingabeSichtbar: r.height > 0 && k.height > 0, antwortVerborgen: document.getElementById('ask-answer-block').className.indexOf('hidden') !== -1 }; }`,
      ),
    );
    expect(lage.eingabe).toBe(FRAGE);
    expect(lage.eingabeSichtbar).toBe(true);
    expect(lage.antwortVerborgen).toBe(true);
    // Zurueck in den Antwortzustand — ueber denselben echten Weg.
    await s.click("#ask-btn");
    await s.waitForFunction(
      fn(
        `() => { const b = document.getElementById('ask-answer-block'); const c = document.getElementById('ask-copy-btn'); const k = document.getElementById('ask-karte'); return b.className.indexOf('hidden') === -1 && !c.disabled && k.getBoundingClientRect().height === 0; }`,
      ),
      undefined,
      { timeout: 30_000 },
    );
  });
  it("V2 · „Neue Frage“: Eingabefeld leer und sichtbar, Antwortflaeche verborgen, Antwortfeld geleert", async () => {
    expect(fehler).toBeNull();
    const s = seite as Seite;
    await s.click(sel?.neueFrage ?? "");
    const lage = await s.evaluate<{
      eingabe: string;
      antwortVerborgen: boolean;
      feld: string;
      eingabeSichtbar: boolean;
    }>(
      fn(
        `() => { const i = document.getElementById('ask-input'); return { eingabe: i.value, eingabeSichtbar: i.getBoundingClientRect().height > 0 && document.getElementById('ask-karte').getBoundingClientRect().height > 0, antwortVerborgen: document.getElementById('ask-answer-block').className.indexOf('hidden') !== -1, feld: document.getElementById('ask-answer-edit').value }; }`,
      ),
    );
    expect(lage.eingabe).toBe("");
    expect(lage.eingabeSichtbar).toBe(true);
    expect(lage.antwortVerborgen).toBe(true);
    expect(lage.feld).toBe("");
  });

  // ---- Der „+n“-Chip: die echte Renderfunktion des Panels mit drei echten Wissensobjekten -------
  it("M1 · chip-mehr „+1“ bei drei Quellen — Wortlaut und Zaehlung an der realen Chip-Reihe", async () => {
    expect(fehler).toBeNull();
    const s = seite as Seite;
    const ids = [koId, ...weitereKoIds];
    // resolveAskSources/renderAskSources sind die Funktionen des ausgelieferten Skripts; die
    // Titel kommen ueber GET /api/kos/:id aus der echten App (Proxy oben).
    await s.evaluate(
      fn(
        "(ids) => resolveAskSources(ids).then((r) => { renderAskSources(r); document.getElementById('ask-answer-block').className = ''; })",
      ),
      ids,
    );
    await s.waitForFunction(
      fn(
        "() => document.querySelectorAll('#ask-sources li.quelle-chip').length === 2 && !!document.getElementById('ask-quellen-mehr-btn')",
      ),
      undefined,
      { timeout: 30_000 },
    );
    const lage = await s.evaluate<{ sichtbar: number; mehr: string | null }>(
      fn(
        `() => { const li = [...document.querySelectorAll('#ask-sources li.quelle-chip')]; const m = document.getElementById('ask-quellen-mehr-btn'); return { sichtbar: li.filter((l) => l.getBoundingClientRect().height > 0).length, mehr: m ? m.textContent.trim() : null }; }`,
      ),
    );
    expect(lage.sichtbar).toBe(2);
    expect(lage.mehr).toBe(zielText(ziel, Z_CHIP_MEHR));
  });
  it("M2 · chip-mehr 8px · 11.5px · #525B6B · 5px 9px — am realen „+n“-Chip", async () => {
    const stil = zielStil(ziel, Z_CHIP_MEHR);
    const m = "#ask-quellen-mehr-btn";
    expect(await messen(m, "border-radius")).toBe(zielProp(stil, "border-radius"));
    expect(await messen(m, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await messen(m, "color")).toBe(kanon(zielProp(stil, "color")));
    expect(await messen(m, "padding")).toBe(kanonLaenge(zielProp(stil, "padding")));
    expect(await messen(m, "background-color")).toBe(kanon(zielProp(stil, "background")));
  });
  it("M3 · Klick auf „+n“: alle drei echten Quellen sichtbar, der Chip tritt zurueck", async () => {
    expect(fehler).toBeNull();
    const s = seite as Seite;
    await s.click("#ask-quellen-mehr-btn");
    const lage = await s.evaluate<{ sichtbar: number; mehrDa: boolean; titel: string[] }>(
      fn(
        `() => { const li = [...document.querySelectorAll('#ask-sources li.quelle-chip')]; const m = document.getElementById('ask-quellen-mehr-btn'); return { sichtbar: li.filter((l) => l.getBoundingClientRect().height > 0).length, mehrDa: !!m && m.getBoundingClientRect().height > 0, titel: li.map((l) => l.querySelector('.quelle-chip-titel').textContent) }; }`,
      ),
    );
    expect(lage.sichtbar).toBe(3);
    expect(lage.mehrDa).toBe(false);
    expect(lage.titel[0]).toBe(`1 · ${TITEL}`);
    expect(lage.titel[1]).toBe("2 · Design Guide Halterungen");
    expect(lage.titel[2]).toBe("3 · HD Handbook Reinigung");
  });
});

describe.runIf(!existsSync(ZIELBILD))("JOB 3004 · Zielbild-Abgleich uebersprungen", () => {
  it("meldet den fehlenden Kontrollordner statt eine Pruefung vorzutaeuschen", () => {
    expect(existsSync(ZIELBILD), `Zielbild nicht lesbar: ${ZIELBILD}`).toBe(false);
  });
});
