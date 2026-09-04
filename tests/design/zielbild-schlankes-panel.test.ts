// ================================================================================================
// JOB 3017 · D4 „SchlankesPanel“ — DAS RUHIGE GRUNDPANEL, IN CHROMIUM GEMESSEN.
// ================================================================================================
//
// PEDIS ZIELBILD (SchlankesPanel.dc.html): wer Klara in Word oeffnet und noch nichts gefragt hat,
// sieht ein Kopfband mit Marke, Sprachwahl, „Angemeldet als …“ und Zeitstempel; die Reiterleiste;
// EINE ruhige Fragen-Karte mit rundem Sende-Pfeil IN der Karte; EINEN Satz darunter; und eine
// Fusszeile mit Leitsatz und Schloss.
//
// WIE HIER GEMESSEN WIRD — nach dem Muster von tests/design/zielbild-validierung.test.ts:
//   · Das AUSGELIEFERTE `apps/web/public/word-addin/taskpane.html` (Markup, Stil UND Inline-Skript,
//     nicht ein Nachbau) wird in Chromium bei 360 px Breite geladen. Playwright bedient office.js
//     mit einer Office-Attrappe (dieselbe Form wie `buildFakeOffice` der Panel-Fixture) und die
//     `/api/*`-Aufrufe des Panels mit festen Antworten: `/api/auth/me` liefert einen Namen (bzw.
//     401 im zweiten Aufbau), `/api/reasoner/status` den ruhigen Hausstand, alles andere 404.
//     Das Panel LAEUFT: checkSession, renderStatics, Office-Erkennung, Statusabrufe.
//   · Gemessen wird per `getComputedStyle` an den REALEN Elementen. Der Beleg ist der SELEKTOR:
//     fuer jedes tragende Element wird ein CSS-Pfad erzeugt und rueckwaerts aufgeloest
//     (`document.querySelector(pfad) === el`). Sollwerte werden aus der `.dc.html` gelesen und ohne
//     Renderer kanonisiert (Hex → `rgb(r, g, b)`); je Wert EIN Vergleich mit dem Wertnamen im Titel.
//   · Jeder Wert, den dieser Auftrag bewusst NICHT angleicht, steht unten als OFFENER Wert mit
//     fachlicher Begruendung und gemessenem Istwert — nicht als stiller Treffer, nicht als Auslassung.
//     Das gilt ausdruecklich fuer den Vertrauenskopf (`#klara-trust-head`, `#klara-s4`: KW-S4-01 §2
//     verlangt ihn „immer ganz oben im Kopf“, gepinnt in tests/app/w1-klara-vertrauenskopf.test.ts)
//     und fuer den Fusszeilensatz (Z.48 „nichts verlaesst den Server“ ist eine bewusst entfernte
//     Betriebszusage, taskpane.html mega77 Block B).
//
// RED-FIRST (03.09.2026, Basis 343a5a8): vor dem Umbau rot — `#kw-stand-kopf` ×2, keine
// Anmeldezeile im Kopf, kein `#ask-karte`, Textknopf statt Pfeil, zwei Saetze unter dem Feld, keine
// Fusszeile. Nach dem Umbau gruen.
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const WURZEL = resolve(process.cwd());
const TASKPANE = resolve(WURZEL, "apps/web/public/word-addin/taskpane.html");
const ZIELBILD =
  "/Users/peterkohnert/Documents/Projekt_klarwerk/DESIGN_ZIELBILD_20260827/SchlankesPanel.dc.html";
const ORIGIN = "http://klara.test";
const SEITE_PFAD = "/word-addin/taskpane.html";
const OFFICE_JS = "https://appsforoffice.microsoft.com/lib/1/hosted/office.js";
const NAME = "Pedi";

const HTML = readFileSync(TASKPANE, "utf8");
const ziel = existsSync(ZIELBILD) ? readFileSync(ZIELBILD, "utf8") : "";
const ZIEL_ZEILEN = ziel.split("\n");

// ---- Das Woerterbuch des Panels, aus dem Quelltext gelesen (wie w1-klara-vertrauenskopf) ---------
const SPRACHEN = ["de", "en", "nl"] as const;
type Sprache = (typeof SPRACHEN)[number];
function woerterbuch(sprache: Sprache): string {
  const start = HTML.indexOf(`      ${sprache}: {`);
  const ende = HTML.indexOf("\n      },", start);
  if (start < 0 || ende < start) {
    throw new Error(`taskpane.html: Woerterbuch ${sprache} nicht auffindbar`);
  }
  return HTML.slice(start, ende);
}
function wort(sprache: Sprache, key: string, vars: Record<string, string> = {}): string {
  const m = new RegExp(`^\\s*${key}:\\s*"([^"]*)"`, "m").exec(woerterbuch(sprache));
  if (m === null) {
    throw new Error(`${sprache}.${key} fehlt im Woerterbuch`);
  }
  let raw = m[1] ?? "";
  for (const [k, v] of Object.entries(vars)) {
    raw = raw.replace(`{${k}}`, v);
  }
  return raw;
}

// ---- Das Zielbild: Sollwerte gelesen und kanonisiert ---------------------------------------------
function zielStil(anker: string): string | null {
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
/** Hex → `rgb(r, g, b)` (die Serialisierung von getComputedStyle), auch innerhalb laengerer Werte. */
function kanon(wert: string | null): string | null {
  if (wert === null) return null;
  return wert
    .trim()
    .replace(/#([0-9a-f]{6})\b/gi, (_, h: string) => {
      return `rgb(${Number.parseInt(h.slice(0, 2), 16)}, ${Number.parseInt(h.slice(2, 4), 16)}, ${Number.parseInt(h.slice(4, 6), 16)})`;
    })
    .replace(/\s+/g, " ");
}
/** Ein SVG-Attribut aus der Zielbild-Zeile, die den genannten Pfadanfang traegt. */
function zielSvgAttr(pfadAnfang: string, attr: string): string | null {
  const zeile = ZIEL_ZEILEN.find((z) => z.includes(`d="${pfadAnfang}`));
  if (zeile === undefined) return null;
  const svg = /<svg\b([^>]*)>/.exec(zeile)?.[1] ?? "";
  return new RegExp(`\\b${attr}="([^"]*)"`).exec(svg)?.[1] ?? null;
}
function zielText(anker: string): string | null {
  const zeile = ZIEL_ZEILEN.find((z) => z.includes(anker));
  if (zeile === undefined) return null;
  return zeile
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
/**
 * Ein Schatten-Rezept, renderer-unabhaengig: Chromium serialisiert `0 1px 2px rgba(…)` als
 * `rgba(…) 0px 1px 2px 0px`. Beide Formen werden auf {farbe, laengen} je Schatten gebracht.
 */
function schattenKanon(wert: string | null): string {
  if (wert === null) return "";
  const teile: string[] = [];
  let tiefe = 0;
  let akt = "";
  for (const c of wert) {
    if (c === "(") tiefe += 1;
    if (c === ")") tiefe -= 1;
    if (c === "," && tiefe === 0) {
      teile.push(akt);
      akt = "";
    } else {
      akt += c;
    }
  }
  teile.push(akt);
  return teile
    .map((t) => {
      const farbe = /rgba?\([^)]*\)/.exec(t)?.[0] ?? "";
      const laengen = (t.replace(/rgba?\([^)]*\)/, "").match(/-?[\d.]+(?:px)?/g) ?? []).map(
        (l) => `${Number.parseFloat(l)}`,
      );
      while (laengen.length < 4) laengen.push("0");
      return `${farbe.replace(/\s+/g, " ")} ${laengen.join(" ")}`;
    })
    .sort()
    .join(" | ");
}

const Z_ANMELDUNG = "font-size: 11px; color: #7E879A";
const Z_STAND = "font-size: 10px; color: #7E879A";
const Z_KARTE = "border-radius: 12px; box-shadow";
const Z_FELD = "padding: 14px 52px 40px 14px";
const Z_KNOPF = "width: 34px; height: 34px";
const Z_SATZ = "font-size: 12px; line-height: 1.5";
const Z_FUSS = "padding: 12px 16px; border-top";
const Z_FUSSSATZ = "font-size: 11px; color: #525B6B";
const PFEIL = "M12 19V5";
const SCHLOSS = "M8 10V7a4";

// ---- Chromium ------------------------------------------------------------------------------------
type BrowserFn = (arg: unknown) => unknown;
const fn = (quelle: string): BrowserFn =>
  new Function("arg", `return (${quelle})(arg);`) as BrowserFn;

interface Route {
  request(): { url(): string; method(): string };
  fulfill(r: { status: number; body: string; contentType?: string }): Promise<void>;
}
interface Seite {
  route(url: string, handler: (route: Route) => Promise<void>): Promise<void>;
  on(ereignis: string, handler: (e: { message?: string }) => void): void;
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  waitForFunction(fn: BrowserFn, arg?: unknown, opts?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(fn: BrowserFn, arg?: unknown): Promise<T>;
  close(): Promise<void>;
}
interface Browser {
  version(): string;
  newPage(opts: Record<string, unknown>): Promise<Seite>;
  close(): Promise<void>;
}

/** Die Office-Attrappe — dieselbe Form wie `buildFakeOffice` in tests/app/klara-panel-fixture.ts. */
const OFFICE_ATTRAPPE = `window.Office = {
  CoercionType: { Html: "html", Text: "text" },
  AsyncResultStatus: { Succeeded: "succeeded", Failed: "failed" },
  onReady: function (cb) { cb(); },
  context: { document: { getSelectedDataAsync: function (type, cb) { cb({ status: "succeeded", value: "" }); } } }
};`;

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
/** Die tragenden Elemente finden, ihre Pfade bilden und rueckwaerts aufloesen. */
const ELEMENTE = `(pfadFnSrc) => {
  const pfad = eval('(' + pfadFnSrc + ')');
  const such = {
    header: 'header',
    stand: 'header #kw-stand-kopf',
    anmeldung: 'header #kw-anmeldung',
    karte: '#ask-karte',
    feld: '#ask-karte #ask-input',
    knopf: '#ask-karte #ask-btn',
    pfeil: '#ask-btn svg',
    satz: '#section-ask > #ask-review-notice',
    fuss: '#kw-fuss',
    fusssatz: '#kw-fuss #ask-rule-note',
    schloss: '#kw-fuss svg',
    ka1: '#section-ask #ka1-block',
    trust: 'header #klara-trust-head',
    s4: 'header #klara-s4',
  };
  const out = { aufgeloest: true };
  for (const [name, sel] of Object.entries(such)) {
    const el = document.querySelector(sel);
    if (!el) { out[name] = null; continue; }
    const p = pfad(el);
    out[name] = p;
    if (document.querySelector(p) !== el) out.aufgeloest = false;
  }
  return out;
}`;
const LESEN =
  "([sel, eig]) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).getPropertyValue(eig) : null; }";
const ZAEHLEN = "(sel) => document.querySelectorAll(sel).length";
const TEXT =
  "(sel) => { const el = document.querySelector(sel); return el ? (el.textContent || '').replace(/\\s+/g, ' ').trim() : null; }";
const ATTR =
  "([sel, name]) => { const el = document.querySelector(sel); return el ? el.getAttribute(name) : null; }";
const RECT =
  "(sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; }";
const SICHTBAR = `(sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  let e = el;
  while (e && e !== document.body) {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    e = e.parentElement;
  }
  return true;
}`;
/**
 * Die Saetze „unter dem Feld“: sichtbare Elemente mit EIGENEM Text, die (a) in der Karte des
 * Eingabefelds NACH dem Feld stehen oder (b) direkte, kartenlose Kinder von #section-ask nach
 * dieser Karte sind. Vor dem Umbau: Pruefhinweis UND Regelsatz in der Karte (2); danach genau der
 * eine Satz unter der Karte.
 */
const SAETZE = `() => {
  const sichtbar = (el) => { let e = el; while (e && e !== document.body) { if (getComputedStyle(e).display === 'none') return false; e = e.parentElement; } return true; };
  const eigenerText = (el) => Array.from(el.childNodes).filter((k) => k.nodeType === 3).map((k) => k.textContent).join(' ').replace(/\\s+/g, ' ').trim();
  const feld = document.getElementById('ask-input');
  const karte = feld ? feld.closest('.card') : null;
  const section = document.getElementById('section-ask');
  if (!feld || !karte || !section) return null;
  const raus = [];
  for (const el of karte.querySelectorAll('*')) {
    if (feld.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING && sichtbar(el) && eigenerText(el) !== '') {
      raus.push((el.id ? '#' + el.id : el.tagName.toLowerCase()) + ' → „' + eigenerText(el) + '"');
    }
  }
  let nach = false;
  for (const kind of section.children) {
    if (kind === karte) { nach = true; continue; }
    if (!nach || kind.classList.contains('card')) continue;
    if (sichtbar(kind) && eigenerText(kind) !== '') {
      raus.push((kind.id ? '#' + kind.id : kind.tagName.toLowerCase()) + ' → „' + eigenerText(kind) + '"');
    }
  }
  return raus;
}`;
const REIHENFOLGE =
  "([a, b]) => { const x = document.querySelector(a); const y = document.querySelector(b); if (!x || !y) return null; return Boolean(x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING); }";
const KLICK = "(sel) => { document.querySelector(sel).click(); return true; }";

interface Selektoren extends Record<string, string | boolean | null> {
  aufgeloest: boolean;
}

let browser: Browser | null = null;
let seite: Seite | null = null;
let fehler: string | null = null;
let version = "";
let sel: Selektoren | null = null;
const seitenfehler: string[] = [];
/** Die Antwort von /api/auth/me — angemeldet fuer den Ruhezustand, 401 fuer den letzten Fall. */
let authAntwort: { status: number; body: unknown } = { status: 200, body: { name: NAME } };

/**
 * EINE Seite, EIN Aufbau: Chromium laeuft hier mit `--single-process`; eine zweite Seite bringt
 * den Prozess zu Fall. Der Nicht-angemeldet-Fall laedt deshalb dieselbe Seite neu (goto).
 */
async function seiteOeffnen(b: Browser) {
  const s = await b.newPage({ viewport: { width: 360, height: 720 } });
  s.on("pageerror", (e) => seitenfehler.push(String(e.message ?? e)));
  await s.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.url().startsWith(OFFICE_JS)) {
      await route.fulfill({
        status: 200,
        body: OFFICE_ATTRAPPE,
        contentType: "application/javascript",
      });
      return;
    }
    if (url.origin === ORIGIN && url.pathname === SEITE_PFAD && req.method() === "GET") {
      await route.fulfill({ status: 200, body: HTML, contentType: "text/html; charset=utf-8" });
      return;
    }
    if (req.method() === "HEAD") {
      await route.fulfill({ status: 200, body: "" });
      return;
    }
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, body: JSON.stringify(body), contentType: "application/json" });
    if (url.pathname === "/api/auth/me") {
      await json(authAntwort.status, authAntwort.body);
      return;
    }
    if (url.pathname === "/api/reasoner/status") {
      await json(200, { active: false, mode: "deterministic", reachable: "ok", tasks: {} });
      return;
    }
    await json(404, { error: "NOT_FOUND" });
  });
  await s.goto(`${ORIGIN}${SEITE_PFAD}`, { waitUntil: "load", timeout: 60_000 });
  return s;
}

describe("JOB 3017 · D4 · das ruhige Grundpanel — das ausgelieferte taskpane.html, in Chromium bei 360 px", () => {
  beforeAll(async () => {
    try {
      const require = createRequire(import.meta.url);
      const { chromium } = require("playwright") as {
        chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
      };
      browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
      });
      version = browser.version();
      seite = await seiteOeffnen(browser);
      // Der Ruhezustand ist erreicht, wenn die Anmeldung beantwortet ist (checkSession) — danach
      // haben renderStatics, Office-Erkennung und Statusabrufe ihren ersten Lauf hinter sich.
      await seite.waitForFunction(
        fn(
          `(t) => { const s = document.getElementById('session-status'); return !!s && (s.textContent || '').trim() === t; }`,
        ),
        wort("de", "sessionOk", { name: NAME }),
        { timeout: 30_000 },
      );
      sel = await seite.evaluate<Selektoren>(fn(ELEMENTE), PFAD_FN);
      console.info(
        `JOB 3017 D4 · Chromium ${version} · ${ORIGIN}${SEITE_PFAD} · Selektoren ${JSON.stringify(sel)} · Seitenfehler ${JSON.stringify(seitenfehler)}`,
      );
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 3).join(" | ");
    }
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
  }, 60_000);

  async function messen(selektor: unknown, eigenschaft: string): Promise<string | null> {
    expect(fehler, "Seite nicht geladen").toBeNull();
    expect(selektor, `reales Element nicht gefunden (${eigenschaft})`).toBeTruthy();
    return (seite as Seite).evaluate<string | null>(fn(LESEN), [selektor, eigenschaft]);
  }
  async function lies<T>(quelle: string, arg?: unknown): Promise<T> {
    expect(fehler, "Seite nicht geladen").toBeNull();
    return (seite as Seite).evaluate<T>(fn(quelle), arg);
  }

  it("S · die Seite steht: Zielbild lesbar, Panel gelaufen, Selektoren rueckwaerts aufloesbar", () => {
    expect(fehler).toBeNull();
    expect(existsSync(ZIELBILD), `Zielbild nicht lesbar: ${ZIELBILD}`).toBe(true);
    expect(sel?.aufgeloest).toBe(true);
    expect(sel?.header).toMatch(/^body > /);
  });

  // ---- Lieferung 1: das doppelte Kopf-Element ---------------------------------------------------
  it("L1 · #kw-stand-kopf kommt genau einmal vor — im Markup und im laufenden Dokument", async () => {
    expect((HTML.match(/id="kw-stand-kopf"/g) ?? []).length).toBe(1);
    expect(await lies<number>(ZAEHLEN, "#kw-stand-kopf")).toBe(1);
    // Der EINE Zeitstempel traegt den Stand (Build-Platzhalter → „dev“) und ist sichtbar.
    expect(await lies<string>(TEXT, "#kw-stand-kopf")).toBe("dev");
    expect(await lies<boolean>(SICHTBAR, "#kw-stand-kopf")).toBe(true);
  });
  it("L1 · Zeitstempel: font-size 10px (Z.28) — am realen #kw-stand-kopf", async () => {
    expect(await messen(sel?.stand, "font-size")).toBe(
      kanon(zielProp(zielStil(Z_STAND), "font-size")),
    );
  });
  it("L1 · Zeitstempel: Kopfband-Mutedfarbe #7E879A (Z.28) — color am realen #kw-stand-kopf", async () => {
    expect(await messen(sel?.stand, "color")).toBe(kanon(zielProp(zielStil(Z_STAND), "color")));
  });

  // ---- Lieferung 2: „Angemeldet als …“ im Kopfband -----------------------------------------------
  it("L2 · Kopfband zeigt die Anmeldezeile: der Name aus /api/auth/me, im Wortlaut von sessionOk", async () => {
    expect(await lies<boolean>(SICHTBAR, "header #kw-anmeldung")).toBe(true);
    expect(await lies<string>(TEXT, "header #kw-anmeldung")).toBe(
      wort("de", "sessionOk", { name: NAME }),
    );
  });
  it("L2 · Anmeldezeile: font-size 11px (Z.27) — am realen #kw-anmeldung", async () => {
    expect(await messen(sel?.anmeldung, "font-size")).toBe(
      kanon(zielProp(zielStil(Z_ANMELDUNG), "font-size")),
    );
  });
  it("L2 · Anmeldezeile: Kopfband-Mutedfarbe #7E879A (Z.27) — color am realen #kw-anmeldung", async () => {
    expect(await messen(sel?.anmeldung, "color")).toBe(
      kanon(zielProp(zielStil(Z_ANMELDUNG), "color")),
    );
  });
  it("L2 · Anmeldezeile links, Zeitstempel rechts, in DERSELBEN Zeile (Z.26)", async () => {
    type R = { left: number; right: number; top: number; bottom: number };
    const a = await lies<R | null>(RECT, "header #kw-anmeldung");
    const z = await lies<R | null>(RECT, "header #kw-stand-kopf");
    const h = await lies<R | null>(RECT, "header");
    expect(a).not.toBeNull();
    expect(z).not.toBeNull();
    expect(h).not.toBeNull();
    const [aa, zz, hh] = [a as R, z as R, h as R];
    // dieselbe Zeile: die Zeitstempel-Box liegt vertikal innerhalb der Anmeldezeilen-Box
    expect(zz.top).toBeGreaterThanOrEqual(aa.top - 1);
    expect(zz.bottom).toBeLessThanOrEqual(aa.bottom + 1);
    // links / rechts
    expect(aa.left).toBeLessThan(zz.left);
    expect(hh.right - zz.right).toBeLessThan(20);
    expect(aa.left - hh.left).toBeLessThan(20);
  });
  it("L2/L3 · drei Sprachen: Anmeldezeile und aria-label des Sende-Knopfs folgen dem Sprachwechsel", async () => {
    try {
      for (const sprache of ["en", "nl", "de"] as const) {
        await lies<boolean>(KLICK, `#lang-${sprache}`);
        await (seite as Seite).waitForFunction(
          fn(
            `(t) => { const s = document.getElementById('kw-anmeldung'); return !!s && (s.textContent || '').trim() === t; }`,
          ),
          wort(sprache, "sessionOk", { name: NAME }),
          { timeout: 10_000 },
        );
        expect(await lies<string | null>(ATTR, ["#ask-btn", "aria-label"])).toBe(
          wort(sprache, "askCta"),
        );
        expect(await lies<string | null>(ATTR, ["#ask-input", "aria-label"])).toBe(
          wort(sprache, "askTitle"),
        );
      }
    } finally {
      // Die Folgefaelle messen DE — auch wenn dieser Fall unterwegs rot wird, bleibt die Seite
      // nicht auf EN/NL stehen (sonst faellt eine ganze Reihe aus einem einzigen Grund).
      await lies<boolean>(KLICK, "#lang-de");
      await (seite as Seite).waitForFunction(
        fn(`(t) => (document.getElementById('session-status').textContent || '').trim() === t`),
        wort("de", "sessionOk", { name: NAME }),
        { timeout: 10_000 },
      );
    }
  }, 40_000);

  // ---- Lieferung 3: die Fragen-Karte und der runde Sende-Pfeil -----------------------------------
  it("L3 · Fragen-Karte: border-radius 12px (Z.38) — am realen #ask-karte", async () => {
    expect(await messen(sel?.karte, "border-radius")).toBe(
      kanon(zielProp(zielStil(Z_KARTE), "border-radius")),
    );
  });
  it("L3 · Fragen-Karte: background #FFFFFF (Z.38)", async () => {
    expect(await messen(sel?.karte, "background-color")).toBe(
      kanon(zielProp(zielStil(Z_KARTE), "background")),
    );
  });
  it("L3 · Fragen-Karte: border 1px solid #E9E5DE (Z.38)", async () => {
    expect(await messen(sel?.karte, "border")).toBe(kanon(zielProp(zielStil(Z_KARTE), "border")));
  });
  it("L3 · Fragen-Karte: box-shadow 0 1px 2px rgba(14, 22, 38, 0.05), 0 8px 24px -12px rgba(14, 22, 38, 0.12) (Z.38)", async () => {
    expect(schattenKanon(await messen(sel?.karte, "box-shadow"))).toBe(
      schattenKanon(zielProp(zielStil(Z_KARTE), "box-shadow")),
    );
  });
  it("L3 · Fragen-Karte: position relative (Z.38)", async () => {
    expect(await messen(sel?.karte, "position")).toBe(zielProp(zielStil(Z_KARTE), "position"));
  });
  it("L3 · Feld: padding 14px 52px 40px 14px (Z.39) — am realen #ask-input", async () => {
    expect(await messen(sel?.feld, "padding")).toBe(zielProp(zielStil(Z_FELD), "padding"));
  });
  it("L3 · Feld: font-size 15px (Z.39)", async () => {
    expect(await messen(sel?.feld, "font-size")).toBe(zielProp(zielStil(Z_FELD), "font-size"));
  });
  it("L3 · Feld: line-height 1.45 (Z.39) — als Vielfaches des Schriftgrads gemessen", async () => {
    const lh = Number.parseFloat((await messen(sel?.feld, "line-height")) ?? "");
    const fs = Number.parseFloat((await messen(sel?.feld, "font-size")) ?? "");
    expect(lh / fs).toBeCloseTo(
      Number.parseFloat(zielProp(zielStil(Z_FELD), "line-height") ?? ""),
      3,
    );
  });
  it("L3 · Feld: min-height 96px (Z.39)", async () => {
    expect(await messen(sel?.feld, "min-height")).toBe(zielProp(zielStil(Z_FELD), "min-height"));
  });
  it("L3 · Sende-Knopf: position absolute (Z.40) — am realen #ask-btn IN der Karte", async () => {
    expect(await messen(sel?.knopf, "position")).toBe(zielProp(zielStil(Z_KNOPF), "position"));
  });
  it("L3 · Sende-Knopf: right 10px (Z.40)", async () => {
    expect(await messen(sel?.knopf, "right")).toBe(zielProp(zielStil(Z_KNOPF), "right"));
  });
  it("L3 · Sende-Knopf: bottom 10px (Z.40)", async () => {
    expect(await messen(sel?.knopf, "bottom")).toBe(zielProp(zielStil(Z_KNOPF), "bottom"));
  });
  it("L3 · Sende-Knopf: Breite 34px (Z.40)", async () => {
    expect(await messen(sel?.knopf, "width")).toBe(zielProp(zielStil(Z_KNOPF), "width"));
  });
  it("L3 · Sende-Knopf: Hoehe 34px (Z.40)", async () => {
    expect(await messen(sel?.knopf, "height")).toBe(zielProp(zielStil(Z_KNOPF), "height"));
  });
  it("L3 · Sende-Knopf: Radius 50% (Z.40)", async () => {
    expect(await messen(sel?.knopf, "border-radius")).toBe(
      zielProp(zielStil(Z_KNOPF), "border-radius"),
    );
  });
  it("L3 · Sende-Knopf: Farbe #C2500A (Z.40)", async () => {
    expect(await messen(sel?.knopf, "background-color")).toBe(
      kanon(zielProp(zielStil(Z_KNOPF), "background")),
    );
  });
  it("L3 · Sende-Knopf: Pfeil-SVG 18×18 (Z.41) — Breite und Hoehe am realen svg", async () => {
    expect(await messen(sel?.pfeil, "width")).toBe(`${zielSvgAttr(PFEIL, "width")}px`);
    expect(await messen(sel?.pfeil, "height")).toBe(`${zielSvgAttr(PFEIL, "height")}px`);
  });
  it("L3 · Sende-Knopf: Pfeil stroke #FFFFFF (Z.41)", async () => {
    expect(await messen(sel?.pfeil, "stroke")).toBe(kanon(zielSvgAttr(PFEIL, "stroke")));
  });
  it("L3 · Sende-Knopf: Pfeil stroke-width 2.2 (Z.41)", async () => {
    expect(Number.parseFloat((await messen(sel?.pfeil, "stroke-width")) ?? "")).toBeCloseTo(
      Number.parseFloat(zielSvgAttr(PFEIL, "stroke-width") ?? ""),
      3,
    );
  });
  it("L3 · Sende-Knopf: die beiden Pfeil-Pfade des Zielbilds (Z.41), kein Wortlaut, aria-label = askCta, frei nach Anmeldung", async () => {
    expect(await lies<number>(ZAEHLEN, `#ask-btn svg path[d^="${PFEIL}"]`)).toBe(1);
    expect(await lies<number>(ZAEHLEN, '#ask-btn svg path[d^="M5 12l7-7"]')).toBe(1);
    expect(await lies<string>(TEXT, "#ask-btn")).toBe("");
    expect(await lies<string | null>(ATTR, ["#ask-btn", "aria-label"])).toBe(wort("de", "askCta"));
    expect(await lies<string | null>(ATTR, ["#ask-btn", "disabled"])).toBeNull();
    // Der bisherige vollbreite Textknopf ist ERSETZT: genau ein #ask-btn, kein data-t mehr daran.
    expect(await lies<number>(ZAEHLEN, "#ask-btn")).toBe(1);
    expect(await lies<string | null>(ATTR, ["#ask-btn", "data-t"])).toBeNull();
  });

  // ---- Lieferung 4: genau ein Satz unter der Karte -----------------------------------------------
  it("L4 · genau ein dauerhaft sichtbarer Satz unter der Karte — der fachliche Pruefhinweis #ask-review-notice", async () => {
    const saetze = await lies<string[] | null>(SAETZE);
    console.info(`JOB 3017 D4 · L4 · Saetze unter dem Feld: ${JSON.stringify(saetze)}`);
    expect(saetze).not.toBeNull();
    expect(saetze).toHaveLength(1);
    expect(saetze?.[0]).toMatch(/^#ask-review-notice → /);
    // Zustandsgebunden, nicht geloescht: die Herkunftszeile ist leer und verborgen, die
    // KI-Kennzeichnung haengt weiter am Signal (verborgen), der Regelsatz steht in der Fusszeile.
    expect(await lies<boolean>(SICHTBAR, "#ask-source-note")).toBe(false);
    expect(await lies<string>(TEXT, "#ask-source-note")).toBe("");
    expect(await lies<boolean>(SICHTBAR, "#ask-ai-notice")).toBe(false);
    expect(await lies<boolean>(SICHTBAR, "#kw-fuss #ask-rule-note")).toBe(true);
  });
  it("L4 · Satz: font-size 12px (Z.44) — am realen #ask-review-notice", async () => {
    expect(await messen(sel?.satz, "font-size")).toBe(zielProp(zielStil(Z_SATZ), "font-size"));
  });
  it("L4 · Satz: line-height 1.5 (Z.44)", async () => {
    const lh = Number.parseFloat((await messen(sel?.satz, "line-height")) ?? "");
    const fs = Number.parseFloat((await messen(sel?.satz, "font-size")) ?? "");
    expect(lh / fs).toBeCloseTo(
      Number.parseFloat(zielProp(zielStil(Z_SATZ), "line-height") ?? ""),
      3,
    );
  });
  it("L4 · Satz: Farbe #525B6B (Z.44)", async () => {
    expect(await messen(sel?.satz, "color")).toBe(kanon(zielProp(zielStil(Z_SATZ), "color")));
  });
  it("L4 · Satz: padding 0 2px (Z.44)", async () => {
    expect(await messen(sel?.satz, "padding")).toBe("0px 2px");
  });
  it("L4 · Satz: der Wortlaut traegt beide Auskuenfte (woertlich aus validiertem Wissen mit Quellen; die Markierung wird gefragt) und den Pruefauftrag — drei Sprachen", async () => {
    const muster: Record<Sprache, RegExp[]> = {
      de: [/wörtlich/, /Quellen/, /Markier/, /prüfen/],
      en: [/word for word/, /sources/, /select/i, /review/],
      nl: [/woordelijk/, /bronnen/, /selec/i, /Controleer/],
    };
    for (const sprache of SPRACHEN) {
      const satz = wort(sprache, "askReviewNotice");
      for (const m of muster[sprache]) {
        expect(satz, `${sprache}.askReviewNotice`).toMatch(m);
      }
    }
    expect(await lies<string>(TEXT, "#ask-review-notice")).toBe(wort("de", "askReviewNotice"));
  });

  // ---- Lieferung 5: KA1 bleibt und rutscht unter die Karte ---------------------------------------
  it("L5 · #ka1-block bleibt erhalten, sichtbar, in #section-ask — und steht NACH der Fragen-Karte", async () => {
    expect(sel?.ka1).toBeTruthy();
    expect(await lies<boolean>(SICHTBAR, "#ka1-block")).toBe(true);
    expect(await lies<boolean | null>(REIHENFOLGE, ["#ask-karte", "#ka1-block"])).toBe(true);
    // KA1 fuehrt ein eigenes Woerterbuch (KW-KA1-TERMS, Skriptteil) — der erste `ka1Title` ist DE.
    const ka1Titel = /ka1Title:\s*"([^"]*)"/.exec(HTML)?.[1] ?? "";
    expect(ka1Titel.length).toBeGreaterThan(0);
    expect(await lies<string>(TEXT, "#ka1-block [data-t=ka1Title]")).toBe(ka1Titel);
  });

  // ---- Lieferung 6: die Fusszeile ----------------------------------------------------------------
  it("L6 · Fusszeile: padding 12px 16px (Z.47) — am realen #kw-fuss", async () => {
    expect(await messen(sel?.fuss, "padding")).toBe(zielProp(zielStil(Z_FUSS), "padding"));
  });
  it("L6 · Fusszeile: border-top 1px solid #E9E5DE (Z.47)", async () => {
    expect(await messen(sel?.fuss, "border-top")).toBe(
      kanon(zielProp(zielStil(Z_FUSS), "border-top")),
    );
  });
  it("L6 · Fusszeile: display flex, justify-content space-between, align-items center (Z.47)", async () => {
    expect(await messen(sel?.fuss, "display")).toBe(zielProp(zielStil(Z_FUSS), "display"));
    expect(await messen(sel?.fuss, "justify-content")).toBe(
      zielProp(zielStil(Z_FUSS), "justify-content"),
    );
    expect(await messen(sel?.fuss, "align-items")).toBe(zielProp(zielStil(Z_FUSS), "align-items"));
  });
  it("L6 · Fusszeilensatz: font-size 11px (Z.48) — am realen #ask-rule-note in der Fusszeile", async () => {
    expect(await messen(sel?.fusssatz, "font-size")).toBe(
      zielProp(zielStil(Z_FUSSSATZ), "font-size"),
    );
  });
  it("L6 · Fusszeilensatz: Farbe #525B6B (Z.48)", async () => {
    expect(await messen(sel?.fusssatz, "color")).toBe(
      kanon(zielProp(zielStil(Z_FUSSSATZ), "color")),
    );
  });
  it("L6 · Schloss-SVG 14×14 (Z.49)", async () => {
    expect(await messen(sel?.schloss, "width")).toBe(`${zielSvgAttr(SCHLOSS, "width")}px`);
    expect(await messen(sel?.schloss, "height")).toBe(`${zielSvgAttr(SCHLOSS, "height")}px`);
  });
  it("L6 · Schloss: stroke #116B3C (Z.49)", async () => {
    expect(await messen(sel?.schloss, "stroke")).toBe(kanon(zielSvgAttr(SCHLOSS, "stroke")));
  });
  it("L6 · Schloss: stroke-width 2 (Z.49)", async () => {
    expect(Number.parseFloat((await messen(sel?.schloss, "stroke-width")) ?? "")).toBeCloseTo(
      Number.parseFloat(zielSvgAttr(SCHLOSS, "stroke-width") ?? ""),
      3,
    );
  });
  it("L6 · Schloss: Koerper (rect 4/10/16/10 rx 2) und Buegel (Z.49), rechts vom Satz", async () => {
    expect(await lies<number>(ZAEHLEN, `#kw-fuss svg path[d^="${SCHLOSS}"]`)).toBe(1);
    const rect = await lies<string | null>(
      "() => { const r = document.querySelector('#kw-fuss svg rect'); return r ? ['x','y','width','height','rx'].map((k) => k + '=' + r.getAttribute(k)).join(' ') : null; }",
    );
    expect(rect).toBe("x=4 y=10 width=16 height=10 rx=2");
    type R = { left: number; right: number };
    const s = (await lies<R | null>(RECT, "#kw-fuss #ask-rule-note")) as R;
    const l = (await lies<R | null>(RECT, "#kw-fuss svg")) as R;
    expect(l.left).toBeGreaterThanOrEqual(s.right);
  });
  it("L6 · Fusszeilensatz: der Leitsatz aus dem bestehenden Schluessel askRuleNote — drei Sprachen, Beleg-Halbsaetze bleiben, keine Betriebszusage", async () => {
    const leitsatz: Record<Sprache, RegExp> = {
      de: /Keine KI-Antwort ohne Beleg · Vertrauliches bleibt vertraulich/,
      en: /No AI answer without evidence · Confidential stays confidential/,
      nl: /Geen AI-antwoord zonder bewijs · Vertrouwelijk blijft vertrouwelijk/,
    };
    for (const sprache of SPRACHEN) {
      const satz = wort(sprache, "askRuleNote");
      expect(satz, `${sprache}.askRuleNote`).toMatch(leitsatz[sprache]);
      expect(satz).not.toMatch(/verlässt den Server|leaves the server|verlaat de server/i);
    }
    expect(await lies<string>(TEXT, "#kw-fuss #ask-rule-note")).toBe(wort("de", "askRuleNote"));
    // KONFLIKTRUNDE 1 (JOB 3017, 04.09.2026): dieser Fall nahm an, die Absage-Karte traege noch
    // ihre Zweitkopie des Regelsatzes (der Stand vor JOB 3046). JOB 3046 D2 hatte diese Zweitkopie
    // beim Rebase bereits entfernt und das mit tests/app/mega75-klara-ki-status.test.ts gepinnt
    // ("die ZWEITKOPIE der Regel in der Absage ... ist ENTFERNT, nicht daneben belassen"); die
    // Regel steht seither an GENAU EINER Stelle, jetzt in der Fusszeile #kw-fuss.
    expect(await lies<number>(ZAEHLEN, "#ask-rule-note")).toBe(1);
    expect(await lies<number>(ZAEHLEN, '[data-t="askRuleNote"]')).toBe(1);
    expect(await lies<number>(ZAEHLEN, '#ask-gap-block [data-t="askRuleNote"]')).toBe(0);
  });

  // ---- OFFENE WERTE: gemessen, begruendet, nicht behauptet ---------------------------------------
  const OFFEN: [string, () => Promise<string | null>, string, string][] = [
    [
      "Vertrauenskopf #klara-trust-head im Kopfband (Zielbild: keiner)",
      () => messen(sel?.trust, "display"),
      "kein Element",
      "KW-S4-01 §2 verlangt ihn „immer ganz oben im Kopf“; Ort gepinnt in tests/app/w1-klara-vertrauenskopf.test.ts — bleibt, das Zielbild kennt diese Zusage nicht",
    ],
    [
      "Sitzungsblock #klara-s4 im Kopfband (Zielbild: keiner)",
      () => messen(sel?.s4, "display"),
      "kein Element",
      "AUFTRAG-W1-KLARA-KOPF-CONSENT-06: Sitzungs-/Zustimmungsstand gehoert in denselben Kopf; bleibt",
    ],
    [
      "Fusszeilensatz Wortlaut Z.48",
      () => lies<string | null>(TEXT, "#kw-fuss #ask-rule-note"),
      zielText("nichts verlässt den Server") ?? "",
      "„nichts verlaesst den Server“ ist eine BETRIEBSZUSAGE, die dieser Code nicht erzwingt (taskpane.html mega77 Block B, bewusst entfernt); der Satz traegt stattdessen den Leitsatz aus askRuleNote",
    ],
    [
      "Satz unter der Karte Wortlaut Z.44",
      () => lies<string | null>(TEXT, "#ask-review-notice"),
      zielText("Antworten kommen wörtlich") ?? "",
      "sinngleich zusammengefuehrt aus askHint und askReviewNotice: „validiertes KLARWERK-Wissen“ statt „freigegebenes Firmenwissen“ (der Objektstatus heisst validiert) plus der dauerhafte Pruefauftrag (mega81 Block A)",
    ],
    [
      "Platzhalter des Felds Z.39",
      () => lies<string | null>(ATTR, ["#ask-input", "placeholder"]),
      zielText("Frage zu Ihrem Unternehmen") ?? "",
      "der Platzhalter sagt ehrlich, WANN getippt wird (askInputPlaceholder, Du-Form des Panels); Wortlaut nicht Teil dieses Auftrags",
    ],
    [
      "Inhalt Innenabstand Z.37 (28px 16px 16px) / Zeilenabstand 14px",
      () => messen(sel?.header !== null ? "#section-ask" : null, "padding"),
      "28px 16px 16px",
      "Z.37 steht nicht in den Pflichtwerten (§5); der Koerper polstert 14px, die Karte traegt margin-top 12px — Abstand des Satzes zur Karte 14px wie Z.37 gap",
    ],
    [
      "Kopfband Innenabstand Z.17 (12px 16px 10px)",
      () => messen(sel?.header, "padding"),
      "12px 16px 10px",
      "Kopfband-Geometrie nicht Teil dieses Auftrags (nur Z.27/Z.28); Produkt 12px 14px seit mega43",
    ],
    [
      "Marke Schriftgrad Z.19 (16px)",
      () => messen(sel?.header !== null ? ".brand" : null, "font-size"),
      "16px",
      "Marke nicht Teil dieses Auftrags; Produkt 18px/700 (mega43)",
    ],
    [
      "Sprachchip Radius Z.21 (6px)",
      () => messen(sel?.header !== null ? "#lang-de" : null, "border-radius"),
      "6px",
      "Sprachwahl nicht Teil dieses Auftrags; Produkt Pille 999px, aktiv auf --brand-deep",
    ],
    [
      "Sitzungskarte #session-card zwischen Kopfband und Reitern (Zielbild: keine)",
      () => lies<string | null>(SICHTBAR, "#session-card"),
      "kein Element",
      "der Anmeldeweg des Panels (#login-btn, Warten abbrechen, Kontext-Hinweis) wohnt dort; ohne sie gaebe es im Fenster keinen Weg zur Anmeldung (WP-KLARA-1c)",
    ],
    [
      "Flaechen unter der Fragen-Flaeche (#ka1-block, #ka6-block, Hilfe-Karte, #kw-stand, #kw-fassung)",
      () =>
        lies<string | null>(
          "() => ['#ka1-block', '#ka6-block', '[data-t=helpTitle]', '#kw-stand', '#kw-fassung'].map((s) => s + ':' + (document.querySelector(s) ? 'da' : 'fehlt')).join(' ')",
        ),
      "keine",
      "gebaute Funktionen (KA1, KA6, Hilfe, Auslieferungsstand, Fassungsabgleich) bleiben; das Zielbild zeigt den Ruhezustand ohne sie",
    ],
  ];
  for (const [name, lesen, soll, grund] of OFFEN) {
    it(`OFFEN · ${name} — gemessen, begruendet`, async () => {
      const ist = await lesen();
      console.info(
        `JOB 3017 D4 · OFFEN · ${name}: Zielbild „${soll}“ · Panel „${String(ist)}“ · ${String(ist) === soll ? "GLEICH" : "abweichend"} · ${grund}`,
      );
      expect(ist, "reales Element liefert keinen Wert").not.toBeNull();
    });
  }

  it("P · Protokoll: Seitenfehler des laufenden Panels (Chromium pageerror)", () => {
    expect(fehler).toBeNull();
    console.info(
      `JOB 3017 D4 · Seitenfehler: ${seitenfehler.length === 0 ? "keine" : seitenfehler.join(" | ")}`,
    );
    expect(seitenfehler).toEqual([]);
  });

  // ZULETZT, weil es die Seite neu laedt: nicht angemeldet.
  it("L2 · nicht angemeldet: die Anmeldezeile traegt den ehrlichen Anmelde-Hinweis (sessionOff), keinen Platzhalter", async () => {
    expect(fehler).toBeNull();
    authAntwort = { status: 401, body: { error: "UNAUTHENTICATED" } };
    const s = seite as Seite;
    await s.goto(`${ORIGIN}${SEITE_PFAD}`, { waitUntil: "load", timeout: 60_000 });
    await s.waitForFunction(
      fn(
        `(t) => { const s = document.getElementById('session-status'); return !!s && (s.textContent || '').trim() === t; }`,
      ),
      wort("de", "sessionOff"),
      { timeout: 30_000 },
    );
    expect(await lies<string>(TEXT, "header #kw-anmeldung")).toBe(wort("de", "sessionOff"));
    expect(await lies<boolean>(SICHTBAR, "#login-block")).toBe(true);
    // Der Sende-Pfeil bleibt gesperrt; der Grund steht nicht am Knopf, sondern in der Sitzungskarte.
    expect(await lies<string | null>(ATTR, ["#ask-btn", "disabled"])).not.toBeNull();
    expect(await lies<string | null>(ATTR, ["#ask-btn", "title"])).toBeFalsy();
  });

  // RUNDE 2 (BEN, Korrekturpflicht 1/2): HTTP 200, aber KEIN nichtleerer Name — der Auftrag
  // verlangt dann den bestehenden ehrlichen Anmelde-Hinweis, keinen Platzhalter („?") und nicht die
  // E-Mail als Ersatznamen. Drei Koerper, drei Sprachen, je am neu geladenen Panel.
  const OHNE_NAMEN: [string, Record<string, unknown>][] = [
    ["ohne name", { id: "u-ohne-name", role: "viewer" }],
    ["name leer", { id: "u-ohne-name", role: "viewer", name: "" }],
    ["nur email", { id: "u-ohne-name", role: "viewer", email: "ohne-name@klara.test" }],
  ];
  for (const [fall, koerper] of OHNE_NAMEN) {
    it(`L2 · HTTP 200 ${fall}: kein „?", keine E-Mail — der bestehende Anmelde-Hinweis in DE/EN/NL, Anmeldeweg sichtbar`, async () => {
      expect(fehler).toBeNull();
      authAntwort = { status: 200, body: koerper };
      const s = seite as Seite;
      await s.goto(`${ORIGIN}${SEITE_PFAD}`, { waitUntil: "load", timeout: 60_000 });
      for (const sprache of ["de", "en", "nl"] as const) {
        await lies<boolean>(KLICK, `#lang-${sprache}`);
        // Warten, bis die Sitzungsauskunft in dieser Sprache beantwortet ist (nicht mehr „prueft"),
        // dann WOERTLICH vergleichen — so nennt ein Rot den tatsaechlichen Text, nicht einen Timeout.
        await s.waitForFunction(
          fn(
            `(t) => { const s = document.getElementById('session-status'); const x = (s && s.textContent || '').trim(); return x !== '' && x !== t; }`,
          ),
          wort(sprache, "sessionChecking"),
          { timeout: 10_000 },
        );
        const zeile = (await lies<string>(TEXT, "header #kw-anmeldung")) ?? "";
        expect(zeile).toBe(wort(sprache, "sessionOff"));
        expect(zeile).not.toContain("?");
        expect(zeile).not.toContain("ohne-name@klara.test");
        expect(await lies<string>(TEXT, "#session-status")).toBe(wort(sprache, "sessionOff"));
        expect(await lies<boolean>(SICHTBAR, "#login-block")).toBe(true);
        expect(await lies<string | null>(ATTR, ["#ask-btn", "disabled"])).not.toBeNull();
      }
    }, 40_000);
  }
});

describe.runIf(!existsSync(ZIELBILD))("JOB 3017 · Zielbild-Abgleich uebersprungen", () => {
  it("meldet den fehlenden Kontrollordner statt eine Pruefung vorzutaeuschen", () => {
    expect(existsSync(ZIELBILD), `Zielbild nicht lesbar: ${ZIELBILD}`).toBe(false);
  });
});
