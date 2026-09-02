// ================================================================================================
// JOB 2618 · D5 — DIE ECHTE SEITE UND DREI SAUBERE SCHNITTE: das Fussband der Validierung, gemessen
// an der in Chromium GEMOUNTETEN echten Anwendung, ein Vergleich je Wert.
// ================================================================================================
//
// PEDIS FRAGE: „Sieht die Validierungsseite wirklich so aus wie gezeichnet — auf der echten Seite
// gemessen, nicht an einem Nachbau?"
//
// BEN an D4: „Die Chromium-Pruefung muss die echte `Validation.tsx` mounten und deren reale
// Fussband- und Knopfelemente messen; ein separat erzeugtes Element mit derselben Klassenkette ist
// kein UI-Beleg." Und: „jede der drei aeusseren Gegenmutationen macht in ihrem Beleglauf genau einen
// erwarteten Vergleich rot; A0, R und D0–D3 duerfen nicht als zusaetzliche Fehler erscheinen."
//
// WIE DIE ECHTE SEITE HIER LAEUFT:
//   · Die ECHTE Anwendung (`apps/web/dist`, das Ergebnis von `./tools/build`) wird in Chromium unter
//     `http://klarwerk.test/` geladen; Playwright bedient `/assets/*`, `index.html` usw. aus `dist`
//     und reicht JEDEN `/api/*`-Aufruf an die ECHTE Fastify-App (`buildApp`, echte Dienste, echter
//     Bestand) weiter — mit dem Bearer der echten Anmeldung. Kein Mock, kein Nachbau: React mountet
//     `Validation.tsx` selbst, mit einem echten Wissensobjekt im Board.
//   · Das THEME wird ausdruecklich gesetzt: `localStorage["kw.designTheme"] = "modern"` — der
//     Schalter des Produkts (mega40, `lib/designTheme.ts`) — und in der Seite nachgemessen
//     (`html[data-theme="modern"]`, `--kw-hairline` an der Wurzel). Das Zielbild (Validierung.dc.html)
//     ist die Werkbank-Palette, also modern; der klassische Standard ohne Umschalter liefert an
//     denselben Elementen andere Endwerte (Protokoll unten, kein Vergleich).
//   · Gemessen wird per `getComputedStyle` an den REALEN Elementen: dem Begruendungshinweis (gefunden
//     ueber seinen Wortlaut), seinem Band (Elternelement) und den drei Aktionsknoepfen darin (ueber
//     ihren sichtbaren Text). Der Beleg ist der SELEKTOR: fuer jedes Element wird ein CSS-Pfad in der
//     Seite erzeugt und rueckwaerts aufgeloest — `document.querySelector(pfad)` muss dasselbe Element
//     liefern. Selektor, Sollwert, Istwert und Quelle stehen je Wert im Protokoll.
//
// EIN VERGLEICH JE WERT — sonst nichts. Keine Kalibrier-Pins auf Token, keine Gegenmutationen in der
// Datei, keine doppelte Messung: jede aeussere Mutation (Direktwert in `Validation.tsx`, Token in
// `themes.css`, Knopfradius in `tailwind.config.ts`) trifft genau den einen Fall, dessen Name den Wert
// traegt. Die aeusseren Laeufe stehen in der Arbeitsspur des Durchgangs (je Mutation `./tools/build`,
// Lauf, Ruecknahme, hashgleich).
//
// VOLLSTAENDIG, NICHT STILL: Jeder sichtbare Wert des Zielbild-Fussbands (Z.56–63) steht unten —
// neun als Vergleich, sieben als OFFENER Wert mit fachlicher Begruendung, an denselben realen
// Elementen gemessen und protokolliert, nicht als gleich behauptet.
//
// SOLLWERTE: aus der Vorlage gelesen und OHNE Renderer kanonisiert (Hex → `rgb(r, g, b)`, `px` bleibt);
// `margin-left: auto` (Rechtsbuendigkeit) wird als Kante gemessen, weil ein Flex-Layout `auto` zu einem
// Pixelwert aufloest.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import { buildApp, buildServices } from "../../services/app/src/build-app";

const WURZEL = resolve(process.cwd());
const DIST = resolve(WURZEL, "apps/web/dist");
const ZIELBILD =
  "/Users/peterkohnert/Documents/Projekt_klarwerk/DESIGN_ZIELBILD_20260827/Validierung.dc.html";
const ORIGIN = "http://klarwerk.test";
const HINWEIS_TEXT = "* Rückfrage und Ablehnung brauchen eine Begründung.";

// ---- Das Zielbild: Fussband Z.56–63 der Vorlage ---------------------------------------------------
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
/** Hex → `rgb(r, g, b)` (die Serialisierung von getComputedStyle); alles andere unveraendert. */
function kanon(wert: string | null): string | null {
  if (wert === null) return null;
  const m = /^#([0-9a-f]{6})$/i.exec(wert.trim());
  if (!m) return wert.trim();
  const h = m[1] ?? "";
  return `rgb(${Number.parseInt(h.slice(0, 2), 16)}, ${Number.parseInt(h.slice(2, 4), 16)}, ${Number.parseInt(h.slice(4, 6), 16)})`;
}
const Z_BAND = "padding: 14px 24px; background: #FAF8F5; border-top";
const Z_FREIGEBEN = "background: #116B3C";
const Z_RUECKFRAGE = "border-radius: 9px; font-size: 13.5px; color: #1A2233";
const Z_ABLEHNEN = "color: #B3372B";
const Z_HINWEIS = "margin-left: auto; font-size: 11.5px; color: #525B6B";

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
let hairlineWurzel = "";

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
/** In der Seite: die realen Elemente des Fussbands finden und ihre Selektoren zurueckgeben. */
const ELEMENTE = `([hinweisText, pfadFnSrc]) => {
  const pfad = eval('(' + pfadFnSrc + ')');
  const hinweis = [...document.querySelectorAll('p')].find((p) => (p.textContent || '').trim() === hinweisText);
  if (!hinweis) return null;
  const band = hinweis.parentElement;
  const knopf = (text) => [...band.querySelectorAll('button')].find((b) => (b.textContent || '').replace(/\\*/g, '').trim() === text) || null;
  const out = { hinweis: pfad(hinweis), band: pfad(band), freigeben: null, rueckfrage: null, ablehnen: null };
  const f = knopf('Freigeben'), r = knopf('Rückfrage'), a = knopf('Ablehnen');
  if (f) out.freigeben = pfad(f);
  if (r) out.rueckfrage = pfad(r);
  if (a) out.ablehnen = pfad(a);
  // Rueckwaerts aufgeloest: jeder Pfad liefert genau das gefundene Element.
  out.aufgeloest = document.querySelector(out.hinweis) === hinweis && document.querySelector(out.band) === band
    && (!f || document.querySelector(out.freigeben) === f);
  return out;
}`;
const LESEN =
  "([sel, eig]) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).getPropertyValue(eig) : null; }";
const KANTEN =
  "([bandSel, hinweisSel]) => { const b = document.querySelector(bandSel).getBoundingClientRect(); const h = document.querySelector(hinweisSel).getBoundingClientRect(); return { bandRechts: b.right, hinweisRechts: h.right, hinweisLinksAbstand: h.left - b.left }; }";

interface Selektoren {
  hinweis: string;
  band: string;
  freigeben: string | null;
  rueckfrage: string | null;
  ablehnen: string | null;
  aufgeloest: boolean;
}
let sel: Selektoren | null = null;

function distDatei(pfadname: string): { body: Buffer; typ: string } {
  const rel = pfadname === "/" ? "/index.html" : pfadname;
  const datei = join(DIST, rel);
  if (existsSync(datei) && statSync(datei).isFile()) {
    return { body: readFileSync(datei), typ: MIME[extname(datei)] ?? "application/octet-stream" };
  }
  // SPA: jeder Seitenpfad bekommt index.html
  return { body: readFileSync(join(DIST, "index.html")), typ: MIME[".html"] ?? "text/html" };
}

describe("JOB 2618 · D5 · das Fussband der Validierung — die echte Seite, gemountet in Chromium (Theme modern, ausdruecklich gesetzt)", () => {
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
        payload: { name: "Pedi", email: "pedi@job2618.test", password: "geheim12345" },
      });
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "pedi@job2618.test", password: "geheim12345" },
      });
      const token = (login.json() as { token: string }).token;
      const me = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { authorization: `Bearer ${token}` },
      });
      const autorId = (me.json() as { id: string }).id;
      // Ein echtes Wissensobjekt im Board (status "offen" bei Anlage) — die Karte, an der das Band haengt.
      await services.ko.create({
        title: "Project equipment design guide Rev. 0.91",
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
      version = browser.version();
      seite = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      // Der Theme-Schalter des Produkts, VOR dem ersten Skript gesetzt — so wie ein Nutzer, der
      // „Modern" gewaehlt hat und die Seite neu laedt (initDesignTheme liest genau diesen Schluessel).
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
      theme = await seite.evaluate<string>(
        fn(
          `() => document.documentElement.getAttribute('data-theme') || 'classic (kein Attribut)'`,
        ),
      );
      hairlineWurzel = await seite.evaluate<string>(
        fn(
          `() => getComputedStyle(document.documentElement).getPropertyValue('--kw-hairline').trim()`,
        ),
      );
      sel = await seite.evaluate<Selektoren | null>(fn(ELEMENTE), [HINWEIS_TEXT, PFAD_FN]);
      console.info(
        `JOB 2618 D5 · Chromium ${version} · ${ORIGIN}/validierung · Theme ${theme} · --kw-hairline ${hairlineWurzel} · Selektoren ${JSON.stringify(sel)}`,
      );
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 3).join(" | ");
    }
  }, 120_000);

  // JOB 2935 D1 — EIN HOOK-TIMEOUT, KEINE MESSUNG. Diese Suite lief einzeln gruen, im GESAMTTOR aber
  // rot: „Hook timed out in 10000ms". Der Abbruch traf das Aufraeumen, nicht einen Vergleich —
  // `browser.close()` und `app.close()` brauchen unter der Last von rund 1190 gleichzeitigen
  // Testdateien laenger als die zehn Sekunden, die vitest einem Hook ohne eigene Angabe gibt.
  // Nachgemessen am Startpin 6d574fce, also OHNE die Aenderungen dieses Durchgangs: derselbe
  // Fehlschlag (Arbeitsspur `vollauf-ohne-neuen-test.txt`). Die Zeit hier hebt nur diese Grenze an;
  // an Sollwerten, Selektoren und Vergleichen aendert sie nichts.
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

  it("S · die echte Seite steht: Theme modern gesetzt und wirksam, reale Elemente gefunden, Selektoren rueckwaerts aufloesbar", () => {
    expect(fehler).toBeNull();
    expect(theme).toBe("modern");
    // Kein Pin auf den Tokenwert (der gehoert V4 allein) — nur: das Theme traegt ueberhaupt ein Token.
    expect(hairlineWurzel).not.toBe("");
    expect(sel?.aufgeloest).toBe(true);
    expect(sel?.band).toMatch(/^body > /);
  });

  // ---- die neun Vergleiche: ein Fall je Wert, an den realen Elementen --------------------------
  it("V1 · band-knopfabstand 10px — gap am realen Band", async () => {
    expect(await messen(sel?.band, "gap")).toBe(kanon(zielProp(zielStil(ziel, Z_BAND), "gap")));
  });
  it("V2 · band-oberabstand 14px — padding-top am realen Band", async () => {
    expect(await messen(sel?.band, "padding-top")).toBe(
      kanon(zielProp(zielStil(ziel, Z_BAND), "padding")?.split(" ")[0] ?? null),
    );
  });
  it("V3 · band-trennlinie 1px — border-top-width am realen Band", async () => {
    expect(await messen(sel?.band, "border-top-width")).toBe("1px");
  });
  it("V4 · band-trennlinie-farbe #E9E5DE (Token border-hairline → --kw-hairline modern) — border-top-color am realen Band", async () => {
    expect(await messen(sel?.band, "border-top-color")).toBe(kanon("#E9E5DE"));
  });
  it("V5 · knopf-radius 9px (Token rounded-btn → borderRadius.btn) — border-radius am realen Freigeben-Knopf", async () => {
    expect(await messen(sel?.freigeben, "border-radius")).toBe(
      kanon(zielProp(zielStil(ziel, Z_RUECKFRAGE), "border-radius")),
    );
  });
  it("V6 · knopf-gewicht 600 — font-weight am realen Freigeben-Knopf", async () => {
    expect(await messen(sel?.freigeben, "font-weight")).toBe(
      kanon(zielProp(zielStil(ziel, Z_FREIGEBEN), "font-weight")),
    );
  });
  it("V7 · hinweis-schriftgrad 11.5px (Direktwert text-[11.5px]) — font-size am realen Hinweis", async () => {
    expect(await messen(sel?.hinweis, "font-size")).toBe(
      kanon(zielProp(zielStil(ziel, Z_HINWEIS), "font-size")),
    );
  });
  it("V8 · hinweis-farbe #525B6B (Token text-muted-2 → --kw-muted-2 modern) — color am realen Hinweis", async () => {
    expect(await messen(sel?.hinweis, "color")).toBe(
      kanon(zielProp(zielStil(ziel, Z_HINWEIS), "color")),
    );
  });
  it("V9 · hinweis-rechtsbuendig (sm:ml-auto) — der reale Hinweis schliesst mit der rechten Bandkante ab", async () => {
    expect(fehler).toBeNull();
    const k = await (seite as Seite).evaluate<{
      bandRechts: number;
      hinweisRechts: number;
      hinweisLinksAbstand: number;
    }>(fn(KANTEN), [sel?.band, sel?.hinweis]);
    expect(Math.abs(k.bandRechts - k.hinweisRechts)).toBeLessThan(2);
    expect(k.hinweisLinksAbstand).toBeGreaterThan(200);
  });

  // ---- die sieben offenen Werte: gemessen an den realen Elementen, begruendet, nicht behauptet --
  const OFFEN: [string, () => Promise<string | null>, string, string][] = [
    [
      "band-grund #FAF8F5",
      () => messen(sel?.band, "background-color"),
      kanon(zielProp(zielStil(ziel, Z_BAND), "background")) ?? "",
      "das Produktband traegt keine Flaechenklasse (erbt die Karte); Flaechenklasse = Produktumbau, nicht beauftragt",
    ],
    [
      "knopf-schriftgrad 13.5px",
      () => messen(sel?.freigeben, "font-size"),
      kanon(zielProp(zielStil(ziel, Z_FREIGEBEN), "font-size")) ?? "",
      "Produkt text-[12.5px] (SCRUM-258, kompakte Entscheidungsknoepfe); Produktumbau",
    ],
    [
      "knopf-hoehe (Vorlage: Polster 9px 18px)",
      () => messen(sel?.freigeben, "height"),
      "9px 18px (Polster)",
      "Produkt h-9 = 36px feste Hoehe, px-2.5 = 10px seitlich; Produktumbau",
    ],
    [
      "freigeben-grund #116B3C",
      () => messen(sel?.freigeben, "background-color"),
      kanon(zielProp(zielStil(ziel, Z_FREIGEBEN), "background")) ?? "",
      "Produkt toent (bg-trust-pos-bg), Vorlage fuellt — Ownerfrage SCRUM-258",
    ],
    [
      "freigeben-schrift #FFFFFF",
      () => messen(sel?.freigeben, "color"),
      kanon(zielProp(zielStil(ziel, Z_FREIGEBEN), "color")) ?? "",
      "Folge der Toenung (text-trust-pos-text); dieselbe Ownerfrage",
    ],
    [
      "freigeben-symbolabstand 7px",
      () => messen(sel?.freigeben, "gap"),
      kanon(zielProp(zielStil(ziel, Z_FREIGEBEN), "gap")) ?? "",
      "Produkt gap-1.5 = 6px; ein Pixel, Produktumbau",
    ],
    [
      "ablehnen-schrift #B3372B",
      () => messen(sel?.ablehnen, "color"),
      kanon(zielProp(zielStil(ziel, Z_ABLEHNEN), "color")) ?? "",
      "Produkt text-trust-crit-text (#A12626 modern); Vorlagen-Rot existiert in themes.css nicht — Palettenfrage",
    ],
  ];
  for (const [name, lesen, soll, grund] of OFFEN) {
    it(`OFFEN · ${name} — gemessen am realen Element, begruendet`, async () => {
      const ist = await lesen();
      expect(ist, "reales Element liefert keinen Wert").not.toBeNull();
      console.info(
        `JOB 2618 D5 · OFFEN · ${name}: Zielbild ${soll} · Seite (modern) ${ist} · ${ist === soll ? "GLEICH" : "abweichend"} · ${grund}`,
      );
    });
  }

  it("KLASSISCH · Protokoll: derselbe Aufbau ohne Umschalter (heutiger Standard) — Trennlinie, Hinweisfarbe, Gesichert-Gruen an denselben Selektoren", async () => {
    expect(fehler).toBeNull();
    const s = seite as Seite;
    // Der Umschalter des Produkts, in der laufenden Seite auf klassisch gestellt (dasselbe Attribut, das initDesignTheme setzt).
    await s.evaluate(fn(`() => document.documentElement.removeAttribute('data-theme')`));
    const linie = await s.evaluate<string | null>(fn(LESEN), [sel?.band, "border-top-color"]);
    const farbe = await s.evaluate<string | null>(fn(LESEN), [sel?.hinweis, "color"]);
    const gruen = await s.evaluate<string | null>(fn(LESEN), [sel?.freigeben, "color"]);
    await s.evaluate(fn(`() => document.documentElement.setAttribute('data-theme', 'modern')`));
    console.info(
      `JOB 2618 D5 · KLASSISCH · Trennlinie ${linie} (Zielbild ${kanon("#E9E5DE")}) · Hinweisfarbe ${farbe} (Zielbild ${kanon("#525B6B")}) · Gesichert ${gruen}`,
    );
    expect(linie).not.toBeNull();
  });
});

describe.runIf(!existsSync(ZIELBILD))("JOB 2618 · Zielbild-Abgleich uebersprungen", () => {
  it("meldet den fehlenden Kontrollordner statt eine Pruefung vorzutaeuschen", () => {
    expect(existsSync(ZIELBILD), `Zielbild nicht lesbar: ${ZIELBILD}`).toBe(false);
  });
});
