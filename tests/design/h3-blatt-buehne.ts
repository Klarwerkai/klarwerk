// ================================================================================================
// JOB 3062 · H3 — DIE BÜHNE: die ECHTE gebaute Seite in Chromium, an der echten Fastify-App.
// ================================================================================================
//
// Diese Datei ist KEIN Test. Sie ist der gemeinsame Aufbau der drei H3-Messungen
// (`zielbild-h3-erfassen`, `zielbild-h3-kein-erklaertext`, `h3-funktionsinventar`) und folgt Zug um
// Zug dem abgenommenen Muster aus `tests/design/zielbild-validierung.test.ts`:
//
//   · Die ECHTE Anwendung aus `apps/web/dist` (Ergebnis von `./tools/build`) wird unter
//     `http://klarwerk.test/` geladen. Playwright bedient `/assets/*` und `index.html` aus `dist`
//     und reicht JEDEN `/api/*`-Aufruf an die ECHTE Fastify-App (`buildApp`) weiter — kein Mock,
//     kein Nachbau: React mountet das Blatt selbst.
//   · Das THEME wird ausdrücklich gesetzt (`localStorage["kw.designTheme"] = "modern"`), weil das
//     Mockup die Werkbank-Palette ist. Der klassische Standard liefert an denselben Elementen
//     andere Endwerte.
//   · `pageerror` wird gefangen und in `fehler` gemeldet — eine Seite, die beim Mounten wirft, darf
//     nicht als „gemessen" durchgehen.
//
// EIN echtes Wissensobjekt wird angelegt, damit die Fläche etwas zu zeigen hat, was sie im leeren
// Bestand nicht könnte: das Menü „Bereich" führt die Kategorien des BESTANDES, und „Beispiel
// ansehen" zeigt ein echtes Objekt. Ohne Bestand wäre beides ehrlich leer — und der
// Funktionsinventar-Test würde eine Lücke messen, die keine ist.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import { buildApp, buildServices } from "../../services/app/src/build-app";

export const WURZEL = resolve(process.cwd());
export const DIST = resolve(WURZEL, "apps/web/dist");
export const MOCKUP = "/Users/peterkohnert/klarwerk_steuerung/design/klarwerk/Erfassen.dc.html";
// ================================================================================================
// JOB 3062 R6 — WARUM DIE BÜHNE AUF `localhost` LÄUFT UND NICHT AUF EINEM PHANTASIENAMEN.
// ================================================================================================
//
// Bis R5 stand hier `http://klarwerk.test`. Der Name ist frei erfunden (die Seite kommt ohnehin aus
// `dist`, das Netz wird nie gefragt) — er hat aber eine Nebenwirkung, die in R6 zugeschlagen hat:
// Chromium führt eine solche Herkunft als NICHT SICHEREN Kontext, und in einem unsicheren Kontext
// gibt es `crypto.randomUUID` nicht. Genau die Funktion erzeugt den Vorgangsschlüssel jedes
// Speicher- und Einreichvorgangs (`lib/createOperation.ts`). Auf dieser Bühne scheiterte deshalb
// JEDER Schreibweg mit „crypto.randomUUID is not a function" — nicht das Produkt war kaputt, die
// Bühne war es.
//
// `localhost` ist für Chromium eine grundsätzlich vertrauenswürdige Herkunft (dieselbe Regel, unter
// der die App im Betrieb läuft: localhost in der Entwicklung, https im Betrieb). Die Bühne misst
// damit unter denselben Bedingungen wie das echte Produkt — und die Wirkungsnachweise in
// `h3-wirkung.test.ts` können den Schreibweg überhaupt erst betreten.
export const ORIGIN = "http://localhost";

/** Die Kategorie des angelegten Objekts — das Menü „Bereich" muss sie führen. */
export const BESTAND_KATEGORIE = "Konstruktion";

export type BrowserFn = (arg: unknown) => unknown;
/** Playwright serialisiert Funktionen; `new Function` hält den Quelltext frei von Bundler-Spuren. */
export const fn = (quelle: string): BrowserFn =>
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

export interface Seite {
  route(url: string, handler: (route: Route) => Promise<void>): Promise<void>;
  addInitScript(script: string): Promise<void>;
  on(ereignis: string, handler: (arg: unknown) => void): void;
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
  ".mjs": "application/javascript",
};

function distDatei(pfadname: string): { body: Buffer; typ: string } {
  const rel = pfadname === "/" ? "/index.html" : pfadname;
  const datei = join(DIST, rel);
  if (existsSync(datei) && statSync(datei).isFile()) {
    return { body: readFileSync(datei), typ: MIME[extname(datei)] ?? "application/octet-stream" };
  }
  // SPA: jeder Seitenpfad bekommt index.html
  return { body: readFileSync(join(DIST, "index.html")), typ: MIME[".html"] ?? "text/html" };
}

export interface Buehne {
  seite: Seite;
  schliessen: () => Promise<void>;
  version: string;
  theme: string;
  fehler: string | null;
  /** Alle `pageerror`-Meldungen der Seite — leer heisst: nichts geworfen. */
  seitenfehler: string[];
  /**
   * JOB 3062 R6 — DIE SERVERWAHRHEIT, direkt gefragt.
   *
   * bens Korrekturpflicht 1 verlangt den Nachweis „Kategorie nach Speichern, Neuladen und Absenden
   * über API/UI". Ein Blick auf die Fläche allein genügt dafür nicht: die Fläche kann den Wert
   * anzeigen, den sie selbst hält, auch wenn er nie beim Server ankam — genau dieser Fehler war der
   * Befund. Deshalb fragt der Test denselben Bestand, in den die Seite geschrieben hat, ohne den
   * Browser: dieselbe `buildApp`-Instanz, über `inject`.
   */
  frage: <T>(methode: string, url: string) => Promise<T>;
}

/**
 * JOB 3062 R6 — GESCRIPTETE ANTWORTEN, EINZELN UND BENANNT.
 *
 * Der Regelfall bleibt: JEDER `/api/*`-Aufruf geht an die ECHTE Fastify-App. Für genau die
 * Zustände, die im hermetischen Betrieb gar nicht entstehen KÖNNEN, darf ein Test die Antwort
 * vorgeben — sonst wäre die Zusage „das Blatt zeigt den Befund X" für X unprüfbar statt geprüft.
 *
 * Der Fall, um den es geht, ist `POST /api/knowledge/check`: ohne Modell gibt es dort keinen
 * Widerspruchs-Judge, und `checkKnowledge` antwortet deshalb IMMER `status: "pending"`
 * (`services/app/src/knowledge-check.ts`). „Das ist neu" und „könnte widersprechen" sind ohne
 * Modell also nicht erreichbar. Gescriptet wird die ANTWORT DES SERVERS, nicht das Verhalten des
 * Clients: gemessen wird weiterhin, was der echte Client daraus macht.
 */
export type Skript = Record<string, unknown>;

/**
 * Baut die Bühne auf und fährt sie an `pfad` (Vorgabe `/erfassen`). Wirft NICHT: ein Fehlschlag
 * steht in `fehler`, damit der Testfall ihn benennen kann statt in einem Hook zu sterben.
 */
export async function buehneAufbauen(
  pfad = "/erfassen",
  wartetAuf = '[data-testid="blatt"]',
  skript: Skript = {},
): Promise<Buehne> {
  const seitenfehler: string[] = [];
  let browser: Browser | null = null;
  let app: ReturnType<typeof buildApp> | null = null;
  const schliessen = async (): Promise<void> => {
    await browser?.close();
    await app?.close();
  };
  try {
    if (!existsSync(join(DIST, "index.html"))) {
      throw new Error("apps/web/dist fehlt — vorher ./tools/build (im Tor laeuft es immer)");
    }
    const services = buildServices();
    app = buildApp(services);
    await app.ready();
    const kennung = `pedi+${Math.random().toString(36).slice(2, 8)}@job3062.test`;
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Pedi", email: kennung, password: "geheim12345" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: kennung, password: "geheim12345" },
    });
    const token = (login.json() as { token: string }).token;
    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });
    const autorId = (me.json() as { id: string }).id;
    await services.ko.create({
      title: "Profile in Spritzzonen",
      statement:
        "Vollverschweisste Hohlprofile sind in Lebensmittel- und Spritzzonen zu vermeiden.",
      type: "best_practice",
      category: BESTAND_KATEGORIE,
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
    const version = browser.version();
    // 1280×800 wie das Mockup.
    const seite = await browser.newPage({ viewport: { width: 1280, height: 800 } });
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
        const geskriptet = skript[`${req.method()} ${url.pathname}`];
        if (geskriptet !== undefined) {
          await route.fulfill({
            status: 200,
            body: JSON.stringify(geskriptet),
            headers: { "content-type": "application/json" },
          });
          return;
        }
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
    await seite.goto(`${ORIGIN}${pfad}`, { waitUntil: "load", timeout: 60_000 });
    await seite.waitForFunction(fn("(sel) => document.querySelector(sel) !== null"), wartetAuf, {
      timeout: 30_000,
    });
    const theme = await seite.evaluate<string>(
      fn(`() => document.documentElement.getAttribute('data-theme') || 'classic (kein Attribut)'`),
    );
    const frage = async <T>(methode: string, u: string): Promise<T> => {
      const res = await a.inject({
        method: methode as "GET",
        url: u,
        headers: { authorization: `Bearer ${token}` },
      });
      return JSON.parse(res.body) as T;
    };
    return { seite, schliessen, version, theme, fehler: null, seitenfehler, frage };
  } catch (e) {
    return {
      seite: null as unknown as Seite,
      schliessen,
      version: "",
      theme: "",
      fehler: String(e).split("\n").slice(0, 3).join(" | "),
      seitenfehler,
      frage: () => Promise.reject(new Error("Bühne nicht aufgebaut")),
    };
  }
}

// ---- Sollwerte aus dem Mockup -------------------------------------------------------------------
//
// Gelesen wird das Mockup als TEXT und ohne Renderer: jeder `style="…"`-Block wird über einen Anker
// gefunden, die Eigenschaft daraus gezogen und kanonisiert (Hex → `rgb(r, g, b)`, die
// Serialisierung von `getComputedStyle`). Kein zweiter Zahlenbestand im Test.

export function mockup(): string {
  return existsSync(MOCKUP) ? readFileSync(MOCKUP, "utf8") : "";
}

export function zielStil(quelle: string, anker: string): string | null {
  const re = /style="([^"]*)"/g;
  for (let m = re.exec(quelle); m !== null; m = re.exec(quelle)) {
    if ((m[1] ?? "").includes(anker)) return m[1] ?? null;
  }
  return null;
}

/**
 * Die LETZTE Deklaration gewinnt — genau wie im Browser. Das Blatt des Mockups (Z.46) nennt
 * `border-radius` zweimal: erst `14px`, dann `14px 14px 0 0`. Ein Leser, der die erste nimmt,
 * misst gegen einen Wert, den kein Browser je darstellt.
 */
export function zielProp(stil: string | null, eigenschaft: string): string | null {
  if (stil === null) return null;
  const re = new RegExp(`(?:^|[;\\s])${eigenschaft}\\s*:\\s*([^;]+)`, "g");
  let letzter: string | null = null;
  for (let m = re.exec(stil); m !== null; m = re.exec(stil)) {
    letzter = (m[1] ?? "").trim();
  }
  return letzter;
}

/**
 * Mockup-Schreibweise eines Schattens → die Serialisierung von `getComputedStyle`:
 * `0 1px 2px rgba(…)` wird zu `rgba(…) 0px 1px 2px 0px`. Ohne diese Umschrift verglichen wir
 * zwei Schreibweisen desselben Werts und nicht den Wert.
 */
export function schattenKanon(wert: string | null): string | null {
  if (wert === null) return null;
  return wert
    .split(/,(?![^()]*\))/)
    .map((teil) => {
      const farbe = /rgba?\([^)]*\)/.exec(teil)?.[0] ?? "";
      const zahlen = teil
        .replace(farbe, "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((z) => (z === "0" ? "0px" : z));
      while (zahlen.length < 4) {
        zahlen.push("0px");
      }
      return `${farbe} ${zahlen.join(" ")}`;
    })
    .join(", ");
}

/** Hex → `rgb(r, g, b)`; alles andere unverändert. */
export function kanon(wert: string | null): string | null {
  if (wert === null) return null;
  const m = /^#([0-9a-f]{6})$/i.exec(wert.trim());
  if (!m) return wert.trim();
  const h = m[1] ?? "";
  return `rgb(${Number.parseInt(h.slice(0, 2), 16)}, ${Number.parseInt(h.slice(2, 4), 16)}, ${Number.parseInt(h.slice(4, 6), 16)})`;
}

/**
 * Tailwind setzt `box-shadow` immer als DREI Lagen: `--tw-ring-offset-shadow`, `--tw-ring-shadow`
 * und den eigentlichen Schatten. Sind Ring und Ring-Offset aus, stehen die ersten beiden als
 * `rgba(0, 0, 0, 0) 0px 0px 0px 0px` in der berechneten Angabe — vollständig durchsichtig und ohne
 * Ausdehnung, sie malen also nichts. Sie werden hier entfernt, damit der Vergleich den SICHTBAREN
 * Schatten misst und nicht die Bauart der Utility-Bibliothek.
 *
 * Ein Ring, der wirklich an ist, überlebt diesen Filter (er ist weder durchsichtig noch nullgross)
 * und würde den Vergleich zu Recht rot machen.
 */
export function schattenSichtbar(wert: string | null): string | null {
  if (wert === null) return null;
  return wert
    .split(/,(?![^()]*\))/)
    .map((t) => t.trim())
    .filter((t) => !/^rgba\(\s*0,\s*0,\s*0,\s*0\)\s+0px\s+0px\s+0px\s+0px$/.test(t))
    .join(", ");
}

/** In der Seite: `getComputedStyle(el)[eigenschaft]` über einen Selektor. */
export const LESEN =
  "([sel, eig]) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).getPropertyValue(eig) : null; }";

/** In der Seite: die Breite eines Elements (Randmaß). */
export const BREITE =
  "(sel) => { const el = document.querySelector(sel); return el ? el.getBoundingClientRect().width : null; }";

/** In der Seite: den sichtbaren Text eines Werkzeugs finden und seinen Selektor liefern. */
export const KNOPF_MIT_TEXT = `([wurzelSel, text]) => {
  const wurzel = document.querySelector(wurzelSel) || document;
  const treffer = [...wurzel.querySelectorAll('button, a, [role=menuitem], summary')]
    .find((b) => (b.textContent || '').replace(/\\s+/g, ' ').trim() === text);
  return treffer ? true : false;
}`;
