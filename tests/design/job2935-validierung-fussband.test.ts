// ================================================================================================
// JOB 2935 · D1 — WAS DER UMBAU DER VALIDIERUNGSKARTE SICHTBAR GEMACHT HAT, gemessen an der in
// Chromium GEMOUNTETEN echten Anwendung.
// ================================================================================================
//
// WOZU DIESE DATEI NEBEN `zielbild-validierung.test.ts`: Jener Test misst die neun WERTE des
// Zielbild-Fussbands (Abstaende, Linie, Farben) und haelt sie fest. Er kann aber nicht sehen, ob das
// Fussband ueberhaupt ein Fussband IST — dieselben neun Werte waeren auch an einer schmalen Saeule
// am rechten Kartenrand messbar. Genau so war es bis zu diesem Durchgang: Entscheidung, Zuweisung
// und Verwaltung standen in einer Spalte neben dem Inhalt, und weil sie ihn auf die halbe Breite
// druckten, WURDE DER TITEL DES WISSENSOBJEKTS ABGESCHNITTEN („Project equipment design g…").
//
// Das ist der Schaden, den Pedi mit „peinlich" gemeint hat, und er ist keine Pixelfrage: auf einem
// Pruefboard ist der Titel die einzige Angabe, an der man die Karten auseinanderhaelt.
//
// DREI SAETZE, DIE DER UMBAU ZUSAGT — jeder einzeln gemessen, keiner aus dem Quelltext gelesen:
//   F1  Das Fussband liegt UNTER dem Inhalt, nicht daneben.
//   F2  Der Titel steht vollstaendig da (keine Ellipse mehr).
//   F3  Kategorie und Erstellungsangabe sind durch einen Mittelpunkt getrennt (Zielbild Z. 54) —
//       sie standen auf voller Breite sonst ohne Trenner nebeneinander.
//
// AUFBAU wie in `zielbild-validierung.test.ts`: die ECHTE Anwendung aus `apps/web/dist` in Chromium,
// jeder `/api/*`-Aufruf an die ECHTE Fastify-App, Theme „modern" ueber den Produktschalter gesetzt.
// Kein Nachbau, kein Mock — React mountet `Validation.tsx` selbst, mit einem echten Wissensobjekt.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  SICHT_TOLERANZ_PX,
  type Schrittmessung,
  ersterSichtverlust,
  imFenster,
  ueberDemFenster,
} from "../pruefen-listennavigation/sichtregel";

const DIST = resolve(process.cwd(), "apps/web/dist");
const ORIGIN = "http://klarwerk.test";
// ================================================================================================
// JOB 3061 · H2 — DIE ANKER SIND GEWANDERT, DIE FRAGEN NICHT.
// ================================================================================================
//
// Bis hierher fand diese Datei die Karte über `[data-testid="validation-row"]` und das Fußband über
// den Dauertext „* Rückfrage und Ablehnung brauchen eine Begründung." an seinem rechten Rand. Mit
// den Mockups vom 04.09. trägt die Fläche links eine Warteschlange (das ist jetzt die `validation-
// row`) und rechts EINE Karte; der Begründungshinweis steht im „?"-Menü, nicht mehr auf jeder Karte.
//
// GEMESSEN WIRD WEITERHIN DASSELBE, an den Produktankern der neuen Fläche:
//   · die Karte              `[data-testid="pruefen-karte"]`
//   · das Fußband            `[data-testid="pruefen-fussband"]`
//   · der Titel              der Titel-Link der Karte
//   · die Meta-Zeile         `[data-text="meta"]` — Autor · Bereich · Datum
//
// EINE ZUSICHERUNG HAT IHREN ORT GEWECHSELT und steht deshalb anders da: die Nebenaktionen
// (Zuweisen, Bearbeiten, Löschen) wohnen im „···"-Menü der Karte. „Erreichbar" heisst für sie
// jetzt: nach EINEM Klick auf das Menü — und dann dieselben vier Bedingungen wie vorher (Fläche,
// im Fenster, unverdeckt, nicht gesperrt). Das ist genau die Frage von C4/W4, nur am neuen Ort.
const KARTE_ANKER = '[data-testid="pruefen-karte"]';
// Lang genug, dass er in der alten halben Kartenbreite sicher abgeschnitten wurde.
const TITEL = "Project equipment design guide Rev. 0.91";

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

function distDatei(pfadname: string): { body: Buffer; typ: string } {
  const datei = join(DIST, pfadname === "/" ? "/index.html" : pfadname);
  if (existsSync(datei) && statSync(datei).isFile()) {
    return { body: readFileSync(datei), typ: MIME[extname(datei)] ?? "application/octet-stream" };
  }
  return { body: readFileSync(join(DIST, "index.html")), typ: MIME[".html"] ?? "text/html" };
}

/** In der Seite: Karte, Titel-Link, Fussband (Elternteil des Hinweises) und Erstellungsangabe messen. */
const MESSEN = `([kartenAnker, titel]) => {
  const karte = document.querySelector(kartenAnker);
  if (!karte) return null;
  const band = karte.querySelector('[data-testid="pruefen-fussband"]');
  if (!band) return null;
  const titelEl = [...karte.querySelectorAll('a')].find((a) => (a.textContent || '').trim() === titel);
  const erstellt = karte.querySelector('[data-text="meta"]');
  // Der Inhaltsblock ist das Geschwisterelement VOR dem Band — gegen ihn wird gemessen, nicht gegen
  // den Titel allein: die alte Saeule begann zwar unter der Titelzeile, stand aber neben dem Block.
  const inhalt = band.previousElementSibling;
  const kasten = (el) => { const r = el.getBoundingClientRect(); return { oben: r.top, unten: r.bottom, links: r.left, rechts: r.right, breite: r.width }; };
  return {
    karte: kasten(karte),
    band: kasten(band),
    inhalt: inhalt ? kasten(inhalt) : null,
    titel: titelEl ? kasten(titelEl) : null,
    // F2: schneidet der Titel ab? scrollWidth > clientWidth heisst: Text laenger als sein Kasten.
    titelText: titelEl ? (titelEl.textContent || '').trim() : null,
    titelUeberlauf: titelEl ? titelEl.scrollWidth - titelEl.clientWidth : null,
    // F3: Der Trenner stand bis JOB 3061 als CSS-Inhalt (::before) an der Erstellungsangabe, weil
    // die Etikettenzeile daneben GEZÄHLT wurde und kein zusätzliches Kind vertrug. Diese Zählung
    // gibt es nicht mehr; das Mockup (Pruefen.dc.html:53) schreibt „Autor · Bereich · Datum" als
    // EINE Meta-Zeile. Der Mittelpunkt steht deshalb jetzt im Text selbst — dieselbe Zusage,
    // ohne den Umweg über eine Pseudoelement-Regel.
    trenner: erstellt ? (erstellt.textContent || '') : null,
    erstelltText: erstellt ? (erstellt.textContent || '').trim() : null,
    knoepfeImBand: [...band.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\\*/g, '').trim()).filter(Boolean),
  };
}`;

interface Kasten {
  oben: number;
  unten: number;
  links: number;
  rechts: number;
  breite: number;
}
interface Messung {
  karte: Kasten;
  band: Kasten;
  inhalt: Kasten | null;
  titel: Kasten | null;
  titelText: string | null;
  titelUeberlauf: number | null;
  trenner: string | null;
  erstelltText: string | null;
  knoepfeImBand: string[];
}
let m: Messung | null = null;

describe("JOB 2935 · D1 · die Validierungskarte traegt ihr Fussband unter dem Inhalt — echte Seite in Chromium", () => {
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
        payload: { name: "Pedi", email: "pedi@job2935.test", password: "geheim12345" },
      });
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "pedi@job2935.test", password: "geheim12345" },
      });
      const token = (login.json() as { token: string }).token;
      const me = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { authorization: `Bearer ${token}` },
      });
      const autorId = (me.json() as { id: string }).id;
      await services.ko.create({
        title: TITEL,
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
        fn("(sel) => document.querySelector(sel) !== null"),
        KARTE_ANKER,
        { timeout: 30_000 },
      );
      m = await seite.evaluate<Messung | null>(fn(MESSEN), [KARTE_ANKER, TITEL]);
      console.info(`JOB 2935 D1 · Messung ${JSON.stringify(m)}`);
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 3).join(" | ");
    }
  }, 120_000);

  // Dieselbe Grenze wie in `zielbild-validierung.test.ts`: das Aufraeumen (Chromium und Fastify
  // schliessen) braucht unter der Last des Gesamttors mehr als die zehn Sekunden, die vitest einem
  // Hook ohne eigene Angabe gibt. Kein Messwert haengt daran.
  afterAll(async () => {
    await browser?.close();
    await app?.close();
  }, 60_000);

  it("S · die echte Karte steht, und das Band traegt die drei Entscheidungsknoepfe", () => {
    expect(fehler).toBeNull();
    expect(m).not.toBeNull();
    expect(m?.knoepfeImBand).toEqual(
      expect.arrayContaining(["Freigeben", "Rückfrage", "Ablehnen"]),
    );
  });

  it("F1 · das Fussband liegt UNTER dem Inhaltsblock, nicht daneben — gleiche linke Kante, volle Kartenbreite", () => {
    expect(fehler).toBeNull();
    const inhalt = m?.inhalt;
    const band = m?.band;
    const karte = m?.karte;
    expect(inhalt, "Inhaltsblock vor dem Band nicht gefunden").toBeTruthy();
    if (!inhalt || !band || !karte) return;
    // Daneben hiesse: das Band beginnt auf der Hoehe des Inhalts. Darunter heisst: es beginnt erst,
    // wenn der Inhaltsblock zu Ende ist. Die alte Saeule begann zwar unterhalb der TITELZEILE —
    // gemessen gegen den ganzen Block faellt sie durch (Gegenprobe: 436 px gegen 595 px).
    expect(band.oben).toBeGreaterThanOrEqual(inhalt.unten);
    // Und sie fluchtet mit ihm: dieselbe linke Kante statt eines Einzugs von rund 220 px.
    expect(Math.abs(band.links - inhalt.links)).toBeLessThan(2);
    // Volle Breite: das Band ist nicht mehr die schmale Saeule am rechten Rand. Die Karte hat
    // Innenpolster, deshalb kein exakter Vergleich — aber deutlich mehr als die frueheren ~59 %.
    expect(band.breite / karte.breite).toBeGreaterThan(0.85);
  });

  it("F2 · der Titel steht vollstaendig da — kein Ueberlauf mehr in seinem Kasten", () => {
    expect(fehler).toBeNull();
    expect(m?.titelText).toBe(TITEL);
    // truncate schneidet mit Ellipse ab; messbar ist der Ueberlauf, nicht das „…" im Text.
    expect(m?.titelUeberlauf).toBeLessThanOrEqual(0);
  });

  it("F3 · Kategorie und Erstellungsangabe sind durch einen Mittelpunkt getrennt (Zielbild Z. 54)", () => {
    expect(fehler).toBeNull();
    expect(m?.erstelltText).toMatch(/\d{2}\.\d{2}\.\d{4}/);
    // getComputedStyle serialisiert den Inhalt als Zeichenkette in Anfuehrungszeichen.
    expect(m?.trenner).toContain("·");
  });
});

// ================================================================================================
// JOB 2935 · D2 — DIE ZWEI GRENZEN, DIE D1 NICHT GEMESSEN HAT: Classic-Standard und Word-nahe Breite
// ================================================================================================
//
// BENs Einwand zu D1, sinngemaess und berechtigt: Die Faelle oben setzen `kw.designTheme = "modern"`
// ausdruecklich. **Classic bleibt aber der Auslieferungsstandard** — was Pedi ohne Umschalter sieht,
// war damit gar nicht gemessen. Und ein Fussband, das auf 1280 px traegt, kann in einem schmalen
// Fenster umbrechen, ueberlaufen oder Bedienelemente aus dem Bild schieben.
//
// DIESER BLOCK MISST GENAU DIESE ZWEI LAGEN — und sonst nichts:
//   C  Classic: `kw.designTheme = "classic"` (kein `data-theme` an der Wurzel). Bis JOB 3060 war
//      Classic der Auslieferungsstand und brauchte keinen Schalter; seit H1 ist „modern" die
//      Vorgabe, Classic bleibt wählbar — und wird hier ausdrücklich gewählt, damit die Messung
//      weiterhin die klassische Karte trifft.
//      Fensterbreite wie in D1.
//   W  Word-nahe Breite: derselbe Classic-Standard, Fenster auf WORD_NAHE_BREITE.
//
// WOHER DIE SCHMALE BREITE KOMMT — sie ist nicht gegriffen: Das Aufgabenfenster des Word-Add-ins
// ist im Produkt `w-[340px]` breit (Klara-Panel unter `apps/web/src/components/`, Zeile 355).
//
// WARUM DIE QUELLE HIER OHNE KLASSENNAMEN STEHT — gemessen, nicht Geschmack: Eine fruehere Fassung
// dieses Kopfes nannte die Komponente beim Namen. Damit traf DIESE Datei die Inhaltsachse
// `komponente` des Klara-Regressionsinventars, landete in dessen abgeleiteter Menge und machte K2
// rot („neu im Baum, aber nicht im gepinnten Inventar"). Belegt: ohne diese Aenderungen laeuft das
// Inventar 6/6 gruen (Arbeitsspur `baseline-inventar.txt`), mit dem Klassennamen faellt K2. Das
// Inventar nachzufuehren waere hier der falsche Weg — es liegt ausserhalb der D2-Lease, und der
// Ausloeser ist kein vorgegebener Dateiname, sondern ein Wort in einem Kommentar. Die Angabe
// bleibt vollstaendig, nur der Klassenname entfaellt. Wer die
// Validierungsseite daneben oder in einem aehnlich schmalen Fenster oeffnet, hat kaum mehr Platz.
// 360 px liegt dicht darueber und ist zugleich eine gaengige schmale Geraetebreite — eng genug, um
// einen Ueberlauf zu zeigen, ohne ein Extrem zu erfinden.
//
// KEINE NEUEN ZIELWERTE. Gemessen wird ausschliesslich Struktur: laeuft etwas ueber, ist der Titel
// vollstaendig, sind die drei Entscheidungen und die vorhandenen Nebenaktionen erreichbar. Kein
// Farbwert, kein Abstand, kein Schriftgrad — die gehoeren `zielbild-validierung.test.ts` und dem
// Theme „modern", und dieser Block ruehrt sie nicht an.
const WORD_NAHE_BREITE = 360;

/**
 * Der gemeinsame Massstab beider Messgaenge: „erreichbar".
 *
 * „Erreichbar" ist hier kein Eindruck, sondern vier Bedingungen an einem realen Element: es hat
 * eine Flaeche, es ragt nicht aus dem Fenster, es ist nicht von etwas anderem verdeckt (geprueft
 * per `elementFromPoint` auf seiner Mitte) und es ist nicht gesperrt. Ein Knopf, den man sieht,
 * aber nicht treffen kann, ist nicht erreichbar — genau diesen Fall soll ein schmales Fenster
 * aufdecken.
 *
 * Der Massstab steht als EIN Textbaustein da und wird in beide Messfunktionen eingesetzt, damit
 * das Fussband und das Menue nicht mit zwei verschiedenen Ellen gemessen werden.
 */
const ERREICHBAR_HELFER = `
  const doc = document.documentElement;
  const erreichbar = (el, name) => {
    if (!el) return { name: name, da: false };
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const treffer = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      name: name,
      da: true,
      breite: Math.round(r.width),
      hoehe: Math.round(r.height),
      flaeche: r.width > 1 && r.height > 1,
      ragtRaus: Math.round(r.right - doc.clientWidth),
      frei: !!treffer && (treffer === el || el.contains(treffer) || treffer.contains(el)),
      gesperrt: el.disabled === true,
    };
  };`;

/**
 * ERSTER MESSGANG — die Karte, so wie sie DASTEHT: alle Menues zu.
 *
 * WARUM DAS DER ZUSTAND SEIN MUSS (JOB 3061 R4, Tor-Befund C3/W3 „Freigeben ist von etwas anderem
 * verdeckt: expected false to be true"): Runde 3 hat das „···"-Menue VOR der einen Messung
 * geoeffnet und danach alles gemessen — auch das Fussband. Ein offenes Menue legt aber nach der
 * Bauform des Produkts eine Schliessflaeche ueber das ganze Fenster (`fixed inset-0 z-30`,
 * `apps/web/src/components/pruefen/PruefenMenue.tsx:96`), damit ein Klick daneben es zumacht.
 * `elementFromPoint` auf der Mitte von „Freigeben" traf folglich diese Flaeche, und der Fall meldete
 * „verdeckt" — richtig gemessen, nur am falschen Zustand: WAEHREND ein Menue offen ist, ist der
 * Knopf darunter absichtlich nicht zu treffen, und ein Mensch, der entscheiden will, hat kein Menue
 * offen.
 *
 * Gemessen wird deshalb, was C3/W3 wirklich fragen: Sind die drei Entscheidungen erreichbar, wenn
 * die Karte unberuehrt dasteht? Dass dieser Gang wirklich am zugeklappten Stand misst, ist keine
 * Annahme, sondern ein eigener Messwert (`menueOffen`), den C0 auf `false` festnagelt.
 */
const LAGE = `([kartenAnker, titel]) => {
  const karte = document.querySelector(kartenAnker);
  if (!karte) return null;
  const band = karte.querySelector('[data-testid="pruefen-fussband"]');
  if (!band) return null;
  const titelEl = [...karte.querySelectorAll('a')].find((a) => (a.textContent || '').trim() === titel);
  const kastenVon = (el) => { const r = el.getBoundingClientRect(); return { links: r.left, rechts: r.right, oben: r.top, unten: r.bottom, breite: r.width }; };${ERREICHBAR_HELFER}
  const knopf = (t) => [...band.querySelectorAll('button')].find((b) => (b.textContent || '').replace(/\\*/g, '').trim() === t) || null;
  return {
    theme: doc.getAttribute('data-theme') || '(kein Attribut — Classic)',
    fensterBreite: doc.clientWidth,
    seitenUeberlauf: doc.scrollWidth - doc.clientWidth,
    // Der Beleg, dass dieser Gang am zugeklappten Stand misst — kein Blatt, keine Schliessflaeche.
    menueOffen: document.querySelector('[data-testid^="pruefen-menue-panel-"]') !== null,
    karte: kastenVon(karte),
    karteRagtRaus: Math.round(kastenVon(karte).rechts - doc.clientWidth),
    band: kastenVon(band),
    titelText: titelEl ? (titelEl.textContent || '').trim() : null,
    titelUeberlauf: titelEl ? titelEl.scrollWidth - titelEl.clientWidth : null,
    teile: [
      erreichbar(knopf('Freigeben'), 'Freigeben'),
      erreichbar(knopf('Rückfrage'), 'Rückfrage'),
      erreichbar(knopf('Ablehnen'), 'Ablehnen'),
    ],
  };
}`;

/**
 * ZWEITER MESSGANG — die Nebenaktionen, nachdem ein Mensch das „···"-Menue geoeffnet hat.
 *
 * Die Frage von C4/W4 ist unveraendert („was da ist, muss man treffen koennen"), nur ihr Ort hat
 * gewechselt: Zuweisen, Bearbeiten und Loeschen wohnen seit JOB 3061 im Menueblatt der Karte. Der
 * Massstab ist derselbe wie im ersten Gang; gemessen wird im offenen Zustand, weil das der Zustand
 * ist, in dem ein Mensch diese Aktionen benutzt. Die Schliessflaeche stoert hier nicht: das Blatt
 * liegt mit `z-40` darueber.
 */
const NEBENAKTIONEN = `() => {
  const blatt = document.querySelector('[data-testid="pruefen-menue-panel-karte"]');
  if (!blatt) return null;${ERREICHBAR_HELFER}
  const imBlatt = (t) => [...blatt.querySelectorAll('a,button')].find((e) => (e.textContent || '').replace(/\\s+/g, ' ').trim() === t) || null;
  return [
    erreichbar(blatt.querySelector('select'), 'Zuweisen'),
    erreichbar(imBlatt('Bearbeiten'), 'Bearbeiten'),
    erreichbar(imBlatt('Wissensobjekt löschen'), 'Löschen'),
  ];
}`;

/**
 * Das „···"-Menü der Karte öffnen — genau so, wie ein Mensch es öffnet (ein Klick auf den Auslöser).
 *
 * WARUM DAS EIN EIGENER SCHRITT IST und nicht die erste Zeile von `NEBENAKTIONEN` (JOB 3061 R3,
 * Tor-Befund C4/W4 „keine einzige Nebenaktion auf der Karte gefunden: expected 0 to be greater than
 * 0"): `el.click()` löst in React ein `setState` aus, und React schreibt das Blatt ERST IM NÄCHSTEN
 * Anstrich ins DOM. Steht das `querySelector` auf das Blatt in derselben synchronen Funktion,
 * liest es den Stand VOR dem Anstrich — `blatt` war `null`, alle drei Nebenaktionen kamen als
 * `da: false` zurück, und C4/W4 zählten null vorhandene. Der Klick war also nie das Problem; das
 * fehlende Abwarten war es.
 *
 * Deshalb: klicken, dann mit `waitForFunction` auf das Blatt WARTEN (kein `setTimeout` — die
 * Bedingung ist das Blatt selbst, nicht eine geratene Frist), dann erst messen. Dieselbe Bauform
 * benutzt `h2-funktionsinventar.test.ts` (`OEFFNEN`), wo sie über 99 Zeilen trägt.
 */
const MENUE_OEFFNEN = `(kartenAnker) => {
  const karte = document.querySelector(kartenAnker);
  if (!karte) return false;
  const menue = karte.querySelector('[data-testid="pruefen-menue-karte"]');
  if (!menue) return false;
  menue.click();
  return true;
}`;

const BLATT_DA = `() => document.querySelector('[data-testid="pruefen-menue-panel-karte"]') !== null`;

interface Teil {
  name: string;
  da: boolean;
  breite?: number;
  hoehe?: number;
  flaeche?: boolean;
  ragtRaus?: number;
  frei?: boolean;
  gesperrt?: boolean;
}
interface Lage {
  theme: string;
  fensterBreite: number;
  seitenUeberlauf: number;
  /** War beim ERSTEN Messgang ein Menueblatt offen? Muss `false` sein — C0 haelt es fest. */
  menueOffen: boolean;
  karte: Kasten;
  karteRagtRaus: number;
  band: Kasten;
  titelText: string | null;
  titelUeberlauf: number | null;
  teile: Teil[];
}

let browser2: Browser | null = null;
let app2: ReturnType<typeof buildApp> | null = null;
let fehler2: string | null = null;
let classic: Lage | null = null;
let schmal: Lage | null = null;

describe("JOB 2935 · D2 · dieselbe Karte im Classic-Standard und bei Word-naher Breite", () => {
  beforeAll(async () => {
    try {
      if (!existsSync(join(DIST, "index.html"))) {
        throw new Error("apps/web/dist fehlt — vorher ./tools/build (im Tor laeuft es immer)");
      }
      const services = buildServices();
      app2 = buildApp(services);
      await app2.ready();
      await app2.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "Pedi", email: "pedi@job2935d2.test", password: "geheim12345" },
      });
      const login = await app2.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "pedi@job2935d2.test", password: "geheim12345" },
      });
      const token = (login.json() as { token: string }).token;
      const me = await app2.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { authorization: `Bearer ${token}` },
      });
      const autorId = (me.json() as { id: string }).id;
      await services.ko.create({
        title: TITEL,
        statement: "Halterungen und Profile ohne waagerechte Oberseiten ausfuehren.",
        type: "best_practice",
        category: "Allgemein",
        author: autorId,
      } as never);

      const require = createRequire(import.meta.url);
      const { chromium } = require("playwright") as {
        chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
      };
      // OHNE `--single-process`/`--no-zygote`, anders als im Block oben — und das ist gemessen,
      // nicht Geschmack: Mit diesen Flags scheiterte der ZWEITE Chromium-Start in derselben
      // Testdatei durchgehend an `browser.newPage: Target page, context or browser has been
      // closed` (Protokoll `messung-1.txt`, 10 von 10 Faellen rot, waehrend die D1-Faelle gruen
      // blieben). Ein Einzelprozess-Chromium ueberlebt den Neustart im selben Node-Prozess nicht.
      // An der Messung aendert das nichts: gemessen wird dieselbe gebaute Anwendung.
      browser2 = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-gpu"],
      });

      const a = app2;
      /** Eine Lage: eigenes Fenster, Classic AUSDRÜCKLICH gewählt (kein data-theme an der Wurzel). */
      const lageMessen = async (breite: number, hoehe: number): Promise<Lage | null> => {
        const s = await (browser2 as Browser).newPage({
          viewport: { width: breite, height: hoehe },
        });
        // JOB 3060 · H1: der Auslieferungsstand ist seit H1 „modern" (lib/designTheme.ts,
        // DEFAULT_DESIGN_THEME). Classic ist weiterhin wählbar und heißt weiterhin „kein Attribut";
        // diese Lage misst ihn deshalb mit GESETZTER Wahl — dieselbe Karte, dasselbe Fenster.
        await s.addInitScript(
          `try { localStorage.setItem("kw.designTheme", "classic"); } catch (e) {}`,
        );
        await s.route(`${ORIGIN}/**`, async (route) => {
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
        await s.goto(`${ORIGIN}/validierung`, { waitUntil: "load", timeout: 60_000 });
        await s.waitForFunction(fn("(sel) => document.querySelector(sel) !== null"), KARTE_ANKER, {
          timeout: 30_000,
        });
        // ZWEI MESSGAENGE IN DIESER REIHENFOLGE, und die Reihenfolge ist der Befund aus R4:
        //   1. die unberuehrte Karte — Fussband, Titel, die drei Entscheidungen (alle Menues zu),
        //   2. das geoeffnete „···"-Menue — die drei Nebenaktionen.
        // Umgekehrt oder in einem Gang gemessen, faellt die Schliessflaeche des offenen Menues ueber
        // das Fussband und meldet „Freigeben verdeckt" (Begruendung an `LAGE`).
        const gemessen = await s.evaluate<Lage | null>(fn(LAGE), [KARTE_ANKER, TITEL]);
        if (!gemessen) {
          return null;
        }
        // Erst öffnen, dann auf das Blatt WARTEN, dann messen — die drei Schritte müssen getrennt
        // bleiben (Begründung an `MENUE_OEFFNEN`). Lässt sich das Menü nicht öffnen, ist das ein
        // Befund und keine stille Null: `lageMessen` wirft, und C4/W4 melden ihn über `fehler2`.
        const geoeffnet = await s.evaluate<boolean>(fn(MENUE_OEFFNEN), KARTE_ANKER);
        if (!geoeffnet) {
          throw new Error('das „···"-Menü der Karte war nicht zu finden');
        }
        await s.waitForFunction(fn(BLATT_DA), undefined, { timeout: 30_000 });
        const neben = await s.evaluate<Teil[] | null>(fn(NEBENAKTIONEN));
        if (!neben) {
          throw new Error('das Blatt des „···"-Menüs war nach dem Öffnen nicht zu lesen');
        }
        return { ...gemessen, teile: [...gemessen.teile, ...neben] };
      };

      classic = await lageMessen(1280, 900);
      schmal = await lageMessen(WORD_NAHE_BREITE, 900);
      console.info(`JOB 2935 D2 · Classic ${JSON.stringify(classic)}`);
      console.info(`JOB 2935 D2 · Schmal ${JSON.stringify(schmal)}`);
    } catch (e) {
      fehler2 = String(e).split("\n").slice(0, 3).join(" | ");
    }
  }, 180_000);

  afterAll(async () => {
    await browser2?.close();
    await app2?.close();
  }, 60_000);

  it("C0 · der Classic-Standard ist wirklich gemessen — kein Theme-Attribut an der Wurzel", () => {
    expect(fehler2).toBeNull();
    expect(classic).not.toBeNull();
    // Ohne diese Zusicherung koennte der Block unbemerkt wieder „modern" messen und waere
    // eine zweite Kopie der Faelle oben.
    expect(classic?.theme).toBe("(kein Attribut — Classic)");
    expect(schmal?.theme).toBe("(kein Attribut — Classic)");
    expect(schmal?.fensterBreite).toBeLessThanOrEqual(WORD_NAHE_BREITE);
    // Und die zweite Zusicherung an den Messaufbau (JOB 3061 R4): Karte und Fussband sind an der
    // UNBERUEHRTEN Flaeche gemessen. Ohne diese Zeile koennte C3/W3 unbemerkt wieder gegen ein
    // offenes Menue messen — und dann sagt „Freigeben ist verdeckt" nichts ueber die Karte aus.
    expect(classic?.menueOffen, "beim Messen der Karte war ein Menü offen").toBe(false);
    expect(schmal?.menueOffen, "beim Messen der Karte war ein Menü offen").toBe(false);
  });

  for (const [kennung, lage] of [
    ["C", () => classic],
    ["W", () => schmal],
  ] as const) {
    const wo = kennung === "C" ? "Classic, 1280 px" : `Classic, ${WORD_NAHE_BREITE} px (Word-nah)`;

    it(`${kennung}1 · ${wo}: die Seite laeuft nicht seitlich ueber, und die Karte ragt nicht aus dem Fenster`, () => {
      expect(fehler2).toBeNull();
      const l = lage();
      expect(l).not.toBeNull();
      if (!l) return;
      // Ein Pixel Toleranz gegen Rundung bei gebrochenen Geraetepixeln.
      expect(
        l.seitenUeberlauf,
        `die Seite scrollt seitlich (${l.seitenUeberlauf} px)`,
      ).toBeLessThanOrEqual(1);
      expect(
        l.karteRagtRaus,
        `die Karte ragt ${l.karteRagtRaus} px aus dem Fenster`,
      ).toBeLessThanOrEqual(1);
    });

    it(`${kennung}2 · ${wo}: der Titel steht vollstaendig da`, () => {
      expect(fehler2).toBeNull();
      const l = lage();
      if (!l) return;
      expect(l.titelText).toBe(TITEL);
      expect(l.titelUeberlauf, "der Titel wird abgeschnitten").toBeLessThanOrEqual(0);
    });

    it(`${kennung}3 · ${wo}: alle drei Entscheidungen sind erreichbar — Flaeche, im Fenster, unverdeckt, nicht gesperrt`, () => {
      expect(fehler2).toBeNull();
      const l = lage();
      if (!l) return;
      for (const name of ["Freigeben", "Rückfrage", "Ablehnen"]) {
        const t = l.teile.find((x) => x.name === name);
        expect(t?.da, `${name} fehlt auf der Karte`).toBe(true);
        expect(t?.flaeche, `${name} hat keine Flaeche (${t?.breite}×${t?.hoehe})`).toBe(true);
        expect(t?.ragtRaus, `${name} ragt ${t?.ragtRaus} px aus dem Fenster`).toBeLessThanOrEqual(
          1,
        );
        expect(t?.frei, `${name} ist von etwas anderem verdeckt`).toBe(true);
        expect(t?.gesperrt, `${name} ist gesperrt`).toBe(false);
      }
    });

    it(`${kennung}4 · ${wo}: die vorhandenen Nebenaktionen bleiben erreichbar`, () => {
      expect(fehler2).toBeNull();
      const l = lage();
      if (!l) return;
      // Nebenaktionen haengen an Rolle und Zustand. Gemessen wird, was DA IST — und was da ist,
      // muss erreichbar sein. Ein fehlendes Element ist kein Fehler dieses Falls; ein vorhandenes,
      // das man nicht treffen kann, schon.
      const vorhanden = l.teile.filter(
        (t) => ["Zuweisen", "Bearbeiten", "Löschen"].includes(t.name) && t.da,
      );
      expect(vorhanden.length, "keine einzige Nebenaktion auf der Karte gefunden").toBeGreaterThan(
        0,
      );
      for (const t of vorhanden) {
        expect(t.flaeche, `${t.name} hat keine Flaeche`).toBe(true);
        expect(t.ragtRaus, `${t.name} ragt ${t.ragtRaus} px aus dem Fenster`).toBeLessThanOrEqual(
          1,
        );
        expect(t.frei, `${t.name} ist verdeckt`).toBe(true);
      }
    });
  }

  it("W5 · und das Fussband bleibt auch schmal ein Fussband — unter dem Inhalt, nicht daneben", () => {
    expect(fehler2).toBeNull();
    const l = schmal;
    if (!l) return;
    // Der Kern von D1, in der engen Lage nachgemessen: Umbricht die Karte, koennte das Band wieder
    // neben den Inhalt rutschen — dann waere der Titel erneut in Gefahr.
    expect(l.band.breite / l.karte.breite).toBeGreaterThan(0.7);
    expect(l.band.oben).toBeGreaterThan(l.karte.oben);
  });
});

// ==================================================================================================
// JOB 3593 · L — DIE LANGE WARTESCHLANGE: bleibt beim Durchgehen auch der ARTIKEL im Bild?
// ==================================================================================================
//
// PEDIS SATZ, um den es geht: „links durch die Artikelliste gehen und rechts den passenden Artikel
// sehen, OHNE jeden Artikel einzeln anzuklicken." JOB 3504 hat die eine Hälfte gebaut und gemessen
// (Pfeiltaste und Rad schalten weiter, rechts steht der richtige Artikel) — und ben hat an derselben
// Runde die andere Hälfte als ungemessen benannt (`archiv/3504/runde-1/ben.md:24`, Prüflücke 6):
//
//     „Browserfall mit langer Liste ergänzen: Auswahl UND rechten Artikel im Viewport messen.
//      `scrollIntoView` bewegt möglicherweise die gesamte Seite; tatsächlicher Sichtverlust ist
//      eine UNBEWIESENE HYPOTHESE."
//
// Ungemessen war sie, weil sie in jsdom gar nicht stellbar ist: dort gibt es kein Layout, jeder
// Kasten ist null gross, und `scrollIntoView` ist ein Spion ohne Wirkung. Sie ist auch keine
// Wertfrage („welcher Titel steht rechts"), sondern eine Geometriefrage („steht er im Bild").
//
// DIESER BLOCK STELLT SIE AN DER ECHTEN SEITE. Er reitet auf demselben Aufbau wie D1/D2 — gebaute
// Anwendung aus `apps/web/dist`, echte Fastify-App, echte Wissensobjekte über `services.ko.create`
// — und ist deshalb KEINE neue Chromium-Startstelle im Sinne von
// `tests/tor-inventar/tor-bestand-vollstaendig.test.ts`: diese Datei steht dort längst.
//
// VIER ZAHLEN JE SCHRITT, an derselben Stelle erhoben (Auftrag §5.2): der Kasten des aktiven
// Eintrags, der Kasten der Karte, die Fenstergrösse und die Rollposition der Seite. Aus ihnen
// folgen ZWEI getrennte Aussagen — „die Auswahl ist im Fenster" (die Zusage von JOB 3504) und „die
// Karte ist im Fenster" (die ungeprüfte). Die Regel dahinter steht als benannte Grösse in
// `tests/pruefen-listennavigation/sichtregel.ts`, nicht als Zahl in den Fällen.
//
// BEIDE BEDIENWEGE, weil Pedi ausdrücklich beides verlangt hat und weil sie im Produkt über
// verschiedene Zuhörer laufen: `onKeyDown` am `<ul>` (`Validation.tsx:1103`) gegen den nativen
// Radlauf mit `passive: false` (`:730-739`). Ein „analog" wäre hier eine Behauptung.
const LANGE_LISTE = 40;
const SCHRITTE = 30;
const EINTRAG_ANKER = '[data-testid="pruefen-warteschlange-eintrag"]';
const SCHLANGE_ANKER = '[data-testid="pruefen-warteschlange"]';
/**
 * Eine Rastung eines gewöhnlichen Mausrads. Das Produkt schaltet ab `RAD_SCHWELLE_PX = 40`
 * (`Validation.tsx:196`) und setzt die Summe danach zurück — ein Schub von 100 px ist also genau
 * EIN Schritt, so wie ein Rastpunkt für einen Menschen genau ein Schritt ist.
 */
const RASTE_PX = 100;

/**
 * In der Seite: die vier Zahlen des Auftrags, plus die Kopplung „steht rechts wirklich dieser
 * Artikel" — und plus die Antwort auf eine Frage, die der Auftrag so nicht vorgesehen hatte.
 *
 * WARUM `window.scrollY` ALLEIN NICHT REICHT (Befund der ersten Messung, Cloud-Lauf
 * ac00d70ed02946f494558b783656d3e4): Nach vierzehn Radschritten war die Warteschlange nach oben aus
 * dem Fenster gewandert — und `window.scrollY` stand trotzdem auf 0. Es rollt also nicht das
 * Fenster, sondern ein Bereich INNERHALB der Seite. Stünde hier nur `window.scrollY`, meldete die
 * Messung „die Seite hat sich nicht bewegt", während vor den Augen des Nutzers alles wandert — eine
 * wahre Zahl, die das Gegenteil des Sachverhalts nahelegt. Gemessen wird deshalb BEIDES: das
 * Fenster und der nächste wirklich rollende Vorfahre der Liste, mit Namen.
 */
const LANG_MESSEN = `([eintragAnker, karteAnker, schlangeAnker]) => {
  const alle = [...document.querySelectorAll(eintragAnker)];
  const aktiv = document.querySelector(eintragAnker + '[aria-current="true"]');
  const karte = document.querySelector(karteAnker);
  const schlange = document.querySelector(schlangeAnker);
  const kasten = (el) => { const r = el.getBoundingClientRect(); return { oben: r.top, unten: r.bottom, links: r.left, rechts: r.right }; };
  const kartenTitel = karte ? karte.querySelector('a[data-text="titel"]') : null;
  // Die Kette der Bereiche, die WIRKLICH rollen — eigene Rollregel UND mehr Inhalt als Platz.
  // Beides zusammen, weil ein 'overflow: auto' ohne Überlauf nichts bewegt und deshalb nichts
  // erklärt. Gesucht wird AB DER LISTE SELBST, nicht erst ab ihrem Elternteil: seit JOB 3593 ist
  // sie der innerste Rollbereich, und genau das soll die Messung zeigen statt voraussetzen.
  const kette = [];
  let p = schlange;
  while (p && p !== document.body && kette.length < 2) {
    const st = getComputedStyle(p);
    if (/(auto|scroll|overlay)/.test(st.overflowY) && p.scrollHeight > p.clientHeight + 1) {
      kette.push({
        name: p.tagName + '[' + (p.getAttribute('data-testid') || p.className.toString().slice(0, 40)) + ']',
        top: Math.round(p.scrollTop * 100) / 100,
      });
    }
    p = p.parentElement;
  }
  return {
    anzahl: alle.length,
    index: aktiv ? alle.indexOf(aktiv) : -1,
    auswahlTitel: aktiv ? (aktiv.textContent || '').trim() : null,
    auswahl: aktiv ? kasten(aktiv) : null,
    karte: karte ? kasten(karte) : null,
    kartenTitel: kartenTitel ? (kartenTitel.textContent || '').trim() : null,
    schlange: schlange ? kasten(schlange) : null,
    fensterHoehe: document.documentElement.clientHeight,
    fensterBreite: document.documentElement.clientWidth,
    rollposition: Math.round(window.scrollY * 100) / 100,
    rollerName: kette[0] ? kette[0].name : 'keiner',
    rollerTop: kette[0] ? kette[0].top : 0,
    huelleName: kette[1] ? kette[1].name : 'keiner',
    huelleTop: kette[1] ? kette[1].top : 0,
  };
}`;

/**
 * Den Tastaturfokus auf den bereits gewählten Eintrag setzen — OHNE zu klicken und OHNE zu rollen.
 *
 * Beides mit Absicht: Ein Klick ist eine bewusste Auswahl und führt im schmalen Weg den Blick
 * (`Validation.tsx:1127-1137`) — gemessen werden soll aber das Durchgehen, nicht das Anklicken.
 * Und `focus()` ohne `preventScroll` rollte selbst, womit die erste Messung schon verstellt wäre.
 */
const FOKUS_AUF_AUSWAHL = `(eintragAnker) => {
  const el = document.querySelector(eintragAnker + '[aria-current="true"]');
  if (!el) return false;
  el.focus({ preventScroll: true });
  return document.activeElement === el;
}`;

/** Warten, bis die Auswahl GENAU auf dieser Stelle steht — der Beleg, dass ein Schritt ein Schritt war. */
const INDEX_IST = `([eintragAnker, ziel]) => {
  const alle = [...document.querySelectorAll(eintragAnker)];
  const aktiv = document.querySelector(eintragAnker + '[aria-current="true"]');
  return !!aktiv && alle.indexOf(aktiv) === ziel;
}`;

const GENUG_EINTRAEGE = `([eintragAnker, wieviele]) =>
  document.querySelectorAll(eintragAnker).length >= wieviele`;

/**
 * Der Ist-Zustand für den Fall, dass ein Schritt NICHT ankommt.
 *
 * WARUM DAS EINE EIGENE ERHEBUNG IST (Lehre aus JOB 3575, Wächterfall W3): Ein nacktes
 * „page.waitForFunction: Timeout 15000ms exceeded" nennt weder den Bedienweg noch den Schritt noch
 * den Grund, und die erste Messung dieses Blocks ist genau daran hängen geblieben — fünf rote Fälle,
 * kein einziger Hinweis, WAS nicht ankam. Gemessen wird deshalb, was die drei denkbaren Ursachen
 * unterscheidet: die Liste ist kürzer als gedacht (`anzahl`), die Auswahl steht woanders (`index`),
 * oder die Eingabe landet am falschen Ort (`fokus` bei der Taste, `unterDemZeiger` beim Rad).
 */
const ZUSTAND = `([eintragAnker, x, y]) => {
  const alle = [...document.querySelectorAll(eintragAnker)];
  const aktiv = document.querySelector(eintragAnker + '[aria-current="true"]');
  const a = document.activeElement;
  const unter = (x >= 0 && y >= 0) ? document.elementFromPoint(x, y) : null;
  const benennen = (el) => el
    ? el.tagName + '[' + (el.getAttribute('data-testid') || '') + ']„' + (el.textContent || '').trim().slice(0, 30) + '"'
    : 'keiner';
  return {
    anzahl: alle.length,
    index: aktiv ? alle.indexOf(aktiv) : -1,
    fokus: benennen(a),
    unterDemZeiger: benennen(unter),
    rollposition: Math.round(window.scrollY),
  };
}`;

/**
 * Nur die vier Ränder — bewusst NICHT der `Kasten` von D1/D2: der verspricht zusätzlich `breite`,
 * und diese Messung erhebt sie nicht. Ein Typ, der mehr zusagt als gemessen wird, ist eine stille
 * Unwahrheit gegenüber dem nächsten Leser.
 */
interface Randkasten {
  oben: number;
  unten: number;
  links: number;
  rechts: number;
}

interface LangMessung {
  anzahl: number;
  index: number;
  auswahlTitel: string | null;
  auswahl: Randkasten | null;
  karte: Randkasten | null;
  kartenTitel: string | null;
  schlange: Randkasten | null;
  fensterHoehe: number;
  fensterBreite: number;
  rollposition: number;
  rollerName: string;
  rollerTop: number;
  huelleName: string;
  huelleTop: number;
}

/**
 * Playwright-Eingaben, als Strukturtyp statt als Typimport — dieselbe Bauform wie `Seite`/`Browser`
 * oben. Ein direkter Typimport aus `playwright` hat in JOB 3176 eine Rüge gekostet, und er ist hier
 * auch nicht nötig: gebraucht werden genau drei Verben.
 */
interface Eingabeseite extends Seite {
  keyboard: { press(taste: string): Promise<void> };
  mouse: {
    move(x: number, y: number): Promise<void>;
    wheel(dx: number, dy: number): Promise<void>;
  };
}
interface EingabeBrowser {
  newPage(opts: Record<string, unknown>): Promise<Eingabeseite>;
  close(): Promise<void>;
}

/** Ein Bedienweg, vollständig gemessen: dreissig Schritte, je vier Zahlen. */
interface Weglauf {
  start: LangMessung;
  schritte: Schrittmessung[];
  /** Der Titel, der nach dem letzten Schritt rechts stand — die Nutzenkette bis zur Karte. */
  letzterKartenTitel: string | null;
  letzterAuswahlTitel: string | null;
}

let browser3: EingabeBrowser | null = null;
let app3: ReturnType<typeof buildApp> | null = null;
let fehler3: string | null = null;
let taste: Weglauf | null = null;
let rad: Weglauf | null = null;

describe("JOB 3593 · L · lange Warteschlange — Auswahl UND Artikel im Fenster, echte Seite in Chromium", () => {
  beforeAll(async () => {
    try {
      if (!existsSync(join(DIST, "index.html"))) {
        throw new Error("apps/web/dist fehlt — vorher ./tools/build (im Tor laeuft es immer)");
      }
      const services = buildServices();
      app3 = buildApp(services);
      await app3.ready();
      await app3.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "Pedi", email: "pedi@job3593.test", password: "geheim12345" },
      });
      const login = await app3.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "pedi@job3593.test", password: "geheim12345" },
      });
      const token = (login.json() as { token: string }).token;
      const me = await app3.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { authorization: `Bearer ${token}` },
      });
      const autorId = (me.json() as { id: string }).id;
      // Die lange Liste. Die Titel sind durchnummeriert und zweistellig, damit im Protokoll auf den
      // ersten Blick steht, WELCHER Artikel gerade gewählt ist — und damit die Kopplung „links
      // gewählt = rechts gezeigt" eine Aussage und kein Zufallstreffer ist.
      for (let i = 1; i <= LANGE_LISTE; i += 1) {
        await services.ko.create({
          title: `Artikel ${String(i).padStart(2, "0")} der langen Warteschlange`,
          statement: "Halterungen und Profile ohne waagerechte Oberseiten ausfuehren.",
          type: "best_practice",
          category: "Allgemein",
          author: autorId,
        } as never);
      }

      const require = createRequire(import.meta.url);
      const { chromium } = require("playwright") as {
        chromium: { launch(o: Record<string, unknown>): Promise<EingabeBrowser> };
      };
      // OHNE `--single-process`/`--no-zygote`, aus demselben gemessenen Grund wie bei D2: ein
      // Einzelprozess-Chromium überlebt einen weiteren Start im selben Node-Prozess nicht.
      browser3 = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-gpu"],
      });

      const a = app3;
      /** Dieselbe Weiche wie in D1/D2: `/api/*` an die echte App, alles andere aus `dist`. */
      const weicheLegen = async (s: Eingabeseite): Promise<void> => {
        await s.route(`${ORIGIN}/**`, async (route) => {
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
      };

      /**
       * EIN Bedienweg, dreissig Schritte weit — jeder Weg auf einer EIGENEN Seite, damit das Rad
       * nicht dort anfängt, wo die Pfeiltaste aufgehört hat.
       *
       * Nach jedem Schritt wird ZUERST gewartet, bis die Auswahl wirklich eine Stelle weiter steht
       * (`INDEX_IST`), und erst dann gemessen. Das ist kein Komfort, sondern der Messaufbau: React
       * schreibt den Zustandswechsel im nächsten Anstrich, und `scrollIntoView` läuft in genau
       * diesem Anstrich. Ohne das Warten läse die Messung den Stand VOR der Bewegung — und das
       * Warten belegt zugleich, dass dreissig Schritte wirklich dreissig Schritte waren.
       */
      const wegMessen = async (weg: "taste" | "rad"): Promise<Weglauf> => {
        const s = await (browser3 as EingabeBrowser).newPage({
          viewport: { width: 1280, height: 900 },
        });
        await s.addInitScript(
          `try { localStorage.setItem("kw.designTheme", "modern"); } catch (e) {}`,
        );
        await weicheLegen(s);
        await s.goto(`${ORIGIN}/validierung`, { waitUntil: "load", timeout: 60_000 });
        await s.waitForFunction(fn("(sel) => document.querySelector(sel) !== null"), KARTE_ANKER, {
          timeout: 30_000,
        });
        await s.waitForFunction(fn(GENUG_EINTRAEGE), [EINTRAG_ANKER, LANGE_LISTE], {
          timeout: 30_000,
        });
        const anker = [EINTRAG_ANKER, KARTE_ANKER, SCHLANGE_ANKER];
        const start = await s.evaluate<LangMessung | null>(fn(LANG_MESSEN), anker);
        if (!start || !start.auswahl || !start.karte || !start.schlange) {
          throw new Error(`${weg}: die Ausgangslage war nicht vollstaendig zu messen`);
        }
        if (weg === "taste") {
          // Der Tastenlauf hängt an der LISTE und fängt nur, was aus ihr aufsteigt — ohne Fokus in
          // der Liste käme die Pfeiltaste dort nie an (genau diese Grenze misst
          // `pfeiltasten.test.tsx`). Dass er wirklich sitzt, ist ein Messwert, keine Annahme.
          const gesetzt = await s.evaluate<boolean>(fn(FOKUS_AUF_AUSWAHL), EINTRAG_ANKER);
          if (!gesetzt) {
            throw new Error("der Fokus liess sich nicht auf den gewaehlten Eintrag setzen");
          }
        }
        let letzte = start;
        const schritte: Schrittmessung[] = [];
        for (let i = 1; i <= SCHRITTE; i += 1) {
          let zeigerX = -1;
          let zeigerY = -1;
          if (weg === "taste") {
            await s.keyboard.press("ArrowDown");
          } else {
            // Der Zeiger muss ÜBER der Liste stehen, sonst gehört das Rad der Seite (so ist es
            // gebaut, `Validation.tsx:745-749`). Er wird deshalb vor jedem Schub neu gesetzt — die
            // Liste wandert ja mit, während die Fläche rollt.
            //
            // AUF DIE MITTE DES SICHTBAREN TEILS, und das ist eine Korrektur aus der Messung: Die
            // erste Fassung setzte ihn auf „Listenoberkante + 10 px, mindestens aber y = 10". Nach
            // vierzehn Radschritten war die Liste oben aus dem Fenster gewandert, die Untergrenze
            // griff — und y = 10 liegt im Kopfband der Anwendung. Gemessen wurde dort dann
            // `A[]„Fragen"`, das Rad gehörte der Seite, und der fünfzehnte Schritt kam nie an
            // (Cloud-Lauf ac00d70ed02946f494558b783656d3e4). Die Mitte des sichtbaren Ausschnitts
            // hat diese Kante nicht.
            const k = letzte.schlange as Randkasten;
            zeigerX = Math.round((k.links + k.rechts) / 2);
            zeigerY = Math.round(
              (Math.max(k.oben, 0) + Math.min(k.unten, letzte.fensterHoehe)) / 2,
            );
            await s.mouse.move(zeigerX, zeigerY);
            await s.mouse.wheel(0, RASTE_PX);
          }
          try {
            await s.waitForFunction(fn(INDEX_IST), [EINTRAG_ANKER, i], { timeout: 15_000 });
          } catch (e) {
            const z = await s.evaluate<unknown>(fn(ZUSTAND), [EINTRAG_ANKER, zeigerX, zeigerY]);
            throw new Error(
              `${weg}: Schritt ${i} kam nicht an — erwartet Index ${i}, gemessen ${JSON.stringify(z)} (${String(e).split("\n")[0]})`,
            );
          }
          const m = await s.evaluate<LangMessung | null>(fn(LANG_MESSEN), anker);
          if (!m || !m.auswahl || !m.karte || !m.schlange) {
            throw new Error(`${weg}: Schritt ${i} war nicht vollstaendig zu messen`);
          }
          schritte.push({
            schritt: i,
            index: m.index,
            auswahl: m.auswahl,
            karte: m.karte,
            fensterHoehe: m.fensterHoehe,
            rollposition: m.rollposition,
            rollerTop: m.rollerTop,
            rollerName: m.rollerName,
            huelleTop: m.huelleTop,
            huelleName: m.huelleName,
          });
          letzte = m;
        }
        const lauf: Weglauf = {
          start,
          schritte,
          letzterKartenTitel: letzte.kartenTitel,
          letzterAuswahlTitel: letzte.auswahlTitel,
        };
        // DER BEFUND, als Zahl und nicht als Eindruck (Auftrag §5.3) — und ausgegeben, SOBALD ein
        // Weg fertig ist, nicht erst wenn beide es sind. In der ersten Messung lief der Tastenweg
        // vollständig durch, brach der Radweg danach ab, und weil das Protokoll am Ende stand, war
        // der fertige Befund der Taste mit verloren.
        console.info(
          `JOB 3593 L · ${weg} · Auswahl ${JSON.stringify(ersterSichtverlust(schritte, "auswahl"))} · Karte ${JSON.stringify(ersterSichtverlust(schritte, "karte"))}`,
        );
        console.info(
          `JOB 3593 L · ${weg} · Start ${JSON.stringify({ anzahl: start.anzahl, auswahl: start.auswahl, karte: start.karte, fensterHoehe: start.fensterHoehe })} · Stuetzstellen ${JSON.stringify(schritte.filter((x) => [1, 10, 20, SCHRITTE].includes(x.schritt)))} · rechts „${lauf.letzterKartenTitel}"`,
        );
        return lauf;
      };

      taste = await wegMessen("taste");
      rad = await wegMessen("rad");
    } catch (e) {
      fehler3 = String(e).split("\n").slice(0, 3).join(" | ");
      // Ins Protokoll, nicht nur in die Zusicherung: vitest kürzt den erwarteten Wert einer
      // fehlgeschlagenen `toBeNull()`-Zusicherung auf wenige Zeichen („'TimeoutError: page.wait…'"),
      // und genau die Zeichen dahinter sind der Befund.
      console.info(`JOB 3593 L · ABBRUCH · ${fehler3}`);
    }
  }, 300_000);

  afterAll(async () => {
    await browser3?.close();
    await app3?.close();
  }, 60_000);

  it("L0 · die Buehne steht: vierzig offene Artikel, und dreissig Schritte sind dreissig Schritte", () => {
    expect(fehler3).toBeNull();
    expect(taste).not.toBeNull();
    expect(rad).not.toBeNull();
    for (const lauf of [taste, rad]) {
      // Ohne diese Zeilen könnte der Block unbemerkt an einer kurzen Liste messen — und dann sagte
      // ein grünes L2 nichts über Pedis Fall aus.
      expect(
        lauf?.start.anzahl,
        "die Warteschlange ist kuerzer als bestellt",
      ).toBeGreaterThanOrEqual(LANGE_LISTE);
      expect(lauf?.start.index, "zu Beginn ist der erste Eintrag gewaehlt").toBe(0);
      expect(lauf?.schritte.at(-1)?.index).toBe(SCHRITTE);
      // Die Nutzenkette bis zur Karte: rechts steht wirklich der Artikel, der links gewählt ist.
      expect(lauf?.letzterKartenTitel).toBe(lauf?.letzterAuswahlTitel);
      expect(lauf?.letzterKartenTitel).toContain("Artikel 31");
    }
  });

  it("L1 · Pfeiltaste: die Auswahl bleibt im Fenster — die Zusage aus JOB 3504, hier in Pixeln", () => {
    expect(fehler3).toBeNull();
    const befund = ersterSichtverlust(taste?.schritte ?? [], "auswahl");
    expect(
      befund.schritt,
      `die Auswahl verlaesst das Fenster bei Schritt ${befund.schritt} (${befund.fehlbetragPx} px)`,
    ).toBeNull();
  });

  it("L2 · Pfeiltaste: und die KARTE des gewaehlten Artikels bleibt im Fenster", () => {
    expect(fehler3).toBeNull();
    const befund = ersterSichtverlust(taste?.schritte ?? [], "karte");
    expect(
      befund.schritt,
      `die Karte verlaesst das Fenster bei Schritt ${befund.schritt} (${befund.fehlbetragPx} px ueber dem Rand, Rollposition ${befund.rollposition})`,
    ).toBeNull();
  });

  it("L3 · Mausrad: die Auswahl bleibt im Fenster", () => {
    expect(fehler3).toBeNull();
    const befund = ersterSichtverlust(rad?.schritte ?? [], "auswahl");
    expect(
      befund.schritt,
      `die Auswahl verlaesst das Fenster bei Schritt ${befund.schritt} (${befund.fehlbetragPx} px)`,
    ).toBeNull();
  });

  it("L4 · Mausrad: und die KARTE des gewaehlten Artikels bleibt im Fenster", () => {
    expect(fehler3).toBeNull();
    const befund = ersterSichtverlust(rad?.schritte ?? [], "karte");
    expect(
      befund.schritt,
      `die Karte verlaesst das Fenster bei Schritt ${befund.schritt} (${befund.fehlbetragPx} px ueber dem Rand, Rollposition ${befund.rollposition})`,
    ).toBeNull();
  });

  it("L6 · und die Bewegung liegt jetzt in der LISTE, nicht mehr in der Huelle darum", () => {
    expect(fehler3).toBeNull();
    for (const [name, lauf] of [
      ["Pfeiltaste", taste],
      ["Mausrad", rad],
    ] as const) {
      const letzte = lauf?.schritte.at(-1);
      expect(letzte, `${name}: kein letzter Schritt gemessen`).toBeTruthy();
      if (!letzte) continue;
      // DER STRUKTURELLE KERN DER REPARATUR, und ohne ihn sagten L2/L4 nichts Dauerhaftes: Vor
      // JOB 3593 war der innerste rollende Bereich um die Liste herum die Huelle der Anwendung
      // (`MAIN[flex-1 overflow-y-auto …]`), und die traegt die Karte gleich mit — deshalb wanderte
      // sie mit hinaus. Jetzt rollt die Liste selbst. Faellt diese Zeile, ist der alte Weg zurueck.
      expect(letzte.rollerName, `${name}: es rollt ${letzte.rollerName}`).toContain(
        "pruefen-warteschlange",
      );
      // Und die Bewegung liegt wirklich dort: die Liste ist weit gerollt, die Huelle kaum.
      expect(letzte.rollerTop, `${name}: die Liste hat sich nicht bewegt`).toBeGreaterThan(
        letzte.huelleTop,
      );
    }
  });

  it("L5 · die Regel selbst taugt: sie erkennt einen Kasten, der nachweislich ausserhalb liegt", () => {
    // Gegenprobe zur Elle (Auftrag §8.2b). Ohne sie könnte `imFenster` alles durchwinken und L2/L4
    // wären grün, ohne etwas zu messen. Die Zahlen sind echte Lagen, keine erfundenen: ein Kasten
    // knapp über dem Rand, einer weit darüber, einer unter dem Fenster, einer sauber im Bild.
    const hoehe = 900;
    expect(imFenster({ oben: 138.5, unten: 392.75 }, hoehe)).toBe(true);
    expect(imFenster({ oben: -SICHT_TOLERANZ_PX, unten: 200 }, hoehe)).toBe(true);
    expect(imFenster({ oben: -30, unten: 200 }, hoehe)).toBe(false);
    expect(imFenster({ oben: -2, unten: 200 }, hoehe)).toBe(false);
    expect(imFenster({ oben: 950, unten: 1200 }, hoehe)).toBe(false);
    expect(ueberDemFenster({ oben: -30, unten: 200 })).toBe(30);
    expect(ueberDemFenster({ oben: 138.5, unten: 392.75 })).toBe(0);
  });
});
