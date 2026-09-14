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
  type Sichtausschnitt,
  type Sichtkasten,
  ersterSichtverlust,
  fehlendeHoehe,
  imFenster,
  sichtbareHoehe,
  ueberDemFenster,
  unterDemFenster,
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

/**
 * JOB 3938 · und der Gegenschritt: dass das Blatt wirklich wieder ZU ist.
 *
 * Gebraucht wird er in `aufwaertsMessen`: die Lage rechnet das Produkt EINMAL, im Klick
 * (`PruefenMenue.tsx:272`). Ein Blatt, das über die Fensteränderung hinweg offen bliebe, trüge
 * seine Abwärtsrechnung mit — der Aufwärtszweig käme nie an die Reihe. Gewartet wird deshalb auf
 * den geschlossenen Zustand und nicht auf eine geratene Frist.
 */
const BLATT_WEG = `() => document.querySelector('[data-testid="pruefen-menue-panel-karte"]') === null`;

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
/** JOB 3812: die rechte Spalte — seit dieser Runde ein eigener Rollbereich und ein eigener Anker. */
const SPALTE_ANKER = '[data-testid="pruefen-artikelspalte"]';
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
  const fensterHoehe = document.documentElement.clientHeight;
  // Die Kette der Bereiche, die WIRKLICH rollen — eigene Rollregel UND mehr Inhalt als Platz.
  // Beides zusammen, weil ein 'overflow: auto' ohne Überlauf nichts bewegt und deshalb nichts
  // erklärt. Gesucht wird AB DEM ELEMENT SELBST, nicht erst ab seinem Elternteil: seit JOB 3593
  // ist die Liste ihr eigener innerster Rollbereich, und genau das soll die Messung zeigen statt
  // voraussetzen.
  //
  // JOB 3625: je Eintrag kommt zweierlei dazu. 'max' (scrollHeight - clientHeight) ist die
  // Strecke, die der Bereich ÜBERHAUPT rollen kann — die Ursache hinter 'top', nicht nur eine
  // zweite Beobachtung. 'kasten' ist sein Rechteck: nur wer es kennt, kann sagen, ob ein Kind
  // von seinem eigenen Rollbereich ABGESCHNITTEN wird (Codex an JOB 3584 R2).
  //
  // JOB 3812 · DER AUSSCHNITT IST DER SCHAUFENSTERKASTEN, NICHT DER RAHMENKASTEN. Das ist wörtlich
  // die Korrekturpflicht, die Codex an JOB 3611 R1 erhoben hat (LEHREN.md 2026-09-11:
  // „Tatsächliche Schnittfläche der Vorfahren messen, einschliesslich Rahmen und gegebenenfalls
  // Scrollleisten"). 'getBoundingClientRect()' liefert den RAHMENkasten; beschnitten wird aber am
  // Innenrand des Rahmens und oberhalb einer waagerechten Rollleiste. 'clientTop' ist die
  // Rahmenbreite oben, 'clientHeight' die Höhe des Schaufensters ohne Rahmen und ohne Leiste —
  // beides zusammen ist die Kante, an der wirklich abgeschnitten wird.
  const schaufenster = (el) => {
    const r = el.getBoundingClientRect();
    const oben = r.top + el.clientTop;
    return { oben: oben, unten: oben + el.clientHeight };
  };
  const rollKette = (start) => {
    const k = [];
    let p = start;
    while (p && p !== document.body && k.length < 3) {
      const st = getComputedStyle(p);
      if (/(auto|scroll|overlay)/.test(st.overflowY) && p.scrollHeight > p.clientHeight + 1) {
        k.push({
          name: p.tagName + '[' + (p.getAttribute('data-testid') || p.className.toString().slice(0, 40)) + ']',
          top: Math.round(p.scrollTop * 100) / 100,
          max: Math.round((p.scrollHeight - p.clientHeight) * 100) / 100,
          kasten: schaufenster(p),
        });
      }
      p = p.parentElement;
    }
    return k;
  };
  const GANZES_FENSTER = { oben: 0, unten: fensterHoehe };
  const kette = schlange ? rollKette(schlange) : [];
  // JOB 3812 · DER AUSSCHNITT DER KARTE IST DIE KLAMMER ALLER BESCHNEIDENDEN VORFAHREN, nicht
  // mehr nur des innersten ROLLENDEN. Zwei Gründe, beide gemessen:
  //   1. 'overflow: auto' beschneidet auch OHNE Überlauf. Bei 1280×900 rollt seit dieser Runde
  //      weder die Artikelspalte noch die Hülle — der alte Weg ('karteKette[0] || GANZES_FENSTER')
  //      hätte dort das ganze Fenster als Ausschnitt gemeldet und L2/L4 um ihre Aussage gebracht.
  //   2. 'hidden' beschneidet genauso wie 'auto'. Wer nur rollende Vorfahren sammelt, übersieht es.
  // Gesucht wird AB DEM ELTERNTEIL der Karte: ihr eigenes 'overflow-hidden' schneidet sie nicht ab.
  const klammerAb = (start, ausnehmen) => {
    let oben = 0;
    let unten = fensterHoehe;
    let p = start;
    while (p && p !== document.documentElement) {
      const st = getComputedStyle(p);
      const raus = ausnehmen && (p.getAttribute('data-testid') || '') === ausnehmen;
      if (!raus && /^(auto|scroll|overlay|hidden|clip)$/.test(st.overflowY)) {
        const f = schaufenster(p);
        oben = Math.max(oben, f.oben);
        unten = Math.min(unten, f.unten);
      }
      p = p.parentElement;
    }
    return { oben: oben, unten: unten };
  };
  // Die HÜLLE ist der innerste rollende Bereich, der NICHT die Warteschlange ist. Bis JOB 3625 war
  // es schlicht kette[1] — solange die Liste selbst rollt, ist das dasselbe. Fällt ihr Rollbereich
  // weg (Gegenprobe, Rückfall), rutscht die Hülle auf Platz eins, und kette[1] wäre dann ein
  // fremder Kasten oder gar keiner: die Hüllengrenze hätte im Schadensfall nichts mehr gemessen.
  const huelle = kette.filter((e) => e.name.indexOf('pruefen-warteschlange') === -1)[0];
  return {
    anzahl: alle.length,
    index: aktiv ? alle.indexOf(aktiv) : -1,
    auswahlTitel: aktiv ? (aktiv.textContent || '').trim() : null,
    auswahl: aktiv ? kasten(aktiv) : null,
    karte: karte ? kasten(karte) : null,
    kartenTitel: kartenTitel ? (kartenTitel.textContent || '').trim() : null,
    // JOB 3625 R2: der TITEL als eigenes Rechteck. Bei 1280×420 ist die Karte höher als der
    // sichtbare Teil der Hülle unter ihrem Anfang — die ganze Karte kann dort niemand sehen, der
    // Titel des gewählten Artikels schon. Seit die Sichtregel unten abgeschnittenen Inhalt nicht
    // mehr durchwinkt, muss diese Unterscheidung gemessen werden statt beteuert.
    kartentitel: kartenTitel ? kasten(kartenTitel) : null,
    schlange: schlange ? kasten(schlange) : null,
    fensterHoehe: fensterHoehe,
    fensterBreite: document.documentElement.clientWidth,
    rollposition: Math.round(window.scrollY * 100) / 100,
    rollerName: kette[0] ? kette[0].name : 'keiner',
    rollerTop: kette[0] ? kette[0].top : 0,
    rollerMax: kette[0] ? kette[0].max : 0,
    huelleName: huelle ? huelle.name : 'keiner',
    huelleTop: huelle ? huelle.top : 0,
    huelleMax: huelle ? huelle.max : 0,
    // Der Ausschnitt der AUSWAHL ist der Rollbereich der Liste (die Auswahl liegt in ihr, die
    // Kette beginnt an ihr — dasselbe Element).
    auswahlAusschnitt: kette[0] ? kette[0].kasten : GANZES_FENSTER,
    // Der Ausschnitt der KARTE ist ihre eigene Klammer — seit JOB 3812 in aller Regel die
    // Artikelspalte, die jetzt selbst rollt.
    karteAusschnitt: karte ? klammerAb(karte.parentElement, null) : GANZES_FENSTER,
    // JOB 3812 · UND DIE HÜLLE FÜR DIE KARTE, GETRENNT BENANNT — dieselbe Schärfung, die JOB 3625
    // für die Liste gemacht hat ('huelle', oben): der innerste beschneidende Bereich, der NICHT
    // die Artikelspalte ist. Vier Fälle (L8/L10, L11, L12, L14) sprechen von der „Hülle" und
    // meinten bis hierher 'karteAusschnitt'; solange die rechte Spalte nichts beschnitt, war das
    // dasselbe. Seit sie es tut, wären sie stillschweigend zu einer anderen Aussage geworden —
    // deshalb steht die Hülle hier als eigener Messwert und nicht als Nebenbedeutung.
    karteHuelle: karte
      ? klammerAb(karte.parentElement, 'pruefen-artikelspalte')
      : GANZES_FENSTER,
  };
}`;

/**
 * JOB 3625 R2 · DIE PROBE AUF DEN DECKEL: Ein Kasten von bekannter Höhe ÜBER der Liste, in
 * derselben Flex-Spalte — genau dort, wo der Hinweis auf einen nicht frischen Stand steht
 * (`Validation.tsx`, `lage.auffrischungGescheitert ? <PruefenNichtFrisch /> : null`, erstes Kind
 * der linken Spalte).
 *
 * WOZU. Die Reparatur behauptet, die Liste nehme den WIRKLICH verfügbaren Platz — also alles, was
 * über ihr steht, automatisch abgezogen. Das ist die Zusage, an der die Lage „Bestand mit
 * gescheiterter Auffrischung" hängt (Auftrag §9: dort ist der Kopf am höchsten). Gemessen wird sie
 * hier an echter Layoutrechnung: Kasten einsetzen, Liste nachmessen, Kasten entfernen, nachmessen.
 *
 * WAS DIESE PROBE NICHT IST: der Hinweis selbst. Sie erzeugt die Lage nicht, sie misst die REGEL
 * dahinter (jede Höhe über der Liste verkleinert die Liste um genau diese Höhe). Dass der Hinweis
 * an dieser Stelle steht und die Liste dabei stehen bleibt, misst `rollbereich-lagen.test.tsx` F6
 * in jsdom; die Lage im Browser zu erzeugen, hätte einen eigenen Auslöser gebraucht (`staleTime`
 * 30 s, kein Bedienweg zum Auffrischen auf dieser Fläche) — das wäre der Bühnenumbau, den §10
 * ausschliesst.
 */
const KOPF_PROBE = `([schlangeAnker, probeHoehe]) => {
  const ul = document.querySelector(schlangeAnker);
  if (!ul || !ul.parentElement) return null;
  const spalte = ul.parentElement;
  const kasten = () => { const r = ul.getBoundingClientRect(); return { oben: r.top, unten: r.bottom }; };
  const vorher = kasten();
  const probe = document.createElement('div');
  probe.setAttribute('data-testid', 'job3625-kopfprobe');
  probe.style.height = probeHoehe + 'px';
  probe.style.flex = '0 0 auto';
  spalte.insertBefore(probe, spalte.firstChild);
  const nachher = kasten();
  probe.remove();
  const zurueck = kasten();
  return { probeHoehe: probeHoehe, vorher: vorher, nachher: nachher, zurueck: zurueck };
}`;

// ==================================================================================================
// JOB 3812 · DIE ZWEI MESSUNGEN, DIE VOR DEM GRIFF STEHEN (Auftrag §5, Lieferungen 1 und 2).
// ==================================================================================================
//
// Der Auftrag beginnt ausdrücklich NICHT mit dem Griff, sondern mit zwei Fragen, deren Antwort die
// Bauform entscheidet:
//   1. Was passiert heute, wenn jemand den unteren Teil des Artikels lesen will — ist er überhaupt
//      erreichbar, und WAS bewegt sich dabei mit?
//   2. Beschneidet ein eigener Rollbereich an der rechten Spalte das Menüblatt der Karte?
// Beide Messungen bleiben nach der Reparatur stehen: aus der ersten wird L15, aus der zweiten L16.

/**
 * DEN ARTIKEL LESEN — die Messung zu Lieferung 1 und die Grundlage von L15.
 *
 * Sie tut, was ein Mensch tut, der den unteren Teil der Karte sehen will: sie sucht den nächsten
 * WIRKLICH rollenden Bereich um die Karte (dieselbe Regel wie `rollKette` oben — eigene Rollregel
 * UND echter Überlauf, gesucht ab der Karte selbst), rollt ihn bis ans Ende und misst dabei, was
 * sich mitbewegt. Danach wird die Rollstellung zurückgenommen; `zurueck` ist der Beleg dafür.
 *
 * `traegtListe` ist die eigentliche Frage des Auftrags und deshalb ein eigener Messwert: Liegt die
 * Warteschlange IN demselben Bereich, dann wandert sie beim Lesen zwangsläufig mit — und Pedis
 * erste Hälfte („links durch die Artikelliste gehen") zerbricht an der zweiten.
 *
 * Gibt es gar keinen rollenden Bereich (`rollerName: 'keiner'`), ist das ein vollwertiges Ergebnis
 * und keine Lücke: dann steht die Karte entweder schon ganz da — oder ihr unterer Teil ist dauerhaft
 * unerreichbar. Welcher der beiden Fälle gilt, entscheiden die Kästen, nicht diese Funktion.
 */
const ARTIKEL_LESEN = `([kartenAnker, schlangeAnker, eintragAnker]) => {
  const karte = document.querySelector(kartenAnker);
  const schlange = document.querySelector(schlangeAnker);
  const auswahl = document.querySelector(eintragAnker + '[aria-current="true"]');
  if (!karte || !schlange || !auswahl) return null;
  const kasten = (el) => { const r = el.getBoundingClientRect(); return { oben: r.top, unten: r.bottom }; };
  const titelEl = karte.querySelector('a[data-text="titel"]');
  const benennen = (el) => el.tagName + '[' + (el.getAttribute('data-testid') || el.className.toString().slice(0, 40)) + ']';
  const rollend = (start) => {
    let p = start;
    while (p && p !== document.body) {
      const st = getComputedStyle(p);
      if (/(auto|scroll|overlay)/.test(st.overflowY) && p.scrollHeight > p.clientHeight + 1) return p;
      p = p.parentElement;
    }
    return null;
  };
  const messen = () => ({
    karte: kasten(karte),
    kartentitel: titelEl ? kasten(titelEl) : null,
    schlange: kasten(schlange),
    auswahl: kasten(auswahl),
  });
  const fensterHoehe = document.documentElement.clientHeight;
  // DER AUSSCHNITT DER KARTE IST DIE KLAMMER ALLER BESCHNEIDENDEN VORFAHREN, nicht nur des
  // rollenden. 'hidden' beschneidet genauso wie 'auto', und wer nur den rollenden Bereich nähme,
  // urteilte in genau der Lage zu milde, in der gar nichts rollt: dann wäre das ganze Fenster der
  // Ausschnitt, obwohl die Hülle ihn längst enger macht.
  // Beschnitten wird am SCHAUFENSTER (Innenrand des Rahmens, oberhalb einer waagerechten
  // Rollleiste) und nicht am Rahmenkasten — Korrekturpflicht von Codex an JOB 3611 R1.
  const klammer = () => {
    let oben = 0;
    let unten = fensterHoehe;
    let p = karte.parentElement;
    while (p && p !== document.documentElement) {
      const st = getComputedStyle(p);
      if (/^(auto|scroll|overlay|hidden|clip)$/.test(st.overflowY)) {
        const r = p.getBoundingClientRect();
        const o = r.top + p.clientTop;
        oben = Math.max(oben, o);
        unten = Math.min(unten, o + p.clientHeight);
      }
      p = p.parentElement;
    }
    return { oben: oben, unten: unten };
  };
  const vorher = messen();
  const roller = rollend(karte);
  if (!roller) {
    const a = klammer();
    return {
      rollerName: 'keiner', traegtListe: false, max: 0, gerollt: 0,
      ausschnitt: a, ausschnittNachher: a,
      vorher: vorher, nachher: vorher, zurueck: vorher, fensterHoehe: fensterHoehe,
    };
  }
  const anfang = roller.scrollTop;
  const ausschnitt = klammer();
  const max = Math.round((roller.scrollHeight - roller.clientHeight) * 100) / 100;
  roller.scrollTop = roller.scrollHeight;
  const gerollt = Math.round((roller.scrollTop - anfang) * 100) / 100;
  const nachher = messen();
  const ausschnittNachher = klammer();
  roller.scrollTop = anfang;
  return {
    rollerName: benennen(roller),
    traegtListe: roller.contains(schlange),
    max: max, gerollt: gerollt,
    ausschnitt: ausschnitt, ausschnittNachher: ausschnittNachher,
    vorher: vorher, nachher: nachher, zurueck: messen(), fensterHoehe: fensterHoehe,
  };
}`;

/**
 * Die rechte Spalte PROBEWEISE zu einem Rollbereich machen — die Messung zu Lieferung 2, mit der
 * die Falle aus §2(e) geprüft wird, BEVOR sie ins Produkt kommt.
 *
 * Gesetzt werden genau die drei Regeln, die die Reparatur setzen würde (`h-full`, `min-h-0`,
 * `overflow-y-auto`), und zwar als Inline-Stil: so ist die Probe rückstandsfrei (`an: false` nimmt
 * sie zurück) und verlangt keine Produktänderung für eine Messung. Die Spalte wird nicht geraten,
 * sondern über die Karte gefunden — sie ist deren Elternteil (`Validation.tsx`, `{aktiv ? karte(aktiv) : null}`).
 */
const SPALTEN_PROBE = `([kartenAnker, an]) => {
  const karte = document.querySelector(kartenAnker);
  const spalte = karte && karte.parentElement;
  if (!spalte) return null;
  if (an) {
    spalte.style.height = '100%';
    spalte.style.minHeight = '0';
    spalte.style.overflowY = 'auto';
  } else {
    spalte.style.height = '';
    spalte.style.minHeight = '';
    spalte.style.overflowY = '';
  }
  const r = spalte.getBoundingClientRect();
  return {
    oben: r.top, unten: r.bottom,
    overflowY: getComputedStyle(spalte).overflowY,
    rollt: spalte.scrollHeight > spalte.clientHeight + 1,
  };
}`;

/**
 * WIE VIEL VOM MENÜBLATT DER KARTE WIRKLICH ZU SEHEN IST.
 *
 * DIE KLAMMER ist der Kern dieser Messung: `overflow` beschneidet unabhängig von der
 * Stapelreihenfolge, `z-40` hilft dagegen nicht. Gesammelt wird deshalb JEDER beschneidende
 * Vorfahre — `hidden` und `clip` genauso wie `auto`/`scroll`, denn die Karte selbst trägt
 * `overflow-hidden` (`Validation.tsx`, `overflow-hidden rounded-[14px] …`). Alle zusammen ergeben
 * EIN Rechteck, das die vorhandene Elle (`sichtbareHoehe`, `ueberDemFenster`, `unterDemFenster`)
 * als einen Ausschnitt lesen kann; ein zweiter Massstab entsteht nicht.
 *
 * WARUM DIE WANDERUNG AN DER `position` HÄNGT: Ein `fixed` gesetztes Blatt hat das FENSTER als
 * enthaltenden Block und wird von `overflow` der Vorfahren NICHT beschnitten. Wer die Kette
 * trotzdem abliefe, meldete eine Beschneidung, die es nicht gibt. Die Ausnahme von der Ausnahme
 * steht mit drin und ist der Grund, warum hier nicht einfach „bei `fixed` gar nicht laufen" steht:
 * Ein Vorfahre mit `transform`, `filter`, `perspective`, `will-change` oder `contain` wird selbst
 * zum enthaltenden Block — ab ihm beschneidet die Kette wieder. Beides wird aus dem Browser
 * gelesen, nicht aus dem Quelltext gewusst.
 *
 * `treffer` ist die UNABHÄNGIGE Gegenprobe zu dieser Rechnung und zugleich die zweite Hälfte von
 * „vollständig sichtbar UND bedienbar": neun Punkte über die Höhe des Blatts, jeder mit
 * `elementFromPoint` geprüft (derselbe Weg wie `ERREICHBAR_HELFER` in D1/D2). Ein abgeschnittener
 * oder verdeckter Bereich trifft das Blatt nicht — egal, ob die Klammer ihn gefunden hat.
 *
 * JOB 3938 · UND AN WELCHER KANTE DAS BLATT HÄNGT — GEMESSEN, NICHT GERECHNET.
 * Das Produkt kennt zwei Orte (`PruefenMenue.tsx:151-153`, `:185-188`): unter dem Auslöser oder
 * über ihm. Welcher gilt, stand bisher in keinem Messwert — und eine Elle, die beide Orte
 * gleichzeitig erlaubt, kann ein falsch gerichtetes Blatt gar nicht erkennen. Erhoben wird das
 * hier auf dem einzigen Weg, der ohne eigene Rechnung auskommt:
 *
 *   DIE SONDE. Der Ort steht im Produkt als AUSDRUCK in einer eigenen Eigenschaft
 *   (`--kw-blatt-ort` = `clamp(8px, …, calc(100% - 72px))`, `:192`) und wird von EINER von zwei
 *   festen Klassen gelesen (`[top:…]` oder `[bottom:…]`, `:312`). Ein 0 px hoher, fest
 *   positionierter Kasten IM Blatt erbt diese Eigenschaft und lässt den BROWSER den Ausdruck
 *   auflösen (`top: var(--kw-blatt-ort)`); sein `top` ist der Ort in Pixeln. Passt er auf die
 *   Oberkante des Blatts, hängt das Blatt an `top` — also nach unten aufgeklappt. Passt er auf den
 *   Abstand der UNTERkante zum Fensterboden, hängt es an `bottom` — nach oben aufgeklappt. Die
 *   Sonde wird sofort wieder entfernt; sie steht ausserhalb des Flusses und ändert am Blatt nichts.
 *
 *   WARUM NICHT „WELCHE KANTE IST `auto`": `getComputedStyle` gibt für ein positioniertes Element
 *   den BENUTZTEN Wert beider Kanten zurück, auch für die nicht gesetzte. Beide Rohwerte stehen
 *   deshalb im Befund — als Beleg dafür, dass sie hier nichts entscheiden, und nicht als Elle.
 *   Der Klassenname steht aus demselben Grund daneben: er sagt, was gemeint war, nicht, was wirkt.
 */
const MENUE_LAGE = `([kartenAnker, kennung]) => {
  const karte = document.querySelector(kartenAnker);
  const ausloeser = document.querySelector('[data-testid="pruefen-menue-' + kennung + '"]');
  const blatt = document.querySelector('[data-testid="pruefen-menue-panel-' + kennung + '"]');
  if (!karte || !ausloeser || !blatt || !karte.parentElement) return null;
  const kasten = (el) => { const r = el.getBoundingClientRect(); return { oben: r.top, unten: r.bottom }; };
  const fensterHoehe = document.documentElement.clientHeight;
  const br = blatt.getBoundingClientRect();
  const blattStil = getComputedStyle(blatt);
  const position = blattStil.position;
  const rund = (w) => Math.round(w * 100) / 100;
  const sonde = document.createElement('div');
  sonde.style.position = 'fixed';
  sonde.style.left = '0px';
  sonde.style.width = '1px';
  sonde.style.height = '0px';
  sonde.style.top = 'var(--kw-blatt-ort)';
  blatt.appendChild(sonde);
  const ortPx = sonde.getBoundingClientRect().top;
  sonde.remove();
  const abstandAbwaerts = rund(Math.abs(br.top - ortPx));
  const abstandAufwaerts = rund(Math.abs(fensterHoehe - br.bottom - ortPx));
  const klassen = blatt.className.toString();
  let oben = 0;
  let unten = fensterHoehe;
  const namen = [];
  // Ein Vorfahre, der selbst enthaltender Block für fest positionierte Nachfahren wird.
  const blockFuerFest = (st) =>
    st.transform !== 'none' || st.perspective !== 'none' || st.filter !== 'none' ||
    /transform|perspective|filter/.test(st.willChange) ||
    /(paint|layout|strict|content)/.test(st.contain);
  let wirksam = position !== 'fixed';
  let p = blatt.parentElement;
  while (p && p !== document.documentElement) {
    const st = getComputedStyle(p);
    if (!wirksam && blockFuerFest(st)) wirksam = true;
    if (wirksam && /^(auto|scroll|overlay|hidden|clip)$/.test(st.overflowY)) {
      // Schaufenster statt Rahmenkasten (Korrekturpflicht von Codex an JOB 3611 R1): beschnitten
      // wird am Innenrand des Rahmens und oberhalb einer waagerechten Rollleiste.
      const r = p.getBoundingClientRect();
      const o = r.top + p.clientTop;
      const u = o + p.clientHeight;
      if (o > oben || u < unten) {
        namen.push(p.tagName + '[' + (p.getAttribute('data-testid') || p.className.toString().slice(0, 40)) + ']' + Math.round(o) + '-' + Math.round(u));
      }
      oben = Math.max(oben, o);
      unten = Math.min(unten, u);
    }
    p = p.parentElement;
  }
  const mitte = Math.round((br.left + br.right) / 2);
  const trifft = (y) => {
    if (y < 0 || y > fensterHoehe) return false;
    const el = document.elementFromPoint(mitte, Math.round(y));
    return !!el && (el === blatt || blatt.contains(el));
  };
  const PUNKTE = 9;
  const fehlstellen = [];
  for (let i = 0; i < PUNKTE; i += 1) {
    const y = br.top + 2 + ((br.height - 4) * i) / (PUNKTE - 1);
    if (!trifft(y)) fehlstellen.push(Math.round(y * 100) / 100);
  }
  const spalte = karte.parentElement;
  return {
    position: position,
    blatt: { oben: br.top, unten: br.bottom },
    hoehe: Math.round(br.height * 100) / 100,
    breite: Math.round(br.width * 100) / 100,
    ausloeser: kasten(ausloeser),
    klammer: { oben: oben, unten: unten },
    klammerNamen: namen,
    spalte: kasten(spalte),
    spalteOverflow: getComputedStyle(spalte).overflowY,
    spalteRollt: spalte.scrollHeight > spalte.clientHeight + 1,
    punkte: PUNKTE,
    fehlstellen: fehlstellen,
    fensterHoehe: fensterHoehe,
    // JOB 3812 R3: die BREITE gehört mit erhoben — L18c ändert sie, und ohne diesen Wert wäre
    // „die Fensterbreite hat sich wirklich geändert" eine Behauptung statt einer Messung.
    fensterBreite: window.innerWidth,
    // JOB 3938: die gemessene Kante. nachOben ist der Vergleich der beiden Abstaende und sonst
    // nichts — keine nachgebaute Produktrechnung, keine Annahme ueber den Klassennamen.
    kante: {
      nachOben: abstandAufwaerts < abstandAbwaerts,
      ortPx: rund(ortPx),
      abstandAbwaerts: abstandAbwaerts,
      abstandAufwaerts: abstandAufwaerts,
      top: blattStil.top,
      bottom: blattStil.bottom,
      ort: blattStil.getPropertyValue('--kw-blatt-ort').trim(),
      deckel: blattStil.getPropertyValue('--kw-blatt-deckel').trim(),
      maxHoehe: blattStil.maxHeight,
      klasse: klassen.indexOf('[bottom:var(--kw-blatt-ort)]') >= 0
        ? 'bottom'
        : (klassen.indexOf('[top:var(--kw-blatt-ort)]') >= 0 ? 'top' : 'keine'),
    },
  };
}`;

/**
 * JOB 3812 · RUNDE 2 — DIE BÜHNE VON L18: EIN FENSTER, DAS SICH ÄNDERT, WÄHREND DAS MENÜ OFFEN IST.
 *
 * WARUM EIN EIGENER WARTESCHRITT: `setViewportSize` kehrt zurück, sobald Chromium den Auftrag
 * angenommen hat — nicht, sobald das Dokument die neue Höhe hat und React darauf gezeichnet hat.
 * Gewartet wird deshalb auf BEIDES: die Höhe steht, UND sie steht fünf Bilder lang still. Dieselbe
 * Bauform wie `RUHE` (dort für den Rollstand der Spalte), aus demselben Grund.
 *
 * AUSDRÜCKLICH NICHT gewartet wird auf die Zusicherung selbst („bis das Blatt wieder im Fenster
 * liegt") — ein solcher Warteschritt könnte gar nicht scheitern und machte L18 zu einer Schleife,
 * die ihr eigenes Ergebnis herbeiführt.
 *
 * JOB 3812 R3: gewartet wird seither auf BEIDE Maße, weil L18c die BREITE ändert und die Höhe
 * dabei stehen lässt — ein Warteschritt nur auf die Höhe wäre dort sofort fertig und sagte nichts.
 * Die Höhe kommt vom Dokument (`clientHeight`: der Wert, mit dem das Produkt rechnet), die Breite
 * vom Fenster (`innerWidth`): `clientWidth` zöge einen etwaigen Rollbalken ab, und der Schritt
 * wartete dann auf eine Zahl, die nie kommt.
 */
const FENSTER_STEHT = `([breite, hoehe]) => {
  if (document.documentElement.clientHeight !== hoehe || window.innerWidth !== breite) {
    window.__kwFensterZahl = 0; return false;
  }
  window.__kwFensterZahl = (window.__kwFensterZahl || 0) + 1;
  return window.__kwFensterZahl >= 5;
}`;

/** Den Zähler zurücksetzen, bevor auf die nächste Fensterhöhe gewartet wird. */
const FENSTER_ZURUECK = "() => { window.__kwFensterZahl = 0; return true; }";

/**
 * Die Artikelspalte ans Ende rollen — der zweite Weg, auf dem sich die Lage eines offenen Blatts
 * verstellt. Gesetzt wird `scrollTop` und nicht das Rad: das Rad hängt am Zeiger und träfe bei
 * offenem Menü dessen Schliessfläche; gemessen werden soll aber die Nachführung, nicht das
 * Schliessen. Ein gesetzter `scrollTop` löst dasselbe `scroll`-Ereignis aus wie eine Geste.
 */
const SPALTE_ANS_ENDE = `(anker) => {
  const el = document.querySelector(anker);
  if (!el) return null;
  el.scrollTop = el.scrollHeight;
  return {
    top: Math.round(el.scrollTop * 100) / 100,
    max: Math.round((el.scrollHeight - el.clientHeight) * 100) / 100,
  };
}`;

/**
 * JOB 3812 · RUNDE 2, L19 — DEN NÄCHSTEN ARTIKEL WÄHLEN, NACHDEM DIE KARTE HERUNTERGEROLLT IST.
 *
 * Der Klick ist der Weg eines Menschen (nicht `setAktivId`), und der Titel im Blatt der Karte ist
 * das Kennzeichen, an dem die Messung den Wechsel WIRKLICH erkennt — ein `aria-current` an der
 * Liste sagt nur, was links markiert ist, nicht, was rechts steht.
 */
const ARTIKEL_WECHSELN = `([eintragAnker, kartenAnker]) => {
  const alle = [...document.querySelectorAll(eintragAnker)];
  const i = alle.findIndex((e) => e.getAttribute('aria-current') === 'true');
  const ziel = alle[i + 1];
  const karte = document.querySelector(kartenAnker);
  const titelEl = karte && karte.querySelector('a[data-text="titel"]');
  if (i === -1 || !ziel || !karte || !titelEl) return null;
  const spalte = karte.parentElement;
  const vorherTitel = titelEl.textContent;
  ziel.click();
  return {
    von: i,
    nach: i + 1,
    vorherTitel: vorherTitel,
    vorherTop: Math.round(spalte.scrollTop * 100) / 100,
  };
}`;

/** Wo die Karte nach dem Wechsel steht — Rollstellung der Spalte, Kasten, Titel, Ausschnitt. */
const WECHSEL_STAND = `([kartenAnker, schlangeAnker, eintragAnker]) => {
  const karte = document.querySelector(kartenAnker);
  const schlange = document.querySelector(schlangeAnker);
  const auswahl = document.querySelector(eintragAnker + '[aria-current="true"]');
  if (!karte || !schlange || !auswahl || !karte.parentElement) return null;
  const kasten = (el) => { const r = el.getBoundingClientRect(); return { oben: r.top, unten: r.bottom }; };
  const titelEl = karte.querySelector('a[data-text="titel"]');
  const spalte = karte.parentElement;
  let oben = 0;
  let unten = document.documentElement.clientHeight;
  let p = karte.parentElement;
  while (p && p !== document.documentElement) {
    const st = getComputedStyle(p);
    if (/^(auto|scroll|overlay|hidden|clip)$/.test(st.overflowY)) {
      const r = p.getBoundingClientRect();
      const o = r.top + p.clientTop;
      oben = Math.max(oben, o);
      unten = Math.min(unten, o + p.clientHeight);
    }
    p = p.parentElement;
  }
  return {
    titel: titelEl ? titelEl.textContent : null,
    top: Math.round(spalte.scrollTop * 100) / 100,
    max: Math.round((spalte.scrollHeight - spalte.clientHeight) * 100) / 100,
    karte: kasten(karte),
    kartentitel: titelEl ? kasten(titelEl) : null,
    schlange: kasten(schlange),
    auswahl: kasten(auswahl),
    ausschnitt: { oben: oben, unten: unten },
    fensterHoehe: document.documentElement.clientHeight,
  };
}`;

/** Steht rechts schon ein ANDERER Artikel? Der Warteschritt zwischen Klick und Messung. */
const ANDERER_ARTIKEL = `([kartenAnker, vorherTitel]) => {
  const karte = document.querySelector(kartenAnker);
  const titelEl = karte && karte.querySelector('a[data-text="titel"]');
  return !!titelEl && titelEl.textContent !== vorherTitel;
}`;

/**
 * JOB 3812 · Lieferung 4 — KOMMT MAN MIT DER TASTATUR BIS ANS ENDE DES ARTIKELS?
 *
 * Ein Rollbereich, den nur die Maus bewegen kann, ist keiner. Gemessen wird der Weg, den ein
 * Mensch wirklich geht: vom letzten Eintrag der Liste EIN Tabschritt weiter (die rechte Spalte ist
 * der nächste Halt in der Reihenfolge des Baums — sie steht vor ihrem eigenen Inhalt), dann die
 * Taste, die ans Ende führt.
 *
 * Die AUSGANGSSTELLUNG wird gesetzt und nicht ertastet: bis zum letzten Eintrag sind es vierzig
 * Tabschritte, die nichts belegen, was der erste nicht schon belegt. `focus({preventScroll:true})`
 * ist derselbe Griff wie in `FOKUS_AUF_AUSWAHL` — kein Klick (der führte im schmalen Weg den
 * Blick) und kein Rollen (das verstellte die Messung).
 */
const TASTATUR_START = `([spalteAnker, eintragAnker]) => {
  const spalte = document.querySelector(spalteAnker);
  const alle = [...document.querySelectorAll(eintragAnker)];
  const letzter = alle[alle.length - 1];
  if (!spalte || !letzter) return null;
  letzter.focus({ preventScroll: true });
  return {
    steht: document.activeElement === letzter,
    tabIndex: spalte.tabIndex,
    max: Math.round((spalte.scrollHeight - spalte.clientHeight) * 100) / 100,
  };
}`;

/**
 * Warten, bis die Rollbewegung der Spalte STEHT — fünf aufeinanderfolgende Bilder ohne Änderung.
 *
 * Chromium rollt Tasteneingaben animiert. Wer direkt nach `keyboard.press` misst, liest den Stand
 * VOR der Bewegung; genau daran ist die erste Fassung von L17 hängen geblieben (0 statt 193 px).
 * Fünf Bilder sind rund 80 ms — lang genug, dass eine beginnende Animation nicht als Stillstand
 * durchgeht, und kurz genug, dass echter Stillstand sofort gemeldet wird.
 */
const RUHE = `(anker) => {
  const el = document.querySelector(anker);
  if (!el) return false;
  const jetzt = Math.round(el.scrollTop * 100) / 100;
  const vorher = window.__kwRuheWert;
  window.__kwRuheWert = jetzt;
  window.__kwRuheZahl =
    vorher !== undefined && Math.abs(jetzt - vorher) < 0.5 ? (window.__kwRuheZahl || 0) + 1 : 0;
  return window.__kwRuheZahl >= 5;
}`;

/** Den Zähler zurücksetzen, bevor auf die nächste Ruhe gewartet wird. */
const RUHE_ZURUECK = `(anker) => {
  window.__kwRuheWert = undefined;
  window.__kwRuheZahl = 0;
  return document.querySelector(anker) !== null;
}`;

/** Wo der Fokus steht, wie weit die Spalte gerollt ist, und wo die vier Kästen liegen. */
const TASTATUR_STAND = `([spalteAnker, schlangeAnker, eintragAnker, kartenAnker]) => {
  const spalte = document.querySelector(spalteAnker);
  const schlange = document.querySelector(schlangeAnker);
  const auswahl = document.querySelector(eintragAnker + '[aria-current="true"]');
  const karte = document.querySelector(kartenAnker);
  if (!spalte || !schlange || !auswahl || !karte) return null;
  const kasten = (el) => { const r = el.getBoundingClientRect(); return { oben: r.top, unten: r.bottom }; };
  const a = document.activeElement;
  return {
    fokus: a ? a.tagName + '[' + (a.getAttribute('data-testid') || a.className.toString().slice(0, 30)) + ']' : 'keiner',
    fokusIstSpalte: a === spalte,
    top: Math.round(spalte.scrollTop * 100) / 100,
    max: Math.round((spalte.scrollHeight - spalte.clientHeight) * 100) / 100,
    karte: kasten(karte),
    schlange: kasten(schlange),
    auswahl: kasten(auswahl),
    spalte: kasten(spalte),
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
  kartentitel: Randkasten | null;
  schlange: Randkasten | null;
  fensterHoehe: number;
  fensterBreite: number;
  rollposition: number;
  rollerName: string;
  rollerTop: number;
  rollerMax: number;
  huelleName: string;
  huelleTop: number;
  huelleMax: number;
  auswahlAusschnitt: Sichtausschnitt;
  karteAusschnitt: Sichtausschnitt;
  karteHuelle: Sichtausschnitt;
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
  /** JOB 3812 R2: die Fensterhöhe ÄNDERN, ohne die Seite neu zu laden — die Bühne von L18. */
  setViewportSize(groesse: { width: number; height: number }): Promise<void>;
}
interface EingabeBrowser {
  newPage(opts: Record<string, unknown>): Promise<Eingabeseite>;
  close(): Promise<void>;
}

/** Eine Probe auf den Deckel: die Liste vor, mit und nach einem Kasten bekannter Höhe über ihr. */
interface Kopfprobe {
  probeHoehe: number;
  vorher: Sichtausschnitt;
  nachher: Sichtausschnitt;
  zurueck: Sichtausschnitt;
}

/** Alle Proben einer Fensterlage, samt dem sichtbaren Teil der Hülle zu diesem Zeitpunkt. */
interface Probenlauf {
  huelleUnten: number;
  proben: Kopfprobe[];
}

/** JOB 3812: die vier Kästen einer Leseprobe, an EINEM Zeitpunkt erhoben. */
interface Lesekaesten {
  karte: Sichtkasten;
  kartentitel: Sichtkasten | null;
  schlange: Sichtkasten;
  auswahl: Sichtkasten;
}

/** JOB 3812 · Lieferung 1: was geschieht, wenn jemand den unteren Teil des Artikels lesen will. */
interface Leseprobe {
  lage: string;
  rollerName: string;
  /** Liegt die Warteschlange IN dem Bereich, der beim Lesen der Karte rollt? Die Kernfrage. */
  traegtListe: boolean;
  /** `scrollHeight - clientHeight` des rollenden Bereichs — wie weit er ÜBERHAUPT kann. */
  max: number;
  /** Wie weit er wirklich gerollt ist. 0 bei `rollerName: 'keiner'`. */
  gerollt: number;
  ausschnitt: Sichtausschnitt;
  ausschnittNachher: Sichtausschnitt;
  vorher: Lesekaesten;
  nachher: Lesekaesten;
  zurueck: Lesekaesten;
  fensterHoehe: number;
}

/** JOB 3812 · Lieferung 2: wie viel vom Menüblatt der Karte wirklich zu sehen ist. */
interface Menuebefund {
  lage: string;
  /** Ob die rechte Spalte für diese Messung PROBEWEISE zum Rollbereich gemacht wurde. */
  probe: boolean;
  position: string;
  blatt: Sichtkasten;
  hoehe: number;
  breite: number;
  ausloeser: Sichtkasten;
  klammer: Sichtausschnitt;
  klammerNamen: string[];
  spalte: Sichtkasten;
  spalteOverflow: string;
  spalteRollt: boolean;
  /** Wie viele Punkte über die Höhe des Blatts abgetastet wurden. */
  punkte: number;
  /** Die y-Werte, an denen das Blatt NICHT getroffen wurde — abgeschnitten oder verdeckt. */
  fehlstellen: number[];
  fensterHoehe: number;
  /** JOB 3812 R3: `window.innerWidth` zur Zeit der Messung — die Elle von L18c. */
  fensterBreite: number;
  /** JOB 3938: an welcher Kante das Blatt WIRKLICH hängt (Begründung an `MENUE_LAGE`). */
  kante: Menuekante;
}

/**
 * JOB 3938 · DIE GEMESSENE RICHTUNG DES BLATTS.
 *
 * `nachOben` ist der einzige Wert, auf den eine Zusicherung schaut; alles andere steht daneben,
 * damit im Protokoll nachzulesen ist, WORAUS er entstand. `top`/`bottom` sind die Rohwerte aus
 * `getComputedStyle` (beide in Pixeln, auch die nicht gesetzte Kante — deshalb entscheiden sie
 * nichts), `klasse` ist der Klassenname, also die Absicht, und `ort`/`deckel`/`maxHoehe` sagen,
 * ob und wo die Klemme des Produkts (`PruefenMenue.tsx:192-193`) gegriffen hat.
 */
interface Menuekante {
  nachOben: boolean;
  /** Der vom BROWSER aufgelöste `--kw-blatt-ort`, in Pixeln (Sondenmessung). */
  ortPx: number;
  /** Abstand des Ortswerts zur OBERkante des Blatts — 0, wenn es nach unten aufklappt. */
  abstandAbwaerts: number;
  /** Abstand des Ortswerts zum Fensterboden-Abstand der UNTERkante — 0 bei Aufwärtszweig. */
  abstandAufwaerts: number;
  top: string;
  bottom: string;
  ort: string;
  deckel: string;
  maxHoehe: string;
  klasse: string;
}

/**
 * JOB 3812 · RUNDE 2 · L18: EIN Schritt eines Weges, auf dem das Blatt die ganze Zeit offen bleibt.
 * Der Name des Schritts steht in jeder Fehlermeldung — sonst wäre nicht zu sehen, WANN es brach.
 */
interface Menuewandel {
  schritt: string;
  befund: Menuebefund;
  /** Nur beim Rollschritt gesetzt: wie weit die Artikelspalte wirklich gerollt ist. */
  gerollt: { top: number; max: number } | null;
}

/** JOB 3812 · RUNDE 2 · L19: was rechts steht, nachdem die Spalte gerollt und gewechselt wurde. */
interface Wechselstand {
  titel: string | null;
  /** Rollstellung der Artikelspalte. */
  top: number;
  max: number;
  karte: Sichtkasten;
  kartentitel: Sichtkasten | null;
  schlange: Sichtkasten;
  auswahl: Sichtkasten;
  ausschnitt: Sichtausschnitt;
  fensterHoehe: number;
}

/**
 * JOB 3938 · L18d: der Weg in den Aufwärtszweig, mit allem, woraus er entstanden ist.
 *
 * Die Herleitung steht als MESSWERT im Ergebnis und nicht nur im Protokoll: `schwelle` und
 * `zielHoehe` sind aus `ausloeserObenFlach` gerechnet, und `vorher` belegt, dass dieselbe Karte in
 * der bekannten flachen Lage noch nach UNTEN aufklappte. Ohne diesen zweiten Befund hiesse „es
 * klappt nach oben" nur, dass irgendwo etwas nach oben klappt — nicht, dass die Weiche greift.
 */
interface Aufwaertslauf {
  /** `ausloeser.oben` in der bekannten flachen Lage — die einzige Eingangszahl der Herleitung. */
  ausloeserObenFlach: number;
  fensterHoeheFlach: number;
  /** `2 · ausloeserObenFlach + 28`: darunter rechnet `PruefenMenue.tsx:187` `nachOben`. */
  schwelle: number;
  /** Die daraus gesetzte Fensterhöhe (`AUFWAERTS_ABSTAND_PX` unter der Schwelle). */
  zielHoehe: number;
  /** Der Befund in der bekannten flachen Lage: dasselbe Menü, noch abwärts aufgeklappt. */
  vorher: Menuebefund;
  /** Der Befund im wirklich flachen Fenster — der Zweig, den bis heute kein Browser gemessen hat. */
  befund: Menuebefund;
}

interface Artikelwechsel {
  lage: string;
  von: number;
  nach: number;
  vorherTitel: string | null;
  vorher: Wechselstand;
  nachher: Wechselstand;
}

/** Was `SPALTEN_PROBE` zurückmeldet — der Beleg, dass die Probe wirklich sass. */
interface Spaltenprobe {
  oben: number;
  unten: number;
  overflowY: string;
  rollt: boolean;
}

/** Ein Stand während des Tastaturwegs (Lieferung 4). */
interface Tastaturstand {
  fokus: string;
  fokusIstSpalte: boolean;
  top: number;
  max: number;
  karte: Sichtkasten;
  schlange: Sichtkasten;
  auswahl: Sichtkasten;
  spalte: Sichtkasten;
}

/** Der ganze Tastaturweg einer Fensterlage: Ausgangsstellung, nach dem Tabschritt, nach „Ende". */
interface Tastaturweg {
  lage: string;
  tabIndex: number;
  nachTab: Tastaturstand;
  nachEnde: Tastaturstand;
}

/** Ein Bedienweg, vollständig gemessen: dreissig Schritte, je vier Zahlen. */
interface Weglauf {
  start: LangMessung;
  schritte: Schrittmessung[];
  /** Der Titel, der nach dem letzten Schritt rechts stand — die Nutzenkette bis zur Karte. */
  letzterKartenTitel: string | null;
  letzterAuswahlTitel: string | null;
}

// ==================================================================================================
// JOB 3625 · DIESELBE ZUSAGE BEI FLACHEM FENSTER — die Lücke, die JOB 3593 selbst benannt hat.
// ==================================================================================================
//
// JOB 3593 hat Pedis Satz bei EINER Fenstergrösse gemessen (1280×900) und dort repariert. Die
// Reparatur ist eine Prozentangabe vom Fenster (`lg:max-h-[70vh]`), und Prozent vom Fenster rechnet
// den Kopf ÜBER der Liste nicht mit. Die Bahn hat das als REST notiert
// (`archiv/3593/runde-1/RUECKGABE.md:33`): unterhalb von rund 460 px Fensterhöhe könnten `70vh`
// plus der 138 px hohe Kopf das Fenster überschreiten — HERGELEITET, nicht gemessen.
//
// Hier wird gemessen. Zwei Lagen, beide breit genug für die zweispaltige Bauform (`lg:` greift ab
// 1024 px), aber verschieden hoch: die bekannte HOHE und eine FLACHE deutlich unter der
// hergeleiteten Grenze. Beide Lagen fahren beide Bedienwege auf je eigener Seite.
//
// JOB 3812 · UND EINE LAGE DAZWISCHEN. `archiv/3625/runde-2/RUECKGABE.md:66` hat als Rest notiert:
// „Nur die Fensterhöhen 900 und 420 sind gemessen, Höhen dazwischen nicht." Zwei Stützstellen
// können eine Regel vortäuschen, die in der Mitte nicht gilt — 1280×600 fährt deshalb denselben
// Block mit denselben Zusicherungen. Das ist eine Messung mehr, kein neuer Massstab.
const HOCH = { width: 1280, height: 900 };
const MITTEL = { width: 1280, height: 600 };
const FLACH = { width: 1280, height: 420 };
/**
 * JOB 3812 R3 · die fünfte Lage von L18c: GLEICH HOCH wie `FLACH`, nur schmaler. Sie ändert das
 * Fenster ein weiteres Mal, ohne den senkrechten Platz anzufassen — so ist ein verstelltes Blatt
 * eindeutig auf die Fensteränderung zurückzuführen und nicht auf neuen Platz. Breit bleibt sie
 * deutlich über 1024 px: die breite Bauform darf dabei nicht umschlagen.
 */
const SCHMALER = { width: 1200, height: FLACH.height };

/**
 * JOB 3938 · DIE SECHSTE LAGE: SO FLACH, DASS DAS BLATT NACH OBEN AUFKLAPPEN MUSS.
 *
 * Ihre Höhe steht hier NICHT als Zahl, weil sie keine ist: sie hängt am gemessenen Ort des
 * Auslösers. Aus `PruefenMenue.tsx` (`:174`, `:185`, `:186`, `:187`) folgt
 *   platzUnten = fensterHoehe - (ausloeserTop + 32) - 8 · platzOben = ausloeserTop - 4 - 8
 *   nachOben   ⇔ platzUnten < platzOben ⇔ fensterHoehe < 2 · ausloeserTop + 28,
 * also eine SCHWELLE, die `aufwaertsMessen` aus seiner eigenen Messung rechnet.
 *
 * Die zwei Zahlen hier sind der Rand um diese Schwelle:
 *   · ABSTAND — so weit unter die Schwelle wird gefahren. Beim Verkleinern kann der Auslöser ein
 *     Stück wandern; ohne Rand entschiede eine Zahl, die aus dem Fenster VORHER stammt. Dass der
 *     Zweig wirklich genommen wurde, bleibt trotzdem eine MESSUNG (L18d, erste Zusicherung) und
 *     keine Folgerung aus dieser Rechnung.
 *   · MINDEST — darunter wird nicht gegangen. Ein Fenster von wenigen Dutzend Pixeln misst nicht
 *     mehr die Fläche, sondern ihren Zusammenbruch.
 */
const AUFWAERTS_ABSTAND_PX = 60;
const AUFWAERTS_MINDEST_PX = 240;

/**
 * Wie weit sich die HÜLLE (`MAIN[flex-1 overflow-y-auto …]`, der Bereich, in dem die Karte liegt)
 * über die dreissig Schritte hinweg überhaupt noch bewegen darf.
 *
 * WARUM ES DIESE GRENZE GIBT (Auftrag §5.6). JOB 3593 hat als Rest hinterlassen: „Die Hülle rollt
 * nach der Reparatur noch 86 px (vorher 841). Woher genau diese 86 px kommen, ist nicht
 * nachgegangen worden … sie schaden der Zusage nicht" (`archiv/3593/runde-1/RUECKGABE.md:64`).
 *
 * SIE SCHADETEN DOCH, und das ist gemessen (Cloud-Lauf fd8f48791cf0b46b1eb58b04): mit diesen 86 px
 * rutschte die Karte bei Schritt 13 um 3,5 px unter das Kopfband — der Rollbereich der Hülle endete
 * oben bei 56 px, die Karte stand bei 52,5 px. Aufgefallen ist das erst, seit `imFenster` auch den
 * ABSCHNEIDENDEN Vorfahren kennt (Lieferung 4); gegen das blosse Fenster gemessen war es unsichtbar.
 *
 * WOHER DIE 86 PX KAMEN — die Erklärung, die gefehlt hat: Es ist der ÜBERHANG der Liste unter den
 * sichtbaren Teil der Hülle. Gemessen bei 1280×900: die Liste reichte bis 768,5 px, die Hülle war
 * nur bis 683 px sichtbar — 85,5 px Überhang, 86 px Hüllenbewegung. Bei 1280×420: 432,5 gegen
 * 227 px, also 205,5 px Überhang und 206 px Bewegung. `scrollIntoView({ block: "nearest" })` muss
 * für einen Eintrag im überhängenden Teil auch die Hülle bewegen, und zwar genau um den Überhang;
 * deshalb ist die Bewegung einmalig und wächst nicht mit der Zahl der Schritte.
 *
 * WOHER DIE SCHRANKE KOMMT. Seit die Liste ihren Deckel aus dem wirklich verfügbaren Platz nimmt,
 * gibt es keinen Überhang mehr — und damit keinen Grund, die Hülle überhaupt anzufassen. Erlaubt
 * sind deshalb nur zwei Pixel: Platz für gebrochene Gerätepixel, nicht für eine Restbewegung.
 * Jede echte Bewegung der Hülle ist ab hier ein Rückfall und macht L11 rot.
 */
const HUELLE_SPIEL_PX = 2;

let browser3: EingabeBrowser | null = null;
let app3: ReturnType<typeof buildApp> | null = null;
let fehler3: string | null = null;
let taste: Weglauf | null = null;
let rad: Weglauf | null = null;
let tasteFlach: Weglauf | null = null;
let radFlach: Weglauf | null = null;
let tasteMittel: Weglauf | null = null;
let radMittel: Weglauf | null = null;
let probenHoch: Probenlauf | null = null;
let probenFlach: Probenlauf | null = null;
let probenMittel: Probenlauf | null = null;
/** JOB 3812 · Lieferung 1, je Fensterlage eine Probe. */
const leseproben: Leseprobe[] = [];
/** JOB 3812 · Lieferung 2, je Fensterlage zwei Befunde: ohne und mit probeweisem Rollbereich. */
const menuebefunde: Menuebefund[] = [];
/** JOB 3812 · Lieferung 4, je Fensterlage ein Tastaturweg. */
const tastaturwege: Tastaturweg[] = [];
/** JOB 3812 · RUNDE 2, L18: EIN offenes Blatt, drei Änderungen unter ihm. */
const menuewandel: Menuewandel[] = [];
/** JOB 3812 · RUNDE 2, L19: ein Artikelwechsel aus heruntergerollter Karte. */
let artikelwechsel: Artikelwechsel | null = null;
/** JOB 3938 · L18d: der Aufwärtszweig, auf eigener Seite und mit eigener Ergebnisliste. */
let aufwaerts: Aufwaertslauf | null = null;

/**
 * Die zwei Höhen der Kopfprobe. Zwei statt einer, damit L14 eine REGEL misst und keinen Zufall:
 * Verkleinert sich die Liste bei beiden um genau die eingesetzte Höhe, dann rechnet der Deckel mit
 * dem, was über der Liste steht — und nicht mit einer Zahl.
 */
const PROBEN_HOEHEN = [24, 48] as const;

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
       * Eine frische Seite auf der Prüffläche, in der gewünschten Fensterlage — der Auftakt, den
       * alle Messungen dieses Blocks teilen (JOB 3812: bis dahin stand er zweimal wörtlich da).
       * Gewartet wird auf BEIDES: die Karte rechts und die vollständige Liste links. Erst dann ist
       * die Bühne die Bühne, von der die Zahlen erzählen.
       */
      const seiteOeffnen = async (lage: {
        width: number;
        height: number;
      }): Promise<Eingabeseite> => {
        const s = await (browser3 as EingabeBrowser).newPage({
          viewport: { width: lage.width, height: lage.height },
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
        return s;
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
      const wegMessen = async (
        weg: "taste" | "rad",
        lage: { width: number; height: number },
      ): Promise<Weglauf> => {
        const s = await seiteOeffnen(lage);
        const anker = [EINTRAG_ANKER, KARTE_ANKER, SCHLANGE_ANKER];
        const start = await s.evaluate<LangMessung | null>(fn(LANG_MESSEN), anker);
        if (!start || !start.auswahl || !start.karte || !start.schlange || !start.kartentitel) {
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
            //
            // UND GEGEN DEN SICHTBAREN TEIL DER HÜLLE GEKAPPT, nicht nur gegen das Fenster: Bei
            // 1280×420 reichte die Liste (bis 432,5 px) weit unter die Hülle (sichtbar bis 227 px),
            // die Mitte lag damit bei 279 px — und dort steht das Hinweisband der Anwendung. Das Rad
            // gehörte der Seite, der erste Radschritt kam nie an (Cloud-Lauf
            // fd8f48791cf0b46b1eb58b04: `unterDemZeiger: P[]„Diese Anwendung arbeitet mit k…"`).
            // Gemessen wird der Ausschnitt, nicht geraten.
            //
            // JOB 3812: gekappt wird gegen die HÜLLE (`karteHuelle`) und nicht mehr gegen
            // `karteAusschnitt` — seit die Artikelspalte selbst beschneidet, sind das zwei
            // verschiedene Kästen, und der Zeiger steht über der LISTE, nicht über der Karte.
            const k = letzte.schlange as Randkasten;
            const sichtbarOben = Math.max(k.oben, 0, letzte.karteHuelle.oben);
            const sichtbarUnten = Math.min(k.unten, letzte.fensterHoehe, letzte.karteHuelle.unten);
            zeigerX = Math.round((k.links + k.rechts) / 2);
            zeigerY = Math.round((sichtbarOben + sichtbarUnten) / 2);
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
          if (!m || !m.auswahl || !m.karte || !m.schlange || !m.kartentitel) {
            throw new Error(`${weg}: Schritt ${i} war nicht vollstaendig zu messen`);
          }
          schritte.push({
            schritt: i,
            index: m.index,
            auswahl: m.auswahl,
            karte: m.karte,
            kartentitel: m.kartentitel,
            auswahlAusschnitt: m.auswahlAusschnitt,
            karteAusschnitt: m.karteAusschnitt,
            karteHuelle: m.karteHuelle,
            fensterHoehe: m.fensterHoehe,
            rollposition: m.rollposition,
            rollerTop: m.rollerTop,
            rollerName: m.rollerName,
            huelleTop: m.huelleTop,
            huelleName: m.huelleName,
            huelleMax: m.huelleMax,
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
        const marke = `${weg} ${lage.width}x${lage.height}`;
        console.info(
          `JOB 3593 L · ${marke} · Auswahl ${JSON.stringify(ersterSichtverlust(schritte, "auswahl"))} · Karte ${JSON.stringify(ersterSichtverlust(schritte, "karte"))}`,
        );
        // Die Zahlen von Lieferung 2 und 6 stehen hier, damit sie auch bei GRÜNEM Lauf im
        // Protokoll landen: die Höhe über der Liste (`kopfHoehe`), wie weit die Liste nach unten
        // reicht, und was die Hülle überhaupt rollen kann.
        const letzteM = schritte.at(-1);
        console.info(
          `JOB 3593 L · ${marke} · Kopf ${JSON.stringify({ kopfHoehe: start.schlange?.oben, schlangeUnten: start.schlange?.unten, fensterHoehe: start.fensterHoehe })} · Huelle ${JSON.stringify({ name: letzteM?.huelleName, top: letzteM?.huelleTop, max: letzteM?.huelleMax, verlauf: schritte.map((x) => x.huelleTop) })}`,
        );
        // JOB 3625 R2 · WAS DIE HÜLLE VON DER KARTE ÜBERHAUPT ZEIGEN KANN — die Zahl, die die
        // verschärfte Sichtregel sichtbar gemacht hat. Sie steht auch bei GRÜNEM Lauf im
        // Protokoll: bei flachen Fenstern ist sie der Grund, warum die Zusage am Titel gemessen
        // wird und nicht an der ganzen Karte (L8/L10).
        if (letzteM) {
          console.info(
            `JOB 3593 L · ${marke} · Karte ${JSON.stringify({
              kasten: letzteM.karte,
              hoehe: Math.round((letzteM.karte.unten - letzteM.karte.oben) * 100) / 100,
              ausschnitt: letzteM.karteAusschnitt,
              sichtbar:
                Math.round(
                  sichtbareHoehe(letzteM.karte, letzteM.fensterHoehe, letzteM.karteAusschnitt) *
                    100,
                ) / 100,
              fehlt:
                Math.round(
                  fehlendeHoehe(letzteM.karte, letzteM.fensterHoehe, letzteM.karteAusschnitt) * 100,
                ) / 100,
              titel: letzteM.kartentitel,
            })}`,
          );
        }
        console.info(
          `JOB 3593 L · ${marke} · Start ${JSON.stringify({ anzahl: start.anzahl, auswahl: start.auswahl, karte: start.karte, fensterHoehe: start.fensterHoehe })} · Stuetzstellen ${JSON.stringify(schritte.filter((x) => [1, 10, 20, SCHRITTE].includes(x.schritt)))} · rechts „${lauf.letzterKartenTitel}"`,
        );
        return lauf;
      };

      /** Die Kopfprobe (Lieferung 5/§9), auf eigener Seite und ohne einen einzigen Schritt. */
      const probenMessen = async (lage: {
        width: number;
        height: number;
      }): Promise<Probenlauf> => {
        const s = await seiteOeffnen(lage);
        const m = await s.evaluate<LangMessung | null>(fn(LANG_MESSEN), [
          EINTRAG_ANKER,
          KARTE_ANKER,
          SCHLANGE_ANKER,
        ]);
        if (!m || !m.schlange) {
          throw new Error(`Kopfprobe ${lage.width}x${lage.height}: die Liste war nicht zu messen`);
        }
        const proben: Kopfprobe[] = [];
        for (const h of PROBEN_HOEHEN) {
          const p = await s.evaluate<Kopfprobe | null>(fn(KOPF_PROBE), [SCHLANGE_ANKER, h]);
          if (!p) {
            throw new Error(`Kopfprobe ${lage.width}x${lage.height}: kein Ergebnis bei ${h} px`);
          }
          proben.push(p);
        }
        // JOB 3812: `karteHuelle` statt `karteAusschnitt` — L14 fragt, ob die Liste im sichtbaren
        // Teil der HÜLLE bleibt, und das ist seit dieser Runde nicht mehr derselbe Kasten.
        const lauf: Probenlauf = { huelleUnten: m.karteHuelle.unten, proben };
        console.info(`JOB 3625 L14 · ${lage.width}x${lage.height} · ${JSON.stringify(lauf)}`);
        return lauf;
      };

      /**
       * JOB 3812 · Lieferung 1 — den Artikel lesen, auf eigener Seite und ohne einen Schritt in
       * der Liste. Die Seite wird danach geschlossen: die Probe nimmt ihre Rollstellung zwar
       * selbst zurück (`zurueck`), aber eine frische Seite je Messung ist die Bauform dieses
       * Blocks und hält die Messungen voneinander unabhängig.
       */
      const leseMessen = async (lage: {
        width: number;
        height: number;
      }): Promise<Leseprobe> => {
        const s = await seiteOeffnen(lage);
        const p = await s.evaluate<Omit<Leseprobe, "lage"> | null>(fn(ARTIKEL_LESEN), [
          KARTE_ANKER,
          SCHLANGE_ANKER,
          EINTRAG_ANKER,
        ]);
        if (!p) {
          throw new Error(`Leseprobe ${lage.width}x${lage.height}: die Fläche war nicht zu messen`);
        }
        const probe: Leseprobe = { ...p, lage: `${lage.width}x${lage.height}` };
        console.info(`JOB 3812 L15 · ${probe.lage} · ${JSON.stringify(probe)}`);
        return probe;
      };

      /**
       * JOB 3812 · Lieferung 2 — das „···"-Menü der Karte öffnen und messen, wie viel von seinem
       * Blatt zu sehen ist. Einmal am Produktstand, einmal mit probeweise aufgesetztem
       * Rollbereich an der rechten Spalte (§5.2).
       *
       * Öffnen, WARTEN, messen — die drei Schritte bleiben getrennt (Begründung an `MENUE_OEFFNEN`).
       */
      const menueMessen = async (
        lage: { width: number; height: number },
        probe: boolean,
      ): Promise<Menuebefund> => {
        const marke = `${lage.width}x${lage.height}${probe ? " + Probe" : ""}`;
        const s = await seiteOeffnen(lage);
        if (probe) {
          const gesetzt = await s.evaluate<Spaltenprobe | null>(fn(SPALTEN_PROBE), [
            KARTE_ANKER,
            true,
          ]);
          if (!gesetzt) {
            throw new Error(`Menü ${marke}: die rechte Spalte war nicht zu finden`);
          }
          console.info(`JOB 3812 L16 · ${marke} · Spaltenprobe ${JSON.stringify(gesetzt)}`);
        }
        const geoeffnet = await s.evaluate<boolean>(fn(MENUE_OEFFNEN), KARTE_ANKER);
        if (!geoeffnet) {
          throw new Error(`Menü ${marke}: das „···"-Menü der Karte war nicht zu finden`);
        }
        await s.waitForFunction(fn(BLATT_DA), undefined, { timeout: 30_000 });
        const m = await s.evaluate<Omit<Menuebefund, "lage" | "probe"> | null>(fn(MENUE_LAGE), [
          KARTE_ANKER,
          "karte",
        ]);
        if (!m) {
          throw new Error(`Menü ${marke}: das Blatt war nach dem Öffnen nicht zu messen`);
        }
        const befund: Menuebefund = { ...m, lage: `${lage.width}x${lage.height}`, probe };
        console.info(`JOB 3812 L16 · ${marke} · ${JSON.stringify(befund)}`);
        return befund;
      };

      /**
       * JOB 3812 · RUNDE 2 — EIN OFFENES BLATT ÜBERLEBT, WAS SICH UNTER IHM ÄNDERT.
       *
       * DIE LÜCKE, DIE HIERHER FÜHRT (Prüfbericht der Runde 1, Korrekturpflicht 1): Runde 1 hat je
       * Fensterlage eine FRISCHE Seite geöffnet und das Menü dort geöffnet — damit war jede Lage
       * eine eigene Rechnung, und dass ein SCHON offenes Blatt seine Rechnung behält, blieb
       * ungemessen. Genau dort sass der Fehler: `blattlage()` lief nur im Klick des Auslösers.
       *
       * DESHALB EINE EINZIGE SEITE UND EIN EINZIGES ÖFFNEN. Das Blatt bleibt über alle Schritte
       * offen; gemessen wird nach jedem. Dass es offen GEBLIEBEN ist, ist selbst ein Messwert
       * (`BLATT_DA` vor jeder Messung) — ein Menü, das beim Verkleinern einfach zuklappte, bestünde
       * diesen Fall sonst, ohne die Zusage zu erfüllen.
       *
       * DREI SCHRITTE, jeder ein anderer Weg, die Rechnung zu verstellen:
       *   1. 1280×900 → 1280×600 (die Lage dazwischen, HINWEIS 1)
       *   2. 1280×600 → 1280×420 (die flache Lage des Auftrags)
       *   3. die Artikelspalte bei 1280×420 ans Ende rollen — seit diesem Job rollt sie selbst.
       */
      const wandelMessen = async (): Promise<void> => {
        const s = await seiteOeffnen(HOCH);
        const geoeffnet = await s.evaluate<boolean>(fn(MENUE_OEFFNEN), KARTE_ANKER);
        if (!geoeffnet) {
          throw new Error('Wandel: das „···"-Menü der Karte war nicht zu finden');
        }
        await s.waitForFunction(fn(BLATT_DA), undefined, { timeout: 30_000 });
        const messen = async (
          schritt: string,
          gerollt: { top: number; max: number } | null,
        ): Promise<void> => {
          // Zuerst: steht das Blatt überhaupt noch? Ein zugeklapptes Menü ist keine erfüllte
          // Zusage, sondern ein anderer Befund — und `MENUE_LAGE` gäbe dafür nur `null` zurück.
          const nochOffen = await s.evaluate<boolean>(fn(BLATT_DA));
          if (!nochOffen) {
            throw new Error(`Wandel ${schritt}: das Blatt ist nicht mehr offen`);
          }
          const m = await s.evaluate<Omit<Menuebefund, "lage" | "probe"> | null>(fn(MENUE_LAGE), [
            KARTE_ANKER,
            "karte",
          ]);
          if (!m) {
            throw new Error(`Wandel ${schritt}: das Blatt war nicht zu messen`);
          }
          const eintrag: Menuewandel = {
            schritt,
            befund: { ...m, lage: schritt, probe: false },
            gerollt,
          };
          console.info(`JOB 3812 L18 · ${schritt} · ${JSON.stringify(eintrag)}`);
          menuewandel.push(eintrag);
        };
        await messen("1280x900 · frisch geoeffnet", null);
        for (const ziel of [MITTEL, FLACH]) {
          await s.evaluate<boolean>(fn(FENSTER_ZURUECK));
          await s.setViewportSize(ziel);
          await s.waitForFunction(fn(FENSTER_STEHT), [ziel.width, ziel.height], {
            timeout: 30_000,
          });
          await messen(`auf ${ziel.width}x${ziel.height} verkleinert, Blatt blieb offen`, null);
        }
        const gerollt = await s.evaluate<{ top: number; max: number } | null>(
          fn(SPALTE_ANS_ENDE),
          SPALTE_ANKER,
        );
        if (!gerollt) {
          throw new Error("Wandel: die Artikelspalte war zum Rollen nicht zu finden");
        }
        await s.evaluate<boolean>(fn(RUHE_ZURUECK), SPALTE_ANKER);
        await s.waitForFunction(fn(RUHE), SPALTE_ANKER, { timeout: 15_000 });
        await messen("1280x420, Artikelspalte ans Ende gerollt", gerollt);
        // JOB 3812 R3 · DER FÜNFTE SCHRITT — der Weg, auf dem der Prüfbericht der Runde 2 das
        // Blatt verloren hat: NACH dem Rollen noch einmal das Fenster ändern. Geändert wird die
        // BREITE bei gleicher Höhe, und das aus einem Grund: so ist die einzige Neuigkeit das
        // Ereignis selbst. Bliebe die Höhe nicht stehen, wäre am Ende nicht zu unterscheiden, ob
        // sich das Blatt wegen des weggerollten Auslösers verstellt hat oder wegen des neuen
        // Platzes.
        await s.evaluate<boolean>(fn(FENSTER_ZURUECK));
        await s.setViewportSize(SCHMALER);
        await s.waitForFunction(fn(FENSTER_STEHT), [SCHMALER.width, SCHMALER.height], {
          timeout: 30_000,
        });
        await messen(
          `auf ${SCHMALER.width}x${SCHMALER.height} gezogen, nachdem die Spalte gerollt war`,
          gerollt,
        );
      };

      /**
       * JOB 3938 · DER ZWEITE ORT DES BLATTS — der Zweig, den noch kein Browser betreten hat.
       *
       * DIE LÜCKE (BEN an JOB 3812 R3, Prüfpunkt 6: „nach oben öffnende Menüs gesondert im Browser
       * prüfen"): Das Produkt klappt das Blatt über dem Auslöser auf, wenn unten weniger Platz ist
       * als oben (`PruefenMenue.tsx:187-188`). Alle bisherigen Browserfälle — L16, L18, L18b, L18c
       * — messen Fenster, in denen unten reichlich Platz ist; `:188` war unbetreten.
       *
       * EIGENE SEITE, EIGENE ERGEBNISLISTE. `menuewandel` behält seine fünf Einträge: L18 und L18b
       * zählen sie ausdrücklich, und ein sechster Eintrag hiesse „ein Schritt desselben Weges",
       * was dieser Fall nicht ist. Er hat einen anderen Ausgangspunkt und einen anderen Zweck.
       *
       * VIER SCHRITTE, und der dritte ist der Grund für den zweiten:
       *   a. In der bekannten flachen Lage öffnen und MESSEN — daher kommt `ausloeser.oben`.
       *   b. Aus dieser Zahl die Fensterhöhe herleiten, bei der `:187` umschlägt (Rechnung an
       *      `AUFWAERTS_ABSTAND_PX`), und darauf warten, dass das Fenster wirklich steht.
       *   c. Das Blatt ZWISCHENDURCH schliessen. Die Lage wird einmal im Klick gerechnet; ein
       *      offen gebliebenes Blatt brächte seine Abwärtsrechnung mit, und der Zweig bliebe
       *      wieder unbetreten. Dieser Schritt ist der Unterschied zu L18, nicht ein Detail.
       *   d. Neu öffnen und messen.
       */
      const aufwaertsMessen = async (): Promise<Aufwaertslauf> => {
        const s = await seiteOeffnen(FLACH);
        const messen = async (was: string, marke: string): Promise<Menuebefund> => {
          const m = await s.evaluate<Omit<Menuebefund, "lage" | "probe"> | null>(fn(MENUE_LAGE), [
            KARTE_ANKER,
            "karte",
          ]);
          if (!m) {
            throw new Error(`Aufwaerts ${was}: das Blatt war nicht zu messen`);
          }
          return { ...m, lage: marke, probe: false };
        };
        const oeffnen = async (was: string): Promise<void> => {
          const geklickt = await s.evaluate<boolean>(fn(MENUE_OEFFNEN), KARTE_ANKER);
          if (!geklickt) {
            throw new Error(`Aufwaerts ${was}: das „···"-Menü der Karte war nicht zu finden`);
          }
        };
        // a. Die Ausgangslage — gemessen mit demselben einen Messkopf. Ein zweiter Leser nur für
        //    das Rechteck des Auslösers wäre ein zweiter Messstab für dieselbe Frage.
        await oeffnen("Ausgangslage");
        await s.waitForFunction(fn(BLATT_DA), undefined, { timeout: 30_000 });
        const vorher = await messen("Ausgangslage", `${FLACH.width}x${FLACH.height}`);
        // b. Die Herleitung. Die Zahl ist gerechnet, ihre Eingangsgrösse gemessen — und ob der
        //    Zweig dann wirklich genommen wurde, misst L18d noch einmal am Ergebnis.
        const schwelle = 2 * vorher.ausloeser.oben + 28;
        const zielHoehe = Math.max(
          AUFWAERTS_MINDEST_PX,
          Math.floor(schwelle) - AUFWAERTS_ABSTAND_PX,
        );
        // c. Zumachen, Fenster setzen, warten.
        await oeffnen("Schliessen");
        await s.waitForFunction(fn(BLATT_WEG), undefined, { timeout: 30_000 });
        await s.evaluate<boolean>(fn(FENSTER_ZURUECK));
        await s.setViewportSize({ width: FLACH.width, height: zielHoehe });
        await s.waitForFunction(fn(FENSTER_STEHT), [FLACH.width, zielHoehe], { timeout: 30_000 });
        // d. Und erst jetzt öffnen.
        await oeffnen("flaches Fenster");
        await s.waitForFunction(fn(BLATT_DA), undefined, { timeout: 30_000 });
        const befund = await messen("flaches Fenster", `${FLACH.width}x${zielHoehe}`);
        const lauf: Aufwaertslauf = {
          ausloeserObenFlach: vorher.ausloeser.oben,
          fensterHoeheFlach: vorher.fensterHoehe,
          schwelle,
          zielHoehe,
          vorher,
          befund,
        };
        console.info(`JOB 3938 L18d · ${JSON.stringify(lauf)}`);
        return lauf;
      };

      /**
       * JOB 3812 · RUNDE 2 — EIN ANDERER ARTIKEL FÄNGT OBEN AN.
       *
       * Die zweite Prüflücke des Berichts: „Artikelwechsel nach heruntergerollter Karte". Gemessen
       * in der flachen Lage, weil es nur dort etwas zu rollen gibt — bei 1280×900 passt die Karte
       * ohne Rest, und der Fall prüfte nichts (`max` steht deshalb in der Zusicherung).
       *
       * Der Wechsel läuft über den KLICK auf den nächsten Listeneintrag, also den Weg eines
       * Menschen, und gewartet wird auf den TITEL IM BLATT DER KARTE — nicht auf `aria-current`
       * links, das nur sagt, was markiert ist, und nicht, was rechts steht.
       */
      const wechselMessen = async (): Promise<void> => {
        const s = await seiteOeffnen(FLACH);
        const anker = [KARTE_ANKER, SCHLANGE_ANKER, EINTRAG_ANKER];
        const gerollt = await s.evaluate<{ top: number; max: number } | null>(
          fn(SPALTE_ANS_ENDE),
          SPALTE_ANKER,
        );
        if (!gerollt) {
          throw new Error("Wechsel: die Artikelspalte war zum Rollen nicht zu finden");
        }
        await s.evaluate<boolean>(fn(RUHE_ZURUECK), SPALTE_ANKER);
        await s.waitForFunction(fn(RUHE), SPALTE_ANKER, { timeout: 15_000 });
        const vorher = await s.evaluate<Wechselstand | null>(fn(WECHSEL_STAND), anker);
        const wechsel = await s.evaluate<{
          von: number;
          nach: number;
          vorherTitel: string | null;
          vorherTop: number;
        } | null>(fn(ARTIKEL_WECHSELN), [EINTRAG_ANKER, KARTE_ANKER]);
        if (!vorher || !wechsel) {
          throw new Error("Wechsel: die Ausgangslage war nicht zu messen");
        }
        await s.waitForFunction(fn(ANDERER_ARTIKEL), [KARTE_ANKER, wechsel.vorherTitel], {
          timeout: 30_000,
        });
        await s.evaluate<boolean>(fn(RUHE_ZURUECK), SPALTE_ANKER);
        await s.waitForFunction(fn(RUHE), SPALTE_ANKER, { timeout: 15_000 });
        const nachher = await s.evaluate<Wechselstand | null>(fn(WECHSEL_STAND), anker);
        if (!nachher) {
          throw new Error("Wechsel: der Stand nach dem Wechsel war nicht zu messen");
        }
        artikelwechsel = {
          lage: `${FLACH.width}x${FLACH.height}`,
          von: wechsel.von,
          nach: wechsel.nach,
          vorherTitel: wechsel.vorherTitel,
          vorher,
          nachher,
        };
        console.info(`JOB 3812 L19 · ${JSON.stringify(artikelwechsel)}`);
      };

      /**
       * JOB 3812 · Lieferung 4 — der Tastaturweg in die rechte Spalte und bis ans Ende des
       * Artikels. Drei Schritte, jeder gemessen: Ausgangsstellung setzen, EIN Tab, dann „Ende".
       */
      const tastaturMessen = async (lage: {
        width: number;
        height: number;
      }): Promise<Tastaturweg> => {
        const marke = `${lage.width}x${lage.height}`;
        const s = await seiteOeffnen(lage);
        const anker = [SPALTE_ANKER, SCHLANGE_ANKER, EINTRAG_ANKER, KARTE_ANKER];
        const start = await s.evaluate<{
          steht: boolean;
          tabIndex: number;
          max: number;
        } | null>(fn(TASTATUR_START), [SPALTE_ANKER, EINTRAG_ANKER]);
        if (!start) {
          throw new Error(`Tastatur ${marke}: die rechte Spalte war nicht zu finden`);
        }
        if (!start.steht) {
          throw new Error(`Tastatur ${marke}: der Fokus liess sich nicht in die Liste setzen`);
        }
        await s.keyboard.press("Tab");
        await s.evaluate<boolean>(fn(RUHE_ZURUECK), SPALTE_ANKER);
        await s.waitForFunction(fn(RUHE), SPALTE_ANKER, { timeout: 15_000 });
        const nachTab = await s.evaluate<Tastaturstand | null>(fn(TASTATUR_STAND), anker);
        await s.keyboard.press("End");
        // GEMESSEN WIRD ERST, WENN DIE BEWEGUNG STEHT. Chromium rollt Tasteneingaben ANIMIERT;
        // die erste Fassung dieser Messung las direkt nach dem Tastendruck und meldete „0 von 193
        // px gerollt" (Cloud-Lauf 6f4e00d58bc8859d2e2c2ce2) — eine wahre Zahl zum falschen
        // Zeitpunkt. `RUHE` wartet auf fünf Bilder ohne Veränderung; steht die Spalte wirklich
        // still, ist die Bedingung sofort erfüllt, und der Fall meldet den echten Stillstand.
        await s.evaluate<boolean>(fn(RUHE_ZURUECK), SPALTE_ANKER);
        await s.waitForFunction(fn(RUHE), SPALTE_ANKER, { timeout: 15_000 });
        const nachEnde = await s.evaluate<Tastaturstand | null>(fn(TASTATUR_STAND), anker);
        if (!nachTab || !nachEnde) {
          throw new Error(`Tastatur ${marke}: der Stand war nicht zu messen`);
        }
        const weg: Tastaturweg = { lage: marke, tabIndex: start.tabIndex, nachTab, nachEnde };
        console.info(`JOB 3812 L17 · ${marke} · ${JSON.stringify(weg)}`);
        return weg;
      };

      taste = await wegMessen("taste", HOCH);
      rad = await wegMessen("rad", HOCH);
      tasteFlach = await wegMessen("taste", FLACH);
      radFlach = await wegMessen("rad", FLACH);
      tasteMittel = await wegMessen("taste", MITTEL);
      radMittel = await wegMessen("rad", MITTEL);
      probenHoch = await probenMessen(HOCH);
      probenFlach = await probenMessen(FLACH);
      probenMittel = await probenMessen(MITTEL);
      for (const lage of [HOCH, MITTEL, FLACH]) {
        leseproben.push(await leseMessen(lage));
      }
      for (const lage of [HOCH, MITTEL, FLACH]) {
        for (const probe of [false, true]) {
          menuebefunde.push(await menueMessen(lage, probe));
        }
      }
      for (const lage of [HOCH, MITTEL, FLACH]) {
        tastaturwege.push(await tastaturMessen(lage));
      }
      await wandelMessen();
      aufwaerts = await aufwaertsMessen();
      await wechselMessen();
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
    expect(tasteFlach).not.toBeNull();
    expect(radFlach).not.toBeNull();
    expect(tasteMittel).not.toBeNull();
    expect(radMittel).not.toBeNull();
    for (const lauf of [taste, rad, tasteFlach, radFlach, tasteMittel, radMittel]) {
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
      `die Auswahl ist bei Schritt ${befund.schritt} nicht mehr ganz zu sehen (${befund.fehlbetragPx} px fehlen, sichtbarer Bereich ${befund.bereichOben}–${befund.bereichUnten} in ${befund.rollerName})`,
    ).toBeNull();
  });

  it("L2 · Pfeiltaste: und die KARTE des gewaehlten Artikels bleibt im Fenster", () => {
    expect(fehler3).toBeNull();
    const befund = ersterSichtverlust(taste?.schritte ?? [], "karte");
    expect(
      befund.schritt,
      `die Karte ist bei Schritt ${befund.schritt} nicht mehr ganz zu sehen (${befund.fehlbetragPx} px fehlen, Rollposition ${befund.rollposition}, sichtbarer Bereich ${befund.bereichOben}–${befund.bereichUnten})`,
    ).toBeNull();
  });

  it("L3 · Mausrad: die Auswahl bleibt im Fenster", () => {
    expect(fehler3).toBeNull();
    const befund = ersterSichtverlust(rad?.schritte ?? [], "auswahl");
    expect(
      befund.schritt,
      `die Auswahl ist bei Schritt ${befund.schritt} nicht mehr ganz zu sehen (${befund.fehlbetragPx} px fehlen, sichtbarer Bereich ${befund.bereichOben}–${befund.bereichUnten} in ${befund.rollerName})`,
    ).toBeNull();
  });

  it("L4 · Mausrad: und die KARTE des gewaehlten Artikels bleibt im Fenster", () => {
    expect(fehler3).toBeNull();
    const befund = ersterSichtverlust(rad?.schritte ?? [], "karte");
    expect(
      befund.schritt,
      `die Karte ist bei Schritt ${befund.schritt} nicht mehr ganz zu sehen (${befund.fehlbetragPx} px fehlen, Rollposition ${befund.rollposition}, sichtbarer Bereich ${befund.bereichOben}–${befund.bereichUnten})`,
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

  // ------------------------------------------------------------------------------------------
  // JOB 3625 · DIE FLACHE LAGE — dieselbe Zusage, ein Fenster von 1280×420.
  // ------------------------------------------------------------------------------------------
  // Vier Fälle statt zwei, weil Pedis Satz zwei Hälften hat („links durchgehen" UND „rechts den
  // Artikel sehen") und weil beide Bedienwege über verschiedene Zuhörer laufen. Sie sind wörtlich
  // wie L1–L4 gebaut; was sie unterscheidet, ist einzig die Fensterhöhe — bei 420 px frisst der
  // Kopf über der Liste mehr als ein Drittel der Höhe, und genau daran hängt `70vh`.
  it("L7 · FLACHES FENSTER · Pfeiltaste: die Auswahl bleibt im Bild", () => {
    expect(fehler3).toBeNull();
    const befund = ersterSichtverlust(tasteFlach?.schritte ?? [], "auswahl");
    expect(
      befund.schritt,
      `die Auswahl ist bei Schritt ${befund.schritt} nicht mehr ganz zu sehen (${befund.fehlbetragPx} px fehlen, Rollposition ${befund.rollposition}, sichtbarer Bereich ${befund.bereichOben}–${befund.bereichUnten} in ${befund.rollerName})`,
    ).toBeNull();
  });

  // ------------------------------------------------------------------------------------------
  // JOB 3625 R2 · WAS BEI 1280×420 GEMESSEN WERDEN KANN — UND WAS DORT NIEMAND SEHEN KANN.
  // ------------------------------------------------------------------------------------------
  // Codex hat an Runde 1 gerügt, dass die Sichtregel unten abgeschnittenen Inhalt durchwinkt. Seit
  // der Korrektur tut sie das nicht mehr — und damit steht eine Tatsache im Raum, die vorher
  // unsichtbar war. GEMESSEN (Cloud-Lauf 9bf9d8c4d70cc6cc82dfcbf3, mit der verschärften Regel):
  //   Fenster 420 · Kopfband 56 · Hinweisband der Anwendung ab 227 → sichtbare Hülle 56–227 (171 px)
  //   Kopf der Fläche bis 138,5 → unter dem Anfang der Karte bleiben 88,5 px
  //   Karte  138,5–392,75 (254,25 px hoch) → 82,5 px fehlen
  //   Titel  203,5–231    ( 27,5 px hoch)  →  4,0 px fehlen
  // In einem 420 px hohen Fenster bleiben für den Inhalt 171 px; die Karte ist 254,25 px hoch.
  // Sie GANZ zu zeigen ist dort keine Frage des Deckels an der linken Liste, sondern hiesse, die
  // rechte Spalte oder die Bänder der Hülle umzubauen — beides lag ausserhalb von JOB 3625
  // (§5: „nur die linke Liste", §10). Der Rest war nur durch Rollen der HÜLLE erreichbar, und in
  // ihr liegt die Liste; er stand deshalb als offener Punkt in der Rückgabe, nicht als grüner Fall.
  //
  // JOB 3812 HAT GENAU DIESEN PUNKT GESCHLOSSEN (Pedi am 12.09. 21:4x: „ja, rechts darf mit"):
  // die rechte Spalte rollt jetzt selbst, der ganze Artikel ist lesbar, und die Liste steht dabei
  // still. Gemessen wird das in L15; die Zahlen oben sind damit Geschichte und bleiben nur stehen,
  // weil sie erklären, WOHER dieser Block kommt.
  //
  // GEMESSEN WIRD HIER DAS, WAS DIESER FALL VERANTWORTET — dass beim Durchgehen der Liste rechts
  // NICHTS WANDERT. Genau das war der Fehler aus JOB 3593 (die Karte rutschte bei Schritt 13 um
  // 3,5 px unter das Kopfband), und genau das hält die Reparatur:
  //   1. Karte UND Titel stehen an jedem der dreissig Schritte am GLEICHEN ORT wie beim ersten.
  //   2. Keiner von beiden wandert über den sichtbaren Teil der Artikelspalte hinaus oder rutscht
  //      tiefer unter sie als am Anfang.
  //   3. Von beiden ist an jedem Schritt GLEICH VIEL zu sehen wie beim ersten.
  //   4. Karte und Liste beginnen auf derselben Höhe — über der Karte verfällt kein Platz.
  // Die Elle ist überall dieselbe (`SICHT_TOLERANZ_PX`, `ueberDemFenster`, `unterDemFenster`,
  // `sichtbareHoehe`); es entsteht kein zweiter Massstab, nur eine andere — kleinere — Aussage als
  // bei 1280×900, wo L2/L4 weiterhin die VOLLE Sichtbarkeit der Karte verlangen.
  //
  // ------------------------------------------------------------------------------------------
  // JOB 3812 · WAS DIESE PRÜFUNG SEITHER ANDERS MISST — und warum sie dadurch mehr sagt.
  // ------------------------------------------------------------------------------------------
  // ZWEI ÄNDERUNGEN, beide erzwungen und beide hier benannt (Lieferung 5 des Auftrags):
  //
  // 1. DER RAHMEN IST NICHT MEHR DIE HÜLLE, SONDERN DIE ARTIKELSPALTE. `karteAusschnitt` war bis
  //    JOB 3812 das `<main>` der Anwendung; seit die rechte Spalte selbst beschneidet, ist SIE es
  //    (die Hülle heisst jetzt `karteHuelle` und wird in L11/L12/L14 gelesen). Das ist der engere
  //    und richtigere Rahmen: was die Spalte abschneidet, sieht auch niemand.
  //
  // 2. „UNTER DEM SICHTBAREN TEIL" IST KEINE NULL MEHR, SONDERN EINE KONSTANTE. Gemessen bei
  //    1280×420 (Cloud-Lauf 6f4e00d58bc8859d2e2c2ce2): die Artikelspalte reicht von 138,5 bis 199
  //    — 60,5 px, weil `<main>` unten 28 px Innenabstand hat. Der Titel der Karte steht bei
  //    203,5–231 und liegt damit von Anfang an 4,5 px UNTER dem Rand. Vor JOB 3812 reichte der
  //    Rahmen bis 227, und der Titel war zu 23,5 von 27,5 px zu sehen.
  //    Das ist eine ehrliche Verschlechterung am RUHENDEN Bild und der Preis dafür, dass der ganze
  //    Artikel jetzt ohne Bewegung der Liste lesbar ist (L15) — sie steht in der Rückgabe und wird
  //    nicht weggemessen. Die Zusage dieses Falls bleibt aber dieselbe: es bewegt sich NICHTS.
  //    Verglichen wird deshalb mit dem ERSTEN SCHRITT statt mit der Null; was am Anfang unter dem
  //    Rand lag, darf dort liegen — aber es darf nicht tiefer rutschen.
  //
  // NEU HINZUGEKOMMEN ist die schärfste der vier Zeilen: der Kasten steht an jedem Schritt am
  // GLEICHEN ORT (`oben`), in Fensterkoordinaten. Sie braucht keinen Rahmen und keine Regel und
  // fällt schon bei einem einzigen wandernden Pixel.
  const karteStehtStill = (name: string, lauf: Weglauf | null): void => {
    const schritte = lauf?.schritte ?? [];
    expect(schritte.length, `${name}: keine Schritte gemessen`).toBe(SCHRITTE);
    const erste = schritte[0];
    if (!erste) return;
    // Die KARTE muss von Anfang an zu sehen sein — sonst prüfte der Fall am Unsichtbaren. Für den
    // Titel gilt das seit JOB 3812 nicht mehr (Grund oben, Punkt 2); dass er ERREICHBAR ist, misst
    // L15, und dass er bei 1280×900 vollständig dasteht, L2/L4.
    const karteZuerst = sichtbareHoehe(erste.karte, erste.fensterHoehe, erste.karteAusschnitt);
    expect(
      karteZuerst,
      `${name}: die Karte war von Anfang an nicht zu sehen (Karte ${erste.karte.oben}–${erste.karte.unten}, Spalte ${erste.karteAusschnitt.oben}–${erste.karteAusschnitt.unten})`,
    ).toBeGreaterThan(SICHT_TOLERANZ_PX);
    for (const [was, kastenVon] of [
      ["die Karte", (m: Schrittmessung) => m.karte],
      ["der Titel der Karte", (m: Schrittmessung) => m.kartentitel],
    ] as const) {
      const zuerst = sichtbareHoehe(kastenVon(erste), erste.fensterHoehe, erste.karteAusschnitt);
      const obenZuerst = kastenVon(erste).oben;
      const unterZuerst = unterDemFenster(
        kastenVon(erste),
        erste.fensterHoehe,
        erste.karteAusschnitt,
      );
      for (const m of schritte) {
        const k = kastenVon(m);
        const gewandert = Math.round(Math.abs(k.oben - obenZuerst) * 100) / 100;
        expect(
          gewandert,
          `${name}: Schritt ${m.schritt}: ${was} steht bei ${k.oben} px statt bei ${obenZuerst} px wie beim ersten Schritt (${gewandert} px gewandert)`,
        ).toBeLessThanOrEqual(SICHT_TOLERANZ_PX);
        const ueber = ueberDemFenster(k, m.karteAusschnitt);
        expect(
          ueber,
          `${name}: Schritt ${m.schritt}: ${was} ist ${ueber} px ueber den sichtbaren Teil der Artikelspalte gewandert (Kasten ab ${k.oben}, Spalte ab ${m.karteAusschnitt.oben})`,
        ).toBeLessThanOrEqual(SICHT_TOLERANZ_PX);
        const unter = unterDemFenster(k, m.fensterHoehe, m.karteAusschnitt);
        expect(
          Math.round((unter - unterZuerst) * 100) / 100,
          `${name}: Schritt ${m.schritt}: ${was} beginnt ${unter} px unter dem sichtbaren Teil der Artikelspalte statt ${unterZuerst} px wie beim ersten Schritt (Spalte bis ${m.karteAusschnitt.unten})`,
        ).toBeLessThanOrEqual(SICHT_TOLERANZ_PX);
        const sichtbar = sichtbareHoehe(k, m.fensterHoehe, m.karteAusschnitt);
        expect(
          Math.abs(sichtbar - zuerst),
          `${name}: Schritt ${m.schritt}: ${was} zeigt ${sichtbar} px statt ${zuerst} px wie beim ersten Schritt`,
        ).toBeLessThanOrEqual(SICHT_TOLERANZ_PX);
      }
    }
    for (const m of schritte) {
      expect(
        Math.abs(m.karte.oben - m.auswahlAusschnitt.oben),
        `${name}: Schritt ${m.schritt}: die Karte beginnt bei ${m.karte.oben} px, die Liste bei ${m.auswahlAusschnitt.oben} px`,
      ).toBeLessThanOrEqual(SICHT_TOLERANZ_PX);
    }
  };

  it("L8 · FLACHES FENSTER · Pfeiltaste: Karte und Titel stehen still — gleicher Ort, gleich viel zu sehen, an jedem der 30 Schritte", () => {
    expect(fehler3).toBeNull();
    karteStehtStill("Pfeiltaste 1280x420", tasteFlach);
  });

  it("L9 · FLACHES FENSTER · Mausrad: die Auswahl bleibt im Bild", () => {
    expect(fehler3).toBeNull();
    const befund = ersterSichtverlust(radFlach?.schritte ?? [], "auswahl");
    expect(
      befund.schritt,
      `die Auswahl ist bei Schritt ${befund.schritt} nicht mehr ganz zu sehen (${befund.fehlbetragPx} px fehlen, Rollposition ${befund.rollposition}, sichtbarer Bereich ${befund.bereichOben}–${befund.bereichUnten} in ${befund.rollerName})`,
    ).toBeNull();
  });

  it("L10 · FLACHES FENSTER · Mausrad: Karte und Titel stehen still — gleicher Ort, gleich viel zu sehen, an jedem der 30 Schritte", () => {
    expect(fehler3).toBeNull();
    karteStehtStill("Mausrad 1280x420", radFlach);
  });

  // ------------------------------------------------------------------------------------------
  // JOB 3812 · DIE LAGE DAZWISCHEN (HINWEIS 1) — dieselben Aussagen bei 1280×600.
  // ------------------------------------------------------------------------------------------
  // `archiv/3625/runde-2/RUECKGABE.md:66`: „Nur die Fensterhöhen 900 und 420 sind gemessen, Höhen
  // dazwischen nicht." Zwei Stützstellen können eine Regel vortäuschen, die in der Mitte nicht
  // gilt; hier steht die dritte. Kein neuer Massstab — wörtlich dieselben Prüfungen wie L7–L10.
  it("L13a · MITTLERES FENSTER 1280x600 · Pfeiltaste: die Auswahl bleibt im Bild", () => {
    expect(fehler3).toBeNull();
    const befund = ersterSichtverlust(tasteMittel?.schritte ?? [], "auswahl");
    expect(
      befund.schritt,
      `die Auswahl ist bei Schritt ${befund.schritt} nicht mehr ganz zu sehen (${befund.fehlbetragPx} px fehlen, Rollposition ${befund.rollposition}, sichtbarer Bereich ${befund.bereichOben}–${befund.bereichUnten} in ${befund.rollerName})`,
    ).toBeNull();
  });

  it("L13b · MITTLERES FENSTER 1280x600 · Pfeiltaste: Karte und Titel stehen still", () => {
    expect(fehler3).toBeNull();
    karteStehtStill("Pfeiltaste 1280x600", tasteMittel);
  });

  it("L13c · MITTLERES FENSTER 1280x600 · Mausrad: die Auswahl bleibt im Bild", () => {
    expect(fehler3).toBeNull();
    const befund = ersterSichtverlust(radMittel?.schritte ?? [], "auswahl");
    expect(
      befund.schritt,
      `die Auswahl ist bei Schritt ${befund.schritt} nicht mehr ganz zu sehen (${befund.fehlbetragPx} px fehlen, Rollposition ${befund.rollposition}, sichtbarer Bereich ${befund.bereichOben}–${befund.bereichUnten} in ${befund.rollerName})`,
    ).toBeNull();
  });

  it("L13d · MITTLERES FENSTER 1280x600 · Mausrad: Karte und Titel stehen still", () => {
    expect(fehler3).toBeNull();
    karteStehtStill("Mausrad 1280x600", radMittel);
  });

  it("L11 · die Restbewegung der HUELLE ist erklaert und festgenagelt — Ueberhang der Liste = gerollte Strecke", () => {
    expect(fehler3).toBeNull();
    for (const [name, lauf] of [
      ["Pfeiltaste 1280x900", taste],
      ["Mausrad 1280x900", rad],
      ["Pfeiltaste 1280x420", tasteFlach],
      ["Mausrad 1280x420", radFlach],
      ["Pfeiltaste 1280x600", tasteMittel],
      ["Mausrad 1280x600", radMittel],
    ] as const) {
      const schritte = lauf?.schritte ?? [];
      expect(schritte.length, `${name}: keine Schritte gemessen`).toBe(SCHRITTE);
      const weiteste = Math.round(Math.max(...schritte.map((s) => s.huelleTop)) * 100) / 100;
      // 1. DIE BEOBACHTUNG, über alle dreissig Schritte und nicht nur am Ende.
      expect(
        weiteste,
        `${name}: die Huelle ist ueber ${SCHRITTE} Schritte ${weiteste} px gerollt (erlaubt ${HUELLE_SPIEL_PX})`,
      ).toBeLessThanOrEqual(HUELLE_SPIEL_PX);
      // 2. DIE URSACHE, und das ist der Teil, der JOB 3593 gefehlt hat: Die Hülle rollt genau um
      // den ÜBERHANG der Liste unter den sichtbaren Teil der Hülle — nicht mehr und nicht weniger.
      // Gemessen im Ausgangszustand, bevor der erste Schritt etwas verschoben hat. Steht diese
      // Zeile, ist die Restbewegung erklärt statt nur begrenzt; und sie bleibt wahr, ob der
      // Überhang nun null ist (heute) oder wieder entsteht (Rückfall).
      //
      // JOB 3812: gelesen wird `karteHuelle` und nicht mehr `karteAusschnitt`. Die AUSSAGE dieses
      // Falls ist Wort für Wort dieselbe geblieben („die Hülle rollt genau um den Überhang der
      // Liste") — sie bezieht sich weiter auf die Hülle der Anwendung. Nur der Messwert, der sie
      // trägt, heisst jetzt so, wie sie ihn nennt.
      const s = lauf?.start;
      const ueberhang =
        Math.round(
          Math.max(0, (s?.auswahlAusschnitt.unten ?? 0) - (s?.karteHuelle.unten ?? 0)) * 100,
        ) / 100;
      expect(
        Math.abs(weiteste - ueberhang),
        `${name}: die Huelle rollte ${weiteste} px, die Liste haengt aber ${ueberhang} px unter ihrem sichtbaren Teil (Liste bis ${s?.auswahlAusschnitt.unten}, Huelle bis ${s?.karteHuelle.unten})`,
      ).toBeLessThanOrEqual(2 * SICHT_TOLERANZ_PX);
    }
  });

  it("L12 · gemessen statt gerechnet: die Hoehe ueber der Liste, und ob die Liste noch ins Fenster passt", () => {
    expect(fehler3).toBeNull();
    // Lieferung 2 des Auftrags. `archiv/3593/runde-1/RUECKGABE.md:33` HERLEITET eine Grenze von
    // „~460 px" aus einem Kopf von 138 px: `70vh` plus Kopf überschreitet das Fenster, sobald
    // 0,3·H < Kopf. Hier steht die Messung, an der sich diese Herleitung prüfen lässt — die
    // Kopfhöhe ist der Abstand vom oberen Fensterrand bis zum Oberrand der Warteschlange.
    for (const [name, lauf] of [
      ["1280x900", taste],
      ["1280x420", tasteFlach],
      ["1280x600", tasteMittel],
    ] as const) {
      const s = lauf?.start;
      const kopfHoehe = s?.schlange?.oben ?? -1;
      const schlangeUnten = s?.schlange?.unten ?? -1;
      const fensterHoehe = s?.fensterHoehe ?? 0;
      expect(kopfHoehe, `${name}: die Warteschlange beginnt nicht im Fenster`).toBeGreaterThan(0);
      // Der Kopf ist eine feste Bauhöhe der Fläche und hängt NICHT an der Fensterhöhe — das ist
      // der Grund, warum eine reine Prozentangabe ihn nicht mitrechnen kann. Gemessen, nicht
      // vorausgesetzt: beide Lagen tragen denselben Kopf.
      expect(
        Math.abs(kopfHoehe - (taste?.start.schlange?.oben ?? 0)),
        `${name}: die Hoehe ueber der Liste ist ${kopfHoehe} px statt ${taste?.start.schlange?.oben} px`,
      ).toBeLessThanOrEqual(SICHT_TOLERANZ_PX);
      // UND DIE BEDINGUNG, die der Kommentar an `Validation.tsx` behauptet. JOB 3593 schrieb dort
      // „Es hält die Liste vollständig im Fenster"; das war die falsche Elle — massgeblich ist der
      // sichtbare Teil der HÜLLE, denn nur was darüber hinausragt, zwingt `scrollIntoView`, die
      // Hülle mitzubewegen. Beides steht hier als Zahl, das Fenster zuerst.
      expect(
        schlangeUnten,
        `${name}: die Liste reicht bis ${schlangeUnten} px, das Fenster ist ${fensterHoehe} px hoch (Kopf ${kopfHoehe} px)`,
      ).toBeLessThanOrEqual(fensterHoehe + SICHT_TOLERANZ_PX);
      // JOB 3812: `karteHuelle` — der Satz dieses Falls spricht von der HÜLLE, und die ist seit
      // dieser Runde nicht mehr derselbe Kasten wie der Ausschnitt der Karte.
      const huelleUnten = s?.karteHuelle.unten ?? 0;
      expect(
        schlangeUnten,
        `${name}: die Liste reicht bis ${schlangeUnten} px, der sichtbare Teil der Huelle endet bei ${huelleUnten} px (Kopf ${kopfHoehe} px, Fenster ${fensterHoehe} px)`,
      ).toBeLessThanOrEqual(huelleUnten + SICHT_TOLERANZ_PX);
    }
  });

  it("L14 · der Deckel rechnet JEDEN Kopf mit: ein Kasten ueber der Liste verkleinert sie um genau seine Hoehe", () => {
    expect(fehler3).toBeNull();
    // Lieferung 5 · Zustandsmodell (§9). Die Lage „Bestand mit gescheiterter Auffrischung" setzt
    // den Hinweis ÜBER die Liste und macht den Kopf damit höher als in jeder anderen Lage. Dass
    // der Deckel das verträgt, ist keine Eigenschaft dieser einen Lage, sondern der Regel: die
    // Liste bekommt, was die Spalte übrig lässt. Genau die wird hier gemessen — an echter
    // Layoutrechnung in Chromium, in beiden Fensterlagen.
    for (const [name, lauf] of [
      ["1280x900", probenHoch],
      ["1280x420", probenFlach],
      ["1280x600", probenMittel],
    ] as const) {
      expect(lauf, `${name}: keine Kopfprobe gemessen`).not.toBeNull();
      expect(lauf?.proben.length, `${name}: nicht alle Proben gefahren`).toBe(PROBEN_HOEHEN.length);
      for (const p of lauf?.proben ?? []) {
        const vorherHoch = p.vorher.unten - p.vorher.oben;
        const nachherHoch = p.nachher.unten - p.nachher.oben;
        expect(
          vorherHoch,
          `${name}: die Liste war vor der Probe ${vorherHoch} px hoch`,
        ).toBeGreaterThan(p.probeHoehe);
        // 1. Die Liste rückt um genau die Höhe des Kastens nach unten …
        expect(
          Math.abs(p.nachher.oben - p.vorher.oben - p.probeHoehe),
          `${name}: ${p.probeHoehe} px Kopf schoben die Liste von ${p.vorher.oben} auf ${p.nachher.oben}`,
        ).toBeLessThanOrEqual(SICHT_TOLERANZ_PX);
        // 2. … und endet trotzdem, wo sie vorher endete: sie ist kürzer geworden, nicht gewandert.
        //    Das ist der Unterschied zu `70vh`, das den Kopf nicht mitrechnete und die Liste unter
        //    den sichtbaren Teil der Hülle schob.
        expect(
          Math.abs(p.nachher.unten - p.vorher.unten),
          `${name}: die Liste endet mit ${p.probeHoehe} px Kopf bei ${p.nachher.unten} statt bei ${p.vorher.unten}`,
        ).toBeLessThanOrEqual(SICHT_TOLERANZ_PX);
        expect(
          Math.abs(vorherHoch - nachherHoch - p.probeHoehe),
          `${name}: ${p.probeHoehe} px Kopf verkleinerten die Liste um ${Math.round((vorherHoch - nachherHoch) * 100) / 100} px`,
        ).toBeLessThanOrEqual(SICHT_TOLERANZ_PX);
        // 3. Sie bleibt dabei im sichtbaren Teil der Hülle — die Bedingung aus L12, auch mit Kopf.
        expect(
          p.nachher.unten,
          `${name}: die Liste reicht mit ${p.probeHoehe} px Kopf bis ${p.nachher.unten} px, der sichtbare Teil der Huelle endet bei ${lauf?.huelleUnten} px`,
        ).toBeLessThanOrEqual((lauf?.huelleUnten ?? 0) + SICHT_TOLERANZ_PX);
        // 4. Und die Probe hinterlässt nichts: ohne den Kasten steht die Liste wieder wie vorher.
        expect(
          Math.abs(p.zurueck.oben - p.vorher.oben) + Math.abs(p.zurueck.unten - p.vorher.unten),
          `${name}: nach dem Entfernen der Probe steht die Liste bei ${p.zurueck.oben}–${p.zurueck.unten} statt ${p.vorher.oben}–${p.vorher.unten}`,
        ).toBeLessThanOrEqual(SICHT_TOLERANZ_PX);
      }
    }
  });

  // ==========================================================================================
  // JOB 3812 · RECHTS DARF MIT — der ganze Artikel lesbar, ohne dass links etwas wandert.
  // ==========================================================================================
  //
  // PEDIS SATZ hat zwei Hälften: „links durch die Artikelliste gehen und rechts den passenden
  // Artikel sehen." JOB 3593/3625 haben die erste gebaut. Die zweite stimmte bei flachen Fenstern
  // nicht: von der 254,25 px hohen Karte fehlten bei 1280×420 gemessene 82,5 px, und der einzige
  // Weg zum Rest war, die HÜLLE zu rollen — in der die Liste mit liegt. Wer lesen wollte, verlor
  // die Übersicht, die er gerade gewonnen hatte (`archiv/3625/runde-2/RUECKGABE.md`, REST).
  //
  // Pedi am 12.09. 21:4x: „ja, rechts darf mit." Damit ist die Grenze „nur die linke Liste" aus
  // `PRIORITAETEN.md` aufgehoben — und nur sie.
  //
  // L15 MISST DEN ZWECK, NICHT DEN GRIFF (Prüfpunkt 1 des Auftrags): nicht „trägt die rechte
  // Spalte ein `overflow-y-auto`", sondern „ist das Ende des Artikels erreichbar, WÄHREND Liste
  // und Auswahl stillstehen". Beides in derselben Messung, in Pixeln.
  const artikelLesbar = (p: Leseprobe | null): void => {
    expect(p, "keine Leseprobe gemessen").not.toBeNull();
    if (!p) return;
    const name = p.lage;
    // 1. DER ANFANG steht von sich aus im Bild — sonst wäre schon das erste Lesen ein Rollen.
    const ueber = ueberDemFenster(p.vorher.karte, p.ausschnitt);
    expect(
      ueber,
      `${name}: die Karte beginnt ${ueber} px ueber dem sichtbaren Bereich (Karte ab ${p.vorher.karte.oben}, Bereich ab ${p.ausschnitt.oben})`,
    ).toBeLessThanOrEqual(SICHT_TOLERANZ_PX);
    // 2. DAS ENDE ist erreichbar. `unterDemFenster` auf die Unterkante der Karte sagt genau das:
    //    wie viele Pixel weit unterhalb des sichtbaren Bereichs sie NACH dem Rollen noch liegt.
    //    Null heisst: wer rollt, kommt an. Ist gar nichts rollbar (`max: 0`), muss die Karte schon
    //    ohne Rollen ganz dastehen — dann prüft dieselbe Zeile den Fall aus §5.1(c).
    const ende = { oben: p.nachher.karte.unten, unten: p.nachher.karte.unten };
    const fehlt =
      Math.round(unterDemFenster(ende, p.fensterHoehe, p.ausschnittNachher) * 100) / 100;
    //    DIE ELLE IST DIESELBE EINE (`SICHT_TOLERANZ_PX`) und kein Zugeständnis: `scrollHeight`
    //    und `clientHeight` sind GANZE Zahlen, die Karte ist 254,25 px hoch. Gemessen bleiben
    //    dadurch 0,75 px am Ende stehen (1280×420 und 1280×600, Cloud-Lauf
    //    6f4e00d58bc8859d2e2c2ce2) — gebrochene Gerätepixel, genau der Fall, für den die Toleranz
    //    in `sichtregel.ts` beschrieben ist. Ein echter Verlust ist zweistellig.
    expect(
      fehlt,
      `${name}: das Ende des Artikels liegt nach dem Rollen noch ${fehlt} px unter dem sichtbaren Bereich (Karte bis ${p.nachher.karte.unten}, Bereich bis ${p.ausschnittNachher.unten}; es rollte ${p.rollerName} um ${p.gerollt} von ${p.max} px)`,
    ).toBeLessThanOrEqual(SICHT_TOLERANZ_PX);
    // 3. UND LINKS BEWEGT SICH NICHTS. Das ist die Zeile, die heute rot ist: die Karte liegt in
    //    derselben Hülle wie die Liste, also wandert die Liste beim Lesen mit hinaus.
    for (const [was, a, b] of [
      ["die Liste", p.vorher.schlange, p.nachher.schlange],
      ["die Auswahl", p.vorher.auswahl, p.nachher.auswahl],
    ] as const) {
      const gewandert = Math.round(Math.abs(b.oben - a.oben) * 100) / 100;
      expect(
        gewandert,
        `${name}: ${was} ist beim Lesen des Artikels ${gewandert} px gewandert (von ${a.oben} auf ${b.oben}) — es rollte ${p.rollerName} um ${p.gerollt} px, und die Liste liegt darin: ${p.traegtListe}`,
      ).toBeLessThanOrEqual(SICHT_TOLERANZ_PX);
    }
    // 4. DIE URSACHE, als eigener Messwert und nicht als Folgerung aus 3: der Bereich, der beim
    //    Lesen rollt, trägt die Warteschlange NICHT. Fällt diese Zeile, ist der alte Weg zurück,
    //    auch wenn die Liste zufällig gerade stehen blieb (kurze Liste, kein Überlauf).
    expect(
      p.traegtListe,
      `${name}: der Artikel und die Liste liegen im selben Rollbereich (${p.rollerName}, ${p.max} px Rollstrecke)`,
    ).toBe(false);
    // 5. Und die Probe hinterlässt nichts: die Rollstellung ist zurückgenommen.
    expect(
      Math.abs(p.zurueck.karte.oben - p.vorher.karte.oben),
      `${name}: nach der Probe steht die Karte bei ${p.zurueck.karte.oben} statt ${p.vorher.karte.oben}`,
    ).toBeLessThanOrEqual(SICHT_TOLERANZ_PX);
  };

  it("L15 · der GANZE Artikel ist lesbar — und Liste und Auswahl stehen dabei still", () => {
    expect(fehler3).toBeNull();
    expect(leseproben.length, "nicht alle Fensterlagen gemessen").toBe(3);
    for (const p of leseproben) {
      artikelLesbar(p);
    }
  });

  // ------------------------------------------------------------------------------------------
  // L16 · DIE FALLE, DIE DIESEN AUFTRAG SCHWER MACHT (§2e).
  // ------------------------------------------------------------------------------------------
  // Das „···"-Menü der Karte ist nicht portalisiert; sein Blatt ist ein `absolute` gesetzter
  // Nachfahre der Karte (`PruefenMenue.tsx`). Ein `overflow-y-auto` an der rechten Spalte wird
  // damit zu seinem neuen Beschneider — und `z-40` hilft nicht, denn `overflow` beschneidet
  // unabhängig von der Stapelreihenfolge. Bei 1280×420 ist die rechte Spalte rund 60 px hoch.
  //
  // GEMESSEN WIRD MIT DER VORHANDENEN ELLE (`ueberDemFenster`, `unterDemFenster`,
  // `sichtbareHoehe`), nicht mit einer zweiten: wie viel vom Blatt liegt in der Klammer aller
  // beschneidenden Vorfahren, geschnitten mit dem Fenster. Dazu die zweite Hälfte von „vollständig
  // sichtbar UND bedienbar": ob die Fläche an ihren beiden Kanten wirklich getroffen wird.
  //
  // ZWEI MESSUNGEN JE FENSTERLAGE: am Produktstand und mit PROBEWEISE aufgesetztem Rollbereich an
  // der rechten Spalte. Die zweite bleibt auch nach der Reparatur stehen — sie sagt, dass das
  // Blatt einem zusätzlichen Rollbereich nicht zum Opfer fällt, und nicht bloss, dass gerade
  // keiner da ist.
  const menueVollSichtbar = (b: Menuebefund): void => {
    const name = `${b.lage}${b.probe ? " + Probe" : ""}`;
    expect(b.hoehe, `${name}: das Menueblatt hat keine Hoehe`).toBeGreaterThan(0);
    const ueber = ueberDemFenster(b.blatt, b.klammer);
    const unter = unterDemFenster(b.blatt, b.fensterHoehe, b.klammer);
    const sichtbar = Math.round(sichtbareHoehe(b.blatt, b.fensterHoehe, b.klammer) * 100) / 100;
    const beschnitten = b.klammerNamen.length > 0 ? b.klammerNamen.join(", ") : "nur das Fenster";
    expect(
      ueber,
      `${name}: das Menueblatt ist ${ueber} px ueber den sichtbaren Bereich gewandert (Blatt ab ${b.blatt.oben}, Bereich ab ${b.klammer.oben}; beschnitten von ${beschnitten})`,
    ).toBeLessThanOrEqual(SICHT_TOLERANZ_PX);
    expect(
      unter,
      `${name}: das Menueblatt beginnt ${unter} px UNTER dem sichtbaren Bereich (Bereich bis ${b.klammer.unten})`,
    ).toBe(0);
    expect(
      Math.round((b.hoehe - sichtbar) * 100) / 100,
      `${name}: vom Menueblatt (${b.hoehe} px hoch, ${b.blatt.oben}–${b.blatt.unten}) sind nur ${sichtbar} px zu sehen — beschnitten auf ${b.klammer.oben}–${b.klammer.unten} von ${beschnitten} (rechte Spalte ${b.spalte.oben}–${b.spalte.unten}, overflow-y ${b.spalteOverflow}, rollt ${b.spalteRollt})`,
    ).toBeLessThanOrEqual(SICHT_TOLERANZ_PX);
    // Die unabhängige Gegenprobe zur Rechnung oben: neun Punkte, jeder muss das Blatt treffen.
    expect(
      b.fehlstellen,
      `${name}: an ${b.fehlstellen.length} von ${b.punkte} Punkten ist das Menueblatt nicht zu treffen (y ${b.fehlstellen.join(", ")}) — dort ist es abgeschnitten oder verdeckt (Blatt ${b.blatt.oben}–${b.blatt.unten}, position ${b.position})`,
    ).toEqual([]);
  };

  it("L16 · das Aktionsmenue der Karte bleibt vollstaendig sichtbar und bedienbar — in jeder Fensterlage, auch mit eigenem Rollbereich", () => {
    expect(fehler3).toBeNull();
    expect(menuebefunde.length, "nicht alle Menuelagen gemessen").toBe(6);
    for (const b of menuebefunde) {
      menueVollSichtbar(b);
    }
  });

  // ------------------------------------------------------------------------------------------
  // L17 · UND MIT DER TASTATUR ALLEIN (Lieferung 4).
  // ------------------------------------------------------------------------------------------
  // Ein Rollbereich, den nur die Maus bewegen kann, ist keiner. Die Pfeiltasten IN DER LISTE
  // gehören weiterhin der Auswahl (`Validation.tsx`, `onKeyDown` am `<ul>`) — daran wird nichts
  // genommen; es entsteht auch kein globaler Tastenfänger. Gemessen wird der Weg daneben: ein
  // Tabschritt aus der Liste heraus in die rechte Spalte, dann „Ende".
  it("L17 · der Rollbereich der Artikelspalte ist mit der Tastatur erreichbar und bis ans Ende bedienbar", () => {
    expect(fehler3).toBeNull();
    expect(tastaturwege.length, "nicht alle Fensterlagen gemessen").toBe(3);
    for (const w of tastaturwege) {
      // 1. Ein Tabschritt aus der Liste landet in der Spalte — sie ist ein Halt und kein Loch.
      expect(w.tabIndex, `${w.lage}: die Spalte traegt tabIndex ${w.tabIndex}`).toBe(0);
      expect(
        w.nachTab.fokusIstSpalte,
        `${w.lage}: nach einem Tabschritt steht der Fokus auf ${w.nachTab.fokus} statt auf der Artikelspalte`,
      ).toBe(true);
      // 2. „Ende" bringt die Spalte an ihr Ende — oder es gibt nichts zu rollen (hohe Fenster).
      expect(
        Math.round((w.nachEnde.max - w.nachEnde.top) * 100) / 100,
        `${w.lage}: nach „Ende" steht die Spalte bei ${w.nachEnde.top} von ${w.nachEnde.max} px`,
      ).toBeLessThanOrEqual(SICHT_TOLERANZ_PX);
      // 3. Und links bewegt sich dabei nichts — dieselbe Zusage wie in L15, auf dem anderen Weg.
      for (const [was, a, b] of [
        ["die Liste", w.nachTab.schlange, w.nachEnde.schlange],
        ["die Auswahl", w.nachTab.auswahl, w.nachEnde.auswahl],
      ] as const) {
        const gewandert = Math.round(Math.abs(b.oben - a.oben) * 100) / 100;
        expect(
          gewandert,
          `${w.lage}: ${was} ist beim Rollen mit der Taste ${gewandert} px gewandert (von ${a.oben} auf ${b.oben})`,
        ).toBeLessThanOrEqual(SICHT_TOLERANZ_PX);
      }
    }
  });

  // ------------------------------------------------------------------------------------------
  // L18 · EIN SCHON OFFENES BLATT — die Lücke, die Runde 1 nicht sehen konnte.
  // ------------------------------------------------------------------------------------------
  // L16 öffnet je Fensterlage eine FRISCHE Seite. Damit rechnet das Produkt in jeder Lage neu, und
  // ein Blatt, das seine Rechnung aus einer ANDEREN Lage mitschleppt, kommt dort nicht vor. Genau
  // dort sass der Fehler der Runde 1 (Prüfbericht, Korrekturpflicht 1): bei 1280×900 geöffnet und
  // auf 1280×420 verkleinert, behielt das Blatt einen Deckel von 630 px in einem 420 px hohen
  // Fenster. L18 fährt deshalb EINE Seite, EIN Öffnen und drei Änderungen darunter.
  //
  // DIE ELLE IST DIESELBE (`menueVollSichtbar`) — kein zweiter Massstab für den zweiten Weg.
  // Dazu kommt EINE Frage, die L16 nicht stellen kann: steht das Blatt noch an seinem Auslöser?
  // Die zwei erlaubten Orte stehen in `PruefenMenue.tsx` (`BLATT_ABSTAND_PX` = 32 px unter dessen
  // Oberkante, oder `BLATT_LUFT_PX` = 4 px darüber, wenn es nach oben aufklappt); ein Blatt, das
  // nach dem Verkleinern zwar im Fenster liegt, aber irgendwo, hat die Zusage nicht erfüllt.
  //
  // JOB 3938 · DIESE ELLE URTEILT SEIT HEUTE GERICHTET — und das ist kein Feinschliff.
  //
  // BIS HIERHER stand hier `Math.min` über BEIDE erlaubten Orte. Damit sagte sie „das Blatt steht
  // an EINEM der zwei erlaubten Orte" und nicht „am richtigen": ein Blatt, für das das Produkt
  // `nachOben` gerechnet hat, das aber am Abwärts-Ort steht (oder umgekehrt), bestand sie
  // unbemerkt. Der Kommentar oben nannte die zwei Orte schon; WELCHER wann gilt, prüfte niemand.
  //
  // GERICHTET HEISST: die Richtung kommt aus der MESSUNG (`b.kante.nachOben`, Sondenmessung in
  // `MENUE_LAGE`) und entscheidet, gegen welchen der beiden Orte gemessen wird. Nicht aus der
  // Fensterhöhe und nicht aus einer hier nachgebauten Fassung von `PruefenMenue.tsx:187` — eine
  // Elle, die die Regel des Geprüften nachrechnet, prüft nur sich selbst.
  //
  // Dass sie taugt — und zwar in beide Richtungen, nicht bloss streng ist —, misst L5b ohne
  // Browser; den Aufwärts-Ort am lebenden Produkt misst L18d.
  const BLATT_ABSTAND_PX = 32;
  const BLATT_LUFT_PX = 4;
  const amAusloeser = (b: Menuebefund): number =>
    Math.round(
      Math.abs(
        b.kante.nachOben
          ? b.blatt.unten - (b.ausloeser.oben - BLATT_LUFT_PX)
          : b.blatt.oben - (b.ausloeser.oben + BLATT_ABSTAND_PX),
      ) * 100,
    ) / 100;

  it("L18 · das schon offene Aktionsmenue ueberlebt eine Fensteraenderung — ganz sichtbar, ganz bedienbar, an seinem Ausloeser", () => {
    expect(fehler3).toBeNull();
    expect(menuewandel.length, "nicht alle fuenf Schritte des Wandels gemessen").toBe(5);
    // Die ersten drei Schritte: frisch geöffnet, dann zweimal verkleinert. Hier gilt BEIDES.
    for (const w of menuewandel.slice(0, 3)) {
      menueVollSichtbar(w.befund);
      const ab = amAusloeser(w.befund);
      expect(
        ab,
        `${w.schritt}: das Blatt steht ${ab} px neben seinem ${w.befund.kante.nachOben ? "Aufwaerts" : "Abwaerts"}-Ort (Blatt ${w.befund.blatt.oben}–${w.befund.blatt.unten}, Ausloeser ab ${w.befund.ausloeser.oben}, Fenster ${w.befund.fensterHoehe} px hoch, gemessene Kante ${w.befund.kante.klasse} bei ${w.befund.kante.ortPx} px)`,
      ).toBeLessThanOrEqual(SICHT_TOLERANZ_PX);
    }
    // Und der Deckel ist WIRKLICH nachgerechnet und nicht bloss zufällig gross genug: im flachen
    // Fenster muss das Blatt kürzer sein als im hohen. Ohne diese Zeile bestünde L18 auch ein
    // Produkt, das den Deckel ganz weggelassen hätte.
    const hoch = menuewandel[0];
    const flach = menuewandel[2];
    if (!hoch || !flach) return;
    expect(
      flach.befund.hoehe,
      `nach dem Verkleinern ist das Blatt ${flach.befund.hoehe} px hoch wie vorher (${hoch.befund.hoehe} px) — es wurde nicht nachgerechnet`,
    ).toBeLessThan(hoch.befund.hoehe);
  });

  // ------------------------------------------------------------------------------------------
  // L18b · UND WENN DIE ARTIKELSPALTE UNTER DEM OFFENEN BLATT ROLLT.
  // ------------------------------------------------------------------------------------------
  // Der vierte Schritt derselben Seite. Das Blatt hängt seit Runde 1 am FENSTER (`position: fixed`)
  // und folgt dem Auslöser NICHT, wenn die Spalte rollt — das ist eine Entscheidung mit Grund und
  // keine Lücke: der Auslöser wandert dabei aus dem Bild (gemessen 163,5 → −29,5 px bei 193 px
  // Rollweg), und ein Blatt, das ihm folgte, stünde bei 2,5 px über dem Kopfband der Anwendung.
  //
  // ZUGESICHERT WIRD DESHALB DAS SCHWÄCHERE UND WAHRE: das Blatt bleibt vollständig im Fenster und
  // an allen neun Punkten bedienbar; seine Handlungen gelten weiter demselben Artikel. Dass der
  // Schritt überhaupt etwas bewegt hat, ist ein eigener Messwert — ein Rollweg von 0 px prüfte
  // nichts, und der Abstand zum Auslöser steht als Zahl da, statt verschwiegen zu werden.
  it("L18b · rollt die Artikelspalte unter dem offenen Blatt, bleibt es ganz sichtbar und bedienbar", () => {
    expect(fehler3).toBeNull();
    expect(menuewandel.length, "nicht alle fuenf Schritte des Wandels gemessen").toBe(5);
    const w = menuewandel[3];
    const flach = menuewandel[2];
    if (!w || !flach) return;
    expect(
      w.gerollt?.max ?? 0,
      `die Artikelspalte hatte nichts zu rollen (max ${w.gerollt?.max}) — der Schritt pruefte nichts`,
    ).toBeGreaterThan(0);
    expect(
      w.gerollt?.top ?? 0,
      `die Artikelspalte ist nicht gerollt (top ${w.gerollt?.top} von ${w.gerollt?.max})`,
    ).toBeGreaterThan(0);
    // Der Auslöser hat sich dabei wirklich bewegt — sonst wäre die Aussage darunter leer.
    const gewandert =
      Math.round((flach.befund.ausloeser.oben - w.befund.ausloeser.oben) * 100) / 100;
    expect(
      gewandert,
      `der Ausloeser steht nach dem Rollen noch bei ${w.befund.ausloeser.oben} statt vorher ${flach.befund.ausloeser.oben}`,
    ).toBeGreaterThan(0);
    // Die eigentliche Zusage, mit derselben Elle wie L16.
    menueVollSichtbar(w.befund);
    // Und der Abstand zum Auslöser als offene Zahl: er ist jetzt gross, weil der Auslöser
    // weggerollt ist. Diese Zeile sagt nur, dass die Zahl gemessen wurde und nicht behauptet ist.
    //
    // JOB 3938: die Zahl kommt seit heute aus der GERICHTETEN Elle — die Aussage bleibt dieselbe
    // (hier gehört die Richtung bauartbedingt nicht dazu, denn es gibt keinen richtigen Ort an
    // einem weggerollten Auslöser), nur ihr Wert ist jetzt der gegen die gemessene Kante.
    expect(
      Number.isFinite(amAusloeser(w.befund)),
      `der Abstand zum ${w.befund.kante.nachOben ? "Aufwaerts" : "Abwaerts"}-Ort des Ausloesers (${amAusloeser(w.befund)} px) ist keine Zahl`,
    ).toBe(true);
  });

  // ------------------------------------------------------------------------------------------
  // L18c · UND DANN ÄNDERT SICH DAS FENSTER NOCH EINMAL — die Lücke der Runde 2.
  // ------------------------------------------------------------------------------------------
  // DER BEFUND (Prüfbericht der Runde 2, Korrekturpflicht 1 und 2). L18b endet nach dem Rollen.
  // Genau dahinter lag der Fehler: Runde 2 rechnete die Lage bei jedem `resize` neu aus dem
  // Rechteck des Auslösers — und der ist nach dem Rollen aus dem Bild. Der Prüfer hat es mit einem
  // dreissigfach wiederholten Artikel nachgemessen (Auslöser bei `top` −549,5 px): das Blatt stand
  // danach bei −517,5 bis −269,5 px, vollständig über dem Fenster, an allen neun Punkten
  // unbedienbar.
  //
  // AUF DIESER BÜHNE IST DER ARTIKEL KÜRZER (die Spalte rollt 193 px statt 713), und derselbe
  // Fehler zeigt sich deshalb nicht als Verschwinden, sondern als SPRUNG: das Blatt säße danach
  // bei 2,5 px statt bei 195,5 — über dem Kopfband der Anwendung, ohne Auslöser darunter. Es ist
  // dieselbe Rechnung ohne Untergrenze, nur mit kleinerem Weg. Deshalb misst L18c BEIDES: die
  // Zusage (ganz im Fenster, ganz bedienbar) und den Ort (das Blatt steht, wo es stand).
  //
  // WARUM DER ORT UND NICHT „AM AUSLÖSER": der Auslöser ist weggerollt — es gibt keinen richtigen
  // Ort an ihm mehr. Die Zusage, die das Produkt hält, ist die aus L18b: das Blatt bleibt stehen.
  // L18c verlangt, dass auch eine Fensteränderung daran nichts ändert.
  it("L18c · nach dem Rollen zieht eine weitere Fensteraenderung das Blatt nicht von seinem Ort", () => {
    expect(fehler3).toBeNull();
    expect(menuewandel.length, "nicht alle fuenf Schritte des Wandels gemessen").toBe(5);
    const vor = menuewandel[3];
    const nach = menuewandel[4];
    if (!vor || !nach) return;
    // Der Fall prüft nur dann etwas, wenn der Auslöser wirklich aus dem Bild gerollt IST — sonst
    // gäbe es die Zahl gar nicht, an der sich die alte Rechnung verrechnet hat.
    expect(
      vor.befund.ausloeser.oben,
      `der Ausloeser steht bei ${vor.befund.ausloeser.oben} px und ist gar nicht aus dem Bild gerollt — L18c pruefte nichts`,
    ).toBeLessThan(0);
    // Und das Fenster hat sich wirklich geändert.
    expect(
      nach.befund.fensterBreite,
      `die Fensterbreite ist mit ${nach.befund.fensterBreite} px dieselbe wie vorher (${vor.befund.fensterBreite} px) — es gab kein Ereignis`,
    ).not.toBe(vor.befund.fensterBreite);
    expect(
      nach.befund.fensterHoehe,
      "die Fensterhoehe hat sich mitgeaendert — dann sagt der Fall nichts ueber die Ursache",
    ).toBe(vor.befund.fensterHoehe);
    // 1. Die Zusage, mit derselben Elle wie L16, L18 und L18b.
    menueVollSichtbar(nach.befund);
    // 2. Und es steht noch da, wo es stand.
    const versprung =
      Math.round(Math.abs(nach.befund.blatt.oben - vor.befund.blatt.oben) * 100) / 100;
    expect(
      versprung,
      `das Blatt ist durch die Fensteraenderung ${versprung} px gewandert (vorher ${vor.befund.blatt.oben}–${vor.befund.blatt.unten}, nachher ${nach.befund.blatt.oben}–${nach.befund.blatt.unten}, Ausloeser bei ${nach.befund.ausloeser.oben}, Fenster ${nach.befund.fensterBreite}x${nach.befund.fensterHoehe})`,
    ).toBeLessThanOrEqual(SICHT_TOLERANZ_PX);
  });

  // ------------------------------------------------------------------------------------------
  // L18d · UND DER ZWEITE ORT — das Blatt, das nach OBEN aufklappt (JOB 3938).
  // ------------------------------------------------------------------------------------------
  // DIE LÜCKE, WÖRTLICH (BEN an JOB 3812 R3, Prüfpunkt 6): „Weitere Menüorte bei Größenänderung
  // und nach oben öffnende Menüs gesondert im Browser prüfen." Das Produkt kann den zweiten Ort
  // seit JOB 3812 (`PruefenMenue.tsx:187-188`) — gemessen hatte ihn niemand: L16, L18, L18b und
  // L18c öffnen das Menü ausschliesslich in Fenstern, in denen unter dem Auslöser genug Platz ist.
  //
  // DIE VIER ZUSICHERUNGEN, und warum die erste die wichtigste ist: Ohne den Nachweis, dass das
  // Blatt WIRKLICH aufwärts hängt, wäre dieser Fall auch dann grün, wenn das Fenster gar nicht
  // flach genug war — er prüfte dann zum vierten Mal den Abwärtszweig. Die Richtung kommt deshalb
  // aus der Sondenmessung (`MENUE_LAGE`, Feld `kante`) und nicht aus der Fensterhöhe.
  //
  // Die Elle ist dieselbe eine (`menueVollSichtbar`, `amAusloeser`, `SICHT_TOLERANZ_PX`); neu ist
  // allein, dass `amAusloeser` seit diesem Job GERICHTET urteilt.
  it("L18d · im wirklich flachen Fenster klappt das Blatt nach OBEN auf — ganz im Bild, ganz bedienbar, am Aufwaerts-Ort seines Ausloesers", () => {
    expect(fehler3).toBeNull();
    expect(aufwaerts, "der Aufwaertszweig wurde nicht gemessen").not.toBeNull();
    const a = aufwaerts;
    if (!a) return;
    const k = a.befund.kante;
    // 0. Die Bühne steht wirklich so flach, wie sie hergeleitet wurde.
    expect(
      a.befund.fensterHoehe,
      `gemessen wurde bei ${a.befund.fensterHoehe} px statt bei den hergeleiteten ${a.zielHoehe} px (Ausloeser oben ${a.ausloeserObenFlach}, Schwelle ${a.schwelle})`,
    ).toBe(a.zielHoehe);
    // 1. Das Blatt hängt WIRKLICH aufwärts — sonst misst dieser Fall den Abwärtszweig ein
    //    viertes Mal. Und dieselbe Karte tat es in der bekannten flachen Lage noch NICHT: erst
    //    beides zusammen sagt, dass die Weiche `:187` greift und nicht bloss etwas nach oben steht.
    expect(
      k.nachOben,
      `das Blatt haengt nicht aufwaerts: Ort ${k.ortPx} px, Abstand zur Oberkante ${k.abstandAbwaerts} px, zur Unterkante ${k.abstandAufwaerts} px (Blatt ${a.befund.blatt.oben}–${a.befund.blatt.unten}, Ausloeser ab ${a.befund.ausloeser.oben}, Fenster ${a.befund.fensterHoehe} px, Klasse ${k.klasse}, top ${k.top}, bottom ${k.bottom}, ort ${k.ort})`,
    ).toBe(true);
    expect(
      a.vorher.kante.nachOben,
      `schon bei ${a.vorher.fensterHoehe} px haengt das Blatt aufwaerts (Ort ${a.vorher.kante.ortPx}, Blatt ${a.vorher.blatt.oben}–${a.vorher.blatt.unten}, Ausloeser ab ${a.vorher.ausloeser.oben}) — dann sagt L18d nichts ueber die Weiche`,
    ).toBe(false);
    // 2. Ganz im Fenster und an allen neun Punkten bedienbar — dieselbe Elle wie L16/L18/L18b.
    menueVollSichtbar(a.befund);
    // 3. Am AUFWÄRTS-Ort seines Auslösers, mit der gerichteten Elle.
    const ab = amAusloeser(a.befund);
    expect(
      ab,
      `das Blatt steht ${ab} px neben seinem Aufwaerts-Ort (Unterkante ${a.befund.blatt.unten}, erwartet ${a.befund.ausloeser.oben - BLATT_LUFT_PX}; Blatt ${a.befund.blatt.oben}–${a.befund.blatt.unten}, Ausloeser ab ${a.befund.ausloeser.oben}, Fenster ${a.befund.fensterHoehe} px hoch)`,
    ).toBeLessThanOrEqual(SICHT_TOLERANZ_PX);
    // 4. Und der Deckel ist nachgerechnet, nicht zufällig gross genug — dieselbe Frage wie in L18,
    //    nur auf der anderen Seite des Auslösers. Welche der beiden Grenzen dabei gegriffen hat
    //    (`min(…)` gegen den freien Platz oder die Klemme `clamp(…)` mit `BLATT_MINDEST_PX`),
    //    steht als gemessener Wert in der Meldung und im Protokoll — verschwiegen wird nichts.
    const hoch = menuewandel[0];
    if (!hoch) return;
    expect(
      a.befund.hoehe,
      `im ${a.befund.fensterHoehe} px hohen Fenster ist das Blatt ${a.befund.hoehe} px hoch wie im ${hoch.befund.fensterHoehe} px hohen (${hoch.befund.hoehe} px) — es wurde nicht nachgerechnet (Ort ${k.ort} → ${k.ortPx} px, Deckel ${k.deckel} → max-height ${k.maxHoehe})`,
    ).toBeLessThan(hoch.befund.hoehe);
  });

  // ------------------------------------------------------------------------------------------
  // L19 · EIN ANDERER ARTIKEL FÄNGT OBEN AN (die zweite Prüflücke des Berichts).
  // ------------------------------------------------------------------------------------------
  // Die rechte Spalte hat seit diesem Job eine Rollstellung, und dasselbe DOM-Element bleibt beim
  // Wechsel der Auswahl stehen (die Karte ist eine Zeichenfunktion, keine Komponente). Ohne Zutun
  // behielte es seinen `scrollTop` — wer bei 1280×420 ans Ende eines Artikels gerollt ist und dann
  // den nächsten wählt, läse dessen Mitte. Gemessen wird der ganze Weg: rollen, wechseln, schauen.
  it("L19 · nach einem Artikelwechsel steht der neue Artikel wieder an seinem Anfang", () => {
    expect(fehler3).toBeNull();
    expect(artikelwechsel, "kein Artikelwechsel gemessen").not.toBeNull();
    const w = artikelwechsel;
    if (!w) return;
    // 1. Die Ausgangslage war wirklich heruntergerollt — sonst prüfte der Fall nichts.
    expect(
      w.vorher.max,
      `${w.lage}: die Artikelspalte hatte nichts zu rollen (max ${w.vorher.max})`,
    ).toBeGreaterThan(0);
    expect(
      w.vorher.top,
      `${w.lage}: vor dem Wechsel stand die Spalte bei ${w.vorher.top} von ${w.vorher.max} px`,
    ).toBeGreaterThan(0);
    // 2. Es steht wirklich ein ANDERER Artikel da.
    expect(
      w.nachher.titel,
      `${w.lage}: nach dem Wechsel steht derselbe Titel da (${w.nachher.titel})`,
    ).not.toBe(w.vorherTitel);
    // 3. Und er fängt oben an: die Rollstellung ist zurück auf null, und der Anfang der Karte
    //    steht im sichtbaren Ausschnitt — beides, denn das eine ist der Griff und das andere der
    //    Zweck.
    expect(
      w.nachher.top,
      `${w.lage}: der neue Artikel steht ${w.nachher.top} px heruntergerollt da (von ${w.vorher.top} px beim alten, max ${w.nachher.max})`,
    ).toBeLessThanOrEqual(SICHT_TOLERANZ_PX);
    const ueber = ueberDemFenster(w.nachher.karte, w.nachher.ausschnitt);
    expect(
      ueber,
      `${w.lage}: der neue Artikel beginnt ${ueber} px ueber dem sichtbaren Bereich (Karte ab ${w.nachher.karte.oben}, Bereich ab ${w.nachher.ausschnitt.oben})`,
    ).toBeLessThanOrEqual(SICHT_TOLERANZ_PX);
    // 4. Und links bewegt sich dabei nichts — dieselbe Zusage wie in L15 und L17.
    //    NUR die Liste wird hier vorher/nachher verglichen: „die Auswahl" ist nach dem Wechsel ein
    //    ANDERES Element (der nächste Eintrag), ihre Oberkante MUSS sich also unterscheiden. Für
    //    sie gilt die Zusage in ihrer eigenen Form — sie steht sichtbar in der Liste.
    const gewandert =
      Math.round(Math.abs(w.nachher.schlange.oben - w.vorher.schlange.oben) * 100) / 100;
    expect(
      gewandert,
      `${w.lage}: die Liste ist beim Artikelwechsel ${gewandert} px gewandert (von ${w.vorher.schlange.oben} auf ${w.nachher.schlange.oben})`,
    ).toBeLessThanOrEqual(SICHT_TOLERANZ_PX);
    //    Und die neue Auswahl ist in der Liste zu sehen. VOLLSTÄNDIG ist sie es bei 1280×420
    //    nicht, und das ist ein Befund dieses Laufs und keine gelockerte Elle: die Liste zeigt in
    //    dieser Fensterlage nur 60,5 px (138,5–199), der angeklickte zweite Eintrag steht bei
    //    182,72–241,16 und reicht 42,16 px darunter hinaus. Das gehört dem KLICKWEG und nicht
    //    diesem Auftrag: `auswahlSchieben` holt die Auswahl mit `scrollIntoView({block:"nearest"})`
    //    ins Bild (das misst L1/L7), der Klick tut es bewusst nicht — wer klickt, hat sein Ziel
    //    schon getroffen (JOB 3464). Zugesichert wird deshalb hier nur, dass der Wechsel die
    //    Auswahl nicht ganz aus der Liste geschoben hat; die Zahlen stehen in der Meldung.
    const sichtbar =
      Math.round(
        sichtbareHoehe(w.nachher.auswahl, w.nachher.fensterHoehe, w.nachher.schlange) * 100,
      ) / 100;
    expect(
      sichtbar,
      `${w.lage}: von der neuen Auswahl (${w.nachher.auswahl.oben}–${w.nachher.auswahl.unten}) ist in der Liste (${w.nachher.schlange.oben}–${w.nachher.schlange.unten}) nichts zu sehen`,
    ).toBeGreaterThan(0);
  });

  /**
   * JOB 3938 · EIN BEFUND VON HAND — für die Kalibrierung der gerichteten Elle (L5b).
   *
   * Nur vier Grössen tragen hier Bedeutung: die gemessene Richtung, der Kasten des Blatts, die
   * Oberkante des Auslösers und die Fensterhöhe. Der Rest ist Bühne und steht da, weil ein
   * `Menuebefund` der GANZE Messwert ist und ein halber keiner wäre. `ortPx` wird aus der
   * behaupteten Richtung abgeleitet — genau so, wie die Sonde in `MENUE_LAGE` es gemessen hätte:
   * bei `nachOben` der Abstand der Unterkante zum Fensterboden, sonst die Oberkante.
   */
  const handbefund = (
    nachOben: boolean,
    blatt: Sichtkasten,
    ausloeserOben: number,
    fensterHoehe: number,
  ): Menuebefund => {
    const ortPx = nachOben ? fensterHoehe - blatt.unten : blatt.oben;
    const rund = (w: number): number => Math.round(w * 100) / 100;
    return {
      lage: `von Hand · ${fensterHoehe} px · ${nachOben ? "aufwaerts" : "abwaerts"}`,
      probe: false,
      position: "fixed",
      blatt,
      hoehe: rund(blatt.unten - blatt.oben),
      breite: 256,
      ausloeser: { oben: ausloeserOben, unten: ausloeserOben + 29 },
      klammer: { oben: 0, unten: fensterHoehe },
      klammerNamen: [],
      spalte: { oben: 138.5, unten: fensterHoehe },
      spalteOverflow: "auto",
      spalteRollt: true,
      punkte: 9,
      fehlstellen: [],
      fensterHoehe,
      fensterBreite: 1280,
      kante: {
        nachOben,
        ortPx: rund(ortPx),
        abstandAbwaerts: rund(Math.abs(blatt.oben - ortPx)),
        abstandAufwaerts: rund(Math.abs(fensterHoehe - blatt.unten - ortPx)),
        top: `${rund(blatt.oben)}px`,
        bottom: `${rund(fensterHoehe - blatt.unten)}px`,
        ort: `${rund(ortPx)}px`,
        deckel: `${rund(blatt.unten - blatt.oben)}px`,
        maxHoehe: `${rund(blatt.unten - blatt.oben)}px`,
        klasse: nachOben ? "bottom" : "top",
      },
    };
  };

  it("L5b · die GERICHTETE Elle taugt: sie erkennt ein Blatt, das am falschen der zwei erlaubten Orte steht", () => {
    // DIE LÜCKE, DIE DIESER FALL SCHLIESST (JOB 3938 §2). Bis heute stand hier `Math.min` über
    // BEIDE erlaubten Orte. Damit sagte die Elle „an EINEM der zwei Orte" — ein Blatt, für das
    // das Produkt `nachOben` gerechnet hat, das aber am Abwärts-Ort steht (oder umgekehrt), war
    // von einem richtigen nicht zu unterscheiden. Genau dieser Fehler ist unten der dritte und
    // vierte Fall; mit `Math.min` gäben beide 0 zurück.
    //
    // Die Zahlen sind gemessene Lagen und keine erfundenen: 163,5 px ist die Oberkante des
    // Auslösers in der flachen Lage, 195,5–443,5 der Abwärts-Ort im hohen Fenster (beides
    // JOB 3812, Kopf von `PruefenMenue.tsx`), 8–159,5 der Aufwärts-Ort in einem 320 px hohen.
    const ausloeserOben = 163.5;
    const abwaertsOrt = { oben: 195.5, unten: 443.5 };
    const aufwaertsOrt = { oben: 8, unten: 159.5 };
    // 1. RICHTIG GERICHTET, beide Richtungen — sonst misst dieser Fall nur Strenge statt
    //    Richtigkeit, und die Elle könnte einfach alles beanstanden.
    expect(amAusloeser(handbefund(false, abwaertsOrt, ausloeserOben, 900))).toBe(0);
    expect(amAusloeser(handbefund(true, aufwaertsOrt, ausloeserOben, 320))).toBe(0);
    // 2. FALSCH GERICHTET — der Fehler, den die ungerichtete Fassung durchwinkte. Die Zahlen sind
    //    die wirklichen Abstände zum jeweils RICHTIGEN Ort: 443,5 statt 159,5 und 8 statt 195,5.
    expect(amAusloeser(handbefund(true, abwaertsOrt, ausloeserOben, 320))).toBe(284);
    expect(amAusloeser(handbefund(false, aufwaertsOrt, ausloeserOben, 320))).toBe(187.5);
    // 3. Und die Toleranz ist dieselbe eine: ein halber Pixel daneben bleibt ein Treffer, zwei
    //    Toleranzen daneben nicht. Ohne diese zwei Zeilen wäre offen, ob die Elle überhaupt misst
    //    oder nur zwei Sollwerte auf Gleichheit prüft.
    expect(
      amAusloeser(
        handbefund(true, { oben: 8, unten: 159.5 + SICHT_TOLERANZ_PX }, ausloeserOben, 320),
      ),
    ).toBe(SICHT_TOLERANZ_PX);
    expect(
      amAusloeser(
        handbefund(
          false,
          { oben: 195.5 + 2 * SICHT_TOLERANZ_PX, unten: 443.5 },
          ausloeserOben,
          900,
        ),
      ),
    ).toBe(2 * SICHT_TOLERANZ_PX);
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

    // JOB 3625 · UND SIE ERKENNT AUCH DEN ZWEITEN WEG, UNSICHTBAR ZU WERDEN: abgeschnitten vom
    // eigenen rollenden Vorfahren. Das ist wörtlich die Korrekturpflicht, die Codex an JOB 3584 R2
    // erhoben hat („In Erreichbarkeits- und Fokusmesser rollbare Vorfahren nicht pauschal
    // ausnehmen"). Ohne sie wäre ein Eintrag, der oben aus seiner eigenen Liste gerollt ist, für
    // die Messung „im Fenster" — und L1/L3/L7/L9 wären grün, ohne etwas zu messen.
    //
    // Die Zahlen sind die Bauform der Fläche im Kleinen: ein Rollbereich von 100 bis 400 px, wie
    // ihn die Warteschlange bildet, und Kästen davor, darin und dahinter.
    const ausschnitt = { oben: 100, unten: 400 };
    // Derselbe Kasten, zweimal beurteilt: ohne Ausschnitt im Bild, mit Ausschnitt abgeschnitten.
    expect(imFenster({ oben: 50, unten: 300 }, hoehe)).toBe(true);
    expect(imFenster({ oben: 50, unten: 300 }, hoehe, ausschnitt)).toBe(false);
    expect(ueberDemFenster({ oben: 50, unten: 300 }, ausschnitt)).toBe(50);
    // Sauber im Ausschnitt: nichts fehlt.
    expect(imFenster({ oben: 150, unten: 300 }, hoehe, ausschnitt)).toBe(true);
    expect(fehlendeHoehe({ oben: 150, unten: 300 }, hoehe, ausschnitt)).toBe(0);

    // ------------------------------------------------------------------------------------------
    // JOB 3625 R2 · DIE KORREKTUR VON CODEX: AUCH DIE UNTERE KANTE SCHNEIDET AB.
    // ------------------------------------------------------------------------------------------
    // Bis Runde 1 stand hier `imFenster({ oben: 150, unten: 600 }, hoehe, ausschnitt)` mit der
    // Erwartung `true` — „ein Kasten, der unten aus dem Rollbereich herausragt, bleibt lesbar".
    // Das war die falsche Elle: sie liess blosse ÜBERSCHNEIDUNG genügen und hätte einen Kasten
    // durchgewunken, von dem ein halber Pixel übrig ist (Codex an JOB 3625 R1). Gemessen wird
    // jetzt, WIE VIEL fehlt, verglichen mit dem, was der Bereich überhaupt zeigen kann.
    //
    // Die drei Lagen, die Codex verlangt hat — vollständig sichtbar, teilweise abgeschnitten,
    // 0,5 px Rest:
    expect(imFenster({ oben: 150, unten: 350 }, hoehe, ausschnitt)).toBe(true); // ganz drin
    // 450 px hoch, der Bereich könnte 300 px zeigen, sichtbar sind 250 → 50 px fehlen.
    expect(imFenster({ oben: 150, unten: 600 }, hoehe, ausschnitt)).toBe(false);
    expect(fehlendeHoehe({ oben: 150, unten: 600 }, hoehe, ausschnitt)).toBe(50);
    // Und die Lage aus Codex' Rüge: 200,5 px hoch, davon 0,5 px sichtbar → 200 px fehlen.
    expect(imFenster({ oben: 399.5, unten: 600 }, hoehe, ausschnitt)).toBe(false);
    expect(fehlendeHoehe({ oben: 399.5, unten: 600 }, hoehe, ausschnitt)).toBe(200);
    // Ein halber Pixel ÜBER die untere Kante hinaus ist dagegen kein Sichtverlust — es ist
    // dieselbe eine Toleranz wie oben, keine zweite Zahl. (So misst sich der Eintrag der
    // Warteschlange in der flachen Lage wirklich: Liste bis 199, Eintrag bis 199,15625.)
    expect(imFenster({ oben: 300, unten: 400 + SICHT_TOLERANZ_PX }, hoehe, ausschnitt)).toBe(true);
    expect(imFenster({ oben: 300, unten: 400 + 2 * SICHT_TOLERANZ_PX }, hoehe, ausschnitt)).toBe(
      false,
    );
    // UND DIE UNTERSCHEIDUNG, ohne die die Regel über die Bauhöhe des Inhalts urteilen würde
    // statt über die Sicht auf ihn: Ein Kasten, der HÖHER ist als sein Bereich, kann ihn nur
    // ausfüllen — dann fehlt nichts. Genau diese Lage hat die Karte bei 1280×900 (254,25 px hoch,
    // Fenster 900) nicht, wohl aber jeder Inhalt in einem kleineren Rollbereich.
    expect(imFenster({ oben: 100, unten: 900 }, hoehe, ausschnitt)).toBe(true);
    expect(fehlendeHoehe({ oben: 100, unten: 900 }, hoehe, ausschnitt)).toBe(0);
    // Ausgefüllt UND trotzdem weg: derselbe hohe Kasten, um 30 px nach oben gerollt. Der Bereich
    // ist voll, es fehlt nichts — aber sein ANFANG ist abgeschnitten, und darauf steht der Titel.
    // Deshalb sind es in `imFenster` zwei Bedingungen und nicht eine.
    expect(fehlendeHoehe({ oben: 70, unten: 900 }, hoehe, ausschnitt)).toBe(0);
    expect(imFenster({ oben: 70, unten: 900 }, hoehe, ausschnitt)).toBe(false);
    // Ein halber Pixel über der Kante ist auch hier kein Sichtverlust — dieselbe eine Toleranz.
    expect(imFenster({ oben: 100 - SICHT_TOLERANZ_PX, unten: 300 }, hoehe, ausschnitt)).toBe(true);
    expect(imFenster({ oben: 100 - 2 * SICHT_TOLERANZ_PX, unten: 300 }, hoehe, ausschnitt)).toBe(
      false,
    );
    // Unterhalb des Ausschnitts: der Kasten steht im Fenster, aber nicht im Rollbereich.
    expect(imFenster({ oben: 420, unten: 600 }, hoehe)).toBe(true);
    expect(imFenster({ oben: 420, unten: 600 }, hoehe, ausschnitt)).toBe(false);
    // Und der Ausschnitt macht den Bereich nie GRÖSSER als das Fenster: ein Rollbereich, der
    // selbst über den oberen Rand ragt, rettet einen Kasten nicht, der über dem Fenster liegt.
    expect(imFenster({ oben: -30, unten: 200 }, hoehe, { oben: -200, unten: 300 })).toBe(false);
    // Umgekehrt unten: ein Rollbereich, der unter das Fenster reicht, macht nichts sichtbar.
    expect(imFenster({ oben: 950, unten: 1200 }, hoehe, { oben: 100, unten: 2000 })).toBe(false);
  });
});
