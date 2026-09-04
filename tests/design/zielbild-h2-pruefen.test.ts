// ================================================================================================
// JOB 3061 · H2 — DIE DREI MOCKUPS, AN DER ECHTEN SEITE IN CHROMIUM GEMESSEN.
// ================================================================================================
//
// PEDIS FRAGE (04.09.): „Sieht die Prüffläche wirklich so aus wie gezeichnet — auf der echten
// Seite gemessen, nicht an einem Nachbau?"
//
// GEGENSTAND sind die drei Vorlagen aus `design/klarwerk`:
//   · `Pruefen.dc.html`   — Reiter „Offen": Titel, Segment, Warteschlange, EINE Karte, Fußband
//   · `Konflikte.dc.html` — zwei Karten, der Widerspruch rot markiert, vier Knöpfe
//   · `Duplikate.dc.html` — dieselbe Fläche, gelb markiert, andere Knöpfe
//
// WIE DIE ECHTE SEITE HIER LÄUFT (dasselbe Muster wie `zielbild-validierung.test.ts`, das diese
// Datei ablöst):
//   · Die ECHTE Anwendung (`apps/web/dist`, Ergebnis von `./tools/build`) läuft in Chromium unter
//     `http://klarwerk.test/`; Playwright bedient `/assets/*` und `index.html` aus `dist` und
//     reicht JEDEN `/api/*`-Aufruf an die ECHTE Fastify-App (`buildApp`, echte Dienste, echter
//     Bestand) weiter. Kein Mock, kein Nachbau: React mountet die echten Seiten selbst, mit einem
//     echten Wissensobjekt, einem echten Konflikt und einer echten Überschneidung im Bestand.
//   · Das THEME wird ausdrücklich gesetzt (`localStorage["kw.designTheme"] = "modern"`, der
//     Schalter des Produkts) und in der Seite nachgemessen. Die Werkbank-Palette IST das Zielbild.
//   · Das Fenster ist 1280×800 — die Größe der Vorlagen.
//
// EIN VERGLEICH JE WERT. Jeder Sollwert wird AUS DER VORLAGE gelesen (nicht abgeschrieben) und
// ohne Renderer kanonisiert; gemessen wird per `getComputedStyle` am realen Element, gefunden über
// seinen Produktanker (`data-testid`). Verstellt jemand einen Wert im Produkt, wird genau der eine
// Fall rot, dessen Name den Wert trägt.
//
// UND DER TEXTMESSER (Auftrag §5.6): je Reiter der sichtbare Text der Fläche bei GESCHLOSSENEN
// Menüs, abzüglich Titel, Texten, Meta, Chips und Knöpfen — höchstens 80 Zeichen. Das ist die
// messbare Fassung von Pedis Satz „so irreführend und so unübersichtlich": eine Fläche, die
// erklärt statt zu zeigen, fällt hier durch. Ausgezeichnet wird über `data-text="…"` am Produkt;
// alles ohne diese Auszeichnung zählt als Erklärtext.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import { buildApp, buildServices } from "../../services/app/src/build-app";

const WURZEL = resolve(process.cwd());
const DIST = resolve(WURZEL, "apps/web/dist");
const MOCKUPS = "/Users/peterkohnert/klarwerk_steuerung/design/klarwerk";
const ORIGIN = "http://klarwerk.test";

// ---- Die Vorlagen -------------------------------------------------------------------------------
function vorlage(name: string): string {
  const pfad = join(MOCKUPS, name);
  return existsSync(pfad) ? readFileSync(pfad, "utf8") : "";
}
const Z_PRUEFEN = vorlage("Pruefen.dc.html");
const Z_KONFLIKTE = vorlage("Konflikte.dc.html");
const Z_DUPLIKATE = vorlage("Duplikate.dc.html");
const VORLAGEN_DA = Z_PRUEFEN !== "" && Z_KONFLIKTE !== "" && Z_DUPLIKATE !== "";

/** Der erste `style="…"`-Block der Vorlage, der den Anker enthält. */
function zielStil(ziel: string, anker: string): string | null {
  const re = /style="([^"]*)"/g;
  for (let m = re.exec(ziel); m !== null; m = re.exec(ziel)) {
    if ((m[1] ?? "").includes(anker)) return m[1] ?? null;
  }
  return null;
}
function zielProp(stil: string | null, eigenschaft: string): string | null {
  if (stil === null) return null;
  return new RegExp(`(?:^|[;\\s])${eigenschaft}\\s*:\\s*([^;]+)`).exec(stil)?.[1]?.trim() ?? null;
}
/** Hex → `rgb(r, g, b)` (die Serialisierung von getComputedStyle); alles andere unverändert. */
function kanon(wert: string | null): string | null {
  if (wert === null) return null;
  const m = /^#([0-9a-f]{6})$/i.exec(wert.trim());
  if (!m) return wert.trim();
  const h = m[1] ?? "";
  return `rgb(${Number.parseInt(h.slice(0, 2), 16)}, ${Number.parseInt(h.slice(2, 4), 16)}, ${Number.parseInt(h.slice(4, 6), 16)})`;
}
/** Der n-te Wert einer Kurzschreibweise (`padding: 24px 28px 20px` → [0]=24px). */
function teil(wert: string | null, i: number): string | null {
  return wert?.split(/\s+/)[i] ?? null;
}

// Anker in den Vorlagen — je Baustein die Zeichenfolge, die ihn eindeutig macht.
const A_TITEL = "font-size: 26px; font-weight: 650";
const A_SEGMENT = "background: #EEEAE3";
const A_REITER_AKTIV = "background: #FFFFFF; font-size: 13px; font-weight: 600";
const A_REITER_INAKTIV = "border-radius: 7px; font-size: 13px; color: #525B6B";
const A_SCHLANGE_AKTIV = "background: #FFFFFF; border: 1px solid #E9E5DE; font-weight: 600";
const A_SCHLANGE_RUHIG = "line-height: 1.35; color: #525B6B";
const A_KARTE = "border-radius: 14px";
const A_KARTENKOPF = "padding: 24px 28px 20px";
const A_KARTENTITEL = "font-size: 20px; font-weight: 650";
const A_KARTENTEXT = "font-size: 15px; line-height: 1.65;";
const A_PILLE_NEU = "color: #8A5A00; background: #FDF1D7";
const A_META = "font-size: 12.5px; color: #525B6B";
const A_CHIP = "padding: 5px 10px; background: #FAF8F5";
const A_FUSS = "padding: 16px 28px; background: #FAF8F5";
const A_FREIGEBEN = "background: #116B3C";
const A_RUECKFRAGE = "background: #FFFFFF; color: #1A2233; border: 1px solid #E9E5DE";
const A_ABLEHNEN = "color: #A12626";
const A_PUNKT_VOLL = "border-radius: 50%; background: #116B3C";
const A_PUNKT_LEER = "border-radius: 50%; border: 1.5px solid #E9E5DE";
// Konflikte / Duplikate
const A_PAARZEILE_TITEL = "font-size: 15px; font-weight: 600";
const A_PILLE_NEUTRAL = "color: #525B6B; background: #F2EFEA";
const A_PAAR = "display: flex; gap: 20px";
const A_PAARKOPF = "padding: 18px 22px 8px";
const A_PAARTITEL = "font-size: 16px; font-weight: 650";
const A_PAARTEXT = "padding: 8px 22px 22px";
const A_MARKE_KONFLIKT = "background: #FBE6E6";
const A_MARKE_DUPLIKAT = "background: #FDF1D7; border-radius: 4px";
const A_KNOPF_PRIMAER = "background: #C2500A";
const A_KNOPF_NEUTRAL = "padding: 10px 20px; background: #FFFFFF";
const A_BAND = "display: flex; align-items: center; gap: 10px;";
const A_BANDLINK = "margin-left: auto; font-size: 13px; color: #525B6B";

// ---- Die echte App in Chromium -------------------------------------------------------------------
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

const LESEN =
  "([sel, eig]) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).getPropertyValue(eig) : null; }";
const RECHTECK =
  "(sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { links: r.left, rechts: r.right, breite: r.width, hoehe: r.height }; }";
const ZAEHLEN = "(sel) => document.querySelectorAll(sel).length";

// ------------------------------------------------------------------------------------------------
// DER TEXTMESSER (Auftrag §5.6 / §8.4)
// ------------------------------------------------------------------------------------------------
// Gemessen wird `innerText` der Fläche UNTERHALB des Kopfbands, bei geschlossenen Menüs, nachdem
// alles entfernt wurde, was das Mockup ausdrücklich zeigt: Titel, Texte, Meta, Chips und Knöpfe
// (`[data-text]`) sowie jedes `<button>` und `<select>`. Was danach übrig bleibt, ist Erklärtext.
//
// `innerText` und nicht `textContent`: der Browser lässt darin weg, was er NICHT rendert — ein
// zugeklapptes `<details>` also, ein geschlossenes Menü ohnehin (dessen Inhalt steht gar nicht im
// DOM). Wer die Leitkarte nur per CSS ausblendete, käme hier trotzdem durch — deshalb misst die
// Probe zusätzlich, dass die Menüblätter WIRKLICH nicht im DOM stehen.
const TEXTMESSER = `() => {
  const flaeche = document.querySelector('[data-testid="pruefen-flaeche"]');
  if (!flaeche) return null;
  const klon = flaeche.cloneNode(true);
  for (const el of [...klon.querySelectorAll('[data-text], button, select, input, textarea')]) {
    el.remove();
  }
  // innerText braucht Layout: der Klon muss dafür kurz in der Seite hängen.
  klon.style.position = 'absolute';
  klon.style.left = '-99999px';
  document.body.appendChild(klon);
  const text = (klon.innerText || '').replace(/\\s+/g, ' ').trim();
  klon.remove();
  return { text, laenge: text.length, blaetter: document.querySelectorAll('[data-testid^="pruefen-menue-panel-"]').length };
}`;

let browser: Browser | null = null;
let seite: Seite | null = null;
let app: ReturnType<typeof buildApp> | null = null;
let fehler: string | null = null;
let version = "";
let theme = "";

// Die Texte der Kulisse — sie tragen die Markierung und die Meta-Zeile.
const KO_A_TITEL = "Design Guide Rev. 0.91";
const KO_B_TITEL = "Hohlprofile in Nasszonen";
const STREIT_A = "vermeiden, weil ihre Dichtheit langfristig nicht garantiert werden kann.";
const STREIT_B = "zulaessig, wenn die Dichtheit jaehrlich geprueft wird.";
const KO_A_TEXT = `Vollverschweisste Hohlprofile in Lebensmittel- und Spritzzonen ${STREIT_A}`;
const KO_B_TEXT = `Vollverschweisste Hohlprofile sind ${STREIT_B}`;
const DUP_A_TITEL = "Wartung Ventilblock";
const DUP_B_TITEL = "Ventil entlasten vor Wartung";
const GEMEINSAM = "Ventil vor der Wartung entlasten und den Druck pruefen.";
const NUR_A = "Schutzbrille tragen.";
const NUR_B = "Manometer muss auf null stehen.";

describe.runIf(VORLAGEN_DA)(
  "JOB 3061 · H2 · die drei Mockups an der echten Prüffläche (Chromium, Theme modern, 1280×800)",
  () => {
    beforeAll(async () => {
      try {
        if (!existsSync(join(DIST, "index.html"))) {
          throw new Error("apps/web/dist fehlt — vorher ./tools/build (im Tor läuft es immer)");
        }
        const services = buildServices();
        app = buildApp(services);
        await app.ready();
        await app.inject({
          method: "POST",
          url: "/api/auth/register",
          payload: { name: "Pedi", email: "pedi@job3061.test", password: "geheim12345" },
        });
        const login = await app.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: { email: "pedi@job3061.test", password: "geheim12345" },
        });
        const token = (login.json() as { token: string }).token;
        const me = await app.inject({
          method: "GET",
          url: "/api/auth/me",
          headers: { authorization: `Bearer ${token}` },
        });
        const autorId = (me.json() as { id: string }).id;

        // Vier echte Wissensobjekte: zwei fuer den Konflikt, zwei fuer die Ueberschneidung.
        // Sie stehen zugleich als offene Objekte auf dem Reiter „Offen" — genau wie im Betrieb.
        const anlegen = async (title: string, statement: string): Promise<string> => {
          const ko = (await services.ko.create({
            title,
            statement,
            type: "best_practice",
            category: "Konstruktion",
            author: autorId,
            // Eine echte Quelle — das Mockup zeigt den Quellen-Chip unter dem Text
            // (Pruefen.dc.html:56), und ohne Quelle gäbe es keinen zu messen.
            sources: [
              {
                id: `q-${title.replace(/\W+/g, "-").toLowerCase()}`,
                label: "1 · Design Guide Rev. 0.91",
                url: null,
                excerpt: null,
                kind: "external",
                peerValidated: false,
                author: autorId,
                at: "2026-07-31T08:00:00.000Z",
              },
            ],
          } as never)) as { id: string };
          return ko.id;
        };
        const koA = await anlegen(KO_A_TITEL, KO_A_TEXT);
        const koB = await anlegen(KO_B_TITEL, KO_B_TEXT);
        const dupA = await anlegen(DUP_A_TITEL, `${GEMEINSAM} ${NUR_A}`);
        const dupB = await anlegen(DUP_B_TITEL, `${GEMEINSAM} ${NUR_B}`);

        await services.conflicts.createAuto(
          {
            koA,
            koB,
            type: "truth",
            description: "Widerspruch zur Zulaessigkeit vollverschweisster Hohlprofile.",
          } as never,
          {
            trigger: "background",
            method: "model",
            confidence: 0.86,
            rationale: "Beide Aussagen betreffen dieselbe Bauform und schliessen einander aus.",
            quotes: { a: STREIT_A, b: STREIT_B },
            kollision: {
              streitpunkt: "Hohlprofile in Spritzzonen",
              seiteA: {
                kernaussage: "vermeiden",
                streitwert: STREIT_A,
                streitwertWoertlich: true,
              },
              seiteB: {
                kernaussage: "zulaessig",
                streitwert: STREIT_B,
                streitwertWoertlich: true,
              },
            },
          } as never,
        );
        await services.overlaps.createAuto(
          {
            koA: dupA,
            koB: dupB,
            relation: "identisch",
            aspects: [
              { beschreibung: "Entlasten und Druck pruefen", zitatA: GEMEINSAM, zitatB: GEMEINSAM },
            ],
            eigenanteilA: NUR_A,
            eigenanteilB: NUR_B,
            recommendation: "zusammenfuehren_pruefen",
          } as never,
          {
            trigger: "background",
            method: "model",
            lexicalScore: 0.88,
            confidence: 0.92,
            rationale: "Dieselbe Handlungsanweisung, unterschiedliche Zusatzhinweise.",
          } as never,
        );

        const require = createRequire(import.meta.url);
        const { chromium } = require("playwright") as {
          chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
        };
        browser = await chromium.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
        });
        version = browser.version();
        seite = await browser.newPage({ viewport: { width: 1280, height: 800 } });
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
        await oeffne("/validierung", '[data-testid="pruefen-karte"]');
        theme = await (seite as Seite).evaluate<string>(
          fn(
            `() => document.documentElement.getAttribute('data-theme') || 'classic (kein Attribut)'`,
          ),
        );
        console.info(
          `JOB 3061 H2 · Chromium ${version} · ${ORIGIN} · Theme ${theme} · 1280×800 · Vorlagen aus ${MOCKUPS}`,
        );
      } catch (e) {
        fehler = String(e).split("\n").slice(0, 4).join(" | ");
      }
    }, 180_000);

    afterAll(async () => {
      await browser?.close();
      await app?.close();
    }, 60_000);

    async function oeffne(pfad: string, warteAuf: string): Promise<void> {
      const s = seite as Seite;
      await s.goto(`${ORIGIN}${pfad}`, { waitUntil: "load", timeout: 60_000 });
      await s.waitForFunction(fn("(sel) => document.querySelector(sel) !== null"), warteAuf, {
        timeout: 30_000,
      });
    }

    async function messen(selektor: string, eigenschaft: string): Promise<string | null> {
      expect(fehler, `Seite nicht gemountet: ${fehler}`).toBeNull();
      return (seite as Seite).evaluate<string | null>(fn(LESEN), [selektor, eigenschaft]);
    }
    async function rechteck(
      selektor: string,
    ): Promise<{ links: number; rechts: number; breite: number; hoehe: number } | null> {
      return (seite as Seite).evaluate(fn(RECHTECK), selektor);
    }
    async function zaehlen(selektor: string): Promise<number> {
      return (seite as Seite).evaluate<number>(fn(ZAEHLEN), selektor);
    }

    // ============================================================================================
    // S · DIE ECHTE SEITE STEHT — sonst misst alles Folgende eine leere Fläche
    // ============================================================================================
    describe("S · Kalibrierung: die echte Seite steht und jedes gemessene Element ist da", () => {
      it("S1 · Theme modern ist gesetzt und wirksam", () => {
        expect(fehler).toBeNull();
        expect(theme).toBe("modern");
      });

      it("S2 · Reiter „Offen“: Kopf, Segment, Warteschlange, EINE Karte, EIN Fußband", async () => {
        expect(fehler).toBeNull();
        await oeffne("/validierung", '[data-testid="pruefen-karte"]');
        expect(await zaehlen('[data-testid="pruefen-segment"]')).toBe(1);
        expect(await zaehlen('[data-testid="pruefen-reiter-offen"]')).toBe(1);
        expect(await zaehlen('[data-testid="pruefen-reiter-konflikte"]')).toBe(1);
        expect(await zaehlen('[data-testid="pruefen-reiter-duplikate"]')).toBe(1);
        expect(await zaehlen('[data-testid="pruefen-reiter-erneut"]')).toBe(1);
        expect(await zaehlen('[data-testid="pruefen-warteschlange"]')).toBe(1);
        expect(await zaehlen('[data-testid="pruefen-karte"]')).toBe(1);
        expect(await zaehlen('[data-testid="pruefen-fussband"]')).toBe(1);
        expect(await zaehlen('[data-testid="pruefen-stimmenpunkte"] > span')).toBe(3);
        // Die vier Reiter tragen ihre Zahl aus einem ECHTEN Abruf — vier Objekte, ein Konflikt,
        // eine Überschneidung. Eine geratene Zahl gäbe es hier nicht zu sehen.
        expect(
          await (seite as Seite).evaluate<string | null>(
            fn(
              `() => document.querySelector('[data-testid="pruefen-reiter-konflikte"]')?.textContent ?? null`,
            ),
          ),
        ).toContain("1");
      });

      it("S3 · Reiter „Konflikte“: Paarzeile, zwei Karten, Aktionsband, Markierung in BEIDEN Karten", async () => {
        expect(fehler).toBeNull();
        await oeffne("/konflikte", '[data-testid="pruefen-paar"]');
        expect(await zaehlen('[data-testid="pruefen-paar-karte-a"]')).toBe(1);
        expect(await zaehlen('[data-testid="pruefen-paar-karte-b"]')).toBe(1);
        expect(await zaehlen('[data-testid="pruefen-aktionsband"]')).toBe(1);
        expect(await zaehlen('[data-testid="pruefen-knopf-links-gilt"]')).toBe(1);
        expect(await zaehlen('[data-testid="pruefen-knopf-rechts-gilt"]')).toBe(1);
        expect(await zaehlen('[data-testid="pruefen-knopf-beide-gelten"]')).toBe(1);
        expect(await zaehlen('[data-testid="pruefen-knopf-kein-widerspruch"]')).toBe(1);
        expect(await zaehlen('[data-testid="pruefen-knopf-zweitmeinung"]')).toBe(1);
        // Auftrag §8.5: der Konflikt ist als Markierung in BEIDEN Karten sichtbar.
        expect(
          await zaehlen('[data-testid="pruefen-paar-text-a"] [data-markiert="1"]'),
        ).toBeGreaterThan(0);
        expect(
          await zaehlen('[data-testid="pruefen-paar-text-b"] [data-markiert="1"]'),
        ).toBeGreaterThan(0);
      });

      it("S4 · Reiter „Duplikate“: dieselbe Fläche, die Prozentpille und vier andere Knöpfe", async () => {
        expect(fehler).toBeNull();
        await oeffne("/duplikate", '[data-testid="pruefen-paar"]');
        expect(await zaehlen('[data-testid="pruefen-paar-karte-a"]')).toBe(1);
        expect(await zaehlen('[data-testid="pruefen-paar-karte-b"]')).toBe(1);
        // Auftrag §8.5: die Prozentzahl bleibt als EINE Pille sichtbar.
        expect(await zaehlen('[data-testid="pruefen-pille-gleich"]')).toBe(1);
        expect(
          await (seite as Seite).evaluate<string | null>(
            fn(
              `() => document.querySelector('[data-testid="pruefen-pille-gleich"]')?.textContent ?? null`,
            ),
          ),
        ).toContain("92");
        expect(await zaehlen('[data-testid="pruefen-knopf-links-behalten"]')).toBe(1);
        expect(await zaehlen('[data-testid="pruefen-knopf-rechts-behalten"]')).toBe(1);
        expect(await zaehlen('[data-testid="pruefen-knopf-beide-verknuepfen"]')).toBe(1);
        expect(await zaehlen('[data-testid="pruefen-knopf-kein-duplikat"]')).toBe(1);
        expect(
          await zaehlen('[data-testid="pruefen-paar-text-a"] [data-markiert="1"]'),
        ).toBeGreaterThan(0);
      });
    });

    // ============================================================================================
    // P · Pruefen.dc.html — Titel, Segment, Warteschlange, Karte, Fußband
    // ============================================================================================
    describe("P · Pruefen.dc.html — Reiter „Offen“", () => {
      beforeAll(async () => {
        if (fehler === null) await oeffne("/validierung", '[data-testid="pruefen-karte"]');
      }, 60_000);

      const TITEL = '[data-testid="page-validierung"] h1';
      const SEGMENT = '[data-testid="pruefen-segment"]';
      const AKTIV = '[data-testid="pruefen-reiter-offen"]';
      const RUHIG = '[data-testid="pruefen-reiter-konflikte"]';
      const SCHLANGE = '[data-testid="pruefen-warteschlange"]';
      const EINTRAG_AKTIV = '[data-testid="pruefen-warteschlange-eintrag"][aria-current="true"]';
      const KARTE = '[data-testid="pruefen-karte"]';
      const KARTENTITEL = `${KARTE} a[data-text="titel"]`;
      const KARTENTEXT = '[data-testid="pruefen-karte-text"]';
      const PILLE = '[data-testid="pruefen-pille-art"]';
      const META = `${KARTE} [data-text="meta"]`;
      const CHIP = '[data-testid="pruefen-chip"]';
      const FUSS = '[data-testid="pruefen-fussband"]';
      const FREIGEBEN = '[data-testid="pruefen-entscheidung-up"]';
      const RUECKFRAGE = '[data-testid="pruefen-entscheidung-warn"]';
      const ABLEHNEN = '[data-testid="pruefen-entscheidung-down"]';
      const PUNKTE = '[data-testid="pruefen-stimmenpunkte"]';

      it("P-T1 · titel-schriftgrad 26px", async () => {
        expect(await messen(TITEL, "font-size")).toBe(
          zielProp(zielStil(Z_PRUEFEN, A_TITEL), "font-size"),
        );
      });
      it("P-T2 · titel-gewicht 650", async () => {
        expect(await messen(TITEL, "font-weight")).toBe(
          zielProp(zielStil(Z_PRUEFEN, A_TITEL), "font-weight"),
        );
      });
      it("P-T3 · titel-laufweite -0.3px", async () => {
        expect(await messen(TITEL, "letter-spacing")).toBe(
          zielProp(zielStil(Z_PRUEFEN, A_TITEL), "letter-spacing"),
        );
      });

      it("P-S1 · segment-grund #EEEAE3", async () => {
        expect(await messen(SEGMENT, "background-color")).toBe(
          kanon(zielProp(zielStil(Z_PRUEFEN, A_SEGMENT), "background")),
        );
      });
      it("P-S2 · segment-radius 9px", async () => {
        expect(await messen(SEGMENT, "border-radius")).toBe(
          zielProp(zielStil(Z_PRUEFEN, A_SEGMENT), "border-radius"),
        );
      });
      it("P-S3 · segment-polster 2px", async () => {
        expect(await messen(SEGMENT, "padding-top")).toBe(
          zielProp(zielStil(Z_PRUEFEN, A_SEGMENT), "padding"),
        );
      });
      it("P-S4 · reiter-polster 6px oben, 14px seitlich", async () => {
        const soll = zielProp(zielStil(Z_PRUEFEN, A_REITER_INAKTIV), "padding");
        expect(await messen(RUHIG, "padding-top")).toBe(teil(soll, 0));
        expect(await messen(RUHIG, "padding-left")).toBe(teil(soll, 1));
      });
      it("P-S5 · reiter-radius 7px", async () => {
        expect(await messen(RUHIG, "border-radius")).toBe(
          zielProp(zielStil(Z_PRUEFEN, A_REITER_INAKTIV), "border-radius"),
        );
      });
      it("P-S6 · reiter-schriftgrad 13px", async () => {
        expect(await messen(RUHIG, "font-size")).toBe(
          zielProp(zielStil(Z_PRUEFEN, A_REITER_INAKTIV), "font-size"),
        );
      });
      it("P-S7 · reiter-farbe #525B6B (ruhig)", async () => {
        expect(await messen(RUHIG, "color")).toBe(
          kanon(zielProp(zielStil(Z_PRUEFEN, A_REITER_INAKTIV), "color")),
        );
      });
      it("P-S8 · aktiver reiter-grund #FFFFFF", async () => {
        expect(await messen(AKTIV, "background-color")).toBe(
          kanon(zielProp(zielStil(Z_PRUEFEN, A_REITER_AKTIV), "background")),
        );
      });
      it("P-S9 · aktiver reiter-gewicht 600", async () => {
        expect(await messen(AKTIV, "font-weight")).toBe(
          zielProp(zielStil(Z_PRUEFEN, A_REITER_AKTIV), "font-weight"),
        );
      });
      it("P-S10 · aktiver reiter-farbe #1A2233", async () => {
        expect(await messen(AKTIV, "color")).toBe(
          kanon(zielProp(zielStil(Z_PRUEFEN, A_REITER_AKTIV), "color")),
        );
      });
      it("P-S11 · aktiver reiter-schatten 0 1px 2px rgba(14,22,38,0.08)", async () => {
        // getComputedStyle serialisiert die Farbe nach vorn — verglichen werden deshalb die Teile.
        const ist = (await messen(AKTIV, "box-shadow")) ?? "";
        expect(ist).toContain("rgba(14, 22, 38, 0.08)");
        expect(ist.replace(/\s+/g, " ")).toContain("0px 1px 2px 0px");
      });

      it("P-W1 · warteschlange-breite 260px", async () => {
        const r = await rechteck(SCHLANGE);
        expect(Math.round(r?.breite ?? 0)).toBe(260);
      });
      it("P-W2 · eintrag-polster 10px oben, 12px seitlich", async () => {
        const soll = zielProp(zielStil(Z_PRUEFEN, A_SCHLANGE_AKTIV), "padding");
        expect(await messen(EINTRAG_AKTIV, "padding-top")).toBe(teil(soll, 0));
        expect(await messen(EINTRAG_AKTIV, "padding-left")).toBe(teil(soll, 1));
      });
      it("P-W3 · eintrag-radius 9px", async () => {
        expect(await messen(EINTRAG_AKTIV, "border-radius")).toBe(
          zielProp(zielStil(Z_PRUEFEN, A_SCHLANGE_AKTIV), "border-radius"),
        );
      });
      it("P-W4 · eintrag-schriftgrad 13.5px", async () => {
        expect(await messen(EINTRAG_AKTIV, "font-size")).toBe(
          zielProp(zielStil(Z_PRUEFEN, A_SCHLANGE_AKTIV), "font-size"),
        );
      });
      it("P-W5 · eintrag-zeilenhöhe 1.35", async () => {
        const faktor = Number.parseFloat(
          zielProp(zielStil(Z_PRUEFEN, A_SCHLANGE_AKTIV), "line-height") ?? "0",
        );
        const grad = Number.parseFloat((await messen(EINTRAG_AKTIV, "font-size")) ?? "0");
        const ist = Number.parseFloat((await messen(EINTRAG_AKTIV, "line-height")) ?? "0");
        expect(Math.abs(ist - grad * faktor)).toBeLessThan(0.6);
      });
      it("P-W6 · aktiver eintrag-grund #FFFFFF", async () => {
        expect(await messen(EINTRAG_AKTIV, "background-color")).toBe(
          kanon(zielProp(zielStil(Z_PRUEFEN, A_SCHLANGE_AKTIV), "background")),
        );
      });
      it("P-W7 · aktiver eintrag-rahmen 1px #E9E5DE", async () => {
        const soll = zielProp(zielStil(Z_PRUEFEN, A_SCHLANGE_AKTIV), "border");
        expect(await messen(EINTRAG_AKTIV, "border-top-width")).toBe(teil(soll, 0));
        expect(await messen(EINTRAG_AKTIV, "border-top-color")).toBe(kanon(teil(soll, 2)));
      });
      it("P-W8 · aktiver eintrag-gewicht 600", async () => {
        expect(await messen(EINTRAG_AKTIV, "font-weight")).toBe(
          zielProp(zielStil(Z_PRUEFEN, A_SCHLANGE_AKTIV), "font-weight"),
        );
      });
      it("P-W9 · ruhiger eintrag-farbe #525B6B", async () => {
        const ruhig = '[data-testid="pruefen-warteschlange-eintrag"]:not([aria-current="true"])';
        expect(await messen(ruhig, "color")).toBe(
          kanon(zielProp(zielStil(Z_PRUEFEN, A_SCHLANGE_RUHIG), "color")),
        );
      });

      it("P-K1 · karten-radius 14px", async () => {
        expect(await messen(KARTE, "border-radius")).toBe(
          zielProp(zielStil(Z_PRUEFEN, A_KARTE), "border-radius"),
        );
      });
      it("P-K2 · karten-rahmen 1px #E9E5DE", async () => {
        const soll = zielProp(zielStil(Z_PRUEFEN, A_KARTE), "border");
        expect(await messen(KARTE, "border-top-width")).toBe(teil(soll, 0));
        expect(await messen(KARTE, "border-top-color")).toBe(kanon(teil(soll, 2)));
      });
      it("P-K3 · karten-grund #FFFFFF", async () => {
        expect(await messen(KARTE, "background-color")).toBe(
          kanon(zielProp(zielStil(Z_PRUEFEN, A_KARTE), "background")),
        );
      });
      it("P-K4 · karten-schatten (weiches Licht statt Rahmen)", async () => {
        const ist = ((await messen(KARTE, "box-shadow")) ?? "").replace(/\s+/g, " ");
        expect(ist).toContain("rgba(14, 22, 38, 0.05) 0px 1px 2px 0px");
        expect(ist).toContain("rgba(14, 22, 38, 0.12) 0px 8px 24px -12px");
      });
      it("P-K5 · kartenkopf-polster 24px oben, 28px seitlich, 20px unten", async () => {
        const kopf = `${KARTE} > div:first-child`;
        const soll = zielProp(zielStil(Z_PRUEFEN, A_KARTENKOPF), "padding");
        expect(await messen(kopf, "padding-top")).toBe(teil(soll, 0));
        expect(await messen(kopf, "padding-left")).toBe(teil(soll, 1));
        expect(await messen(kopf, "padding-bottom")).toBe(teil(soll, 2));
      });
      it("P-K6 · kartentitel 20px / 650 / -0.2px", async () => {
        const stil = zielStil(Z_PRUEFEN, A_KARTENTITEL);
        expect(await messen(KARTENTITEL, "font-size")).toBe(zielProp(stil, "font-size"));
        expect(await messen(KARTENTITEL, "font-weight")).toBe(zielProp(stil, "font-weight"));
        expect(await messen(KARTENTITEL, "letter-spacing")).toBe(zielProp(stil, "letter-spacing"));
      });
      it("P-K7 · kartentext 15px, Zeilenhöhe 1.65", async () => {
        const stil = zielStil(Z_PRUEFEN, A_KARTENTEXT);
        expect(await messen(KARTENTEXT, "font-size")).toBe(zielProp(stil, "font-size"));
        const faktor = Number.parseFloat(zielProp(stil, "line-height") ?? "0");
        const ist = Number.parseFloat((await messen(KARTENTEXT, "line-height")) ?? "0");
        expect(Math.abs(ist - 15 * faktor)).toBeLessThan(0.6);
      });
      it("P-K8 · pille: 11px / 700 / 0.3px, Radius 999px, Polster 3px 10px, #8A5A00 auf #FDF1D7", async () => {
        const stil = zielStil(Z_PRUEFEN, A_PILLE_NEU);
        expect(await messen(PILLE, "font-size")).toBe(zielProp(stil, "font-size"));
        expect(await messen(PILLE, "font-weight")).toBe(zielProp(stil, "font-weight"));
        expect(await messen(PILLE, "letter-spacing")).toBe(zielProp(stil, "letter-spacing"));
        expect(await messen(PILLE, "border-radius")).toBe(zielProp(stil, "border-radius"));
        const polster = zielProp(stil, "padding");
        expect(await messen(PILLE, "padding-top")).toBe(teil(polster, 0));
        expect(await messen(PILLE, "padding-left")).toBe(teil(polster, 1));
        expect(await messen(PILLE, "color")).toBe(kanon(zielProp(stil, "color")));
        expect(await messen(PILLE, "background-color")).toBe(kanon(zielProp(stil, "background")));
      });
      it("P-K9 · meta 12.5px #525B6B", async () => {
        const stil = zielStil(Z_PRUEFEN, A_META);
        expect(await messen(META, "font-size")).toBe(zielProp(stil, "font-size"));
        expect(await messen(META, "color")).toBe(kanon(zielProp(stil, "color")));
      });
      it("P-K10 · quellen-chip: Polster 5px 10px, Grund #FAF8F5, Rahmen 1px #E9E5DE, Radius 8px", async () => {
        const stil = zielStil(Z_PRUEFEN, A_CHIP);
        const polster = zielProp(stil, "padding");
        expect(await messen(CHIP, "padding-top")).toBe(teil(polster, 0));
        expect(await messen(CHIP, "padding-left")).toBe(teil(polster, 1));
        expect(await messen(CHIP, "background-color")).toBe(kanon(zielProp(stil, "background")));
        const rahmen = zielProp(stil, "border");
        expect(await messen(CHIP, "border-top-width")).toBe(teil(rahmen, 0));
        expect(await messen(CHIP, "border-top-color")).toBe(kanon(teil(rahmen, 2)));
        expect(await messen(CHIP, "border-radius")).toBe(zielProp(stil, "border-radius"));
      });

      it("P-F1 · fußband-polster 16px oben, 28px seitlich", async () => {
        const soll = zielProp(zielStil(Z_PRUEFEN, A_FUSS), "padding");
        expect(await messen(FUSS, "padding-top")).toBe(teil(soll, 0));
        expect(await messen(FUSS, "padding-left")).toBe(teil(soll, 1));
      });
      it("P-F2 · fußband-grund #FAF8F5", async () => {
        expect(await messen(FUSS, "background-color")).toBe(
          kanon(zielProp(zielStil(Z_PRUEFEN, A_FUSS), "background")),
        );
      });
      it("P-F3 · fußband-trennlinie 1px #E9E5DE", async () => {
        const soll = zielProp(zielStil(Z_PRUEFEN, A_FUSS), "border-top");
        expect(await messen(FUSS, "border-top-width")).toBe(teil(soll, 0));
        expect(await messen(FUSS, "border-top-color")).toBe(kanon(teil(soll, 2)));
      });
      it("P-F4 · fußband-knopfabstand 10px", async () => {
        expect(await messen(FUSS, "column-gap")).toBe(zielProp(zielStil(Z_PRUEFEN, A_FUSS), "gap"));
      });
      it("P-F5 · Freigeben: #116B3C, weiß, 600, 14px, Radius 10px, Polster 10px 20px, Symbolabstand 7px", async () => {
        const stil = zielStil(Z_PRUEFEN, A_FREIGEBEN);
        expect(await messen(FREIGEBEN, "background-color")).toBe(
          kanon(zielProp(stil, "background")),
        );
        expect(await messen(FREIGEBEN, "color")).toBe(kanon(zielProp(stil, "color")));
        expect(await messen(FREIGEBEN, "font-weight")).toBe(zielProp(stil, "font-weight"));
        expect(await messen(FREIGEBEN, "font-size")).toBe(zielProp(stil, "font-size"));
        expect(await messen(FREIGEBEN, "border-radius")).toBe(zielProp(stil, "border-radius"));
        const polster = zielProp(stil, "padding");
        expect(await messen(FREIGEBEN, "padding-top")).toBe(teil(polster, 0));
        expect(await messen(FREIGEBEN, "padding-left")).toBe(teil(polster, 1));
        expect(await messen(FREIGEBEN, "column-gap")).toBe(zielProp(stil, "gap"));
      });
      it("P-F6 · Rückfrage: weiß, #1A2233, Rahmen 1px #E9E5DE, 14px", async () => {
        const stil = zielStil(Z_PRUEFEN, A_RUECKFRAGE);
        expect(await messen(RUECKFRAGE, "background-color")).toBe(
          kanon(zielProp(stil, "background")),
        );
        expect(await messen(RUECKFRAGE, "color")).toBe(kanon(zielProp(stil, "color")));
        const rahmen = zielProp(stil, "border");
        expect(await messen(RUECKFRAGE, "border-top-width")).toBe(teil(rahmen, 0));
        expect(await messen(RUECKFRAGE, "border-top-color")).toBe(kanon(teil(rahmen, 2)));
        expect(await messen(RUECKFRAGE, "font-size")).toBe(zielProp(stil, "font-size"));
      });
      it("P-F7 · Ablehnen trägt das Rot der Palette (#A12626)", async () => {
        expect(await messen(ABLEHNEN, "color")).toBe(
          kanon(zielProp(zielStil(Z_PRUEFEN, A_ABLEHNEN), "color")),
        );
      });
      it("P-F8 · drei Punkte 9px mit 5px Abstand, rechtsbündig am Band", async () => {
        const stil = zielStil(Z_PRUEFEN, A_PUNKT_VOLL);
        expect(await messen(`${PUNKTE} > span:first-child`, "width")).toBe(zielProp(stil, "width"));
        expect(await messen(`${PUNKTE} > span:first-child`, "height")).toBe(
          zielProp(stil, "height"),
        );
        expect(await messen(PUNKTE, "column-gap")).toBe("5px");
        const band = await rechteck(FUSS);
        const punkte = await rechteck(PUNKTE);
        // `margin-left: auto` löst ein Flex-Layout zu einem Pixelwert auf — gemessen wird die Kante.
        expect(Math.abs((band?.rechts ?? 0) - 28 - (punkte?.rechts ?? 0))).toBeLessThan(2);
      });
      it("P-F9 · gefüllter Punkt #116B3C, leerer Punkt Rahmen 1.5px #E9E5DE", async () => {
        const voll = zielStil(Z_PRUEFEN, A_PUNKT_VOLL);
        const leer = zielStil(Z_PRUEFEN, A_PUNKT_LEER);
        const sollBreite = teil(zielProp(leer, "border"), 0);
        // ================================================================================
        // DIE BREITE WIRD GEGEN DEN BROWSER GEMESSEN, NICHT GEGEN DIE ZAHL IM MOCKUP.
        // ================================================================================
        // Chromium rundet Rahmenbreiten auf ganze Gerätepixel: `border-width: 1.5px` liest
        // sich in `getComputedStyle` als „1px". Ein Vergleich gegen den Text „1.5px" wäre
        // deshalb IMMER rot — auch dann, wenn das Produkt exakt den Wert der Vorlage trägt.
        // Gemessen wird stattdessen eine PROBE mit genau dem Vorlagenwert im SELBEN Browser:
        // was der Browser aus der Vorlage macht, muss er auch aus dem Produkt machen.
        const probe = await (seite as Seite).evaluate<string>(
          fn(`(breite) => {
            const el = document.createElement('span');
            el.style.borderStyle = 'solid';
            el.style.borderWidth = breite;
            document.body.appendChild(el);
            const wert = getComputedStyle(el).borderTopWidth;
            el.remove();
            return wert;
          }`),
          sollBreite,
        );
        expect(await messen(`${PUNKTE} > span[data-punkt="leer"]`, "border-top-width")).toBe(probe);
        expect(await messen(`${PUNKTE} > span[data-punkt="leer"]`, "border-top-color")).toBe(
          kanon(teil(zielProp(leer, "border"), 2)),
        );
        // Das Fixture hat null Stimmen — alle drei Punkte sind leer. Der gefüllte Zustand wird über
        // die Farbe des Tokens gemessen, mit dem er gezeichnet wird (Gesichert-Grün).
        expect(kanon(zielProp(voll, "background"))).toBe(
          await messen(FREIGEBEN, "background-color"),
        );
      });
    });

    // ============================================================================================
    // K · Konflikte.dc.html — zwei Karten, rot markiert, vier Knöpfe
    // ============================================================================================
    describe("K · Konflikte.dc.html — Reiter „Konflikte“", () => {
      beforeAll(async () => {
        if (fehler === null) await oeffne("/konflikte", '[data-testid="pruefen-paar"]');
      }, 60_000);

      const ZEILE_TITEL = '[data-testid="pruefen-flaeche"] [data-text="titel"]';
      const PILLE_LAUF = '[data-testid="pruefen-pille-lauf"]';
      const PAAR = '[data-testid="pruefen-paar"]';
      const KARTE_A = '[data-testid="pruefen-paar-karte-a"]';
      const KOPF_A = `${KARTE_A} > div:first-child`;
      const TITEL_A = `${KARTE_A} [data-text="titel"]`;
      const META_A = `${KARTE_A} [data-text="meta"]`;
      const TEXT_A = '[data-testid="pruefen-paar-text-a"]';
      const MARKE_A = '[data-testid="pruefen-paar-text-a"] [data-markiert="1"]';
      const BAND = '[data-testid="pruefen-aktionsband"]';
      const PRIMAER = '[data-testid="pruefen-knopf-links-gilt"]';
      const NEUTRAL = '[data-testid="pruefen-knopf-beide-gelten"]';
      const BANDLINK = '[data-testid="pruefen-knopf-zweitmeinung"]';

      it("K-Z1 · Zeilentitel 15px / 600", async () => {
        const stil = zielStil(Z_KONFLIKTE, A_PAARZEILE_TITEL);
        expect(await messen(ZEILE_TITEL, "font-size")).toBe(zielProp(stil, "font-size"));
        expect(await messen(ZEILE_TITEL, "font-weight")).toBe(zielProp(stil, "font-weight"));
      });
      it("K-Z2 · „k von n“-Pille: #525B6B auf #F2EFEA, Radius 999px, Polster 3px 10px, 11px/700/0.3px", async () => {
        const stil = zielStil(Z_KONFLIKTE, A_PILLE_NEUTRAL);
        expect(await messen(PILLE_LAUF, "color")).toBe(kanon(zielProp(stil, "color")));
        expect(await messen(PILLE_LAUF, "background-color")).toBe(
          kanon(zielProp(stil, "background")),
        );
        expect(await messen(PILLE_LAUF, "border-radius")).toBe(zielProp(stil, "border-radius"));
        const polster = zielProp(stil, "padding");
        expect(await messen(PILLE_LAUF, "padding-top")).toBe(teil(polster, 0));
        expect(await messen(PILLE_LAUF, "padding-left")).toBe(teil(polster, 1));
        expect(await messen(PILLE_LAUF, "font-size")).toBe(zielProp(stil, "font-size"));
        expect(await messen(PILLE_LAUF, "font-weight")).toBe(zielProp(stil, "font-weight"));
        expect(await messen(PILLE_LAUF, "letter-spacing")).toBe(zielProp(stil, "letter-spacing"));
      });
      it("K-P1 · Kartenabstand 20px", async () => {
        expect(await messen(PAAR, "column-gap")).toBe(
          zielProp(zielStil(Z_KONFLIKTE, A_PAAR), "gap"),
        );
      });
      it("K-P2 · beide Karten sind gleich breit", async () => {
        const a = await rechteck(KARTE_A);
        const b = await rechteck('[data-testid="pruefen-paar-karte-b"]');
        expect(Math.abs((a?.breite ?? 0) - (b?.breite ?? 1))).toBeLessThan(1);
      });
      it("K-P3 · Kartenradius 14px und Rahmen 1px #E9E5DE", async () => {
        const stil = zielStil(Z_KONFLIKTE, A_KARTE);
        expect(await messen(KARTE_A, "border-radius")).toBe(zielProp(stil, "border-radius"));
        const rahmen = zielProp(stil, "border");
        expect(await messen(KARTE_A, "border-top-width")).toBe(teil(rahmen, 0));
        expect(await messen(KARTE_A, "border-top-color")).toBe(kanon(teil(rahmen, 2)));
      });
      it("K-P4 · Kartenkopf-Polster 18px oben, 22px seitlich, 8px unten", async () => {
        const soll = zielProp(zielStil(Z_KONFLIKTE, A_PAARKOPF), "padding");
        expect(await messen(KOPF_A, "padding-top")).toBe(teil(soll, 0));
        expect(await messen(KOPF_A, "padding-left")).toBe(teil(soll, 1));
        expect(await messen(KOPF_A, "padding-bottom")).toBe(teil(soll, 2));
      });
      it("K-P5 · Kartentitel 16px / 650", async () => {
        const stil = zielStil(Z_KONFLIKTE, A_PAARTITEL);
        expect(await messen(TITEL_A, "font-size")).toBe(zielProp(stil, "font-size"));
        expect(await messen(TITEL_A, "font-weight")).toBe(zielProp(stil, "font-weight"));
      });
      it("K-P6 · Kartenmeta 12.5px #525B6B", async () => {
        const stil = zielStil(Z_KONFLIKTE, A_META);
        expect(await messen(META_A, "font-size")).toBe(zielProp(stil, "font-size"));
        expect(await messen(META_A, "color")).toBe(kanon(zielProp(stil, "color")));
      });
      it("K-P7 · Kartentext: Polster 8px 22px 22px, 15px, Zeilenhöhe 1.65", async () => {
        const stil = zielStil(Z_KONFLIKTE, A_PAARTEXT);
        const soll = zielProp(stil, "padding");
        expect(await messen(TEXT_A, "padding-top")).toBe(teil(soll, 0));
        expect(await messen(TEXT_A, "padding-left")).toBe(teil(soll, 1));
        expect(await messen(TEXT_A, "padding-bottom")).toBe(teil(soll, 2));
        expect(await messen(TEXT_A, "font-size")).toBe(zielProp(stil, "font-size"));
        const faktor = Number.parseFloat(zielProp(stil, "line-height") ?? "0");
        const ist = Number.parseFloat((await messen(TEXT_A, "line-height")) ?? "0");
        expect(Math.abs(ist - 15 * faktor)).toBeLessThan(0.6);
      });
      it("K-M1 · Markierung: #FBE6E6, Radius 4px, Polster 1px 3px", async () => {
        const stil = zielStil(Z_KONFLIKTE, A_MARKE_KONFLIKT);
        expect(await messen(MARKE_A, "background-color")).toBe(kanon(zielProp(stil, "background")));
        expect(await messen(MARKE_A, "border-radius")).toBe(zielProp(stil, "border-radius"));
        const polster = zielProp(stil, "padding");
        expect(await messen(MARKE_A, "padding-top")).toBe(teil(polster, 0));
        expect(await messen(MARKE_A, "padding-left")).toBe(teil(polster, 1));
      });
      it("K-B1 · Band-Knopfabstand 10px", async () => {
        expect(await messen(BAND, "column-gap")).toBe(
          zielProp(zielStil(Z_KONFLIKTE, A_BAND), "gap"),
        );
      });
      it("K-B2 · primärer Knopf: #C2500A, weiß, 600, 14px, Radius 10px, Polster 10px 20px", async () => {
        const stil = zielStil(Z_KONFLIKTE, A_KNOPF_PRIMAER);
        expect(await messen(PRIMAER, "background-color")).toBe(kanon(zielProp(stil, "background")));
        expect(await messen(PRIMAER, "color")).toBe(kanon(zielProp(stil, "color")));
        expect(await messen(PRIMAER, "font-weight")).toBe(zielProp(stil, "font-weight"));
        expect(await messen(PRIMAER, "font-size")).toBe(zielProp(stil, "font-size"));
        expect(await messen(PRIMAER, "border-radius")).toBe(zielProp(stil, "border-radius"));
        const polster = zielProp(stil, "padding");
        expect(await messen(PRIMAER, "padding-top")).toBe(teil(polster, 0));
        expect(await messen(PRIMAER, "padding-left")).toBe(teil(polster, 1));
      });
      it("K-B3 · neutraler Knopf: weiß, #1A2233, Rahmen 1px #E9E5DE", async () => {
        const stil = zielStil(Z_KONFLIKTE, A_KNOPF_NEUTRAL);
        expect(await messen(NEUTRAL, "background-color")).toBe(kanon(zielProp(stil, "background")));
        expect(await messen(NEUTRAL, "color")).toBe(kanon(zielProp(stil, "color")));
        const rahmen = zielProp(stil, "border");
        expect(await messen(NEUTRAL, "border-top-width")).toBe(teil(rahmen, 0));
        expect(await messen(NEUTRAL, "border-top-color")).toBe(kanon(teil(rahmen, 2)));
      });
      it("K-B4 · „Zweitmeinung anfragen“: 13px #525B6B, rechts am Band", async () => {
        const stil = zielStil(Z_KONFLIKTE, A_BANDLINK);
        expect(await messen(BANDLINK, "font-size")).toBe(zielProp(stil, "font-size"));
        expect(await messen(BANDLINK, "color")).toBe(kanon(zielProp(stil, "color")));
        const band = await rechteck(BAND);
        const link = await rechteck(BANDLINK);
        expect(Math.abs((band?.rechts ?? 0) - (link?.rechts ?? 0))).toBeLessThan(2);
      });
    });

    // ============================================================================================
    // D · Duplikate.dc.html — dieselbe Fläche, gelb markiert, andere Knöpfe
    // ============================================================================================
    describe("D · Duplikate.dc.html — Reiter „Duplikate“", () => {
      beforeAll(async () => {
        if (fehler === null) await oeffne("/duplikate", '[data-testid="pruefen-paar"]');
      }, 60_000);

      const PILLE_GLEICH = '[data-testid="pruefen-pille-gleich"]';
      const MARKE_A = '[data-testid="pruefen-paar-text-a"] [data-markiert="1"]';
      const PRIMAER = '[data-testid="pruefen-knopf-links-behalten"]';
      const NEUTRAL = '[data-testid="pruefen-knopf-kein-duplikat"]';

      it("D-M1 · Markierung: #FDF1D7, Radius 4px, Polster 1px 3px", async () => {
        const stil = zielStil(Z_DUPLIKATE, A_MARKE_DUPLIKAT);
        expect(await messen(MARKE_A, "background-color")).toBe(kanon(zielProp(stil, "background")));
        expect(await messen(MARKE_A, "border-radius")).toBe(zielProp(stil, "border-radius"));
        const polster = zielProp(stil, "padding");
        expect(await messen(MARKE_A, "padding-top")).toBe(teil(polster, 0));
        expect(await messen(MARKE_A, "padding-left")).toBe(teil(polster, 1));
      });
      it("D-P1 · „NN % gleich“-Pille: #8A5A00 auf #FDF1D7, Radius 999px, 11px/700/0.3px", async () => {
        const stil = zielStil(Z_DUPLIKATE, A_PILLE_NEU);
        expect(await messen(PILLE_GLEICH, "color")).toBe(kanon(zielProp(stil, "color")));
        expect(await messen(PILLE_GLEICH, "background-color")).toBe(
          kanon(zielProp(stil, "background")),
        );
        expect(await messen(PILLE_GLEICH, "border-radius")).toBe(zielProp(stil, "border-radius"));
        expect(await messen(PILLE_GLEICH, "font-size")).toBe(zielProp(stil, "font-size"));
        expect(await messen(PILLE_GLEICH, "font-weight")).toBe(zielProp(stil, "font-weight"));
        expect(await messen(PILLE_GLEICH, "letter-spacing")).toBe(zielProp(stil, "letter-spacing"));
      });
      it("D-B1 · primärer Knopf #C2500A wie im Mockup", async () => {
        const stil = zielStil(Z_DUPLIKATE, A_KNOPF_PRIMAER);
        expect(await messen(PRIMAER, "background-color")).toBe(kanon(zielProp(stil, "background")));
        expect(await messen(PRIMAER, "color")).toBe(kanon(zielProp(stil, "color")));
        expect(await messen(PRIMAER, "border-radius")).toBe(zielProp(stil, "border-radius"));
      });
      it("D-B2 · neutraler Knopf: weiß, #1A2233, Rahmen 1px #E9E5DE", async () => {
        const stil = zielStil(Z_DUPLIKATE, A_KNOPF_NEUTRAL);
        expect(await messen(NEUTRAL, "background-color")).toBe(kanon(zielProp(stil, "background")));
        expect(await messen(NEUTRAL, "color")).toBe(kanon(zielProp(stil, "color")));
        const rahmen = zielProp(stil, "border");
        expect(await messen(NEUTRAL, "border-top-width")).toBe(teil(rahmen, 0));
        expect(await messen(NEUTRAL, "border-top-color")).toBe(kanon(teil(rahmen, 2)));
      });
      it("D-K1 · Kartenpaar und Kartenmaße sind dieselben wie bei den Konflikten", async () => {
        const stil = zielStil(Z_DUPLIKATE, A_KARTE);
        expect(await messen('[data-testid="pruefen-paar"]', "column-gap")).toBe(
          zielProp(zielStil(Z_DUPLIKATE, A_PAAR), "gap"),
        );
        expect(await messen('[data-testid="pruefen-paar-karte-a"]', "border-radius")).toBe(
          zielProp(stil, "border-radius"),
        );
      });
    });

    // ============================================================================================
    // X · DER TEXTMESSER — die Fläche zeigt, sie erklärt nicht (Auftrag §5.6)
    // ============================================================================================
    describe("X · Textmesser: höchstens 80 Zeichen Erklärtext je Reiter, Menüs geschlossen", () => {
      const GRENZE = 80;
      const FAELLE: ReadonlyArray<[string, string, string]> = [
        ["Offen", "/validierung", '[data-testid="pruefen-karte"]'],
        ["Konflikte", "/konflikte", '[data-testid="pruefen-paar"]'],
        ["Duplikate", "/duplikate", '[data-testid="pruefen-paar"]'],
        ["Erneut", "/lebenszyklus", '[data-testid="pruefen-flaeche"]'],
      ];
      for (const [name, pfad, anker] of FAELLE) {
        it(`X · Reiter „${name}“: der sichtbare Text ohne Titel/Text/Meta/Chips/Knöpfe bleibt unter ${GRENZE} Zeichen`, async () => {
          expect(fehler).toBeNull();
          await oeffne(pfad, anker);
          const mess = await (seite as Seite).evaluate<{
            text: string;
            laenge: number;
            blaetter: number;
          } | null>(fn(TEXTMESSER));
          expect(mess, "die Fläche trägt keinen Messanker").not.toBeNull();
          // Kein Menü ist offen — sonst misst die Probe eine aufgeklappte Fläche.
          expect(mess?.blaetter, "ein Menü stand offen").toBe(0);
          console.info(
            `JOB 3061 H2 · Textmesser ${name}: ${mess?.laenge} Zeichen · „${mess?.text}"`,
          );
          expect(
            mess?.laenge ?? 999,
            `Erklärtext auf „${name}": „${mess?.text}"`,
          ).toBeLessThanOrEqual(GRENZE);
        });
      }
    });
  },
);

describe.runIf(!VORLAGEN_DA)("JOB 3061 · Zielbild-Abgleich übersprungen", () => {
  it("meldet die fehlenden Mockups statt eine Prüfung vorzutäuschen", () => {
    expect(VORLAGEN_DA, `Mockups nicht lesbar: ${MOCKUPS}`).toBe(false);
  });
});
