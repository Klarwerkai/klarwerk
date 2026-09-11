// ================================================================================================
// JOB 3591 — DIE GAST-BÜHNE: die echte Anwendung in Chromium, OHNE Anmeldung.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT — und warum sie nicht `tests/design/h6-chromium.ts` sein kann.
//
// Der gemeinsame Prüfstand `h6-chromium.ts` meldet einen Admin an (`:243-253`) und setzt danach auf
// JEDEN `/api/*`-Aufruf der Seite den Bearer (`:307`). Der Client des Produkts läuft vollständig
// über `/api` (`apps/web/src/api/client.ts:19,28`), also auch `me` aus `app/AuthContext.tsx:99` —
// `s.user` ist damit gesetzt und `App.tsx:88-92` rendert die `AppShell`. `BrandPanel`/`BrandCompact`
// kommen auf jener Bühne NIE vor. Das ist keine Annahme dieses Kopfes: der Fall L1 in
// `anmeldemaske-marke-chromium.test.ts` misst es an der laufenden h6-Bühne nach.
//
// Diese Bühne unterscheidet sich davon in GENAU EINEM Punkt: sie setzt keinen Bearer. Der Browser
// hat kein Sitzungsmerkmal, `me` scheitert mit 401, und `App.tsx:85-87` zeigt die Anmeldemaske —
// die erste Fläche der Vorführung.
//
// EIN ADMIN WIRD TROTZDEM ANGELEGT, serverseitig über `app.inject`: ohne ein einziges Konto meldet
// `GET /api/auth/status` `needsSetup: true`, und `App.tsx:83-84` zeigt die ERSTEINRICHTUNG statt der
// Anmeldung. Beide Masken tragen dieselben Markenbausteine (`AuthScreens.tsx:83,88`), gemessen wird
// aber die Fläche, die der Gast bei der Vorführung wirklich sieht. Der Admin dient ausserdem dem
// zweiten Zweck: mit SEINEM Token wird die Firmen-CI über den ECHTEN Schreibweg
// `PUT /api/admin/branding` gesetzt (`services/app/src/routes/branding-routes.ts:83`), nicht über
// einen Zugriff in die Seite hinein. Die Seite holt den Stand danach selbst über den öffentlichen
// Leseweg `GET /api/branding` — die vollständige Nutzenkette, nicht ihr letztes Glied allein.
//
// `https`-URSPRUNG aus demselben Grund wie dort (`h6-chromium.ts:28-38`): `crypto.randomUUID` gibt
// es nur im sicheren Kontext.
//
// Die Auslieferung aus `apps/web/dist` steht hier nachgebaut und nicht wiederverwendet, weil
// `h6-chromium.ts` ihren Helfer (`distDatei`) nicht exportiert und die Datei fremder Zielpfad ist
// (JOB 3587) — sie darf für diesen Auftrag nicht angefasst werden. Wiederverwendet wird, was sie
// hergibt: `fn` und die Seitentypen.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import { buildApp, buildServices } from "../../services/app/src/build-app";
import { fn } from "../design/h6-chromium";
import type { Seite } from "../design/h6-chromium";

export { fn };
export type { BrowserFn, Seite } from "../design/h6-chromium";

export const WURZEL = resolve(process.cwd());
export const DIST = resolve(WURZEL, "apps/web/dist");
export const ORIGIN = "https://klarwerk.test";

/** Das Konto, das die Ersteinrichtung abschliesst — es meldet sich NIE im Browser an. */
export const ADMIN = { name: "Pedi", email: "pedi@job3591.test", password: "geheim12345" } as const;

// Die Weiche (`route`) braucht hier KEINEN eigenen Typ: ihr Rückruf wird aus `Seite.route`
// abgeleitet (`h6-chromium.ts:127`). Eine danebenstehende Nachbildung wäre eine zweite Wahrheit
// über dieselbe Fläche — und wurde von `tsc` folgerichtig als ungenutzt gemeldet (TS6196).
interface Browser {
  version(): string;
  newPage(opts: Record<string, unknown>): Promise<GastSeite>;
  close(): Promise<void>;
}

/**
 * Die Seite um das, was diese Messung braucht — das Fenster verstellen und neu laden.
 *
 * Wie im Hausmuster (`tests/review26-pruefen-schmal/pruefen-schmal-chromium.test.ts:21-23`) wird
 * dafür NICHT aus Playwright typisiert: ein direkter Typimport zählte im Torgraphen als weitere
 * Startstelle. Den Browser startet in dieser Datei genau eine Zeile, `chromium.launch` unten.
 */
export interface GastSeite extends Seite {
  setViewportSize(groesse: { width: number; height: number }): Promise<void>;
  reload(opts?: Record<string, unknown>): Promise<unknown>;
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
  // SPA: jeder Seitenpfad bekommt index.html
  return { body: readFileSync(join(DIST, "index.html")), typ: MIME[".html"] ?? "text/html" };
}

export interface GastStand {
  browser: Browser | null;
  seite: GastSeite | null;
  app: ReturnType<typeof buildApp> | null;
  fehler: string | null;
  version: string;
  /** Das Darstellungsthema, wie die Anwendung es SELBST gewählt hat — hier wird keines gesetzt. */
  theme: string;
  seitenfehler: string[];
  /** Der Bearer des serverseitig angelegten Admins — für `PUT /api/admin/branding`, nie im Browser. */
  adminToken: string;
  /** Wie oft jeder `/api`-Pfad wirklich abgerufen wurde. */
  abrufe: Map<string, number>;
}

/**
 * Startet die echte Anwendung in Chromium und öffnet `pfad` OHNE Anmeldung.
 * `warteAuf` ist ein Selektor, der beweist, dass die Seite wirklich steht.
 */
export async function starteGast(
  pfad: string,
  warteAuf: string,
  breite = 1280,
  hoehe = 900,
): Promise<GastStand> {
  const stand: GastStand = {
    browser: null,
    seite: null,
    app: null,
    fehler: null,
    version: "",
    theme: "",
    seitenfehler: [],
    adminToken: "",
    abrufe: new Map<string, number>(),
  };
  try {
    if (!existsSync(join(DIST, "index.html"))) {
      throw new Error("apps/web/dist fehlt — vorher ./tools/build (im Tor läuft es immer)");
    }
    const services = buildServices();
    const app = buildApp(services);
    stand.app = app;
    await app.ready();
    // Das ERSTE Konto einer frischen Instanz ist der Admin (Ersteinrichtung). Es wird hier und nur
    // hier benutzt — der Browser bekommt davon nichts.
    await app.inject({ method: "POST", url: "/api/auth/register", payload: { ...ADMIN } });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: ADMIN.email, password: ADMIN.password },
    });
    stand.adminToken = (login.json() as { token: string }).token;

    const require = createRequire(import.meta.url);
    const { chromium } = require("playwright") as {
      chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
    };
    stand.browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
    });
    stand.version = stand.browser.version();
    const seite = await stand.browser.newPage({ viewport: { width: breite, height: hoehe } });
    stand.seite = seite;
    seite.on("pageerror", (e) => stand.seitenfehler.push(String(e).slice(0, 200)));
    await seite.route(`${ORIGIN}/**`, async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.pathname.startsWith("/api/")) {
        stand.abrufe.set(url.pathname, (stand.abrufe.get(url.pathname) ?? 0) + 1);
        const kopf: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.headers())) {
          if (!["host", "origin", "referer", "cookie"].includes(k.toLowerCase())) kopf[k] = v;
        }
        // HIER liegt der ganze Unterschied zu `h6-chromium.ts:307`: KEIN `authorization`.
        // Die Seite bleibt Gast, `me` scheitert, die Anmeldemaske steht.
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
    await warteAufSelektor(seite, warteAuf);
    stand.theme = await seite.evaluate<string>(
      fn("() => document.documentElement.getAttribute('data-theme') || 'classic (kein Attribut)'"),
    );
  } catch (e) {
    stand.fehler = String(e).split("\n").slice(0, 3).join(" | ");
  }
  return stand;
}

async function warteAufSelektor(seite: Seite, selektor: string): Promise<void> {
  await seite.waitForFunction(fn("(s) => document.querySelector(s) !== null"), selektor, {
    timeout: 30_000,
  });
}

/**
 * Die Firmen-CI über den ECHTEN Schreibweg setzen und die Seite den Stand selbst holen lassen.
 *
 * Bewusst kein Zugriff in die Seite hinein (`uebernimmBranding` aus dem Browser heraus aufzurufen
 * wäre ein erfundener Zugang): geschrieben wird mit dem Admin-Bearer über
 * `PUT /api/admin/branding`, danach lädt die Seite neu und `initBrandTheme` (`main.tsx:23`) holt den
 * Stand über den öffentlichen Leseweg. Gemessen wird dadurch die ganze Kette.
 */
export async function setzeMarke(
  stand: GastStand,
  wunsch: { profil: "advisor" | null; aktiv: boolean },
  warteAuf: string,
): Promise<number> {
  const app = stand.app;
  const seite = stand.seite;
  if (app === null || seite === null || stand.fehler !== null) {
    throw new Error(`Gast-Bühne steht nicht: ${stand.fehler ?? "keine Seite"}`);
  }
  const antwort = await app.inject({
    method: "PUT",
    url: "/api/admin/branding",
    headers: { authorization: `Bearer ${stand.adminToken}` },
    payload: wunsch,
  });
  if (antwort.statusCode !== 200) {
    throw new Error(`PUT /api/admin/branding: HTTP ${antwort.statusCode} ${antwort.body}`);
  }
  await seite.reload({ waitUntil: "load", timeout: 60_000 });
  await warteAufSelektor(seite, warteAuf);
  return (antwort.json() as { version: number }).version;
}

/** Das Fenster verstellen und abwarten, bis das Layout wirklich nachgezogen ist. */
export async function verstelleFenster(
  stand: GastStand,
  breite: number,
  hoehe: number,
): Promise<void> {
  const seite = stand.seite;
  if (seite === null) {
    throw new Error("Gast-Bühne steht nicht");
  }
  await seite.setViewportSize({ width: breite, height: hoehe });
  await seite.waitForFunction(fn("(b) => window.innerWidth === b"), breite, { timeout: 10_000 });
  // Zwei Einzelbilder abwarten: die Breitenabfrage (`lg:`) greift erst im nächsten Layoutdurchgang.
  await seite.evaluate(
    fn(
      "() => new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(() => f(null))))",
    ),
  );
}

export async function beendeGast(stand: GastStand): Promise<void> {
  await stand.browser?.close();
  await stand.app?.close();
}
