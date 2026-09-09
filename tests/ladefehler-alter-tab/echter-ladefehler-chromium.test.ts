// ================================================================================================
// JOB 3423 · NAVIGATION-CHUNK-STAND — WAS DER ECHTE BROWSER WIRKLICH WIRFT.
// ================================================================================================
//
// DIE LÜCKE, DIE PEDIS FALL GEFUNDEN HAT (09.09.2026 20:4x, Kanalnachricht 9fd43ca7): Der seit
// Stunden offene Tab klickte auf „Duplikate", und statt der ruhigen Neu-laden-Karte stand die rote
// Karte da: „This view could not be loaded … Failed to fetch dynamically imported module:
// https://app.klarwerk.ai/assets/Duplicates-CIbJ3zEu.js".
//
// CODEX' AUSLIEFERUNGSBEFUND (09.09. 20:47, Kanalnachricht 266e12e2): genau dieses Stück antwortet
// HTTP 404 mit `text/plain`; `GET /` antwortet 200 und verweist auf `Duplicates-ChRHrS-8.js` — ein
// anderer Name. Der Tab hält einen alten Stand. Das ist der Normalzustand nach einer
// Veröffentlichung, kein Fehler der Auslieferung.
//
// WARUM ES DIESEN PRÜFSTAND BRAUCHT, obwohl A3 in `ladefehler-zeigt-neue-version.test.tsx` bereits
// „den echten Weg" fährt: A3 misst den WEG (`lazy()` → `<Suspense>` → Fehlergrenze) und BAUT sich
// das Fehlerobjekt dazu selbst. Was der Browser in dieser Lage wirklich wirft — welchen `name`,
// welche `message` —, stand nirgends im Bestand. Ein Erkenner, der auf `name === "TypeError"`
// besteht (`lib/staleChunk.ts:34`), hängt aber genau daran. jsdom kann das nicht beantworten: es
// führt keine Modul-Skripte aus und hat keinen Netzstapel.
//
// WAS HIER LÄUFT: ein echtes Chromium, eine Seite mit einem echten `<script type="module">`, darin
// echte `import()`-Aufrufe auf vier Adressen, die so antworten, wie ein Server nach einer
// Veröffentlichung wirklich antwortet — darunter Codex' gemessener Fall (404, `text/plain`).
// Gelesen werden `name`, `message`, die Konstruktorkette und `instanceof Error`.
//
// M1  Die vier Lagen erzeugen genau die Paare, die `gemessene-browserfehler.ts` festhält (Pin:
//     ändert ein Browser-Update den Wortlaut, wird diese Datei rot, statt dass die Erkennung
//     still danebengreift).
// M2  Jedes gemessene Objekt ist ein echtes `Error` — die erste Bedingung von `isStaleChunkError`.
// M3  Die ENTSCHEIDUNG: jedes gemessene Objekt gilt der Erkennung als veralteter Stand. Das ist
//     der Fall, der vor JOB 3423 durchfiel.
// M4  Gegenprobe im SELBEN Lauf: ein erfolgreicher Import wirft nicht.
import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { isStaleChunkError } from "../../apps/web/src/lib/staleChunk";
import {
  ADRESSE_PLATZHALTER,
  type Browserfehler,
  GEMESSENE_LADEFEHLER,
  MESSADRESSE,
} from "./gemessene-browserfehler";

// `localhost` und nicht ein Phantasiename: nur dort führt Chromium einen sicheren Kontext — die
// Begründung steht ausführlich in `tests/design/h3-blatt-buehne.ts`. Es wird KEIN Socket geöffnet;
// alle Antworten kommen aus `page.route` (dieselbe Bauart wie
// `tests/d1-meine-entwuerfe/zugang-schmal-chromium.test.ts`).
const ORIGIN = "http://localhost";

/** Die vier Lagen, je mit der Antwort, die der Server gibt. Reihenfolge = Reihenfolge im Pin. */
const LAGEN = [
  { pfad: "/assets/Duplicates-CIbJ3zEu.js", status: 404, typ: "text/plain", body: "Not Found" },
  { pfad: "/assets/Duplicates-404html.js", status: 404, typ: "text/html", body: "<h1>404</h1>" },
  { pfad: "/assets/Duplicates-spa.js", status: 200, typ: "text/html", body: "<!doctype html><p>" },
  { pfad: "/assets/Duplicates-abbruch.js", status: 0, typ: "", body: "" },
] as const;

/** Der Pfad, der wirklich ein Modul liefert — die Gegenprobe M4. */
const HEILER_PFAD = "/assets/Duplicates-heil.js";

interface Route {
  request(): { url(): string };
  fulfill(r: { status: number; body: string; contentType?: string }): Promise<void>;
  abort(grund?: string): Promise<void>;
}
interface Seite {
  route(url: string, handler: (route: Route) => Promise<void>): Promise<void>;
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  waitForFunction(f: string, arg?: unknown, opts?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(f: string): Promise<T>;
}
interface Browser {
  version(): string;
  newPage(opts?: Record<string, unknown>): Promise<Seite>;
  close(): Promise<void>;
}

/** Was aus dem Browser zurückkommt — roh, ohne Deutung. */
interface Messwert {
  pfad: string;
  geworfen: boolean;
  name: string | null;
  message: string | null;
  ctor: string | null;
  istError: boolean;
  tag: string;
}

/**
 * Die Seite. Ein Modul-Skript, das die Adressen der Reihe nach lädt und den abgelehnten Wert
 * ausliest. Bewusst `String(e && e.name)` statt einer Serialisierung: `Error` überlebt
 * `structuredClone`/JSON nicht verlustfrei, und gelesen werden genau die Felder, die
 * `isStaleChunkError` liest.
 */
function seitenQuelle(pfade: readonly string[]): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>JOB 3423</title></head><body>
<script type="module">
const PFADE = ${JSON.stringify(pfade)};
window.__befund = [];
window.__fertig = false;
(async () => {
  for (const pfad of PFADE) {
    try {
      await import(pfad);
      window.__befund.push({ pfad, geworfen: false, name: null, message: null, ctor: null, istError: false, tag: "" });
    } catch (e) {
      window.__befund.push({
        pfad,
        geworfen: true,
        name: e && e.name !== undefined ? String(e.name) : null,
        message: e && e.message !== undefined ? String(e.message) : null,
        ctor: e && e.constructor ? String(e.constructor.name) : null,
        istError: e instanceof Error,
        tag: Object.prototype.toString.call(e),
      });
    }
  }
  window.__fertig = true;
})();
</script></body></html>`;
}

let browser: Browser | null = null;
let seite: Seite | null = null;
let chromiumVersion = "";
let aufbaufehler: string | null = null;
let messwerte: Messwert[] = [];

beforeAll(async () => {
  try {
    const verlangeModul = createRequire(import.meta.url);
    const { chromium } = verlangeModul("playwright") as {
      chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
    };
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
    });
    chromiumVersion = browser.version();
    seite = await browser.newPage();
    const pfade = [...LAGEN.map((l) => l.pfad), HEILER_PFAD];
    await seite.route(`${ORIGIN}/**`, async (route) => {
      const pfadname = new URL(route.request().url()).pathname;
      if (pfadname === "/" || pfadname === "/index.html") {
        await route.fulfill({
          status: 200,
          contentType: "text/html; charset=utf-8",
          body: seitenQuelle(pfade),
        });
        return;
      }
      if (pfadname === HEILER_PFAD) {
        await route.fulfill({
          status: 200,
          contentType: "application/javascript",
          body: "export const heil = 1;",
        });
        return;
      }
      const lage = LAGEN.find((l) => l.pfad === pfadname);
      if (lage === undefined) {
        await route.fulfill({ status: 404, contentType: "text/plain", body: "unbekannt" });
        return;
      }
      if (lage.status === 0) {
        await route.abort("failed");
        return;
      }
      await route.fulfill({ status: lage.status, contentType: lage.typ, body: lage.body });
    });
    await seite.goto(`${ORIGIN}/`, { waitUntil: "load" });
    // AUSDRUCK, KEINE FUNKTION: Playwright wertet eine Zeichenkette als AUSDRUCK aus. `"() => …"`
    // ergibt ein Funktionsobjekt — wahrheitswertig ab dem ersten Versuch, und der Lauf las die Liste
    // mitten in der Schleife (gemessen: vier statt fünf Werten, 09.09. Lauf 2803d6f6).
    await seite.waitForFunction("window.__fertig === true", undefined, { timeout: 30_000 });
    messwerte = await seite.evaluate<Messwert[]>("window.__befund");
  } catch (e) {
    aufbaufehler = String(e).split("\n").slice(0, 4).join(" | ");
  }
}, 180_000);

afterAll(async () => {
  await browser?.close();
}, 60_000);

/** Der Messwert zu einer Lage — und eine klare Meldung, wenn der Aufbau gar nicht stand. */
function messwert(index: number): Messwert {
  expect(aufbaufehler, "der Chromium-Prüfstand kam nicht zustande").toBeNull();
  const wert = messwerte[index];
  if (wert === undefined) {
    throw new Error(
      `Messwert ${index} fehlt — gemessen wurden ${messwerte.length} Lagen: ${JSON.stringify(messwerte)}`,
    );
  }
  return wert;
}

/** Die gemessene `message` mit der Adresse als Platzhalter — so ist sie vergleichbar. */
function ohneAdresse(message: string | null, pfad: string): string {
  return (message ?? "").split(`${ORIGIN}${pfad}`).join(ADRESSE_PLATZHALTER);
}

describe("JOB 3423 · was Chromium bei einem weggeräumten Chunk wirklich wirft", () => {
  it("M1: die vier Lagen erzeugen genau die festgehaltenen name/message-Paare", () => {
    const gemessen: Browserfehler[] = LAGEN.map((lage, i) => {
      const wert = messwert(i);
      return {
        lage: GEMESSENE_LADEFEHLER[i]?.lage ?? lage.pfad,
        antwort:
          lage.status === 0 ? "abgebrochen (ERR_FAILED)" : `HTTP ${lage.status}, ${lage.typ}`,
        name: wert.name ?? "(kein name)",
        message: ohneAdresse(wert.message, lage.pfad),
      };
    });

    expect(
      gemessen.map((g) => `${g.name} · ${g.message}`),
      `Chromium ${chromiumVersion} wirft andere Paare als festgehalten — die Rohmessung lautet: ${JSON.stringify(messwerte)}`,
    ).toEqual(GEMESSENE_LADEFEHLER.map((g) => `${g.name} · ${g.message}`));
  });

  it("M2: jeder gemessene Wert ist ein echtes Error-Objekt", () => {
    for (const [i, lage] of LAGEN.entries()) {
      const wert = messwert(i);
      expect(wert.geworfen, `${lage.pfad}: der Import hat gar nicht abgelehnt`).toBe(true);
      expect(wert.istError, `${lage.pfad}: kein Error — ${wert.tag} (${wert.ctor})`).toBe(true);
    }
  });

  it("M3: die Erkennung hält jedes gemessene Objekt für einen veralteten Stand", () => {
    for (const [i, lage] of LAGEN.entries()) {
      const wert = messwert(i);
      const nachgebaut = new TypeError(wert.message ?? "");
      nachgebaut.name = wert.name ?? "Error";
      expect(
        isStaleChunkError(nachgebaut),
        `${lage.pfad} (${wert.name}: ${wert.message}) fällt durch isStaleChunkError — genau hier bekam Pedi am 09.09. die generische Fehlerkarte`,
      ).toBe(true);
    }
  });

  it("M4: ein Stück, das es noch gibt, lädt ohne Fehler", () => {
    const wert = messwert(LAGEN.length);
    expect(wert.pfad).toBe(HEILER_PFAD);
    expect(wert.geworfen, `ein heiles Modul warf: ${wert.name}: ${wert.message}`).toBe(false);
  });

  it("M5: die Messadresse der Nachbauten ist die, die hier wirklich angefragt wurde", () => {
    expect(MESSADRESSE).toBe(`${ORIGIN}${LAGEN[0].pfad}`);
  });
});
