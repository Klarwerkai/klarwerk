// @vitest-environment jsdom
// AUFTRAG-uxpol2 (bens Blocker 1.2 + 4.2): ECHTER, gemounteter Library-Seam — kein künstliches
// Harness. Die reale Library-Seite wird gerendert (nur die Netz-Hooks/Contexts sind Stubs), sodass
// die ECHTE applyView-Migration und das ECHTE Facetten-Filterverhalten laufen. Gepinnt:
//  (a) Eine alte gespeicherte Sicht `status:"offen"` hält NACH der Migration BEIDE offenen KOs —
//      das unzugewiesene (Anzeigestatus „offen") UND das zugewiesene (Anzeigestatus „pruefung").
//      Eine naive 1:1-Übernahme (status:["offen"]) würde das zugewiesene KO verlieren.
//  (b) Mehrfachauswahl innerhalb der Status-Gruppe wirkt als ODER (ein Status abwählen blendet nur
//      dessen KOs aus; beide gewählt → Vereinigung).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";

function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko",
    title: "Ventil entlasten",
    statement: "",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
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

const KO_OPEN = ko({ id: "k-open", title: "Offen Unzugewiesen", status: "offen", assignments: [] });
const KO_ASSIGNED = ko({
  id: "k-assigned",
  title: "Offen Zugewiesen",
  status: "offen",
  assignments: ["u2"],
});
const KOS = [KO_OPEN, KO_ASSIGNED];

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

function res(key: string): string {
  return String(i18n.getResource("de", "translation", key));
}

// Ein Facetten-Chip (echtes <button> mit „ · N"), gefunden über seinen sichtbaren Text.
function chip(text: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(text),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Chip „${text}" fehlt; DOM: ${container.textContent}`);
  }
  return btn;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  window.localStorage.clear();
});

describe("uxpol2: gemountete Library — Sicht-Migration + ODER-Filter (echter Seam)", () => {
  it('(a) alte Sicht status:"offen" hält BEIDE offenen KOs (unzugewiesen + zugewiesen)', () => {
    // Legacy-Sicht (vor uxpol2) mit rohem Backendstatus — genau der Fall aus bens Blocker 1.2.
    window.localStorage.setItem(
      "klarwerk.library.views.u1",
      JSON.stringify([{ name: "Alt-Offen", state: { status: "offen" } }]),
    );
    mount();
    // Vor dem Anwenden sind beide KOs sichtbar (kein Filter aktiv).
    expect(container.textContent).toContain("Offen Unzugewiesen");
    expect(container.textContent).toContain("Offen Zugewiesen");

    // Die gespeicherte Sicht anwenden (echter applyView-Pfad über das Sichten-Dropdown).
    const select = container.querySelector(
      `select[aria-label="${res("lib.views.label")}"]`,
    ) as HTMLSelectElement | null;
    expect(select).not.toBeNull();
    act(() => {
      (select as HTMLSelectElement).value = "Alt-Offen";
      (select as HTMLSelectElement).dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Filter ist aktiv (Status-Facette), aber BEIDE offenen KOs bleiben sichtbar — semantiktreu.
    expect(container.textContent).toContain(res("facet.filtered"));
    expect(container.textContent).toContain("Offen Unzugewiesen");
    expect(container.textContent).toContain("Offen Zugewiesen"); // würde bei naiver Migration fehlen
  });

  it("(b) ODER innerhalb der Reife-Gruppe: eine Reife abwählen blendet nur deren KOs aus", () => {
    // AUFTRAG-uxpol5 · Punkt 1: die redundante Status-Facette ist entfernt; dasselbe ODER-Verhalten
    // wird jetzt über die primäre Reife-Facette gepinnt (der Kontext-Zähler „ · 1" macht die Chips
    // eindeutig gegenüber der Reife-Plakette/Erklärbox, die dieselben Wörter tragen).
    mount();
    // Nur „Zu prüfen" (Reife · 1) wählen → das zugewiesene (In Prüfung) KO fällt raus.
    act(() => {
      chip(`${res("use.open.label")} · 1`).click();
    });
    expect(container.textContent).toContain("Offen Unzugewiesen");
    expect(container.textContent).not.toContain("Offen Zugewiesen");
    // Reife „In Prüfung" (Kontext-Zähler · 1) ergänzen → ODER-Vereinigung, beide wieder sichtbar.
    act(() => {
      chip(`${res("use.review.label")} · 1`).click();
    });
    expect(container.textContent).toContain("Offen Unzugewiesen");
    expect(container.textContent).toContain("Offen Zugewiesen");
  });
});

// AUFTRAG-uxpol4 (bens ROT 3.1): Die URL-/Parser-Grenze am ECHTEN Seam. Ein Deep-Link mit dem früheren
// Sentinel-String darf den internen No-Match-Zustand NICHT einschleusen — er ist ein ganz normaler,
// entfernbarer Kategoriewert, kein struktureller „0-Treffer"-Zustand.
describe("uxpol4: URL kann den No-Match-Zustand nicht einschleusen (echter Seam)", () => {
  it("?category=<früherer Sentinel> wird als ECHTER Kategoriewert behandelt, nicht als „keine Treffer“", () => {
    const former = "__klarwerk_facet_no_match__";
    mount(`/bibliothek?category=${encodeURIComponent(former)}`);
    // Der frühere Sentinel steht als ECHTER, entfernbarer Facettenwert in der Aktive-Filter-Leiste …
    expect(container.textContent).toContain(res("facet.active"));
    expect(container.textContent).toContain(former);
    // … und NICHT als struktureller No-Match-Hinweis (der ausschließlich aus migrierten Sichten stammt).
    expect(container.textContent).not.toContain(res("facet.noMatch"));
  });
});
