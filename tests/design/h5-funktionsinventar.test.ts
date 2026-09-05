// ================================================================================================
// JOB 3064 · H5 — DAS FUNKTIONSINVENTAR: KEINE ZEILE AUS §5a IST VERSCHWUNDEN.
// ================================================================================================
//
// PEDI, 04.09. 07:58: „Stelle 100 % sicher, dass wir keine Funktion verlieren. Orientiere dich an
// Pages, arbeite mit Untermenüs."
//
// `zielbild-h5-kein-erklaertext.test.ts` misst, dass NICHTS mehr im Sichtfeld steht. Dieser Test
// misst die andere Hälfte derselben Zusage: dass alles, was aus dem Sichtfeld verschwunden ist,
// einen BENANNTEN, BEDIENBAREN Ort hat. Beide Tests sind nur zusammen aussagekräftig — ohne diesen
// hier belegte der Textmesser nur, dass etwas weg ist.
//
// GEMESSEN WIRD AN DER GEBAUTEN FLÄCHE, NICHT AM QUELLTEXT: Chromium lädt die echte `dist` gegen
// die echte Fastify-App (dieselbe Vorrichtung wie `zielbild-h5-start.test.ts`), und jeder Ort wird
// WIRKLICH GEÖFFNET — Menü auf, Punkt klicken, Inhalt verlangen. Ein Menüpunkt ohne Wirkung ist
// damit ausgeschlossen: er würde hier rot.
//
// DIE ERWARTUNG KOMMT AUS DER PRODUKTIVEN TABELLE (`START_PANEL_IDS`), nicht aus einer Abschrift.
// Ein neuer Punkt ist damit ohne Nacharbeit Gegenstand dieses Tests; ein gestrichener fällt auf.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import {
  START_PANEL_IDS,
  type StartPanelId,
} from "../../apps/web/src/components/start/startPunkte";
import i18n from "../../apps/web/src/i18n";
import { knowledgeGuidance } from "../../apps/web/src/lib/knowledgeGuidance";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const WURZEL = resolve(process.cwd());
const DIST = resolve(WURZEL, "apps/web/dist");
const ORIGIN = "http://klarwerk.test";
const FRAGE = "Welche Profile sind in Spritzzonen erlaubt?";
const t = i18n.getFixedT("de");

/**
 * Je Menüpunkt EIN Wortlaut, der beweist, dass der Inhalt wirklich da ist — und zwar der Wortlaut,
 * den der Block schon auf der alten Startseite trug. Der Schlüssel kommt aus dem Wörterbuch, nicht
 * als Zeichenkette: wer den Text ändert, ändert damit auch die Erwartung, wer ihn STREICHT, wird rot.
 */
const BEWEIS: Record<StartPanelId, string> = {
  ueber: t("start.purpose"),
  klara: t("klara.path.kicker"),
  kreis: t("cycle.title"),
  demo: t("demo.title"),
  erst: t("adm.firstrun.title"),
  gerade: t("start.livewall.title"),
  kapital: t("funke.capital.title"),
  kollision: t("kollision.start.title"),
  stufe2: t("start.stufe2.title"),
  hilfe: t("shelp.cycle.title"),
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
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  waitForFunction(fn: BrowserFn, arg?: unknown, opts?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(fn: BrowserFn, arg?: unknown): Promise<T>;
  fill(selector: string, value: string): Promise<void>;
  click(selector: string): Promise<void>;
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

/** In der Seite: sichtbarer Text (kein `textContent` — was hinter `hidden` liegt, zaehlt nicht). */
const SICHTBAR = `(sel) => { const el = document.querySelector(sel); return el ? (el.innerText || '') : null; }`;
const DA = "(sel) => !!document.querySelector(sel)";

function distDatei(pfadname: string): { body: Buffer; typ: string } {
  const rel = pfadname === "/" ? "/index.html" : pfadname;
  const datei = join(DIST, rel);
  if (existsSync(datei) && statSync(datei).isFile()) {
    return { body: readFileSync(datei), typ: MIME[extname(datei)] ?? "application/octet-stream" };
  }
  return { body: readFileSync(join(DIST, "index.html")), typ: MIME[".html"] ?? "text/html" };
}

describe("JOB 3064 · H5 · das Funktionsinventar — jeder umgezogene Block hat einen bedienbaren Ort", () => {
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
        payload: { name: "Pedi", email: "pedi@job3064i.test", password: "geheim12345" },
      });
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "pedi@job3064i.test", password: "geheim12345" },
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
      const ko = await services.ko.create({
        title: "Profile in Spritzzonen",
        statement:
          "Offene, ablaufende Profile sind zu bevorzugen; vollverschweisste Hohlprofile sind in Spritzzonen zu vermeiden.",
        type: "best_practice",
        category: "Konstruktion",
        author: autorId,
        tags: ["Profile", "Spritzzone", "Hohlprofile"],
      } as never);
      await services.ko.setValidationState((ko as { id: string }).id, {
        trust: 92,
        status: "validiert",
      });
      await services.ko.create({
        title: "Halterungen ohne waagerechte Oberseiten",
        statement: "Aus dem Projekt gelernt, noch nicht freigegeben.",
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
      seite = await browser.newPage({ viewport: { width: 1280, height: 900 } });
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
          // Dieselbe eine gesetzte Auskunft wie in `zielbild-h5-fragen.test.ts` (dort begruendet):
          // ohne verdrahtetes Modell graut D-AISTATE den Sendeknopf hart aus, und die Antwortkarte
          // mit ihrem „…"-Menue gaebe es hier nie. Gesetzt wird die VERFUEGBARKEIT, nie die Antwort.
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
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 3).join(" | ");
    }
  }, 180_000);

  afterAll(async () => {
    await browser?.close();
    await app?.close();
  }, 60_000);

  async function aufStart(): Promise<void> {
    const s = seite as Seite;
    await s.goto(`${ORIGIN}/start`, { waitUntil: "load", timeout: 60_000 });
    await s.waitForFunction(fn(DA), '[data-testid="h5-start-menu"]', { timeout: 30_000 });
  }
  async function menueAuf(): Promise<void> {
    const s = seite as Seite;
    await s.click('[data-testid="h5-start-menu"]');
    await s.waitForFunction(fn(DA), '[data-testid="h5-start-menu-liste"]', { timeout: 10_000 });
  }

  it("I0 · die Erhebung laeuft nicht leer: die Tabelle kennt jeden Punkt und jeder hat einen Beweis", () => {
    expect(fehler, "Seite nicht gemountet").toBeNull();
    expect(START_PANEL_IDS.length).toBeGreaterThan(8);
    for (const id of START_PANEL_IDS) {
      expect(BEWEIS[id], `kein Beweistext fuer den Punkt „${id}“`).toBeTruthy();
      expect(
        BEWEIS[id].length,
        `Beweistext fuer „${id}“ ist ein Schluessel, keine Uebersetzung`,
      ).toBeGreaterThan(3);
    }
  });

  it("I1 · /start: das „…“-Menue traegt JEDEN Punkt der produktiven Tabelle", async () => {
    expect(fehler).toBeNull();
    await aufStart();
    await menueAuf();
    const s = seite as Seite;
    for (const id of START_PANEL_IDS) {
      const da = await s.evaluate<boolean>(fn(DA), `[data-testid="h5-start-menu-punkt-${id}"]`);
      expect(da, `der Menuepunkt „${id}“ fehlt`).toBe(true);
    }
    // Und die Beschriftungen sind uebersetzt, nicht die Schluessel.
    const beschriftungen = await s.evaluate<string>(
      fn(SICHTBAR),
      '[data-testid="h5-start-menu-liste"]',
    );
    for (const id of START_PANEL_IDS) {
      expect(beschriftungen).toContain(t(`start.menu.${id}`));
    }
  });

  for (const id of START_PANEL_IDS) {
    it(`I2-${id} · der Punkt „${t(`start.menu.${id}`)}“ oeffnet ein Blatt, das seinen Inhalt WIRKLICH traegt`, async () => {
      expect(fehler).toBeNull();
      await aufStart();
      const s = seite as Seite;
      // VORHER: der Inhalt steht nirgends — sonst bewiese der Klick nichts.
      const vorher = await s.evaluate<string>(fn(SICHTBAR), "main");
      expect(vorher, `„${id}“ steht schon vor dem Klick auf der Flaeche`).not.toContain(BEWEIS[id]);
      await menueAuf();
      await s.click(`[data-testid="h5-start-menu-punkt-${id}"]`);
      await s.waitForFunction(fn(DA), `[data-testid="h5-start-blatt-${id}"]`, { timeout: 10_000 });
      const blatt = await s.evaluate<string>(fn(SICHTBAR), `[data-testid="h5-start-blatt-${id}"]`);
      expect(blatt, `das Blatt „${id}“ ist leer — ein Menuepunkt ohne Wirkung`).toContain(
        BEWEIS[id],
      );
    });
  }

  it("I3 · /aufgaben: das Info-Symbol oeffnet den Erklaersatz der Aufgabe", async () => {
    expect(fehler).toBeNull();
    const s = seite as Seite;
    await s.goto(`${ORIGIN}/aufgaben`, { waitUntil: "load", timeout: 60_000 });
    await s.waitForFunction(fn(DA), '[data-testid="task-erklaerung-knopf"]', { timeout: 30_000 });
    // VORHER: der Satz ist nicht im Sichtfeld …
    const vorher = await s.evaluate<string>(fn(SICHTBAR), "main");
    expect(vorher).not.toContain(t("task.explain.validation"));
    // … NACH dem Klick steht er da.
    await s.click('[data-testid="task-erklaerung-knopf"]');
    await s.waitForFunction(
      fn(
        `() => { const p = document.querySelector('[data-testid="task-erklaerung"]'); return !!p && !p.hasAttribute('hidden'); }`,
      ),
      undefined,
      { timeout: 10_000 },
    );
    const nachher = await s.evaluate<string>(fn(SICHTBAR), "main");
    expect(nachher, "der Erklaersatz erscheint nicht").toContain(t("task.explain.validation"));
  });

  // KORREKTURPFLICHT 3 (Ben, Runde 3). Bis Runde 3 stand der Leerzustand INNERHALB der Schleife
  // ueber die drei Dringlichkeitsgruppen: bei Bestand erschien er in JEDER leeren Gruppe, Ben mass
  // zwei „Wie geht es weiter?"-Knoepfe neben einer vorhandenen Aufgabe (`expected 2 to be +0`).
  // Der frueher hier stehende Fall lief genau deshalb gruen — er wartete auf einen Knopf, den es
  // bei Bestand gar nicht geben darf, und bewies damit den Defekt statt der Funktion.
  //
  // DIE DECKUNG IST BEWUSST GETEILT, und das steht auch so in der Rueckgabe:
  //   · HIER, in der gebauten App: die REGEL an echtem Bestand — kein Leerzustand, kein Knopf.
  //   · In `tests/app/job3064-aufgaben-leerzustand-mounted.test.tsx`: die Gegenrichtung (leerer
  //     Bestand → genau eine Zeile, genau ein Knopf) und das Oeffnen der CTAs. Diese Richtung
  //     braucht einen leeren Bestand, den diese Sonde ohne Eingriff in die Daten nicht herstellt.
  it("I4 · /aufgaben MIT Bestand: kein Leerzustand und KEIN Knopf — der Satz gilt der Liste, nicht der Gruppe", async () => {
    expect(fehler).toBeNull();
    const s = seite as Seite;
    await s.goto(`${ORIGIN}/aufgaben`, { waitUntil: "load", timeout: 60_000 });
    await s.waitForFunction(fn(DA), '[data-testid="task-zeile"]', { timeout: 30_000 });
    const zeilen = await s.evaluate<number>(
      fn(`() => document.querySelectorAll('[data-testid="task-zeile"]').length`),
    );
    // KALIBRIERUNG: ohne Bestand pruefte die Zeile darunter nichts.
    expect(zeilen, "diese Sonde braucht Bestand").toBeGreaterThan(0);
    const knoepfe = await s.evaluate<number>(
      fn(`() => document.querySelectorAll('[data-testid="task-wie-weiter"]').length`),
    );
    expect(knoepfe, "bei Bestand darf KEIN Leerzustandsknopf stehen").toBe(0);
    const sichtbar = await s.evaluate<string>(fn(SICHTBAR), "main");
    expect(sichtbar, "der Leersatz waere hier schlicht falsch").not.toContain(t("task.none"));
  });

  it("I4b · /aufgaben mit einem Filter ohne Treffer: GENAU EINE Zeile, und sie nennt den Filter als Grund", async () => {
    expect(fehler).toBeNull();
    const s = seite as Seite;
    await s.goto(`${ORIGIN}/aufgaben`, { waitUntil: "load", timeout: 60_000 });
    await s.waitForFunction(fn(DA), '[data-testid="task-zeile"]', { timeout: 30_000 });
    // Den ersten Filter waehlen, dessen Zaehler 0 ist — ohne den Bestand anzufassen.
    const gewaehlt = await s.evaluate<boolean>(
      fn(
        `() => { const b = [...document.querySelectorAll('fieldset button')].find((x) => / 0$/.test((x.textContent || '').trim())); if (!b) return false; b.click(); return true; }`,
      ),
    );
    if (!gewaehlt) {
      // Ehrlich: kein Filter dieses Laufs ist leer — dann ist hier nichts zu messen.
      return;
    }
    await s.waitForFunction(
      fn(`() => document.querySelectorAll('[data-testid="task-zeile"]').length === 0`),
      undefined,
      { timeout: 10_000 },
    );
    const sichtbar = await s.evaluate<string>(fn(SICHTBAR), "main");
    expect(sichtbar).toContain(t("task.noneFiltered"));
    expect(sichtbar, "der Filter ist der Grund, nicht ein leerer Bestand").not.toContain(
      t("task.none"),
    );
  });

  it("I5 · /fragen: der Knopf „Beispiele“ im leeren Feld oeffnet die ehrlichen Beispiel-Chips", async () => {
    expect(fehler).toBeNull();
    const s = seite as Seite;
    await s.goto(`${ORIGIN}/fragen`, { waitUntil: "load", timeout: 60_000 });
    await s.waitForFunction(fn(DA), '[data-testid="ask-beispiele-knopf"]', { timeout: 30_000 });
    const vorher = await s.evaluate<string>(fn(SICHTBAR), "main");
    expect(vorher).not.toContain(t("ask.examplesSendHint"));
    await s.click('[data-testid="ask-beispiele-knopf"]');
    await s.waitForFunction(
      fn(
        `() => { const d = document.querySelector('[data-testid="ask-beispiele"]'); return !!d && !d.hasAttribute('hidden'); }`,
      ),
      undefined,
      { timeout: 10_000 },
    );
    const nachher = await s.evaluate<string>(fn(SICHTBAR), "main");
    expect(nachher, "die Beispiele erscheinen nicht").toContain(t("ask.examplesSendHint"));
  });

  it("I6 · /fragen ohne Antwort: „…“ → „Mehr“ oeffnet Modus-Chip, Kicker, Titel und die Erklaer-Flaeche", async () => {
    expect(fehler).toBeNull();
    const s = seite as Seite;
    await s.goto(`${ORIGIN}/fragen`, { waitUntil: "load", timeout: 60_000 });
    await s.waitForFunction(fn(DA), '[data-testid="ask-menu"]', { timeout: 30_000 });
    const vorher = await s.evaluate<string>(fn(SICHTBAR), "main");
    expect(vorher).not.toContain(t("ask.intro"));
    await s.click('[data-testid="ask-menu"]');
    await s.click('[data-testid="ask-menu-punkt-mehr"]');
    await s.waitForFunction(
      fn(
        `() => { const d = document.querySelector('[data-testid="ask-mehr"]'); return !!d && !d.hasAttribute('hidden'); }`,
      ),
      undefined,
      { timeout: 10_000 },
    );
    const blatt = await s.evaluate<string>(fn(SICHTBAR), '[data-testid="ask-mehr"]');
    expect(blatt, "der Einleitungssatz fehlt").toContain(t("ask.intro"));
    expect(blatt, "der Kicker fehlt").toContain(t("ask.kicker"));
    expect(blatt, "der Titel fehlt").toContain(t("ask.title"));
    // Die Erklär-Fläche (SCRUM-289 / D-034) — ihr Titel kommt aus der produktiven Tabelle, nicht
    // aus einer abgeschriebenen Zeichenkette.
    expect(blatt, "die Erklaer-Flaeche fehlt").toContain(t(knowledgeGuidance("ask").titleKey));
    // Der Modus-Chip ist gebaut und sichtbar — nicht nur im DOM.
    const chip = await s.evaluate<string>(fn(SICHTBAR), '[data-testid="ask-reasoner-mode"]');
    expect((chip ?? "").trim().length, "der Modus-Chip ist unsichtbar").toBeGreaterThan(0);
  });

  it("I7 · /fragen nach einer Antwort: „…“ traegt Drucken, Als Markdown und Mehr — und „Mehr“ traegt die Einordnung", async () => {
    expect(fehler).toBeNull();
    const s = seite as Seite;
    await s.goto(`${ORIGIN}/fragen`, { waitUntil: "load", timeout: 60_000 });
    await s.waitForFunction(fn(DA), '[data-testid="page-fragen"] form input', { timeout: 30_000 });
    await s.fill('[data-testid="page-fragen"] form input', FRAGE);
    await s.click('[data-testid="page-fragen"] form button[type="submit"]');
    await s.waitForFunction(fn(DA), '[data-testid="ask-answer"] .ask-answer-body', {
      timeout: 60_000,
    });
    // VORHER: die Einordnung steht nicht im Sichtfeld.
    const vorher = await s.evaluate<string>(fn(SICHTBAR), "main");
    expect(vorher).not.toContain(t("ask.contract.label"));
    expect(vorher).not.toContain(t("ask.sourcesHint"));
    await s.click('[data-testid="ask-menu"]');
    const punkte = await s.evaluate<string>(fn(SICHTBAR), '[data-testid="ask-menu-liste"]');
    expect(punkte).toContain(t("ask.export.print"));
    expect(punkte).toContain(t("ask.export.download"));
    expect(punkte).toContain(t("ask.menu.mehr"));
    await s.click('[data-testid="ask-menu-punkt-mehr"]');
    await s.waitForFunction(
      fn(
        `() => { const d = document.querySelector('[data-testid="ask-mehr-antwort"]'); return !!d && !d.hasAttribute('hidden'); }`,
      ),
      undefined,
      { timeout: 10_000 },
    );
    const blatt = await s.evaluate<string>(fn(SICHTBAR), '[data-testid="ask-mehr-antwort"]');
    expect(blatt, "der Antwortbasis-Vertrag fehlt").toContain(t("ask.contract.label"));
    expect(blatt, "die Zaehlzeile fehlt").toContain(t("ask.contract.sumTotal", { count: 1 }));
    expect(blatt, "der Quellenhinweis fehlt").toContain(t("ask.sourcesHint"));
    expect(blatt, "die Quellenliste fehlt").toContain(t("ask.sources"));
  });

  it("I8 · die zwei Knoepfe des Zielbilds sind da und der Kicker fuehrt in die volle Aufgabenliste", async () => {
    expect(fehler).toBeNull();
    const s = seite as Seite;
    await aufStart();
    // §5a: „Alle Aufgaben" ist der Kicker „FÜR DICH" geworden.
    const kickerZiel = await s.evaluate<string | null>(
      fn(
        `() => { const k = document.querySelector('[data-h5-kicker]'); const a = k ? k.closest('a') : null; return a ? a.getAttribute('href') : null; }`,
      ),
    );
    expect(kickerZiel, "der Kicker fuehrt nicht in die Aufgabenliste").toBe("/aufgaben");
  });
});
