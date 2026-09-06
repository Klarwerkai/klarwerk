// @vitest-environment jsdom
// ================================================================================================
// JOB 3118 (UX-17) — AUF DEM TELEFON STEHEN DIE TITEL WIEDER DA. GEMESSEN, NICHT BEHAUPTET.
// ================================================================================================
//
// NUTZERPROBLEM N-0034 (`register/planung/UIUX-AUFTRAEGE-4.md:26-31`, Beleg
// `belege/mobil-20260906-011638/25-start-390-geladen.json`): auf 320/390 px liegen die zwei
// Startkarten NEBENEINANDER, je Karte bleiben rund 150 px, und `truncate` schneidet den Titel
// einzeilig ab — sichtbar waren „N…" und „Ko…". Der zugängliche Name war vollständig, der sichtbare
// nicht: wählen konnte nur, wer die Liste ohnehin kannte.
//
// WARUM CHROMIUM UND NICHT JSDOM: der Fehler IST Layout. jsdom rechnet keine Zeilenumbrüche, kennt
// keine Textrechtecke und wendet keine Media Query an — dort steht der volle Titel im DOM, ob er
// sichtbar ist oder nicht. Ein jsdom-Test hätte hier VOR und NACH dem Bau grün gemeldet. Dieselbe
// Begründung wie in `tests/wissensgraph-lesbarkeit/graph-treffer-chromium.test.tsx` (JOB 3103): wo
// die Kürzung im Browser entsteht, muss der Browser messen.
//
// DIE BÜHNE, EHRLICH BENANNT:
//   · Das MARKUP stammt aus der echten, in jsdom gemounteten `pages/Start` mit aufgelösten
//     Abfragen — kein nachgebautes HTML.
//   · Das CSS entsteht aus der ECHTEN Tailwind-Konfiguration der App (`apps/web/tailwind.config.ts`)
//     über die echten Klassennamen dieses Markups. Kein handgeschriebener Stilblock — der würde
//     messen, was dieser Test selbst behauptet.
//   · Die FARBTOKENS der App sind bewusst NICHT geladen: hier wird ausschliesslich Geometrie
//     gemessen (Spalten, Zeilenumbrüche, Textrechtecke), und keine Aussage dieser Datei hängt an
//     einer Farbe. Die Farbtreue der Karten misst `tests/design/zielbild-h5-start.test.ts` am
//     wirklich gebauten Bündel — dort gehört sie hin, nicht in eine zweite, schwächere Bühne.
//   · NICHT dabei ist die Hülle (Kopfband, Seitenleiste) mit ihrem Aussenpolster: gemessen wird die
//     Startfläche in einem 320- bzw. 390-px-Fenster. Ein Polster der Hülle macht die Spalte
//     schmaler, nie breiter — die Messung ist damit die freundlichere Fassung des Falls.
//   · Die Schriftdateien der App (`@fontsource/ibm-plex-sans`) sind nicht geladen; Chromium löst
//     `system-ui, sans-serif` auf. Die Titel sind deshalb so gewählt, dass keine Aussage an einem
//     Millimeter Laufweite hängt.
//
// WAS GEMESSEN WIRD: der SICHTBARE Text. Für jedes Zeichen wird sein Rechteck mit dem Kasten der
// Beschriftung verglichen; was ausserhalb liegt, ist abgeschnitten — bei `truncate` seitlich, bei
// `line-clamp` unterhalb. Zwei Titel, die dasselbe Bild ergeben, fallen damit auf, auch wenn im DOM
// beide vollständig stehen (die Lehre aus JOB 3103 R2/R3: „identische sichtbare Beschriftungen für
// unterschiedliche Titel"). Die Auslassung „…" ist erzeugter Inhalt, steht nicht im Textknoten und
// wird nicht mitgezählt — sie beschönigt hier nichts.
import { createRequire } from "node:module";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  wall: {} as unknown,
  meldungen: [] as unknown[],
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: "experte" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = vi.fn(async () => []);
  return {
    endpoints: {
      ko: { list: leer },
      conflicts: { list: leer },
      duplicateSignal: { list: leer },
      validation: { board: leer },
      lifecycle: { pending: leer },
      gaps: { summary: vi.fn(async () => ({ open: 0, byPriority: { hoch: 0 } })) },
      learningPaths: { byRole: vi.fn(async () => null), progress: leer },
      livewall: { get: vi.fn(async () => box.wall) },
      notifications: { list: vi.fn(async () => box.meldungen) },
      admin: { demoStatus: vi.fn(async () => ({ present: false, count: 0 })) },
      analytics: { overview: vi.fn(async () => ({ total: 0, byStatus: {} })) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Start } from "../../apps/web/src/pages/Start";
import tailwindConfig from "../../apps/web/tailwind.config";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

// ------------------------------------------------------------------------------------------------
// Der Bestand: Titel EINER Familie, die sich erst spät unterscheiden (Muster aus N-0034)
// ------------------------------------------------------------------------------------------------
const VOR_TAGEN = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();

/**
 * DAS TITELPAAR STAMMT AUS BENS GEGENPROBE (Runde 1, Korrekturpflicht 2) und ist wörtlich seines.
 * Es geht ERST NACH ZWEI TEXTZEILEN auseinander — genau dort, wo die harte `line-clamp-2`-Grenze
 * der ersten Runde schnitt: bei 320 px zeigten beide Zeilen „Notfallplan Standort mit Anlagen
 * Fluchtwegen Sammelplätzen und". Wer diese Datei ändert, muss dieses Paar behalten: mit einem
 * früh unterscheidbaren Paar ist die Zusage von Lieferung 6 nicht geprüft, sondern nur umgangen.
 */
const SPAET_UNTERSCHIEDLICH = [
  "Notfallplan Standort mit Anlagen Fluchtwegen Sammelplätzen und Meldeketten Ausgabe Nord 2026",
  "Notfallplan Standort mit Anlagen Fluchtwegen Sammelplätzen und Meldeketten Ausgabe Süd 2026",
] as const;

const ZULETZT = [
  { koId: "ko-nord", title: SPAET_UNTERSCHIEDLICH[0] },
  { koId: "ko-sued", title: SPAET_UNTERSCHIEDLICH[1] },
  // Ein kurzer Titel daneben: die Behebung darf den Normalfall nicht in eine Textwand verwandeln.
  { koId: "ko-kurz", title: "Sammelplatz Tor 3" },
] as const;
const ZULETZT_ZIELE = ZULETZT.map((e) => `/wissen/${e.koId}`);

/**
 * Die Meldungszeilen von „FÜR DICH" — dasselbe Paar, denn Ben verlangt es „an beiden Karten".
 * Art `impact`, weil ihr Ziel (`/wissen/<koId>`) für JEDE Rolle ein Weg ist — eine gesperrte Zeile
 * trägt zusätzlich „Kein Zugriff" (`RoleLink`, mega51) und verschöbe die Messung auf eine Frage,
 * die dieser Test nicht stellt.
 */
const MELDUNGEN = [
  { koId: "m-nord", title: `Freigabe ${SPAET_UNTERSCHIEDLICH[0]}` },
  { koId: "m-sued", title: `Freigabe ${SPAET_UNTERSCHIEDLICH[1]}` },
] as const;

const WAND = {
  saved: ZULETZT.map((e) => ({
    koId: e.koId,
    title: e.title,
    author: "Eva",
    at: VOR_TAGEN,
    status: "offen" as const,
  })),
  helped: [],
  helpedToday: 0,
};

// ------------------------------------------------------------------------------------------------
// 1 · Das Markup: die echte Seite, in jsdom gemountet, mit aufgelösten Abfragen
// ------------------------------------------------------------------------------------------------
const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function seitenMarkup(sprache: "de" | "en"): Promise<string> {
  await i18n.changeLanguage(sprache);
  box.wall = WAND;
  box.meldungen = MELDUNGEN.map((m) => ({
    id: m.koId,
    kind: "impact",
    title: m.title,
    seen: false,
    at: VOR_TAGEN,
    koId: m.koId,
  }));
  window.localStorage.clear();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(
                NavGuardProvider,
                null,
                createElement(MemoryRouter, { initialEntries: ["/start"] }, [
                  createElement(Start, { key: "s" }),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  // Zwei Runden: die Sitzung löst in zwei Stufen auf (`/auth/status`, dann `/auth/me`).
  await act(flush);
  await act(flush);
  const html = container.innerHTML;
  act(() => root.unmount());
  container.remove();
  qc.clear();
  if (!html.includes(ZULETZT[0].title) || !html.includes(MELDUNGEN[0].title)) {
    throw new Error(`die Karten tragen den Bestand nicht: ${html.slice(0, 400)}`);
  }
  return html;
}

// ------------------------------------------------------------------------------------------------
// 2 · Das Stylesheet: die echte Tailwind-Konfiguration über die echten Klassennamen
// ------------------------------------------------------------------------------------------------
const WURZEL = join(__dirname, "..", "..");
const verlangeModul = createRequire(join(WURZEL, "apps", "web", "index.js"));

async function stylesheet(markup: string): Promise<string> {
  const postcss = verlangeModul("postcss") as (p: unknown[]) => {
    process(css: string, o: Record<string, unknown>): Promise<{ css: string }>;
  };
  const tailwind = verlangeModul("tailwindcss") as (c: unknown) => unknown;
  const ergebnis = await postcss([
    tailwind({ ...tailwindConfig, content: [{ raw: markup, extension: "html" }] }),
  ]).process("@tailwind base;\n@tailwind utilities;", { from: undefined });
  return ergebnis.css;
}

// ------------------------------------------------------------------------------------------------
// 3 · Die Messung im Browser
// ------------------------------------------------------------------------------------------------
interface Zeile {
  /** Der Text, der im DOM steht — der zugängliche Name der Zeile. */
  voll: string;
  /** Der Text, den ein Mensch wirklich sieht: Zeichen für Zeichen am Kasten geprüft. */
  sichtbar: string;
  /** Wie viele Textzeilen die Beschriftung belegt (1 = einzeilig). */
  zeilen: number;
  /** Ziel des Wegs, an dem die Zeile hängt. */
  href: string | null;
}
interface Messung {
  dokumentBreite: number;
  /** `grid-template-columns` des Kartenrasters, wie Chromium es auflöst. */
  rasterSpalten: string[];
  kartenBreiten: number[];
  zuletzt: Zeile[];
  fuerdich: Zeile[];
  /** Reihenfolge der Ziele, die `Tab` erreicht. */
  tabZiele: string[];
  /** Wohin der Browser nach `Tab` bis zur ersten Zeile und `Enter` wirklich gegangen ist. */
  enterZiel: string;
}
interface Page {
  setViewportSize(o: { width: number; height: number }): Promise<void>;
  goto(url: string): Promise<unknown>;
  route(muster: string, handler: (route: Weiche) => unknown): Promise<void>;
  url(): string;
  waitForURL(muster: string, o?: Record<string, unknown>): Promise<void>;
  evaluate<T>(fn: string): Promise<T>;
  keyboard: { press(taste: string): Promise<void> };
}
interface Weiche {
  fulfill(o: Record<string, unknown>): Promise<void>;
}
interface Browser {
  newPage(o: Record<string, unknown>): Promise<Page>;
  close(): Promise<void>;
}

const MESSUNG = `(() => {
  const sichtbarerText = (el) => {
    const kasten = el.getBoundingClientRect();
    let text = "";
    for (const knoten of el.childNodes) {
      if (knoten.nodeType !== 3) { continue; }
      const roh = knoten.textContent ?? "";
      const bereich = document.createRange();
      for (let i = 0; i < roh.length; i++) {
        bereich.setStart(knoten, i);
        bereich.setEnd(knoten, i + 1);
        const r = bereich.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) { text += roh[i]; continue; }
        const drin = r.left >= kasten.left - 0.5 && r.right <= kasten.right + 0.5
          && r.top >= kasten.top - 0.5 && r.bottom <= kasten.bottom + 0.5;
        if (drin) { text += roh[i]; }
      }
    }
    return text;
  };
  const zeilen = (testId) => [...document.querySelectorAll('[data-testid="' + testId + '"]')].map((z) => {
    const titel = z.querySelector('[data-h5-zeile]');
    const stil = getComputedStyle(titel);
    const hoehe = titel.getBoundingClientRect().height;
    const zh = Number.parseFloat(stil.lineHeight) || Number.parseFloat(stil.fontSize) * 1.2;
    return {
      voll: titel.textContent ?? "",
      sichtbar: sichtbarerText(titel),
      zeilen: Math.round(hoehe / zh),
      href: z.getAttribute("href"),
    };
  });
  // Karte → Spalte (Kicker + Karte) → Raster. Der Weg über den Baum statt über eine Klassenliste:
  // eine umbenannte Utility-Klasse darf diese Messung nicht lautlos ins Leere laufen lassen.
  const raster = document.querySelector('[data-testid="h5-fuerdich"]').parentElement.parentElement;
  return {
    dokumentBreite: document.documentElement.scrollWidth,
    rasterSpalten: getComputedStyle(raster).gridTemplateColumns.split(" "),
    kartenBreiten: [...raster.children].map((k) => Math.round(k.getBoundingClientRect().width)),
    zuletzt: zeilen("h5-zuletzt-zeile"),
    fuerdich: zeilen("h5-fuerdich-zeile"),
    tabZiele: [],
  };
})()`;

const TAB_ZIEL = `(() => {
  const a = document.activeElement;
  return a && a.tagName === "A" ? a.getAttribute("href") : null;
})()`;

/**
 * Die Adresse der Bühne. KEIN Netz: `page.route` unten beantwortet jede Anfrage aus dem Speicher.
 * Sie ist trotzdem nötig — unter `about:blank` löst ein relatives `href` nicht auf, und die
 * Enter-Messung hätte nichts zu messen.
 */
const BUEHNE = "http://startkarten.pruefstand/";
let seitenInhalt = "";

let browser: Browser | null = null;
/**
 * EINE Seite für alle Fälle, und sie bleibt bis zum Schluss offen: mit `--single-process
 * --no-zygote` (dieselben Schalter wie in `tests/design/`) endet der Browser mit seiner letzten
 * Seite.
 */
let seite: Page | null = null;
/** Ein Markup je Sprache, einmal gebaut — der Mount ist teuer, die Messung nicht. */
const buehne = new Map<string, { html: string; css: string }>();
/** Eine Erhebung je Sprache und Fensterbreite; alle Fälle lesen dieselbe. */
const messungen = new Map<string, Messung>();

async function messen(sprache: "de" | "en", breite: number): Promise<Messung> {
  const schluessel = `${sprache}-${breite}`;
  const vorhanden = messungen.get(schluessel);
  if (vorhanden) {
    return vorhanden;
  }
  let vorrat = buehne.get(sprache);
  if (!vorrat) {
    const html = await seitenMarkup(sprache);
    vorrat = { html, css: await stylesheet(html) };
    buehne.set(sprache, vorrat);
  }
  const s = seite as Page;
  await s.setViewportSize({ width: breite, height: 844 });
  seitenInhalt = `<!doctype html><html lang="${sprache}"><head><meta charset="utf-8"><style>${vorrat.css}</style></head><body>${vorrat.html}</body></html>`;
  await s.goto(`${BUEHNE}start`);
  const messung = await s.evaluate<Messung>(MESSUNG);
  // Die Tastaturfolge am echten Browser: `Tab` durch die Fläche, jedes erreichte Ziel wird notiert.
  // Das ist der Weg, den ein Mensch ohne Maus nimmt — keine abgeschriebene Reihenfolge.
  const ziele: string[] = [];
  for (let i = 0; i < 20; i++) {
    await s.keyboard.press("Tab");
    const ziel = await s.evaluate<string | null>(TAB_ZIEL);
    if (ziel !== null && !ziele.includes(ziel)) {
      ziele.push(ziel);
    }
  }
  messung.tabZiele = ziele;

  // RUNDE 2 · Bens Korrekturpflicht 3: nicht „der Fokus steht auf einem `href`", sondern die TASTE.
  // Deshalb liegt die Bühne unter einer echten Adresse (`page.route` beantwortet jeden Pfad, ohne
  // Netz): erst dann macht Chromium aus dem Enter auf einem Link eine WIRKLICHE Navigation, und
  // hier steht, wo sie landet. Was an diesem Ziel erscheint, misst `start-karten-weg.test.tsx`.
  await s.goto(`${BUEHNE}start`);
  let erreicht = false;
  for (let i = 0; i < 20 && !erreicht; i++) {
    await s.keyboard.press("Tab");
    erreicht = (await s.evaluate<string | null>(TAB_ZIEL)) === ZULETZT_ZIELE[0];
  }
  if (!erreicht) {
    throw new Error(`Tab erreicht ${ZULETZT_ZIELE[0]} nicht — Tastaturweg verloren`);
  }
  await s.keyboard.press("Enter");
  // Der Fehlschlag darf hier nicht als Zeitüberschreitung auffallen, sondern als Adresse: bleibt
  // die Navigation aus, misst der Fall unten die tatsächliche Adresse und sagt, welche es ist.
  await s.waitForURL("**/wissen/**", { timeout: 5_000 }).catch(() => undefined);
  messung.enterZiel = s.url();

  messungen.set(schluessel, messung);
  return messung;
}

beforeAll(async () => {
  const { chromium } = verlangeModul("playwright") as {
    chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
  };
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
  });
  seite = await browser.newPage({ viewport: { width: 320, height: 844 } });
  // Jeder Pfad der Bühne liefert dasselbe Markup. Der Test misst, WOHIN der Browser geht, nicht
  // was dort steht — das ist die Aufgabe von `start-karten-weg.test.tsx` am echten Router.
  await seite.route("**/*", (route) =>
    route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: seitenInhalt }),
  );
}, 120_000);

afterAll(async () => {
  await browser?.close();
});

// ------------------------------------------------------------------------------------------------
// B-1 / B-2 · 320 und 390 px
// ------------------------------------------------------------------------------------------------
for (const breite of [320, 390]) {
  const nr = breite === 320 ? "B-1" : "B-2";
  describe(`JOB 3118 · ${nr} · Startkarten bei ${breite} px`, () => {
    it(`${nr}a · „ZULETZT“: die spät unterschiedlichen Titel sind sichtbar VERSCHIEDEN und ganz`, async () => {
      const m = await messen("de", breite);
      expect(m.zuletzt).toHaveLength(ZULETZT.length);
      const sichtbar = m.zuletzt.map((z) => z.sichtbar.trim());
      // Der Befund aus N-0034 in seiner schärfsten Form: zwei Berichte, ein Bild. Vor dem Bau
      // stehen hier zwei gleiche Anfänge, weil `truncate` in der halben Spalte dieselben Zeichen
      // übrig lässt — nach Runde 1 dieselben zwei Zeilen, weil `line-clamp-2` VOR der Stelle
      // schnitt, an der dieses Paar auseinandergeht (Bens Gegenprobe).
      expect(sichtbar[0], `beide Zeilen sehen gleich aus: „${sichtbar[0]}“`).not.toBe(sichtbar[1]);
      // Und die Lehre aus JOB 3103: sichtbarer Text und zugänglicher Name bleiben deckungsgleich —
      // ein Titel, der im DOM steht und auf der Fläche fehlt, ist keine Auskunft.
      expect(sichtbar[0]).toBe(ZULETZT[0].title);
      expect(sichtbar[1]).toBe(ZULETZT[1].title);
      expect(sichtbar[2]).toBe(ZULETZT[2].title);
      // Und für JEDE Zeile beider Karten, ohne Ausnahme: nichts ist verborgen.
      for (const z of [...m.zuletzt, ...m.fuerdich]) {
        expect(z.sichtbar.trim(), `verborgen: „${z.voll}“`).toBe(z.voll.trim());
      }
    });

    it(`${nr}b · „FÜR DICH“: dieselbe Zusage — die Karte nebenan bleibt nicht zurück`, async () => {
      const m = await messen("de", breite);
      expect(m.fuerdich).toHaveLength(MELDUNGEN.length);
      const sichtbar = m.fuerdich.map((z) => z.sichtbar.trim());
      expect(sichtbar[0]).not.toBe(sichtbar[1]);
      expect(sichtbar[0]).toBe(MELDUNGEN[0].title);
      expect(sichtbar[1]).toBe(MELDUNGEN[1].title);
    });

    it(`${nr}c · die zwei Karten liegen UNTEREINANDER in voller Breite`, async () => {
      const m = await messen("de", breite);
      // Die zweite Hälfte der Behebung (Lieferung 5). Ohne sie blieben je Karte rund 150 px, und
      // zwei Textzeilen reichten für einen Titel dieser Länge nicht.
      expect(m.rasterSpalten, `Raster: ${m.rasterSpalten.join(" ")}`).toHaveLength(1);
      expect(m.kartenBreiten).toHaveLength(2);
      expect(m.kartenBreiten[0]).toBe(m.kartenBreiten[1]);
      expect(m.kartenBreiten[0]).toBeGreaterThan(breite * 0.9);
    });

    it(`${nr}d · der Titel bekommt SO VIELE Zeilen, wie er braucht — mehr als zwei`, async () => {
      const m = await messen("de", breite);
      // Nicht „`truncate` ist weg", sondern: der Umbruch findet wirklich statt UND er hört nicht
      // vorzeitig auf. Runde 1 endete hier bei zwei Zeilen; genau daran scheiterte die Zusage
      // „zwei verschiedene Titel ergeben nie dasselbe Bild" (Bens Korrekturpflicht 2). Dieser Fall
      // hält fest, dass die Zeilenzahl dem Titel folgt und nicht umgekehrt.
      const lang = m.zuletzt[0] as Zeile;
      expect(lang.zeilen, `Titelhöhe in Zeilen: ${lang.zeilen}`).toBeGreaterThanOrEqual(3);
      expect(lang.sichtbar.trim()).toBe(lang.voll.trim());
      // Der Normalfall bleibt der Normalfall: ein kurzer Titel belegt weiterhin EINE Zeile, die
      // Karte wird also nicht pauschal hoch.
      expect((m.zuletzt[2] as Zeile).zeilen).toBe(1);
    });
  });
}

// ------------------------------------------------------------------------------------------------
// B-3 · Kein waagerechter Überlauf (Lehre JOB 3103 R3)
// ------------------------------------------------------------------------------------------------
describe("JOB 3118 · B-3 · nichts schiebt über den Fensterrand", () => {
  it("B-3 · bei 320 px bleibt das Dokument so breit wie das Fenster", async () => {
    const m = await messen("de", 320);
    expect(m.dokumentBreite).toBeLessThanOrEqual(320);
    for (const b of m.kartenBreiten) {
      expect(b).toBeLessThanOrEqual(320);
    }
  });
});

// ------------------------------------------------------------------------------------------------
// B-4 · Der Weg bleibt ein Weg
// ------------------------------------------------------------------------------------------------
describe("JOB 3118 · B-4 · die Tastatur erreicht jeden Bericht", () => {
  it("B-4a · `Tab` führt auf `/wissen/<koId>` jedes Eintrags, in seiner Reihenfolge", async () => {
    const m = await messen("de", 320);
    // Die Umbruchänderung darf den Weg nicht verlieren: die Zeile bleibt ein `RoleLink`, und wer
    // ohne Maus bedient, erreicht sie in der Reihenfolge, in der sie dasteht.
    expect(m.zuletzt.map((z) => z.href)).toEqual(ZULETZT_ZIELE);
    expect(m.tabZiele.filter((z) => ZULETZT_ZIELE.includes(z))).toEqual(ZULETZT_ZIELE);
  });

  it("B-4b · und ENTER auf der Zeile navigiert wirklich — der Browser geht zum Bericht", async () => {
    const m = await messen("de", 320);
    // Bens Korrekturpflicht 3: bis hierher war nur der Fokus gemessen. Jetzt drückt der Test die
    // Taste, und das Ergebnis ist die Adresse, an der der Browser danach steht.
    expect(m.enterZiel).toBe(`${BUEHNE}wissen/ko-nord`);
  });
});

// ------------------------------------------------------------------------------------------------
// B-5 · Zwei Sprachen — damit die Behebung nicht an einer zufälligen Wortlänge hängt
// ------------------------------------------------------------------------------------------------
describe("JOB 3118 · B-5 · dieselbe Zusage auf Deutsch und Englisch", () => {
  for (const sprache of ["de", "en"] as const) {
    it(`B-5 ${sprache} · Titel sichtbar verschieden, kein Überlauf bei 320 px`, async () => {
      const m = await messen(sprache, 320);
      const sichtbar = m.zuletzt.map((z) => z.sichtbar.trim());
      expect(sichtbar[0]).toBe(ZULETZT[0].title);
      expect(sichtbar[1]).toBe(ZULETZT[1].title);
      expect(m.dokumentBreite).toBeLessThanOrEqual(320);
      // Die Meta-Spalte („Wirkung"/„Impact", Wochentag) ist in beiden Sprachen verschieden lang und
      // nimmt dem Titel Platz weg — genau deshalb steht dieser Fall hier.
      expect(m.fuerdich.map((z) => z.sichtbar.trim())).toEqual([
        MELDUNGEN[0].title,
        MELDUNGEN[1].title,
      ]);
    });
  }
});
