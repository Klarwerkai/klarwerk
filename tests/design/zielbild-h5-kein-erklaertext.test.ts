// ================================================================================================
// JOB 3064 · H5 — DER TEXTMESSER: AUF START UND FRAGEN STEHT KEIN ERKLÄRTEXT MEHR.
// ================================================================================================
//
// PEDI, 04.09. 06:50, über die Startseite: „Text über Text über Text … Absolut unmöglich."
// Der Auftrag macht daraus eine ZAHL (§8): der sichtbare Text der Fläche, ABZÜGLICH dessen, was
// Inhalt ist (Überschrift, Zeilen, Kicker, Knopfbeschriftungen — auf `/fragen` Frage, Antwort,
// Chips, Knöpfe), darf 40 Zeichen nicht überschreiten.
//
// WARUM `innerText` UND NICHT `textContent`: `innerText` ist der Text, den ein MENSCH sieht. Was
// hinter `hidden` liegt (die Menü-Blätter, das Info-Blatt „Mehr", der Erklärsatz am Info-Symbol),
// zählt nicht mit — genau richtig, denn diese Inhalte sind nicht verschwunden, sie sind an einem
// benannten Ort. Dass jeder dieser Orte wirklich trägt, misst `h5-funktionsinventar.test.ts`; die
// beiden Tests sind zwei Hälften EINER Zusage und nur zusammen aussagekräftig.
//
// DER ABZUG IST STRUKTURELL, NICHT AUFGEZÄHLT. Abgezogen werden ROLLEN, keine Wortlaute:
//   · die Überschrift (`main h1`)
//   · jede Zeile und jeder Kicker der zwei Karten (`[data-h5-zeile]`, `[data-h5-kicker]`)
//   · jede Knopf- und Linkbeschriftung (`button`, `a`)
//   · auf `/fragen`: die Fragezeile und die Antwortkarte (Chips und Knöpfe liegen darin)
// Ein neuer Satz kann sich deshalb nicht dadurch retten, dass er in die Liste aufgenommen wird —
// er müsste eine Zeile, ein Kicker oder eine Beschriftung WERDEN.
//
// DIE KALIBRIERUNG steht in derselben Datei und ist keine Nebensache: ein eingefügter Hinweissatz
// muss die Messung ROT machen. Ohne sie wäre „≤ 40" auch dann grün, wenn der Abzug alles frisst.
//
// EINE BENANNTE GRENZE: die Rechts-Fußzeile (`legal-footer`) rendert die App-Hülle INNERHALB von
// `<main>` (`shell/AppShell.tsx`). Sie gehört zu JOB H1 und nicht zu dieser Fläche (§10); sie wird
// deshalb abgezogen — und der Abzug ist hier benannt, nicht versteckt.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import { buildApp, buildServices } from "../../services/app/src/build-app";

const WURZEL = resolve(process.cwd());
const DIST = resolve(WURZEL, "apps/web/dist");
const ORIGIN = "http://klarwerk.test";
/** §8 des Auftrags: der Rest darf 40 Zeichen nicht überschreiten. */
const GRENZE = 40;
const FRAGE = "Welche Profile sind in Spritzzonen erlaubt?";

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

/**
 * In der Seite: der sichtbare Text von `<main>` abzüglich der INHALTSROLLEN.
 * `zusatz` nennt die Rollen, die nur auf `/fragen` gelten (Fragezeile, Antwortkarte).
 */
const MESSEN = `(zusatzSelektoren) => {
  const main = document.querySelector('main');
  if (!main) return null;
  const roh = main.innerText || '';
  const rollen = ['h1', '[data-h5-zeile]', '[data-h5-kicker]', 'button', 'a', '[data-testid="legal-footer"]'].concat(zusatzSelektoren);
  const abzug = [];
  for (const sel of rollen) {
    for (const el of main.querySelectorAll(sel)) {
      const t = (el.innerText || '').trim();
      if (t) abzug.push(t);
    }
  }
  // Längste zuerst: sonst schneidet ein kurzer Teilstring (die Ziffer einer Meta-Zeile) den
  // längeren auseinander und der Rest bliebe künstlich klein.
  abzug.sort((a, b) => b.length - a.length);
  let rest = roh;
  for (const t of abzug) rest = rest.split(t).join('');
  return { roh: roh.replace(/\\s+/g, ' ').trim(), rest: rest.replace(/\\s+/g, ' ').trim(), abzuege: abzug.length };
}`;
/** Die Kalibrierung: EIN zusätzlicher Satz, der keine Zeile, kein Kicker und kein Knopf ist. */
const EINFUEGEN = `(satz) => {
  const main = document.querySelector('main');
  const p = document.createElement('p');
  p.id = 'h5-kalibrierung';
  p.textContent = satz;
  main.firstElementChild.appendChild(p);
  return true;
}`;
const ENTFERNEN = `() => { const p = document.getElementById('h5-kalibrierung'); if (p) p.remove(); return !document.getElementById('h5-kalibrierung'); }`;

interface Messung {
  roh: string;
  rest: string;
  abzuege: number;
}

function distDatei(pfadname: string): { body: Buffer; typ: string } {
  const rel = pfadname === "/" ? "/index.html" : pfadname;
  const datei = join(DIST, rel);
  if (existsSync(datei) && statSync(datei).isFile()) {
    return { body: readFileSync(datei), typ: MIME[extname(datei)] ?? "application/octet-stream" };
  }
  return { body: readFileSync(join(DIST, "index.html")), typ: MIME[".html"] ?? "text/html" };
}

describe("JOB 3064 · H5 · der Textmesser — kein Erklärtext im Sichtfeld von /start und /fragen", () => {
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
        payload: { name: "Pedi", email: "pedi@job3064t.test", password: "geheim12345" },
      });
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "pedi@job3064t.test", password: "geheim12345" },
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
      // Zwei weitere Objekte, damit „FÜR DICH" wirklich Zeilen traegt.
      for (const title of ["Halterungen ohne waagerechte Oberseiten", "Reinigung Spritzzone"]) {
        await services.ko.create({
          title,
          statement: "Aus dem Projekt gelernt, noch nicht freigegeben.",
          type: "best_practice",
          category: "Allgemein",
          author: autorId,
        } as never);
      }

      const require = createRequire(import.meta.url);
      const { chromium } = require("playwright") as {
        chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
      };
      browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
      });
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
          // Dieselbe eine gesetzte Auskunft wie in `zielbild-h5-fragen.test.ts` (dort begruendet):
          // ohne verdrahtetes Modell graut D-AISTATE den Sendeknopf hart aus, und es gaebe auf
          // `/fragen` nie eine Antwort zu messen. Gesetzt wird die VERFUEGBARKEIT, nie die Antwort.
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
    await s.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="h5-fuerdich-zeile"]')`),
      undefined,
      { timeout: 30_000 },
    );
  }
  async function aufFragen(): Promise<void> {
    const s = seite as Seite;
    await s.goto(`${ORIGIN}/fragen`, { waitUntil: "load", timeout: 60_000 });
    await s.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="page-fragen"] form input')`),
      undefined,
      { timeout: 30_000 },
    );
    await s.fill('[data-testid="page-fragen"] form input', FRAGE);
    await s.click('[data-testid="page-fragen"] form button[type="submit"]');
    await s.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="ask-answer"] .ask-answer-body')`),
      undefined,
      { timeout: 60_000 },
    );
  }
  const messen = async (zusatz: string[]): Promise<Messung> =>
    (seite as Seite).evaluate<Messung>(fn(MESSEN), zusatz);

  it("T1 · /start: der Rest neben Überschrift, Zeilen, Kickern und Knöpfen ist ≤ 40 Zeichen", async () => {
    expect(fehler, "Seite nicht gemountet").toBeNull();
    await aufStart();
    const m = await messen([]);
    console.info(
      `JOB 3064 H5 · T1 · /start · roh (${m.roh.length}): „${m.roh}“ · ${m.abzuege} Abzüge · REST (${m.rest.length}): „${m.rest}“`,
    );
    // Kalibrierung: die Seite trägt überhaupt sichtbaren Text — sonst wäre „≤ 40" trivial.
    expect(
      m.roh.length,
      "die Startseite ist leer — die Messung wäre bedeutungslos",
    ).toBeGreaterThan(60);
    expect(m.rest.length, `Erklärtext auf /start: „${m.rest}“`).toBeLessThanOrEqual(GRENZE);
  });

  it("T2 · KALIBRIERUNG /start: EIN eingefügter Hinweissatz macht die Messung rot", async () => {
    expect(fehler).toBeNull();
    await aufStart();
    const satz =
      "Klarwerk sammelt Erfahrungswissen und zeigt dir, woher jede Antwort stammt — bitte prüfe die Quellen.";
    await (seite as Seite).evaluate<boolean>(fn(EINFUEGEN), satz);
    const mit = await messen([]);
    expect(
      mit.rest.length,
      "ein zusätzlicher Satz bleibt unbemerkt — der Messer misst nichts",
    ).toBeGreaterThan(GRENZE);
    expect(mit.rest).toContain("Klarwerk sammelt Erfahrungswissen");
    // Zurückgenommen: die Fläche steht danach wieder wie vorher.
    expect(await (seite as Seite).evaluate<boolean>(fn(ENTFERNEN))).toBe(true);
    const ohne = await messen([]);
    expect(ohne.rest.length).toBeLessThanOrEqual(GRENZE);
  });

  // ==============================================================================================
  // DIE ABZÜGE AUF `/fragen` — EINZELN BENANNT, NIEMALS DIE GANZE ANTWORTKARTE.
  // ==============================================================================================
  // KORREKTURPFLICHT 5 (Ben, Runde 3): bis dahin stand hier `[data-testid="ask-answer"]`, also die
  // KOMPLETTE Karte. Damit war jeder Erklärsatz INNERHALB der Karte unsichtbar für diesen Messer —
  // die Zusage „kein Erklärtext im Sichtfeld" hätte die eine Stelle nicht gedeckt, an der sie am
  // ehesten verletzt würde. Abgezogen wird ab hier, was §8 des Auftrags nennt, Rolle für Rolle:
  //   · die gestellte Frage (`ask-fragezeile`)
  //   · der Antworttext selbst (`.ask-answer-body`)
  //   · die einzelnen Quellen-Chips (`ask-quellen-chip`; sie sind `<a>` und damit ohnehin dabei —
  //     ausdrücklich genannt, damit der Abzug nicht an ihrer Bauform hängt)
  //   · Knöpfe und Verweise (`button`, `a`, oben in `MESSEN`)
  //
  // EINE BENANNTE AUSNAHME, die §8 nicht aufzählt und die trotzdem stehen bleibt: die
  // KI-Kennzeichnung `ai-generated-notice` („Von künstlicher Intelligenz erzeugt — bitte fachlich
  // prüfen.", `AI_GENERATED_NOTICE_KEY`). Sie ist kein Erklärtext, sondern eine Pflichtangabe an
  // der erzeugten Ausgabe (Artikel 50, eingeführt in mega61 Block E, im Druckbereich gehalten von
  // D-047). Sie zu entfernen, um diese Messung grün zu bekommen, hiesse eine Rechtspflicht gegen
  // eine Gestaltungsregel zu tauschen. Sie wird deshalb ABGEZOGEN UND HIER GENANNT — nicht still
  // mitsubtrahiert, indem man die ganze Karte wegnimmt. Der Unterschied ist der ganze Punkt.
  const ZUSATZ_FRAGEN = [
    '[data-testid="ask-fragezeile"]',
    ".ask-answer-body",
    '[data-testid="ask-quellen-chip"]',
    '[data-testid="ai-generated-notice"]',
  ];

  it("T3 · /fragen nach einer Antwort: der Rest neben Frage, Antwort, Chips und Knöpfen ist ≤ 40 Zeichen", async () => {
    expect(fehler).toBeNull();
    await aufFragen();
    const m = await messen(ZUSATZ_FRAGEN);
    console.info(
      `JOB 3064 H5 · T3 · /fragen · roh (${m.roh.length}) · ${m.abzuege} Abzüge · REST (${m.rest.length}): „${m.rest}“`,
    );
    expect(
      m.roh.length,
      "die Fragenfläche ist leer — die Messung wäre bedeutungslos",
    ).toBeGreaterThan(60);
    expect(m.rest.length, `Erklärtext auf /fragen: „${m.rest}“`).toBeLessThanOrEqual(GRENZE);
  });

  it("T3b · DER FANG: ein Erklärsatz INNERHALB der Antwortkarte macht die Messung rot", async () => {
    // Genau der Fall, den der alte Abzug „ganze Karte" durchgelassen hätte — Bens Befund. Ohne
    // diesen Fall bewiese T3 nur, dass NEBEN der Karte nichts steht.
    expect(fehler).toBeNull();
    await aufFragen();
    const satz =
      "Diese Antwort beruht auf dem geprüften Bestand; Status und Vertrauen entscheiden über ihre Nutzbarkeit.";
    const eingefuegt = await (seite as Seite).evaluate<boolean>(
      fn(
        `(s) => { const k = document.querySelector('[data-testid="ask-answer"]'); if (!k) return false;
           const p = document.createElement('p'); p.id = 'h5-kalibrierung'; p.textContent = s;
           k.appendChild(p); return true; }`,
      ),
      satz,
    );
    expect(eingefuegt, "die Antwortkarte steht nicht — der Fang misst nichts").toBe(true);
    const mit = await messen(ZUSATZ_FRAGEN);
    expect(
      mit.rest.length,
      `ein Erklärsatz in der Karte blieb unbemerkt — REST: „${mit.rest}“`,
    ).toBeGreaterThan(GRENZE);
    // Zurückgenommen: die Fläche steht danach wieder wie vorher.
    expect(await (seite as Seite).evaluate<boolean>(fn(ENTFERNEN))).toBe(true);
    expect((await messen(ZUSATZ_FRAGEN)).rest.length).toBeLessThanOrEqual(GRENZE);
  });

  it("T4 · KALIBRIERUNG /fragen: EIN eingefügter Hinweissatz macht die Messung rot", async () => {
    expect(fehler).toBeNull();
    await aufFragen();
    const satz =
      "Antworten kommen ausschliesslich aus dem geprüften Bestand; prüfe die genannten Quellen selbst.";
    await (seite as Seite).evaluate<boolean>(fn(EINFUEGEN), satz);
    const mit = await messen(ZUSATZ_FRAGEN);
    expect(mit.rest.length).toBeGreaterThan(GRENZE);
    expect(await (seite as Seite).evaluate<boolean>(fn(ENTFERNEN))).toBe(true);
    expect((await messen(ZUSATZ_FRAGEN)).rest.length).toBeLessThanOrEqual(GRENZE);
  });

  it("T5 · die verschobenen Inhalte sind NICHT verschwunden: der Griff „…“ → „Mehr“ holt sie hervor", async () => {
    // Der Gegenbeweis zur Zusage oben — und der Grund, warum „≤ 40 Zeichen" kein Streichen belegt.
    //
    // NACHGEFÜHRT NACH KORREKTURPFLICHT 2 (Ben, Runde 3), und dabei SCHÄRFER geworden: bis dahin
    // stand die Einordnung als `hidden`-Block dauerhaft im DOM, und dieser Fall prüfte genau das
    // („vorhanden, aber hidden"). Das Seitenblatt wird jetzt bedingt gerendert — zu heisst NICHT
    // im Baum. „Vorhanden" wäre damit kein Beleg mehr, sondern eine Selbsttäuschung.
    // Der Umzug wird deshalb am WEG belegt: zu → die Einordnung ist nirgends; nach dem Griff
    // „…" → „Mehr" steht sie sichtbar im Blatt. Wäre sie gestrichen, bliebe der zweite Teil rot.
    expect(fehler).toBeNull();
    await aufFragen();
    const s = seite as Seite;

    // ZU: das Blatt hängt nicht im Baum, und der Seitentext von `main` steht fest.
    const zu = await s.evaluate<{ blattDa: boolean; text: string }>(
      fn(
        `() => ({ blattDa: !!document.querySelector('[data-testid="ask-mehr-antwort"]'), text: ((document.querySelector('main') || {}).innerText || '').replace(/\\s+/g, ' ') })`,
      ),
    );
    expect(zu.blattDa, "das Blatt ist zu — dann misst T3 etwas anderes").toBe(false);

    // AUF: derselbe Weg, den ein Mensch nimmt.
    await s.click('[data-testid="ask-menu"]');
    await s.click('[data-testid="ask-menu-punkt-mehr"]');
    await s.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="ask-mehr-antwort"]')`),
      undefined,
      { timeout: 10_000 },
    );
    // Die Nadel kommt aus der Fläche selbst (die Vertragszeile), nicht aus einer Abschrift.
    const auf = await s.evaluate<{ nadel: string; imBlatt: boolean }>(
      fn(
        `() => { const z = document.querySelector('[data-testid="ask-contract-line"]'); const nadel = ((z || {}).innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 20); const blatt = document.querySelector('[data-testid="ask-mehr"]'); return { nadel, imBlatt: !!nadel && ((blatt || {}).innerText || '').replace(/\\s+/g, ' ').includes(nadel) }; }`,
      ),
    );
    console.info(
      `JOB 3064 H5 · T5 · /fragen · zu ${JSON.stringify(zu.blattDa)} · Nadel „${auf.nadel}" · im Blatt ${auf.imBlatt}`,
    );
    expect(auf.nadel.length, "die Vertragszeile fehlt im Blatt").toBeGreaterThan(0);
    expect(auf.imBlatt, "die Einordnung ist gestrichen statt umgezogen").toBe(true);
    // … und GENAU DIESE Nadel stand vorher nicht im Sichtfeld.
    expect(zu.text.includes(auf.nadel), "die Einordnung stand schon vorher im Sichtfeld").toBe(
      false,
    );
  });
});
