// ================================================================================================
// CHROME-ERFASSEN-EINFUEGEN — DIE SCHMALE LEISTE MIT LANGER VORSCHAU, IN CHROMIUM GEMESSEN.
// ================================================================================================
//
// DIE LÜCKE: `tests/klara-browser-bedienung/kompakte-flaeche.test.ts` prüft die Kompaktregeln als
// Text in `panel.css`/`panel.html` und sagt selbst (`:23-26`), dass sie KEINE Geometrie rechnet.
// Ob Speichern und Verwerfen bei langer Vorschau, schmaler Leiste, geöffneten Details und
// sichtbaren Warnungen wirklich im Bild und anklickbar sind, hat bisher kein Browser gemessen.
//
// WAS ECHT IST: die ausgelieferten Dateien `panel.html`, `panel.css`, `i18n.js` und `panel.js` aus
// `extensions/klara-browser/`, unverändert in Chromium geladen, mit Chromiums Layout. Playwright
// liefert sie unter einer Testadresse aus; die Seite holt sich nichts von anderswo.
//
// WAS GESTELLT IST, und nur das: `chrome.runtime.sendMessage` antwortet mit EINER festen Ansicht,
// wie sie der Worker für eine lange Übernahme liefert (120 Absätze, fünf Lücken, Bildhinweis,
// KI-Chat-Kennzeichen, Hinweis „Tab gewechselt"), und zeichnet jede Nachricht auf. Der Worker
// selbst läuft hier nicht — seinen Weg prüfen `tests/klara-browser/**` und
// `einfuegen-rennen.test.ts`.
//
// WAS GEMESSEN WIRD, je Fenstergröße einer Chrome-Seitenleiste (320×560 und 400×800):
//   G0  KALIBRIERUNG: die Vorschau ist wirklich lang — Inhaltsfeld und Leiste haben Überhang.
//   G1  Speichern und Verwerfen liegen bei Leiste oben, in der Mitte und unten VOLL im Fenster,
//       sind nicht ausgeblendet und werden an ihrer Mitte getroffen (`elementFromPoint`) — mit
//       geöffneten Details und geöffnetem Kontokasten.
//   G2  Jede konkrete Warnung ist sichtbar und durch Scrollen erreichbar, nicht hinter einem Klick.
//   G3  BEDIENT, nicht nur gemessen: Bestätigung und Speichern werden per Playwright-Klick (mit
//       Sicht- und Trefferprüfung) ausgelöst, bei Leiste ganz oben; die Speichernachricht trägt die
//       Kennung dieser Übernahme.
//
// NICHT GEMESSEN: die echte Seitenleiste von Chrome (Symbol → `sidePanel.open`), die installierte
// Erweiterung, Lesbarkeit/Kontrast und die englische Fassung. Das bleibt der Abnahme mit echter
// Erweiterung vorbehalten.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, resolve, sep } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type BrowserFn = (arg: unknown) => unknown;
const fn = (quelle: string): BrowserFn =>
  new Function("arg", `return (${quelle})(arg);`) as BrowserFn;

interface Route {
  request(): { url(): string };
  fulfill(r: { status: number; body: string | Buffer; contentType?: string }): Promise<void>;
}
interface Seite {
  route(url: string, handler: (route: Route) => Promise<void>): Promise<void>;
  addInitScript(script: string): Promise<void>;
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  waitForFunction(fn: BrowserFn, arg?: unknown, opts?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(fn: BrowserFn, arg?: unknown): Promise<T>;
  click(selector: string, opts?: Record<string, unknown>): Promise<void>;
  close(): Promise<void>;
}
interface Browser {
  version(): string;
  newPage(opts: Record<string, unknown>): Promise<Seite>;
  close(): Promise<void>;
}

const PAKET = resolve("extensions/klara-browser");
const ORIGIN = "http://klara-leiste.test";
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

/** Die Ansicht einer LANGEN Übernahme — dieselbe Gestalt, die `view()` im Worker liefert. */
const ANSICHT_SKRIPT = `(() => {
  const absatz = (i) => ({ tag: "p", children: [{ tag: "#text", text: "Absatz " + i + ": " + "Langer übernommener Text aus einer technischen Anleitung. ".repeat(10) }] });
  const lang = Array.from({ length: 120 }, (_, i) => absatz(i + 1));
  const leer = { available: false, text: "", nodes: [], gaps: [], images: 0 };
  const voll = { available: true, text: "x".repeat(60000), nodes: lang, gaps: [], images: 2 };
  const ansicht = {
    status: "preview",
    captureId: "leiste-lang-1",
    user: { id: "person-a", email: "a@example.test" },
    selection: { text: "x".repeat(60000), url: "https://www.perplexity.ai/search/" + "sehr-lange-adresse-".repeat(8), title: "Ein sehr langer Seitentitel, der in einer schmalen Leiste umbrechen muss, ".repeat(2), capturedAt: "2026-10-05T10:00:00.000Z", tabId: 7 },
    variants: { selection: voll, article: voll, page: voll, clipboard: leer },
    mode: "selection",
    aiChat: true,
    preview: lang,
    gaps: [
      { kind: "image_blocked", detail: "https://cdn.example.test/bild-1.png" },
      { kind: "image_blocked", detail: "https://cdn.example.test/bild-2.png" },
      { kind: "embedded", detail: "https://video.example.test/einbettung" },
      { kind: "dynamic", detail: "" },
      { kind: "truncated", detail: "250000" },
    ],
    form: { title: "Lange Anleitung", context: "", confidentiality: "", origin: "" },
    sourceChanged: true,
    attempted: false,
    unresolvedCreate: false,
    canCapture: true,
  };
  window.__nachrichten = [];
  // Chromium legt auf gewöhnlichen Seiten selbst ein \`window.chrome\` an; überschrieben wird es
  // ausdrücklich, damit die Leiste genau diese Erweiterungsschnittstelle sieht.
  Object.defineProperty(window, "chrome", { configurable: true, writable: true, value: {
    runtime: {
      sendMessage: async (nachricht) => {
        window.__nachrichten.push(nachricht);
        if (nachricht && nachricht.type === "branding") return { ok: false };
        if (nachricht && nachricht.type === "save") return { ...ansicht, status: "saving" };
        return ansicht;
      },
    },
    storage: {
      onChanged: { addListener: () => {} },
      local: { get: async (vorgabe) => vorgabe, set: async () => {} },
    },
  } });
})();`;

/**
 * In der Seite: wo liegt das Element, ist es ausgeblendet, trifft ein Klick an seiner Mitte es?
 * `trifft` ist der Kern — ein Kasten im Fenster, über dem etwas anderes liegt, ist nicht bedienbar.
 */
const MESSEN = `(id) => {
  const el = document.getElementById(id);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  let ausgeblendet = false;
  for (let n = el; n; n = n.parentElement) {
    const s = getComputedStyle(n);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) ausgeblendet = true;
  }
  const treffer = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return {
    links: r.left, oben: r.top, rechts: r.right, unten: r.bottom, breite: r.width, hoehe: r.height,
    fensterBreite: window.innerWidth, fensterHoehe: window.innerHeight,
    ausgeblendet, trifft: treffer !== null && (treffer === el || el.contains(treffer)),
  };
}`;
type Mass = {
  links: number;
  oben: number;
  rechts: number;
  unten: number;
  breite: number;
  hoehe: number;
  fensterBreite: number;
  fensterHoehe: number;
  ausgeblendet: boolean;
  trifft: boolean;
};

/** Scrollt die Leiste (`.inhalt`) auf einen Anteil ihres Rollwegs: 0 oben, 1 unten. */
const ROLLEN = `(anteil) => {
  const leiste = document.querySelector(".inhalt");
  leiste.scrollTop = (leiste.scrollHeight - leiste.clientHeight) * anteil;
  return leiste.scrollTop;
}`;
/** Bringt ein Element in die Mitte seiner Rollfläche — der Weg eines Menschen dorthin. */
const ZEIGEN = `(id) => { document.getElementById(id).scrollIntoView({ block: "center" }); return true; }`;

// EIN BROWSER JE FENSTERGRÖSSE. Gestartet wird mit `--single-process` (dieselben Schalter wie die
// geteilte Messstrecke `tests/design/h1-chromium.ts`, die je Lauf genau eine Seite öffnet). In
// diesem Modus endet der Browserprozess mit seiner letzten Seite: der erste Prüflauf (Cloud,
// Kandidat a8a3efb1) bestand 320×560 und scheiterte danach an `browser.newPage` mit „Target page,
// context or browser has been closed" — der geteilte Browser war mit der geschlossenen ersten Seite
// beendet. Jede Fenstergröße bekommt deshalb ihren eigenen Start und ihr eigenes Ende.
type Chromium = { launch(o: Record<string, unknown>): Promise<Browser> };
let chromium: Chromium;
let browser: Browser | null = null;
let chromiumVersion = "";

beforeAll(() => {
  const require = createRequire(import.meta.url);
  chromium = (require("playwright") as { chromium: Chromium }).chromium;
});

afterAll(async () => {
  await browser?.close();
});

async function leiste(breite: number, hoehe: number): Promise<Seite> {
  const eigener = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
  });
  browser = eigener;
  chromiumVersion = eigener.version();
  const seite = await eigener.newPage({ viewport: { width: breite, height: hoehe } });
  await seite.route(`${ORIGIN}/**`, async (route) => {
    const pfad = new URL(route.request().url()).pathname.replace(/^\/+/, "") || "panel.html";
    const datei = resolve(PAKET, pfad);
    if (!datei.startsWith(`${PAKET}${sep}`) || !existsSync(datei) || !statSync(datei).isFile()) {
      await route.fulfill({ status: 404, body: "" });
      return;
    }
    await route.fulfill({
      status: 200,
      body: readFileSync(datei),
      contentType: MIME[extname(datei)] ?? "application/octet-stream",
    });
  });
  await seite.addInitScript(ANSICHT_SKRIPT);
  await seite.goto(`${ORIGIN}/panel.html`, { waitUntil: "load", timeout: 60_000 });
  await seite.waitForFunction(
    fn(`() => {
      const vorschau = document.getElementById("preview");
      return vorschau !== null && !vorschau.hidden && document.getElementById("content").childElementCount >= 120;
    }`),
    undefined,
    { timeout: 30_000 },
  );
  // Geöffnete Details und geöffneter Kontokasten — die längste Gestalt der Fläche.
  await seite.evaluate(
    fn(`() => {
      document.getElementById("details").open = true;
      document.getElementById("account-details").open = true;
      return true;
    }`),
  );
  return seite;
}

function imFensterUndGetroffen(mass: Mass | null, was: string, lage: string): void {
  expect(mass, `${was} fehlt in der Leiste`).not.toBeNull();
  if (!mass) return;
  const ort = `${was} bei ${lage} (Chromium ${chromiumVersion}): ${JSON.stringify(mass)}`;
  expect(mass.ausgeblendet, `${ort} — ausgeblendet`).toBe(false);
  expect(mass.breite, `${ort} — keine Fläche`).toBeGreaterThan(0);
  expect(mass.hoehe, `${ort} — keine Fläche`).toBeGreaterThan(0);
  expect(mass.links, `${ort} — links abgeschnitten`).toBeGreaterThanOrEqual(0);
  expect(mass.oben, `${ort} — oben abgeschnitten`).toBeGreaterThanOrEqual(0);
  expect(mass.rechts, `${ort} — rechts abgeschnitten`).toBeLessThanOrEqual(mass.fensterBreite);
  expect(mass.unten, `${ort} — unter dem Fensterrand`).toBeLessThanOrEqual(mass.fensterHoehe);
  expect(mass.trifft, `${ort} — etwas anderes liegt darüber`).toBe(true);
}

const FENSTER = [
  { breite: 320, hoehe: 560 },
  { breite: 400, hoehe: 800 },
] as const;

describe("Schmale Leiste mit langer Vorschau — Speichern bleibt sichtbar und erreichbar", () => {
  for (const { breite, hoehe } of FENSTER) {
    it(`G0–G3 · ${breite}×${hoehe}`, async () => {
      const seite = await leiste(breite, hoehe);
      try {
        // G0 — ohne Überhang misst hier nichts etwas.
        const ueberhang = await seite.evaluate<{ leiste: boolean; inhalt: boolean }>(
          fn(`() => {
            const leiste = document.querySelector(".inhalt");
            const inhalt = document.getElementById("content");
            return {
              leiste: leiste.scrollHeight > leiste.clientHeight + 50,
              inhalt: inhalt.scrollHeight > inhalt.clientHeight + 50,
            };
          }`),
        );
        expect(ueberhang, "die Vorschau ist nicht lang genug, um etwas zu beweisen").toEqual({
          leiste: true,
          inhalt: true,
        });

        // G1 — Speichern und Verwerfen an drei Rollständen.
        for (const [anteil, lage] of [
          [0, "Leiste oben"],
          [0.5, "Leiste in der Mitte"],
          [1, "Leiste unten"],
        ] as const) {
          await seite.evaluate(fn(ROLLEN), anteil);
          for (const id of ["save", "cancel"]) {
            imFensterUndGetroffen(await seite.evaluate<Mass | null>(fn(MESSEN), id), id, lage);
          }
        }

        // G2 — konkrete Warnungen stehen sichtbar da und sind erreichbar.
        for (const id of ["ai-chat", "source-changed", "gaps-box", "image-note", "confirm"]) {
          await seite.evaluate(fn(ZEIGEN), id);
          imFensterUndGetroffen(
            await seite.evaluate<Mass | null>(fn(MESSEN), id),
            id,
            "Element in die Mitte gerollt",
          );
        }

        // G3 — bedient: bestätigen, Leiste nach oben, speichern.
        await seite.click("#confirm", { timeout: 10_000 });
        await seite.evaluate(fn(ROLLEN), 0);
        imFensterUndGetroffen(
          await seite.evaluate<Mass | null>(fn(MESSEN), "save"),
          "save",
          "Leiste oben nach Bestätigung",
        );
        await seite.click("#save", { timeout: 10_000 });
        const gespeichert = await seite.evaluate<{ type?: string; captureId?: string }[]>(
          fn(`() => window.__nachrichten.filter((n) => n && n.type === "save")`),
        );
        expect(gespeichert, "der Klick auf Speichern kam nicht an").toHaveLength(1);
        expect(gespeichert[0]?.captureId).toBe("leiste-lang-1");
      } finally {
        await seite.close().catch(() => {});
        await browser?.close();
        browser = null;
      }
    }, 120_000);
  }
});
