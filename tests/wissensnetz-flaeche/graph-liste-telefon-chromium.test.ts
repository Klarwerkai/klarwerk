// ================================================================================================
// N-0024 / R-0744 — DIE VOLLTITELLISTE AM WISSENSGRAPHEN AUF DEM TELEFON, IN ECHTEM CHROMIUM.
// ================================================================================================
//
// Wortlaut N-0024: „Eine filterbare Liste mit vollständigen Titeln ergänzen; … auf schmalen Fenstern
// eine gut bedienbare Listenansicht anbieten." R-0744: „… ein ausdrücklich zu wählender
// Qualitätsblick … jede Zahl mit ihrem Nenner."
//
// WARUM EINE EIGENE DATEI (Nacharbeit 4): Der Fall stand zuerst als „GL" in
// `tests/design/zielbild-wissensnetz.test.ts`. Jene Datei liest in ihrem Aufbau das Zielbild aus
// einem Verzeichnis AUSSERHALB des Repositorys und ist ohne es rot — für jeden ihrer Fälle, auch für
// diesen, der das Zielbild gar nicht braucht. Hier steht deshalb derselbe Messweg ohne diese
// Abhängigkeit, nicht ein abgeschwächter.
//
// DER MESSWEG (Muster: `tests/design/zielbild-wissensnetz.test.ts`):
//   · Die GEBAUTE Anwendung (`apps/web/dist`, Ergebnis von `./tools/build`) läuft in Chromium unter
//     `http://klarwerk.test`; Playwright bedient `/assets/*` aus `dist` und reicht jeden `/api/*`-
//     Aufruf an eine ECHTE Fastify-App (`buildApp`, echte Dienste) mit dem Bearer der echten
//     Anmeldung weiter.
//   · 28 Objekte mit den ähnlichen langen Titeln aus dem Beleg N-0011
//     (`tests/wissensgraph-lesbarkeit/bestand.ts`) entstehen über den authentifizierten `POST /api/kos`.
//   · Stufe 2 wird am ECHTEN Schalter unter `/admin?bereich=system` eingeschaltet (das erste Konto
//     ist Verwalter) — bedient, nicht vorgesetzt.
//   · Gemessen wird `/graph` bei 390×844. Kein SVG-Nachbau, keine jsdom-Geometrie.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import i18n from "../../apps/web/src/i18n";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { TITEL } from "../wissensgraph-lesbarkeit/bestand";

const DIST = resolve(process.cwd(), "apps/web/dist");
const ORIGIN = "http://klarwerk.test";

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
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  waitForFunction(fn: BrowserFn, arg?: unknown, opts?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(fn: BrowserFn, arg?: unknown): Promise<T>;
  click(selector: string): Promise<void>;
  fill(selector: string, value: string): Promise<void>;
  keyboard: { press(key: string): Promise<void>; type(text: string): Promise<void> };
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

function distDatei(pfadname: string): { body: Buffer; typ: string } {
  const rel = pfadname === "/" ? "/index.html" : pfadname;
  const datei = join(DIST, rel);
  if (existsSync(datei) && statSync(datei).isFile()) {
    return { body: readFileSync(datei), typ: MIME[extname(datei)] ?? "application/octet-stream" };
  }
  return { body: readFileSync(join(DIST, "index.html")), typ: MIME[".html"] ?? "text/html" };
}

// ---- Die Browserfunktionen, als Quelltext (sie laufen in der Seite) ---------------------------
const FILTER = '[data-testid="graph-objektliste-filter"]';
const SCHALTER = '[data-testid="zeile-stufe2"] input[type="checkbox"]';
const DA = "(sel) => !!document.querySelector(sel)";
const AN = "(sel) => document.querySelector(sel).checked === true";
const STUFE2 = `() => { try { return localStorage.getItem("kw.stufe2.v1") === "1"; } catch (e) { return false; } }`;
const PFAD = "(p) => location.pathname === p";
const ANZAHL = `(n) => document.querySelectorAll('[data-testid="graph-objekt"]').length === n`;
const IDS = `() => [...document.querySelectorAll('[data-testid="graph-objekt"]')].map((e) => e.getAttribute('data-id'))`;
const TITEL_STEHT = `(t) => { const h = document.querySelector('[data-testid="bib-titel"]'); return !!h && h.getBoundingClientRect().height > 0 && h.innerText.trim() === t; }`;
const LAGE = `(sel) => { const el = document.querySelector(sel); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { links: r.left, rechts: r.right, hoehe: r.height }; }`;
const FOKUS = `(id) => { const a = document.activeElement; return !!a && a.getAttribute('data-testid') === 'graph-objekt-link' && a.closest('[data-testid="graph-objekt"]').getAttribute('data-id') === id; }`;
const GEOMETRIE = `(filter) => { const el = document.querySelector(filter); el.scrollIntoView({ block: 'center' }); const f = el.getBoundingClientRect(); return { breite: window.innerWidth, scrollBreite: document.documentElement.scrollWidth, filter: { links: f.left, rechts: f.right, oben: f.top, unten: f.bottom, hoehe: f.height }, titel: [...document.querySelectorAll('[data-testid="graph-objekt-link"]')].map((a) => { const r = a.getBoundingClientRect(); return { text: a.innerText.replace(/\\s+/g, ' ').trim(), links: r.left, rechts: r.right }; }) }; }`;
const QB_STEHT = `() => ['konflikte', 'luecken', 'veraltet', 'dubletten'].every((k) => { const el = document.querySelector('[data-testid="graph-qb-' + k + '"]'); return !!el && el.getAttribute('data-zustand') !== 'laedt'; })`;
const QB = `() => Object.fromEntries(['konflikte', 'luecken', 'veraltet', 'dubletten', 'alter'].map((k) => [k, (document.querySelector('[data-testid="graph-qb-' + k + '"]') || {}).innerText || '']))`;

interface Geometrie {
  breite: number;
  scrollBreite: number;
  filter: { links: number; rechts: number; oben: number; unten: number; hoehe: number };
  titel: { text: string; links: number; rechts: number }[];
}

let browser: Browser | null = null;
let seite: Seite | null = null;
let app: ReturnType<typeof buildApp> | null = null;
let fehler: string | null = null;
/** Titel → Kennung, aus den 201-Antworten der Anlage. */
const kennung = new Map<string, string>();

describe("N-0024 / R-0744 · die Volltitelliste am Graphen auf dem Telefon — echte App in Chromium", () => {
  beforeAll(async () => {
    try {
      if (!existsSync(join(DIST, "index.html"))) {
        throw new Error("apps/web/dist fehlt — vorher ./tools/build (im Tor laeuft es immer)");
      }
      app = buildApp(buildServices());
      await app.ready();
      const email = "pedi-graphliste@nacharbeit4.test";
      await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "Pedi", email, password: "geheim12345" },
      });
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email, password: "geheim12345" },
      });
      const token = (login.json() as { token: string }).token;
      const headers = { authorization: `Bearer ${token}` };
      // Der Rechtshinweis wird quittiert — sonst nimmt das Band dem Telefon Platz.
      await app.inject({ method: "POST", url: "/api/auth/notice", headers });
      for (const titel of TITEL) {
        const res = await app.inject({
          method: "POST",
          url: "/api/kos",
          headers,
          payload: {
            confidentiality: "intern",
            title: titel,
            statement: `${titel} — Kurzfassung fuer den Pruefstand.`,
            type: "best_practice",
            category: "Betrieb",
            tags: [],
            neededValidations: 1,
          },
        });
        if (res.statusCode !== 201) {
          throw new Error(`Anlage von „${titel}" scheiterte: ${res.statusCode} ${res.body}`);
        }
        kennung.set(titel, (res.json() as { id: string }).id);
      }

      const require = createRequire(import.meta.url);
      const { chromium } = require("playwright") as {
        chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
      };
      browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
      });
      seite = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const ziel = app as ReturnType<typeof buildApp>;
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
          const res = await ziel.inject({
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
      console.info(
        `Nacharbeit 4 · Chromium ${browser.version()} · ${kennung.size} Objekte ueber POST /api/kos`,
      );
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 3).join(" | ");
    }
  }, 180_000);

  afterAll(async () => {
    await browser?.close();
    await app?.close();
  }, 60_000);

  it("GL · 390×844 auf /graph: Volltitelliste im Fenster, echter Filter, Treffer per Mausklick und per Tab+Enter, Zuruecksetzen, Qualitaetsblick", async () => {
    expect(fehler, "Aufbau").toBeNull();
    const s = seite as Seite;
    expect(kennung.size, "28 Objekte ueber POST /api/kos").toBe(28);
    const warteAufAnzahl = async (n: number): Promise<void> => {
      await s.waitForFunction(fn(ANZAHL), n, { timeout: 30_000 });
    };
    // Die Detailroute steht, und ihr sichtbarer Titel ist der erwartete.
    const pruefeZiel = async (id: string, titel: string): Promise<void> => {
      await s.waitForFunction(fn(PFAD), `/wissen/${id}`, { timeout: 30_000 });
      await s.waitForFunction(fn(TITEL_STEHT), titel, { timeout: 30_000 });
    };
    const zurueckZurListe = async (): Promise<void> => {
      await s.evaluate(fn("() => history.back()"));
      await s.waitForFunction(fn(PFAD), "/graph", { timeout: 30_000 });
      await warteAufAnzahl(TITEL.length);
    };

    // STUFE 2 AM ECHTEN SCHALTER — bedient, nicht vorgesetzt.
    await s.goto(`${ORIGIN}/admin?bereich=system`, { waitUntil: "load", timeout: 60_000 });
    await s.waitForFunction(fn(DA), SCHALTER, { timeout: 45_000 });
    const an = await s.evaluate<boolean>(fn(AN), SCHALTER);
    if (!an) {
      await s.click(SCHALTER);
    }
    await s.waitForFunction(fn(STUFE2), undefined, { timeout: 30_000 });

    await s.goto(`${ORIGIN}/graph`, { waitUntil: "load", timeout: 60_000 });
    await warteAufAnzahl(28);
    const ausgang = (await s.evaluate<string[]>(fn(IDS))).sort();
    expect(ausgang, "die Liste traegt genau die 28 angelegten Objekte").toEqual(
      [...kennung.values()].sort(),
    );

    // GEOMETRIE: das Filterfeld in den sichtbaren Bereich, dann messen.
    const geometrie = await s.evaluate<Geometrie>(fn(GEOMETRIE), FILTER);
    console.info(
      `Nacharbeit 4 · GL · Geometrie ${JSON.stringify({ ...geometrie, titel: geometrie.titel.length })}`,
    );
    expect(geometrie.scrollBreite, "kein seitlicher Ueberlauf").toBeLessThanOrEqual(
      geometrie.breite,
    );
    expect(geometrie.filter.links).toBeGreaterThanOrEqual(0);
    expect(geometrie.filter.rechts).toBeLessThanOrEqual(geometrie.breite);
    expect(geometrie.filter.oben).toBeGreaterThanOrEqual(0);
    expect(geometrie.filter.unten).toBeLessThanOrEqual(844);
    expect(geometrie.filter.hoehe, "das Filterfeld ist bedienbar hoch").toBeGreaterThanOrEqual(24);
    expect(geometrie.titel.map((t) => t.text).sort(), "jeder Titel steht vollstaendig").toEqual(
      [...TITEL].sort(),
    );
    for (const t of geometrie.titel) {
      expect(t.links, `${t.text}: links im Fenster`).toBeGreaterThanOrEqual(0);
      expect(t.rechts, `${t.text}: rechts im Fenster`).toBeLessThanOrEqual(geometrie.breite);
    }

    // ECHTE EINGABE eines unterscheidenden Titelteils → genau die erwartete Kennung.
    const erfassen = "NUTZERPRUEFUNG Erfassen Langtext 20260905-1900";
    const erfassenId = kennung.get(erfassen) ?? "?";
    await s.click(FILTER);
    await s.keyboard.type("Erfassen Langtext");
    await warteAufAnzahl(1);
    expect(await s.evaluate<string[]>(fn(IDS))).toEqual([erfassenId]);
    const treffer = `[data-testid="graph-objekt"][data-id="${erfassenId}"] a`;
    const lage = await s.evaluate<{ links: number; rechts: number; hoehe: number }>(
      fn(LAGE),
      treffer,
    );
    expect(lage.links).toBeGreaterThanOrEqual(0);
    expect(lage.rechts).toBeLessThanOrEqual(390);
    expect(lage.hoehe).toBeGreaterThan(0);

    // (1) ECHTER MAUSKLICK.
    await s.click(treffer);
    await pruefeZiel(erfassenId, erfassen);

    // (2) ZURUECK, neuer Titelteil, dann TAB + ENTER vom Filterfeld aus.
    await zurueckZurListe();
    const bibliothek = "NUTZERPRUEFUNG Bibliothek Langtext 20260905-175543";
    const bibliothekId = kennung.get(bibliothek) ?? "?";
    await s.click(FILTER);
    await s.keyboard.type("Bibliothek Langtext");
    await warteAufAnzahl(1);
    expect(await s.evaluate<string[]>(fn(IDS))).toEqual([bibliothekId]);
    let erreicht = false;
    for (let i = 0; i < 6 && !erreicht; i++) {
      await s.keyboard.press("Tab");
      erreicht = await s.evaluate<boolean>(fn(FOKUS), bibliothekId);
    }
    expect(erreicht, "der Treffer ist per Tab erreichbar").toBe(true);
    await s.keyboard.press("Enter");
    await pruefeZiel(bibliothekId, bibliothek);

    // (3) ZURUECKSETZEN → die urspruengliche Graphmenge.
    await zurueckZurListe();
    await s.click(FILTER);
    await s.keyboard.type("Langtext");
    await warteAufAnzahl(2);
    await s.fill(FILTER, "");
    await warteAufAnzahl(28);
    expect((await s.evaluate<string[]>(fn(IDS))).sort()).toEqual(ausgang);

    // R-0744 · der Qualitaetsblick am echten Server: gewaehlt, jede Zahl mit Nenner. Gewartet wird,
    // bis keine Zeile mehr „wird erhoben" sagt (die Abfragen starten erst mit der Wahl).
    await s.click('[data-testid="graph-qb-schalter"]');
    await s.waitForFunction(fn(QB_STEHT), undefined, { timeout: 30_000 });
    const t = i18n.getFixedT("de");
    const qb = await s.evaluate<Record<string, string>>(fn(QB));
    console.info(`Nacharbeit 4 · GL · Qualitaetsblick ${JSON.stringify(qb)}`);
    // Kein Objekt traegt ein Schlagwort: 28 von 28 ohne Thema — eine Zahl, die feststeht.
    expect(qb.luecken).toBe(
      t("wissensgraph.qb.quote", { was: t("wissensgraph.qb.luecken"), anzahl: 28, nenner: 28 }),
    );
    for (const k of ["konflikte", "veraltet", "dubletten"]) {
      expect(qb[k], `${k}: Nenner 28 oder ehrlich „nicht erhoben“`).toMatch(
        / von 28$|nicht erhoben$/,
      );
    }
    expect(qb.alter).not.toBe(t("wissensgraph.qb.alterUnbekannt"));
  }, 180_000);
});
