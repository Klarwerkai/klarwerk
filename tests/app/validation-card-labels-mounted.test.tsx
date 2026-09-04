// @vitest-environment jsdom
// ================================================================================================
// JOB 1100 · D-033 → JOB 3061 · H2 — DIE ANGABEN DER PRÜFKARTE, AN IHREN NEUEN ORTEN.
// ================================================================================================
//
// WAS DIESER WÄCHTER URSPRÜNGLICH HIELT (D-033): Die Etikettenzeile der Prüfkarte trug acht
// Plaketten nebeneinander, darunter drei belegte Redundanzen — die nichtssagende Status-Pille, das
// doppelte Paar „Vertrauen N" / „X von Y grün" und eine unbeschriftete Kategorie. Er pinnte die
// Verdichtung und dass dabei KEINE Angabe verschwindet.
//
// WAS SICH MIT JOB 3061 GEÄNDERT HAT — und warum dieser Wächter bleibt: Die Etikettenzeile selbst
// ist entfallen (`data-testid="validation-card-labels"` gibt es nicht mehr). Das Mockup
// `design/klarwerk/Pruefen.dc.html` zeigt auf der Karte Pille, Meta, Titel, Text, Quellen-Chips und
// das Fußband — sonst nichts. Alle Prüfsignale wohnen im aufklappbaren „Mehr" darunter.
//
// Die FRAGE von D-033 ist damit nicht beantwortet, sondern verschoben: „Ist eine Angabe beim
// Aufräumen verlorengegangen?" Genau die stellt diese Datei weiter — nur am neuen Ort. Sie prüft
// zusätzlich die Zusicherung, die H2 neu macht: GESCHLOSSEN steht keine dieser Angaben auf der
// Fläche, AUFGEKLAPPT stehen sie alle da. Die drei Aussagen von D-033 (Prüfstand statt
// Status-Pille · Vertrauen und Stimmen zusammen · Kategorie beschriftet) bleiben wörtlich erhalten.
//
// GEMESSEN WIRD AM ECHTEN BAUM, NICHT AM QUELLTEXT.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Die Endpunkte, die die Prüffläche zieht — explizit gemockt, damit kein Netz und keine Kulisse
// aus einem globalen Setup den Ausgang bestimmt. `board` und `directory` werden je Fall gesetzt.
// JOB 3061: die drei übrigen Reiter zählen aus echten Abrufen und brauchen deshalb ihren Mock.
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    validation: { board: vi.fn(async () => []), overview: vi.fn(async () => []) },
    directory: { list: vi.fn(async () => []) },
    reasoner: {
      status: vi.fn(async () => ({
        active: false,
        mode: "none",
        reachable: "unknown",
        tasks: {},
      })),
    },
    ko: {
      act: vi.fn(async () => ({})),
      aiCheckRetry: vi.fn(async () => ({})),
      remove: vi.fn(async () => ({})),
    },
    conflicts: { list: vi.fn(async () => []) },
    duplicates: { list: vi.fn(async () => []) },
    lifecycle: { pending: vi.fn(async () => []) },
  },
}));

vi.mock("../../apps/web/src/app/AuthContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/app/AuthContext")>()),
  useSession: () => ({ user: { id: "u1", name: "Prüfer" }, isLoading: false }) as never,
}));
vi.mock("../../apps/web/src/app/RoleContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/app/RoleContext")>()),
  useRole: () => ({ role: "admin", stufe2: true, setStufe2: () => {} }) as never,
}));
vi.mock("../../apps/web/src/app/ToastContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/app/ToastContext")>()),
  useToast: () => ({ push: () => {} }) as never,
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
// i18n VOR der Seite: initialisiert react-i18next global.
import i18n from "../../apps/web/src/i18n";
import { Validation } from "../../apps/web/src/pages/Validation";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const de = (key: string, vars?: Record<string, unknown>): string =>
  vars ? String(i18n.t(key, vars)) : String(i18n.getResource("de", "translation", key));

/** Das „Mehr" der einen Karte — der neue Ort aller Prüfsignale. */
const MEHR = '[data-testid="pruefen-mehr-karte"]';

/**
 * Ein Board-Objekt mit EXAKT den Pflichtangaben: keine KI-Prüfung, keine roten Stimmen, keine
 * veralteten Stimmen, kein Erstellungsdatum.
 */
function schlichtesKo(over: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "k1",
    title: "PROBE-KO Ventilwartung",
    statement: "Aussage",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Wartung",
    tags: [],
    confidence: 50,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "u1",
    author: "u1",
    neededValidations: 3,
    assignments: [],
    reviewVotes: { up: 0, warn: 0, down: 0 },
    staleVotes: 0,
    asset: null,
    history: [],
    ...over,
  } as unknown as KnowledgeObject;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

async function mountMit(items: KnowledgeObject[]): Promise<void> {
  (endpoints.validation.board as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
    items as never,
  );
  (endpoints.directory.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
    { id: "u1", name: "Prüfer" },
  ] as never);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          { initialEntries: ["/validierung"] },
          createElement(Validation),
        ),
      ),
    );
  });
  for (let i = 0; i < 8 && !(container.textContent ?? "").includes("PROBE-KO"); i += 1) {
    await flush();
  }
}

/** Das „Mehr" öffnen, wie ein Mensch es öffnet. */
async function aufklappen(): Promise<void> {
  await act(async () => {
    for (const d of container.querySelectorAll("details")) {
      d.open = true;
    }
  });
}

/** Der Inhalt des „Mehr" (leer, solange niemand aufgeklappt hat — dann steht er nur im DOM). */
function mehr(): HTMLElement {
  const el = container.querySelector(MEHR);
  if (!(el instanceof HTMLElement)) {
    throw new Error("Mehr-Aufklapper nicht gefunden — trägt die Karte ihren Informationsort?");
  }
  return el;
}

/** Die Zeilen/Blöcke des „Mehr" — die Nachfolger der alten Etiketten. */
function angaben(): HTMLElement[] {
  const rumpf = mehr().querySelector(":scope > div");
  return [...(rumpf?.children ?? [])].filter(
    (c): c is HTMLElement => c instanceof HTMLElement && (c.textContent ?? "").trim().length > 0,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  vi.clearAllMocks();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

// ================================================================================================
// A1 · KALIBRIERUNG — die Karte rendert überhaupt
// ================================================================================================
describe("JOB 1100 · D-033 · A1: die Prüffläche rendert eine Karte", () => {
  it("die Karte trägt Titel, Text und einen Informationsort „Mehr“", async () => {
    await mountMit([schlichtesKo()]);

    expect(container.textContent).toContain("PROBE-KO Ventilwartung");
    expect(container.querySelectorAll('[data-testid="validation-row"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-testid="pruefen-karte"]')).toHaveLength(1);
    await aufklappen();
    expect(angaben().length).toBeGreaterThan(0);
  });
});

// ================================================================================================
// H2 · DIE NEUE ZUSICHERUNG — geschlossen sagt die Karte nichts von alledem
// ================================================================================================
//
// Das ist der Kern von JOB 3061: Der Prüfer sieht Titel, Text und die Entscheidung. Die Signale
// stehen im DOM (ein `<details>` versteckt sie nicht per CSS, der Browser rendert sie schlicht
// nicht) — sichtbar werden sie erst auf Klick. Gemessen wird hier die DOM-Lage, weil jsdom kein
// Layout kennt; die SICHTBARKEIT misst der Textmesser in `tests/design/zielbild-h2-pruefen.test.ts`
// am echten Chromium.
describe("JOB 3061 · H2: die Signale liegen im geschlossenen „Mehr“, nicht auf der Fläche", () => {
  it("das „Mehr“ ist im Auslieferungszustand ZU", async () => {
    await mountMit([schlichtesKo()]);

    expect((mehr() as HTMLDetailsElement).open).toBe(false);
  });

  it("Titel und Text der Karte stehen dagegen ohne jeden Klick da", async () => {
    await mountMit([schlichtesKo({ statement: "Ventil vor der Wartung entlasten." })]);

    expect(container.querySelector('[data-testid="pruefen-karte-text"]')?.textContent).toContain(
      "Ventil vor der Wartung entlasten.",
    );
  });
});

// ================================================================================================
// A2 · PFLICHT 1 — der feinere Prüfstand steht da, die grobe Status-Pille nicht
// ================================================================================================
describe("JOB 1100 · D-033 · A2: Prüfstand statt Status-Pille", () => {
  it("das „Mehr“ trägt den Prüfstand", async () => {
    await mountMit([schlichtesKo()]);
    await aufklappen();

    // `trust: 0` und keine Zuweisung ⇒ `reviewWorkView` liefert den Zustand „neu erfasst".
    expect(mehr().textContent).toContain(de("val.reviewState.new"));
  });

  it("die Status-Pille steht nirgends auf der Karte", async () => {
    await mountMit([schlichtesKo()]);
    await aufklappen();

    expect(container.querySelector('[data-testid="pruefen-karte"]')?.textContent).not.toContain(
      de("status.offen"),
    );
  });

  it("der Prüfstand steht auf der Karte genau EINMAL", async () => {
    await mountMit([schlichtesKo()]);
    await aufklappen();

    const treffer = (container.textContent ?? "").split(de("val.reviewState.new")).length - 1;
    expect(treffer).toBe(1);
  });
});

// ================================================================================================
// A3 · PFLICHT 2a — Vertrauen und Grünanteil bleiben beide lesbar
// ================================================================================================
describe("JOB 1100 · D-033 · A3: Vertrauen und Grünanteil", () => {
  it("beide Zahlen bleiben lesbar — Streichen wäre ein echter Verlust", async () => {
    await mountMit([schlichtesKo({ trust: 42, reviewVotes: { up: 2, warn: 0, down: 0 } })]);
    await aufklappen();

    const text = mehr().textContent ?? "";
    expect(text).toContain(de("val.trust"));
    expect(text).toContain("42");
    expect(text).toContain(de("val.votes", { have: 2, need: 3 }));
  });

  it("der Grünanteil ist zusätzlich OHNE Aufklappen ablesbar — als die drei Punkte im Fuß", async () => {
    // JOB 3061 · H2, Pruefen.dc.html:60: der Fortschritt ist die einzige Angabe, die das Mockup
    // dauerhaft zeigt — als Punkte, nicht als Text. Sie sind damit NICHT verlorengegangen, sondern
    // an die Stelle gerückt, an der die Entscheidung fällt.
    await mountMit([schlichtesKo({ reviewVotes: { up: 2, warn: 0, down: 0 } })]);

    const punkte = container.querySelectorAll('[data-testid="pruefen-stimmenpunkte"] > span');
    expect(punkte).toHaveLength(3);
    expect([...punkte].filter((p) => p.getAttribute("data-punkt") === "gruen")).toHaveLength(2);
  });
});

// ================================================================================================
// A4 · PFLICHT 2b — die Kategorie sagt, dass sie eine Kategorie ist
// ================================================================================================
describe("JOB 1100 · D-033 · A4: die Kategorie ist beschriftet", () => {
  it("die Kategorie trägt ihr Beschriftungswort", async () => {
    await mountMit([schlichtesKo({ category: "Wartung" })]);
    await aufklappen();

    const kategorie = angaben().find((e) => (e.textContent ?? "").includes("Wartung"));
    expect(kategorie?.textContent).toContain(de("lib.facet.category"));
  });

  it("der Kategoriewert selbst bleibt unverändert lesbar", async () => {
    await mountMit([schlichtesKo({ category: "Anlage 1" })]);
    await aufklappen();

    expect(mehr().textContent).toContain("Anlage 1");
  });
});

// ================================================================================================
// A5 · PFLICHT 3 — nichts ist verlorengegangen
// ================================================================================================
describe("JOB 1100 · D-033 · A5: die bedingten Angaben bleiben erreichbar", () => {
  it("rote Stimmen erscheinen weiterhin", async () => {
    await mountMit([schlichtesKo({ reviewVotes: { up: 0, warn: 0, down: 2 } })]);
    await aufklappen();

    expect(mehr().textContent).toContain(de("val.votesBlocked", { count: 2 }));
  });

  it("veraltete Stimmen erscheinen weiterhin", async () => {
    await mountMit([schlichtesKo({ staleVotes: 3 })]);
    await aufklappen();

    expect(mehr().textContent).toContain(de("val.staleVotes", { count: 3 }));
  });

  it("die Wissensart bleibt erreichbar", async () => {
    await mountMit([schlichtesKo()]);
    await aufklappen();

    expect(mehr().textContent).toContain(de("ktype.best_practice"));
  });
});

// ================================================================================================
// A6 · DIE VERDICHTUNG IST MESSBAR — festes Fixture, feste Zahl
// ================================================================================================
//
// Gepinnt wird jetzt die Zahl der ANGABEN im „Mehr" statt der Etiketten in der entfallenen Zeile.
// Die Grösse bleibt dieselbe: sie wandert nicht unbemerkt. Die elf sind
//   Vertrauen · Fortschritt · Prüfstand · KI-Prüfung · Vertraulichkeit · Erfassungsweg ·
//   Kategorie/Art/Tags · Entscheidungswirkung · Prüfkontext · Autor · Erstellt (Datum + Ersteller).
// Die letzte ist BEDINGT: sie erscheint nur, wenn Datum ODER Ersteller vorliegt. Im Fixture liegt
// der Ersteller vor (`author: "u1"` → „Prüfer" aus dem Verzeichnis), das Datum nicht — genau der
// Fall des ehrlichen Weglassens aus WP-D10 Fix 4.
describe("JOB 1100 · D-033 · A6: die Zahl der Angaben ist gepinnt", () => {
  it("schlichtes Objekt: elf Angaben im „Mehr“", async () => {
    await mountMit([schlichtesKo()]);
    await aufklappen();

    expect(angaben()).toHaveLength(11);
  });

  it("die bedingten Angaben kommen INNERHALB ihrer Zeile dazu, nicht als neue Zeile", async () => {
    // Rote und veraltete Stimmen standen vor H2 als eigene Etiketten daneben; jetzt stehen sie in
    // der Fortschrittszeile. Die Zahl der Zeilen bleibt deshalb elf — der Inhalt wächst.
    await mountMit([schlichtesKo({ reviewVotes: { up: 0, warn: 0, down: 1 }, staleVotes: 2 })]);
    await aufklappen();

    expect(angaben()).toHaveLength(11);
    expect(mehr().textContent).toContain(de("val.votesBlocked", { count: 1 }));
    expect(mehr().textContent).toContain(de("val.staleVotes", { count: 2 }));
  });
});
