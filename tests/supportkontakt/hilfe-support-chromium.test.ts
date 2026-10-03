// ================================================================================================
// R-1064 · SUPPORTKONTAKT — DIE GEBAUTE HILFESEITE IN CHROMIUM, AN ECHTEN INSTALLATIONEN.
// ================================================================================================
//
// WAS HIER ECHT IST: die gebaute Anwendung aus `apps/web/dist` (Ergebnis von `./tools/build`) in
// Chromium; JEDER `/api/*`-Aufruf geht an eine echte `buildApp`-Instanz, deren Betreiberwerte
// KLARWERK_SUPPORT_URL / KLARWERK_SUPPORT_LABEL vor dem Aufbau gesetzt und danach sofort
// zurückgestellt werden. Keine Supportantwort wird im Browser vorgegeben.
//
// WARUM EINE EIGENE SCHMALE BÜHNE und nicht `tests/design/h3-blatt-buehne.ts`: Jene routet nur die
// eigene Herkunft und kennt weder mehrere Installationen nebeneinander noch das Abfangen einer
// Navigation auf ein FREMDES Ziel. Genau das braucht dieser Nachweis: der normale Link wird
// angeklickt, und die Navigation auf das synthetische Ziel wird am Browserrand abgefangen und
// abgebrochen — es entsteht keine Verbindung nach aussen und keine Nachricht.
//
// EINZIGER EINGRIFF AM RAND: Fall F bricht den Abruf `/api/support` ab (Netz weg). Das ist ein
// Fehler, keine erfundene Antwort.
//
// Die Ziele sind synthetisch (`.invalid`, RFC 2606): keine echte Adresse, keine Zuständigkeit.
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import { type Browser, type BrowserContext, type Page, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { buildApp, buildServices } from "../../services/app/src/build-app";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

const WURZEL = resolve(process.cwd());
const DIST = resolve(WURZEL, "apps/web/dist");
// `localhost` und nicht ein Phantasiename: Chromium führt nur ihn als sicheren Kontext ohne TLS
// (Begründung in `tests/design/h3-blatt-buehne.ts`, JOB 3062 R6).
const ORIGIN = "http://localhost";
const BELEGORDNER =
  process.env.SUPPORTKONTAKT_BELEGORDNER ?? join(WURZEL, ".local/run/supportkontakt-belege");

const URL_NAME = "KLARWERK_SUPPORT_URL";
const LABEL_NAME = "KLARWERK_SUPPORT_LABEL";

const A = { url: "https://support-a.invalid/servicedesk?quelle=klarwerk", label: "Servicedesk A" };
const B = { url: "https://support-b.invalid/kontakt", label: "Helpdesk B" };
const C = { url: "mailto:support-c@kunde-c.invalid" };

/** Die Supportkarte hat ihren Abruf hinter sich — gleich, wie er ausging. */
const KARTE_FERTIG = '[data-testid="hilfe-support"]:not([data-support-zustand="laedt"])';

const DESKTOP = { width: 1280, height: 800 };
const SCHMAL = { width: 390, height: 844 };

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function distDatei(pfad: string): { body: Buffer; typ: string } {
  const datei = join(DIST, pfad === "/" ? "/index.html" : pfad);
  if (existsSync(datei) && statSync(datei).isFile()) {
    return { body: readFileSync(datei), typ: MIME[extname(datei)] ?? "application/octet-stream" };
  }
  // SPA: jeder Seitenpfad bekommt index.html.
  return { body: readFileSync(join(DIST, "index.html")), typ: "text/html; charset=utf-8" };
}

interface Installation {
  app: FastifyInstance;
  token: string;
}

const installationen: FastifyInstance[] = [];
let browser: Browser | undefined;

async function installation(werte: { url?: string; label?: string }): Promise<Installation> {
  const vorher = { url: process.env[URL_NAME], label: process.env[LABEL_NAME] };
  const setze = (name: string, wert: string | undefined): void => {
    if (wert === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = wert;
    }
  };
  setze(URL_NAME, werte.url);
  setze(LABEL_NAME, werte.label);
  let app: FastifyInstance;
  try {
    app = buildApp(buildServices());
  } finally {
    setze(URL_NAME, vorher.url);
    setze(LABEL_NAME, vorher.label);
  }
  installationen.push(app);
  await app.ready();
  const marke = Math.random().toString(36).slice(2, 8);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada", email: `ada@${marke}.test`, password: "geheim12345" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: `ada@${marke}.test`, password: "geheim12345" },
  });
  expect(login.statusCode, login.body).toBe(200);
  return { app, token: login.json().token as string };
}

/** Die Antwort der Installation, direkt gefragt — derselbe Stand, den die Seite bekommt. */
async function apiAntwort(inst: Installation): Promise<unknown> {
  const res = await inst.app.inject({
    method: "GET",
    url: "/api/support",
    headers: { authorization: `Bearer ${inst.token}` },
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json();
}

interface Fahrt {
  kontext: BrowserContext;
  seite: Page;
  /** Jede Anfrage an eine FREMDE Herkunft — abgefangen und abgebrochen. */
  fremd: string[];
  seitenfehler: string[];
}

async function hilfeOeffnen(
  inst: Installation,
  opts: { sprache?: string; fenster?: { width: number; height: number }; netzWeg?: boolean } = {},
): Promise<Fahrt> {
  if (!browser) {
    throw new Error("kein Chromium");
  }
  const kontext = await browser.newContext({ viewport: opts.fenster ?? DESKTOP });
  const fremd: string[] = [];
  const seitenfehler: string[] = [];
  await kontext.addInitScript(
    `try { localStorage.setItem("kw.sprache", ${JSON.stringify(opts.sprache ?? "de")}); } catch (e) {}`,
  );
  await kontext.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin !== ORIGIN) {
      fremd.push(req.url());
      await route.abort();
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      if (opts.netzWeg && url.pathname === "/api/support") {
        await route.abort("failed");
        return;
      }
      const kopf: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers())) {
        if (!["host", "origin", "referer", "cookie"].includes(k.toLowerCase())) {
          kopf[k] = v;
        }
      }
      kopf.authorization = `Bearer ${inst.token}`;
      const rumpf = req.postData();
      const res = await inst.app.inject({
        method: req.method() as "GET",
        url: url.pathname + url.search,
        headers: kopf,
        ...(rumpf !== null ? { payload: rumpf } : {}),
      });
      await route.fulfill({
        status: res.statusCode,
        body: res.body,
        headers: { "content-type": String(res.headers["content-type"] ?? "application/json") },
      });
      return;
    }
    const d = distDatei(url.pathname);
    await route.fulfill({ status: 200, body: d.body, contentType: d.typ });
  });
  const seite = await kontext.newPage();
  seite.on("pageerror", (e) => seitenfehler.push(e.message));
  await seite.goto(`${ORIGIN}/hilfe`, { waitUntil: "load", timeout: 60_000 });
  await seite.waitForSelector(KARTE_FERTIG, { timeout: 30_000 });
  return { kontext, seite, fremd, seitenfehler };
}

const tFix = (sprache: string, key: string): string => i18n.getFixedT(sprache)(key);
const flach = (roh: string): string => roh.replace(/\s+/g, " ").trim();

async function zustand(seite: Page): Promise<string | null> {
  return seite.locator('[data-testid="hilfe-support"]').getAttribute("data-support-zustand");
}

async function kartentext(seite: Page): Promise<string> {
  return flach(await seite.locator('[data-testid="hilfe-support"]').innerText());
}

async function beleg(seite: Page, name: string): Promise<void> {
  mkdirSync(BELEGORDNER, { recursive: true });
  await seite.screenshot({ path: join(BELEGORDNER, `${name}.png`), fullPage: false });
}

/** Sichtbarkeit, Rechteck und Fensterlage eines Elements — gemessen, nicht angenommen. */
async function vermessen(seite: Page, selektor: string) {
  return seite.locator(selektor).evaluate((el) => {
    // Diese Funktion läuft in Chromium; der Testtreiber bleibt ein Node-Modul.
    const pruefbar = el as unknown as {
      checkVisibility(o: Record<string, boolean>): boolean;
      getBoundingClientRect(): { left: number; right: number; width: number; height: number };
      innerText: string;
    };
    const browser = globalThis as unknown as {
      innerWidth: number;
      document: { documentElement: { scrollWidth: number } };
    };
    const r = pruefbar.getBoundingClientRect();
    return {
      sichtbar: pruefbar.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
      text: pruefbar.innerText.replace(/\s+/g, " ").trim(),
      links: Math.round(r.left * 10) / 10,
      rechts: Math.round(r.right * 10) / 10,
      breite: Math.round(r.width * 10) / 10,
      hoehe: Math.round(r.height * 10) / 10,
      fenster: browser.innerWidth,
      dokument: browser.document.documentElement.scrollWidth,
    };
  });
}

/** Hilfe und Suche bleiben bedienbar — in jeder Lage der Supportkarte. */
async function sucheBedienbar(seite: Page): Promise<void> {
  expect(await seite.locator("[data-hilfe-thema]").count()).toBeGreaterThan(0);
  await seite.fill('[data-testid="hilfe-suche"]', "import");
  expect(await seite.locator('[data-hilfe-thema="fileimport"]').isVisible()).toBe(true);
  await seite.fill('[data-testid="hilfe-suche"]', "");
}

/** Der Kontakt einer Installation: sichtbar, exakt, und der Klick führt GENAU dorthin. */
async function kontaktPruefen(
  inst: Installation,
  eigen: { url: string; label: string },
  fremdeInstallation: { url: string; label: string },
  fenster: { width: number; height: number },
  name: string,
): Promise<void> {
  expect(await apiAntwort(inst)).toEqual({
    zustand: "eingerichtet",
    art: "https",
    ziel: eigen.url,
    anzeige: eigen.url,
    bezeichnung: eigen.label,
  });
  const f = await hilfeOeffnen(inst, { fenster });
  try {
    expect(await zustand(f.seite)).toBe("eingerichtet");
    expect(await f.seite.locator('[data-testid="hilfe-support"] a').count()).toBe(1);
    const link = f.seite.locator('[data-testid="hilfe-support-link"]');
    expect(await link.getAttribute("href")).toBe(eigen.url);
    const mass = await vermessen(f.seite, '[data-testid="hilfe-support-link"]');
    const ziel = await vermessen(f.seite, '[data-testid="hilfe-support-ziel"]');
    console.info(`R-1064 ${name}: ${JSON.stringify({ link: mass, ziel })}`);
    expect(mass.sichtbar, "der Link ist nicht sichtbar").toBe(true);
    expect(mass.breite).toBeGreaterThan(0);
    expect(mass.hoehe).toBeGreaterThan(0);
    expect(mass.links).toBeGreaterThanOrEqual(0);
    expect(mass.rechts, "der Link ragt aus dem Fenster").toBeLessThanOrEqual(mass.fenster);
    expect(mass.dokument, "die Seite läuft waagerecht über").toBeLessThanOrEqual(mass.fenster);
    expect(mass.text).toContain(eigen.label);
    expect(ziel.sichtbar).toBe(true);
    expect(ziel.text).toBe(eigen.url);
    expect(ziel.rechts, "das Ziel ragt aus dem Fenster").toBeLessThanOrEqual(ziel.fenster);
    const karte = await kartentext(f.seite);
    expect(karte).not.toContain(fremdeInstallation.label);
    expect(karte).not.toContain(new URL(fremdeInstallation.url).host);
    await beleg(f.seite, name);

    // Der normale Link, normal angeklickt. Die Navigation auf das synthetische Ziel wird am Rand
    // abgefangen und abgebrochen — beobachtet wird der VERSUCH, nicht eine Verbindung.
    const eigenerHost = new URL(eigen.url).host;
    const [anfrage] = await Promise.all([
      f.kontext.waitForEvent("request", {
        predicate: (r) => new URL(r.url()).host === eigenerHost,
        timeout: 15_000,
      }),
      link.click(),
    ]);
    expect(anfrage.url()).toBe(eigen.url);
    expect(f.fremd).toContain(eigen.url);
    expect(f.fremd.some((u) => u.includes(new URL(fremdeInstallation.url).host))).toBe(false);
    expect(f.seitenfehler).toEqual([]);
  } finally {
    await f.kontext.close();
  }
}

beforeAll(async () => {
  const gebaut = existsSync(join(DIST, "index.html"));
  expect(gebaut, "apps/web/dist fehlt — vorher ./tools/build").toBe(true);
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
  });
}, 120_000);

afterAll(async () => {
  await browser?.close();
  for (const app of installationen.splice(0)) {
    await app.close();
  }
}, 60_000);

describe("R-1064 · K1 · zwei Installationen zeigen je ihren eigenen Supportweg", () => {
  it("A: Installation A zeigt nur A — Desktop; Klick führt auf genau A", async () => {
    const instA = await installation(A);
    await kontaktPruefen(instA, A, B, DESKTOP, "a-desktop");
  }, 120_000);

  it("A schmal: dieselbe Installation bei 390 px — Link sichtbar, im Fenster, Klick auf A", async () => {
    const instA = await installation(A);
    await kontaktPruefen(instA, A, B, SCHMAL, "a-390");
  }, 120_000);

  it("B: Installation B zeigt nur B — Desktop; Klick führt auf genau B", async () => {
    const instB = await installation(B);
    await kontaktPruefen(instB, B, A, DESKTOP, "b-desktop");
  }, 120_000);

  it("C: mailto ohne Bezeichnung — exaktes href, Produkttext als Name, Adresse sichtbar", async () => {
    const instC = await installation(C);
    const f = await hilfeOeffnen(instC);
    try {
      expect(await zustand(f.seite)).toBe("eingerichtet");
      const link = f.seite.locator('[data-testid="hilfe-support-link"]');
      expect(await link.getAttribute("href")).toBe(C.url);
      expect(await link.getAttribute("target")).toBeNull();
      expect(flach(await link.innerText())).toBe(tFix("de", "help.support.mailDefault"));
      const ziel = await vermessen(f.seite, '[data-testid="hilfe-support-ziel"]');
      expect(ziel.sichtbar).toBe(true);
      expect(ziel.text).toBe("support-c@kunde-c.invalid");
      // Kein Klick: ein `mailto:` übergibt an ein Mailprogramm des Rechners — genau das soll hier
      // nicht geschehen. Belegt ist das exakte Ziel am normalen Link.
      await beleg(f.seite, "c-mailto");
      expect(f.seitenfehler).toEqual([]);
    } finally {
      await f.kontext.close();
    }
  }, 120_000);
});

describe("R-1064 · K1 · ehrliche Zustände ohne gültigen Kontakt", () => {
  for (const sprache of ["de", "en", "nl"] as const) {
    it(`nicht eingerichtet (${sprache}): Satz statt Link, Hilfe und Suche bedienbar`, async () => {
      const inst = await installation({});
      expect(await apiAntwort(inst)).toEqual({ zustand: "nicht_eingerichtet" });
      for (const fenster of [DESKTOP, SCHMAL]) {
        const f = await hilfeOeffnen(inst, { sprache, fenster });
        try {
          expect(await zustand(f.seite)).toBe("nicht_eingerichtet");
          const text = await kartentext(f.seite);
          expect(text).toContain(tFix(sprache, "help.support.title"));
          expect(text).toContain(tFix(sprache, "help.support.notConfigured"));
          expect(await f.seite.locator('[data-testid="hilfe-support"] a').count()).toBe(0);
          expect(await f.seite.locator('a[href^="mailto:"], a[href*=".invalid"]').count()).toBe(0);
          const mass = await vermessen(f.seite, '[data-testid="hilfe-support-hinweis"]');
          console.info(`R-1064 leer ${sprache} @${fenster.width}: ${JSON.stringify(mass)}`);
          expect(mass.sichtbar).toBe(true);
          expect(mass.rechts).toBeLessThanOrEqual(mass.fenster);
          expect(mass.dokument).toBeLessThanOrEqual(mass.fenster);
          await sucheBedienbar(f.seite);
          await beleg(f.seite, `leer-${sprache}-${fenster.width}`);
          expect(f.seitenfehler).toEqual([]);
        } finally {
          await f.kontext.close();
        }
      }
    }, 180_000);
  }

  for (const roh of ["javascript:alert(1)", "data:text/html,<b>x</b>"]) {
    it(`ungültig (${roh.split(":")[0]}:): abgewiesen, kein Link, der Wert steht nirgends`, async () => {
      const inst = await installation({ url: roh, label: "Hilfe" });
      expect(await apiAntwort(inst)).toEqual({ zustand: "ungueltig" });
      const f = await hilfeOeffnen(inst);
      try {
        expect(await zustand(f.seite)).toBe("ungueltig");
        expect(await kartentext(f.seite)).toContain(tFix("de", "help.support.invalid"));
        expect(await f.seite.locator('[data-testid="hilfe-support"] a').count()).toBe(0);
        expect(await f.seite.locator('a[href^="javascript:"], a[href^="data:"]').count()).toBe(0);
        expect(await f.seite.content()).not.toContain(roh);
        await sucheBedienbar(f.seite);
        await beleg(f.seite, `ungueltig-${roh.split(":")[0]}`);
        expect(f.seitenfehler).toEqual([]);
      } finally {
        await f.kontext.close();
      }
    }, 120_000);
  }

  it("F: Leseabruf scheitert — Fehlersatz, kein Link, kein Kontakt behauptet, Hilfe bedienbar", async () => {
    const inst = await installation(A);
    const f = await hilfeOeffnen(inst, { netzWeg: true });
    try {
      expect(await zustand(f.seite)).toBe("fehler");
      const text = await kartentext(f.seite);
      expect(text).toContain(tFix("de", "help.support.loadError"));
      expect(text).not.toContain(A.label);
      expect(await f.seite.locator('[data-testid="hilfe-support"] a').count()).toBe(0);
      await sucheBedienbar(f.seite);
      await beleg(f.seite, "abruffehler");
      expect(f.seitenfehler).toEqual([]);
    } finally {
      await f.kontext.close();
    }
  }, 120_000);
});
