// ================================================================================================
// LADEFEHLER-ALTER-TAB · DIE ABNAHME AUS DEM ORIGINALAUFTRAG, IN DER ECHTEN GEBAUTEN APP.
// ================================================================================================
//
// Der Originalpunkt verlangt wörtlich: „gemountet — alter Tab über eine Veröffentlichung hinweg
// (Chunk-URL 404 simuliert), Navigation auf /admin und /bibliothek → Hinweiskarte statt Fehlerkarte;
// Klick lädt neu; mit ungesicherter Eingabe im Entwurf erscheint die Rückfrage und die Eingabe
// bleibt". `pedis-fall-chromium.test.ts` belegt denselben Weg nur für /duplikate, die jsdom-Fälle
// A1–A9 nur an einer allgemeinen Fehlergrenze. Hier laufen die beiden genannten Routen und eine
// ECHTE Eingabe in das Blatt — Bauart wörtlich wie `pedis-fall-chromium.test.ts` (gebaute App aus
// `apps/web/dist`, `/api/*` an die echte Fastify-App, Chunk antwortet 404 `text/plain`).
//
// R1  /bibliothek über den Kopfbandpunkt: ruhige Karte statt generischer, kein Selbst-Neuladen;
//     „Neu laden" lädt GENAU EINMAL neu, und nach dem Neuladen (neuer Stand ausgeliefert) steht die
//     Bibliothek ohne Karte.
// R2  /admin über „Arbeitsbereiche" → „Verwaltung": ruhige Karte statt generischer, kein Neuladen.
// R3  Ungesicherte Eingabe im Blatt, dann Klick auf „Bibliothek" (Chunk 404): erst die Rückfrage;
//     „Hier bleiben" hält Adresse und getippten Text, nichts lädt neu. Erst „Verwerfen und wechseln"
//     führt zur ruhigen Karte.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import { buildApp, buildServices } from "../../services/app/src/build-app";

const WURZEL = resolve(process.cwd());
const DIST = resolve(WURZEL, "apps/web/dist");
const ORIGIN = "http://localhost";
const ENTWURF = "Ungesicherte Eingabe im alten Tab, die nicht verloren gehen darf.";

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
  waitForFunction(f: string, arg?: unknown, opts?: Record<string, unknown>): Promise<unknown>;
  waitForEvent(name: string, opts?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(f: string): Promise<T>;
  click(selector: string, opts?: Record<string, unknown>): Promise<void>;
  fill(selector: string, text: string): Promise<void>;
  close(): Promise<void>;
}
interface Browser {
  newPage(opts?: Record<string, unknown>): Promise<Seite>;
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

/** Das Stück einer Seite im gebauten Stand — gesucht, nicht geraten (wie `duplikateStueck`). */
function stueck(name: string): string {
  const treffer = readdirSync(join(DIST, "assets")).filter((n) =>
    new RegExp(`^${name}-[\\w-]+\\.js$`).test(n),
  );
  if (treffer.length !== 1) {
    throw new Error(
      `Genau ein Stück „${name}-*.js" erwartet, gefunden: ${treffer.length} (${treffer.join(", ")}).`,
    );
  }
  return `/assets/${treffer[0]}`;
}

const KARTE_DA = `document.querySelector('[data-testid="ladefehler-neue-version"]') !== null ||
  document.querySelector('h2.text-trust-crit-text') !== null`;

interface Flaeche {
  ruhigeKarte: boolean;
  generischeKarte: boolean;
  dialog: boolean;
  text: string;
  adresse: string;
  /** "alt", solange dieselbe Seite steht; undefined nach einem Neuladen. */
  marke: string | null;
  entwurf: string | null;
}

const LIES_FLAECHE = `(() => {
  const feld = document.querySelector('[role="textbox"][aria-label="Wissensseite — Fließtext"]');
  return {
    ruhigeKarte: document.querySelector('[data-testid="ladefehler-neue-version"]') !== null,
    generischeKarte: document.querySelector("h2.text-trust-crit-text") !== null,
    dialog: document.querySelector("[data-navguard-dialog]") !== null,
    text: (document.body.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 600),
    adresse: location.pathname,
    marke: typeof window.__tabMarke === "string" ? window.__tabMarke : null,
    entwurf: feld ? (feld.textContent || "") : null,
  };
})()`;

let browser: Browser | null = null;
let starte: (() => Promise<Browser>) | null = null;
let app: ReturnType<typeof buildApp> | null = null;
let token = "";
let aufbaufehler: string | null = null;
let admin = "";
let bibliothek = "";

beforeAll(async () => {
  try {
    if (!existsSync(join(DIST, "index.html"))) {
      throw new Error("apps/web/dist fehlt — vorher ./tools/build (im Tor laeuft es immer)");
    }
    admin = stueck("Admin");
    bibliothek = stueck("Library");

    app = buildApp(buildServices());
    await app.ready();
    // Erstes Konto = Admin (`services/auth/src/service.ts:245-249`): /admin ist sichtbar.
    const post = `pedi+${Math.random().toString(36).slice(2, 8)}@ladefehler.test`;
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
    token = (login.json() as { token: string }).token;
    await app.inject({
      method: "POST",
      url: "/api/auth/notice",
      headers: { authorization: `Bearer ${token}` },
    });

    const verlangeModul = createRequire(import.meta.url);
    const { chromium } = verlangeModul("playwright") as {
      chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
    };
    // JE FALL EIN EIGENER BROWSER. Mit `--single-process` beendet das Schliessen der letzten Seite
    // den ganzen Chromium (gemessen, nacharbeit-3: R1 grün, danach `browser.newPage: Target page,
    // context or browser has been closed` in R2/R3). Ein frischer Browser je Fall ist zugleich der
    // ehrlichere „alte Tab": kein Zustand aus dem vorigen Fall reist mit.
    starte = () =>
      chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
      });
  } catch (e) {
    aufbaufehler = String(e).split("\n").slice(0, 2).join(" | ");
  }
}, 240_000);

afterAll(async () => {
  await browser?.close();
  await app?.close();
}, 60_000);

/** Ein Tab, der vor der Veröffentlichung geöffnet wurde: die genannten Stücke antworten 404. */
async function alterTab(gesperrt: Set<string>): Promise<{ seite: Seite; geliefert: Set<string> }> {
  expect(aufbaufehler, "der Chromium-Prüfstand kam nicht zustande").toBeNull();
  if (starte === null || app === null) {
    throw new Error("Browserstart oder App fehlen");
  }
  const a = app;
  const geliefert = new Set<string>();
  browser = await starte();
  // Ohne Service Worker: sonst bediente er das Neuladen in R1 an `route` vorbei (Begründung
  // `playwright.smoke.config.ts`, `serviceWorkers: "block"`).
  const seite = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    serviceWorkers: "block",
  });
  await seite.route(`${ORIGIN}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (gesperrt.has(url.pathname)) {
      await route.fulfill({ status: 404, contentType: "text/plain", body: "Not Found" });
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      const kopf: Record<string, string> = {};
      for (const [n, v] of Object.entries(req.headers())) {
        if (!["host", "origin", "referer", "cookie"].includes(n.toLowerCase())) kopf[n] = v;
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
    geliefert.add(url.pathname);
    const d = distDatei(url.pathname);
    await route.fulfill({ status: 200, body: d.body, contentType: d.typ });
  });
  await seite.goto(`${ORIGIN}/start`, { waitUntil: "load", timeout: 60_000 });
  await seite.waitForFunction(
    `document.querySelector('header[data-testid="kopfband"]') !== null`,
    undefined,
    { timeout: 30_000 },
  );
  // Die Marke lebt nur in DIESEM Dokument: jedes Neuladen löscht sie.
  await seite.evaluate<void>(`void (window.__tabMarke = "alt")`);
  return { seite, geliefert };
}

/** Schliesst den Browser DIESES Falls (nicht nur die Seite — s. `starte`). */
async function schliessen(): Promise<void> {
  const b = browser;
  browser = null;
  await b?.close();
}

const lies = (seite: Seite): Promise<Flaeche> => seite.evaluate<Flaeche>(LIES_FLAECHE);

function ruhigeKarteStatt(f: Flaeche, chunk: string, adresse: string): void {
  expect(f.ruhigeKarte, `statt der ruhigen Karte steht dort „${f.text.slice(0, 200)}"`).toBe(true);
  expect(f.generischeKarte, "die generische Fehlerkarte steht daneben").toBe(false);
  expect(f.adresse).toBe(adresse);
  expect(f.text, "die Chunk-Adresse gehört nicht vor den Menschen").not.toContain(chunk);
  expect(f.marke, "die Seite hat sich von selbst neu geladen").toBe("alt");
}

describe("LADEFEHLER-ALTER-TAB · /admin, /bibliothek und ungesicherte Eingabe im echten Browser", () => {
  it("R1: /bibliothek mit Chunk-404 → ruhige Karte; „Neu laden“ lädt einmal und zeigt den neuen Stand", async () => {
    const gesperrt = new Set<string>([bibliothek]);
    const { seite, geliefert } = await alterTab(gesperrt);
    try {
      await seite.click('header a[data-kopfband-punkt="bibliothek"]');
      await seite.waitForFunction(KARTE_DA, undefined, { timeout: 30_000 });
      ruhigeKarteStatt(await lies(seite), bibliothek, "/bibliothek");

      // Die Veröffentlichung ist jetzt ausgeliefert: das neue Dokument bekommt sein Stück.
      gesperrt.clear();
      await Promise.all([
        seite.waitForEvent("load", { timeout: 60_000 }),
        seite.click('[data-testid="ladefehler-neue-version-neu-laden"]'),
      ]);
      await seite.waitForFunction(
        `document.querySelector('header[data-testid="kopfband"]') !== null`,
        undefined,
        { timeout: 30_000 },
      );
      const nachher = await lies(seite);
      expect(nachher.marke, "der Klick hat nicht neu geladen").toBeNull();
      expect(nachher.adresse).toBe("/bibliothek");
      expect(geliefert.has(bibliothek), "das Stück der Bibliothek wurde nie geladen").toBe(true);
      expect(nachher.ruhigeKarte, "nach dem Neuladen steht wieder die Karte").toBe(false);
      expect(nachher.generischeKarte).toBe(false);
    } finally {
      await schliessen();
    }
  }, 180_000);

  it("R2: /admin mit Chunk-404 → ruhige Karte statt generischer, nichts lädt von selbst", async () => {
    const { seite } = await alterTab(new Set<string>([admin]));
    try {
      await seite.click('[data-testid="kopfband-arbeitsbereiche"]');
      await seite.waitForFunction(
        `document.querySelector('[data-testid="bereich-admin"]') !== null`,
        undefined,
        { timeout: 30_000 },
      );
      await seite.click('[data-testid="bereich-admin"]');
      await seite.waitForFunction(KARTE_DA, undefined, { timeout: 30_000 });
      ruhigeKarteStatt(await lies(seite), admin, "/admin");
    } finally {
      await schliessen();
    }
  }, 180_000);

  it("R3: ungesicherte Eingabe → Rückfrage; „Hier bleiben“ hält den Text, erst Verwerfen zeigt die Karte", async () => {
    const { seite } = await alterTab(new Set<string>([bibliothek]));
    const feld = '[role="textbox"][aria-label="Wissensseite — Fließtext"]';
    try {
      await seite.click('header a[data-kopfband-punkt="erfassen"]');
      await seite.waitForFunction(`document.querySelector('${feld}') !== null`, undefined, {
        timeout: 30_000,
      });
      await seite.fill(feld, ENTWURF);

      await seite.click('header a[data-kopfband-punkt="bibliothek"]');
      await seite.waitForFunction(
        `document.querySelector("[data-navguard-dialog]") !== null`,
        undefined,
        { timeout: 30_000 },
      );
      const frage = await lies(seite);
      expect(frage.dialog, "ohne Rückfrage wäre der Klick ein stiller Verlust").toBe(true);
      expect(frage.adresse).toBe("/erfassen");

      await seite.click('[data-navguard-dialog] button:has-text("Hier bleiben")');
      await seite.waitForFunction(
        `document.querySelector("[data-navguard-dialog]") === null`,
        undefined,
        { timeout: 30_000 },
      );
      const geblieben = await lies(seite);
      expect(geblieben.adresse).toBe("/erfassen");
      expect(geblieben.entwurf, "die Eingabe ist nach „Hier bleiben“ weg").toContain(ENTWURF);
      expect(geblieben.marke, "„Hier bleiben“ hat neu geladen").toBe("alt");
      expect(geblieben.ruhigeKarte).toBe(false);

      await seite.click('header a[data-kopfband-punkt="bibliothek"]');
      await seite.waitForFunction(
        `document.querySelector("[data-navguard-dialog]") !== null`,
        undefined,
        { timeout: 30_000 },
      );
      await seite.click('[data-navguard-dialog] button:has-text("Verwerfen und wechseln")');
      await seite.waitForFunction(KARTE_DA, undefined, { timeout: 30_000 });
      ruhigeKarteStatt(await lies(seite), bibliothek, "/bibliothek");
    } finally {
      await schliessen();
    }
  }, 180_000);
});
