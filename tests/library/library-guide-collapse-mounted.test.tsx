// @vitest-environment jsdom
// AUFTRAG-uxpol5 · Punkt 3 (Pedis „Reife der Treffer"-Erklärbox): die Onboarding-Erklärbox
// (GESICHERT / ZU PRÜFEN) ist einklappbar — beim ERSTEN Besuch offen, danach standardmäßig eingeklappt;
// der Zustand wird pro Browser gemerkt (localStorage). Gepinnt am ECHTEN Library-Mount:
//  (a) erster Besuch: Erklärung offen; Toggle klappt sie ein.
//  (b) „Reload" nach dem ersten Besuch: eingeklappt (Titel bleibt, Erklärung nicht).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";

function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "k1",
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

const KOS = [ko({})];

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

function unmount(): void {
  act(() => {
    root.unmount();
  });
  container.remove();
}

function res(key: string): string {
  return String(i18n.getResource("de", "translation", key));
}

function guideToggle(): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(res("kg.library.title")),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Erklärbox-Toggle fehlt; DOM: ${container.textContent}`);
  }
  return btn;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
});

afterEach(() => {
  unmount();
  window.localStorage.clear();
});

describe("uxpol5: Reife-Erklärbox einklappbar (echter Library-Mount)", () => {
  it("(a) erster Besuch: Erklärung offen; Toggle klappt sie ein (Titel bleibt)", () => {
    mount();
    // Beim ersten Besuch offen: Titel UND Erklärungstext (GESICHERT-Plakette) sichtbar.
    expect(container.textContent).toContain(res("kg.library.title"));
    expect(container.textContent).toContain(res("kg.secured.label"));
    // aria-expanded spiegelt den offenen Zustand.
    expect(guideToggle().getAttribute("aria-expanded")).toBe("true");
    // Einklappen: der Titel bleibt, die Erklärungs-Plakette verschwindet.
    act(() => {
      guideToggle().click();
    });
    expect(container.textContent).toContain(res("kg.library.title"));
    expect(container.textContent).not.toContain(res("kg.secured.label"));
    expect(guideToggle().getAttribute("aria-expanded")).toBe("false");
  });

  it("(b) „Reload“ nach dem ersten Besuch: standardmäßig eingeklappt (Zustand gemerkt)", () => {
    mount(); // erster Besuch schreibt den Dauer-Standard (eingeklappt) fest
    unmount();
    // Frischer Mount über denselben localStorage → jetzt eingeklappt (Titel ja, Erklärung nein).
    mount();
    expect(container.textContent).toContain(res("kg.library.title"));
    expect(container.textContent).not.toContain(res("kg.secured.label"));
    expect(guideToggle().getAttribute("aria-expanded")).toBe("false");
  });

  // AUFTRAG-uxpol6 (bens GELB 3.1): gültige Disclosure-Semantik — die Überschrift ist ein echtes h2,
  // der Button steckt IM h2 (kein block-Element mehr als Button-Kind) und ist über aria-controls mit
  // dem kontrollierten Inhalt (stabile ID) verbunden.
  it("(c) Semantik: h2-Überschrift mit innenliegendem Button, aria-expanded + aria-controls", () => {
    mount();
    // Überschrift ist ein per Überschriftennavigation erreichbares, lesbares h2.
    const heading = [...container.querySelectorAll("h2")].find((h) =>
      (h.textContent ?? "").includes(res("kg.library.title")),
    );
    expect(heading).toBeTruthy();
    // Der Toggle-Button liegt IM h2 (übliches Disclosure-Muster h2 > button) …
    const btn = heading?.querySelector("button");
    expect(btn instanceof HTMLButtonElement).toBe(true);
    // … und enthält selbst KEIN block-Element mehr (Button erlaubt nur phrasing content).
    expect(btn?.querySelector("h1,h2,h3,h4,h5,h6,div,p")).toBeNull();
    // aria-expanded + aria-controls zeigen auf den kontrollierten Inhalt (stabile ID).
    expect(btn?.getAttribute("aria-expanded")).toBe("true");
    const panelId = btn?.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    const panel = panelId ? document.getElementById(panelId) : null;
    expect(panel).toBeTruthy();
    expect(panel?.textContent).toContain(res("kg.secured.label"));
    // Eingeklappt bleibt die Verknüpfung stabil (gleiche ID im aria-controls).
    act(() => {
      guideToggle().click();
    });
    expect(guideToggle().getAttribute("aria-controls")).toBe(panelId);
    expect(guideToggle().getAttribute("aria-expanded")).toBe("false");
  });
});
