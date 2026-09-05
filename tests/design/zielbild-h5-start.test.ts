// ================================================================================================
// JOB 3064 · H5 — DIE STARTSEITE GEGEN DAS ZIELBILD `design/klarwerk/Main.dc.html`, IN CHROMIUM
// AN DER GEMOUNTETEN ECHTEN ANWENDUNG GEMESSEN.
// ================================================================================================
//
// PEDIS FRAGE: „Sieht die Startseite jetzt so aus, wie ich sie am 04.09. gezeichnet habe — gemessen
// an der echten Seite, nicht an einem Nachbau?"
//
// WIE DIE ECHTE SEITE HIER LAEUFT (Muster: der abgeloeste `zielbild-konsole-start.test.ts`, JOB
// 3015 D5, und `zielbild-validierung.test.ts`, JOB 2618 D5):
//   · Die ECHTE Anwendung (`apps/web/dist`, das Ergebnis von `./tools/build`) wird in Chromium unter
//     `http://klarwerk.test/start` geladen; Playwright bedient `/assets/*`, `index.html` usw. aus
//     `dist` und reicht JEDEN `/api/*`-Aufruf an die ECHTE Fastify-App (`buildApp`, echte Dienste,
//     echter Bestand) weiter — mit dem Bearer der echten Anmeldung. React mountet `Start.tsx`
//     selbst, mit drei echten Wissensobjekten im Bestand.
//   · Das THEME wird ausdruecklich gesetzt: `localStorage["kw.designTheme"] = "modern"`; das
//     Zielbild ist die Werkbank-Palette.
//   · Gemessen wird per `getComputedStyle` an den REALEN Elementen. Der Beleg ist der SELEKTOR: fuer
//     jedes Element wird ein CSS-Pfad erzeugt und rueckwaerts aufgeloest —
//     `document.querySelector(pfad)` muss dasselbe Element liefern.
//
// SOLLWERTE: aus dem Zielbild GELESEN, nicht abgeschrieben. Kanonisiert ohne Renderer, wo das
// eindeutig ist (Hex → `rgb(r, g, b)`); Schatten und einheitenlose Zeilenhoehen kanonisiert eine
// SONDE im selben Renderer.
//
// EIN VERGLEICH JE TRAGENDEM WERT. Was bewusst NICHT verglichen wird (Kopfband und Seitenleiste der
// Huelle — JOB H1; Symbolpfade; zwei Grautoene ohne Token), steht unten als OFFENER Wert mit
// Begruendung: gemessen und protokolliert, nicht als gleich behauptet.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import i18n from "../../apps/web/src/i18n";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const WURZEL = resolve(process.cwd());
const DIST = resolve(WURZEL, "apps/web/dist");
const ZIELBILD = "/Users/peterkohnert/klarwerk_steuerung/design/klarwerk/Main.dc.html";
const ORIGIN = "http://klarwerk.test";

// ---- Das Zielbild lesen ---------------------------------------------------------------------------
/**
 * Der erste Stil des Zielbilds, der ALLE Anker enthält.
 *
 * Mehrere Anker sind kein Luxus: Feld (Z.38) und Karte (Z.46) tragen buchstabengleich
 * `background: #FFFFFF; border: 1px solid #E9E5DE; border-radius: 14px; box-shadow: …` und
 * unterscheiden sich nur an ihren Enden. Ein einzelner Anker träfe immer das Feld zuerst — die
 * Karte wäre dann gegen sich selbst nie gemessen worden.
 */
function zielStil(ziel: string, ...anker: string[]): string | null {
  const re = /style="([^"]*)"/g;
  for (let m = re.exec(ziel); m !== null; m = re.exec(ziel)) {
    const stil = m[1] ?? "";
    if (anker.every((a) => stil.includes(a))) return stil;
  }
  return null;
}
function zielProp(stil: string | null, eigenschaft: string): string | null {
  if (stil === null) return null;
  return new RegExp(`(?:^|[;\\s])${eigenschaft}\\s*:\\s*([^;]+)`).exec(stil)?.[1]?.trim() ?? null;
}
/**
 * Alle Wortlaute der `<div|span style="…anker…">TEXT</…>`-Elemente, in Reihenfolge des Zielbilds.
 * BEIDE Elementarten: die Zahl-Pille (Z.45) ist ein `span`, alles andere ein `div` — wer nur `div`
 * liest, verliert genau den Wert, den die Pille tragen soll.
 */
function zielTexte(ziel: string, anker: string): string[] {
  const out: string[] = [];
  const re = /<(div|span) style="([^"]*)">([^<]*)<\/\1>/g;
  for (let m = re.exec(ziel); m !== null; m = re.exec(ziel)) {
    if ((m[2] ?? "").includes(anker)) out.push((m[3] ?? "").trim());
  }
  return out;
}
/** Hex → `rgb(r, g, b)` (die Serialisierung von getComputedStyle); alles andere unveraendert. */
function kanon(wert: string | null): string | null {
  if (wert === null) return null;
  const m = /^#([0-9a-f]{6})$/i.exec(wert.trim());
  if (!m) return wert.trim();
  const h = m[1] ?? "";
  return `rgb(${Number.parseInt(h.slice(0, 2), 16)}, ${Number.parseInt(h.slice(2, 4), 16)}, ${Number.parseInt(h.slice(4, 6), 16)})`;
}
/** `svg`-Attribute des ersten Zielbild-Symbols mit dieser Groesse UND Strichfarbe. */
function zielSymbol(
  ziel: string,
  breite: string,
  strich: string,
): { width: string; strichBreite: string } | null {
  const re = new RegExp(
    `<svg width="(${breite})"[^>]*stroke="${strich}"[^>]*stroke-width="([^"]+)"[^>]*>`,
  );
  const m = re.exec(ziel);
  if (!m) return null;
  return { width: m[1] ?? "", strichBreite: m[2] ?? "" };
}

// Anker: eindeutige Stil-Fragmente je Zeile des Zielbilds (Z.15–Z.87).
const Z_RAHMEN = "width: 1280px; height: 800px";
const Z_KONSOLE = "padding-top: 64px; gap: 30px";
const Z_FRAGE = "font-size: 30px";
const Z_FELD = "width: 640px";
const Z_FELDTEXT = "flex-grow: 1; font-size: 16px";
const Z_RASTER = "grid-template-columns: repeat(2, minmax(0, 1fr))";
const Z_SPALTE = "display: flex; flex-direction: column; gap: 10px";
const Z_KOPFZEILE = "justify-content: space-between; padding: 0 4px";
const Z_KICKER = "font-size: 11px; letter-spacing: 0.5px";
const Z_PILLE = "font-size: 11px; font-weight: 700";
// ZWEI Anker: Feld (Z.38) und Karte (Z.46) teilen Grund, Rahmen, Radius und Schatten; nur die
// Karte trägt zusätzlich `overflow: hidden` und KEINE feste Breite.
const Z_KARTE_A = "border-radius: 14px";
const Z_KARTE_B = "overflow: hidden";
const Z_ZEILE = "gap: 12px; padding: 12px 16px";
const Z_PUNKT = "width: 8px; height: 8px";
const Z_ZEILENTEXT = "flex-grow: 1; font-size: 14px";
const Z_META = "font-size: 12.5px";

const ziel = existsSync(ZIELBILD) ? readFileSync(ZIELBILD, "utf8") : "";
const TX = {
  frage: zielTexte(ziel, Z_FRAGE)[0] ?? "",
  feld: zielTexte(ziel, Z_FELDTEXT)[0] ?? "",
  kicker: zielTexte(ziel, Z_KICKER),
  pille: zielTexte(ziel, Z_PILLE)[0] ?? "",
};

// ---- Die echte App in Chromium -------------------------------------------------------------------
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
  fill(selector: string, value: string): Promise<void>;
  press(selector: string, key: string): Promise<void>;
  click(selector: string): Promise<void>;
  url(): string;
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
let theme = "";
let boardZahl = -1;

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
/** In der Seite: die realen Elemente der Startseite finden, Selektoren zurueckgeben. */
const ELEMENTE = `([tx, pfadFnSrc]) => {
  const pfad = eval('(' + pfadFnSrc + ')');
  const q = (s) => document.querySelector(s);
  const frage = [...document.querySelectorAll('h1')].find((h) => (h.textContent || '').trim() === tx.frage) || null;
  if (!frage) return null;
  const konsole = frage.parentElement;
  const input = [...document.querySelectorAll('input')].find((i) => i.placeholder === tx.feld) || null;
  const feld = input ? input.closest('form') : null;
  const lupe = feld ? feld.querySelector('svg') : null;
  const mikro = q('[data-testid="h5-start-mikrofon"] svg');
  const fuerDich = q('[data-testid="h5-fuerdich"]');
  const zuletzt = q('[data-testid="h5-zuletzt"]');
  const spalte = fuerDich ? fuerDich.parentElement : null;
  const raster = spalte ? spalte.parentElement : null;
  const kopfzeile = spalte ? spalte.firstElementChild : null;
  const kicker = kopfzeile ? kopfzeile.querySelector('[data-h5-kicker]') : null;
  const pille = q('[data-testid="h5-fuerdich-pille"]');
  const zeile = q('[data-testid="h5-fuerdich-zeile"]');
  const punkt = zeile ? zeile.querySelector(':scope > span') : null;
  const zeilenTexte = zeile ? [...zeile.querySelectorAll('[data-h5-zeile]')] : [];
  const chevron = zeile ? zeile.querySelector('svg') : null;
  const zuletztZeile = q('[data-testid="h5-zuletzt-zeile"]');
  const dokument = zuletztZeile ? zuletztZeile.querySelector('svg') : null;
  const p = (e) => (e ? pfad(e) : null);
  const out = {
    frage: p(frage), konsole: p(konsole), input: p(input), feld: p(feld), lupe: p(lupe),
    mikro: p(mikro), raster: p(raster), spalte: p(spalte), kopfzeile: p(kopfzeile),
    kicker: p(kicker), kickerText: kicker ? (kicker.textContent || '').trim() : null,
    pille: p(pille), pilleText: pille ? (pille.textContent || '').trim() : null,
    karte: p(fuerDich), zweiteKarte: p(zuletzt), zeile: p(zeile), punkt: p(punkt),
    zeilenText: p(zeilenTexte[0] || null), meta: p(zeilenTexte[1] || null), chevron: p(chevron),
    zuletztZeile: p(zuletztZeile), dokument: p(dokument),
    zuletztKicker: zuletzt && zuletzt.parentElement ? (zuletzt.parentElement.querySelector('[data-h5-kicker]') || {}).textContent : null,
    rasterKinder: raster ? raster.children.length : 0,
  };
  const gefunden = [frage, konsole, input, feld, lupe, mikro, raster, spalte, kopfzeile, kicker, pille, fuerDich, zuletzt, zeile, punkt, chevron, zuletztZeile, dokument].filter(Boolean);
  out.aufgeloest = gefunden.every((e) => document.querySelector(pfad(e)) === e);
  return out;
}`;
const LESEN =
  "([sel, eig]) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).getPropertyValue(eig) : null; }";
const LESEN_PSEUDO =
  "([sel, pseudo, eig]) => { const el = document.querySelector(sel); return el ? getComputedStyle(el, pseudo).getPropertyValue(eig) : null; }";
const ATTRIBUT =
  "([sel, name]) => { const el = document.querySelector(sel); return el ? el.getAttribute(name) : null; }";
/** Die Sonde: ein leeres Element mit dem Zielbild-Stil, nur fuer die Serialisierung des Renderers. */
const SONDE =
  "([stil, eig]) => { const d = document.createElement('div'); d.setAttribute('style', stil); document.body.appendChild(d); const v = getComputedStyle(d).getPropertyValue(eig); d.remove(); return v; }";
const GEOMETRIE =
  "([a, b]) => { const x = document.querySelector(a).getBoundingClientRect(); const y = document.querySelector(b).getBoundingClientRect(); return { abstand: y.top - x.bottom, links: y.left - x.left, breite: y.width }; }";

interface Selektoren {
  frage: string;
  konsole: string;
  input: string | null;
  feld: string | null;
  lupe: string | null;
  mikro: string | null;
  raster: string | null;
  spalte: string | null;
  kopfzeile: string | null;
  kicker: string | null;
  kickerText: string | null;
  pille: string | null;
  pilleText: string | null;
  karte: string | null;
  zweiteKarte: string | null;
  zeile: string | null;
  punkt: string | null;
  zeilenText: string | null;
  meta: string | null;
  chevron: string | null;
  zuletztZeile: string | null;
  dokument: string | null;
  zuletztKicker: string | null;
  rasterKinder: number;
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

describe("JOB 3064 · H5 · die Startseite gegen `Main.dc.html` — die echte Seite in Chromium (Theme modern)", () => {
  beforeAll(async () => {
    try {
      // Ein fehlendes Zielbild ist ROT, kein gruener Ersatzfall — ohne Vorlage gibt es keine
      // Sollwerte, und eine Pruefung ohne Sollwerte darf nichts Gruenes melden.
      if (!existsSync(ZIELBILD)) {
        throw new Error(`Zielbild nicht lesbar: ${ZIELBILD}`);
      }
      if (!existsSync(join(DIST, "index.html"))) {
        throw new Error("apps/web/dist fehlt — vorher ./tools/build (im Tor laeuft es immer)");
      }
      const services = buildServices();
      app = buildApp(services);
      await app.ready();
      await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "Pedi", email: "pedi@job3064.test", password: "geheim12345" },
      });
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "pedi@job3064.test", password: "geheim12345" },
      });
      const token = (login.json() as { token: string }).token;
      const me = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { authorization: `Bearer ${token}` },
      });
      const autorId = (me.json() as { id: string }).id;
      // Der Rechtshinweis wird wie von einer wiederkehrenden Nutzerin quittiert — er ist Teil der
      // App-Huelle unter <main> und nicht Teil des Zielbilds.
      await app.inject({
        method: "POST",
        url: "/api/auth/notice",
        headers: { authorization: `Bearer ${token}` },
      });
      // Drei echte Wissensobjekte: sie fuellen das Pruefboard (→ eine Zeile in „FÜR DICH" mit der
      // echten Zahl) UND den Bestand, aus dem „ZULETZT" seine Eintraege zieht.
      for (const title of [
        "Halterungen ohne waagerechte Oberseiten",
        "Profile: Ablaufbohrung 8 mm",
        "Reinigung Spritzzone Linie 3",
      ]) {
        await services.ko.create({
          title,
          statement: "Aus dem Projekt gelernt, noch nicht freigegeben.",
          type: "best_practice",
          category: "Allgemein",
          author: autorId,
        } as never);
      }
      const board = await app.inject({
        method: "GET",
        url: "/api/validation/board",
        headers: { authorization: `Bearer ${token}` },
      });
      boardZahl = (board.json() as unknown[]).length;

      const require = createRequire(import.meta.url);
      const { chromium } = require("playwright") as {
        chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
      };
      browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
      });
      version = browser.version();
      // Das Zielbild ist 1280×800 (canvas.json) — exakt dieses Fenster hier.
      seite = await browser.newPage({ viewport: { width: 1280, height: 800 } });
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
      await seite.goto(`${ORIGIN}/start`, { waitUntil: "load", timeout: 60_000 });
      // Erst die Frage, dann die ZEILE (alle Quellen der Karte sind da) — sonst misst man ein Fenster.
      await seite.waitForFunction(
        fn(
          `(t) => [...document.querySelectorAll('h1')].some((h) => (h.textContent || '').trim() === t)`,
        ),
        TX.frage,
        { timeout: 30_000 },
      );
      await seite.waitForFunction(
        fn(`() => !!document.querySelector('[data-testid="h5-fuerdich-zeile"]')`),
        undefined,
        { timeout: 30_000 },
      );
      theme = await seite.evaluate<string>(
        fn(
          `() => document.documentElement.getAttribute('data-theme') || 'classic (kein Attribut)'`,
        ),
      );
      sel = await seite.evaluate<Selektoren | null>(fn(ELEMENTE), [TX, PFAD_FN]);
      console.info(
        `JOB 3064 H5 · Chromium ${version} · ${ORIGIN}/start · Theme ${theme} · Board ${boardZahl} · Selektoren ${JSON.stringify(sel)}`,
      );
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 3).join(" | ");
      // JOB 3060 Nachzug: die Zusicherung kuerzt den Text — der ganze Grund steht im Protokoll.
      console.error(`JOB 3064 H5 · Mount fehlgeschlagen: ${String(e)}`);
    }
  }, 180_000);

  afterAll(async () => {
    await browser?.close();
    await app?.close();
  }, 60_000);

  async function messen(
    selektor: string | null | undefined,
    eigenschaft: string,
  ): Promise<string | null> {
    expect(fehler, "Seite nicht gemountet").toBeNull();
    expect(selektor, "reales Element nicht gefunden").toBeTruthy();
    return (seite as Seite).evaluate<string | null>(fn(LESEN), [selektor, eigenschaft]);
  }
  async function sonde(stil: string | null, eigenschaft: string): Promise<string | null> {
    expect(stil, "Zielbild-Stil nicht gefunden").not.toBeNull();
    return (seite as Seite).evaluate<string | null>(fn(SONDE), [stil, eigenschaft]);
  }
  // Tailwinds `shadow-*` setzt vor dem eigentlichen Schatten zwei RING-Schichten, die ohne Ring
  // vollstaendig durchsichtig und ausdehnungslos sind. Der Vergleich gilt dem sichtbaren Schatten.
  function sichtbareSchatten(wert: string | null): string | null {
    return wert === null ? null : wert.replace(/rgba\(0, 0, 0, 0\) 0px 0px 0px 0px, /g, "");
  }

  it("Z · das Zielbild liefert jeden Wortlaut (die Sollwerte werden gelesen, nicht abgeschrieben)", () => {
    expect(TX.frage).not.toBe("");
    expect(TX.feld).not.toBe("");
    // Zwei Kicker: „FÜR DICH" und „ZULETZT".
    expect(TX.kicker).toHaveLength(2);
    expect(TX.pille).toMatch(/^\d+$/);
  });

  it("S · die echte Seite steht: Theme modern, reale Elemente gefunden, Selektoren rueckwaerts aufloesbar", () => {
    expect(fehler).toBeNull();
    expect(theme).toBe("modern");
    expect(sel?.aufgeloest).toBe(true);
    expect(sel?.konsole).toMatch(/^body > /);
  });

  // ---- Die Frage (Z.37) --------------------------------------------------------------------------
  it("V1 · frage-schriftgrad 30px — font-size am realen h1", async () => {
    expect(await messen(sel?.frage, "font-size")).toBe(
      kanon(zielProp(zielStil(ziel, Z_FRAGE), "font-size")),
    );
  });
  it("V2 · frage-gewicht 650 — font-weight am realen h1", async () => {
    expect(await messen(sel?.frage, "font-weight")).toBe(
      zielProp(zielStil(ziel, Z_FRAGE), "font-weight"),
    );
  });
  it("V3 · frage-laufweite -0.3px — letter-spacing am realen h1", async () => {
    expect(await messen(sel?.frage, "letter-spacing")).toBe(
      zielProp(zielStil(ziel, Z_FRAGE), "letter-spacing"),
    );
  });
  it("V4 · frage-farbe #1A2233 (geerbt vom Rahmen Z.15) — color am realen h1", async () => {
    expect(await messen(sel?.frage, "color")).toBe(
      kanon(zielProp(zielStil(ziel, Z_RAHMEN), "color")),
    );
  });
  it("V5 · konsole: Polster oben 64px, Abstand 30px, mittig — am realen Block (Z.36)", async () => {
    const stil = zielStil(ziel, Z_KONSOLE);
    expect(await messen(sel?.konsole, "padding-top")).toBe(zielProp(stil, "padding-top"));
    expect(await messen(sel?.konsole, "gap")).toBe(zielProp(stil, "gap"));
    expect(await messen(sel?.konsole, "align-items")).toBe(zielProp(stil, "align-items"));
  });

  // ---- Das Frage-Feld (Z.38–41) ------------------------------------------------------------------
  it("V6 · feld-breite 640px — width am realen Feld", async () => {
    expect(await messen(sel?.feld, "width")).toBe(zielProp(zielStil(ziel, Z_FELD), "width"));
  });
  it("V7 · feld-grund #FFFFFF und Rahmen 1px #E9E5DE — am realen Feld", async () => {
    const stil = zielStil(ziel, Z_FELD);
    const [breite, , farbe] = zielProp(stil, "border")?.split(" ") ?? [];
    expect(await messen(sel?.feld, "background-color")).toBe(kanon(zielProp(stil, "background")));
    expect(await messen(sel?.feld, "border-top-width")).toBe(breite);
    expect(await messen(sel?.feld, "border-top-color")).toBe(kanon(farbe ?? null));
  });
  it("V8 · feld-radius 14px — border-radius am realen Feld", async () => {
    expect(await messen(sel?.feld, "border-radius")).toBe(
      zielProp(zielStil(ziel, Z_FELD), "border-radius"),
    );
  });
  it("V9 · feld-schatten (Z.38, Sonde im selben Renderer) — box-shadow am realen Feld", async () => {
    expect(sichtbareSchatten(await messen(sel?.feld, "box-shadow"))).toBe(
      sichtbareSchatten(await sonde(zielStil(ziel, Z_FELD), "box-shadow")),
    );
  });
  it("V10 · feld-innenabstand 12px / Polster 16px 20px — gap, padding am realen Feld", async () => {
    const stil = zielStil(ziel, Z_FELD);
    const p = zielProp(stil, "padding")?.split(" ") ?? [];
    expect(await messen(sel?.feld, "gap")).toBe(zielProp(stil, "gap"));
    expect(await messen(sel?.feld, "padding-top")).toBe(p[0]);
    expect(await messen(sel?.feld, "padding-left")).toBe(p[1]);
  });
  it("V11 · lupe 20px, Strich #525B6B, 1.8 — am realen Symbol (Z.39)", async () => {
    const z = zielSymbol(ziel, "20", "#525B6B");
    expect(z).not.toBeNull();
    expect(await messen(sel?.lupe, "width")).toBe(`${z?.width}px`);
    expect(await messen(sel?.lupe, "stroke")).toBe(kanon("#525B6B"));
    expect(await messen(sel?.lupe, "stroke-width")).toBe(`${z?.strichBreite}px`);
  });
  it("V12 · mikrofon 18px, Strich #525B6B, 1.8 — am realen Symbol (Z.41)", async () => {
    const z = zielSymbol(ziel, "18", "#525B6B");
    expect(z).not.toBeNull();
    expect(await messen(sel?.mikro, "width")).toBe(`${z?.width}px`);
    expect(await messen(sel?.mikro, "stroke")).toBe(kanon("#525B6B"));
    expect(await messen(sel?.mikro, "stroke-width")).toBe(`${z?.strichBreite}px`);
  });
  it("V13 · feldtext-wortlaut (Z.40) und -schriftgrad 16px — placeholder, font-size am realen Feld", async () => {
    expect(sel?.input).toBeTruthy();
    expect(
      await (seite as Seite).evaluate<string | null>(fn(ATTRIBUT), [sel?.input, "placeholder"]),
    ).toBe(TX.feld);
    expect(await messen(sel?.input, "font-size")).toBe(
      kanon(zielProp(zielStil(ziel, Z_FELDTEXT), "font-size")),
    );
  });

  // ---- Das Raster und die zwei Karten (Z.43–87) ---------------------------------------------------
  it("V14 · raster: ZWEI gleiche Spalten, Abstand 24px, Breite 900px, Abstand oben 18px", async () => {
    expect(fehler).toBeNull();
    const stil = zielStil(ziel, Z_RASTER);
    const spalten =
      (await messen(sel?.raster, "grid-template-columns"))
        ?.split(" ")
        .map((s) => Number.parseFloat(s)) ?? [];
    expect(spalten).toHaveLength(2);
    expect(Math.max(...spalten) - Math.min(...spalten)).toBeLessThan(0.1);
    expect(await messen(sel?.raster, "gap")).toBe(zielProp(stil, "gap"));
    expect(await messen(sel?.raster, "width")).toBe(zielProp(stil, "width"));
    expect(await messen(sel?.raster, "margin-top")).toBe(zielProp(stil, "margin-top"));
    // Und wirklich ZWEI Karten — nicht drei, nicht eine.
    expect(sel?.rasterKinder).toBe(2);
  });
  it("V15 · spalte: Kicker ueber Karte, Abstand 10px (Z.44/67)", async () => {
    expect(await messen(sel?.spalte, "gap")).toBe(zielProp(zielStil(ziel, Z_SPALTE), "gap"));
    expect(await messen(sel?.spalte, "flex-direction")).toBe(
      zielProp(zielStil(ziel, Z_SPALTE), "flex-direction"),
    );
  });
  it("V16 · kopfzeile: Kicker links, Pille rechts, Polster 0 4px (Z.45)", async () => {
    const stil = zielStil(ziel, Z_KOPFZEILE);
    expect(await messen(sel?.kopfzeile, "justify-content")).toBe(zielProp(stil, "justify-content"));
    expect(await messen(sel?.kopfzeile, "padding-left")).toBe(
      zielProp(stil, "padding")?.split(" ")[1],
    );
  });
  it("V17 · kicker „FÜR DICH“ / „ZULETZT“: Wortlaut, 11px, Sperrung 0.5px, #525B6B (Z.45/68)", async () => {
    const stil = zielStil(ziel, Z_KICKER);
    expect(sel?.kickerText).toBe(TX.kicker[0]);
    expect((sel?.zuletztKicker ?? "").trim()).toBe(TX.kicker[1]);
    expect(await messen(sel?.kicker, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await messen(sel?.kicker, "letter-spacing")).toBe(zielProp(stil, "letter-spacing"));
    expect(await messen(sel?.kicker, "color")).toBe(kanon(zielProp(stil, "color")));
  });
  it("V18 · pille traegt die ECHTE Gesamtzahl der offenen Eintraege — kein Platzhalter (Z.45)", () => {
    expect(fehler).toBeNull();
    expect(boardZahl, "Kalibrierung: das Board ist nicht leer").toBeGreaterThanOrEqual(3);
    expect(sel?.pille).toBeTruthy();
    // Das Zielbild zeigt „3"; die Seite zeigt die WAHRE Summe. Gemessen wird die Form (eine reine
    // Zahl) UND dass sie mindestens die Boardzahl umfasst — die Karte buendelt mehrere Quellen.
    expect(sel?.pilleText).toMatch(/^\d+$/);
    expect(Number.parseInt(sel?.pilleText ?? "0", 10)).toBeGreaterThanOrEqual(boardZahl);
  });
  it("V19 · pille 11px / 700 / Sperrung 0.3px / #8A5A00 auf #FDF1D7 / Radius 999px / Polster 3px 10px", async () => {
    const stil = zielStil(ziel, Z_PILLE);
    const p = zielProp(stil, "padding")?.split(" ") ?? [];
    expect(await messen(sel?.pille, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await messen(sel?.pille, "font-weight")).toBe(zielProp(stil, "font-weight"));
    expect(await messen(sel?.pille, "letter-spacing")).toBe(zielProp(stil, "letter-spacing"));
    expect(await messen(sel?.pille, "color")).toBe(kanon(zielProp(stil, "color")));
    expect(await messen(sel?.pille, "background-color")).toBe(kanon(zielProp(stil, "background")));
    expect(await messen(sel?.pille, "border-radius")).toBe(zielProp(stil, "border-radius"));
    expect(await messen(sel?.pille, "padding-top")).toBe(p[0]);
    expect(await messen(sel?.pille, "padding-left")).toBe(p[1]);
  });
  for (const [i, name] of ["fuer-dich", "zuletzt"].entries()) {
    it(`V20.${i + 1} · karte ${name}: Grund weiss, Rahmen 1px #E9E5DE, Radius 14px, overflow hidden (Z.46/69)`, async () => {
      const stil = zielStil(ziel, Z_KARTE_A, Z_KARTE_B);
      const s = i === 0 ? sel?.karte : sel?.zweiteKarte;
      const [breite, , farbe] = zielProp(stil, "border")?.split(" ") ?? [];
      expect(await messen(s, "background-color")).toBe(kanon(zielProp(stil, "background")));
      expect(await messen(s, "border-top-width")).toBe(breite);
      expect(await messen(s, "border-top-color")).toBe(kanon(farbe ?? null));
      expect(await messen(s, "border-radius")).toBe(zielProp(stil, "border-radius"));
      expect(await messen(s, "overflow")).toBe(zielProp(stil, "overflow"));
    });
    it(`V21.${i + 1} · karte ${name}: Schatten (Z.46, Sonde) — box-shadow an der realen Karte`, async () => {
      const s = i === 0 ? sel?.karte : sel?.zweiteKarte;
      expect(sichtbareSchatten(await messen(s, "box-shadow"))).toBe(
        sichtbareSchatten(await sonde(zielStil(ziel, Z_KARTE_A, Z_KARTE_B), "box-shadow")),
      );
    });
  }

  // ---- Die Zeile (Z.47–52) ------------------------------------------------------------------------
  it("V22 · zeile: Abstand 12px, Polster 12px 16px, Trennlinie 1px #F2EFEA (Z.47)", async () => {
    const stil = zielStil(ziel, Z_ZEILE);
    const p = zielProp(stil, "padding")?.split(" ") ?? [];
    expect(await messen(sel?.zeile, "gap")).toBe(zielProp(stil, "gap"));
    expect(await messen(sel?.zeile, "padding-top")).toBe(p[0]);
    expect(await messen(sel?.zeile, "padding-left")).toBe(p[1]);
    const [breite, , farbe] = zielProp(stil, "border-bottom")?.split(" ") ?? [];
    expect(await messen(sel?.zeile, "border-bottom-width")).toBe(breite);
    expect(await messen(sel?.zeile, "border-bottom-color")).toBe(kanon(farbe ?? null));
  });
  it("V23 · zustandspunkt 8×8, rund, Warnton #8A5A00 (Z.48)", async () => {
    const stil = zielStil(ziel, Z_PUNKT);
    expect(await messen(sel?.punkt, "width")).toBe(zielProp(stil, "width"));
    expect(await messen(sel?.punkt, "height")).toBe(zielProp(stil, "height"));
    expect(await messen(sel?.punkt, "border-radius")).toBe(zielProp(stil, "border-radius"));
    // Die Zeile stammt aus dem Pruefboard — das ist Arbeit von HEUTE, und die erste Zeile des
    // Zielbilds hat genau diesen Ton. Ein anderer Ton hier hiesse eine andere Dringlichkeit.
    expect(await messen(sel?.punkt, "background-color")).toBe(kanon(zielProp(stil, "background")));
  });
  it("V24 · zeilentext 14px (Z.49) und Meta 12.5px / #525B6B (Z.50)", async () => {
    expect(await messen(sel?.zeilenText, "font-size")).toBe(
      kanon(zielProp(zielStil(ziel, Z_ZEILENTEXT), "font-size")),
    );
    const meta = zielStil(ziel, Z_META);
    expect(await messen(sel?.meta, "font-size")).toBe(zielProp(meta, "font-size"));
    expect(await messen(sel?.meta, "color")).toBe(kanon(zielProp(meta, "color")));
  });
  it("V25 · dokument-symbol 15px, Strich #525B6B, 1.8 an der Zeile von „ZULETZT“ (Z.71)", async () => {
    const z = zielSymbol(ziel, "15", "#525B6B");
    expect(z).not.toBeNull();
    expect(await messen(sel?.dokument, "width")).toBe(`${z?.width}px`);
    expect(await messen(sel?.dokument, "stroke")).toBe(kanon("#525B6B"));
    expect(await messen(sel?.dokument, "stroke-width")).toBe(`${z?.strichBreite}px`);
  });

  // ---- Die offenen Werte: gemessen, begruendet, nicht behauptet -----------------------------------
  it("OFFEN · feldtext-farbe #9AA2B1 (Z.40) — das Haus fuehrt diesen Ton nicht fuer Text", async () => {
    expect(fehler).toBeNull();
    const ist = await (seite as Seite).evaluate<string | null>(fn(LESEN_PSEUDO), [
      sel?.input,
      "::placeholder",
      "color",
    ]);
    console.info(
      `JOB 3064 H5 · OFFEN · Feldtext: Zielbild ${kanon(zielProp(zielStil(ziel, Z_FELDTEXT), "color"))} · Seite ${ist} · #9AA2B1 misst auf Weiss ~2,6:1 und faellt damit unter AA; themes.css fuehrt diesen Ton ausdruecklich NICHT fuer Text (--kw-ink-3, Kommentar dort). Das Produkt nimmt Tinte-2.`,
    );
    expect(ist).toBe(kanon("#525B6B"));
  });
  it("OFFEN · chevron-farbe #9AA2B1 (Z.51) — kein Token im Haus; Groesse und Strich sind verglichen", async () => {
    expect(fehler).toBeNull();
    const breite = await messen(sel?.chevron, "width");
    const strich = await messen(sel?.chevron, "stroke-width");
    const farbe = await messen(sel?.chevron, "stroke");
    console.info(
      `JOB 3064 H5 · OFFEN · Chevron: Zielbild 13px / 2 / ${kanon("#9AA2B1")} · Seite ${breite} / ${strich} / ${farbe} — der Ton ist dekorativ und hat in themes.css keinen Token; das Produkt nimmt Tinte-2.`,
    );
    expect(breite).toBe("13px");
    expect(strich).toBe("2px");
  });
  it("OFFEN · Rahmen-Grund #FAF8F5 (Z.15), Kopfband (Z.17–34) und Seitenleiste — App-Huelle, JOB H1", async () => {
    expect(fehler).toBeNull();
    const grund = await (seite as Seite).evaluate<string>(
      fn("() => getComputedStyle(document.body).getPropertyValue('background-color')"),
    );
    console.info(
      `JOB 3064 H5 · OFFEN · Seitengrund: Zielbild ${kanon(zielProp(zielStil(ziel, Z_RAHMEN), "background"))} · body ${grund} · Kopfband und Seitenleiste sind Gegenstand von JOB H1 (§10 des Auftrags)`,
    );
    expect(grund).not.toBe("");
  });
  it("OFFEN · Zentrierung von Feld und Raster (Z.36 align-items: center) — ein Layout-Ergebnis, gemessen", async () => {
    expect(fehler).toBeNull();
    const g = await (seite as Seite).evaluate<{
      abstand: number;
      links: number;
      breite: number;
    }>(fn(GEOMETRIE), [sel?.konsole, sel?.raster]);
    console.info(`JOB 3064 H5 · OFFEN · Raster im Block: ${JSON.stringify(g)}`);
    expect(g.breite).toBe(900);
  });

  // ---- Dreisprachig: der echte Sprachumschalter des Produkts, an der laufenden Seite --------------
  // JOB 3060 · H1: die Sprach-Pille der Kopfzeile ist mit Absicht weg (EIN Kopfband, Inventar §5a);
  // der Umschalter wohnt auf /profil (Zeile „Sprache", pages/Profile.tsx). Der Weg geht ueber die
  // Huelle selbst — Konto-Menue → Profil → Knopf „de/en/nl" → Kopfband-Punkt „Start" (SPA, ohne
  // Neuladen, damit die Wahl dieselbe Sitzung traegt). Die Zusicherungen (Frage, Feldtext, beide
  // Kicker aus dem Woerterbuch) bleiben unveraendert.
  for (const lng of ["en", "nl", "de"] as const) {
    it(`SPRACHE · ${lng}: Frage, Feldtext und beide Kicker kommen aus dem ${lng}-Woerterbuch`, async () => {
      expect(fehler).toBeNull();
      const s = seite as Seite;
      await s.click('[data-testid="kopfband-konto"]');
      await s.click('[data-testid="konto-profil"]');
      // Die Profilseite laedt ihre Daten nach — erst wenn der Sprachknopf steht, wird gemessen.
      await s.waitForFunction(
        fn(
          `(l) => location.pathname === '/profil' && [...document.querySelectorAll('main button')].some((x) => (x.textContent || '').trim().toLowerCase() === l)`,
        ),
        lng,
        { timeout: 15_000 },
      );
      const knopf = await s.evaluate<string | null>(
        fn(
          `([l, pfadFnSrc]) => { const pfad = eval('(' + pfadFnSrc + ')'); const b = [...document.querySelectorAll('main button')].find((x) => (x.textContent || '').trim().toLowerCase() === l); return b ? pfad(b) : null; }`,
        ),
        [lng, PFAD_FN],
      );
      expect(knopf, `kein Sprachknopf „${lng}“ auf /profil`).toBeTruthy();
      await s.click(knopf as string);
      await s.click('header a[data-kopfband-punkt="start"]');
      await s.waitForFunction(fn("() => location.pathname === '/start'"), undefined, {
        timeout: 15_000,
      });
      const t = i18n.getFixedT(lng);
      await s.waitForFunction(
        fn(
          `(x) => [...document.querySelectorAll('h1')].some((h) => (h.textContent || '').trim() === x)`,
        ),
        t("start.konsole.frage"),
        { timeout: 10_000 },
      );
      const texte = await s.evaluate<Record<string, string | null>>(
        fn(
          `([inputSel]) => ({ placeholder: document.querySelector(inputSel).getAttribute('placeholder'), kicker: [...document.querySelectorAll('[data-h5-kicker]')].map((e) => (e.textContent || '').trim()).join('|') })`,
        ),
        [sel?.input],
      );
      expect(texte.placeholder).toBe(t("start.konsole.feld"));
      expect(texte.kicker).toBe([t("start.fuerdich.kicker"), t("start.zuletzt.kicker")].join("|"));
    });
  }

  // ---- Das Feld FUNKTIONIERT: Eingabe plus Enter fuehrt auf /fragen -------------------------------
  // Steht am Ende, weil es die Seite verlaesst.
  it("F1 · Eingabe ‚Ventil' + Enter fuehrt auf /fragen?q=Ventil — die Frage geht dorthin, wo geantwortet wird", async () => {
    expect(fehler).toBeNull();
    expect(sel?.input).toBeTruthy();
    const s = seite as Seite;
    await s.fill(sel?.input as string, "Ventil");
    await s.press(sel?.input as string, "Enter");
    await s.waitForFunction(fn(`() => location.pathname === '/fragen'`), undefined, {
      timeout: 15_000,
    });
    const url = new URL(s.url());
    expect(url.pathname).toBe("/fragen");
    expect(url.searchParams.get("q")).toBe("Ventil");
  });
});
