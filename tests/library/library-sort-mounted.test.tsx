// @vitest-environment jsdom
// AUFTRAG-sortfilter · Punkt 1: ECHTE, gemountete Library-Seite (nur Netz-Hooks/Contexts sind Stubs).
// Gepinnt am realen Seam:
//  (a) Titel A→Z ordnet die Trefferliste alphabetisch.
//  (b) Trust hoch→niedrig ordnet absteigend.
//  (c) die Sortierung KOMPONIERT mit einem aktiven Facetten-Filter (nur die gefilterte Menge wird sortiert).
//  (d) die Sortier-Wahl überlebt einen frischen Mount (Persistenz über localStorage).
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

const KO_A = ko({ id: "a", title: "Alpha Ventil", trust: 10, category: "Anlage 1" });
const KO_B = ko({ id: "b", title: "Zeta Pumpe", trust: 90, category: "Anlage 2" });
const KO_C = ko({ id: "c", title: "Mittel Dichtung", trust: 50, category: "Anlage 1" });
const KOS = [KO_A, KO_B, KO_C];

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useKos: () => ok(KOS),
    useLibrarySearch: () => ok(KOS),
    useDirectory: () => ok([]),
    useConflicts: () => ok([]),
  };
});
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u1", role: "experte" } }),
}));
vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));
vi.mock("../../apps/web/src/app/ToastContext", () => ({
  useToast: () => ({ push: () => {} }),
}));

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

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(entry = "/bibliothek"): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: [entry] }, createElement(Library)),
      ),
    );
  });
}

function unmount(): void {
  act(() => {
    root.unmount();
  });
  container.remove();
}

function res(key: string): string {
  return String(i18n.getResource("de", "translation", key));
}

function sortSelect(): HTMLSelectElement {
  const el = container.querySelector("#library-sort");
  if (!(el instanceof HTMLSelectElement)) {
    throw new Error(`Sortier-Select fehlt; DOM: ${container.textContent}`);
  }
  return el;
}

function setSort(value: string): void {
  const select = sortSelect();
  act(() => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function pos(title: string): number {
  return (container.textContent ?? "").indexOf(title);
}

// AUFTRAG-mega10 Block B: Facetten-Optionen sind in der Schiene echte Checkboxen im <label>
// (erster <span> = Wert, zweiter = Kontext-Zähler) statt aria-pressed-Chips.
function option(value: string): HTMLInputElement {
  const row = [...container.querySelectorAll("label")].find(
    (l) => l.querySelectorAll("span")[0]?.textContent === value,
  );
  const box = row?.querySelector("input[type=checkbox]");
  if (!(box instanceof HTMLInputElement)) {
    throw new Error(`Option „${value}“ fehlt; DOM: ${container.textContent}`);
  }
  return box;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
});

afterEach(() => {
  unmount();
  window.localStorage.clear();
});

describe("AUFTRAG-sortfilter: gemountete Library-Sortierung (echter Seam)", () => {
  it("(a) Titel A→Z ordnet alphabetisch", () => {
    mount();
    setSort("title");
    expect(pos("Alpha Ventil")).toBeGreaterThanOrEqual(0);
    expect(pos("Alpha Ventil")).toBeLessThan(pos("Mittel Dichtung"));
    expect(pos("Mittel Dichtung")).toBeLessThan(pos("Zeta Pumpe"));
  });

  it("(b) Trust hoch→niedrig ordnet absteigend", () => {
    mount();
    setSort("trust");
    expect(pos("Zeta Pumpe")).toBeGreaterThanOrEqual(0);
    expect(pos("Zeta Pumpe")).toBeLessThan(pos("Mittel Dichtung"));
    expect(pos("Mittel Dichtung")).toBeLessThan(pos("Alpha Ventil"));
  });

  it("(c) Sortierung komponiert mit einem aktiven Facetten-Filter", () => {
    mount();
    // Kategorie „Anlage 1" wählen (nur Alpha + Mittel) …
    act(() => {
      option("Anlage 1").click();
    });
    // … dann Titel A→Z: nur die gefilterte Menge, in alphabetischer Ordnung.
    setSort("title");
    expect(container.textContent).not.toContain("Zeta Pumpe");
    expect(pos("Alpha Ventil")).toBeGreaterThanOrEqual(0);
    expect(pos("Alpha Ventil")).toBeLessThan(pos("Mittel Dichtung"));
    expect(container.textContent).toContain(res("facet.filtered"));
  });

  it("(d) die Sortier-Wahl überlebt einen frischen Mount (Persistenz)", () => {
    mount();
    setSort("title");
    expect(sortSelect().value).toBe("title");
    unmount();
    // „Reload": frischer Mount über denselben localStorage → Wahl bleibt „title" (ohne erneute Auswahl).
    mount();
    expect(sortSelect().value).toBe("title");
    expect(pos("Alpha Ventil")).toBeLessThan(pos("Mittel Dichtung"));
    expect(pos("Mittel Dichtung")).toBeLessThan(pos("Zeta Pumpe"));
  });
});
