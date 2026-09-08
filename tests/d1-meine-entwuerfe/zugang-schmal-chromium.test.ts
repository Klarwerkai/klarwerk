// ================================================================================================
// JOB 3266 · D1 — DER ZUGANG IM ECHTEN BROWSER: 320, 360, 390 UND 1280 px, DE UND EN.
// ================================================================================================
//
// ZWEI BEFUNDE VON BEN, an derselben Fläche, in zwei Runden — und beide sieht man nur im Browser:
//
//   RUNDE 1 (390 px), wörtlich: „expected -237 to be greater than or equal to 0; Titelzeile liegt
//   bei x = −237, Breite 304 px." Die LAGE stimmte nicht: die Liste stand links ausserhalb des
//   Fensters. Behoben in `components/erfassen/Menue.tsx` (gemessener Ausgleich), gemessen hier von
//   `imFenster`.
//
//   RUNDE 2 (320 px), wörtlich: „expected 314 to be less than or equal to 262 … CSS:
//   whiteSpace: „nowrap", overflow: „ellipsis"." Die Lage stimmte jetzt, der TEXT war trotzdem
//   beschnitten — und zwar am Ende, wo zwei Entwürfe desselben Vorhabens sich unterscheiden.
//   Behoben in `components/erfassen/Blatt.tsx` (der Titel bricht um), gemessen hier von
//   `ganzLesbar`.
//
// DIE LEHRE, die beide Runden teilen: Ein vorhandener DOM-Knoten ist kein Beleg. Die gemounteten
// Fälle in `blatt-zugang-und-liste.test.tsx` finden die Titel — jsdom hat kein Layout, dort ist
// jedes Rechteck null, es bricht keine Werkzeugzeile um und kein Text wird gekürzt. Dieser
// Prüfstand ist deshalb der ZWEITE Messpunkt neben den gemounteten Wegen, nicht ihr Ersatz.
//
// AUFBAU: die ECHTE gebaute Anwendung aus `apps/web/dist` in Chromium, jeder `/api/*`-Aufruf an die
// ECHTE Fastify-App (`buildApp`) — dasselbe Muster wie `tests/design/h3-blatt-buehne.ts`. Kein
// Mock, kein Nachbau; die drei Entwürfe legt der echte Endpunkt mit dem echten Bearer an. EIN
// Browser, EINE Seite — die Tor-Last bleibt klein (gemessen 11,9 s für den ganzen Lauf).
//
// Je Fenster (320, 360, 390, 1280) und Sprache (de, en):
// M1    Adresse `?entwuerfe=1`, Maus und Tab/Enter — Fläche und Titelzeilen liegen im Fenster.
// M2    der Mausklick auf einen Titel öffnet GENAU diesen Entwurf (Kennung, Adresse, Inhalt).
// T     NUR die Tastatur — vom Werkzeug über die Titelzeile bis in den geladenen Entwurf.
// L     der TITELTEXT steht ganz da: nichts gekürzt, nichts abgeschnitten, die Enden unterscheidbar.
// Dazu einmalig:
// M3    der Weg von der Startseite bei 390 px: der Link liegt im Fenster, führt hin, Liste offen.
// K     KALIBRIERUNG: wird der gemessene Ausgleich in der Seite zurückgenommen, MUSS die Messung
//       rot werden — sonst misst sie nichts.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import { buildApp, buildServices } from "../../services/app/src/build-app";

const WURZEL = resolve(process.cwd());
const DIST = resolve(WURZEL, "apps/web/dist");
// `localhost` und nicht ein Phantasiename: nur dort führt Chromium einen sicheren Kontext, und
// ohne den gibt es kein `crypto.randomUUID` — die Begründung steht in `h3-blatt-buehne.ts`.
const ORIGIN = "http://localhost";

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
  ".mjs": "application/javascript",
};

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
  on(ereignis: string, handler: (arg: unknown) => void): void;
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  waitForFunction(f: BrowserFn, arg?: unknown, opts?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(f: BrowserFn, arg?: unknown): Promise<T>;
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  click(selector: string, opts?: Record<string, unknown>): Promise<void>;
  keyboard: { press(taste: string): Promise<void> };
}
interface Browser {
  version(): string;
  newPage(opts: Record<string, unknown>): Promise<Seite>;
  close(): Promise<void>;
}

function distDatei(pfadname: string): { body: Buffer; typ: string } {
  const rel = pfadname === "/" ? "/index.html" : pfadname;
  const datei = join(DIST, rel);
  if (existsSync(datei) && statSync(datei).isFile()) {
    return { body: readFileSync(datei), typ: MIME[extname(datei)] ?? "application/octet-stream" };
  }
  return { body: readFileSync(join(DIST, "index.html")), typ: MIME[".html"] ?? "text/html" };
}

// ================================================================================================
// DREI TITEL: ZWEI MIT GLEICHEM ANFANG UND VERSCHIEDENEM ENDE (bens Promptverbesserung zu R2),
// EINER OHNE JEDES LEERZEICHEN.
// ================================================================================================
// An einem kurzen Wort fiele weder ein Überlauf noch ein abgeschnittenes Ende auf. Und ein LANGER
// Titel allein genügt auch nicht: Wer die ersten dreissig Zeichen sieht, hält die Liste für
// eindeutig — bis zwei Entwürfe desselben Vorhabens nebeneinanderstehen. Genau dieser Fall wird
// hier gestellt: unterscheidbar sind die beiden erst an ihrem ENDE („Nord 2026" / „Süd 2026"), und
// das Ende ist es, was eine Kürzung mit Auslassungspunkten wegnimmt.
const ANFANG = "Freigabe Notfallplan Standort mit Fluchtwegen und Meldeketten — Ausgabe";
const TITEL_1 = `${ANFANG} Nord 2026`;
const TITEL_2 = `${ANFANG} Süd 2026`;
/**
 * Und der dritte Fall, den der Import wirklich erzeugt: EIN Wort ohne Leerzeichen — der Dateiname
 * eines übernommenen Dokuments. Ein gewöhnlicher Umbruch findet darin keine Stelle; nur
 * `overflow-wrap: break-word` bricht innerhalb des Wortes, statt es über den Rand zu schieben.
 */
const TITEL_3 = "Notfallplan_Standort_Nord_Ausgabe_2026_Freigabe_und_Meldeketten.docx";
const ALLE_TITEL = [TITEL_1, TITEL_2, TITEL_3];

let browser: Browser | null = null;
let app: ReturnType<typeof buildApp> | null = null;
let seite: Seite | null = null;
let fehler: string | null = null;
const seitenfehler: string[] = [];
let kennung1 = "";

/** Die Rechtecke der geöffneten Entwurfsliste, im Fenster gemessen. */
const MASSE = `() => {
  const flaeche = document.querySelector('[data-testid="blatt-menue-mehr"]');
  const zeilen = [...document.querySelectorAll('[data-testid="blatt-entwurf-eintrag"]')];
  const r = (el) => { const b = el.getBoundingClientRect(); return { links: b.left, rechts: b.right, breite: b.width, text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40) }; };
  return {
    fenster: document.documentElement.clientWidth,
    flaeche: flaeche ? r(flaeche) : null,
    zeilen: zeilen.map(r),
  };
}`;

interface Masse {
  fenster: number;
  flaeche: { links: number; rechts: number; breite: number; text: string } | null;
  zeilen: { links: number; rechts: number; breite: number; text: string }[];
}

// ================================================================================================
// DER LESBARKEITSMESSER (bens Korrekturpflicht zu Runde 2) — DER TITELTEXT SELBST.
// ================================================================================================
//
// BENS BEFUND, wörtlich: „Tatsächliche Titellesbarkeit: acht Fälle rot. Bei 320 px: expected 314 to
// be less than or equal to 262 … CSS: whiteSpace: „nowrap", overflow: „ellipsis"." Die Zeile LAG im
// Fenster (das misst `imFenster`) — der TEXT darin war trotzdem beschnitten. Eine Rechteckmessung
// kann das nicht sehen: das Kästchen sitzt richtig, nur der Inhalt passt nicht hinein.
//
// GEMESSEN WIRD DESHALB DER TEXTKNOTEN, und zwar an dem, was der Browser selbst über ihn weiss:
//   · `scrollWidth > clientWidth` heisst „es steht mehr da, als zu sehen ist" — waagerecht;
//   · `scrollHeight > clientHeight` dasselbe senkrecht (eine Kürzung auf eine Zeile mit fester Höhe
//     fiele sonst durch);
//   · `text-overflow: ellipsis` und `white-space: nowrap` sind die zwei Regeln, mit denen genau
//     diese Kürzung gemacht wird — sie werden benannt, damit die Meldung die Ursache nennt und
//     nicht nur die Wirkung.
// Und zusätzlich: die beiden ENDEN müssen wirklich unterschiedlich sichtbar sein.
const TITELMASSE = `() => {
  const zeilen = [...document.querySelectorAll('[data-testid="blatt-entwurf-eintrag"]')];
  return zeilen.map((z) => {
    const el = z.querySelector('[data-testid="blatt-entwurf-eintrag-titel"]') || z.firstElementChild;
    const stil = getComputedStyle(el);
    return {
      text: (el.textContent || '').replace(/\\s+/g, ' ').trim(),
      sichtbreite: el.clientWidth,
      textbreite: el.scrollWidth,
      sichthoehe: el.clientHeight,
      texthoehe: el.scrollHeight,
      umbruch: stil.whiteSpace,
      kuerzung: stil.textOverflow,
    };
  });
}`;

interface Titelmass {
  text: string;
  sichtbreite: number;
  textbreite: number;
  sichthoehe: number;
  texthoehe: number;
  umbruch: string;
  kuerzung: string;
}

/** Jeder Titel steht GANZ da — nichts ist abgeschnitten, und die Enden unterscheiden sich. */
function ganzLesbar(titel: Titelmass[], lage: string): void {
  expect(titel.length, `${lage}: nicht alle Titelzeilen gemessen`).toBe(ALLE_TITEL.length);
  for (const t of titel) {
    expect(
      t.textbreite,
      `${lage}: „${t.text}" ist waagerecht beschnitten (${t.textbreite} px Text auf ${t.sichtbreite} px Fläche, white-space=${t.umbruch}, text-overflow=${t.kuerzung})`,
    ).toBeLessThanOrEqual(t.sichtbreite + 1);
    expect(
      t.texthoehe,
      `${lage}: „${t.text}" ist senkrecht beschnitten (${t.texthoehe} px Text auf ${t.sichthoehe} px Fläche)`,
    ).toBeLessThanOrEqual(t.sichthoehe + 1);
    expect(t.kuerzung, `${lage}: „${t.text}" wird mit Auslassungspunkten gekürzt`).not.toBe(
      "ellipsis",
    );
  }
  // Die eigentliche Zusage an den Menschen: er kann sie auseinanderhalten, BEVOR er klickt.
  const enden = titel.map((t) => t.text.slice(-9));
  expect(new Set(enden).size, `${lage}: zwei Titel enden gleich (${enden.join(" | ")})`).toBe(
    ALLE_TITEL.length,
  );
  expect(titel.map((t) => t.text).sort()).toEqual([...ALLE_TITEL].sort());
}

/** Die Zusage in EINEM Satz: Fläche und jede Titelzeile liegen ganz im Fenster und tragen Breite. */
function imFenster(m: Masse, lage: string): void {
  expect(m.flaeche, `${lage}: die Entwurfsfläche steht nicht offen`).not.toBeNull();
  const f = m.flaeche as NonNullable<Masse["flaeche"]>;
  expect(
    f.links,
    `${lage}: die Fläche beginnt links ausserhalb (x=${f.links})`,
  ).toBeGreaterThanOrEqual(0);
  expect(
    f.rechts,
    `${lage}: die Fläche endet rechts ausserhalb (x=${f.rechts} von ${m.fenster})`,
  ).toBeLessThanOrEqual(m.fenster);
  expect(m.zeilen.length, `${lage}: keine Titelzeile in der Liste`).toBeGreaterThan(0);
  for (const z of m.zeilen) {
    expect(
      z.links,
      `${lage}: Titelzeile „${z.text}" beginnt bei x=${z.links}`,
    ).toBeGreaterThanOrEqual(0);
    expect(
      z.rechts,
      `${lage}: Titelzeile „${z.text}" endet bei x=${z.rechts} von ${m.fenster}`,
    ).toBeLessThanOrEqual(m.fenster);
    expect(
      z.breite,
      `${lage}: Titelzeile „${z.text}" ist nur ${z.breite} px breit`,
    ).toBeGreaterThan(120);
  }
}

/**
 * Fenster, Sprache und Adresse setzen.
 *
 * DIE SPRACHE GEHT ÜBER DEN SPEICHER DES PRODUKTS (`kw.sprache`, `lib/sprachwahl.ts`) — dieselbe
 * eine Stelle, aus der `i18n.ts` beim Start `lng` liest. Kein zweiter Weg und keine Attrappe.
 * Gelesen wird sie beim AUFBAU, also gilt eine Änderung erst mit der nächsten Fahrt; und der
 * Speicher gehört einer Herkunft, ist vor der ersten Fahrt (`about:blank`) also gar nicht
 * erreichbar. Deshalb: fahren, prüfen, bei Bedarf setzen und noch einmal fahren.
 */
async function stelle(breite: number, sprache: string, pfad: string): Promise<void> {
  const s = seite as Seite;
  await s.setViewportSize({ width: breite, height: 844 });
  await s.goto(`${ORIGIN}${pfad}`, { waitUntil: "load", timeout: 60_000 });
  const jetzt = await s.evaluate<string | null>(fn(`() => localStorage.getItem('kw.sprache')`));
  if (jetzt !== sprache) {
    await s.evaluate(fn(`(l) => { localStorage.setItem('kw.sprache', l); }`), sprache);
    await s.goto(`${ORIGIN}${pfad}`, { waitUntil: "load", timeout: 60_000 });
  }
  await s.waitForFunction(
    fn("(sel) => document.querySelector(sel) !== null"),
    '[data-testid="blatt"]',
    {
      timeout: 30_000,
    },
  );
  // Die Sprache gilt wirklich — sonst behauptete „DE/EN gemessen" nur den Dateinamen.
  const gesetzt = await s.evaluate<string>(
    fn(`() => document.documentElement.getAttribute('lang') || ''`),
  );
  expect(gesetzt, `die Sprachwahl griff nicht: ${breite}/${sprache}`).toBe(sprache);
}

beforeAll(async () => {
  try {
    if (!existsSync(join(DIST, "index.html"))) {
      throw new Error("apps/web/dist fehlt — vorher ./tools/build (im Tor laeuft es immer)");
    }
    app = buildApp(buildServices());
    await app.ready();
    const post = `pedi+${Math.random().toString(36).slice(2, 8)}@job3266.test`;
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Pedi", email: post, password: "geheim12345" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: post, password: "geheim12345" },
    });
    const token = (login.json() as { token: string }).token;
    const kopf = { authorization: `Bearer ${token}` };
    const eins = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: kopf,
      payload: {
        title: TITEL_1,
        statement: "Vor jedem Anlauf die Schmierstellen prüfen.",
        bodyHtml: "<p>Vor jedem Anlauf die Schmierstellen prüfen.</p>",
        type: "best_practice",
        category: "Anlage 1",
      },
    });
    kennung1 = (eins.json() as { id: string }).id;
    await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: kopf,
      payload: {
        title: TITEL_2,
        statement: "Bei Überdruck Ventil X schließen.",
        bodyHtml: "<p>Bei Überdruck Ventil X schließen.</p>",
        type: "best_practice",
        category: "Anlage 2",
      },
    });
    // Der dritte: ein übernommener Dateiname als Titel — ein Wort ohne Leerzeichen.
    await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: kopf,
      payload: {
        title: TITEL_3,
        statement: "Aus einem Dokument übernommen.",
        bodyHtml: "<p>Aus einem Dokument übernommen.</p>",
        type: "best_practice",
        category: "Anlage 3",
      },
    });

    const require = createRequire(import.meta.url);
    const { chromium } = require("playwright") as {
      chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
    };
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
    });
    seite = await browser.newPage({ viewport: { width: 390, height: 844 } });
    seite.on("pageerror", (e: unknown) => {
      seitenfehler.push(String(e).split("\n")[0] ?? "");
    });
    await seite.addInitScript(
      `try { localStorage.setItem("kw.designTheme", "modern"); } catch (e) {}`,
    );
    const a = app;
    await seite.route(`${ORIGIN}/**`, async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.pathname.startsWith("/api/")) {
        const k: Record<string, string> = {};
        for (const [n, v] of Object.entries(req.headers())) {
          if (!["host", "origin", "referer", "cookie"].includes(n.toLowerCase())) k[n] = v;
        }
        k.authorization = `Bearer ${token}`;
        const body = req.postData();
        const res = await a.inject({
          method: req.method() as "GET",
          url: url.pathname + url.search,
          headers: k,
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
  } catch (e) {
    fehler = String(e).split("\n").slice(0, 3).join(" | ");
  }
}, 180_000);

afterAll(async () => {
  await browser?.close();
  await app?.close();
}, 60_000);

describe("JOB 3266 R2 · der Zugang zu den eigenen Entwürfen im echten Chromium", () => {
  // 320 px ist das schmalste Maß, das dieses Haus misst (vgl. `tests/design`-Schmalfälle); 360 und
  // 390 px sind die Fenster aus bens Messung und dem Hinweis der Steuerung; 1280 px ist das
  // Zielbild. Was dazwischen liegt, liegt zwischen zwei grünen Messungen.
  for (const breite of [320, 360, 390, 1280]) {
    for (const sprache of ["de", "en"]) {
      it(`M1 · ${breite} px / ${sprache}: Adresse, Maus und Tab/Enter zeigen die Titel VOLLSTÄNDIG im Fenster`, async () => {
        expect(fehler, "Prüfstand nicht aufgebaut").toBeNull();
        const s = seite as Seite;

        // (a) DER WEG VON DER STARTSEITE: die Adresse mit dem Öffnungsbefehl.
        await stelle(breite, sprache, "/erfassen?entwuerfe=1");
        await s.waitForFunction(
          fn(
            `() => document.querySelectorAll('[data-testid="blatt-entwurf-eintrag"]').length === 3`,
          ),
          undefined,
          { timeout: 20_000 },
        );
        imFenster(await s.evaluate<Masse>(fn(MASSE)), `${breite}/${sprache} · Adresse`);

        // (b) DIE MAUS: zuklappen (Escape) und über das benannte Werkzeug wieder öffnen. Playwright
        // klickt nur, was wirklich sichtbar und erreichbar ist — der Klick selbst ist ein Beleg.
        await s.keyboard.press("Escape");
        await s.waitForFunction(
          fn(`() => document.querySelector('[data-testid="blatt-menue-mehr"]') === null`),
          undefined,
          { timeout: 10_000 },
        );
        await s.click('[data-testid="blatt-werkzeug-entwuerfe"]', { timeout: 15_000 });
        await s.waitForFunction(
          fn(
            `() => document.querySelectorAll('[data-testid="blatt-entwurf-eintrag"]').length === 3`,
          ),
          undefined,
          { timeout: 20_000 },
        );
        imFenster(await s.evaluate<Masse>(fn(MASSE)), `${breite}/${sprache} · Maus`);

        // (c) DIE TASTATUR: Fokus mit Tab bis auf das Werkzeug, Enter öffnet. Das kann nur ein
        // echter Browser — jsdom leitet aus „Enter" keinen Klick ab.
        await s.keyboard.press("Escape");
        await s.evaluate(fn("() => { document.body.focus(); }"));
        let getroffen = false;
        for (let i = 0; i < 60 && !getroffen; i++) {
          await s.keyboard.press("Tab");
          getroffen = await s.evaluate<boolean>(
            fn(
              `() => (document.activeElement || {}).getAttribute && document.activeElement.getAttribute('data-testid') === 'blatt-werkzeug-entwuerfe'`,
            ),
          );
        }
        expect(getroffen, `${breite}/${sprache}: Tab erreicht „Meine Entwürfe" nicht`).toBe(true);
        // Der Fokus ist auch SICHTBAR (globale `*:focus-visible`-Regel, index.css).
        const ring = await s.evaluate<string>(
          fn("() => getComputedStyle(document.activeElement).outlineStyle"),
        );
        expect(ring, `${breite}/${sprache}: kein sichtbarer Fokusring`).not.toBe("none");
        await s.keyboard.press("Enter");
        await s.waitForFunction(
          fn(
            `() => document.querySelectorAll('[data-testid="blatt-entwurf-eintrag"]').length === 3`,
          ),
          undefined,
          { timeout: 20_000 },
        );
        imFenster(await s.evaluate<Masse>(fn(MASSE)), `${breite}/${sprache} · Tastatur`);
      }, 120_000);

      it(`L · ${breite} px / ${sprache}: die Titel stehen GANZ da — kein abgeschnittenes Ende`, async () => {
        expect(fehler, "Prüfstand nicht aufgebaut").toBeNull();
        const s = seite as Seite;
        await stelle(breite, sprache, "/erfassen?entwuerfe=1");
        await s.waitForFunction(
          fn(
            `() => document.querySelectorAll('[data-testid="blatt-entwurf-eintrag"]').length === 3`,
          ),
          undefined,
          { timeout: 20_000 },
        );
        // Erst die Lage (sonst könnte ein Titel ausserhalb des Fensters „vollständig" sein), dann
        // der Text selbst.
        imFenster(await s.evaluate<Masse>(fn(MASSE)), `${breite}/${sprache} · Lesbarkeit`);
        ganzLesbar(await s.evaluate<Titelmass[]>(fn(TITELMASSE)), `${breite}/${sprache}`);
        // Und das Datum steht weiterhin an jeder Zeile — der Umbruch darf es nicht verdrängen.
        const daten = await s.evaluate<number>(
          fn(
            `() => document.querySelectorAll('[data-testid="blatt-entwurf-eintrag-datum"]').length`,
          ),
        );
        expect(daten, `${breite}/${sprache}: nicht jede Zeile nennt ihr Datum`).toBe(
          ALLE_TITEL.length,
        );
      }, 120_000);

      it(`M2 · ${breite} px / ${sprache}: der Klick auf den Titel öffnet GENAU diesen Entwurf`, async () => {
        expect(fehler, "Prüfstand nicht aufgebaut").toBeNull();
        const s = seite as Seite;
        await stelle(breite, sprache, "/erfassen?entwuerfe=1");
        await s.waitForFunction(
          fn(
            `(t) => [...document.querySelectorAll('[data-testid="blatt-entwurf-eintrag"]')].some((e) => (e.textContent || '').includes(t))`,
          ),
          TITEL_1,
          { timeout: 20_000 },
        );
        // Echte Maus auf die Titelzeile. Läge sie ausserhalb des Fensters, käme dieser Klick nicht
        // zustande — das ist bens Befund, an der Stelle gemessen, an der er auftrat.
        await s.click(`[data-entwurf="${kennung1}"]`, { timeout: 15_000 });
        await s.waitForFunction(fn(`(id) => location.search.includes('draft=' + id)`), kennung1, {
          timeout: 20_000,
        });
        // Das Laden ist ein SERVERWEG: die Adresse trägt die Kennung sofort, der Inhalt kommt mit
        // der Antwort. Gewartet wird deshalb darauf, dass das Blatt überhaupt einen Titel führt —
        // WELCHEN, ist die Zusage darunter und wird nicht erwartet, sondern verglichen.
        await s.waitForFunction(
          fn(
            `() => ((document.querySelector('[data-testid="blatt-titel"]') || {}).value || '').length > 0`,
          ),
          undefined,
          { timeout: 20_000 },
        );
        const titel = await s.evaluate<string>(
          fn(`() => (document.querySelector('[data-testid="blatt-titel"]') || {}).value || ''`),
        );
        expect(titel, `${breite}/${sprache}: der geöffnete Entwurf trägt einen anderen Titel`).toBe(
          TITEL_1,
        );
      }, 120_000);

      it(`T · ${breite} px / ${sprache}: NUR die Tastatur — vom Werkzeug bis in den geladenen Entwurf`, async () => {
        expect(fehler, "Prüfstand nicht aufgebaut").toBeNull();
        const s = seite as Seite;
        // Kein Öffnungsbefehl in der Adresse: dieser Weg beginnt am ruhenden Blatt und geht
        // ausschliesslich über Tab und Enter (bens Prüflücke 6 zu Runde 2).
        await stelle(breite, sprache, "/erfassen");
        await s.evaluate(fn("() => { document.body.focus(); }"));
        let amWerkzeug = false;
        for (let i = 0; i < 60 && !amWerkzeug; i++) {
          await s.keyboard.press("Tab");
          amWerkzeug = await s.evaluate<boolean>(
            fn(
              `() => (document.activeElement || {}).getAttribute && document.activeElement.getAttribute('data-testid') === 'blatt-werkzeug-entwuerfe'`,
            ),
          );
        }
        expect(amWerkzeug, `${breite}/${sprache}: Tab erreicht „Meine Entwürfe" nicht`).toBe(true);
        await s.keyboard.press("Enter");
        await s.waitForFunction(
          fn(
            `() => document.querySelectorAll('[data-testid="blatt-entwurf-eintrag"]').length === 3`,
          ),
          undefined,
          { timeout: 20_000 },
        );

        // Weiter mit Tab IN die Liste — und der Fokus muss dort auch sichtbar sein.
        let amTitel = false;
        for (let i = 0; i < 15 && !amTitel; i++) {
          await s.keyboard.press("Tab");
          amTitel = await s.evaluate<boolean>(
            fn(
              `(id) => { const a = document.activeElement; return !!a && a.getAttribute('data-entwurf') === id; }`,
            ),
            kennung1,
          );
        }
        expect(amTitel, `${breite}/${sprache}: Tab erreicht die Titelzeile nicht`).toBe(true);
        const ring = await s.evaluate<string>(
          fn("() => getComputedStyle(document.activeElement).outlineStyle"),
        );
        expect(ring, `${breite}/${sprache}: kein sichtbarer Fokusring an der Titelzeile`).not.toBe(
          "none",
        );

        await s.keyboard.press("Enter");
        await s.waitForFunction(fn(`(id) => location.search.includes('draft=' + id)`), kennung1, {
          timeout: 20_000,
        });
        await s.waitForFunction(
          fn(
            `() => ((document.querySelector('[data-testid="blatt-titel"]') || {}).value || '').length > 0`,
          ),
          undefined,
          { timeout: 20_000 },
        );
        const geladen = await s.evaluate<string>(
          fn(`() => (document.querySelector('[data-testid="blatt-titel"]') || {}).value || ''`),
        );
        expect(geladen, `${breite}/${sprache}: der Tastaturweg lädt einen anderen Entwurf`).toBe(
          TITEL_1,
        );
      }, 120_000);
    }
  }

  it("M3 · 390 px: der Weg von der Startseite ist sichtbar, anklickbar und endet in der offenen Liste", async () => {
    expect(fehler, "Prüfstand nicht aufgebaut").toBeNull();
    const s = seite as Seite;
    await s.setViewportSize({ width: 390, height: 844 });
    await s.goto(`${ORIGIN}/start`, { waitUntil: "load", timeout: 60_000 });
    await s.waitForFunction(
      fn("(sel) => document.querySelector(sel) !== null"),
      '[data-testid="h5-start-entwuerfe"]',
      { timeout: 30_000 },
    );
    const lage = await s.evaluate<{ links: number; rechts: number; fenster: number; tag: string }>(
      fn(
        `() => { const el = document.querySelector('[data-testid="h5-start-entwuerfe"]'); const b = el.getBoundingClientRect(); return { links: b.left, rechts: b.right, fenster: document.documentElement.clientWidth, tag: el.tagName }; }`,
      ),
    );
    expect(lage.tag).toBe("A");
    expect(lage.links, `der Startzugang beginnt bei x=${lage.links}`).toBeGreaterThanOrEqual(0);
    expect(lage.rechts).toBeLessThanOrEqual(lage.fenster);

    await s.click('[data-testid="h5-start-entwuerfe"]', { timeout: 15_000 });
    await s.waitForFunction(
      fn(`() => document.querySelectorAll('[data-testid="blatt-entwurf-eintrag"]').length === 3`),
      undefined,
      { timeout: 30_000 },
    );
    imFenster(await s.evaluate<Masse>(fn(MASSE)), "390 · von Start");
  }, 120_000);

  it("K · KALIBRIERUNG: wird der gemessene Ausgleich in der Seite zurückgenommen, ist die Messung rot", async () => {
    expect(fehler, "Prüfstand nicht aufgebaut").toBeNull();
    const s = seite as Seite;
    await stelle(390, "de", "/erfassen?entwuerfe=1");
    await s.waitForFunction(
      fn(`() => document.querySelectorAll('[data-testid="blatt-entwurf-eintrag"]').length === 3`),
      undefined,
      { timeout: 20_000 },
    );
    // Der Zustand von Runde 1, in der laufenden Seite wiederhergestellt: die Fläche hängt wieder
    // nur an `right-0` des umgebrochenen Werkzeugs.
    const vorher = await s.evaluate<string>(
      fn(
        `() => { const el = document.querySelector('[data-testid="blatt-menue-mehr"]'); const alt = el.style.transform; el.style.transform = 'none'; return alt; }`,
      ),
    );
    const ohne = await s.evaluate<Masse>(fn(MASSE));
    expect(
      (ohne.flaeche as NonNullable<Masse["flaeche"]>).links,
      "ohne Ausgleich läge die Fläche im Fenster — dann misst dieser Prüfstand nichts",
    ).toBeLessThan(0);
    // Zurückgesetzt, damit der nächste Fall auf dem echten Produktzustand misst.
    await s.evaluate(
      fn(
        `(alt) => { document.querySelector('[data-testid="blatt-menue-mehr"]').style.transform = alt; }`,
      ),
      vorher,
    );
    imFenster(await s.evaluate<Masse>(fn(MASSE)), "390 · nach Rücknahme der Kalibrierung");
  }, 120_000);

  it("P · die Seite hat während aller Messungen nichts geworfen", () => {
    expect(fehler, "Prüfstand nicht aufgebaut").toBeNull();
    expect(seitenfehler).toEqual([]);
  });
});
