// @vitest-environment jsdom
// ================================================================================================
// R-0446 / R-1812 — DER NULLTREFFER SAGT, WORIN NICHTS GEFUNDEN WURDE.
// ================================================================================================
// Die Ortszeile über dem Suchfeld („Meine Ablage" | „Alle Inhalte", JOB 381) nennt den Bestand,
// solange man hinschaut. Der Nulltreffer selbst sagte bis hierher nur „Nichts gefunden." — und
// beantwortete damit nicht die Frage, die ein Mensch an dieser Stelle hat: WO wurde gesucht? Wer in
// der eigenen Ablage sucht, meint plausibel den Gesamtbestand; dorthin führt jetzt ein benannter
// Knopf, der nur den Bereich umschaltet und Suchwort und Filter stehen lässt.
//
// GEMESSEN WIRD AN DER GEMOUNTETEN SEITE (`pages/Library`), dieselbe Bauform wie
// `tests/bibliothek-leer-oder-eingegrenzt/leersatz-sagt-die-wahrheit.test.tsx`. Der erste Absatz
// unter `bib-leer` bleibt der Satz selbst — die bestehenden Wächter lesen genau ihn.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";

function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko",
    title: "Titel",
    statement: "",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "validiert",
    version: 1,
    originalAuthor: "u9",
    author: "u9",
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-07-20T00:00:00.000Z",
    history: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

const BESTAND = [
  ko({ id: "a", title: "Alpha Ventil", category: "Anlage 1", tags: ["ventil"] }),
  ko({ id: "b", title: "Beta Pumpe", category: "Anlage 2", tags: ["pumpe"] }),
];

const abfrage = (data: unknown): Record<string, unknown> => ({
  data,
  isLoading: false,
  isError: false,
  isPaused: false,
  isRefetchError: false,
  fetchStatus: "idle",
  dataUpdatedAt: data === undefined ? 0 : Date.parse("2026-09-12T09:00:00.000Z"),
});

const lage = vi.hoisted(() => ({
  suche: {} as Record<string, unknown>,
  bestand: {} as Record<string, unknown>,
}));

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    koQueryKey: ["kos", undefined],
    useKos: () => ({ ...lage.bestand, error: null }),
    useLibrarySearch: () => ({ ...lage.suche, error: null }),
    useDirectory: () => ok([]),
    useConflicts: () => ok([]),
    useEigeneBefunde: () => ok([]),
    useKo: () => ({ data: undefined, isLoading: true, isError: false, error: null }),
    useAudit: () => ok([]),
  };
});
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u1", role: "experte" } }),
}));
vi.mock("../../apps/web/src/app/RoleContext", () => ({ useRole: () => ({ role: "experte" }) }));
vi.mock("../../apps/web/src/app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { Library } from "../../apps/web/src/pages/Library";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

function mount(adresse: string): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  const neu = createRoot(container);
  root = neu;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    neu.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: [adresse] }, createElement(Library)),
      ),
    );
  });
}

const text = (el: Element | null | undefined): string =>
  (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const leersatz = (): string => text(container.querySelector('[data-testid="bib-leer"] p'));
const raumzeile = (): HTMLElement | null =>
  container.querySelector<HTMLElement>('[data-testid="bib-leer-raum"]');
const andererRaum = (): HTMLButtonElement | null =>
  container.querySelector<HTMLButtonElement>('[data-testid="bib-leer-anderer-raum"]');

beforeEach(async () => {
  await i18n.changeLanguage("de");
  lage.bestand = abfrage(BESTAND);
  lage.suche = abfrage([]);
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  container?.remove();
  root = null;
});

describe("R-0446 · der Nulltreffer nennt den Suchraum", () => {
  it("S1 · „Alle Inhalte“: der Satz bleibt, darunter steht, worin gesucht wurde — ohne Gegenweg", () => {
    mount("/bibliothek?q=gibtesnicht");
    expect(leersatz()).toBe(i18n.t("lib.liste.leerSuche"));
    expect(text(raumzeile())).toBe("Gesucht in: Alle Inhalte");
    expect(andererRaum(), "„Alle Inhalte“ enthält die Ablage — kein Weg zurück nötig").toBeNull();
  });

  it("S2 · „Meine Ablage“: der Raum ist genannt, und der benannte Weg führt in „Alle Inhalte“", () => {
    mount("/bibliothek?raum=meine&q=gibtesnicht");
    expect(leersatz()).toBe(i18n.t("lib.liste.leerSuche"));
    expect(text(raumzeile())).toContain("Gesucht in: Meine Ablage");
    const knopf = andererRaum();
    expect(knopf, "der Weg in den Gesamtbestand fehlt").not.toBeNull();
    expect(text(knopf)).toBe("In „Alle Inhalte“ suchen");
    expect(knopf?.getAttribute("type")).toBe("button");

    act(() => knopf?.click());

    // Der Bereich hat gewechselt (Ortszeile und Nulltreffer sagen dasselbe), das Suchwort steht noch.
    const ortszeile = container.querySelector('[data-testid="library-scope-bar"]');
    expect(ortszeile?.getAttribute("data-raum")).toBe("alle");
    expect(
      container.querySelector('[data-testid="bib-scope-alle"]')?.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(text(raumzeile())).toBe("Gesucht in: Alle Inhalte");
    expect(andererRaum()).toBeNull();
    expect(container.querySelector<HTMLInputElement>("#bib-suche")?.value).toBe("gibtesnicht");
  });

  it("S3 · ein leerer Bestand ohne Eingrenzung bekommt KEINE Ortsangabe — dort wurde nichts gesucht", () => {
    lage.bestand = abfrage([]);
    mount("/bibliothek");
    expect(leersatz()).toBe(i18n.t("lib.liste.leer"));
    expect(raumzeile()).toBeNull();
  });

  it("S4 · mit Treffern steht weder Leersatz noch Ortsangabe da", () => {
    lage.suche = abfrage(BESTAND);
    mount("/bibliothek?q=ventil");
    expect(container.querySelector('[data-testid="bib-leer"]')).toBeNull();
    expect(raumzeile()).toBeNull();
  });

  it("S5 · EN und NL tragen eigene Sätze mit dem Platzhalter, keine stille DE-Kopie", async () => {
    for (const sprache of ["en", "nl"] as const) {
      for (const schluessel of ["lib.liste.leerRaum", "lib.liste.leerAndererRaum"]) {
        const wert = i18n.getResource(sprache, "translation", schluessel) as unknown;
        expect(typeof wert, `${sprache} · ${schluessel}`).toBe("string");
        expect(wert as string).toContain("{{raum}}");
        expect(wert).not.toBe(i18n.getResource("de", "translation", schluessel));
      }
    }
    await i18n.changeLanguage("en");
    mount("/bibliothek?raum=meine&q=nothing");
    expect(text(raumzeile())).toContain("Searched in: My collection");
    expect(text(andererRaum())).toBe("Search in “All content”");
  });
});
