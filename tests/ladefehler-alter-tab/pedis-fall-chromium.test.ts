// ================================================================================================
// JOB 3423 · NAVIGATION-CHUNK-STAND — PEDIS FALL, GANZ, IN DER ECHTEN GEBAUTEN APP.
// ================================================================================================
//
// DER FALL (Pedi, 09.09.2026 20:4x, Kanalnachricht 9fd43ca7): App seit Stunden offen, dazwischen
// wurde veröffentlicht, Klick auf „Duplikate". Statt der ruhigen Neu-laden-Karte stand die rote
// Karte da — „This view could not be loaded … Failed to fetch dynamically imported module:
// https://app.klarwerk.ai/assets/Duplicates-CIbJ3zEu.js". Codex' Auslieferungsbefund (20:47,
// 266e12e2): genau dieses Stück antwortet HTTP 404 mit `text/plain`, während `GET /` auf einen
// anderen Namen verweist. Der Tab hält einen alten Stand — der Normalzustand nach einer
// Veröffentlichung.
//
// WARUM DIESER PRÜFSTAND UND NICHT NUR DER GEMOUNTETE FALL A3. `ladefehler-zeigt-neue-version.test.tsx`
// (A3) baut den Weg in jsdom nach: `lazy()` → `<Suspense>` → Fehlergrenze. Er beweist damit den
// AUFBAU, aber drei Dinge kann er nicht sehen, und in genau diesen dreien steckte Pedis Fall:
//   · das Fehlerobjekt stammt vom Test, nicht vom Browser (jsdom lädt keine Modul-Skripte);
//   · der ausgelieferte Code läuft durch Vites `__vitePreload`-Hülle, nicht durch das nackte
//     `import()` der Quelle (`apps/web/node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js:64801-64864`);
//   · zwischen Klick und Karte liegen im Produkt der Router, `Guarded` und die Rollenprüfung.
//
// WAS HIER LÄUFT: die ECHTE gebaute Anwendung aus `apps/web/dist` in einem echten Chromium, jeder
// `/api/*`-Aufruf an die ECHTE Fastify-App — dieselbe Bauart wie `tests/design/h1-chromium.ts` und
// `tests/d1-meine-entwuerfe/zugang-schmal-chromium.test.ts`. Der EINZIGE Unterschied zur normalen
// Auslieferung: das Stück der Duplikate-Seite antwortet 404 mit `text/plain`, wörtlich wie Codex es
// an `app.klarwerk.ai` gemessen hat. Der Weg dorthin ist der echte Bedienweg (Zahnrad → Duplikate),
// kein synthetisches Ereignis (Lehre JOB 3422).
//
// P1  Nach dem Klick steht die RUHIGE Karte da — nicht die generische Fehlerkarte, und die
//     Chunk-Adresse steht nicht vor dem Menschen.
// P2  Das Fehlerobjekt, das im ausgelieferten Code wirklich entsteht, wird mitgelesen (Vite meldet
//     es als `vite:preloadError` mit dem Originalfehler als `payload`) und festgehalten: `name`
//     und `message`, gemessen, nicht angenommen.
// P3  Nichts lädt von selbst neu: die Adresse bleibt stehen, der Knopf wartet auf den Menschen.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import { buildApp, buildServices } from "../../services/app/src/build-app";

const WURZEL = resolve(process.cwd());
const DIST = resolve(WURZEL, "apps/web/dist");
// `localhost`: nur dort führt Chromium einen sicheren Kontext (und damit `crypto.randomUUID`) —
// die Begründung steht ausführlich in `tests/design/h3-blatt-buehne.ts`.
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
  addInitScript(script: string): Promise<void>;
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  waitForFunction(f: string, arg?: unknown, opts?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(f: string): Promise<T>;
  click(selector: string, opts?: Record<string, unknown>): Promise<void>;
  url(): string;
}
interface Browser {
  version(): string;
  newPage(opts?: Record<string, unknown>): Promise<Seite>;
  close(): Promise<void>;
}

function distDatei(pfadname: string): { body: Buffer; typ: string } {
  const rel = pfadname === "/" ? "/index.html" : pfadname;
  const datei = join(DIST, rel);
  if (existsSync(datei) && statSync(datei).isFile()) {
    return { body: readFileSync(datei), typ: MIME[extname(datei)] ?? "application/octet-stream" };
  }
  // SPA-Rückfall: jeder Seitenpfad bekommt index.html — genau wie die Auslieferung.
  return { body: readFileSync(join(DIST, "index.html")), typ: MIME[".html"] ?? "text/html" };
}

/**
 * Das Stück der Duplikate-Seite im gebauten Stand. Es wird GESUCHT und nicht geraten: hiesse es
 * eines Tages anders, muss dieser Prüfstand rot werden und nicht still nichts mehr sperren.
 */
function duplikateStueck(): string {
  const ordner = join(DIST, "assets");
  const treffer = readdirSync(ordner).filter((n) => /^Duplicates-[\w-]+\.js$/.test(n));
  if (treffer.length !== 1) {
    throw new Error(
      `Genau ein Stück „Duplicates-*.js" erwartet, gefunden: ${treffer.length} (${treffer.join(", ")}). Heisst das Stück der Duplikate-Seite anders, sperrt dieser Prüfstand nichts mehr.`,
    );
  }
  return `/assets/${treffer[0]}`;
}

/**
 * Der Mitschnitt aus der Seite: Vite meldet jeden gescheiterten Nachladeversuch als Ereignis
 * `vite:preloadError` und hängt den ORIGINALFEHLER als `payload` daran (Vite 5.4.21,
 * `dep-BK3b2jBa.js:64849-64857`). Das ist der ehrlichste Zugriff auf das Objekt, das kurz darauf
 * bei der Fehlergrenze ankommt — ohne Eingriff in den ausgelieferten Code.
 */
const MITSCHNITT = `
window.__ladefehler = null;
window.addEventListener("vite:preloadError", (e) => {
  const f = e.payload;
  window.__ladefehler = {
    name: f && f.name !== undefined ? String(f.name) : null,
    message: f && f.message !== undefined ? String(f.message) : null,
    ctor: f && f.constructor ? String(f.constructor.name) : null,
    istError: f instanceof Error,
  };
});`;

interface Ladefehler {
  name: string | null;
  message: string | null;
  ctor: string | null;
  istError: boolean;
}

/** Was am Ende auf der Fläche steht. */
interface Flaeche {
  ruhigeKarte: boolean;
  generischeKarte: boolean;
  text: string;
  adresse: string;
  knopf: string | null;
}

let browser: Browser | null = null;
let seite: Seite | null = null;
let app: ReturnType<typeof buildApp> | null = null;
let aufbaufehler: string | null = null;
let stueck = "";
let chromiumVersion = "";
let flaeche: Flaeche | null = null;
let ladefehler: Ladefehler | null = null;
let schritt = "Aufbau";

/** Was auf der Seite steht, wenn ein Schritt scheitert — Adresse, Testmarken, Textanfang. */
const DIAGNOSE = `(() => {
  const marken = [...document.querySelectorAll("[data-testid]")]
    .map((e) => e.getAttribute("data-testid"))
    .slice(0, 40);
  return JSON.stringify({
    adresse: location.pathname + location.search,
    marken,
    text: (document.body.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 400),
    ladefehler: window.__ladefehler || null,
  });
})()`;

const LIES_FLAECHE = `(() => {
  const ruhig = document.querySelector('[data-testid="ladefehler-neue-version"]');
  const knopf = document.querySelector('[data-testid="ladefehler-neue-version-neu-laden"]');
  const text = (document.body.textContent || "").replace(/\\s+/g, " ").trim();
  return {
    ruhigeKarte: ruhig !== null,
    generischeKarte: document.querySelector("h2.text-trust-crit-text") !== null,
    text: text.slice(0, 600),
    adresse: location.pathname,
    knopf: knopf ? (knopf.textContent || "").trim() : null,
  };
})()`;

beforeAll(async () => {
  try {
    if (!existsSync(join(DIST, "index.html"))) {
      throw new Error("apps/web/dist fehlt — vorher ./tools/build (im Tor laeuft es immer)");
    }
    stueck = duplikateStueck();

    app = buildApp(buildServices());
    await app.ready();
    const post = `pedi+${Math.random().toString(36).slice(2, 8)}@job3423.test`;
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
    await app.inject({
      method: "POST",
      url: "/api/auth/notice",
      headers: { authorization: `Bearer ${token}` },
    });

    const verlangeModul = createRequire(import.meta.url);
    const { chromium } = verlangeModul("playwright") as {
      chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
    };
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
    });
    chromiumVersion = browser.version();
    seite = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await seite.addInitScript(MITSCHNITT);

    const a = app;
    const gesperrt = stueck;
    await seite.route(`${ORIGIN}/**`, async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      // DER EINE UNTERSCHIED ZUR NORMALEN AUSLIEFERUNG — Codex' gemessene Antwort, wörtlich.
      if (url.pathname === gesperrt) {
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
      const d = distDatei(url.pathname);
      await route.fulfill({ status: 200, body: d.body, contentType: d.typ });
    });

    // Der Tab steht auf der Startseite — wie Pedis Tab, bevor er klickte.
    schritt = "goto /start";
    await seite.goto(`${ORIGIN}/start`, { waitUntil: "load", timeout: 60_000 });
    schritt = "warten auf das Kopfband";
    await seite.waitForFunction(
      `document.querySelector('header[data-testid="kopfband"]') !== null`,
      undefined,
      { timeout: 30_000 },
    );

    // DER ECHTE BEDIENWEG, DREI KLICKS: Zahnrad öffnen, „Weitere Bereiche" aufklappen, „Duplikate"
    // anklicken. Der mittlere Klick ist kein Schnörkel — `WeitereBereicheZeilen` steckt in einem
    // `MenueAufklapp`, der ZUGEKLAPPT beginnt (`shell/ZahnradMenue.tsx:95`, `:143-150`), und ohne
    // ihn gibt es die Zeile im Baum gar nicht. Genau daran lief Lauf e57ec13f in eine 30-s-Sperre.
    schritt = "Zahnrad anklicken";
    await seite.click('[data-testid="kopfband-zahnrad"]');
    schritt = "warten auf den Aufklapp „Weitere Bereiche“";
    await seite.waitForFunction(
      `document.querySelector('[data-testid="zahnrad-weitere-bereiche"]') !== null`,
      undefined,
      { timeout: 30_000 },
    );
    schritt = "„Weitere Bereiche“ aufklappen";
    await seite.click('[data-testid="zahnrad-weitere-bereiche"]');
    schritt = "warten auf die Zeile „Duplikate“ im Zahnrad-Menü";
    await seite.waitForFunction(
      `document.querySelector('[data-testid="bereich-duplikate"]') !== null`,
      undefined,
      { timeout: 30_000 },
    );
    schritt = "„Duplikate“ anklicken";
    await seite.click('[data-testid="bereich-duplikate"]');

    // Warten, bis EINE der beiden Karten steht — nicht auf die erhoffte.
    schritt = "warten auf eine der beiden Karten";
    await seite.waitForFunction(
      `document.querySelector('[data-testid="ladefehler-neue-version"]') !== null ||
       document.querySelector('h2.text-trust-crit-text') !== null`,
      undefined,
      { timeout: 30_000 },
    );
    schritt = "Fläche lesen";
    flaeche = await seite.evaluate<Flaeche>(LIES_FLAECHE);
    ladefehler = await seite.evaluate<Ladefehler | null>("window.__ladefehler");
    schritt = "fertig";
  } catch (e) {
    // DIE MELDUNG MUSS TRAGEN. Ein blosses „TimeoutError: page.waitForFunction" nennt weder den
    // Schritt noch den Zustand der Seite — und ein Chromium-Lauf im Tor ist zu teuer, um ihn
    // ratend zu wiederholen (Lauf e57ec13f, 09.09.: genau diese Meldung, drei rote Fälle, keine
    // Auskunft). Deshalb: Schritt, Adresse, sichtbare Testmarken und der Anfang des Textes.
    const lage = await seite
      ?.evaluate<string>(DIAGNOSE)
      .catch((f: unknown) => `Diagnose nicht lesbar: ${String(f)}`);
    aufbaufehler = `Schritt „${schritt}“ — ${String(e).split("\n").slice(0, 2).join(" | ")} — Seitenlage: ${lage ?? "keine Seite"}`;
  }
}, 240_000);

afterAll(async () => {
  await browser?.close();
  await app?.close();
}, 60_000);

function befund(): Flaeche {
  expect(aufbaufehler, "der Chromium-Prüfstand kam nicht zustande").toBeNull();
  if (flaeche === null) {
    throw new Error("Die Fläche wurde nicht gelesen");
  }
  return flaeche;
}

describe("JOB 3423 · Pedis Klick auf Duplikate im alten Tab, echte App, echter Browser", () => {
  it("P1: es steht die ruhige Neu-laden-Karte da, nicht die generische Fehlerkarte", () => {
    const f = befund();
    expect(
      f.ruhigeKarte,
      `Chromium ${chromiumVersion}: statt der ruhigen Karte steht dort „${f.text.slice(0, 200)}" ` +
        `(gemessenes Fehlerobjekt: ${JSON.stringify(ladefehler)})`,
    ).toBe(true);
    expect(f.generischeKarte, "die generische Fehlerkarte steht daneben").toBe(false);
    expect(f.knopf, "der Knopf „Neu laden“ fehlt").not.toBeNull();
    expect(f.text, "die Chunk-Adresse gehört in die Konsole, nicht vor den Menschen").not.toContain(
      stueck,
    );
  });

  it("P2: das Fehlerobjekt des ausgelieferten Codes ist ein TypeError mit der Import-Meldung", () => {
    expect(aufbaufehler).toBeNull();
    expect(
      ladefehler,
      "Vite hat kein `vite:preloadError` gemeldet — dann ist der Weg ein anderer als angenommen",
    ).not.toBeNull();
    const f = ladefehler as Ladefehler;
    expect(f.istError, `kein Error-Objekt: ${JSON.stringify(f)}`).toBe(true);
    expect(f.name, `unerwarteter Fehlername: ${JSON.stringify(f)}`).toBe("TypeError");
    expect(
      (f.message ?? "").toLowerCase(),
      `unerwartete Fehlermeldung: ${JSON.stringify(f)}`,
    ).toContain("failed to fetch dynamically imported module");
  });

  it("P3: die Seite lädt sich nicht von selbst neu — der Knopf wartet auf den Menschen", () => {
    const f = befund();
    expect(f.adresse, "die Adresse hat sich von selbst verändert").toBe("/duplikate");
    expect(seite?.url() ?? "", "die Seite ist von selbst woandershin gesprungen").toContain(
      "/duplikate",
    );
  });
});
