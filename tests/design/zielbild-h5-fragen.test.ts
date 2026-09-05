// ================================================================================================
// JOB 3064 · H5 — DIE FRAGENFLÄCHE GEGEN DAS ZIELBILD `design/klarwerk/Fragen.dc.html`, IN CHROMIUM
// AN DER GEMOUNTETEN ECHTEN ANWENDUNG GEMESSEN.
// ================================================================================================
//
// Dieselbe Vorrichtung wie `zielbild-h5-start.test.ts` (Begründung dort): echte `dist`, echte
// Fastify-App, echter Bestand, Theme ausdrücklich `modern`, Selektoren rückwärts auflösbar.
//
// DER UNTERSCHIED: diese Fläche zeigt ihre Gestalt erst NACH einer Antwort. Der Test stellt deshalb
// eine echte Frage über das echte Feld und wartet auf die echte Antwortkarte — kein vorgesetzter
// Zustand, keine Attrappe. Kommt keine Antwort, ist der Lauf ROT: eine Zielbildmessung an einer
// Fläche, die es im Betrieb nie gibt, wäre keine Messung.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

// Die Sollwortlaute kommen aus der PRODUKTIVEN Tabelle, nicht aus Abschriften (wie im
// Funktionsinventar): eine umbenannte Zeile fällt damit auf, statt still durchzulaufen.
import i18n from "../../apps/web/src/i18n";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const t = i18n.getFixedT("de");

const WURZEL = resolve(process.cwd());
const DIST = resolve(WURZEL, "apps/web/dist");
const ZIELBILD = "/Users/peterkohnert/klarwerk_steuerung/design/klarwerk/Fragen.dc.html";
const ORIGIN = "http://klarwerk.test";

const TITEL = "Profile in Spritzzonen";
// Die Fussnotenmarke `[1]` steht ABSICHTLICH im Aussagetext (Korrekturpflicht 1, Ben Runde 3).
// WARUM SO UND NICHT ANDERS, ehrlich benannt: die Marke stammt im Betrieb vom MODELL — es setzt
// `[n]` in den Antworttext, und `services/reasoner/src/provider-model.ts:450` liest sie gegen die
// Reihenfolge von `result.sources` zurueck. Das Tor faehrt aber ohne Modell
// (`KLARWERK_SMOKE_OHNE_MODELL=1`), und der modellfreie Weg formuliert nichts dazu. Ohne Marke im
// Text gaebe es hier nie eine zu messen — der Fall bliebe ein Platzhalter, genau der, den Ben
// beanstandet hat.
// Was gemessen wird, ist deshalb der RENDERWEG, und der ist derselbe: was als `[n]` im Antworttext
// ankommt, zeichnet `AnswerMarkdown` als Hochstellung aus und bindet es an denselben Chip. Woher
// der Text kommt, aendert daran nichts. Die Auszeichnungsregel selbst haengt zusaetzlich an einem
// modellfreien Einzeltest (`tests/app/job3064-fussnote-markiert.test.tsx`).
const AUSSAGE =
  "Offene, ablaufende Profile sind zu bevorzugen; vollverschweisste Hohlprofile sind in Spritzzonen zu vermeiden [1].";
const FRAGE = "Welche Profile sind in Spritzzonen erlaubt?";

// ---- Das Zielbild lesen ---------------------------------------------------------------------------
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
function kanon(wert: string | null): string | null {
  if (wert === null) return null;
  const m = /^#([0-9a-f]{6})$/i.exec(wert.trim());
  if (!m) return wert.trim();
  const h = m[1] ?? "";
  return `rgb(${Number.parseInt(h.slice(0, 2), 16)}, ${Number.parseInt(h.slice(2, 4), 16)}, ${Number.parseInt(h.slice(4, 6), 16)})`;
}
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

// Anker: eindeutige Stil-Fragmente je Zeile des Zielbilds (Z.36–49).
const Z_SPALTE = "width: 800px; padding: 36px 0 32px";
const Z_FRAGEZEILE = "font-size: 14px; color: #525B6B";
const Z_ANTWORTKARTE = "padding: 24px 28px";
const Z_ANTWORTTEXT = "font-size: 17px; line-height: 1.6";
const Z_FUSSNOTE = "font-size: 10px; color: #9C5009";
const Z_CHIPZEILE = "border-top: 1px solid #E9E5DE; padding-top: 14px";
const Z_CHIP = "padding: 5px 10px; background: #FAF8F5";
const Z_CHIPTEXT = "font-size: 12px; font-weight: 600";
const Z_KNOPF = "padding: 10px 20px";
const Z_FELD_A = "margin-top: auto";
const Z_FELD_B = "padding: 14px 18px";
const Z_FELDTEXT = "flex-grow: 1; font-size: 16px";
const Z_SENDEN = "width: 34px; height: 34px";

const ziel = existsSync(ZIELBILD) ? readFileSync(ZIELBILD, "utf8") : "";

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
const ELEMENTE = `([pfadFnSrc]) => {
  const pfad = eval('(' + pfadFnSrc + ')');
  const q = (s) => document.querySelector(s);
  const spalte = q('[data-testid="page-fragen"]');
  const fragezeile = q('[data-testid="ask-fragezeile"]');
  const karte = q('[data-testid="ask-answer"]');
  const antworttext = q('.ask-answer-body');
  const chipzeile = q('[data-testid="ask-quellen-chips"]');
  const chip = q('[data-testid="ask-quellen-chip"]');
  const chipSymbol = chip ? chip.querySelector('svg') : null;
  const chipText = chip ? chip.querySelector('span') : null;
  const knopfzeile = karte ? karte.parentElement.children[1] : null;
  const knopf = knopfzeile ? knopfzeile.querySelector('button') : null;
  const feld = spalte ? spalte.querySelector('form') : null;
  const input = feld ? feld.querySelector('input') : null;
  const senden = feld ? feld.querySelector('button[type="submit"]') : null;
  const sendenSymbol = senden ? senden.querySelector('svg') : null;
  const mikroKnopf = feld ? [...feld.querySelectorAll('button')].find((b) => b.getAttribute('type') === 'button' && b.querySelector('svg') && b.getAttribute('aria-pressed') !== null) : null;
  const mikro = mikroKnopf ? mikroKnopf.querySelector('svg') : null;
  const p = (e) => (e ? pfad(e) : null);
  const out = {
    spalte: p(spalte), fragezeile: p(fragezeile), fragezeileText: fragezeile ? (fragezeile.textContent || '').trim() : null,
    karte: p(karte), antworttext: p(antworttext), chipzeile: p(chipzeile), chip: p(chip),
    chipSymbol: p(chipSymbol), chipText: p(chipText), chipTextWort: chipText ? (chipText.textContent || '').trim() : null,
    knopfzeile: p(knopfzeile), knopf: p(knopf), knopfWort: knopf ? (knopf.textContent || '').trim() : null,
    feld: p(feld), input: p(input), senden: p(senden), sendenSymbol: p(sendenSymbol), mikro: p(mikro),
    // Die SICHTBARE Lage: das Feld steht unter der Antwortkarte (Zielbild Z.45, margin-top: auto).
    feldUnterKarte: feld && karte ? feld.getBoundingClientRect().top >= karte.getBoundingClientRect().bottom : null,
    // Und im Quelltext steht es davor — D-034 („erst fragen, dann erklären") bleibt eingelöst.
    feldVorErgebnisImQuelltext: feld && karte ? (feld.compareDocumentPosition(karte) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 : null,
  };
  const gefunden = [spalte, fragezeile, karte, antworttext, chipzeile, chip, chipSymbol, chipText, knopfzeile, knopf, feld, input, senden, sendenSymbol, mikro].filter(Boolean);
  out.aufgeloest = gefunden.every((e) => document.querySelector(pfad(e)) === e);
  out.vollstaendig = gefunden.length === 15;
  return out;
}`;
const LESEN =
  "([sel, eig]) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).getPropertyValue(eig) : null; }";
const LESEN_PSEUDO =
  "([sel, pseudo, eig]) => { const el = document.querySelector(sel); return el ? getComputedStyle(el, pseudo).getPropertyValue(eig) : null; }";
const SONDE =
  "([stil, eig]) => { const d = document.createElement('div'); d.setAttribute('style', stil); document.body.appendChild(d); const v = getComputedStyle(d).getPropertyValue(eig); d.remove(); return v; }";

interface Selektoren {
  spalte: string;
  fragezeile: string | null;
  fragezeileText: string | null;
  karte: string | null;
  antworttext: string | null;
  chipzeile: string | null;
  chip: string | null;
  chipSymbol: string | null;
  chipText: string | null;
  chipTextWort: string | null;
  knopfzeile: string | null;
  knopf: string | null;
  knopfWort: string | null;
  feld: string | null;
  input: string | null;
  senden: string | null;
  sendenSymbol: string | null;
  mikro: string | null;
  feldUnterKarte: boolean | null;
  feldVorErgebnisImQuelltext: boolean | null;
  aufgeloest: boolean;
  vollstaendig: boolean;
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

describe("JOB 3064 · H5 · die Fragenfläche gegen `Fragen.dc.html` — die echte Seite in Chromium (Theme modern)", () => {
  beforeAll(async () => {
    try {
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
        payload: { name: "Pedi", email: "pedi@job3064f.test", password: "geheim12345" },
      });
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "pedi@job3064f.test", password: "geheim12345" },
      });
      const token = (login.json() as { token: string }).token;
      const me = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { authorization: `Bearer ${token}` },
      });
      const autorId = (me.json() as { id: string }).id;
      await app.inject({
        method: "POST",
        url: "/api/auth/notice",
        headers: { authorization: `Bearer ${token}` },
      });
      // EIN validiertes Wissensobjekt, das die Frage wirklich trägt — die Antwort ist
      // quellengebunden, also gibt es ohne Grundlage keine Antwortkarte zu messen.
      const ko = await services.ko.create({
        title: TITEL,
        statement: AUSSAGE,
        type: "best_practice",
        category: "Konstruktion",
        author: autorId,
        tags: ["Profile", "Spritzzone", "Hohlprofile"],
      } as never);
      // Derselbe Weg, den auch `tests/ask/job2659-eine-marke-ist-kein-beleg.test.ts` nimmt: die
      // Freigabe kommt aus dem Dienst, nicht aus einem gesetzten Feld.
      await services.ko.setValidationState((ko as { id: string }).id, {
        trust: 92,
        status: "validiert",
      });

      const require = createRequire(import.meta.url);
      const { chromium } = require("playwright") as {
        chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
      };
      browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
      });
      version = browser.version();
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
          // ==========================================================================================
          // DIE EINE GESETZTE AUSKUNFT — benannt, begrenzt und begründet.
          // ==========================================================================================
          // `GET /api/reasoner/status` meldet in dieser Prüfumgebung `active: false`, weil kein
          // Modell verdrahtet ist (kein Schlüssel im Prüfstand). D-AISTATE Paket 1 GRAUT den
          // Sendeknopf dann hart aus — richtig im Betrieb, aber es gäbe hier nie eine Antwortkarte
          // zu messen, und eine Zielbildmessung ohne die Fläche wäre keine.
          //
          // Deshalb wird GENAU DIESE eine LESENDE Auskunft überschrieben, und nur in den zwei
          // Feldern, an denen die Sperre hängt (`active`, `tasks.answer`). Was NICHT gesetzt wird:
          // die ANTWORT. Sie kommt unverändert aus `POST /api/ask` der echten Fastify-App, aus dem
          // echten, quellengebundenen Dienst und dem echten Bestand — V9 prüft, dass der Chip den
          // ECHTEN Titel des angelegten Wissensobjekts trägt, und wäre gegen eine Attrappe rot.
          if (url.pathname === "/api/reasoner/status" && res.statusCode === 200) {
            const echt = JSON.parse(res.body) as {
              active?: boolean;
              tasks?: Record<string, boolean>;
            };
            await route.fulfill({
              status: 200,
              body: JSON.stringify({
                ...echt,
                active: true,
                tasks: { ...(echt.tasks ?? {}), answer: true },
              }),
              headers: { "content-type": "application/json" },
            });
            return;
          }
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
      await seite.goto(`${ORIGIN}/fragen`, { waitUntil: "load", timeout: 60_000 });
      await seite.waitForFunction(
        fn(`() => !!document.querySelector('[data-testid="page-fragen"] form input')`),
        undefined,
        { timeout: 30_000 },
      );
      // EINE echte Frage über das echte Feld — kein vorgesetzter Zustand.
      await seite.fill('[data-testid="page-fragen"] form input', FRAGE);
      await seite.click('[data-testid="page-fragen"] form button[type="submit"]');
      await seite.waitForFunction(
        fn(`() => !!document.querySelector('[data-testid="ask-answer"] .ask-answer-body')`),
        undefined,
        { timeout: 60_000 },
      );
      theme = await seite.evaluate<string>(
        fn(
          `() => document.documentElement.getAttribute('data-theme') || 'classic (kein Attribut)'`,
        ),
      );
      sel = await seite.evaluate<Selektoren | null>(fn(ELEMENTE), [PFAD_FN]);
      console.info(
        `JOB 3064 H5 · Chromium ${version} · ${ORIGIN}/fragen · Theme ${theme} · Selektoren ${JSON.stringify(sel)}`,
      );
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 3).join(" | ");
    }
  }, 240_000);

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
  function sichtbareSchatten(wert: string | null): string | null {
    return wert === null ? null : wert.replace(/rgba\(0, 0, 0, 0\) 0px 0px 0px 0px, /g, "");
  }

  it("S · die echte Seite steht: Theme modern, ECHTE Antwort auf eine ECHTE Frage, Selektoren aufloesbar", () => {
    expect(fehler).toBeNull();
    expect(theme).toBe("modern");
    expect(sel?.vollstaendig, "nicht jedes Element des Zielbilds ist gebaut").toBe(true);
    expect(sel?.aufgeloest).toBe(true);
    expect(sel?.spalte).toMatch(/^body > /);
  });

  // ---- Die Spalte (Z.37) --------------------------------------------------------------------------
  it("V1 · spalte 800px breit, Polster 36px oben / 32px unten, Abstand 22px", async () => {
    const stil = zielStil(ziel, Z_SPALTE);
    const p = zielProp(stil, "padding")?.split(" ") ?? [];
    expect(await messen(sel?.spalte, "width")).toBe(zielProp(stil, "width"));
    expect(await messen(sel?.spalte, "padding-top")).toBe(p[0]);
    expect(await messen(sel?.spalte, "padding-bottom")).toBe(p[2]);
    expect(await messen(sel?.spalte, "gap")).toBe(zielProp(stil, "gap"));
    expect(await messen(sel?.spalte, "flex-direction")).toBe(zielProp(stil, "flex-direction"));
  });

  // ---- Die Fragezeile (Z.38) ----------------------------------------------------------------------
  it("V2 · fragezeile: die GESTELLTE Frage, 14px, #525B6B", async () => {
    const stil = zielStil(ziel, Z_FRAGEZEILE);
    expect(sel?.fragezeileText, "die Fragezeile zeigt nicht die gestellte Frage").toBe(FRAGE);
    expect(await messen(sel?.fragezeile, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await messen(sel?.fragezeile, "color")).toBe(kanon(zielProp(stil, "color")));
  });

  // ---- Die Antwortkarte (Z.39–41) -----------------------------------------------------------------
  it("V3 · antwortkarte: Polster 24px 28px, Abstand 16px, Radius 14px, Grund weiss, Rahmen #E9E5DE", async () => {
    const stil = zielStil(ziel, Z_ANTWORTKARTE);
    const p = zielProp(stil, "padding")?.split(" ") ?? [];
    const [breite, , farbe] = zielProp(stil, "border")?.split(" ") ?? [];
    expect(await messen(sel?.karte, "padding-top")).toBe(p[0]);
    expect(await messen(sel?.karte, "padding-left")).toBe(p[1]);
    expect(await messen(sel?.karte, "gap")).toBe(zielProp(stil, "gap"));
    expect(await messen(sel?.karte, "border-radius")).toBe(zielProp(stil, "border-radius"));
    expect(await messen(sel?.karte, "background-color")).toBe(kanon(zielProp(stil, "background")));
    expect(await messen(sel?.karte, "border-top-width")).toBe(breite);
    expect(await messen(sel?.karte, "border-top-color")).toBe(kanon(farbe ?? null));
  });
  it("V4 · antwortkarte-schatten (Z.39, Sonde im selben Renderer)", async () => {
    expect(sichtbareSchatten(await messen(sel?.karte, "box-shadow"))).toBe(
      sichtbareSchatten(await sonde(zielStil(ziel, Z_ANTWORTKARTE), "box-shadow")),
    );
  });
  it("V5 · antworttext 17px, Zeilenhoehe 1.6 (Sonde), Tinte", async () => {
    const stil = zielStil(ziel, Z_ANTWORTTEXT);
    expect(await messen(sel?.antworttext, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await messen(sel?.antworttext, "line-height")).toBe(await sonde(stil, "line-height"));
  });

  // ---- Die Quellen-Chips (Z.42) -------------------------------------------------------------------
  it("V6 · chipzeile: Trennlinie 1px #E9E5DE, Abstand nach oben 14px, Abstand 8px", async () => {
    const stil = zielStil(ziel, Z_CHIPZEILE);
    const [breite, , farbe] = zielProp(stil, "border-top")?.split(" ") ?? [];
    expect(await messen(sel?.chipzeile, "border-top-width")).toBe(breite);
    expect(await messen(sel?.chipzeile, "border-top-color")).toBe(kanon(farbe ?? null));
    expect(await messen(sel?.chipzeile, "padding-top")).toBe(zielProp(stil, "padding-top"));
    expect(await messen(sel?.chipzeile, "gap")).toBe(zielProp(stil, "gap"));
  });
  it("V7 · chip: Abstand 6px, Polster 5px 10px, Grund #FAF8F5, Rahmen #E9E5DE, Radius 8px", async () => {
    const stil = zielStil(ziel, Z_CHIP);
    const p = zielProp(stil, "padding")?.split(" ") ?? [];
    const [breite, , farbe] = zielProp(stil, "border")?.split(" ") ?? [];
    expect(await messen(sel?.chip, "gap")).toBe(zielProp(stil, "gap"));
    expect(await messen(sel?.chip, "padding-top")).toBe(p[0]);
    expect(await messen(sel?.chip, "padding-left")).toBe(p[1]);
    expect(await messen(sel?.chip, "background-color")).toBe(kanon(zielProp(stil, "background")));
    expect(await messen(sel?.chip, "border-top-width")).toBe(breite);
    expect(await messen(sel?.chip, "border-top-color")).toBe(kanon(farbe ?? null));
    expect(await messen(sel?.chip, "border-radius")).toBe(zielProp(stil, "border-radius"));
  });
  it("V8 · chip-symbol 13px, Strich #525B6B, 1.8", async () => {
    const z = zielSymbol(ziel, "13", "#525B6B");
    expect(z).not.toBeNull();
    expect(await messen(sel?.chipSymbol, "width")).toBe(`${z?.width}px`);
    expect(await messen(sel?.chipSymbol, "stroke")).toBe(kanon("#525B6B"));
    expect(await messen(sel?.chipSymbol, "stroke-width")).toBe(`${z?.strichBreite}px`);
  });
  it("V9 · chip-text 12px / 600 und die FORM „n · Titel“ mit dem ECHTEN Quellentitel", async () => {
    const stil = zielStil(ziel, Z_CHIPTEXT);
    expect(await messen(sel?.chipText, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await messen(sel?.chipText, "font-weight")).toBe(zielProp(stil, "font-weight"));
    // Das Zielbild schreibt „1 · Design Guide"; die Seite trägt die ECHTE Ziffer und den ECHTEN
    // Titel des Bestands. Verglichen wird die Form und der wahre Inhalt, kein Platzhalter.
    expect(sel?.chipTextWort).toBe(`1 · ${TITEL}`);
  });

  // ---- Die zwei Knoepfe (Z.44) --------------------------------------------------------------------
  it("V10 · knopfzeile Abstand 8px; Knopf Polster 10px 20px, Radius 10px, 14px, Grund weiss, Rahmen #E9E5DE", async () => {
    const stil = zielStil(ziel, Z_KNOPF);
    const p = zielProp(stil, "padding")?.split(" ") ?? [];
    const [breite, , farbe] = zielProp(stil, "border")?.split(" ") ?? [];
    expect(await messen(sel?.knopfzeile, "gap")).toBe("8px");
    expect(await messen(sel?.knopf, "padding-top")).toBe(p[0]);
    expect(await messen(sel?.knopf, "padding-left")).toBe(p[1]);
    expect(await messen(sel?.knopf, "border-radius")).toBe(zielProp(stil, "border-radius"));
    expect(await messen(sel?.knopf, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await messen(sel?.knopf, "background-color")).toBe(kanon(zielProp(stil, "background")));
    expect(await messen(sel?.knopf, "border-top-width")).toBe(breite);
    expect(await messen(sel?.knopf, "border-top-color")).toBe(kanon(farbe ?? null));
    expect(await messen(sel?.knopf, "color")).toBe(kanon(zielProp(stil, "color")));
  });

  // ---- Das Frage-Feld unten (Z.45–48) -------------------------------------------------------------
  it("V11 · feld: Abstand 12px, Polster 14px 18px, Radius 14px, Grund weiss, Rahmen #E9E5DE", async () => {
    const stil = zielStil(ziel, Z_FELD_A, Z_FELD_B);
    const p = zielProp(stil, "padding")?.split(" ") ?? [];
    const [breite, , farbe] = zielProp(stil, "border")?.split(" ") ?? [];
    expect(await messen(sel?.feld, "gap")).toBe(zielProp(stil, "gap"));
    expect(await messen(sel?.feld, "padding-top")).toBe(p[0]);
    expect(await messen(sel?.feld, "padding-left")).toBe(p[1]);
    expect(await messen(sel?.feld, "border-radius")).toBe(zielProp(stil, "border-radius"));
    expect(await messen(sel?.feld, "background-color")).toBe(kanon(zielProp(stil, "background")));
    expect(await messen(sel?.feld, "border-top-width")).toBe(breite);
    expect(await messen(sel?.feld, "border-top-color")).toBe(kanon(farbe ?? null));
  });
  it("V12 · feld-schatten (Z.45, Sonde im selben Renderer)", async () => {
    expect(sichtbareSchatten(await messen(sel?.feld, "box-shadow"))).toBe(
      sichtbareSchatten(await sonde(zielStil(ziel, Z_FELD_A, Z_FELD_B), "box-shadow")),
    );
  });
  it("V13 · feldtext 16px (Z.46)", async () => {
    expect(await messen(sel?.input, "font-size")).toBe(
      kanon(zielProp(zielStil(ziel, Z_FELDTEXT), "font-size")),
    );
  });
  it("V14 · mikrofon 18px, Strich #525B6B, 1.8 (Z.47)", async () => {
    const z = zielSymbol(ziel, "18", "#525B6B");
    expect(z).not.toBeNull();
    expect(await messen(sel?.mikro, "width")).toBe(`${z?.width}px`);
    expect(await messen(sel?.mikro, "stroke")).toBe(kanon("#525B6B"));
    expect(await messen(sel?.mikro, "stroke-width")).toBe(`${z?.strichBreite}px`);
  });
  it("V15 · sendeknopf 34×34, rund; Pfeil 16px, Strich 2.2 (Z.48)", async () => {
    const stil = zielStil(ziel, Z_SENDEN);
    expect(await messen(sel?.senden, "width")).toBe(zielProp(stil, "width"));
    expect(await messen(sel?.senden, "height")).toBe(zielProp(stil, "height"));
    expect(await messen(sel?.senden, "border-radius")).toBe(zielProp(stil, "border-radius"));
    expect(await messen(sel?.sendenSymbol, "width")).toBe("16px");
    expect(await messen(sel?.sendenSymbol, "stroke-width")).toBe("2.2px");
  });
  it("V16 · das Feld steht UNTER der Antwortkarte (Z.45, margin-top: auto) — und im Quelltext davor", () => {
    expect(fehler).toBeNull();
    // Die sichtbare Lage ist die des Zielbilds …
    expect(sel?.feldUnterKarte).toBe(true);
    // … und die Quelltextreihenfolge bleibt die von D-034 (JOB 1106): erst fragen, dann erklären.
    // Beides gleichzeitig ist der Grund für `order` im Flex-Container; wer eines von beiden
    // aufgibt, macht genau diesen Fall rot.
    expect(sel?.feldVorErgebnisImQuelltext).toBe(true);
  });

  // ---- Die offenen Werte: gemessen, begruendet, nicht behauptet -----------------------------------
  // KORREKTURPFLICHT 1 (Ben, Runde 3). Dieser Fall war bis Runde 3 ein Platzhalter: er mass
  // `0 <sup>-Elemente`, protokollierte den Sollwert als OFFEN und prüfte dann nur noch, dass
  // ÜBERHAUPT Antworttext da ist — grün, ohne die Sache zu belegen. Ein als OFFEN protokollierter
  // Sollwert ist nicht geliefert; er darf auch nicht als geliefert gemeldet werden.
  // Ab hier wird die Marke wirklich gemessen: Auszeichnung UND Bindung an denselben Chip.
  it("V17 · Fussnotenziffern im Antworttext (Z.40/41): 10 px, #9C5009, 700 — wirklich gerendert", async () => {
    expect(fehler).toBeNull();
    const stil = zielStil(ziel, Z_FUSSNOTE);
    const s = seite as Seite;
    const marken = await s.evaluate<number>(
      fn(`() => document.querySelectorAll('.ask-answer-body sup[data-fussnote]').length`),
    );
    console.info(
      `JOB 3064 H5 · V17 · Fussnote: Zielbild ${stil} · Seite ${marken} Marken im Antworttext`,
    );
    expect(marken, "der Antworttext traegt keine ausgezeichnete Fussnotenmarke").toBeGreaterThan(0);
    const g = await s.evaluate<{ size: string; color: string; weight: string; sup: boolean }>(
      fn(
        `() => { const m = document.querySelector('.ask-answer-body sup[data-fussnote]'); const st = getComputedStyle(m); return { size: st.fontSize, color: st.color, weight: st.fontWeight, sup: m.tagName.toLowerCase() === 'sup' }; }`,
      ),
    );
    expect(g.size).toBe(zielProp(stil, "font-size"));
    expect(g.color).toBe(kanon(zielProp(stil, "color")));
    expect(g.weight).toBe("700");
    expect(g.sup, "die Marke ist keine Hochstellung").toBe(true);
  });

  it("V18 · jede Ziffer im Text meint DENSELBEN nummerierten Quellen-Chip", async () => {
    expect(fehler).toBeNull();
    const s = seite as Seite;
    const b = await s.evaluate<{ marken: string[]; chips: string[] }>(
      fn(
        `() => ({ marken: [...document.querySelectorAll('.ask-answer-body sup[data-fussnote]')].map((e) => e.getAttribute('data-fussnote')), chips: [...document.querySelectorAll('[data-testid="ask-quellen-chip"]')].map((c) => ((c.textContent || '').trim().match(/^(\\d+)/) || [])[1] || '') })`,
      ),
    );
    console.info(`JOB 3064 H5 · V18 · Marken ${b.marken.join(",")} · Chips ${b.chips.join(",")}`);
    expect(b.chips.length, "ohne nummerierte Chips belegt der Vergleich nichts").toBeGreaterThan(0);
    // KORREKTURPFLICHT 1 (Ben, Runde 3): „mindestens EINE passende Marke". Ohne diese Zeile war der
    // Fall bei NULL Marken still gruen — die Schleife darunter laeuft dann ueber die leere Menge,
    // und genau so konnte ein als OFFEN protokollierter Sollwert als erfuellt durchgehen.
    expect(
      b.marken.length,
      "im Antworttext steht keine einzige Fussnotenmarke — Zielbild `Fragen.dc.html` Z.40/41",
    ).toBeGreaterThan(0);
    // KEINE Marke ohne Chip: eine hochgestellte 3 ohne dritte Quelle waere eine erfundene Bindung.
    for (const m of b.marken) {
      expect(b.chips, `die Marke [${m}] hat keinen Chip`).toContain(m);
    }
  });

  it("V18c · KEIN gültiger Rohmarker bleibt in der echten Antwortkarte sichtbar", async () => {
    // KORREKTURPFLICHT 1 (Ben, Runde 6), an der ECHTEN Karte: „gültige Rohmarker dürfen nicht
    // sichtbar bleiben." Bis Runde 6 stand `[1, 2]` als Klammertext im Fliesstext, obwohl der
    // Reasoner daraus zwei Quellen band.
    //
    // GEMESSEN WIRD DER SICHTBARE TEXT der Antwortkarte gegen die Zahl der Chips: eine Klammer mit
    // einer Zahl, für die es einen Chip gibt, ist ein Rohmarker und darf nicht dastehen. Eine
    // Klammer mit einer Zahl OHNE Chip (etwa eine Jahreszahl „[2026]") ist kein Marker und darf
    // sehr wohl stehen bleiben — sie auszuzeichnen wäre eine erfundene Bindung.
    //
    // WAS DIESER FALL NICHT KANN: die Zitierform erzwingen. Die Antwort kommt aus dem echten,
    // quellengebundenen Dienst; WELCHE Form er setzt (`[1]`, `[1, 2]`), entscheidet er. Die Formen
    // einzeln prüfen deshalb `tests/app/job3064-fussnote-markiert.test.tsx` (F7–F13) und die
    // Vertragsregression `tests/ask/job3064-fussnoten-vertrag.test.tsx`. Hier steht die Zusage, die
    // nur am gebauten Stand zu haben ist: was der Mensch WIRKLICH liest.
    expect(fehler).toBeNull();
    const b = await (seite as Seite).evaluate<{ text: string; chips: number }>(
      fn(
        `() => ({ text: (document.querySelector('.ask-answer-body') || {}).innerText || '', chips: document.querySelectorAll('[data-testid="ask-quellen-chip"]').length })`,
      ),
    );
    console.info(`JOB 3064 H5 · V18c · Chips ${b.chips} · Antworttext „${b.text.slice(0, 120)}"`);
    expect(b.chips, "ohne Chips belegt der Vergleich nichts").toBeGreaterThan(0);
    const roh: string[] = [];
    for (const treffer of b.text.matchAll(/\[([0-9\s,]+)\]/g)) {
      const ziffern = (treffer[1] ?? "").split(",").map((s) => Number.parseInt(s.trim(), 10));
      if (ziffern.every((n) => Number.isInteger(n) && n >= 1 && n <= b.chips)) {
        roh.push(treffer[0] as string);
      }
    }
    expect(roh, `gültige Rohmarker im sichtbaren Antworttext: ${roh.join(" ")}`).toEqual([]);
  });

  it("V18b · die Marke ist ausgezeichnet wie das Zielbild: 10 px, #9C5009, 700 — in Chromium gemessen", async () => {
    // Ben verlangt die AUSZEICHNUNG, nicht nur die Existenz: eine Ziffer in Fliesstextgroesse und
    // Fliesstextfarbe waere keine Fussnote, sondern ein Tippfehler. Gemessen wird der gerechnete
    // Stil am ersten Vorkommen, nicht die Klassenzeichenkette.
    expect(fehler).toBeNull();
    const stil = await (seite as Seite).evaluate<{
      size: string;
      color: string;
      weight: string;
      vertical: string;
    } | null>(
      fn(
        `() => { const e = document.querySelector('.ask-answer-body sup[data-fussnote]'); if (!e) return null;
           const c = getComputedStyle(e);
           return { size: c.fontSize, color: c.color, weight: c.fontWeight, vertical: c.verticalAlign }; }`,
      ),
    );
    console.info(`JOB 3064 H5 · V18b · Marke ${JSON.stringify(stil)}`);
    expect(stil, "keine Marke vorhanden — die Auszeichnung ist nicht messbar").not.toBeNull();
    expect((stil as { size: string }).size).toBe("10px");
    expect((stil as { color: string }).color).toBe(kanon("#9C5009"));
    expect((stil as { weight: string }).weight).toBe("700");
    expect((stil as { vertical: string }).vertical).toBe("super");
  });
  it("OFFEN · sendeknopf-grund #E9E5DE mit weissem Pfeil (Z.48) — auf dieser Paarung waere der Pfeil unsichtbar", async () => {
    expect(fehler).toBeNull();
    const grund = await messen(sel?.senden, "background-color");
    const strich = await messen(sel?.sendenSymbol, "stroke");
    console.info(
      `JOB 3064 H5 · OFFEN · Sendeknopf: Zielbild Grund ${kanon("#E9E5DE")} + Pfeil ${kanon("#FFFFFF")} (Kontrast ~1,3:1 — unlesbar) · Seite Grund ${grund} + Pfeil ${strich}. Das Produkt nimmt die Tinte des Hauses; Groesse, Form und Strichstaerke sind oben verglichen.`,
    );
    expect(grund).not.toBe(strich);
  });
  it("OFFEN · feldtext-farbe #9AA2B1 (Z.46) — derselbe Grund wie auf der Startseite (Kontrast)", async () => {
    expect(fehler).toBeNull();
    const ist = await (seite as Seite).evaluate<string | null>(fn(LESEN_PSEUDO), [
      sel?.input,
      "::placeholder",
      "color",
    ]);
    console.info(
      `JOB 3064 H5 · OFFEN · Feldtext: Zielbild ${kanon("#9AA2B1")} · Seite ${ist} — #9AA2B1 faellt auf Weiss unter AA; themes.css fuehrt den Ton ausdruecklich nicht fuer Text.`,
    );
    expect(ist).toBe(kanon("#525B6B"));
  });
  it("OFFEN · Kopfband und Seitenleiste (Z.17–34) — App-Huelle, JOB H1 (§10 des Auftrags)", async () => {
    expect(fehler).toBeNull();
    const grund = await (seite as Seite).evaluate<string>(
      fn("() => getComputedStyle(document.body).getPropertyValue('background-color')"),
    );
    console.info(`JOB 3064 H5 · OFFEN · Seitengrund ${grund}; Huelle ist Gegenstand von JOB H1`);
    expect(grund).not.toBe("");
  });

  // ================================================================================================
  // „MEHR" — GEOMETRIE UND EINZIGKEIT DES SEITENBLATTS (Korrekturpflicht 2, Ben Runde 3)
  // ================================================================================================
  // Bens Messung an Runde 3: `{ position: 'static', width: '742px' }` statt
  // `{ position: 'fixed', width: '360px' }` — „Mehr" war ein Inlineblock, und es waren sogar ZWEI.
  // Diese drei Faelle messen genau das, was er verlangt hat: gemessene Geometrie, genau ein
  // sichtbares Blatt, vollstaendiges Inventar darin.
  describe("M · das Info-Blatt „Mehr“", () => {
    it("M1 · es ist GENAU EINES — und zwar erst nach dem Griff, vorher keines", async () => {
      expect(fehler).toBeNull();
      const s = seite as Seite;
      const vorher = await s.evaluate<number>(
        fn(`() => document.querySelectorAll('[data-testid="ask-mehr"]').length`),
      );
      expect(vorher, "das Blatt haengt schon vor dem Griff im Baum").toBe(0);
      await s.click('[data-testid="ask-menu"]');
      await s.click('[data-testid="ask-menu-punkt-mehr"]');
      await s.waitForFunction(
        fn(`() => !!document.querySelector('[data-testid="ask-mehr"]')`),
        undefined,
        { timeout: 10_000 },
      );
      const nachher = await s.evaluate<number>(
        fn(`() => document.querySelectorAll('[data-testid="ask-mehr"]').length`),
      );
      expect(nachher, "zwei Blaetter zugleich — genau der Befund der Runde 3").toBe(1);
    });

    it("M2 · gemessene Geometrie: fixed, 360 px, an der RECHTEN Kante", async () => {
      expect(fehler).toBeNull();
      const s = seite as Seite;
      const g = await s.evaluate<{
        position: string;
        width: string;
        rechtsBuendig: boolean;
        vollHoch: boolean;
      }>(
        fn(
          `() => { const b = document.querySelector('[data-testid="ask-mehr"]'); const st = getComputedStyle(b); const r = b.getBoundingClientRect(); return { position: st.position, width: st.width, rechtsBuendig: Math.abs(r.right - window.innerWidth) < 1.5, vollHoch: Math.abs(r.height - window.innerHeight) < 1.5 }; }`,
        ),
      );
      console.info(`JOB 3064 H5 · M2 · Blatt ${JSON.stringify(g)}`);
      expect(g.position).toBe("fixed");
      expect(g.width).toBe("360px");
      expect(g.rechtsBuendig, "das Blatt sitzt nicht an der rechten Kante").toBe(true);
      expect(g.vollHoch, "das Blatt geht nicht ueber die volle Hoehe").toBe(true);
    });

    it("M3 · das Inventar steht DARIN: Vertrag, Zaehlzeile, Kontextquellen, Modus-Chip, Quellenhinweis", async () => {
      expect(fehler).toBeNull();
      const s = seite as Seite;
      const text = await s.evaluate<string>(
        fn(
          `() => ((document.querySelector('[data-testid="ask-mehr"]') || {}).innerText || '').replace(/\\s+/g, ' ')`,
        ),
      );
      // Diese Zeilen stehen IMMER im Blatt — Einordnung der Antwort und Einordnung der Fläche.
      for (const key of [
        "ask.contract.label",
        "ask.sourcesHint",
        "ask.kicker",
        "ask.title",
        "ask.intro",
      ]) {
        expect(text, `„${key}" fehlt im Blatt`).toContain(t(key));
      }
      // „Herangezogene Kontextquellen" ist EHRLICH BEDINGT: mega39 D2 zeigt die Liste nur, wenn sie
      // eine Fundstelle trägt, die nicht ohnehin in der Quellenliste steht (`lib/askSteps.ts`).
      // Sie hier unbedingt zu verlangen hiesse, einen Block zu fordern, den es zu Recht nicht gibt.
      // Geprüft wird deshalb die BINDUNG: steht die Überschrift da, dann im Blatt und nirgends sonst.
      const stepsLage = await s.evaluate<{ imBlatt: boolean; imRest: boolean }>(
        fn(
          `(n) => { const b = document.querySelector('[data-testid="ask-mehr"]'); const inBlatt = ((b || {}).innerText || '').includes(n); const alles = (document.body.innerText || '').includes(n); return { imBlatt: inBlatt, imRest: alles && !inBlatt }; }`,
        ),
        t("ask.steps"),
      );
      expect(stepsLage.imRest, "die Kontextquellen stehen ausserhalb des Blattes").toBe(false);
      // Und der Modus-Chip ist wirklich sichtbar, nicht nur im Baum.
      const chip = await s.evaluate<number>(
        fn(
          `() => { const c = document.querySelector('[data-testid="ask-reasoner-mode"]'); if (!c) return 0; const r = c.getBoundingClientRect(); return r.width * r.height; }`,
        ),
      );
      expect(chip, "der Modus-Chip ist unsichtbar").toBeGreaterThan(0);
    });
  });
});
