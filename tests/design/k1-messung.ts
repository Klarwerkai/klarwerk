// ================================================================================================
// JOB 3056 · K1 — DAS MESSGERAET FUER DIE KLARA-FLAECHEN NACH PEDIS MOCKUPS VOM 04.09.2026.
// ================================================================================================
//
// Gemeinsame Werkbank der vier Chromium-Messungen (zielbild-k1-ruhe / -antwort / -einstellungen /
// -kein-erklaertext) und des Funktionsinventars (k1-funktionsinventar). Muster: JOB 3004 D1
// (die Messung zielbild-klara-main, in JOB 3056 geloescht — das alte Zielbild ist durch die Mockups
// ERSETZT; der Name traegt seitdem nur noch den Abloesungs-Waechter).
//
// WIE DIE ECHTE FLAECHE LAEUFT:
//   · Die ECHTE Auslieferung `apps/web/dist/word-addin/taskpane.html` (Ergebnis von ./tools/build)
//     wird in Chromium unter `http://klarwerk.test/word-addin/taskpane.html` geladen. Playwright
//     bedient jede Datei aus `dist` und reicht JEDEN `/api/*`-Aufruf an die ECHTE Fastify-App
//     (`buildApp`, echte Dienste, echter Bestand) weiter — mit dem Bearer der echten Anmeldung.
//   · Das externe office.js wird NICHT geladen (leeres Skript statt Egress): das Panel erkennt
//     daraus ehrlich „kein Office" und nimmt den Eingabefeld-Weg.
//   · Gemessen wird per `getComputedStyle` an den REALEN Elementen.
//
// DIE SOLLWERTE KOMMEN AUS DEN MOCKUPS (design/klara/*.dc.html): `zielStil` findet das Element
// ueber einen Anker in seinem style-Attribut, `zielProp` liest eine Eigenschaft daraus, und die
// `kanon*`-Helfer bringen den Wert in Chromiums Serialisierung (Hex → rgb(), Schatten, unitless
// line-height × font-size, nackte Null → 0px). Ein Vergleich je Wert — nie ein Nachbau.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";
import { expect } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import { buildApp, buildServices } from "../../services/app/src/build-app";

export const WURZEL = resolve(process.cwd());
export const DIST = resolve(WURZEL, "apps/web/dist");
export const MOCKUPS = "/Users/peterkohnert/klarwerk_steuerung/design/klara";
export const MOCKUP_RUHE = join(MOCKUPS, "Ruhe.dc.html");
export const MOCKUP_ANTWORT = join(MOCKUPS, "Main.dc.html");
export const MOCKUP_EINSTELLUNGEN = join(MOCKUPS, "Einstellungen.dc.html");
export const ORIGIN = "http://klarwerk.test";
export const PANEL = `${ORIGIN}/word-addin/taskpane.html`;
const OFFICE_JS = "https://appsforoffice.microsoft.com/**";
/** Die Artboards (canvas.json): 360 × 720 — das Fenster der Messung. */
export const ARTBOARD = { breite: 360, hoehe: 720 };

/** Das echte Wissensobjekt und die Frage, die es trifft (wie mega79 / JOB 3004). */
export const FRAGE = "Ventil Wartung Druck entlasten";
export const AUSSAGE = "Ventil vor der Wartung entlasten und den Druck pruefen.";
export const TITEL = "Ventil entlasten vor Wartung";
export const NUTZER = { name: "Pedi", email: "pedi@job3056.test", password: "geheim12345" };

// ---- Das Mockup lesen ---------------------------------------------------------------------------
export function mockup(pfad: string): string {
  return existsSync(pfad) ? readFileSync(pfad, "utf8") : "";
}
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
/** Sichtbarer Wortlaut des Elements, dessen style-Attribut den Anker traegt. */
export function zielText(ziel: string, anker: string): string | null {
  const i = ziel.indexOf(anker);
  if (i < 0) return null;
  const m = /^[^>]*>([^<]*)</.exec(ziel.slice(i));
  return m?.[1]?.trim() ?? null;
}
/** Ein Attribut eines SVG im Mockup, gefunden ueber einen Anker im Tag. */
export function zielSvgAttr(ziel: string, anker: string, name: string): string | null {
  const i = ziel.indexOf(anker);
  if (i < 0) return null;
  const tag = ziel.slice(ziel.lastIndexOf("<svg", i), ziel.indexOf(">", i));
  return new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
}
/** Hex → `rgb(r, g, b)` (die Serialisierung von getComputedStyle); alles andere unveraendert. */
export function kanon(wert: string | null): string | null {
  if (wert === null) return null;
  const m = /^#([0-9a-f]{6})$/i.exec(wert.trim());
  if (!m) return wert.trim();
  const h = m[1] ?? "";
  return `rgb(${Number.parseInt(h.slice(0, 2), 16)}, ${Number.parseInt(h.slice(2, 4), 16)}, ${Number.parseInt(h.slice(4, 6), 16)})`;
}
/** `0 1px 2px rgba(…), …` → Chromiums Serialisierung `rgba(…) 0px 1px 2px 0px, …`. */
export function kanonSchatten(wert: string | null): string | null {
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
export function kanonLaenge(wert: string | null | undefined): string | null {
  if (wert === null || wert === undefined) return null;
  return wert
    .trim()
    .split(/\s+/)
    .map((t) => (t === "0" ? "0px" : t))
    .join(" ");
}
/** Unitless line-height × font-size → Pixel, wie getComputedStyle sie liefert. */
export function kanonZeilenhoehe(
  lineHeight: string | null,
  fontSize: string | null,
): string | null {
  if (lineHeight === null || fontSize === null) return null;
  const lh = Number.parseFloat(lineHeight);
  const fs = Number.parseFloat(fontSize);
  if (Number.isNaN(lh) || Number.isNaN(fs) || /px$/.test(lineHeight)) return lineHeight;
  return `${Math.round(lh * fs * 1000) / 1000}px`;
}
/** `1px solid #E9E5DE` → die drei Einzelwerte, wie border-top-* sie liefern. */
export function kanonRand(
  wert: string | null,
): { breite: string; stil: string; farbe: string } | null {
  if (wert === null) return null;
  const t = wert.trim().split(/\s+/);
  return { breite: t[0] ?? "", stil: t[1] ?? "", farbe: kanon(t[2] ?? null) ?? "" };
}

// ---- Die echte Flaeche in Chromium ---------------------------------------------------------------
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
    body?: string | Buffer;
    contentType?: string;
    headers?: Record<string, string>;
  }): Promise<void>;
  /** Runde 4: die Anfrage scheitert wie ohne Netz (Lage „Keine Verbindung"). */
  abort(): Promise<void>;
  /** Runde 4: an die naechste (frueher registrierte) Route weiterreichen — die Werkbank-Route. */
  fallback(): Promise<void>;
}
export type RouteHandler = (route: Route) => Promise<void>;
export interface Seite {
  route(url: string, handler: RouteHandler): Promise<void>;
  /** Runde 4: eine gestellte Lage wird wieder abgeraeumt — die Route der Werkbank gilt dann wieder. */
  unroute(url: string, handler?: RouteHandler): Promise<void>;
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  waitForFunction(fn: BrowserFn, arg?: unknown, opts?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(fn: BrowserFn, arg?: unknown): Promise<T>;
  fill(selector: string, value: string): Promise<void>;
  click(selector: string): Promise<void>;
  type(selector: string, text: string): Promise<void>;
  focus(selector: string): Promise<void>;
  on(ereignis: string, handler: (e: unknown) => void): void;
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
  return { body: readFileSync(join(DIST, "index.html")), typ: MIME[".html"] ?? "text/html" };
}

export interface Flaeche {
  seite: Seite;
  version: string;
  koId: string;
  /** Runde 4: die Ids der weiteren validierten Objekte (`weitereObjekte`), in Reihenfolge. */
  weitereIds: string[];
  /** Seitenfehler (`pageerror`) seit dem Laden — ein leeres Feld ist Teil jeder Zusicherung. */
  seitenfehler: string[];
  schliessen(): Promise<void>;
}

/** Runde 4: eine Word-Lage — office.js wird durch eine Attrappe ersetzt, die genau das liefert. */
export interface WordLage {
  /** Was Word als Markierung liefert (getSelectedDataAsync, Text und HTML). */
  markierung: string;
  /** Der Text des ganzen Dokuments (Word.run → body.text / body.getHtml). */
  dokument: string;
}

/**
 * Runde 4: eine GESTELLTE Klara-Sitzung. Der Test-Server eroeffnet keine (kein Word-Dokumentkontext,
 * s. zielbild-k1-einstellungen); die Routen unter /api/klara/** antworten dann aus diesen Bauern —
 * bei JEDEM Abruf neu gelesen, damit ein Test die Auflösung zwischen zwei Abrufen aendern kann.
 */
export interface KlaraLage {
  sicht: () => Record<string, unknown>;
  aufloesung: () => Record<string, unknown>;
  /** Antwort auf POST …/consent (Zustimmen) bzw. DELETE …/consent (Widerrufen); fehlt sie: `sicht`. */
  zustimmen?: () => Record<string, unknown>;
  widerrufen?: () => Record<string, unknown>;
}

export interface FlaecheOptionen {
  mitWissen?: boolean;
  /** Weitere validierte Wissensobjekte — fuer Antworten mit mehreren Quellen (Fussnoten, „+n"). */
  weitereObjekte?: Array<{ titel: string; aussage: string }>;
  word?: WordLage;
  klara?: KlaraLage;
  /** Wann die Flaeche „steht" (Ausdruck in der Seite). Vorgabe: der Sendeknopf ist frei —
   *  mit gestellter Sitzung, die das Fragen sperrt (Zustimmung verlangt), stattdessen z. B. der
   *  aufgeloeste KI-Modus. */
  bereitWenn?: string;
}

/** Der Ask-Vertrag als Route — fuer Lagen, die der Test-Server nicht stellt (mehrere Quellen,
 *  lange Antwort, KI-Kennzeichnung, Vorbehalt, Ausschnitt). Die Quellen bleiben ECHTE Objekte. */
export const ASK_URL = `${ORIGIN}/api/ask`;
export function askAntwort(ergebnis: Record<string, unknown>): RouteHandler {
  return async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ result: ergebnis, gap: null, receipt: "r" }),
      contentType: "application/json",
    });
  };
}

/**
 * Die office.js-Attrappe: `Office.onReady`, die Markierung, das Dokument (Word.run mit body.text und
 * body.getHtml in einem sync), `setSelectedDataAsync` als Einfuege-Empfaenger, KEIN Office-Dialog
 * (`context.ui` fehlt → der Anmeldeweg nimmt das Fallback-Fenster). Mehr nicht — jede weitere
 * Faehigkeit waere eine Behauptung ueber Word, die dieser Pruefstand nicht belegen kann.
 */
export function wordAttrappe(lage: WordLage): string {
  return `(function () {
  var MARKIERUNG = ${JSON.stringify(lage.markierung)};
  var DOKUMENT = ${JSON.stringify(lage.dokument)};
  window.__kwEingefuegt = [];
  window.__kwHandler = [];
  window.Office = {
    onReady: function (cb) { setTimeout(cb, 0); },
    CoercionType: { Text: "text", Html: "html" },
    AsyncResultStatus: { Succeeded: "succeeded", Failed: "failed" },
    EventType: { DocumentSelectionChanged: "documentSelectionChanged" },
    context: {
      document: {
        url: "",
        getSelectedDataAsync: function (typ, cb) {
          cb({ status: "succeeded", value: typ === "html" ? "<p>" + MARKIERUNG + "</p>" : MARKIERUNG });
        },
        addHandlerAsync: function (typ, fn) { window.__kwHandler.push(fn); },
        setSelectedDataAsync: function (text, opts, cb) { window.__kwEingefuegt.push(text); cb({ status: "succeeded" }); }
      }
    }
  };
  window.Word = {
    InsertLocation: { replace: "Replace" },
    run: function (fn) {
      var body = {
        text: DOKUMENT,
        load: function () {},
        getHtml: function () { return { value: "<p>" + DOKUMENT + "</p>" }; },
        inlinePictures: { items: [], load: function () {} }
      };
      var context = {
        document: {
          body: body,
          getSelection: function () {
            return {
              insertText: function (text) { window.__kwEingefuegt.push(text); },
              paragraphs: { items: [], load: function () {} }
            };
          }
        },
        sync: function () { return Promise.resolve(); }
      };
      return Promise.resolve().then(function () { return fn(context); });
    }
  };
})();`;
}

/**
 * Startet die echte App, meldet den Nutzer an, legt (auf Wunsch) das validierte Wissensobjekt an
 * und laedt das ausgelieferte Panel in Chromium (360 × 720). Wartet, bis der Sendeknopf frei ist
 * (echter GET /api/auth/me — die Anmeldung ist belegt).
 */
export async function starteFlaeche(opts: FlaecheOptionen = {}): Promise<Flaeche> {
  const panelDatei = join(DIST, "word-addin/taskpane.html");
  if (!existsSync(panelDatei)) {
    throw new Error("apps/web/dist/word-addin/taskpane.html fehlt — vorher ./tools/build");
  }
  const services = buildServices();
  const app = buildApp(services);
  await app.ready();
  await app.inject({ method: "POST", url: "/api/auth/register", payload: NUTZER });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: NUTZER.email, password: NUTZER.password },
  });
  const token = (login.json() as { token: string }).token;
  const headers = { authorization: `Bearer ${token}` };
  const anlegen = async (titel: string, aussage: string): Promise<string> => {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: { title: titel, statement: aussage, type: "best_practice", category: "Wartung" },
    });
    const id = (res.json() as { id: string }).id;
    await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers,
      payload: { action: "admin-validate" },
    });
    return id;
  };
  let koId = "";
  if (opts.mitWissen !== false) {
    koId = await anlegen(TITEL, AUSSAGE);
  }
  const weitereIds: string[] = [];
  for (const o of opts.weitereObjekte ?? []) {
    weitereIds.push(await anlegen(o.titel, o.aussage));
  }
  if (koId !== "" || weitereIds.length > 0) {
    await services.aiCheckWorker?.idle();
  }

  const require = createRequire(import.meta.url);
  const { chromium } = require("playwright") as {
    chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
  };
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
  });
  const seite = await browser.newPage({
    viewport: { width: ARTBOARD.breite, height: ARTBOARD.hoehe },
  });
  const seitenfehler: string[] = [];
  seite.on("pageerror", (e) => {
    seitenfehler.push(String(e));
  });
  const officeSkript = opts.word ? wordAttrappe(opts.word) : "";
  await seite.route(OFFICE_JS, async (route) => {
    await route.fulfill({ status: 200, body: officeSkript, contentType: "application/javascript" });
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
      const res = await app.inject({
        method: req.method() as "GET",
        url: url.pathname + url.search,
        headers: kopf,
        ...(body !== null ? { payload: body } : {}),
      });
      await route.fulfill({
        status: res.statusCode,
        body: res.body,
        headers: { "content-type": (res.headers["content-type"] as string) ?? "application/json" },
      });
      return;
    }
    const d = distDatei(url.pathname);
    await route.fulfill({ status: 200, body: d.body, contentType: d.typ });
  });
  // Die gestellte Klara-Sitzung: NACH der Werkbank-Route registriert, also vor ihr geprueft.
  const klara = opts.klara;
  if (klara) {
    await seite.route(`${ORIGIN}/api/klara/**`, async (route) => {
      const req = route.request();
      const pfad = new URL(req.url()).pathname;
      const methode = req.method();
      let body: Record<string, unknown> = {};
      if (pfad === "/api/klara/sessions" && methode === "POST") body = klara.sicht();
      else if (pfad === "/api/klara/ai-status") body = klara.aufloesung();
      else if (pfad.endsWith("/consent") && methode === "POST")
        body = (klara.zustimmen ?? klara.sicht)();
      else if (pfad.endsWith("/consent") && methode === "DELETE")
        body = (klara.widerrufen ?? klara.sicht)();
      else if (pfad.endsWith("/document-context")) body = klara.sicht();
      await route.fulfill({
        status: 200,
        body: JSON.stringify(body),
        contentType: "application/json",
      });
    });
  }
  await seite.goto(PANEL, { waitUntil: "load", timeout: 60_000 });
  await seite.waitForFunction(
    fn(
      opts.bereitWenn ??
        "() => { const b = document.getElementById('ask-btn'); return !!b && !b.disabled; }",
    ),
    undefined,
    { timeout: 30_000 },
  );
  return {
    seite,
    version: browser.version(),
    koId,
    weitereIds,
    seitenfehler,
    async schliessen() {
      await browser.close();
      await app.close();
    },
  };
}

/** Die echte Frage ueber das echte Feld und den echten Knopf; wartet den Antwortzustand ab. */
export async function frageStellen(seite: Seite, frage = FRAGE): Promise<void> {
  await seite.fill("#ask-input", frage);
  await seite.click("#ask-btn");
  await seite.waitForFunction(
    fn(
      "() => { const b = document.getElementById('ask-answer-block'); const c = document.getElementById('ask-copy-btn'); return !!b && b.className.indexOf('hidden') === -1 && !!c && !c.disabled; }",
    ),
    undefined,
    { timeout: 30_000 },
  );
}

// ---- Lesen in der Seite ------------------------------------------------------------------------
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
const LESEN =
  "([sel, eig]) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).getPropertyValue(eig) : null; }";
const TEXT =
  "(sel) => { const el = document.querySelector(sel); return el ? (el.textContent || '').replace(/\\s+/g, ' ').trim() : null; }";
const SICHTBAR =
  "(sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && r.width > 0 && r.height > 0; }";
const PFAD_D =
  "(sel) => { const el = document.querySelector(sel); const p = el ? el.querySelector('path') : null; return p ? p.getAttribute('d') : null; }";
const ATTR =
  "([sel, name]) => { const el = document.querySelector(sel); return el ? el.getAttribute(name) : null; }";
const KANTEN =
  "(sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { links: r.left, rechts: r.right, oben: r.top, unten: r.bottom, breite: r.width, hoehe: r.height }; }";

export interface Kanten {
  links: number;
  rechts: number;
  oben: number;
  unten: number;
  breite: number;
  hoehe: number;
}

/**
 * Loest eine Menge von Kennungen/Selektoren in CSS-Pfade auf, die rueckwaerts dasselbe Element
 * liefern. `null` = nicht gefunden (Fall S verlangt: kein einziges null).
 */
export async function aufloesen(
  seite: Seite,
  roh: Record<string, string>,
): Promise<Record<string, string | null> & { aufgeloest: boolean }> {
  return seite.evaluate(
    fn(`([pfadFnSrc, roh]) => {
      const pfad = eval('(' + pfadFnSrc + ')');
      const out = {};
      let aufgeloest = true;
      for (const k of Object.keys(roh)) {
        const el = document.querySelector(roh[k]);
        out[k] = el ? pfad(el) : null;
        if (el && document.querySelector(out[k]) !== el) aufgeloest = false;
      }
      out.aufgeloest = aufgeloest;
      return out;
    }`),
    [PFAD_FN, roh],
  );
}

export function leser(seite: () => Seite | null, fehler: () => string | null) {
  const s = (): Seite => {
    expect(fehler(), "Seite nicht gemountet").toBeNull();
    const seiteJetzt = seite();
    expect(seiteJetzt, "keine Seite").not.toBeNull();
    return seiteJetzt as Seite;
  };
  const pruefen = (selektor: string | null | undefined): string => {
    expect(selektor, "reales Element nicht gefunden").toBeTruthy();
    return selektor as string;
  };
  return {
    messen: (sel: string | null | undefined, eig: string) =>
      s().evaluate<string | null>(fn(LESEN), [pruefen(sel), eig]),
    text: (sel: string | null | undefined) => s().evaluate<string | null>(fn(TEXT), pruefen(sel)),
    sichtbar: (sel: string | null | undefined) =>
      s().evaluate<boolean | null>(fn(SICHTBAR), pruefen(sel)),
    pfadD: (sel: string | null | undefined) =>
      s().evaluate<string | null>(fn(PFAD_D), pruefen(sel)),
    attr: (sel: string | null | undefined, name: string) =>
      s().evaluate<string | null>(fn(ATTR), [pruefen(sel), name]),
    kanten: (sel: string | null | undefined) => s().evaluate<Kanten>(fn(KANTEN), pruefen(sel)),
    /** Ein Ausdruck in der Seite — fuer Verhalten, das kein Stilwert ist. */
    eval: <T>(quelle: string, arg?: unknown) => s().evaluate<T>(fn(quelle), arg),
    seite: s,
  };
}

/**
 * Die Summe der SICHTBAREN Textknoten der Flaeche ausserhalb der Ausnahmen (innerText des Rumpfs,
 * abzueglich innerText der ausgenommenen Elemente). Knopfbeschriftungen, Frage, Antwort und
 * Quellen-Chips sind keine Erklaerung — alles andere ist Text, der sich rechtfertigen muss.
 */
export const ERKLAERTEXT_FN = `(ausnahmen) => {
  const sichtbar = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
  const ausgenommen = [];
  for (const sel of ausnahmen) for (const el of document.querySelectorAll(sel)) ausgenommen.push(el);
  const laeuft = (el) => { let e = el; while (e) { if (ausgenommen.includes(e)) return true; e = e.parentElement; } return false; };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const teile = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = (n.textContent || '').replace(/\\s+/g, ' ').trim();
    if (!t) continue;
    const el = n.parentElement;
    if (!el || el.closest('script,style')) continue;
    if (!sichtbar(el) || laeuft(el)) continue;
    teile.push(t);
  }
  return { text: teile.join(' '), zeichen: teile.join(' ').length, teile };
}`;
