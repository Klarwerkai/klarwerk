// @vitest-environment jsdom
// ================================================================================================
// SPEICHERN-ERHOLUNG (Ausbauliste Punkt 6) · K5 — DER NULLTREFFER ZEIGT SEINE FILTER UND LÖST SIE.
// ================================================================================================
//
// Gemessen an der gemounteten Seite (`pages/Library`), dieselbe Bauform wie
// `tests/bibliothek-suchraum/nulltreffer-nennt-suchraum-mounted.test.tsx`. Bis hierher standen die
// aktiven Filter nur in den Menüs und „Alle zurücksetzen" nur im Filtermenü; unter „Nichts gefunden."
// steht jetzt, WELCHE Filter wirken, und ein Knopf setzt sie direkt zurück — der Suchtext bleibt.
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
  dataUpdatedAt: data === undefined ? 0 : Date.parse("2026-10-07T09:00:00.000Z"),
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
const filterzeile = (): HTMLElement | null =>
  container.querySelector<HTMLElement>('[data-testid="bib-leer-filter"]');
const angaben = (): string[] =>
  [...container.querySelectorAll('[data-testid="bib-leer-filter-angabe"]')].map(
    (el) => el.getAttribute("data-filter") ?? "",
  );
const zuruecksetzen = (): HTMLButtonElement | null =>
  container.querySelector<HTMLButtonElement>('[data-testid="bib-leer-filter-reset"]');
const suchfeld = (): string => container.querySelector<HTMLInputElement>("#bib-suche")?.value ?? "";

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

describe("K5 · Nulltreffer: aktive Filter sichtbar, direkt zurücksetzbar, Suchtext bleibt", () => {
  it("F1 · Suchtext + Zustand + Zeitraum ohne Treffer: beide Filter stehen unter „Nichts gefunden.“", () => {
    mount("/bibliothek?q=gibtesnicht&zustand=validiert&von=2020-01-01");
    expect(leersatz()).toBe(i18n.t("lib.liste.leerSuche"));
    const zeile = filterzeile();
    expect(zeile, "die aktiven Filter stehen nicht am Nulltreffer").not.toBeNull();
    expect(text(zeile)).toContain(i18n.t("erholung.filter.aktiv"));
    expect(angaben()).toEqual(["zeitraum", "zustand"]);
    expect(text(zeile)).toContain(`${i18n.t("lib.segment.label")}: ${i18n.t("status.validiert")}`);
    expect(text(zeile)).toContain(`${i18n.t("lib.facet.rangeLabel")}: 2020-01-01`);
    const knopf = zuruecksetzen();
    expect(knopf?.getAttribute("type")).toBe("button");
    expect(text(knopf)).toBe(i18n.t("erholung.filter.zuruecksetzen"));
  });

  it("F2 · ein Klick setzt die Filter zurück — der Suchtext steht weiter im Feld", () => {
    mount("/bibliothek?q=gibtesnicht&zustand=validiert&von=2020-01-01");
    act(() => zuruecksetzen()?.click());

    expect(suchfeld()).toBe("gibtesnicht");
    expect(
      container.querySelector('[data-testid="bib-segment-alle"]')?.getAttribute("aria-pressed"),
    ).toBe("true");
    // Weiter nichts gefunden (der Suchtext wirkt noch) — aber keine Filter mehr, also kein Knopf.
    expect(leersatz()).toBe(i18n.t("lib.liste.leerSuche"));
    expect(filterzeile()).toBeNull();
  });

  it("F3 · nur ein Suchtext, kein Filter: es gibt nichts zurückzusetzen, also keine Filterzeile", () => {
    mount("/bibliothek?q=gibtesnicht");
    expect(leersatz()).toBe(i18n.t("lib.liste.leerSuche"));
    expect(filterzeile()).toBeNull();
    expect(zuruecksetzen()).toBeNull();
  });

  it("F4 · mit Treffern steht weder Leersatz noch Filterzeile da", () => {
    lage.suche = abfrage(BESTAND);
    mount("/bibliothek?q=ventil&zustand=validiert");
    expect(container.querySelector('[data-testid="bib-leer"]')).toBeNull();
    expect(filterzeile()).toBeNull();
  });

  it("F5 · EN und NL tragen eigene Sätze, keine stille DE-Kopie", () => {
    for (const sprache of ["en", "nl"] as const) {
      for (const schluessel of ["erholung.filter.aktiv", "erholung.filter.zuruecksetzen"]) {
        const wert = i18n.getResource(sprache, "translation", schluessel) as unknown;
        expect(typeof wert, `${sprache} · ${schluessel}`).toBe("string");
        expect(wert).not.toBe(i18n.getResource("de", "translation", schluessel));
      }
    }
  });
});
