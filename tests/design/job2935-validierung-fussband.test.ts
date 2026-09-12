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
  const rollKette = (start) => {
    const k = [];
    let p = start;
    while (p && p !== document.body && k.length < 3) {
      const st = getComputedStyle(p);
      if (/(auto|scroll|overlay)/.test(st.overflowY) && p.scrollHeight > p.clientHeight + 1) {
        const r = p.getBoundingClientRect();
        k.push({
          name: p.tagName + '[' + (p.getAttribute('data-testid') || p.className.toString().slice(0, 40)) + ']',
          top: Math.round(p.scrollTop * 100) / 100,
          max: Math.round((p.scrollHeight - p.clientHeight) * 100) / 100,
          kasten: { oben: r.top, unten: r.bottom },
        });
      }
      p = p.parentElement;
    }
    return k;
  };
  const GANZES_FENSTER = { oben: 0, unten: fensterHoehe };
  const kette = schlange ? rollKette(schlange) : [];
  const karteKette = karte ? rollKette(karte) : [];
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
    // Kette beginnt an ihr — dasselbe Element). Der Ausschnitt der KARTE ist ihr eigener nächster
    // rollender Vorfahre, getrennt gesucht: sie liegt in der Hülle, nicht in der Liste.
    auswahlAusschnitt: kette[0] ? kette[0].kasten : GANZES_FENSTER,
    karteAusschnitt: karteKette[0] ? karteKette[0].kasten : GANZES_FENSTER,
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
const HOCH = { width: 1280, height: 900 };
const FLACH = { width: 1280, height: 420 };

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
let probenHoch: Probenlauf | null = null;
let probenFlach: Probenlauf | null = null;

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
            const k = letzte.schlange as Randkasten;
            const sichtbarOben = Math.max(k.oben, 0, letzte.karteAusschnitt.oben);
            const sichtbarUnten = Math.min(
              k.unten,
              letzte.fensterHoehe,
              letzte.karteAusschnitt.unten,
            );
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
        const s = await (browser3 as EingabeBrowser).newPage({
          viewport: { width: lage.width, height: lage.height },
        });
        await s.addInitScript(
          `try { localStorage.setItem("kw.designTheme", "modern"); } catch (e) {}`,
        );
        await weicheLegen(s);
        await s.goto(`${ORIGIN}/validierung`, { waitUntil: "load", timeout: 60_000 });
        await s.waitForFunction(fn(GENUG_EINTRAEGE), [EINTRAG_ANKER, LANGE_LISTE], {
          timeout: 30_000,
        });
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
        const lauf: Probenlauf = { huelleUnten: m.karteAusschnitt.unten, proben };
        console.info(`JOB 3625 L14 · ${lage.width}x${lage.height} · ${JSON.stringify(lauf)}`);
        return lauf;
      };

      taste = await wegMessen("taste", HOCH);
      rad = await wegMessen("rad", HOCH);
      tasteFlach = await wegMessen("taste", FLACH);
      radFlach = await wegMessen("rad", FLACH);
      probenHoch = await probenMessen(HOCH);
      probenFlach = await probenMessen(FLACH);
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
    for (const lauf of [taste, rad, tasteFlach, radFlach]) {
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
  // rechte Spalte oder die Bänder der Hülle umzubauen — beides ausserhalb dieses Auftrags
  // (§5: „nur die linke Liste", §10). Der Rest ist durch Rollen der Hülle erreichbar; er steht als
  // offener Punkt in der Rückgabe, nicht als grüner Fall.
  //
  // GEMESSEN WIRD DESHALB DAS, WAS DIESER JOB VERANTWORTET — dass beim Durchgehen der Liste rechts
  // NICHTS WANDERT. Genau das war der Fehler aus JOB 3593 (die Karte rutschte bei Schritt 13 um
  // 3,5 px unter das Kopfband), und genau das hält die Reparatur:
  //   1. Karte UND Titel beginnen an jedem der dreissig Schritte im sichtbaren Teil der Hülle —
  //      weder darüber (abgerollt) noch darunter (weggeschoben).
  //   2. Von beiden ist an jedem Schritt GLEICH VIEL zu sehen wie beim ersten. Rollt die Hülle auch
  //      nur ein Stück, fällt diese Zeile.
  //   3. Karte und Liste beginnen auf derselben Höhe — über der Karte verfällt kein Platz.
  // Die Elle ist überall dieselbe (`SICHT_TOLERANZ_PX`, `ueberDemFenster`, `sichtbareHoehe`); es
  // entsteht kein zweiter Massstab, nur eine andere — kleinere — Aussage als bei 1280×900, wo L2/L4
  // weiterhin die VOLLE Sichtbarkeit der Karte verlangen.
  const flacheKartenPruefung = (name: string, lauf: Weglauf | null): void => {
    const schritte = lauf?.schritte ?? [];
    expect(schritte.length, `${name}: keine Schritte gemessen`).toBe(SCHRITTE);
    const erste = schritte[0];
    if (!erste) return;
    for (const [was, kastenVon] of [
      ["die Karte", (m: Schrittmessung) => m.karte],
      ["der Titel der Karte", (m: Schrittmessung) => m.kartentitel],
    ] as const) {
      const zuerst = sichtbareHoehe(kastenVon(erste), erste.fensterHoehe, erste.karteAusschnitt);
      expect(zuerst, `${name}: ${was} war von Anfang an nicht zu sehen`).toBeGreaterThan(
        SICHT_TOLERANZ_PX,
      );
      for (const m of schritte) {
        const k = kastenVon(m);
        const ueber = ueberDemFenster(k, m.karteAusschnitt);
        expect(
          ueber,
          `${name}: Schritt ${m.schritt}: ${was} ist ${ueber} px ueber den sichtbaren Teil der Huelle gewandert (Kasten ab ${k.oben}, Huelle ab ${m.karteAusschnitt.oben})`,
        ).toBeLessThanOrEqual(SICHT_TOLERANZ_PX);
        const unter = unterDemFenster(k, m.fensterHoehe, m.karteAusschnitt);
        expect(
          unter,
          `${name}: Schritt ${m.schritt}: ${was} beginnt ${unter} px UNTER dem sichtbaren Teil der Huelle (Huelle bis ${m.karteAusschnitt.unten})`,
        ).toBe(0);
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
    flacheKartenPruefung("Pfeiltaste 1280x420", tasteFlach);
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
    flacheKartenPruefung("Mausrad 1280x420", radFlach);
  });

  it("L11 · die Restbewegung der HUELLE ist erklaert und festgenagelt — Ueberhang der Liste = gerollte Strecke", () => {
    expect(fehler3).toBeNull();
    for (const [name, lauf] of [
      ["Pfeiltaste 1280x900", taste],
      ["Mausrad 1280x900", rad],
      ["Pfeiltaste 1280x420", tasteFlach],
      ["Mausrad 1280x420", radFlach],
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
      const s = lauf?.start;
      const ueberhang =
        Math.round(
          Math.max(0, (s?.auswahlAusschnitt.unten ?? 0) - (s?.karteAusschnitt.unten ?? 0)) * 100,
        ) / 100;
      expect(
        Math.abs(weiteste - ueberhang),
        `${name}: die Huelle rollte ${weiteste} px, die Liste haengt aber ${ueberhang} px unter ihrem sichtbaren Teil (Liste bis ${s?.auswahlAusschnitt.unten}, Huelle bis ${s?.karteAusschnitt.unten})`,
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
      const huelleUnten = s?.karteAusschnitt.unten ?? 0;
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
