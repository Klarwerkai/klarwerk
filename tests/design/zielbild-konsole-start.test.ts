// ================================================================================================
// JOB 3015 · D5 „KonsoleStart" — DIE STARTSEITE WIRD KONSOLE: Frage, Suchfeld, drei Karten, Leitsatz,
// gemessen an der in Chromium GEMOUNTETEN echten Anwendung, ein Vergleich je tragendem Wert.
// ================================================================================================
//
// PEDIS FRAGE: „Sieht die Startseite jetzt so aus, wie ich sie gezeichnet habe — gemessen an der
// echten Seite, nicht an einem Nachbau?"
//
// WIE DIE ECHTE SEITE HIER LAEUFT (Muster: tests/design/zielbild-validierung.test.ts, JOB 2618 D5):
//   · Die ECHTE Anwendung (`apps/web/dist`, das Ergebnis von `./tools/build`) wird in Chromium unter
//     `http://klarwerk.test/start` geladen; Playwright bedient `/assets/*`, `index.html` usw. aus
//     `dist` und reicht JEDEN `/api/*`-Aufruf an die ECHTE Fastify-App (`buildApp`, echte Dienste,
//     echter Bestand) weiter — mit dem Bearer der echten Anmeldung. React mountet `Start.tsx` selbst,
//     mit zwei echten Wissensobjekten im Pruefboard (die Pille „N offen" traegt deren Zahl).
//   · Das THEME wird ausdruecklich gesetzt: `localStorage["kw.designTheme"] = "modern"`; das
//     Zielbild (KonsoleStart.dc.html) ist die Werkbank-Palette.
//   · Gemessen wird per `getComputedStyle` an den REALEN Elementen, gefunden ueber ihren WORTLAUT
//     (der wiederum aus dem Zielbild gelesen wird, nicht abgeschrieben). Der Beleg ist der SELEKTOR:
//     fuer jedes Element wird ein CSS-Pfad erzeugt und rueckwaerts aufgeloest —
//     `document.querySelector(pfad)` muss dasselbe Element liefern.
//
// SOLLWERTE: aus dem Zielbild gelesen. Kanonisiert OHNE Renderer, wo das eindeutig ist (Hex →
// `rgb(r, g, b)`, `px` bleibt). Zwei Werte kanonisiert eine SONDE im selben Renderer: der Schatten
// (Chromium serialisiert `0 1px 2px rgba(…)` zu `rgba(…) 0px 1px 2px 0px`) und die einheitenlose
// Zeilenhoehe (`1.5` bei 13px → `19.5px`). Die Sonde ist ein leeres Element mit dem Zielbild-Stil,
// das nur fuer die Serialisierung existiert — sie misst nichts an der Seite.
//
// EIN VERGLEICH JE WERT. Was bewusst NICHT verglichen wird (Layout-Ergebnisse, die erst der Browser
// rechnet; Symbolpfade; der ⌘K-Chip; Rahmen und Fussleiste der App-Huelle), steht unten als OFFENER
// Wert mit Begruendung — gemessen und protokolliert, nicht als gleich behauptet.
//
// RUNDE 4 (bens Korrekturpflicht): das Fenster ist exakt 1280×800 wie das Zielbild (canvas.json Z.8);
// die RAUMWIRKUNG aus Z.25 (`flex-grow: 1; justify-content: center`) wird als Geometrie gemessen
// (V28–V31: Konsole = Inhaltskasten von <main>, Inhalt vertikal mittig, Frage erster Textblock);
// ein FEHLENDES Zielbild ist rot, kein gruener Ersatzfall; dazu der Ladefall ohne Pille und die drei
// Sprachen am echten Umschalter der Topbar.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import i18n from "../../apps/web/src/i18n";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const WURZEL = resolve(process.cwd());
const DIST = resolve(WURZEL, "apps/web/dist");
const ZIELBILD =
  "/Users/peterkohnert/Documents/Projekt_klarwerk/DESIGN_ZIELBILD_20260827/KonsoleStart.dc.html";
const ORIGIN = "http://klarwerk.test";

// ---- Das Zielbild lesen ---------------------------------------------------------------------------
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
/** Alle Wortlaute der `<div style="…anker…">TEXT</div>`-Elemente, in Reihenfolge des Zielbilds. */
function zielTexte(ziel: string, anker: string): string[] {
  const out: string[] = [];
  const re = /<div style="([^"]*)">([^<]*)<\/div>/g;
  for (let m = re.exec(ziel); m !== null; m = re.exec(ziel)) {
    if ((m[1] ?? "").includes(anker)) out.push((m[2] ?? "").trim());
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
/** `svg`-Attribute des ersten Zielbild-Symbols mit dieser Strichfarbe (width, stroke-width, d). */
function zielSymbol(
  ziel: string,
  strich: string,
): { width: string; strichBreite: string; d: string } | null {
  const re = new RegExp(
    `<svg width="(\\d+)"[^>]*stroke="${strich}"[^>]*stroke-width="([^"]+)"[^>]*>([\\s\\S]*?)</svg>`,
  );
  const m = re.exec(ziel);
  if (!m) return null;
  const d = /d="([^"]+)"/.exec(m[3] ?? "")?.[1] ?? "";
  return { width: m[1] ?? "", strichBreite: m[2] ?? "", d };
}

// Anker: eindeutige Stil-Fragmente je Zeile des Zielbilds (Z.15–Z.60).
const Z_RAHMEN = "width: 1280px; min-height: 800px";
const Z_KONSOLE = "gap: 44px; padding: 48px 0 72px";
const Z_FRAGEKOPF = "flex-direction: column; align-items: center; gap: 10px";
const Z_FRAGE = "font-size: 30px";
const Z_UNTERTITEL = "font-size: 14px; color: #525B6B";
const Z_FELD = "width: 640px";
const Z_FELDTEXT = "flex-grow: 1; font-size: 16px";
const Z_CHIP = "border-radius: 6px; padding: 2px 7px";
const Z_RASTER = "grid-template-columns: repeat(3, minmax(0, 1fr))";
const Z_KARTE = "padding: 26px 24px";
const Z_TITEL = "font-size: 16px; font-weight: 650";
const Z_TEXT = "font-size: 13px; line-height: 1.5";
const Z_PILLE = "font-size: 11.5px; font-weight: 700";
const Z_LEITSATZ = "font-size: 11.5px; color: #525B6B";

const ziel = existsSync(ZIELBILD) ? readFileSync(ZIELBILD, "utf8") : "";
const TX = {
  frage: zielTexte(ziel, Z_FRAGE)[0] ?? "",
  untertitel: zielTexte(ziel, Z_UNTERTITEL)[0] ?? "",
  feld: zielTexte(ziel, Z_FELDTEXT)[0] ?? "",
  titel: zielTexte(ziel, Z_TITEL),
  texte: zielTexte(ziel, Z_TEXT),
  pille: zielTexte(ziel, Z_PILLE)[0] ?? "",
  leitsatz: zielTexte(ziel, Z_LEITSATZ)[0] ?? "",
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
let boardHaengt = false;

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
/** In der Seite: die realen Elemente der Konsole ueber ihren Wortlaut finden, Selektoren zurueckgeben. */
const ELEMENTE = `([tx, pfadFnSrc]) => {
  const pfad = eval('(' + pfadFnSrc + ')');
  const alle = [...document.querySelectorAll('body *')];
  const blatt = (t) => alle.find((e) => e.children.length === 0 && (e.textContent || '').trim() === t) || null;
  const frage = blatt(tx.frage);
  if (!frage) return null;
  const fragekopf = frage.parentElement;
  const konsole = fragekopf.parentElement;
  const untertitel = blatt(tx.untertitel);
  const input = [...document.querySelectorAll('input')].find((i) => i.placeholder === tx.feld) || null;
  const feld = input ? input.parentElement : null;
  const lupe = feld ? feld.querySelector('svg') : null;
  const chip = feld ? [...feld.querySelectorAll('*')].find((e) => (e.textContent || '').trim() === '⌘K') || null : null;
  const karte = (titel) => {
    const t = blatt(titel);
    if (!t) return null;
    return { titel: t, karte: t.closest('a,[data-role-no-reach]'), text: t.nextElementSibling, symbol: t.closest('a,[data-role-no-reach]').querySelector('svg') };
  };
  const suchen = karte(tx.titel[0]), pruefen = karte(tx.titel[1]), hinzu = karte(tx.titel[2]);
  const raster = suchen && suchen.karte ? suchen.karte.parentElement : null;
  const pille = pruefen && pruefen.karte ? [...pruefen.karte.querySelectorAll('span')].find((s) => /^\\d+\\s/.test((s.textContent || '').trim())) || null : null;
  const leitsatz = blatt(tx.leitsatz);
  const p = (e) => (e ? pfad(e) : null);
  const out = {
    frage: p(frage), fragekopf: p(fragekopf), konsole: p(konsole), untertitel: p(untertitel),
    input: p(input), feld: p(feld), lupe: p(lupe), chip: p(chip), raster: p(raster),
    karten: [suchen, pruefen, hinzu].map((k) => (k && k.karte ? { karte: p(k.karte), titel: p(k.titel), text: p(k.text), symbol: p(k.symbol), href: k.karte.getAttribute('href') } : null)),
    pille: p(pille), pilleText: pille ? (pille.textContent || '').trim() : null,
    leitsatz: p(leitsatz),
  };
  const gefunden = [frage, fragekopf, konsole, untertitel, input, feld, lupe, raster, leitsatz, pille].filter(Boolean);
  out.aufgeloest = gefunden.every((e) => document.querySelector(pfad(e)) === e)
    && [suchen, pruefen, hinzu].every((k) => k && k.karte && document.querySelector(pfad(k.karte)) === k.karte && document.querySelector(pfad(k.titel)) === k.titel);
  return out;
}`;
const LESEN =
  "([sel, eig]) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).getPropertyValue(eig) : null; }";
const LESEN_PSEUDO =
  "([sel, pseudo, eig]) => { const el = document.querySelector(sel); return el ? getComputedStyle(el, pseudo).getPropertyValue(eig) : null; }";
const ATTRIBUT =
  "([sel, name]) => { const el = document.querySelector(sel); return el ? el.getAttribute(name) : null; }";
const TEXT =
  "(sel) => { const el = document.querySelector(sel); return el ? (el.textContent || '').trim() : null; }";
/** Die Sonde: ein leeres Element mit dem Zielbild-Stil, nur fuer die Serialisierung des Renderers. */
const SONDE =
  "([stil, eig]) => { const d = document.createElement('div'); d.setAttribute('style', stil); document.body.appendChild(d); const v = getComputedStyle(d).getPropertyValue(eig); d.remove(); return v; }";
const KANTEN =
  "([aussenSel, innenSel]) => { const a = document.querySelector(aussenSel).getBoundingClientRect(); const i = document.querySelector(innenSel).getBoundingClientRect(); return { links: i.left - a.left, rechts: a.right - i.right, breite: i.width }; }";
const LETZTE_ZEILE = `([leitsatzSel, konsoleSel]) => {
  const l = document.querySelector(leitsatzSel);
  const k = document.querySelector(konsoleSel);
  // Die Seite besteht aus zwei Bloecken (Runde 4): dem Konsolenblock (fuellt den ersten Bildschirm)
  // und dem Block der Altinhalte darunter; der Leitsatz ist das letzte Kind des zweiten Blocks,
  // und der erste Block (sein Vorgaenger) traegt die Konsole.
  const wurzel = l.parentElement;
  const unten = l.getBoundingClientRect().bottom;
  const darunter = [...wurzel.querySelectorAll('*')].filter((e) => e !== l && !l.contains(e) && (e.textContent || '').trim() !== '' && e.getBoundingClientRect().top >= unten - 1);
  const vorgaenger = wurzel.previousElementSibling;
  return { istLetztesKind: wurzel.lastElementChild === l, wurzelTraegtKonsole: !!vorgaenger && vorgaenger.contains(k) && vorgaenger.parentElement === wurzel.parentElement, textDarunter: darunter.length };
}`;
const HOEHEN =
  "(sels) => sels.map((s) => document.querySelector(s).getBoundingClientRect().height)";
/** In der Seite: die vertikale Geometrie der Konsole gegen den Inhaltskasten von <main>. */
const GEOMETRIE = `([konsoleSel, fragekopfSel, rasterSel, frageSel]) => {
  const main = document.querySelector('main');
  const m = main.getBoundingClientRect();
  const ms = getComputedStyle(main);
  const k = document.querySelector(konsoleSel).getBoundingClientRect();
  const ks = getComputedStyle(document.querySelector(konsoleSel));
  const f = document.querySelector(fragekopfSel).getBoundingClientRect();
  const r = document.querySelector(rasterSel).getBoundingClientRect();
  const h1 = document.querySelector(frageSel);
  const h1Top = h1.getBoundingClientRect().top;
  // Textkinder in <main>, die OBERHALB der Frage beginnen (Vorfahren der Frage ausgenommen).
  const darueber = [...main.querySelectorAll('*')]
    .filter((e) => !e.contains(h1) && e.children.length === 0 && (e.textContent || '').trim() !== '')
    .filter((e) => e.getBoundingClientRect().top < h1Top - 1)
    .map((e) => e.tagName.toLowerCase() + ' „' + (e.textContent || '').trim().slice(0, 40) + '“');
  return {
    fenster: window.innerHeight,
    mainInhaltOben: m.top + parseFloat(ms.paddingTop),
    mainInhaltUnten: m.bottom - parseFloat(ms.paddingBottom),
    konsoleOben: k.top, konsoleUnten: k.bottom, konsoleHoehe: k.height,
    luftOben: f.top - k.top - parseFloat(ks.paddingTop),
    luftUnten: k.bottom - parseFloat(ks.paddingBottom) - r.bottom,
    darueber,
  };
}`;

interface KarteSel {
  karte: string;
  titel: string;
  text: string | null;
  symbol: string | null;
  href: string | null;
}
interface Geometrie {
  fenster: number;
  mainInhaltOben: number;
  mainInhaltUnten: number;
  konsoleOben: number;
  konsoleUnten: number;
  konsoleHoehe: number;
  luftOben: number;
  luftUnten: number;
  darueber: string[];
}
interface Selektoren {
  frage: string;
  fragekopf: string;
  konsole: string;
  untertitel: string | null;
  input: string | null;
  feld: string | null;
  lupe: string | null;
  chip: string | null;
  raster: string | null;
  karten: (KarteSel | null)[];
  pille: string | null;
  pilleText: string | null;
  leitsatz: string | null;
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

describe("JOB 3015 · D5 · die Startseite als Konsole — die echte Seite, gemountet in Chromium (Theme modern)", () => {
  beforeAll(async () => {
    try {
      // Runde 4 (ben): ein fehlendes Zielbild ist ROT, kein gruener Ersatzfall — ohne Vorlage gibt
      // es keine Sollwerte, und eine Pruefung ohne Sollwerte darf nichts Gruenes melden.
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
        payload: { name: "Pedi", email: "pedi@job3015.test", password: "geheim12345" },
      });
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "pedi@job3015.test", password: "geheim12345" },
      });
      const token = (login.json() as { token: string }).token;
      const me = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { authorization: `Bearer ${token}` },
      });
      const autorId = (me.json() as { id: string }).id;
      // Der Rechtshinweis (legal/NoticeBanner.tsx) wird wie von einer wiederkehrenden Nutzerin
      // quittiert — derselbe Aufruf wie der Knopf im Band (`authApi.acknowledgeNotice`). Das Band
      // ist ein Element der App-Huelle UNTER <main> (AppShell.tsx, NoticeBanner) und nicht Teil des
      // Zielbilds; solange es steht, ist der freie erste Bildschirm um seine Hoehe kuerzer (gemessen:
      // 217px bei 1280×800), und die Geometrie V29/V30 misst dann die Huelle statt der Konsole.
      await app.inject({
        method: "POST",
        url: "/api/auth/notice",
        headers: { authorization: `Bearer ${token}` },
      });
      // Zwei echte Wissensobjekte im Pruefboard — die Zahl, die die Pille „N offen" tragen muss.
      for (const title of [
        "Halterungen ohne waagerechte Oberseiten",
        "Profile: Ablaufbohrung 8 mm",
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
      // Das Zielbild ist 1280×800 (canvas.json Z.8) — exakt dieses Fenster hier, damit die
      // vertikale Geometrie (V28–V31) am selben Rahmen gemessen wird wie gezeichnet.
      seite = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await seite.addInitScript(
        `try { localStorage.setItem("kw.designTheme", "modern"); } catch (e) {}`,
      );
      const a = app;
      await seite.route(`${ORIGIN}/**`, async (route) => {
        const req = route.request();
        const url = new URL(req.url());
        // LADEFALL: solange der Schalter steht, antwortet das Pruefboard nie — der Ladezustand
        // bleibt stehen. Dieselbe Seite, derselbe Browser: ein zweiter Chromium-Kontext ist im
        // Einzelprozess-Modus nicht moeglich (job2935-validierung-fussband.test.ts:442).
        if (boardHaengt && url.pathname === "/api/validation/board") {
          await new Promise<void>(() => undefined);
          return;
        }
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
      // Erst die Frage (Lieferung 1), dann die Pille (Board geladen) — sonst misst man ein Fenster.
      await seite.waitForFunction(
        fn(
          `(t) => [...document.querySelectorAll('h1')].some((h) => (h.textContent || '').trim() === t)`,
        ),
        TX.frage,
        { timeout: 30_000 },
      );
      await seite.waitForFunction(
        fn(
          `(n) => [...document.querySelectorAll('span')].some((s) => (s.textContent || '').trim().startsWith(n + ' '))`,
        ),
        String(boardZahl),
        { timeout: 30_000 },
      );
      theme = await seite.evaluate<string>(
        fn(
          `() => document.documentElement.getAttribute('data-theme') || 'classic (kein Attribut)'`,
        ),
      );
      sel = await seite.evaluate<Selektoren | null>(fn(ELEMENTE), [TX, PFAD_FN]);
      console.info(
        `JOB 3015 D5 · Chromium ${version} · ${ORIGIN}/start · Theme ${theme} · Board ${boardZahl} · Selektoren ${JSON.stringify(sel)}`,
      );
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 3).join(" | ");
    }
  }, 120_000);

  // Aufraeumen braucht unter Volllast des Tors mehr als die 10 s Standard (JOB 2935 D1).
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
  // Tailwinds `shadow-*` setzt vor den eigentlichen Schatten zwei RING-Schichten
  // (`var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000)`), die ohne Ring
  // vollstaendig durchsichtig und ausdehnungslos sind — sie zeichnen nichts. Der Vergleich gilt
  // dem sichtbaren Schatten; die unsichtbaren Nullschichten werden auf beiden Seiten entfernt.
  function sichtbareSchatten(wert: string | null): string | null {
    return wert === null ? null : wert.replace(/rgba\(0, 0, 0, 0\) 0px 0px 0px 0px, /g, "");
  }
  const karte = (i: number): KarteSel | null => sel?.karten[i] ?? null;

  it("Z · das Zielbild liefert jeden Wortlaut (die Sollwerte werden gelesen, nicht abgeschrieben)", () => {
    expect(TX.frage).not.toBe("");
    expect(TX.untertitel).not.toBe("");
    expect(TX.feld).not.toBe("");
    expect(TX.titel).toHaveLength(3);
    expect(TX.texte).toHaveLength(3);
    expect(TX.pille).toMatch(/^\d+ /);
    expect(TX.leitsatz).not.toBe("");
  });

  // ---- Red-first (§6): die Startseite beginnt mit der Frage des Zielbilds ----------------------
  it("R · die Startseite beginnt mit der Frage des Zielbilds — Wortlaut Z.27 als h1, font-size 30px", async () => {
    expect(fehler).toBeNull();
    expect(sel?.frage, `kein Element mit dem Wortlaut „${TX.frage}"`).toBeTruthy();
    expect(await messen(sel?.frage, "font-size")).toBe(
      kanon(zielProp(zielStil(ziel, Z_FRAGE), "font-size")),
    );
  });

  it("S · die echte Seite steht: Theme modern, reale Elemente gefunden, Selektoren rueckwaerts aufloesbar", () => {
    expect(fehler).toBeNull();
    expect(theme).toBe("modern");
    expect(sel?.aufgeloest).toBe(true);
    expect(sel?.konsole).toMatch(/^body > /);
    expect(sel?.karten.every((k) => k !== null)).toBe(true);
  });

  // ---- Der Fragekopf (Z.25–28) ------------------------------------------------------------------
  it("V1 · frage-gewicht 650 — font-weight am realen h1", async () => {
    expect(await messen(sel?.frage, "font-weight")).toBe(
      zielProp(zielStil(ziel, Z_FRAGE), "font-weight"),
    );
  });
  it("V2 · frage-laufweite -0.3px — letter-spacing am realen h1", async () => {
    expect(await messen(sel?.frage, "letter-spacing")).toBe(
      zielProp(zielStil(ziel, Z_FRAGE), "letter-spacing"),
    );
  });
  it("V3 · frage-farbe #1A2233 (geerbt vom Rahmen Z.15) — color am realen h1", async () => {
    expect(await messen(sel?.frage, "color")).toBe(
      kanon(zielProp(zielStil(ziel, Z_RAHMEN), "color")),
    );
  });
  it("V4 · untertitel-wortlaut und -schriftgrad 14px — am realen Untertitel", async () => {
    expect(sel?.untertitel).toBeTruthy();
    expect(await messen(sel?.untertitel, "font-size")).toBe(
      kanon(zielProp(zielStil(ziel, Z_UNTERTITEL), "font-size")),
    );
  });
  it("V5 · untertitel-farbe #525B6B — color am realen Untertitel", async () => {
    expect(await messen(sel?.untertitel, "color")).toBe(
      kanon(zielProp(zielStil(ziel, Z_UNTERTITEL), "color")),
    );
  });
  it("V6 · fragekopf-abstand 10px — gap am realen Fragekopf", async () => {
    expect(await messen(sel?.fragekopf, "gap")).toBe(zielProp(zielStil(ziel, Z_FRAGEKOPF), "gap"));
  });
  it("V7 · konsole-abstand 44px — gap an der realen Konsole", async () => {
    expect(await messen(sel?.konsole, "gap")).toBe(zielProp(zielStil(ziel, Z_KONSOLE), "gap"));
  });
  it("V8 · konsole-polster 48px oben / 72px unten — padding an der realen Konsole", async () => {
    const p = zielProp(zielStil(ziel, Z_KONSOLE), "padding")?.split(" ") ?? [];
    expect(await messen(sel?.konsole, "padding-top")).toBe(p[0]);
    expect(await messen(sel?.konsole, "padding-bottom")).toBe(p[2]);
  });

  // ---- Das Suchfeld (Z.31–33) -------------------------------------------------------------------
  it("V9 · feld-breite 640px — width am realen Feld", async () => {
    expect(await messen(sel?.feld, "width")).toBe(zielProp(zielStil(ziel, Z_FELD), "width"));
  });
  it("V10 · feld-grund #FFFFFF — background-color am realen Feld", async () => {
    expect(await messen(sel?.feld, "background-color")).toBe(
      kanon(zielProp(zielStil(ziel, Z_FELD), "background")),
    );
  });
  it("V11 · feld-rahmen 1px #E9E5DE — border-top-width/-color am realen Feld", async () => {
    const [breite, , farbe] = zielProp(zielStil(ziel, Z_FELD), "border")?.split(" ") ?? [];
    expect(await messen(sel?.feld, "border-top-width")).toBe(breite);
    expect(await messen(sel?.feld, "border-top-color")).toBe(kanon(farbe ?? null));
  });
  it("V12 · feld-radius 14px — border-radius am realen Feld", async () => {
    expect(await messen(sel?.feld, "border-radius")).toBe(
      zielProp(zielStil(ziel, Z_FELD), "border-radius"),
    );
  });
  it("V13 · feld-schatten (Z.31, Sonde im selben Renderer) — box-shadow am realen Feld", async () => {
    expect(sichtbareSchatten(await messen(sel?.feld, "box-shadow"))).toBe(
      sichtbareSchatten(await sonde(zielStil(ziel, Z_FELD), "box-shadow")),
    );
  });
  it("V14 · feld-innenabstand 12px / Polster 16px 20px — gap, padding am realen Feld", async () => {
    const p = zielProp(zielStil(ziel, Z_FELD), "padding")?.split(" ") ?? [];
    expect(await messen(sel?.feld, "gap")).toBe(zielProp(zielStil(ziel, Z_FELD), "gap"));
    expect(await messen(sel?.feld, "padding-top")).toBe(p[0]);
    expect(await messen(sel?.feld, "padding-left")).toBe(p[1]);
  });
  it("V15 · lupe 20px, Strich #525B6B, 1.8 — width, stroke, stroke-width am realen Symbol", async () => {
    const z = zielSymbol(ziel, "#525B6B");
    expect(z).not.toBeNull();
    expect(await messen(sel?.lupe, "width")).toBe(`${z?.width}px`);
    expect(await messen(sel?.lupe, "stroke")).toBe(kanon("#525B6B"));
    expect(await messen(sel?.lupe, "stroke-width")).toBe(`${z?.strichBreite}px`);
  });
  it("V16 · feldtext-wortlaut (Z.33) und -schriftgrad 16px — placeholder, font-size am realen Eingabefeld", async () => {
    expect(sel?.input).toBeTruthy();
    expect(
      await (seite as Seite).evaluate<string | null>(fn(ATTRIBUT), [sel?.input, "placeholder"]),
    ).toBe(TX.feld);
    expect(await messen(sel?.input, "font-size")).toBe(
      kanon(zielProp(zielStil(ziel, Z_FELDTEXT), "font-size")),
    );
  });
  it("V17 · feldtext-farbe #525B6B — color des ::placeholder am realen Eingabefeld", async () => {
    expect(fehler).toBeNull();
    expect(
      await (seite as Seite).evaluate<string | null>(fn(LESEN_PSEUDO), [
        sel?.input,
        "::placeholder",
        "color",
      ]),
    ).toBe(kanon(zielProp(zielStil(ziel, Z_FELDTEXT), "color")));
  });

  // ---- Die drei Karten (Z.37–56) ----------------------------------------------------------------
  it("V18 · raster drei gleiche Spalten, Abstand 20px, Breite 840px — am realen Raster", async () => {
    expect(fehler).toBeNull();
    // `repeat(3, minmax(0, 1fr))` loest der Browser zu drei Pixelspuren auf; die Spuren sind
    // gleich bis auf die Subpixel-Rundung von (840 − 2·20) / 3 (gemessen: 266.656/266.672px).
    const spalten =
      (await messen(sel?.raster, "grid-template-columns"))
        ?.split(" ")
        .map((s) => Number.parseFloat(s)) ?? [];
    expect(spalten).toHaveLength(3);
    expect(Math.max(...spalten) - Math.min(...spalten)).toBeLessThan(0.1);
    expect(await messen(sel?.raster, "gap")).toBe(zielProp(zielStil(ziel, Z_RASTER), "gap"));
    expect(await messen(sel?.raster, "width")).toBe(zielProp(zielStil(ziel, Z_RASTER), "width"));
  });
  for (const [i, name] of ["suchen", "pruefen", "hinzufuegen"].entries()) {
    it(`V19.${i + 1} · karte ${name}: Polster 26px 24px, Radius 14px, Rahmen #E9E5DE, Grund weiss, Abstand 12px — an der realen Karte`, async () => {
      const stil = zielStil(ziel, Z_KARTE);
      const p = zielProp(stil, "padding")?.split(" ") ?? [];
      expect(await messen(karte(i)?.karte, "padding-top")).toBe(p[0]);
      expect(await messen(karte(i)?.karte, "padding-left")).toBe(p[1]);
      expect(await messen(karte(i)?.karte, "border-radius")).toBe(zielProp(stil, "border-radius"));
      expect(await messen(karte(i)?.karte, "border-top-color")).toBe(
        kanon(zielProp(stil, "border")?.split(" ")[2] ?? null),
      );
      expect(await messen(karte(i)?.karte, "background-color")).toBe(
        kanon(zielProp(stil, "background")),
      );
      expect(await messen(karte(i)?.karte, "gap")).toBe(zielProp(stil, "gap"));
    });
    it(`V20.${i + 1} · karte ${name}: Schatten (Z.38, Sonde) — box-shadow an der realen Karte`, async () => {
      expect(sichtbareSchatten(await messen(karte(i)?.karte, "box-shadow"))).toBe(
        sichtbareSchatten(await sonde(zielStil(ziel, Z_KARTE), "box-shadow")),
      );
    });
    it(`V21.${i + 1} · karte ${name}: Symbol 24px, Strich #C2500A, 1.7 — am realen Symbol`, async () => {
      const z = zielSymbol(ziel, "#C2500A");
      expect(z).not.toBeNull();
      expect(await messen(karte(i)?.symbol, "width")).toBe(`${z?.width}px`);
      expect(await messen(karte(i)?.symbol, "stroke")).toBe(kanon("#C2500A"));
      expect(await messen(karte(i)?.symbol, "stroke-width")).toBe(`${z?.strichBreite}px`);
    });
    it(`V22.${i + 1} · karte ${name}: Titel 16px / 650 / #1A2233 — am realen Titel`, async () => {
      const stil = zielStil(ziel, Z_TITEL);
      expect(await messen(karte(i)?.titel, "font-size")).toBe(zielProp(stil, "font-size"));
      expect(await messen(karte(i)?.titel, "font-weight")).toBe(zielProp(stil, "font-weight"));
      expect(await messen(karte(i)?.titel, "color")).toBe(
        kanon(zielProp(zielStil(ziel, Z_RAHMEN), "color")),
      );
    });
    it(`V23.${i + 1} · karte ${name}: Text-Wortlaut, 13px, Zeilenhoehe 1.5 (Sonde), #525B6B — am realen Text`, async () => {
      const stil = zielStil(ziel, Z_TEXT);
      expect(await (seite as Seite).evaluate<string | null>(fn(TEXT), karte(i)?.text ?? null)).toBe(
        TX.texte[i],
      );
      expect(await messen(karte(i)?.text, "font-size")).toBe(zielProp(stil, "font-size"));
      expect(await messen(karte(i)?.text, "line-height")).toBe(await sonde(stil, "line-height"));
      expect(await messen(karte(i)?.text, "color")).toBe(kanon(zielProp(stil, "color")));
    });
  }

  // ---- Die Pille „N offen" (Z.46) ---------------------------------------------------------------
  it("V24 · pille traegt die ECHTE Zahl des Pruefboards (Wortlaut wie Z.46) — kein Platzhalter", () => {
    expect(fehler).toBeNull();
    expect(boardZahl, "Kalibrierung: das Board ist nicht leer").toBeGreaterThanOrEqual(2);
    expect(sel?.pille).toBeTruthy();
    // Zielbild „9 offen" → Seite „<Boardzahl> offen": dieselbe Wortform, die wahre Zahl.
    expect(sel?.pilleText).toBe(TX.pille.replace(/^\d+/, String(boardZahl)));
  });
  it("V25 · pille 11.5px / 700 / #8A5A00 auf #FDF1D7 / Radius 999px / Polster 3px 10px — an der realen Pille", async () => {
    const stil = zielStil(ziel, Z_PILLE);
    const p = zielProp(stil, "padding")?.split(" ") ?? [];
    expect(await messen(sel?.pille, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await messen(sel?.pille, "font-weight")).toBe(zielProp(stil, "font-weight"));
    expect(await messen(sel?.pille, "color")).toBe(kanon(zielProp(stil, "color")));
    expect(await messen(sel?.pille, "background-color")).toBe(kanon(zielProp(stil, "background")));
    expect(await messen(sel?.pille, "border-radius")).toBe(zielProp(stil, "border-radius"));
    expect(await messen(sel?.pille, "padding-top")).toBe(p[0]);
    expect(await messen(sel?.pille, "padding-left")).toBe(p[1]);
  });

  // ---- Der Leitsatz (Z.60) ----------------------------------------------------------------------
  it("V26 · leitsatz 11.5px / #525B6B — am realen Leitsatz", async () => {
    const stil = zielStil(ziel, Z_LEITSATZ);
    expect(sel?.leitsatz).toBeTruthy();
    expect(await messen(sel?.leitsatz, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await messen(sel?.leitsatz, "color")).toBe(kanon(zielProp(stil, "color")));
  });
  it("V27 · leitsatz ist die LETZTE Zeile der Startseite — letztes Kind der Seitenwurzel, kein Text darunter", async () => {
    expect(fehler).toBeNull();
    const z = await (seite as Seite).evaluate<{
      istLetztesKind: boolean;
      wurzelTraegtKonsole: boolean;
      textDarunter: number;
    }>(fn(LETZTE_ZEILE), [sel?.leitsatz, sel?.konsole]);
    expect(z).toEqual({ istLetztesKind: true, wurzelTraegtKonsole: true, textDarunter: 0 });
  });

  // ---- Die Raumwirkung (Z.25: flex-grow 1, justify-content center) bei 1280×800 -----------------
  // Runde 4 (bens Korrekturpflicht 1): die Konsole fuellt den freien ersten Bildschirm und ist
  // vertikal zentriert. `flex-grow` selbst ist hier nicht messbar (die Seite ist Inhalt des
  // scrollenden <main>, kein Flex-Kind der Huelle); gemessen wird die GLEICHWERTIGE Geometrie:
  // die Konsole beginnt am oberen und endet am unteren Inhaltsrand von <main>, und die freie Luft
  // ueber der Frage ist so gross wie die unter den Karten.
  it("V28 · konsole-zentrierung — justify-content am realen Konsolenblock (Zielbild Z.25)", async () => {
    expect(await messen(sel?.konsole, "justify-content")).toBe(
      zielProp(zielStil(ziel, Z_KONSOLE), "justify-content"),
    );
  });
  it("V29 · die Konsole fuellt den freien ersten Bildschirm (1280×800): Ober- und Unterkante = Inhaltskasten von <main>", async () => {
    expect(fehler).toBeNull();
    const g = await (seite as Seite).evaluate<Geometrie>(fn(GEOMETRIE), [
      sel?.konsole,
      sel?.fragekopf,
      sel?.raster,
      sel?.frage,
    ]);
    console.info(`JOB 3015 D5 · V29 · Geometrie ${JSON.stringify(g)}`);
    expect(g.fenster).toBe(800);
    expect(Math.abs(g.konsoleOben - g.mainInhaltOben)).toBeLessThan(1.5);
    expect(Math.abs(g.konsoleUnten - g.mainInhaltUnten)).toBeLessThan(1.5);
    // Kalibrierung: die Konsole ist wirklich hoeher als ihr Inhalt — es gibt Raum, der verteilt wird.
    expect(g.luftOben + g.luftUnten).toBeGreaterThan(40);
  });
  it("V30 · der Inhalt steht vertikal mittig: Luft ueber der Frage = Luft unter den Karten", async () => {
    expect(fehler).toBeNull();
    const g = await (seite as Seite).evaluate<Geometrie>(fn(GEOMETRIE), [
      sel?.konsole,
      sel?.fragekopf,
      sel?.raster,
      sel?.frage,
    ]);
    expect(g.luftOben).toBeGreaterThan(20);
    expect(Math.abs(g.luftOben - g.luftUnten)).toBeLessThan(1.5);
  });
  it("V31 · die Frage ist der erste sichtbare Inhaltsblock: kein Text in <main> beginnt oberhalb der Frage", async () => {
    expect(fehler).toBeNull();
    const g = await (seite as Seite).evaluate<Geometrie>(fn(GEOMETRIE), [
      sel?.konsole,
      sel?.fragekopf,
      sel?.raster,
      sel?.frage,
    ]);
    expect(g.darueber).toEqual([]);
  });

  // ---- Die Wege (Lieferung 2 und 3): keine neuen Routen, jede Karte fuehrt auf ein bekanntes Ziel --
  it("W1 · die drei Karten fuehren auf /fragen, /validierung, /erfassen (Admin: alle drei begehbar)", () => {
    expect(fehler).toBeNull();
    expect(sel?.karten.map((k) => k?.href ?? null)).toEqual([
      "/fragen",
      "/validierung",
      "/erfassen",
    ]);
  });

  // ---- Die offenen Werte: gemessen, begruendet, nicht behauptet ----------------------------------
  it("OFFEN · ⌘K-Chip (Z.34) — bewusst nicht gebaut: ⌘K oeffnet im Produkt die Seitensprung-Palette (shell/CommandPalette.tsx), nicht dieses Feld", async () => {
    expect(fehler).toBeNull();
    console.info(
      `JOB 3015 D5 · OFFEN · ⌘K-Chip: Zielbild ${zielStil(ziel, Z_CHIP) ?? "—"} · Seite ${sel?.chip ?? "kein Chip"} · eine angezeigte Taste, die etwas anderes tut, waere eine Scheinfunktion`,
    );
    expect(sel?.chip).toBeNull();
  });
  it("OFFEN · Symbolpfade (Lupe Z.32/39, Schild Z.45, Plus Z.52) — Produkt zeichnet mit lucide-react, das Zielbild von Hand; Groesse, Strich und Farbe sind oben verglichen", async () => {
    expect(fehler).toBeNull();
    const s = seite as Seite;
    const pfade = await Promise.all(
      [sel?.lupe, karte(0)?.symbol, karte(1)?.symbol, karte(2)?.symbol].map((q) =>
        s.evaluate<string | null>(
          fn(
            "(q) => { const e = document.querySelector(q); return e ? [...e.querySelectorAll('path,circle')].map((p) => p.getAttribute('d') || ('circle r=' + p.getAttribute('r'))).join(' | ') : null; }",
          ),
          q ?? "",
        ),
      ),
    );
    console.info(
      `JOB 3015 D5 · OFFEN · Symbolpfade: Zielbild Lupe ${zielSymbol(ziel, "#525B6B")?.d} · Schild/Plus ${zielSymbol(ziel, "#C2500A")?.d} · Seite ${JSON.stringify(pfade)}`,
    );
    expect(pfade.every((p) => p !== null && p.length > 0)).toBe(true);
  });
  it("OFFEN · Zentrierung von Feld und Raster (Z.25 align-items: center) — ein Layout-Ergebnis des Browsers, gemessen als Kantenabstand", async () => {
    expect(fehler).toBeNull();
    const s = seite as Seite;
    const feld = await s.evaluate<{ links: number; rechts: number; breite: number }>(fn(KANTEN), [
      sel?.konsole,
      sel?.feld,
    ]);
    const raster = await s.evaluate<{ links: number; rechts: number; breite: number }>(fn(KANTEN), [
      sel?.konsole,
      sel?.raster,
    ]);
    console.info(
      `JOB 3015 D5 · OFFEN · Zentrierung: Feld links ${feld.links} rechts ${feld.rechts} · Raster links ${raster.links} rechts ${raster.rechts}`,
    );
    expect(Math.abs(feld.links - feld.rechts)).toBeLessThan(2);
    expect(Math.abs(raster.links - raster.rechts)).toBeLessThan(2);
  });
  it("OFFEN · gleiche Kartenhoehe (Z.37, Raster-Streckung) — ein Layout-Ergebnis des Browsers, gemessen", async () => {
    expect(fehler).toBeNull();
    const h = await (seite as Seite).evaluate<number[]>(
      fn(HOEHEN),
      sel?.karten.map((k) => k?.karte ?? ""),
    );
    console.info(`JOB 3015 D5 · OFFEN · Kartenhoehen: ${JSON.stringify(h)}`);
    expect(Math.max(...h) - Math.min(...h)).toBeLessThan(2);
  });
  it("OFFEN · Rahmen-Grund #FAF8F5 (Z.15), Kopfband (Z.17–23) und Fussleiste (Z.59–62) — App-Huelle, nicht Start.tsx (§8); der Seitengrund wird gemessen, nicht verglichen", async () => {
    expect(fehler).toBeNull();
    const grund = await (seite as Seite).evaluate<string>(
      fn("() => getComputedStyle(document.body).getPropertyValue('background-color')"),
    );
    console.info(
      `JOB 3015 D5 · OFFEN · Seitengrund: Zielbild ${kanon(zielProp(zielStil(ziel, Z_RAHMEN), "background"))} · body ${grund} · Kopfband/Fussleiste ausserhalb des Auftrags`,
    );
    expect(grund).not.toBe("");
  });

  it("KLASSISCH · Protokoll: derselbe Aufbau ohne Umschalter — Frage-Farbe, Untertitel-Farbe, Feld-Rahmen an denselben Selektoren", async () => {
    expect(fehler).toBeNull();
    const s = seite as Seite;
    await s.evaluate(fn(`() => document.documentElement.removeAttribute('data-theme')`));
    const frage = await s.evaluate<string | null>(fn(LESEN), [sel?.frage, "color"]);
    const unter = await s.evaluate<string | null>(fn(LESEN), [sel?.untertitel, "color"]);
    const rahmen = await s.evaluate<string | null>(fn(LESEN), [sel?.feld, "border-top-color"]);
    await s.evaluate(fn(`() => document.documentElement.setAttribute('data-theme', 'modern')`));
    console.info(
      `JOB 3015 D5 · KLASSISCH · Frage ${frage} · Untertitel ${unter} · Feldrahmen ${rahmen} (Zielbild ${kanon("#1A2233")} / ${kanon("#525B6B")} / ${kanon("#E9E5DE")})`,
    );
    expect(frage).not.toBeNull();
  });

  // ---- Dreisprachig (Lieferung 1, 3, 4): der Sprachumschalter der Topbar, an der laufenden Seite --
  for (const lng of ["en", "nl", "de"] as const) {
    it(`SPRACHE · ${lng}: Frage, Feldtext, Kartentitel, Pille und Leitsatz kommen aus dem ${lng}-Woerterbuch`, async () => {
      expect(fehler).toBeNull();
      const s = seite as Seite;
      // Der echte Umschalter (shell/Topbar.tsx, LangPill): ein Knopf je Sprache mit dem Kuerzel.
      const knopf = await s.evaluate<string | null>(
        fn(
          `([l, pfadFnSrc]) => { const pfad = eval('(' + pfadFnSrc + ')'); const b = [...document.querySelectorAll('header button')].find((x) => (x.textContent || '').trim() === l); return b ? pfad(b) : null; }`,
        ),
        [lng, PFAD_FN],
      );
      expect(knopf, `kein Sprachknopf „${lng}“ in der Topbar`).toBeTruthy();
      await s.click(knopf as string);
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
          `([inputSel, leitsatzSel, rasterSel]) => { const raster = document.querySelector(rasterSel); return { placeholder: document.querySelector(inputSel).getAttribute('placeholder'), leitsatz: (document.querySelector(leitsatzSel).textContent || '').trim(), pille: ([...raster.querySelectorAll('span')].find((x) => /^\\d+\\s/.test((x.textContent || '').trim())) || {}).textContent || null, titel: [...raster.querySelectorAll(':scope > a > div:nth-child(2)')].map((d) => (d.textContent || '').trim()).join('|') }; }`,
        ),
        [sel?.input, sel?.leitsatz, sel?.raster],
      );
      expect(texte.placeholder).toBe(t("start.konsole.feld"));
      expect(texte.leitsatz).toBe(t("start.konsole.leitsatz"));
      expect(texte.pille?.trim()).toBe(t("start.konsole.offen", { n: boardZahl }));
      expect(texte.titel).toBe(
        [
          t("start.konsole.suchen.titel"),
          t("start.konsole.pruefen.titel"),
          t("start.konsole.hinzufuegen.titel"),
        ].join("|"),
      );
    });
  }

  // ---- Der Ladefall (Lieferung 3): solange das Board nicht geantwortet hat, gibt es KEINE Pille --
  // Die Seite wird mit haengendem Board NEU GELADEN (gleicher Browser, gleiche Seite, Schalter in
  // der Routenweiche oben); danach wieder normal geladen, damit F1 die geladene Seite bedient.
  it("LADEFALL · Board antwortet nicht: die Karte Pruefen steht, aber ohne Pille — keine erfundene Zahl", async () => {
    expect(fehler).toBeNull();
    const s = seite as Seite;
    const warteAufFrage = async (): Promise<void> => {
      await s.waitForFunction(
        fn(
          `(x) => [...document.querySelectorAll('h1')].some((h) => (h.textContent || '').trim() === x)`,
        ),
        TX.frage,
        { timeout: 30_000 },
      );
    };
    boardHaengt = true;
    try {
      await s.goto(`${ORIGIN}/start`, { waitUntil: "load", timeout: 60_000 });
      await warteAufFrage();
      // Die uebrigen Quellen sind da (Arbeitsuebersicht laedt noch, weil das Board fehlt) — kurz
      // stehen lassen, damit eine verspaetete Pille sich zeigen KOENNTE, wenn es sie gaebe.
      await s.evaluate(fn("() => new Promise((r) => setTimeout(r, 800))"));
      const lage = await s.evaluate<{ pruefen: boolean; pille: string | null }>(
        fn(
          `(titel) => { const t = [...document.querySelectorAll('div')].find((d) => d.children.length === 0 && (d.textContent || '').trim() === titel); const karte = t ? t.closest('a,[data-role-no-reach]') : null; const p = karte ? [...karte.querySelectorAll('span')].find((x) => /^\\d+\\s/.test((x.textContent || '').trim())) : null; return { pruefen: !!karte, pille: p ? p.textContent : null }; }`,
        ),
        TX.titel[1],
      );
      expect(lage.pruefen).toBe(true);
      expect(lage.pille).toBeNull();
    } finally {
      boardHaengt = false;
      await s.goto(`${ORIGIN}/start`, { waitUntil: "load", timeout: 60_000 });
      await warteAufFrage();
    }
  });

  // ---- Lieferung 2: das Feld FUNKTIONIERT — Eingabe plus Enter fuehrt in die Bibliothekssuche ----
  // Steht am Ende, weil es die Seite verlaesst. Zielroute: `/bibliothek?q=…` — derselbe Weg wie die
  // Topbar-Suche (shell/Topbar.tsx:549), gelesen in pages/Library.tsx:211 (`params.get("q")`).
  it("F1 · Eingabe ‚Ventil' + Enter fuehrt auf /bibliothek?q=Ventil — der belegte Suchweg des Produkts", async () => {
    expect(fehler).toBeNull();
    expect(sel?.input).toBeTruthy();
    const s = seite as Seite;
    await s.fill(sel?.input as string, "Ventil");
    await s.press(sel?.input as string, "Enter");
    await s.waitForFunction(fn(`() => location.pathname === '/bibliothek'`), undefined, {
      timeout: 15_000,
    });
    const url = new URL(s.url());
    expect(url.pathname).toBe("/bibliothek");
    expect(url.searchParams.get("q")).toBe("Ventil");
  });
});
