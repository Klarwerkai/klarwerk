// ================================================================================================
// JOB 3057 · K2 — DIE GEMEINSAME BUEHNE der Chromium-Messungen der Erfassen-Flaeche.
// ================================================================================================
//
// Kein Test, ein Helfer. Er laedt das AUSGELIEFERTE `apps/web/public/word-addin/taskpane.html`
// (Markup, Stil und Inline-Skript — kein Nachbau) in Chromium bei 360 px Breite, bedient office.js
// mit einer Attrappe (Markierung von aussen setzbar, `DocumentSelectionChanged` ausloesbar,
// `Word.run` fuer den Dokument-Weg) und die `/api/*`-Aufrufe des Panels mit festen Antworten:
// `/api/auth/me` liefert einen Namen, `/api/reasoner/status` den ruhigen Hausstand, `POST
// /api/drafts` das, was der jeweilige Fall verlangt (201, 413, Netzabbruch …). Das Panel LAEUFT:
// checkSession, renderStatics, Office-Erkennung, Markierungskarte, Sendeweg.
//
// Bauform wie tests/design/zielbild-k1-ruhe.test.ts (JOB 3056): EINE Seite, EIN Aufbau —
// Chromium laeuft hier mit `--single-process`, eine zweite Seite bringt den Prozess zu Fall. Ein
// anderer Ausgangszustand (leere Markierung, kein Office, verfaelschtes Markup) ist deshalb ein
// `oeffnen()` derselben Seite mit anderem Plan.
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

export const WURZEL = resolve(process.cwd());
export const TASKPANE = resolve(WURZEL, "apps/web/public/word-addin/taskpane.html");
/** Das Zielbild vom 04.09.2026 (Pedi: „Gut."), im Steuerungsordner. */
export const ZIELBILD = "/Users/peterkohnert/klarwerk_steuerung/design/klara/Erfassen.dc.html";
export const ORIGIN = "http://klara.test";
export const SEITE_PFAD = "/word-addin/taskpane.html";
const OFFICE_JS = "https://appsforoffice.microsoft.com/lib/1/hosted/office.js";
export const NAME = "Pedi";

export const HTML = readFileSync(TASKPANE, "utf8");
export const zielbildDa = existsSync(ZIELBILD);
export const ZIEL = zielbildDa ? readFileSync(ZIELBILD, "utf8") : "";
const ZIEL_ZEILEN = ZIEL.split("\n");

// ---- Das Woerterbuch des Panels, aus dem Quelltext gelesen (wie w1-klara-vertrauenskopf) ---------
export const SPRACHEN = ["de", "en", "nl"] as const;
export type Sprache = (typeof SPRACHEN)[number];
function woerterbuch(sprache: Sprache): string {
  const start = HTML.indexOf(`      ${sprache}: {`);
  const ende = HTML.indexOf("\n      },", start);
  if (start < 0 || ende < start) {
    throw new Error(`taskpane.html: Woerterbuch ${sprache} nicht auffindbar`);
  }
  return HTML.slice(start, ende);
}
export function wort(sprache: Sprache, key: string, vars: Record<string, string> = {}): string {
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

// ---- Das Zielbild: Sollwerte je ZEILE gelesen und kanonisiert -----------------------------------
/** Der `style`-Wert der Zielbildzeile n (1-basiert) — jeder Sollwert nennt seine Zeile. */
export function zielStilZeile(n: number): string | null {
  const zeile = ZIEL_ZEILEN[n - 1] ?? "";
  return /style="([^"]*)"/.exec(zeile)?.[1] ?? null;
}
export function zielProp(stil: string | null, eigenschaft: string): string | null {
  if (stil === null) return null;
  return new RegExp(`(?:^|[;\\s])${eigenschaft}\\s*:\\s*([^;]+)`).exec(stil)?.[1]?.trim() ?? null;
}
/** Der sichtbare Text der Zielbildzeile n, ohne Tags. */
export function zielTextZeile(n: number): string {
  return (ZIEL_ZEILEN[n - 1] ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
/** Hex → `rgb(r, g, b)` (die Serialisierung von getComputedStyle), auch innerhalb laengerer Werte. */
export function kanon(wert: string | null): string | null {
  if (wert === null) return null;
  return wert
    .trim()
    .replace(/#([0-9a-f]{6})\b/gi, (_, h: string) => {
      return `rgb(${Number.parseInt(h.slice(0, 2), 16)}, ${Number.parseInt(h.slice(2, 4), 16)}, ${Number.parseInt(h.slice(4, 6), 16)})`;
    })
    .replace(/\s+/g, " ");
}
/** Kurzschreibweise (margin/padding) → [oben, rechts, unten, links]; „0" wird zu „0px". */
export function vierSeiten(wert: string | null): [string, string, string, string] | null {
  if (wert === null) return null;
  const t = wert
    .trim()
    .split(/\s+/)
    .map((v) => (v === "0" ? "0px" : v));
  const [a = "0px", b = a, c = a, d = b] = t;
  if (t.length === 1) return [a, a, a, a];
  if (t.length === 2) return [a, b, a, b];
  if (t.length === 3) return [a, b, c, b];
  return [a, b, c, d];
}
/**
 * Ein Schatten-Rezept, renderer-unabhaengig: Chromium serialisiert `0 1px 2px rgba(…)` als
 * `rgba(…) 0px 1px 2px 0px`. Beide Formen werden auf {farbe, laengen} je Schatten gebracht.
 */
export function schattenKanon(wert: string | null): string {
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

// ---- Chromium ------------------------------------------------------------------------------------
export type BrowserFn = (arg: unknown) => unknown;
export const fn = (quelle: string): BrowserFn =>
  new Function("arg", `return (${quelle})(arg);`) as BrowserFn;

export interface Route {
  request(): { url(): string; method(): string; postData(): string | null };
  fulfill(r: { status: number; body: string; contentType?: string }): Promise<void>;
  abort(grund?: string): Promise<void>;
}
export interface Seite {
  route(url: string, handler: (route: Route) => Promise<void>): Promise<void>;
  on(ereignis: string, handler: (e: { message?: string }) => void): void;
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  waitForFunction(fn: BrowserFn, arg?: unknown, opts?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(fn: BrowserFn, arg?: unknown): Promise<T>;
  close(): Promise<void>;
}
export interface Browser {
  version(): string;
  newPage(opts: Record<string, unknown>): Promise<Seite>;
  close(): Promise<void>;
}

/**
 * Die Antwort auf `POST /api/drafts` — oder ein Netzabbruch („offline"). `halten: true` haelt die
 * Antwort zurueck, bis `freigeben()` gerufen wird (Runde 3: Markierungswechsel und zweiter Versand
 * WAEHREND eines offenen Sendelaufs).
 */
export type DraftPlan = { status: number; body: unknown; halten?: boolean } | "abbruch";

export interface Plan {
  /** Die Markierung, die Word liefert (Absaetze = Zeilen); leer = nichts markiert. */
  markierung: string;
  /** false = office.js liefert kein `Office` (Seite im normalen Browser). */
  office: boolean;
  /** Das ausgelieferte Markup — oder eine im Speicher verfaelschte Fassung (Kalibrierung). */
  html: string;
  drafts: DraftPlan;
  auth: { status: number; body: unknown };
}

export interface Buehne {
  version: string;
  seite: Seite;
  plan: Plan;
  /** Chromium `pageerror` — ein Skript, das auf entfernte Kennungen greift, faellt hier auf. */
  seitenfehler: string[];
  /** Was das Panel an `/api/drafts` und `/api/drafts/from-docx` geschickt hat, geparst, in Reihenfolge. */
  posts: Array<{ url: string; koerper: Record<string, unknown> }>;
  /** Wie viele Antworten gerade zurueckgehalten werden (Plan `halten`). */
  gehalten(): number;
  /** Alle zurueckgehaltenen Antworten jetzt ausliefern — in Reihenfolge ihres Eingangs. */
  freigeben(): Promise<void>;
  /** Die Seite (neu) laden, auf die Anmeldung warten und auf „Erfassen" schalten. */
  oeffnen(): Promise<void>;
  lies<T>(quelle: string, arg?: unknown): Promise<T>;
  messen(selektor: string, eigenschaft: string): Promise<string | null>;
  schliessen(): Promise<void>;
}

/** Der Dokumentinhalt, den `Word.run` der Attrappe liefert (Dokument-Weg, Rueckfall ohne getFileAsync). */
export const DOKUMENT_ABSAETZE = ["Dokumenttext Absatz eins.", "Dokumenttext Absatz zwei."];

/**
 * Die Office-Attrappe — Form wie `buildFakeOffice` der Panel-Fixture, dazu das Ereignis
 * DocumentSelectionChanged (Handler werden gesammelt und bei `__k2.setMarkierung` gerufen) und ein
 * `Word.run` mit festem Dokumentkoerper. KEIN `Office.FileType`: der .docx-Weg faellt damit ehrlich
 * auf den Word.run-Weg zurueck (holeGanzeDatei → beiFehlschlag).
 */
function officeAttrappe(markierung: string): string {
  const absaetze = JSON.stringify(DOKUMENT_ABSAETZE);
  return `(function () {
  var handler = [];
  var markierung = ${JSON.stringify(markierung)};
  var absaetze = ${absaetze};
  function alsHtml(text) {
    if (!text) { return ""; }
    return "<html><body>" + text.split("\\n").map(function (z) { return "<p>" + z + "</p>"; }).join("") + "</body></html>";
  }
  window.__k2 = {
    setMarkierung: function (text) { markierung = text; handler.forEach(function (h) { h(); }); },
    handlerAnzahl: function () { return handler.length; }
  };
  window.Office = {
    CoercionType: { Html: "html", Text: "text" },
    AsyncResultStatus: { Succeeded: "succeeded", Failed: "failed" },
    EventType: { DocumentSelectionChanged: "documentSelectionChanged" },
    onReady: function (cb) { cb(); },
    context: { document: {
      url: "",
      addHandlerAsync: function (typ, fn) { handler.push(fn); },
      getSelectedDataAsync: function (type, cb) {
        if (type === "html") { cb({ status: "succeeded", value: alsHtml(markierung) }); return; }
        cb({ status: "succeeded", value: markierung });
      }
    } }
  };
  window.Word = { run: function (cb) {
    var body = {
      text: absaetze.join("\\n"),
      load: function () {},
      getHtml: function () { return { value: alsHtml(absaetze.join("\\n")) }; }
    };
    var context = { document: { body: body }, sync: function () { return Promise.resolve(); } };
    return Promise.resolve().then(function () { return cb(context); });
  } };
})();`;
}

/** Zwei Zeilen JS, die dieselbe Frage stellen wie ein Mensch: „steht das da, und was steht da?" */
export const LESEN =
  "([sel, eig]) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).getPropertyValue(eig) : null; }";
export const ZAEHLEN = "(sel) => document.querySelectorAll(sel).length";
export const TEXT =
  "(sel) => { const el = document.querySelector(sel); return el ? (el.textContent || '').replace(/\\s+/g, ' ').trim() : null; }";
export const WERT =
  "(sel) => { const el = document.querySelector(sel); return el ? el.value : null; }";
export const ATTR =
  "([sel, name]) => { const el = document.querySelector(sel); return el ? el.getAttribute(name) : null; }";
export const RECT =
  "(sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; }";
export const SICHTBAR = `(sel) => {
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
export const KLICK =
  "(sel) => { const el = document.querySelector(sel); if (!el) return false; el.click(); return true; }";
export const TIPPEN = `([sel, wert]) => {
  const el = document.querySelector(sel);
  if (!el) return false;
  el.value = wert;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}`;
export const MARKIEREN =
  "(text) => { window.__k2.setMarkierung(text); return window.__k2.handlerAnzahl(); }";

export async function buehneBauen(teil: Partial<Plan> = {}): Promise<Buehne> {
  const require = createRequire(import.meta.url);
  const { chromium } = require("playwright") as {
    chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
  };
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
  });
  const plan: Plan = {
    markierung: "",
    office: true,
    html: HTML,
    drafts: { status: 201, body: { id: "draft-1" } },
    auth: { status: 200, body: { name: NAME } },
    ...teil,
  };
  const seitenfehler: string[] = [];
  const posts: Buehne["posts"] = [];
  const zurueckgehalten: Array<() => void> = [];
  const seite = await browser.newPage({ viewport: { width: 360, height: 720 } });
  seite.on("pageerror", (e) => seitenfehler.push(String(e.message ?? e)));
  await seite.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.url().startsWith(OFFICE_JS)) {
      await route.fulfill({
        status: 200,
        body: plan.office ? officeAttrappe(plan.markierung) : "/* kein Office */",
        contentType: "application/javascript",
      });
      return;
    }
    if (url.origin === ORIGIN && url.pathname === SEITE_PFAD && req.method() === "GET") {
      await route.fulfill({
        status: 200,
        body: plan.html,
        contentType: "text/html; charset=utf-8",
      });
      return;
    }
    if (req.method() === "HEAD") {
      await route.fulfill({ status: 200, body: "" });
      return;
    }
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, body: JSON.stringify(body), contentType: "application/json" });
    if (url.pathname === "/api/auth/me") {
      await json(plan.auth.status, plan.auth.body);
      return;
    }
    if (url.pathname === "/api/reasoner/status") {
      await json(200, { active: false, mode: "deterministic", reachable: "ok", tasks: {} });
      return;
    }
    if (
      (url.pathname === "/api/drafts" || url.pathname === "/api/drafts/from-docx") &&
      req.method() === "POST"
    ) {
      let koerper: Record<string, unknown> = {};
      try {
        koerper = JSON.parse(req.postData() ?? "{}") as Record<string, unknown>;
      } catch {
        koerper = { unlesbar: req.postData() };
      }
      posts.push({ url: url.pathname, koerper });
      if (plan.drafts === "abbruch") {
        await route.abort("internetdisconnected");
        return;
      }
      // Der Plan wird BEIM EINGANG festgehalten — ein spaeter geaenderter Plan trifft nur spaetere
      // Anfragen. So bekommt Lauf A seine Antwort, auch wenn B laengst einen anderen Plan hat.
      const antwort = { status: plan.drafts.status, body: plan.drafts.body };
      if (plan.drafts.halten) {
        await new Promise<void>((los) => {
          zurueckgehalten.push(los);
        });
      }
      await json(antwort.status, antwort.body);
      return;
    }
    await json(404, { error: "NOT_FOUND" });
  });

  const lies = <T>(quelle: string, arg?: unknown): Promise<T> => seite.evaluate<T>(fn(quelle), arg);

  return {
    version: browser.version(),
    seite,
    plan,
    seitenfehler,
    posts,
    gehalten(): number {
      return zurueckgehalten.length;
    },
    async freigeben(): Promise<void> {
      const los = zurueckgehalten.splice(0, zurueckgehalten.length);
      for (const l of los) l();
      // Der Route-Handler liefert nach dem Loslassen asynchron aus; einen Tick warten.
      await new Promise((r) => setTimeout(r, 50));
    },
    async oeffnen(): Promise<void> {
      await seite.goto(`${ORIGIN}${SEITE_PFAD}`, { waitUntil: "load", timeout: 60_000 });
      // Angekommen ist das Panel, wenn die Anmeldung beantwortet ist (checkSession) — danach
      // haben renderStatics, Office-Erkennung und Markierungskarte ihren ersten Lauf hinter sich.
      const erwartet =
        plan.auth.status === 200
          ? wort("de", "sessionOk", { name: NAME })
          : wort("de", "sessionOff");
      await seite.waitForFunction(
        fn(
          "(t) => { const s = document.getElementById('session-status'); return !!s && (s.textContent || '').trim() === t; }",
        ),
        erwartet,
        { timeout: 30_000 },
      );
      await lies<boolean>(KLICK, "#tab-capture");
      await seite.waitForFunction(
        fn("() => document.getElementById('section-capture').className === ''"),
        undefined,
        { timeout: 10_000 },
      );
    },
    lies,
    messen(selektor: string, eigenschaft: string): Promise<string | null> {
      return lies<string | null>(LESEN, [selektor, eigenschaft]);
    },
    async schliessen(): Promise<void> {
      await browser.close();
    },
  };
}
