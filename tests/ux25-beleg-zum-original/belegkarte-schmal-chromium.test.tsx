// @vitest-environment jsdom
// ================================================================================================
// JOB 3272 · UX-25 · RUNDE 2 — DIE BELEGKARTE AUF SCHMALEM GERÄT, IM ECHTEN BROWSER GEMESSEN.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. BEN hat in Runde 1 (Prüflücke 6) belegt, dass der gemountete Fall R0
// KLASSENNAMEN prüft und keine Breiten: „`belegkarte-zum-original.test.tsx:341` prüft CSS-Klassen
// statt tatsächlicher Breiten". Er hat recht. jsdom rechnet keine Zeilenumbrüche, kennt keine
// Textrechtecke und wendet kein Layout an — dort steht der volle Belegname im DOM, ob ein Mensch
// ihn sieht oder nicht. Ein Test über `not.toContain("truncate")` misst die eigene Behauptung,
// nicht das Ergebnis. Lieferung 5 des Auftrags verlangt aber „bei 320/360/390 px vollständig
// lesbar" — und das kann nur der Browser sagen.
//
// UND WARUM DIE TASTATUR HIER WOHNT. Die gemountete Datei nennt ihre Grenze selbst: jsdom führt für
// einen nativen `<button>` keine Vorgabehandlung auf `keydown` aus, ein dort abgeschicktes `Enter`
// bewirkt nichts. Der Auftrag verspricht aber „mit Maus UND Tastatur bedienbar". Hier drückt ein
// echter Chromium wirklich `Tab`, `Enter` und die `Leertaste`, und gemessen wird, ob daraus ein
// `click` wird. Die WIRKUNG dieses Klicks (Abschnitt auf, Fokus auf genau dem Anhang) misst
// weiterhin die gemountete Datei an der echten React-Fläche — zusammen ist die Kette geschlossen,
// und keine der beiden Dateien behauptet die Hälfte der anderen.
//
// DIE BÜHNE, EHRLICH BENANNT (Bauform wörtlich aus
// `tests/start-karten-schmal/start-karten-schmal-chromium.test.tsx`, JOB 3118):
//   · Das MARKUP stammt aus der echten, in jsdom gemounteten Lesefläche über die echte Route
//     `/wissen/:id` mit aufgelösten Abfragen und aufgeklapptem Abschnitt „Belege". Kein nachgebautes
//     HTML.
//   · Das CSS entsteht aus der ECHTEN Tailwind-Konfiguration der App über die echten Klassennamen
//     dieses Markups. Kein handgeschriebener Stilblock.
//   · NICHT dabei ist die Hülle (Kopfband, Seitenleiste) mit ihrem Außenpolster: gemessen wird die
//     Lesefläche in einem 320-/360-/390-px-Fenster. Ein Polster der Hülle macht die Spalte
//     schmaler, nie breiter — die Messung ist damit die freundlichere Fassung des Falls. Sie taugt
//     als Nachweis für „bricht um statt abzuschneiden", nicht als Freispruch für die ganze Seite.
//   · Die Schriftdateien der App sind nicht geladen; Chromium löst `system-ui, sans-serif` auf.
//     Keine Aussage hier hängt an einem Millimeter Laufweite: gemessen wird VOLLSTÄNDIGKEIT, nicht
//     eine Pixelzahl.
//   · React läuft auf dieser Bühne NICHT. Deshalb steht hier auch keine Aussage über den Sprung —
//     nur über das, was der Browser selbst tut: Layout, Fokusreihenfolge, Tastenvorgabehandlung.
import { createRequire } from "node:module";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { schliesseChromium } from "../tor-bereitschaft/chromium-abbau";

const box = vi.hoisted(() => ({ belege: [] as unknown[] }));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

/**
 * Derselbe lange Name wie in der gemounteten Datei — er unterscheidet sich erst am ENDE. Genau
 * daran wird sichtbar, ob abgeschnitten wird (Lehre JOB 3266 R2/R3).
 */
const ANHANG_NAME = "Pruefprotokoll-Spritzzone-Linie-3-2026-08-31-Nachmessung-Seite-4.png";
const BELEG_MIT_ORIGINAL = `Beleg zu ${ANHANG_NAME}`;
const BELEG_OHNE_ORIGINAL = "Beleg zu Nachmessung-Spritzzone-Linie-3-2026-07-14-Seite-11.png";

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = vi.fn(async () => []);
  return {
    endpoints: {
      ko: {
        get: vi.fn(async () => globalThis.__job3272ChromKo),
        list: vi.fn(async () => [globalThis.__job3272ChromKo]),
        versions: leer,
        evidence: vi.fn(async () => box.belege),
        neighbors: vi.fn(async () => ({
          center: "ko-1",
          neighbors: [],
          excludedTags: [],
          limit: 8,
        })),
        act: vi.fn(async () => globalThis.__job3272ChromKo),
      },
      conflicts: { list: leer },
      duplicateSignal: { list: leer },
      audit: { list: leer },
      directory: { list: vi.fn(async () => [{ id: "u1", name: "Eva" }]) },
      lifecycle: { pending: leer, linked: leer },
      external: { policy: vi.fn(async () => ({ stage: "blocked", enabled: false })) },
      uploadLimits: {
        get: vi.fn(async () => ({ maxAttachments: 8, maxAttachmentBytes: 20000000 })),
      },
      reasoner: {
        status: vi.fn(async () => ({ active: false, mode: "off" })),
        config: vi.fn(async () => ({})),
        assist: vi.fn(async () => ({ text: "" })),
        assistPresets: leer,
        extract: vi.fn(async () => ({ points: [], note: null })),
        describeImage: vi.fn(async () => ({})),
      },
      aiCheck: { coverageSummary: vi.fn(async () => ({ total: 0 })) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import type { EvidenceRecord, KnowledgeObject } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";
import tailwindConfig from "../../apps/web/tailwind.config";

declare global {
  // eslint-disable-next-line no-var
  var __job3272ChromKo: KnowledgeObject;
}

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};

function beleg(overrides: Partial<EvidenceRecord>): EvidenceRecord {
  return {
    id: "ev-1",
    koId: "ko-1",
    koVersion: 1,
    kind: "attachment",
    label: BELEG_MIT_ORIGINAL,
    createdBy: "u1",
    createdAt: "2026-08-31T10:00:00.000Z",
    ...overrides,
  };
}

function ko(): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Reinigung Spritzzone Linie 3",
    statement: "Die Spritzzone wird nach jeder Schicht nass gereinigt.",
    bodyHtml: "<p>Reinigung und Prüfung.</p>",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Produktion",
    tags: [],
    confidence: 80,
    trust: 80,
    status: "validiert",
    version: 1,
    author: "u1",
    originalAuthor: "u1",
    neededValidations: 2,
    assignments: [],
    asset: null,
    history: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    comments: [],
    sources: [],
    attachments: [
      {
        id: "att-1",
        name: ANHANG_NAME,
        mime: "image/png",
        objectId: "obj-1",
        author: "u1",
        at: "2026-08-01T00:00:00.000Z",
      },
    ],
  } as KnowledgeObject;
}

// ------------------------------------------------------------------------------------------------
// 1 · Das Markup: die echte Lesefläche, in jsdom gemountet, Abschnitt „Belege" aufgeklappt
// ------------------------------------------------------------------------------------------------
const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function belegflaechenMarkup(): Promise<string> {
  await i18n.changeLanguage("de");
  // Zwei Karten in EINER Erhebung: eine mit Weg zum Original, eine mit dem ehrlichen Satz. Beide
  // müssen bei 320 px vollständig lesbar sein — die zweite ist der Fall, den ein Knopf nicht deckt.
  box.belege = [
    beleg({ id: "ev-1", attachmentId: "att-1", objectId: "obj-1", mime: "image/png" }),
    beleg({
      id: "ev-2",
      label: BELEG_OHNE_ORIGINAL,
      objectId: "obj-weg",
      mime: "image/png",
      createdAt: "2026-08-30T10:00:00.000Z",
    }),
  ];
  globalThis.__job3272ChromKo = ko();
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
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
                  createElement(
                    MemoryRouter,
                    { initialEntries: ["/wissen/ko-1"] },
                    createElement(
                      Routes,
                      null,
                      createElement(Route, {
                        path: "/wissen/:id",
                        element: createElement(KnowledgeDetail),
                      }),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      await flush();
    });
    await act(flush);

    // „Mehr" aufklappen und den Abschnitt „Belege" öffnen — der Weg, den ein Mensch geht.
    const mehr = container.querySelector<HTMLElement>('[data-testid="bib-mehr"]');
    if (!mehr) {
      throw new Error("„bib-mehr“ fehlt auf der Lesefläche");
    }
    await act(async () => {
      mehr.click();
      await flush();
    });
    const belegeAbschnitt = container.querySelector<HTMLDetailsElement>(
      '[data-bib-abschnitt="belege"]',
    );
    if (!belegeAbschnitt) {
      throw new Error("Abschnitt „belege“ fehlt");
    }
    await act(async () => {
      belegeAbschnitt.open = true;
      belegeAbschnitt.dispatchEvent(new Event("toggle"));
      await flush();
    });
    await act(flush);

    // Selbstschutz: eine leere Bühne wäre grün, ohne etwas geprüft zu haben.
    const text = container.textContent ?? "";
    for (const titel of [BELEG_MIT_ORIGINAL, BELEG_OHNE_ORIGINAL]) {
      if (!text.includes(titel)) {
        throw new Error(`Belegkarte „${titel}“ fehlt in der Bühne`);
      }
    }
    if (!container.querySelector("[data-bib-beleg-sprung]")) {
      throw new Error("kein Sprungknopf in der Bühne — die Messung hätte nichts zu messen");
    }
    // GEMESSEN WIRD DER ABSCHNITT, NICHT DIE GANZE SEITE. Die Hülle der Detailseite (Kopfband,
    // Spalten, Seitenleiste) braucht Breakpoints und einen Fluss, den diese Bühne nicht stellt —
    // mit ihr lag der Inhalt bei allen drei Fenstern gleich, in einer 22 px schmalen Säule bei
    // x = 397 (gemessen, Runde 2). Das wäre keine Messung, sondern ein Artefakt der Bühne.
    // Der Abschnitt steht deshalb DIREKT im Fenster: seine Breite IST dann die Fensterbreite.
    // Auf der echten Seite ist die Lesespalte durch das Polster der Hülle SCHMALER — die Messung
    // hier ist also die freundlichere Fassung und taugt als Nachweis für „bricht um statt
    // abzuschneiden", nicht als Freispruch für die ganze Seite.
    return belegeAbschnitt.outerHTML;
  } finally {
    await act(async () => root.unmount());
    container.remove();
    qc.clear();
  }
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
interface Beschriftung {
  /** Der Text, der im DOM steht. */
  voll: string;
  /** Der Text, den ein Mensch wirklich sieht: Zeichen für Zeichen am Kasten geprüft. */
  sichtbar: string;
  breite: number;
  hoehe: number;
}
interface Messung {
  dokumentBreite: number;
  /** Je Belegkarte der Titel. */
  titel: Beschriftung[];
  /** Die Beschriftung des Sprungknopfes (genau einer in dieser Bühne). */
  knopf: Beschriftung | null;
  /** Der ehrliche Satz der Karte ohne Original. */
  fehlSatz: Beschriftung | null;
  /** Wie oft der Sprungknopf in der Tabulator-Reihenfolge erreicht wird (0 = gar nicht). */
  tabAnschlaegeBisKnopf: number;
}
interface Page {
  setViewportSize(o: { width: number; height: number }): Promise<void>;
  goto(url: string): Promise<unknown>;
  route(muster: string, handler: (route: Weiche) => unknown): Promise<void>;
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

/**
 * Der sichtbare Text eines Elements, Zeichen für Zeichen: was ausserhalb des eigenen Kastens liegt,
 * sieht niemand — bei `truncate` seitlich, bei `line-clamp` unterhalb. Wörtlich dieselbe Messung wie
 * in `start-karten-schmal-chromium.test.tsx`; sie ist dort die Lehre aus JOB 3103 und gilt hier
 * unverändert.
 */
const SICHTBAR_FN = `
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
  const beschriftung = (el) => {
    if (!el) { return null; }
    const k = el.getBoundingClientRect();
    return {
      voll: (el.textContent ?? "").replace(/\\s+/g, " ").trim(),
      sichtbar: sichtbarerText(el).replace(/\\s+/g, " ").trim(),
      breite: Math.round(k.width),
      hoehe: Math.round(k.height),
    };
  };`;

const FEHL_SATZ = "Original nicht mehr an diesem Objekt";

const TITEL = [BELEG_MIT_ORIGINAL, BELEG_OHNE_ORIGINAL];

const MESSUNG = `(() => {
  ${SICHTBAR_FN}
  const gesucht = ${JSON.stringify(TITEL)};
  // Die BELEGKARTEN, nicht jedes <li> des Abschnitts: derselbe Abschnitt führt darüber auch die
  // Konsistenzbefunde als Liste (MehrAbschnitte.tsx:1192), und deren Zeile NENNT den Belegtitel
  // ("Evidence ohne Anhang — Beleg zu …") — ein blosses "enthält" fing sie mit (gemessen: 3 statt
  // 2 Karten). Eine Belegkarte erkennt man daran, dass ihr erster Kindknoten GENAU der Titel ist;
  // der Befund hat gar keinen Elementknoten. Kein eigens gesetztes Attribut: es wäre eine Marke,
  // die nur dieser Test kennt.
  const karten = [...document.querySelectorAll('[data-bib-abschnitt="belege"] li')].filter((li) => {
    const kopf = li.firstElementChild;
    return Boolean(kopf) && gesucht.includes((kopf.textContent ?? "").trim());
  });
  // Der Titel ist der erste Kindknoten der Karte — der Weg über den Baum statt über eine
  // Klassenliste: eine umbenannte Utility-Klasse darf diese Messung nicht ins Leere laufen lassen.
  const titel = karten.map((li) => beschriftung(li.firstElementChild));
  const knopf = document.querySelector('[data-bib-beleg-sprung]');
  const fehlSatz = karten
    .flatMap((li) => [...li.querySelectorAll("p")])
    .find((p) => (p.textContent ?? "").trim() === ${JSON.stringify(FEHL_SATZ)}) ?? null;
  return {
    dokumentBreite: document.documentElement.scrollWidth,
    titel,
    knopf: beschriftung(knopf),
    fehlSatz: beschriftung(fehlSatz),
    tabAnschlaegeBisKnopf: 0,
  };
})()`;

/** Steht der Fokus auf dem Sprungknopf? */
const FOKUS_AUF_KNOPF = `(() => {
  const a = document.activeElement;
  return Boolean(a && a.hasAttribute && a.hasAttribute("data-bib-beleg-sprung"));
})()`;

/**
 * Einen Klickzähler am Sprungknopf anbringen — er misst die Vorgabehandlung des Browsers.
 *
 * Der Aufrufer lädt die Seite VORHER neu: ein zweiter Lauf auf derselben Seite hinge sonst einen
 * zweiten Zuhörer an denselben Knopf, und ein einziger Tastendruck zählte zwei (gemessen, Runde 2:
 * T2 meldete 2 statt 1).
 */
const ZAEHLER_ANBRINGEN = `(() => {
  const knopf = document.querySelector('[data-bib-beleg-sprung]');
  window.__klicks = 0;
  knopf.addEventListener("click", () => { window.__klicks += 1; });
  knopf.focus();
  return document.activeElement === knopf;
})()`;

const BUEHNE = "http://belegkarte.pruefstand/";
let seitenInhalt = "";
let browser: Browser | null = null;
/** EINE Seite für alle Fälle: mit `--single-process --no-zygote` endet der Browser mit ihr. */
let seite: Page | null = null;
let vorrat: { html: string; css: string } | null = null;
const messungen = new Map<number, Messung>();

async function messen(breite: number): Promise<Messung> {
  const vorhanden = messungen.get(breite);
  if (vorhanden) {
    return vorhanden;
  }
  if (!vorrat) {
    const html = await belegflaechenMarkup();
    vorrat = { html, css: await stylesheet(html) };
  }
  const s = seite as Page;
  await s.setViewportSize({ width: breite, height: 844 });
  seitenInhalt = `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>${vorrat.css}</style></head><body>${vorrat.html}</body></html>`;
  await s.goto(`${BUEHNE}wissen/ko-1`);
  const messung = await s.evaluate<Messung>(MESSUNG);
  // Die Tastaturfolge am echten Browser: `Tab` durch die Fläche, bis der Knopf den Fokus hat.
  let anschlaege = 0;
  for (let i = 1; i <= 60 && anschlaege === 0; i++) {
    await s.keyboard.press("Tab");
    if (await s.evaluate<boolean>(FOKUS_AUF_KNOPF)) {
      anschlaege = i;
    }
  }
  messung.tabAnschlaegeBisKnopf = anschlaege;
  messungen.set(breite, messung);
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
  await seite.route("**/*", (route) =>
    route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: seitenInhalt }),
  );
}, 120_000);

afterAll(async () => {
  await schliesseChromium(
    "tests/ux25-beleg-zum-original/belegkarte-schmal-chromium.test.tsx",
    browser,
  );
}, 60_000);

for (const breite of [320, 360, 390]) {
  describe(`JOB 3272 · UX-25 · Belegkarte bei ${breite} px`, () => {
    it("S1 · beide Belegnamen stehen VOLLSTÄNDIG da — nichts ist abgeschnitten", async () => {
      const m = await messen(breite);
      expect(m.titel).toHaveLength(2);
      for (const t of m.titel) {
        expect(t, "eine Belegkarte hat keinen Titelknoten").not.toBeNull();
        // Der Kern der Zusage: sichtbarer Text und Text im DOM sind deckungsgleich. Mit `truncate`
        // stünde hier ein gekürzter Anfang, und die unterscheidenden Enden fehlten.
        expect((t as Beschriftung).sichtbar, `verborgen: „${(t as Beschriftung).voll}“`).toBe(
          (t as Beschriftung).voll,
        );
      }
      // Und die beiden Karten sind sichtbar UNTERSCHEIDBAR — sie gehen erst spät auseinander.
      const sichtbar = m.titel.map((t) => (t as Beschriftung).sichtbar);
      expect(sichtbar[0]).not.toBe(sichtbar[1]);
      // Mehrzeilig ist erlaubt, einzeilig-gekürzt nicht: der Titel darf umbrechen.
      for (const t of m.titel) {
        expect((t as Beschriftung).hoehe, "der Titel ist auf eine Zeile gepresst").toBeGreaterThan(
          20,
        );
      }
    });

    it("S2 · der Weg zum Original ist sichtbar, vollständig beschriftet und tastaturerreichbar", async () => {
      const m = await messen(breite);
      const k = m.knopf;
      expect(k, "kein Sprungknopf auf der Fläche").not.toBeNull();
      const knopf = k as Beschriftung;
      // Sichtbar heißt messbar sichtbar: ein Kasten mit Fläche, nicht 0×0 und nicht weggeklippt.
      expect(knopf.breite, "der Knopf hat keine Breite").toBeGreaterThan(0);
      expect(knopf.hoehe, "der Knopf hat keine Höhe").toBeGreaterThan(0);
      expect(knopf.sichtbar, `Beschriftung gekürzt: „${knopf.voll}“`).toBe(knopf.voll);
      expect(knopf.voll).toBe(i18n.t("ko.evidenceToOriginal"));
      // Und er liegt in der Tabulator-Reihenfolge — ohne Maus erreichbar.
      expect(
        m.tabAnschlaegeBisKnopf,
        "der Sprungknopf war in 60 Tab-Anschlägen nicht erreichbar — nur mit der Maus",
      ).toBeGreaterThan(0);
    });

    it("S3 · der ehrliche Satz steht ebenfalls ganz da, wo kein Original mehr hängt", async () => {
      const m = await messen(breite);
      expect(m.fehlSatz, "der Satz „Original nicht mehr an diesem Objekt“ fehlt").not.toBeNull();
      const satz = m.fehlSatz as Beschriftung;
      expect(satz.breite).toBeGreaterThan(0);
      expect(satz.hoehe).toBeGreaterThan(0);
      expect(satz.sichtbar, `der Satz ist gekürzt: „${satz.voll}“`).toBe(satz.voll);
    });

    it("S4 · die Belegfläche läuft nicht waagerecht über", async () => {
      const m = await messen(breite);
      // Ein Dokument, das breiter ist als das Fenster, schiebt den Inhalt seitlich weg — dann hilft
      // auch ein vollständiger Titel nichts, weil man ihn wegschieben muss, um ihn zu lesen.
      expect(
        m.dokumentBreite,
        `die Fläche ist ${m.dokumentBreite} px breit, das Fenster ${breite} px`,
      ).toBeLessThanOrEqual(breite);
    });
  });
}

// ------------------------------------------------------------------------------------------------
// 4 · Die Taste selbst — der Fall, den jsdom nachweislich nicht messen kann
// ------------------------------------------------------------------------------------------------
/** Frische Seite, Zähler am Knopf, Fokus darauf — die Ausgangslage jedes Tastenfalls. */
async function knopfMitZaehler(): Promise<Page> {
  await messen(390);
  const s = seite as Page;
  await s.goto(`${BUEHNE}wissen/ko-1`);
  expect(await s.evaluate<boolean>(ZAEHLER_ANBRINGEN), "der Knopf nimmt den Fokus nicht an").toBe(
    true,
  );
  return s;
}

describe("JOB 3272 · UX-25 · Tastaturbedienung im echten Browser", () => {
  it("T1 · Enter auf dem Sprungknopf löst wirklich einen Klick aus", async () => {
    const s = await knopfMitZaehler();
    await s.keyboard.press("Enter");
    expect(
      await s.evaluate<number>("window.__klicks"),
      "Enter auf dem Knopf bewirkt nichts — der Weg ist nur mit der Maus begehbar",
    ).toBe(1);
  });

  it("T2 · und die Leertaste ebenso", async () => {
    const s = await knopfMitZaehler();
    await s.keyboard.press("Space");
    expect(
      await s.evaluate<number>("window.__klicks"),
      "die Leertaste auf dem Knopf bewirkt nichts",
    ).toBe(1);
  });
});
