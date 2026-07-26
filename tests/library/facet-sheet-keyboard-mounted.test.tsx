// @vitest-environment jsdom
// AUFTRAG-mega10 Block B Punkt 6: das Filterblatt auf schmalen Geräten.
//
// Der Auftrag ist hier ausdrücklich: „schreib von Anfang an einen Test, der belegt, dass man die
// Filter im geöffneten Blatt PER TASTATUR ERREICHT — nicht nur, dass man nicht herauskommt. Genau
// diese Gegenrichtung hat uns der E2E-Bericht um die Ohren gehauen." Deshalb prüft diese Datei
// zuerst die ERREICHBARKEIT (sind die echten Filter-Bedienelemente im Fokus-Ring drin?) und erst
// danach die Falle.
//
// EHRLICHE GRENZE (wie beim Navigations-Drawer): jsdom rechnet kein Layout und bewegt den Fokus
// NICHT bei einem Tab-Tastendruck (keine native Tab-Navigation). Der Test spielt daher nicht „25×
// Tab" nach, sondern belegt die zwei in jsdom belegbaren Dinge: (1) die Filter-Bedienelemente sind
// tatsächlich fokussierbare Elemente im Blatt und einzeln fokussierbar, (2) die Fokusfalle greift
// nur an den Rändern und lässt die Mitte in Ruhe.
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

// Genug Autoren, damit die Autoren-Dimension über dem Deckel liegt und ein SUCHFELD bekommt —
// dieses Feld ist das eigentliche neue Bedienelement, dessen Erreichbarkeit hier zählt.
const KOS = [
  ...Array.from({ length: 12 }, (_, i) =>
    ko({
      id: `a${i}`,
      title: `Beitrag ${i}`,
      author: `u${i}`,
      originalAuthor: `u${i}`,
      category: i % 2 === 0 ? "Anlage 1" : "Anlage 2",
      tags: [i % 2 === 0 ? "ventil" : "pumpe"],
    }),
  ),
];

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

// BEWUSST dupliziert (wie im Drawer-Test): weicht der Selektor in der Komponente still auf, fällt
// es hier auf, statt unbemerkt die Erreichbarkeit zu verkleinern.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

// Schmaler Bildschirm: useMediaQuery liest window.matchMedia — deterministisch stubbar.
function stubNarrow(matches: boolean): void {
  (globalThis as unknown as { matchMedia: unknown }).matchMedia = (query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

function mount(): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: ["/bibliothek"] }, createElement(Library)),
      ),
    );
  });
}

function res(key: string): string {
  return String(i18n.getResource("de", "translation", key));
}

function byAria(label: string): HTMLElement {
  const el = container.querySelector(`[aria-label="${label}"]`);
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Element mit aria-label „${label}“ fehlt`);
  }
  return el;
}

function trigger(): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(res("facet.openFilters")),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Filter-Knopf fehlt; DOM: ${container.textContent}`);
  }
  return btn;
}

function sheet(): HTMLDialogElement {
  const el = container.querySelector("dialog");
  if (!(el instanceof HTMLDialogElement)) {
    throw new Error(`Filterblatt fehlt; DOM: ${container.textContent}`);
  }
  return el;
}

function focusablesInSheet(): HTMLElement[] {
  return [...sheet().querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (el) => !el.hasAttribute("hidden") && el.closest("[hidden],[aria-hidden='true']") === null,
  );
}

function pressTab(on: HTMLElement, shiftKey = false): boolean {
  const ev = new KeyboardEvent("keydown", {
    key: "Tab",
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    on.dispatchEvent(ev);
  });
  return ev.defaultPrevented;
}

function openSheet(): void {
  act(() => {
    trigger().click();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
  stubNarrow(true);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  window.localStorage.clear();
});

describe("Block B Punkt 6: Filterblatt auf schmalen Geräten", () => {
  it("zeigt auf schmalen Geräten den Knopf „Filter“ statt der Schiene", () => {
    mount();
    expect(trigger()).toBeTruthy();
    expect(container.querySelector("dialog")).toBeNull();
  });

  it("ERREICHBARKEIT: die echten Filter-Bedienelemente liegen im Fokus-Ring des Blattes", () => {
    mount();
    openSheet();
    const focusables = focusablesInSheet();

    // Mehr als nur der Schließen-Knopf — das ist der Kern der Gegenrichtung.
    expect(focusables.length).toBeGreaterThan(3);
    // Der Schließen-Knopf ist der ERSTE (nicht der einzige).
    expect(focusables[0]?.getAttribute("aria-label")).toBe(res("facet.closeFilters"));

    // Die Volltextsuche der Schiene ist erreichbar.
    expect(focusables.some((el) => el.id === "facet-sheet-search-author")).toBe(true);
    // Mindestens eine echte Facetten-Checkbox ist erreichbar …
    const boxes = focusables.filter(
      (el) => el instanceof HTMLInputElement && el.type === "checkbox",
    );
    expect(boxes.length).toBeGreaterThan(0);
    // … und sie ist EINZELN fokussierbar (nicht nur vorhanden).
    const box = boxes[0] as HTMLInputElement;
    act(() => {
      box.focus();
    });
    expect(document.activeElement).toBe(box);
    expect(box.getAttribute("tabindex")).not.toBe("-1");

    // Der klebende Trefferzähler ist im Blatt die ABSCHLIESSENDE Aktion und ebenfalls erreichbar.
    expect(focusables.some((el) => (el.textContent ?? "").includes("Beiträge anzeigen"))).toBe(
      true,
    );
  });

  it("Fokus fährt beim Öffnen INS Blatt und der Hintergrund wird inert", () => {
    mount();
    openSheet();
    expect(sheet().contains(document.activeElement)).toBe(true);
    // Der Seiteninhalt ist währenddessen nicht fokussierbar.
    const page = container.querySelector("[inert]");
    expect(page).not.toBeNull();
  });

  it("die Fokusfalle greift NUR an den Rändern (die Mitte läuft normal weiter)", () => {
    mount();
    openSheet();
    const focusables = focusablesInSheet();
    const first = focusables[0] as HTMLElement;
    const last = focusables[focusables.length - 1] as HTMLElement;
    const middle = focusables[Math.floor(focusables.length / 2)] as HTMLElement;

    // Mitte: der Handler mischt sich NICHT ein — sonst wäre die Erreichbarkeit nur behauptet.
    act(() => {
      middle.focus();
    });
    expect(pressTab(middle)).toBe(false);

    // Ende → Anfang.
    act(() => {
      last.focus();
    });
    expect(pressTab(last)).toBe(true);
    expect(document.activeElement).toBe(first);

    // Anfang + Shift → Ende.
    act(() => {
      first.focus();
    });
    expect(pressTab(first, true)).toBe(true);
    expect(document.activeElement).toBe(last);
    expect(sheet().contains(document.activeElement)).toBe(true);
  });

  it("Escape schließt und gibt den Fokus an den Auslöser zurück; der Hintergrund lebt wieder", () => {
    mount();
    openSheet();
    act(() => {
      sheet().dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
    });
    expect(container.querySelector("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger());
    expect(container.querySelector("[inert]")).toBeNull();
  });

  it("der Zähler im Blatt schließt es (im Blatt ist er die Aktion, nicht nur ein Anker)", () => {
    mount();
    openSheet();
    const apply = focusablesInSheet().find((el) =>
      (el.textContent ?? "").includes("Beiträge anzeigen"),
    );
    expect(apply).toBeDefined();
    act(() => {
      apply?.click();
    });
    expect(container.querySelector("dialog")).toBeNull();
  });

  it("Filter schließen ist auch über den X-Knopf möglich (Maus-Weg bleibt)", () => {
    mount();
    openSheet();
    act(() => {
      byAria(res("facet.closeFilters")).click();
    });
    expect(container.querySelector("dialog")).toBeNull();
  });
});
