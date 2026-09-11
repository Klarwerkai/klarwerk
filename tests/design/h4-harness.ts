// ================================================================================================
// JOB 3063 · H4 — DIE VORRICHTUNG: DIE ECHTE, GEBAUTE ANWENDUNG IN CHROMIUM.
// ================================================================================================
//
// Dieselbe Bauform wie `tests/design/zielbild-validierung.test.ts` (JOB 2618 D5), und aus demselben
// Grund: „Die Chromium-Pruefung muss die ECHTE Seite mounten und deren reale Elemente messen; ein
// separat erzeugtes Element mit derselben Klassenkette ist kein UI-Beleg." (ben an D4).
//
//   · `apps/web/dist` — das Ergebnis von `./tools/build` — wird unter `http://klarwerk.test/`
//     geladen; JEDER `/api/*`-Aufruf geht an die ECHTE Fastify-App (`buildApp`, echte Dienste,
//     echter Bestand) mit dem Bearer einer echten Anmeldung. Kein Mock, kein Nachbau.
//   · Das THEME wird ausdrücklich gesetzt (`localStorage["kw.designTheme"] = "modern"`, der Schalter
//     des Produkts) und in der Seite nachgemessen. Das Mockup ist die Werkbank-Palette.
//   · DAS FENSTER IST BEWUSST 1620 px BREIT, nicht die 1280 des Mockups — und das ist keine
//     Bequemlichkeit, sondern die ehrliche Rechnung: das Mockup zeigt die Hülle von JOB H1 (ein
//     56 px hohes Kopfband ohne Seitenleiste). Die HEUTIGE Hülle hat links eine 252 px breite
//     Seitenleiste (`shell/Sidebar.tsx:332`) und um den Inhalt 36 px Polster je Seite
//     (`shell/AppShell.tsx:128`, `px-9`). 1280 + 252 + 72 = 1604; 1620 gibt der Fläche also genau
//     den Raum, den sie im Mockup hat. Die Hülle ist ausdrücklich NICHT Gegenstand dieses Auftrags.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import { buildApp, buildServices } from "../../services/app/src/build-app";
import { ORTSZEILE_WORTE, type OrtszeileSprache } from "../support/ortszeileWorte";

export const WURZEL = resolve(process.cwd());
export const DIST = resolve(WURZEL, "apps/web/dist");
export const MOCKUP = "/Users/peterkohnert/klarwerk_steuerung/design/klarwerk/Bibliothek.dc.html";
export const ORIGIN = "http://klarwerk.test";

// ---- Sollwerte aus dem Mockup LESEN (nicht abschreiben) -----------------------------------------
/** Der `style`-Wert des ersten Elements, dessen Stil `anker` enthält. */
export function zielStil(ziel: string, anker: string): string | null {
  const re = /style="([^"]*)"/g;
  for (let m = re.exec(ziel); m !== null; m = re.exec(ziel)) {
    if ((m[1] ?? "").includes(anker)) return m[1] ?? null;
  }
  return null;
}
export function zielProp(stil: string | null, eigenschaft: string): string | null {
  if (stil === null) return null;
  return new RegExp(`(?:^|[;\\s])${eigenschaft}\\s*:\\s*([^;]+)`).exec(stil)?.[1]?.trim() ?? null;
}
/** Hex → `rgb(r, g, b)` (die Serialisierung von getComputedStyle); alles andere unverändert. */
export function kanon(wert: string | null): string | null {
  if (wert === null) return null;
  const m = /^#([0-9a-f]{6})$/i.exec(wert.trim());
  if (!m) return wert.trim();
  const h = m[1] ?? "";
  return `rgb(${Number.parseInt(h.slice(0, 2), 16)}, ${Number.parseInt(h.slice(2, 4), 16)}, ${Number.parseInt(h.slice(4, 6), 16)})`;
}
/** Ein Wert aus dem `padding`-Kurzschreiben („12px 16px" → oben 12px, rechts 16px, …). */
export function polster(
  kurz: string | null,
  seite: "top" | "right" | "bottom" | "left",
): string | null {
  if (kurz === null) return null;
  const teile = kurz.trim().split(/\s+/);
  const [o, r = o, u = o, l = r] = teile;
  return { top: o, right: r, bottom: u, left: l }[seite] ?? null;
}

// ---- Playwright-Typen (schlank, nur was gebraucht wird) ------------------------------------------
export type BrowserFn = (arg: unknown) => unknown;
export const fn = (quelle: string): BrowserFn =>
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
export interface Seite {
  route(url: string, handler: (route: Route) => Promise<void>): Promise<void>;
  addInitScript(script: string): Promise<void>;
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  waitForFunction(fn: BrowserFn, arg?: unknown, opts?: Record<string, unknown>): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  /** Für die schmale Lage (`R-19`): dieselbe Seite, nur ein schmaleres Fenster. */
  setViewportSize(groesse: { width: number; height: number }): Promise<void>;
  /**
   * JOB 3564: die Tastatur steht HIER und nicht in den Testdateien. SIEBEN Browserprüfungen haben
   * sich `keyboard` bis dahin je selbst nachgereicht (Interface oder Cast; gemessen am Basisstand
   * `efca6a6`) — dieselbe Arbeit siebenmal. Schlank wie der Rest: nur `press`, das einzige, was die
   * Verbraucher wirklich rufen; wer `type` braucht, trägt es hier nach, nicht bei sich.
   * `tests/design-vorrichtung/seiten-typ-waechter.test.ts` hält den Ort fest.
   */
  keyboard: { press(taste: string): Promise<void> };
  evaluate<T>(fn: BrowserFn, arg?: unknown): Promise<T>;
  on(ereignis: string, handler: (arg: unknown) => void): void;
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

export interface H4Stand {
  /** JOB 3130: gezielt eine echte API-Antwort vor der Auslieferung aufhalten/verstellen. */
  antworten: { vorAuslieferung?: (url: URL, body: string) => Promise<string> };
  seite: Seite;
  browser: Browser;
  app: ReturnType<typeof buildApp>;
  version: string;
  theme: string;
  /** Die Kennung des freigegebenen Wissensobjekts, an dem gemessen wird. */
  koId: string;
  /** Kennung eines zweiten, offenen Eintrags — für den gelben Punkt und den Flächenwechsel. */
  koOffenId: string;
  /** Alles, was Chromium als `pageerror` gemeldet hat (fail-closed statt still). */
  seitenfehler: string[];
}

/** Der Titel des freigegebenen Eintrags — er ist die Messmarke in der Liste und auf der Fläche. */
export const TITEL_FREI = "Project equipment design guide Rev. 0.91";
export const TITEL_OFFEN = "Reinigung Spritzzone Linie 3";
export const BEREICH_FREI = "Konstruktion";
export const QUELLE_LABEL = "Design Guide Rev. 0.91";
export const ABSATZ_1 =
  "Halterungen und Profile sind ohne waagerechte Oberseiten auszuführen. Offene, ablaufende Profile sind zu bevorzugen, damit Flüssigkeit nicht stehen bleibt.";
export const ABSATZ_2 =
  "Vollverschweißte Hohlprofile sind in Lebensmittel- und Spritzzonen zu vermeiden, weil ihre Dichtheit langfristig nicht garantiert werden kann.";

/**
 * JOB 3068 (N5): der Haken für Bestände, die diese Vorrichtung nicht selbst herstellt.
 *
 * Er wird gebraucht, weil manche Lagen keinen Weg über die API haben: eine offene Überschneidung
 * und das Abdeckungsprotokoll eines KI-Laufs entstehen im Betrieb aus dem Erkennungslauf, nicht aus
 * einem Aufruf der Oberfläche. Der Haken bekommt deshalb die ECHTEN Dienste — kein Nachbau, kein
 * zweiter Weg —, und er läuft VOR dem Öffnen des Browsers, damit die erste Antwort schon stimmt.
 */
export interface H4Vorbereitung {
  services: ReturnType<typeof buildServices>;
  app: ReturnType<typeof buildApp>;
  /** Die Kennung des angemeldeten Autors — „eigen" hängt an ihr. */
  autorId: string;
  /** Der freigegebene Eintrag (`TITEL_FREI`). */
  freiId: string;
  /** Der offene Eintrag (`TITEL_OFFEN`). */
  offenId: string;
}

/**
 * Baut den Bestand, startet die echte App und öffnet die gebaute Oberfläche in Chromium.
 * `pfad` ist der Seitenpfad (z. B. `/bibliothek`); `:frei` darin wird durch die Kennung des
 * freigegebenen Eintrags ersetzt, `:offen` durch die des offenen.
 */
export async function h4Stand(
  pfad: string,
  email: string,
  vorbereiten?: (z: H4Vorbereitung) => Promise<void>,
): Promise<H4Stand> {
  if (!existsSync(join(DIST, "index.html"))) {
    throw new Error("apps/web/dist fehlt — vorher ./tools/build (im Tor läuft es immer)");
  }
  const services = buildServices();
  const app = buildApp(services);
  await app.ready();
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
  const me = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { authorization: `Bearer ${token}` },
  });
  const autorId = (me.json() as { id: string }).id;

  // Ein FREIGEGEBENER Eintrag mit Text, Quelle und Bild — das Gegenstück zur Vorlage.
  const frei = (await services.ko.create({
    title: TITEL_FREI,
    statement: ABSATZ_1,
    bodyHtml: `<p>${ABSATZ_1}</p><p>${ABSATZ_2}</p>`,
    type: "best_practice",
    category: BEREICH_FREI,
    author: autorId,
    neededValidations: 1,
    // Die Quelle wird beim Anlegen mitgegeben statt über `add-source` nachgereicht: die öffentliche
    // Aktion läuft gegen das Stufen-Tor (`EXTERNAL_ATTACH_BLOCKED`, hier gemessen), und dieses Tor
    // ist ausdrücklich richtig — es gehört zur Wahrheit des Produkts und wird nicht für einen Test
    // aufgeweicht. Der Bestandsweg der Erstanlage kennt `sources` (Import/Seed) und erzeugt genau
    // dieselbe Quelle am Objekt, die der Chip anzeigt.
    sources: [
      {
        id: "h4-quelle-1",
        label: QUELLE_LABEL,
        url: null,
        excerpt: null,
        kind: "document",
        peerValidated: false,
        author: autorId,
        at: new Date().toISOString(),
      },
    ],
  } as never)) as { id: string };
  const offen = (await services.ko.create({
    title: TITEL_OFFEN,
    statement: "Die Spritzzone wird nach jeder Schicht nass gereinigt.",
    type: "best_practice",
    category: "Produktion",
    author: autorId,
  } as never)) as { id: string };

  // Aktionen laufen über denselben Weg wie die Oberfläche: `PUT /api/kos/:id` mit `{action}`
  // (`api/endpoints.ts:323`). Kein Sonderpfad für den Test.
  // Die Freigabe läuft über denselben Weg wie die Oberfläche: `PUT /api/kos/:id` mit `{action}`
  // (`api/endpoints.ts:323`). Kein Sonderpfad für den Test.
  const freigabe = await app.inject({
    method: "PUT",
    url: `/api/kos/${frei.id}`,
    headers: { authorization: `Bearer ${token}` },
    payload: { action: "rate", verdict: "up" },
  });
  if (freigabe.statusCode >= 400) {
    throw new Error(
      `Bestand nicht herstellbar: Freigabe ${freigabe.statusCode} ${freigabe.body.slice(0, 200)}`,
    );
  }

  if (vorbereiten) {
    await vorbereiten({
      services,
      app,
      autorId,
      freiId: frei.id,
      offenId: offen.id,
    });
  }

  const require = createRequire(import.meta.url);
  const { chromium } = require("playwright") as {
    chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
  };
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
  });
  const seite = await browser.newPage({ viewport: { width: 1620, height: 900 } });
  const seitenfehler: string[] = [];
  const antworten: H4Stand["antworten"] = {};
  seite.on("pageerror", (e) => seitenfehler.push(String(e).split("\n")[0] ?? ""));
  await seite.addInitScript(
    `try { localStorage.setItem("kw.designTheme", "modern"); } catch (e) {}`,
  );
  await seite.route(`${ORIGIN}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname.startsWith("/api/")) {
      const h: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers())) {
        if (!["host", "origin", "referer", "cookie"].includes(k.toLowerCase())) h[k] = v;
      }
      h.authorization = `Bearer ${token}`;
      const body = req.postData();
      const res = await app.inject({
        method: req.method() as "GET",
        url: url.pathname + url.search,
        headers: h,
        ...(body !== null ? { payload: body } : {}),
      });
      await route.fulfill({
        status: res.statusCode,
        body: antworten.vorAuslieferung ? await antworten.vorAuslieferung(url, res.body) : res.body,
        headers: { "content-type": (res.headers["content-type"] as string) ?? "application/json" },
      });
      return;
    }
    const d = distDatei(url.pathname);
    await route.fulfill({ status: 200, body: d.body, contentType: d.typ });
  });
  await seite.goto(`${ORIGIN}${pfad.replace(":frei", frei.id).replace(":offen", offen.id)}`, {
    waitUntil: "load",
    timeout: 60_000,
  });
  await seite.waitForFunction(
    fn(`() => !!document.querySelector('[data-testid="bib-zeile"]')`),
    undefined,
    { timeout: 30_000 },
  );
  // Die Lesefläche holt ihren Eintrag in einem zweiten Zug — erst danach steht der Titel.
  await seite.waitForFunction(
    fn(`() => !!document.querySelector('[data-testid="bib-titel"]')`),
    undefined,
    { timeout: 30_000 },
  );
  const theme = await seite.evaluate<string>(
    fn(`() => document.documentElement.getAttribute('data-theme') || 'classic (kein Attribut)'`),
  );
  return {
    antworten,
    seite,
    browser,
    app,
    version: browser.version(),
    theme,
    koId: frei.id,
    koOffenId: offen.id,
    seitenfehler,
  };
}

// ==================================================================================================
// JOB 3576 · DIE SPRACHWAHL WOHNT IN DER VORRICHTUNG — EINMAL, HIER.
// ==================================================================================================
//
// WARUM HIER UND NICHT IN DEN TESTDATEIEN. Derselbe Griff wie bei der Tastatur (JOB 3564, `Seite`
// oben): `ortszeile-390px-browser.test.ts:21-29` hatte sich den Weg „Speicher setzen, neu laden,
// warten" selbst gebaut und behielt ihn bei sich. Der nächste Fall, der eine Sprache braucht
// (`h4-funktionsinventar.test.ts` F08/F08c), hätte ihn abgeschrieben — und die zweite Abschrift
// wäre die, die beim nächsten Umbau vergessen wird. Wer die Sprache für eine ANDERE Fläche braucht,
// erweitert den Warteschritt hier, statt sich einen zweiten Setzer zu bauen.
//
// ADDITIV: `h4Stand` bleibt unverändert und setzt von sich aus KEINE Sprache. Was ohne Zutun gilt,
// ist damit weiterhin die Vorgabe des Produkts (`lib/sprachwahl.ts:26`, `STANDARD_SPRACHE = "de"`)
// — gemessen am 11.09. an dieser Bühne: `<html lang>` „de", `kw.sprache` leer (null),
// `navigator.language` „en-US". Genau darum war das Funktionsinventar bis JOB 3576 grün, ohne je
// eine Sprache gewählt zu haben.

/** Der Speicherschlüssel der Sprachwahl des Produkts (`apps/web/src/lib/sprachwahl.ts:23`). */
const SPRACHE_SCHLUESSEL = "kw.sprache";

/** Wie lange auf die angewandte Sprache gewartet wird, bevor der Schritt aufgibt. */
const SPRACHE_FRIST_MS = 30_000;

/** In der Seite: die angewandte Sprache und, wenn sie da ist, die Texte der Ortszeile. */
const ORTSZEILE_LESEN = `() => {
  const zeile = document.querySelector('[data-testid="library-scope-bar"]');
  const gruppe = zeile ? zeile.querySelector('fieldset') : null;
  return {
    lang: document.documentElement.lang,
    da: !!zeile,
    label: gruppe ? gruppe.getAttribute('aria-label') : null,
    knoepfe: zeile ? [...zeile.querySelectorAll('button[aria-pressed]')].map((b) => (b.textContent || '').trim()) : [],
  };
}`;

/**
 * Die Sprachwahl des Produkts setzen, die Seite neu laden und warten, bis die Sprache WIRKLICH
 * angewandt ist.
 *
 * Der Rückkehrpunkt ist ein ZUSTAND und keine Frist (Lehre JOB 3152 T1b): gewartet wird, bis das
 * Produkt selbst sagt, dass es diese Sprache spricht (`<html lang>`, gesetzt von
 * `apps/web/src/lib/htmlLang.ts`) UND die Ortszeile gezeichnet ist. Ein `waitForTimeout` an dieser
 * Stelle wäre auf einem leeren Rechner zu lang und auf einem vollen zu kurz.
 *
 * GEWARTET WIRD AUSDRÜCKLICH NICHT AUF DIE ERWARTETEN BESCHRIFTUNGEN, so naheliegend das wäre. Ein
 * Setzer, der auf sie wartet, verwandelt JEDE falsche Beschriftung in eine Zeitüberschreitung —
 * und nimmt damit dem aufrufenden Fall die Aussage weg, die er treffen soll: er könnte nie mehr
 * mit „erwartet X, gefunden Y" rot werden. Gemessen, nicht befürchtet: mit einer verstellten
 * englischen Übersetzung (Gegenprobe R2) lief die erste Fassung 30 s in die Frist, statt F08c den
 * Vergleich zu überlassen. Der Setzer stellt die Lage her, der Fall urteilt.
 *
 * DREI AUSGÄNGE, alle mit dem, was ein Mensch zum Weiterkommen braucht:
 *   · die Seite meldet einen `pageerror` → Ende mit dessen Text (§9: keine Wartezeit verstreichen
 *     lassen, wenn die Fläche schon kaputt ist); gezählt werden nur NEUE Fehler dieses Schritts.
 *   · die Frist läuft ab, die Ortszeile stand aber da → erwartete Sprache, angewandte Sprache,
 *     zuletzt gelesener Text, Wartedauer.
 *   · die Frist läuft ab und die Ortszeile war nie da → dieselbe Meldung, zusätzlich als
 *     „lastabhaengig" gekennzeichnet (Lehre JOB 3138): dann ist die Seite nicht fertig geworden,
 *     und über die Sprache ist damit NICHTS gesagt.
 */
export async function spracheSetzen(
  stand: H4Stand,
  sprache: OrtszeileSprache,
  pfad = "/bibliothek",
): Promise<void> {
  const soll = ORTSZEILE_WORTE[sprache];
  const fehlerVorher = stand.seitenfehler.length;
  await stand.seite.evaluate(
    fn(
      "([schluessel, wert]) => { try { localStorage.setItem(schluessel, wert); } catch (e) {} return null; }",
    ),
    [SPRACHE_SCHLUESSEL, sprache],
  );
  await stand.seite.goto(`${ORIGIN}${pfad}`, { waitUntil: "load", timeout: 60_000 });
  const beginn = Date.now();
  let zuletzt: string | null = null;
  for (;;) {
    const neueFehler = stand.seitenfehler.slice(fehlerVorher);
    if (neueFehler.length > 0) {
      throw new Error(
        `Sprache ${sprache}: die Seite meldete einen Fehler statt der Ortszeile — ${neueFehler[0]}`,
      );
    }
    const gelesen = await stand.seite.evaluate<{
      lang: string;
      da: boolean;
      label: string | null;
      knoepfe: string[];
    }>(fn(ORTSZEILE_LESEN));
    if (gelesen.da) {
      zuletzt = `lang=${gelesen.lang} · ${gelesen.label} · ${gelesen.knoepfe.join(" · ")}`;
      if (gelesen.lang === sprache) {
        return;
      }
    }
    if (Date.now() - beginn >= SPRACHE_FRIST_MS) {
      break;
    }
    await stand.seite.waitForTimeout(100);
  }
  const gewartet = Date.now() - beginn;
  const kopf = `Sprache ${sprache}: nach ${gewartet} ms`;
  const erwartet = `erwartet <html lang="${sprache}"> und die Ortszeile (${soll.label} · ${soll.meine} · ${soll.alle})`;
  // Die Lage entscheidet über die Aussage: stand die Zeile nie da, ist NICHTS über die Sprache
  // gesagt — dann ist die Umgebung nicht fertig geworden und nicht das Produkt falsch.
  const lastabhaengig = "lastabhaengig: die Seite ist nicht fertig geworden";
  throw new Error(
    zuletzt === null
      ? `${kopf} war die Ortszeile überhaupt nicht da (${erwartet}) — ${lastabhaengig}, über die Sprache ist damit nichts gesagt.`
      : `${kopf} hat die Seite die Sprache nicht angewandt (${erwartet}, zuletzt gelesen „${zuletzt}").`,
  );
}

/** In der Seite: CSS-Pfad eines Elements (nth-child-Kette bis body) — der Selektor als Beleg. */
export const PFAD_FN = `(el) => {
  const teile = [];
  let e = el;
  while (e && e.nodeType === 1 && e !== document.body) {
    const p = e.parentElement;
    const i = Array.prototype.indexOf.call(p.children, e) + 1;
    teile.unshift(e.tagName.toLowerCase() + ':nth-child(' + i + ')');
    e = p;
  }
  return 'body > ' + teile.join(' > ');
}`;

export const LESEN =
  "([sel, eig]) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).getPropertyValue(eig) : null; }";
