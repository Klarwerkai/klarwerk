// @vitest-environment jsdom
// ================================================================================================
// R-0429 SLICE 2 — DIE VERDICHTETE ANTWORT ÜBER DEN TREFFERN, AN DER ECHTEN BIBLIOTHEK GEMESSEN.
// ================================================================================================
//
// Peters Entscheidung zu Frage 52 (11.10.2026): „In einem klar erkennbaren Antwortbereich oberhalb
// der Treffer, mit anklickbaren Quellen. Die ursprünglichen Suchtreffer bleiben erreichbar."
//
// GEMESSEN WIRD DER GANZE WEG an der gemounteten Seite `Library`, nicht an einer Hilfsfunktion:
//   S1 · Mit Suchbegriff steht der Bereich ÜBER den Treffern, „Gefunden" trennt ihn von ihnen —
//        und Tippen allein schickt NICHTS an ein Modell.
//   S2 · Ein Klick: genau eine Anfrage mit dem Suchbegriff; Antwort, KI-Kennzeichnung und
//        Einstufung stehen im Bereich, die Quellen sind Knöpfe. Ein Klick auf eine Quelle öffnet
//        sie in der Lesefläche, und die Treffer stehen weiter da.
//   S3 · Ohne nutzbares Modell: keine Anfrage, der Sperrhinweis steht da.
//   S4 · Keine belegte Antwort: die Lücke wird benannt, nichts erfunden.
//   S5 · Ohne Suchbegriff gibt es den Bereich nicht — die Bibliothek in Ruhe bleibt, wie sie war.
//   S6 · Ausblenden behält die Antwort; Einblenden fragt nicht noch einmal.
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AskResponse, KnowledgeObject } from "../../apps/web/src/api/types";

function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko",
    title: "Titel",
    statement: "Aussage",
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
    confidentiality: "intern",
    createdAt: "2026-07-20T00:00:00.000Z",
    history: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

const KO_EINS = ko({ id: "k-spritz-1", title: "Spritzzone nach jeder Schicht reinigen" });
const KO_ZWEI = ko({ id: "k-spritz-2", title: "Reinigungsmittel für die Spritzzone" });
const KOS = [KO_EINS, KO_ZWEI];

const STATUS_MIT_MODELL = {
  active: true,
  mode: "cloud",
  reachable: "active",
  tasks: { answer: true },
};
const STATUS_OHNE_MODELL = {
  active: false,
  mode: "deterministic",
  reachable: "active",
  tasks: { answer: false },
};

const ANTWORTTEXT = "Die Spritzzone wird nach jeder Schicht gereinigt [1].";

const BEANTWORTET = {
  result: {
    answered: true,
    answer: ANTWORTTEXT,
    knowledgeClass: "unbekannt",
    trust: 0,
    sources: [KO_EINS.id, KO_ZWEI.id],
    citedSources: [KO_EINS.id],
    steps: [],
    demo: false,
  },
  gap: null,
  receipt: "r",
} as unknown as AskResponse;

const LUECKE = {
  result: {
    answered: false,
    answer: null,
    knowledgeClass: "unbekannt",
    trust: 0,
    sources: [],
    steps: [],
    demo: false,
  },
  gap: null,
  receipt: "r",
} as unknown as AskResponse;

// Der Zustand, den jeder Fall vorgibt. Gelesen wird er erst beim Aufruf der Mocks.
const lage: { status: unknown; antwort: AskResponse } = {
  status: STATUS_MIT_MODELL,
  antwort: BEANTWORTET,
};

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useKos: () => ok(KOS),
    useLibrarySearch: () => ok(KOS),
    useDirectory: () => ok([{ id: "u9", name: "Eva" }]),
    useConflicts: () => ({ ...ok([]), isSuccess: true }),
    useEigeneBefunde: () => ok([]),
    useKo: (id: string) => ok(KOS.find((k) => k.id === id)),
    useKoBeziehungen: () => ({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: () => Promise.resolve({}),
    }),
    useAudit: () => ok([]),
    useReasonerStatus: () => ok(lage.status),
    useReasonerConfig: () => ({ data: undefined, isLoading: false, isError: false, error: null }),
  };
});
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: { list: vi.fn(async () => []) },
    conflicts: { list: vi.fn(async () => []) },
    directory: { list: vi.fn(async () => []) },
    reasoner: { status: vi.fn(async () => lage.status) },
    ask: {
      ask: vi.fn(async () => lage.antwort),
      helpful: vi.fn(async () => undefined),
    },
  },
}));
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
import { endpoints } from "../../apps/web/src/api/endpoints";
// Der Import richtet die i18n-Instanz ein — ohne ihn stünde in jedem Knopf der SCHLÜSSEL.
import i18n from "../../apps/web/src/i18n";
import { Library } from "../../apps/web/src/pages/Library";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const askMock = endpoints.ask.ask as unknown as ReturnType<typeof vi.fn>;
const SUCHTEXT = "Spritzzone reinigen";

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

async function ruhe(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

async function bibliothek(href: string): Promise<HTMLDivElement> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: [href] }, createElement(Library)),
      ),
    );
  });
  await ruhe();
  return container;
}

function el(c: HTMLElement, testId: string): HTMLElement {
  const e = c.querySelector(`[data-testid="${testId}"]`);
  if (!(e instanceof HTMLElement)) {
    throw new Error(`[data-testid=${testId}] fehlt; DOM: ${c.textContent}`);
  }
  return e;
}

async function klick(e: HTMLElement): Promise<void> {
  act(() => {
    e.click();
  });
  await ruhe();
}

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
    root = null;
  }
  container?.remove();
  container = null;
  lage.status = STATUS_MIT_MODELL;
  lage.antwort = BEANTWORTET;
  vi.clearAllMocks();
});

describe("R-0429 Slice 2 · Antwortbereich über den Bibliothekstreffern", () => {
  it("S1 · über den Treffern, durch „Gefunden“ getrennt — und Tippen allein fragt kein Modell", async () => {
    const c = await bibliothek(`/bibliothek?q=${encodeURIComponent(SUCHTEXT)}`);
    const bereich = el(c, "bib-antwort");
    const gefunden = el(c, "bib-gefunden");
    const zeilen = [...c.querySelectorAll('[data-testid="bib-zeile"]')];
    expect(zeilen).toHaveLength(2);
    // Reihenfolge im Dokument: Bereich → „Gefunden“ → erste Trefferzeile.
    const nachBereich = bereich.compareDocumentPosition(gefunden);
    expect(nachBereich & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const vorDenZeilen = gefunden.compareDocumentPosition(zeilen[0] as Node);
    expect(vorDenZeilen & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Die Treffer stehen NICHT im Antwortbereich.
    expect(bereich.querySelector('[data-testid="bib-zeile"]')).toBeNull();
    expect(bereich.getAttribute("aria-label")).toBe(i18n.t("lib.antwort.titel"));
    expect(bereich.textContent).toContain(i18n.t("lib.antwort.titel"));
    expect(gefunden.textContent).toBe(i18n.t("lib.antwort.gefunden"));
    expect(el(c, "bib-antwort-anfordern").textContent).toBe(i18n.t("lib.antwort.anfordern"));
    expect(askMock).not.toHaveBeenCalled();
  });

  it("S2 · ein Klick: eine Anfrage, Antwort mit Kennzeichnung, Quellen öffnen die Lesefläche", async () => {
    const c = await bibliothek(`/bibliothek?q=${encodeURIComponent(SUCHTEXT)}`);
    await klick(el(c, "bib-antwort-anfordern"));
    expect(askMock.mock.calls).toEqual([[SUCHTEXT, "de"]]);

    const bereich = el(c, "bib-antwort");
    const ergebnis = el(bereich, "bib-antwort-ergebnis");
    expect(ergebnis.textContent).toContain("Die Spritzzone wird nach jeder Schicht gereinigt");
    // Die Fussnote ist eine Marke, keine rohe Klammer.
    expect(ergebnis.querySelector('sup[data-fussnote="1"]')).not.toBeNull();
    // KI-Kennzeichnung an der Antwort und die Einstufung aus `effectiveAnswer`.
    expect(ergebnis.querySelector('[data-testid="ai-generated-notice"]')).not.toBeNull();
    expect(el(bereich, "bib-antwort-einstufung").textContent?.trim().length).toBeGreaterThan(0);

    const quellen = [...bereich.querySelectorAll('[data-testid="bib-antwort-quelle"]')];
    expect(quellen.map((q) => q.getAttribute("data-bib-id"))).toEqual([KO_EINS.id, KO_ZWEI.id]);
    expect(quellen[0]?.textContent).toBe(`1 · ${KO_EINS.title}`);
    expect(quellen[1]?.textContent).toBe(`2 · ${KO_ZWEI.title}`);
    expect(quellen.every((q) => q.tagName === "BUTTON")).toBe(true);

    // Die zweite Quelle anklicken: sie steht rechts zum Lesen, die Treffer bleiben.
    await klick(quellen[1] as HTMLElement);
    expect(el(c, "bib-titel").textContent?.trim()).toBe(KO_ZWEI.title);
    expect(c.querySelectorAll('[data-testid="bib-zeile"]')).toHaveLength(2);
    // Und der Bereich hat dafür kein zweites Mal gefragt.
    expect(askMock).toHaveBeenCalledTimes(1);
  });

  it("S3 · ohne nutzbares Modell: keine Anfrage, der Sperrhinweis steht im Bereich", async () => {
    lage.status = STATUS_OHNE_MODELL;
    const c = await bibliothek(`/bibliothek?q=${encodeURIComponent(SUCHTEXT)}`);
    await klick(el(c, "bib-antwort-anfordern"));
    expect(askMock).not.toHaveBeenCalled();
    const bereich = el(c, "bib-antwort");
    expect(bereich.querySelector("[data-hinweis]")).not.toBeNull();
    expect(bereich.querySelector('[data-testid="bib-antwort-ergebnis"]')).toBeNull();
  });

  it("S4 · ohne belegte Antwort: die Lücke wird benannt, kein Antworttext", async () => {
    lage.antwort = LUECKE;
    const c = await bibliothek(`/bibliothek?q=${encodeURIComponent(SUCHTEXT)}`);
    await klick(el(c, "bib-antwort-anfordern"));
    expect(askMock).toHaveBeenCalledTimes(1);
    const luecke = el(c, "bib-antwort-luecke");
    expect(luecke.textContent).toContain(i18n.t("ask.gapBadge"));
    expect(luecke.textContent).toContain(i18n.t("ask.gap.noInvent"));
    expect(c.querySelector('[data-testid="bib-antwort-ergebnis"]')).toBeNull();
  });

  it("S5 · ohne Suchbegriff gibt es keinen Antwortbereich", async () => {
    const c = await bibliothek("/bibliothek");
    expect(c.querySelectorAll('[data-testid="bib-zeile"]').length).toBeGreaterThan(0);
    expect(c.querySelector('[data-testid="bib-antwort"]')).toBeNull();
    expect(c.querySelector('[data-testid="bib-gefunden"]')).toBeNull();
  });

  it("S6 · Ausblenden behält die Antwort, Einblenden fragt nicht noch einmal", async () => {
    const c = await bibliothek(`/bibliothek?q=${encodeURIComponent(SUCHTEXT)}`);
    await klick(el(c, "bib-antwort-anfordern"));
    const umschalten = el(c, "bib-antwort-umschalten");
    expect(umschalten.getAttribute("aria-expanded")).toBe("true");
    await klick(umschalten);
    expect(umschalten.getAttribute("aria-expanded")).toBe("false");
    const ergebnis = el(c, "bib-antwort-ergebnis");
    expect(ergebnis.closest("[hidden]")).not.toBeNull();
    await klick(umschalten);
    expect(ergebnis.closest("[hidden]")).toBeNull();
    expect(askMock).toHaveBeenCalledTimes(1);
  });
});
