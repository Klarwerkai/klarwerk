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
import { FAEHIGKEITEN } from "../../apps/web/src/lib/faehigkeiten";
import { knowledgeGuidance } from "../../apps/web/src/lib/knowledgeGuidance";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const WURZEL = resolve(process.cwd());
const DIST = resolve(WURZEL, "apps/web/dist");
// Folgeauftrag gesamt-erstnutzerfuehrung-quellen, Nacharbeit 4 — WARUM `https`: I12 misst einen
// SCHREIBWEG (Einreichen). Unter `http://klarwerk.test` ist der Kontext für Chromium nicht sicher,
// `crypto.randomUUID` fehlt, und der Vorgangsschlüssel (`lib/createOperation.ts`) wirft —
// gemessen am Kandidaten 039d5468: „crypto.randomUUID is not a function“ in der Lagezeile des
// Blatts. Dieselbe Umstellung wie h4/h6 (`tests/vorrichtung-sicherer-kontext/`); alle Anfragen
// beantwortet weiterhin die Route unten, ein Zertifikat ist nicht im Spiel.
const ORIGIN = "https://klarwerk.test";
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

// R-0455 / R-0939 (Folgeauftrag gesamt-erstnutzerfuehrung-quellen, Nacharbeit 3): die Kennungen der
// beiden angelegten Einträge — verglichen wird mit der Kennung, die der DIENST vergeben hat, nicht mit
// einem Titel. Und die Sitzung, mit der der Browser gerade spricht: die Admin-Sitzung (Vorgabe) oder
// die der zweiten, prüfenden Person (I12b). Gewechselt wird nur zwischen zwei ECHTEN Anmeldungen.
let profilId = "";
let halterungId = "";
let tokenAdmin = "";
let tokenPruefer = "";
let tokenAktiv = "";

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
      profilId = (ko as { id: string }).id;
      const halterung = await services.ko.create({
        title: "Halterungen ohne waagerechte Oberseiten",
        statement: "Aus dem Projekt gelernt, noch nicht freigegeben.",
        type: "best_practice",
        category: "Allgemein",
        author: autorId,
      } as never);
      halterungId = (halterung as { id: string }).id;
      tokenAdmin = token;
      tokenAktiv = token;

      // I12 · die zweite Person, die FREMD prüft — angelegt vom Admin über denselben Weg wie in der
      // Verwaltung (`POST /api/users`, Rolle „controller"), angemeldet mit ihrem eigenen Passwort.
      const angelegt = await app.inject({
        method: "POST",
        url: "/api/users",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: "Prüfende Person",
          email: "pruefende@job3064i.test",
          role: "controller",
          password: "pruefen-geheim-4711",
        },
      });
      if (angelegt.statusCode !== 201) {
        throw new Error(`zweite Person nicht angelegt: ${angelegt.statusCode} ${angelegt.body}`);
      }
      const prueferLogin = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "pruefende@job3064i.test", password: "pruefen-geheim-4711" },
      });
      tokenPruefer = (prueferLogin.json() as { token: string }).token;
      await app.inject({
        method: "POST",
        url: "/api/auth/notice",
        headers: { authorization: `Bearer ${tokenPruefer}` },
      });

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
          kopf.authorization = `Bearer ${tokenAktiv}`;
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

  // ==============================================================================================
  // R-1012 (Folgeauftrag gesamt-erstnutzerfuehrung-quellen, Bens Pruefcode-Nacharbeit K4):
  // die Faehigkeitsuebersicht im Blatt „Über KLARWERK“ an der GEBAUTEN App — und ihre Uebergaben.
  // ==============================================================================================
  // I2-ueber verlangt nur den Zwecksatz. Hier wird die Uebersicht selbst verlangt (acht Bereiche,
  // je Name und Zweck, alle als Weg fuer das Testkonto), und fuer Erfassen, Pruefen, Fragen und
  // Bibliothek je ein echter Klick von `/start` aus: Adresse UND ein bedienbares Element der
  // Zielseite. Ein reiner Pfadwechsel genuegt nicht — die Zielseite muss wirklich stehen.
  //
  // DAS KONTO: der erste registrierte Nutzer dieser Sonde. Dass er pruefen darf, belegt I4 schon
  // (Pruefaufgaben in /aufgaben); I9 kalibriert es zusaetzlich: alle acht Eintraege sind Links.
  async function ueberOeffnen(): Promise<void> {
    const s = seite as Seite;
    await aufStart();
    await menueAuf();
    await s.click('[data-testid="h5-start-menu-punkt-ueber"]');
    await s.waitForFunction(fn(DA), '[data-testid="erstnutzer-faehigkeiten"]', { timeout: 10_000 });
  }

  it("I9 · „Über KLARWERK“ zeigt die Faehigkeitsuebersicht: acht Bereiche mit Zweck, alle als Weg", async () => {
    expect(fehler).toBeNull();
    const s = seite as Seite;
    await aufStart();
    const vorher = await s.evaluate<string>(fn(SICHTBAR), "main");
    expect(vorher, "die Uebersicht steht schon im Sichtfeld (H5)").not.toContain(
      t("erstnutzer.faehigkeiten.titel"),
    );
    await ueberOeffnen();
    const blatt = await s.evaluate<string>(fn(SICHTBAR), '[data-testid="erstnutzer-faehigkeiten"]');
    expect(blatt).toContain(t("erstnutzer.faehigkeiten.titel"));
    expect(blatt).toContain(t("erstnutzer.faehigkeiten.einleitung"));
    expect(FAEHIGKEITEN.length).toBe(8);
    for (const f of FAEHIGKEITEN) {
      expect(blatt, `Name „${f.id}“ fehlt`).toContain(t(f.nameKey));
      expect(blatt, `Zweck „${f.id}“ fehlt`).toContain(t(f.textKey));
      const ziel = await s.evaluate<string | null>(
        fn(
          `(sel) => { const a = document.querySelector(sel); return a && a.tagName === 'A' ? a.getAttribute('href') : null; }`,
        ),
        `[data-testid="erstnutzer-faehigkeit-${f.id}"]`,
      );
      expect(ziel, `„${f.id}“ ist fuer das Testkonto kein Weg`).toBe(f.to);
    }
  });

  /** In der Seite: steht das Element, ist es sichtbar, nicht gesperrt und bedienbar? */
  const BEDIENBAR = `(sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      sichtbar: r.width > 0 && r.height > 0,
      gesperrt: !!el.disabled || el.getAttribute('aria-disabled') === 'true' || !!el.closest('[inert]'),
      eingabe: el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA',
    };
  }`;

  type Lage = { sichtbar: boolean; gesperrt: boolean; eingabe: boolean } | null;

  interface Uebergabe {
    id: "erfassen" | "validierung" | "fragen" | "bibliothek";
    /** Das bedienbare Element, an dem die Zielseite erkannt wird. */
    anker: string;
    /** Eingabefeld (true) oder Bedienknopf (false). */
    eingabe: boolean;
    /** Wird in das Feld getippt und wieder gelesen — Beweis, dass es WIRKLICH bedienbar ist. */
    tippen?: string;
  }
  const UEBERGABEN: Uebergabe[] = [
    { id: "erfassen", anker: '[data-testid="blatt-text"] [role="textbox"]', eingabe: true },
    { id: "validierung", anker: '[data-testid="pruefen-reiter-offen"]', eingabe: false },
    {
      id: "fragen",
      anker: '[data-testid="page-fragen"] form input',
      eingabe: true,
      tippen: FRAGE,
    },
    { id: "bibliothek", anker: '[data-testid="bib-suche"]', eingabe: true, tippen: "Profile" },
  ];

  for (const u of UEBERGABEN) {
    it(`I10-${u.id} · von /start ueber „Über KLARWERK“ in die volle Funktion: Adresse und bedienbare Zielseite`, async () => {
      expect(fehler).toBeNull();
      const s = seite as Seite;
      const f = FAEHIGKEITEN.find((x) => x.id === u.id);
      expect(f, `„${u.id}“ steht nicht in der Uebersicht`).toBeDefined();
      const ziel = (f as (typeof FAEHIGKEITEN)[number]).to;
      await ueberOeffnen();
      await s.click(`[data-testid="erstnutzer-faehigkeit-${u.id}"]`);
      await s.waitForFunction(fn("(p) => location.pathname === p"), ziel, { timeout: 30_000 });
      await s.waitForFunction(fn(DA), u.anker, { timeout: 30_000 });
      const lage = await s.evaluate<Lage>(fn(BEDIENBAR), u.anker);
      expect(lage, `${ziel}: Anker ${u.anker} fehlt`).not.toBeNull();
      expect(lage?.sichtbar, `${ziel}: Anker unsichtbar`).toBe(true);
      expect(lage?.gesperrt, `${ziel}: Anker gesperrt`).toBe(false);
      expect(lage?.eingabe, `${ziel}: Anker ist nicht die erwartete Bedienart`).toBe(u.eingabe);
      if (u.tippen) {
        await s.fill(u.anker, u.tippen);
        const wert = await s.evaluate<string | null>(
          fn("(sel) => { const el = document.querySelector(sel); return el ? el.value : null; }"),
          u.anker,
        );
        expect(wert, `${ziel}: das Feld nimmt keine Eingabe an`).toBe(u.tippen);
      }
      // Das Blatt ist zu: die Zielseite steht, nicht mehr die Startseite mit offenem Blatt.
      const blattOffen = await s.evaluate<boolean>(fn(DA), '[data-testid="h5-start-blatt-ueber"]');
      expect(blattOffen, "das Blatt steht noch — keine Uebergabe").toBe(false);
    });
  }

  // ==============================================================================================
  // Gemeinsame Ableser fuer I11/I12 (Nacharbeit 3, Bens Pruefcode K1 und K3).
  // ==============================================================================================
  /** Klickt den ersten BETAETIGBAREN Knopf, dessen Text `text` enthaelt. */
  const KLICK_TEXT = `(text) => {
    const k = [...document.querySelectorAll('button')].find((b) =>
      (b.textContent || '').replace(/\\s+/g, ' ').trim().includes(text)
      && !b.disabled && b.getAttribute('aria-disabled') !== 'true');
    if (!k) return false;
    k.click();
    return true;
  }`;
  /** Steht `satz` sichtbar auf der Seite? */
  const SATZ_SICHTBAR = `(satz) => {
    return (document.body.innerText || '').replace(/\\s+/g, ' ').includes(satz);
  }`;
  /** Die Kennungen der Trefferzeilen der Bibliothek, in Bildreihenfolge. */
  const ZEILEN_IDS = `() => {
    const zeilen = [...document.querySelectorAll('[data-testid="bib-zeile"]')];
    return zeilen.map((z) => z.getAttribute('data-bib-id'));
  }`;
  /** Textinhalt eines Elements (nicht `innerText`: die Pille setzt ihr Wort per CSS in Versalien). */
  const TEXTINHALT = `(sel) => {
    const el = document.querySelector(sel);
    return el ? (el.textContent || '').replace(/\\s+/g, ' ').trim() : null;
  }`;

  async function warte(quelle: string, arg: unknown, was: string, ms = 30_000): Promise<void> {
    try {
      await (seite as Seite).waitForFunction(fn(quelle), arg, { timeout: ms });
    } catch (e) {
      const text = (await (seite as Seite).evaluate<string>(fn(SICHTBAR), "body")) ?? "";
      const grund = String(e).split("\n")[0];
      const auszug = text.replace(/\s+/g, " ").slice(0, 600);
      throw new Error(`${was} — nicht eingetreten (${grund}). Seite: ${auszug}`);
    }
  }

  async function klickText(text: string, was: string): Promise<void> {
    const ok = await (seite as Seite).evaluate<boolean>(fn(KLICK_TEXT), text);
    expect(ok, `${was}: kein betaetigbarer Knopf «${text}»`).toBe(true);
  }

  /** Der Eintrag, wie ihn der DIENST fuehrt — die unabhaengige Gegenseite zur Flaeche. */
  async function koVomDienst(id: string): Promise<{ title?: string; status?: string }> {
    const a = app;
    if (!a) {
      throw new Error("App nicht gebaut");
    }
    const r = await a.inject({
      method: "GET",
      url: `/api/kos/${id}`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
    });
    expect(r.statusCode, `GET /api/kos/${id}: ${r.body.slice(0, 200)}`).toBe(200);
    return r.json() as { title?: string; status?: string };
  }

  /** Wartet, bis die Trefferliste GENAU diese Kennungen zeigt (Menge; leer: samt Leersatz). */
  const LISTE_IST = `([q, ids]) => {
    const f = document.querySelector('[data-testid="bib-suche"]');
    const zeilen = [...document.querySelectorAll('[data-testid="bib-zeile"]')];
    const da = zeilen.map((z) => z.getAttribute('data-bib-id')).sort();
    const leer = !!document.querySelector('[data-testid="bib-leer"]');
    return !!f && f.value === q && JSON.stringify(da) === JSON.stringify([...ids].sort())
      && (ids.length > 0 || leer);
  }`;

  /** Suchen und warten, bis genau die erwarteten Treffer dastehen; danach ausdruecklich ablesen. */
  async function bibliothekSuchen(begriff: string, erwartet: readonly string[]): Promise<void> {
    const s = seite as Seite;
    await s.fill('[data-testid="bib-suche"]', begriff);
    await listeIst(begriff, erwartet);
  }

  async function listeIst(begriff: string, erwartet: readonly string[]): Promise<void> {
    const s = seite as Seite;
    await warte(LISTE_IST, [begriff, erwartet], `Treffer zu «${begriff}» = ${erwartet.join(",")}`);
    const da = await s.evaluate<string[]>(fn(ZEILEN_IDS));
    expect([...da].sort()).toEqual([...erwartet].sort());
  }

  /** Eine Trefferzeile oeffnen und warten, bis die Leseflaeche DIESEN Eintrag zeigt. */
  async function trefferOeffnen(id: string, titel: string): Promise<void> {
    const s = seite as Seite;
    await s.click(`[data-testid="bib-zeile"][data-bib-id="${id}"]`);
    await warte(
      `([id, titel]) => { const z = document.querySelector('[data-testid="bib-zeile"][data-bib-id="' + id + '"]'); const h = document.querySelector('[data-testid="bib-titel"]'); return !!z && z.getAttribute('aria-current') === 'true' && !!h && (h.textContent || '').trim() === titel && new URLSearchParams(location.search).get('eintrag') === id; }`,
      [id, titel],
      `Leseflaeche zeigt «${titel}» (${id})`,
    );
  }

  /**
   * Der Bereich, den die Trefferzeile dieses Eintrags nennt (`Bereich · Zustand`, BibliothekListe).
   * Nacharbeit 4: der Bereich wird ABGELESEN statt als „Allgemein“ angenommen — der Prueflauf am
   * Kandidaten 039d5468 fand keine waehlbare Option mit diesem Namen.
   */
  async function bereichVon(id: string): Promise<string> {
    const s = seite as Seite;
    const meta = await s.evaluate<string | null>(
      fn(`(id) => {
        const z = document.querySelector('[data-testid="bib-zeile"][data-bib-id="' + id + '"]');
        const m = z ? z.querySelector('[data-bib-text="zeile-meta"]') : null;
        return m ? (m.textContent || '').trim() : null;
      }`),
      id,
    );
    expect(meta, `die Trefferzeile ${id} nennt keinen Bereich`).not.toBeNull();
    return (meta ?? "").split(" · ")[0]?.trim() ?? "";
  }

  /** Das Menue „Bereich" oeffnen, die Option `wert` umschalten und das Menue wieder schliessen. */
  async function bereichUmschalten(wert: string): Promise<void> {
    const s = seite as Seite;
    const OPTION = '[role="menu"] [role="menuitemcheckbox"]';
    await s.click('[data-testid="bib-menue-bereich"]');
    await warte(DA, OPTION, "Bereichsmenue offen");
    const ergebnis = await s.evaluate<{ geklickt: boolean; optionen: string[] }>(
      fn(`([sel, wert]) => {
        const alle = [...document.querySelectorAll(sel)];
        const optionen = alle.map((b) =>
          (b.textContent || '').trim() + (b.disabled ? ' [gesperrt]' : ''));
        const o = alle.find((b) =>
          (b.textContent || '').trim().replace(/^✓/, '').startsWith(wert + ' · ') && !b.disabled);
        if (!o) return { geklickt: false, optionen };
        o.click();
        return { geklickt: true, optionen };
      }`),
      [OPTION, wert],
    );
    expect(
      ergebnis.geklickt,
      `Bereichsoption «${wert}» nicht waehlbar; angeboten: ${ergebnis.optionen.join(" | ")}`,
    ).toBe(true);
    await s.click('[data-testid="bib-menue-bereich"]');
  }

  // ==============================================================================================
  // I11 · R-0455 (K1): FINDEN OHNE ERKLAERUNG — Start → sichtbar benannter Bibliothekslink → Suchraum
  // und Ortszeile → Suche → der TATSAECHLICHE Treffer (Kennung UND Titel) → ausschliessender
  // Bereichsfilter mit sichtbarem Zustand und Nulltreffer → Ruecknahme → derselbe Gegenstand.
  // ==============================================================================================
  it("I11 · R-0455: von /start ueber „Bibliothek“ finden — Suchraum, Treffer mit Kennung, Bereichsfilter und Ruecknahme", async () => {
    expect(fehler).toBeNull();
    const s = seite as Seite;
    tokenAktiv = tokenAdmin;
    await aufStart();

    // Der Link ist SICHTBAR BENANNT und fuehrt OHNE Demo-Parameter in die Bibliothek.
    const LINK = 'a[data-kopfband-punkt="bibliothek"]';
    const link = await s.evaluate<{ href: string | null; text: string } | null>(
      fn(`(sel) => {
        const a = document.querySelector(sel);
        return a ? { href: a.getAttribute('href'), text: (a.innerText || '').trim() } : null;
      }`),
      LINK,
    );
    expect(link, "kein Bibliothekslink im Kopfband").not.toBeNull();
    expect(link?.href).toBe("/bibliothek");
    expect(link?.text).toContain(t("nav.library"));
    await s.click(LINK);
    await warte(
      `() => location.pathname === '/bibliothek' && location.search === ''`,
      undefined,
      "Adresse /bibliothek ohne Parameter",
    );
    await warte(DA, '[data-testid="bib-suche"]', "Suchfeld der Bibliothek");

    // Suchraum und Ortszeile: der gewaehlte Bestand steht sichtbar UEBER dem Suchfeld.
    const raum = await s.evaluate<{
      raum: string | null;
      alle: string | null;
      meine: string | null;
      ortVorFeld: boolean;
      platzhalter: string | null;
    }>(
      fn(`() => {
        const bar = document.querySelector('[data-testid="library-scope-bar"]');
        const feld = document.querySelector('[data-testid="bib-suche"]');
        const alle = document.querySelector('[data-testid="bib-scope-alle"]');
        const meine = document.querySelector('[data-testid="bib-scope-meine"]');
        return {
          raum: bar ? bar.getAttribute('data-raum') : null,
          alle: alle ? alle.getAttribute('aria-pressed') : null,
          meine: meine ? meine.getAttribute('aria-pressed') : null,
          ortVorFeld: !!bar && !!feld
            && !!(bar.compareDocumentPosition(feld) & Node.DOCUMENT_POSITION_FOLLOWING),
          platzhalter: feld ? feld.getAttribute('placeholder') : null,
        };
      }`),
    );
    expect(raum).toEqual({
      raum: "alle",
      alle: "true",
      meine: "false",
      ortVorFeld: true,
      platzhalter: t("lib.searchLabel"),
    });
    const ortszeile = await s.evaluate<string>(fn(SICHTBAR), '[data-testid="library-scope-bar"]');
    expect(ortszeile).toContain(t("lib.ownScope.alle"));
    expect(ortszeile).toContain(t("lib.ownScope.meine"));

    // Suchen und den TATSAECHLICHEN Treffer oeffnen — Kennung des Dienstes, nicht nur der Titel.
    const PROFIL_TITEL = "Profile in Spritzzonen";
    await bibliothekSuchen("Profile", [profilId]);
    await trefferOeffnen(profilId, PROFIL_TITEL);
    const pille = await s.evaluate<string | null>(fn(TEXTINHALT), '[data-testid="bib-pille"]');
    expect(pille).toBe(t("status.validiert"));
    const lesetext = await s.evaluate<string>(fn(SICHTBAR), '[data-testid="bib-text"]');
    expect(lesetext).toContain("Spritzzonen zu vermeiden");
    expect((await koVomDienst(profilId)).title).toBe(PROFIL_TITEL);

    // Ausschliessender Bereichsfilter: der Bereich von „Halterungen …“, abgelesen an seiner Zeile
    // und verschieden von dem des Profils. Die Suche wird vorher geleert, damit die Option waehlbar ist.
    const MENUE_BEREICH = '[data-testid="bib-menue-bereich"]';
    await bibliothekSuchen("", [profilId, halterungId]);
    const ausschliessend = await bereichVon(halterungId);
    expect(ausschliessend.length, "Bereich der Halterungen-Zeile leer").toBeGreaterThan(0);
    expect(ausschliessend, "beide Eintraege im selben Bereich").not.toBe(
      await bereichVon(profilId),
    );
    await bereichUmschalten(ausschliessend);
    // GEGENPROBE zur Kennung: im Filter steht der ANDERE Eintrag.
    await listeIst("", [halterungId]);
    await bibliothekSuchen("Profile", []);
    const leersatz = await s.evaluate<string>(fn(SICHTBAR), '[data-testid="bib-leer"]');
    expect(leersatz).toContain(t("lib.liste.leerSuche"));
    // Der Filterzustand steht SICHTBAR am Menue („Bereich · 1“), nicht nur als Farbe.
    const mitFilter = await s.evaluate<string>(fn(SICHTBAR), MENUE_BEREICH);
    expect(mitFilter).toContain(`${t("lib.menue.bereich")} · 1`);

    // Ruecknahme: derselbe Gegenstand erscheint wieder — dieselbe Kennung, derselbe Titel.
    await bereichUmschalten(ausschliessend);
    await listeIst("Profile", [profilId]);
    const ohneFilter = await s.evaluate<string>(fn(SICHTBAR), MENUE_BEREICH);
    expect(ohneFilter.trim()).toBe(t("lib.menue.bereich"));
    await trefferOeffnen(profilId, PROFIL_TITEL);
  }, 180_000);

  // ==============================================================================================
  // I12 · R-0939 (K3): DIE KERNSCHLEIFE MIT EINEM GEGENSTAND — erfassen (Admin) → fremd pruefen
  // (zweite Person, „controller“) → freigeben (Admin, „Als wahr kennzeichnen“) → wiederfinden.
  // Jeder Uebergang laeuft ueber die regulaere Oberflaeche; der Dienst wird nur GELESEN
  // (`koVomDienst`), nie als Abkuerzung beschrieben (kein `setValidationState`). Kein Modell noetig.
  // Drei Faelle, damit ein Fehlschlag die Station nennt; was sie weitergeben, steht in `neuId`.
  // ==============================================================================================
  const SCHLEIFE_TITEL = "Kühlmittel der Schleifmaschine montags wechseln";
  const SCHLEIFE_TEXT =
    "Das Kühlmittel der Schleifmaschine wird jeden Montag vor Schichtbeginn gewechselt, sonst rostet die Spindel.";
  let neuId = "";

  /** Auf „Prüfen“ den Eintrag mit DIESEM Titel waehlen und warten, bis seine Karte steht. */
  async function pruefkarteWaehlen(id: string): Promise<void> {
    const s = seite as Seite;
    await s.goto(`${ORIGIN}/validierung`, { waitUntil: "load", timeout: 60_000 });
    await warte(
      `(titel) => [...document.querySelectorAll('[data-testid="pruefen-warteschlange-eintrag"]')].some((b) => (b.textContent || '').trim() === titel)`,
      SCHLEIFE_TITEL,
      "der eingereichte Eintrag steht in der Pruef-Warteschlange",
    );
    await s.evaluate<boolean>(
      fn(
        `(titel) => { const b = [...document.querySelectorAll('[data-testid="pruefen-warteschlange-eintrag"]')].find((x) => (x.textContent || '').trim() === titel); if (!b) return false; b.click(); return true; }`,
      ),
      SCHLEIFE_TITEL,
    );
    // Die Karte muss DIESER Gegenstand sein: sie verlinkt seine Kennung.
    await warte(
      `(id) => !!document.querySelector('[data-testid="pruefen-karte"] a[href="/wissen/' + id + '"]')`,
      id,
      `die Pruefkarte zeigt den Eintrag ${id}`,
    );
  }

  it("I12a · R-0939: erfassen — Titel, Text und Vertraulichkeitsstufe im Blatt, einreichen, Kennung festhalten", async () => {
    expect(fehler).toBeNull();
    const s = seite as Seite;
    tokenAktiv = tokenAdmin;
    await s.goto(`${ORIGIN}/erfassen`, { waitUntil: "load", timeout: 60_000 });
    await warte(
      `() => { const t = document.querySelector('[data-testid="blatt-titel"]'); return !!t && !t.disabled && !!document.querySelector('[data-testid="blatt-text"] [role="textbox"]'); }`,
      undefined,
      "das Blatt nimmt Eingaben an",
    );
    await s.fill('[data-testid="blatt-titel"]', SCHLEIFE_TITEL);
    await s.fill('[data-testid="blatt-text"] [role="textbox"]', SCHLEIFE_TEXT);
    // Die Pflichtangabe Vertraulichkeitsstufe (ohne sie bleibt „Einreichen“ wirkungslos).
    await klickText(t("erfassen.werkzeug.vertraulichkeit"), "Werkzeug Vertraulichkeit");
    await warte(SATZ_SICHTBAR, t("conf.level.intern"), "Stufenwahl steht");
    await klickText(t("conf.level.intern"), "Stufe „intern“");
    await s.click('[data-testid="blatt-einreichen"]');
    await warte(
      `() => { const l = document.querySelector('[data-testid="blatt-lage"]'); return !!l && !!l.querySelector('a[href^="/wissen/"]'); }`,
      undefined,
      "die Lagezeile nennt den eingereichten Eintrag",
      60_000,
    );
    const lage = await s.evaluate<{ text: string; href: string | null; titel: string } | null>(
      fn(`() => {
        const l = document.querySelector('[data-testid="blatt-lage"]');
        const a = l ? l.querySelector('a[href^="/wissen/"]') : null;
        if (!l) return null;
        return {
          text: (l.textContent || '').trim(),
          href: a ? a.getAttribute('href') : null,
          titel: a ? (a.textContent || '').trim() : '',
        };
      }`),
    );
    expect(lage?.text).toContain(t("erfassen.eingereicht"));
    expect(lage?.titel).toBe(SCHLEIFE_TITEL);
    neuId = (lage?.href ?? "").slice("/wissen/".length);
    expect(neuId.length, "keine Kennung des eingereichten Eintrags").toBeGreaterThan(0);
    // Der Dienst fuehrt DENSELBEN Gegenstand — zur Pruefung offen.
    const ko = await koVomDienst(neuId);
    expect(ko.title).toBe(SCHLEIFE_TITEL);
    expect(ko.status).toBe("offen");
  }, 180_000);

  it("I12b · R-0939: pruefen — die zweite Person stimmt auf „Prüfen“ zu, der Admin kennzeichnet als wahr", async () => {
    expect(fehler).toBeNull();
    expect(neuId, "I12a hat keine Kennung hinterlassen").not.toBe("");
    const s = seite as Seite;
    const FREIGEBEN = '[data-testid="pruefen-entscheidung-up"]';
    const BETAETIGBAR = `(sel) => {
      const b = document.querySelector(sel);
      return !!b && !b.disabled && b.getAttribute('aria-disabled') !== 'true';
    }`;

    // Die Fremdpruefung, in der Sitzung der zweiten Person.
    tokenAktiv = tokenPruefer;
    await pruefkarteWaehlen(neuId);
    // Solange die Hintergrundpruefung laeuft, ist die Karte reine Anzeige — gewartet wird auf den
    // ZUSTAND „betaetigbar“, nicht auf eine Frist (`lib/validationAiGate.ts`).
    await warte(BETAETIGBAR, FREIGEBEN, "Zustimmen ist betaetigbar", 120_000);
    await s.click(FREIGEBEN);
    await warte(SATZ_SICHTBAR, t("val.decisionSaved"), "Quittung der Fremdpruefung");

    // Die Freigabe, in der Sitzung des Admins: „···“ → „Als wahr kennzeichnen“ → Rueckfrage → Ja.
    tokenAktiv = tokenAdmin;
    await pruefkarteWaehlen(neuId);
    await warte(BETAETIGBAR, FREIGEBEN, "die Karte ist bedienbar", 120_000);
    await s.click('[data-testid="pruefen-menue-karte"]');
    await warte(DA, '[data-testid="pruefen-menue-panel-karte"]', "Kartenmenue offen");
    await klickText(t("val.markTrue"), "Als wahr kennzeichnen");
    await warte(SATZ_SICHTBAR, t("val.markTrueConfirm"), "Rueckfrage vor der Freigabe");
    await klickText(t("val.markTrueYes"), "Freigabe bestaetigen");
    await warte(SATZ_SICHTBAR, t("val.markTrueDone"), "Quittung der Freigabe");
    expect((await koVomDienst(neuId)).status).toBe("validiert");
  }, 300_000);

  it("I12c · R-0939: wiederfinden — derselbe Gegenstand in der Bibliothek, mit seinem Text und dem Pruefstand", async () => {
    expect(fehler).toBeNull();
    expect(neuId, "I12a hat keine Kennung hinterlassen").not.toBe("");
    const s = seite as Seite;
    tokenAktiv = tokenAdmin;
    await aufStart();
    await s.click('a[data-kopfband-punkt="bibliothek"]');
    await warte(DA, '[data-testid="bib-suche"]', "Suchfeld der Bibliothek");
    // Gefunden ueber ein Wort aus dem Titel; verglichen wird mit der Kennung aus I12a.
    await bibliothekSuchen("Kühlmittel", [neuId]);
    await trefferOeffnen(neuId, SCHLEIFE_TITEL);
    const lesetext = await s.evaluate<string>(fn(SICHTBAR), '[data-testid="bib-text"]');
    expect(lesetext.replace(/\s+/g, " ")).toContain(SCHLEIFE_TEXT);
    const pille = await s.evaluate<string | null>(fn(TEXTINHALT), '[data-testid="bib-pille"]');
    expect(pille).toBe(t("status.validiert"));
    // Der Pruefstand an der Flaeche ist der des Dienstes, nicht eine Behauptung der Oberflaeche.
    expect((await koVomDienst(neuId)).status).toBe("validiert");
  }, 180_000);
});
