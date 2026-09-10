import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @vitest-environment jsdom
// JOB 3464: echte Auswahlhandlung; kein Effekt auf aktivId oder den Abrufstand.
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import type { KnowledgeObject } from "../../apps/web/src/api/types";

const lage = vi.hoisted(() => ({
  kos: [] as KnowledgeObject[],
  isError: false,
  isLoading: false,
  isFetching: false,
  act: vi.fn().mockResolvedValue({}),
}));
vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = (data: unknown) => ({ data, isLoading: false, isError: false });
  return {
    useValidationBoard: () => ({
      ...ok(lage.kos),
      isError: lage.isError,
      isLoading: lage.isLoading,
      isFetching: lage.isFetching,
    }),
    useDirectory: () => ok([]),
    useReasonerStatus: () => ok({ active: false, mode: "deterministic" }),
    useConflicts: () => ok([]),
    useDuplicates: () => ok([]),
    useLifecyclePending: () => ok([]),
  };
});
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u1", role: "experte" } }),
}));
vi.mock("../../apps/web/src/app/RoleContext", () => ({ useRole: () => ({ role: "experte" }) }));
vi.mock("../../apps/web/src/app/ToastContext", () => ({ useToast: () => ({ push: vi.fn() }) }));
vi.mock("../../apps/web/src/api/endpoints", async (original) => {
  const echt = await original<typeof import("../../apps/web/src/api/endpoints")>();
  return { ...echt, endpoints: { ...echt.endpoints, ko: { ...echt.endpoints.ko, act: lage.act } } };
});

import { ModalBoundaryProvider } from "../../apps/web/src/app/ModalBoundaryContext";
import i18n from "../../apps/web/src/i18n";
import { Validation } from "../../apps/web/src/pages/Validation";
import { NARROW_QUERY } from "../../apps/web/src/shell/useMediaQuery";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
let qc: QueryClient;
const springen = vi.fn();
const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");

function zeichnen(): void {
  act(() =>
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          { initialEntries: ["/validierung"] },
          createElement(ModalBoundaryProvider, {
            hostRef: { current: container },
            children: createElement(Validation),
          }),
        ),
      ),
    ),
  );
}
function element<T extends HTMLElement = HTMLElement>(selector: string): T {
  const el = container.querySelector<T>(selector);
  expect(el, selector).not.toBeNull();
  return el as T;
}
function karte(): HTMLElement {
  return element('[data-testid="pruefen-karte"]');
}
function zeilen(): HTMLButtonElement[] {
  return [
    ...container.querySelectorAll<HTMLButtonElement>(
      '[data-testid="pruefen-warteschlange-eintrag"]',
    ),
  ];
}
async function klick(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
function mount(schmal = true): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === NARROW_QUERY && schmal,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  zeichnen();
  expect(zeilen()).toHaveLength(3);
}
beforeEach(() => {
  lage.kos = ["Alpha", "Beta", "Gamma"].map(
    (title, i) =>
      ({
        id: `ko-${i}`,
        title,
        statement: `Aussage ${title}`,
        conditions: [],
        measures: [],
        type: "best_practice",
        category: "Anlage",
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
        createdAt: "2026-08-12T00:00:00.000Z",
        history: [],
        confidentiality: "intern",
        confidentialityProvenance: "ko",
      }) as unknown as KnowledgeObject,
  );
  lage.isError = false;
  lage.isLoading = false;
  lage.isFetching = false;
  lage.act.mockClear();
  springen.mockClear();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: springen,
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  act(() => root.unmount());
  qc.clear();
  container.remove();
  vi.unstubAllGlobals();
  if (originalScroll)
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalScroll);
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

describe("JOB 3464 · bewusste Auswahl", () => {
  it("schmal: eine Auswahl springt genau einmal zum gewählten Prüfbereich", async () => {
    mount();
    const letzte = zeilen().at(-1) as HTMLButtonElement;
    await klick(letzte);
    expect(karte().querySelector('[data-text="titel"]')?.textContent).toBe(letzte.textContent);
    expect(springen).toHaveBeenCalledTimes(1);
    expect((springen.mock.contexts[0] as HTMLElement | undefined)?.contains(karte())).toBe(true);
    expect(document.activeElement).toBe(karte().parentElement);
    expect(karte().getAttribute("role")).toBeNull();
    // Auch die erneute bewusste Auswahl desselben Zustandswerts ist eine Handlung.
    await klick(letzte);
    expect(springen).toHaveBeenCalledTimes(2);
  });
  it("breit: dieselbe Auswahl bewegt weder Bildlauf noch Fokus", async () => {
    mount(false);
    const letzte = zeilen().at(-1) as HTMLButtonElement;
    letzte.focus();
    await klick(letzte);
    expect(karte().querySelector('[data-text="titel"]')?.textContent).toBe(letzte.textContent);
    expect(springen).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(letzte);
  });
  it("erstes Zeichnen samt vorbelegter Karte springt nicht", () => {
    mount();
    expect(karte().textContent).toContain("Alpha");
    expect(springen).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.body);
  });
  it("Auffrischung, Fehlschlag und weggefilterte Auswahl springen nicht", async () => {
    mount();
    await klick(zeilen().at(-1) as HTMLButtonElement);
    springen.mockClear();
    lage.isFetching = true;
    zeichnen();
    expect(zeilen()).toHaveLength(3);
    expect(springen).not.toHaveBeenCalled();
    lage.isFetching = false;
    lage.kos = lage.kos.map((k) => ({ ...k, statement: `${k.statement} frisch` }));
    zeichnen();
    expect(karte().textContent).toContain("frisch");
    expect(springen).not.toHaveBeenCalled();
    lage.isError = true;
    zeichnen();
    expect(zeilen()).toHaveLength(3);
    expect(karte().textContent).toContain("frisch");
    expect(springen).not.toHaveBeenCalled();
    await klick(element('[data-testid="pruefen-menue-filter"]'));
    const input = element<HTMLInputElement>(`input[placeholder="${i18n.t("val.filter")}"]`);
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
        input,
        "Alpha",
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(zeilen()).toHaveLength(1);
    expect(karte().textContent).toContain("Alpha");
    expect(springen).not.toHaveBeenCalled();
  });
  it("Review-Fokus und Facette ändern die sichtbare Karte ohne Sprung", async () => {
    lage.kos = lage.kos.map((k) => ({
      ...k,
      trust: k.title === "Beta" ? 80 : 0,
      version: k.title === "Gamma" ? 2 : 1,
    }));
    mount();
    await klick(zeilen().find((k) => k.textContent === "Alpha") as HTMLButtonElement);
    springen.mockClear();
    await klick(element('[data-testid="pruefen-menue-filter"]'));
    const revision = [
      ...container.querySelectorAll<HTMLButtonElement>('[data-help="rev:reviewFocus"] button'),
    ].find((b) => b.textContent?.startsWith(String(i18n.t("val.reviewFocus.revision"))));
    expect(revision).toBeDefined();
    await klick(revision as HTMLButtonElement);
    expect(zeilen()).toHaveLength(1);
    expect(karte().querySelector('[data-text="titel"]')?.textContent).toBe("Gamma");
    expect(springen).not.toHaveBeenCalled();
    await klick(element('[data-testid="pruefen-filter-reset"]'));
    await klick(element('[data-testid="pruefen-menue-filter"]'));
    const filterblatt = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (b) => b.textContent?.trim() === String(i18n.t("facet.openFilters")),
    );
    expect(filterblatt).toBeDefined();
    await klick(filterblatt as HTMLButtonElement);
    const label = [...container.querySelectorAll("dialog label")].find((l) =>
      l.textContent?.startsWith(String(i18n.t("lib.facet.trustBucket.t70"))),
    );
    expect(label).toBeDefined();
    await klick(label?.querySelector("input") as HTMLInputElement);
    expect(zeilen()).toHaveLength(1);
    expect(karte().querySelector('[data-text="titel"]')?.textContent).toBe("Beta");
    expect(springen).not.toHaveBeenCalled();
  });
  it("nachEntscheidung aktiviert den nächsten Eintrag ohne Sprung", async () => {
    mount();
    const vorher = karte().querySelector('[data-text="titel"]')?.textContent;
    await klick(element('[data-testid="pruefen-entscheidung-up"]'));
    expect(lage.act).toHaveBeenCalledWith("ko-0", { action: "rate", verdict: "up" });
    expect(element('[data-testid="pruefen-quittung"]').textContent).toContain(
      i18n.t("val.decisionSaved"),
    );
    expect(karte().querySelector('[data-text="titel"]')?.textContent).not.toBe(vorher);
    expect(springen).not.toHaveBeenCalled();
  });
});
