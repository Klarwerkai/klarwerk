// @vitest-environment jsdom
// ================================================================================================
// PRÜFSTATUS-ANZEIGE (N-0078) · DER NOCH NÖTIGE BEWERTUNGSUMFANG STEHT NEBEN „FREIGEBEN".
// ================================================================================================
//
// Zielzustand: „Die Aktion als ‚Positiv bewerten' beschriften oder den noch nötigen
// Bewertungsumfang unmittelbar daneben zeigen; Rückfrage/Bedingt sprachlich angleichen."
//
// Prüfseite: „Freigeben" ist EINE positive Bewertung. Der Restumfang steht jetzt als Satz im
// Fußband direkt nach den Entscheidungsknöpfen (vorher nur als Punkte mit Tooltip). Bibliothek: das
// Menü heißt „Positiv bewerten" (statt „Validieren"), die gelbe Entscheidung überall „Rückfrage".
//
// Bühne wie `Validation.quittung.test.tsx`: Board-Bestand über eine Hook-Attrappe, kein Netz.
import { afterEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../api/types";

const lage = vi.hoisted(() => ({ kos: [] as unknown[] }));

vi.mock("../api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useValidationBoard: () => ok(lage.kos),
    useDirectory: () => ok([]),
    useReasonerStatus: () => ok({ active: false, mode: "deterministic" }),
    useConflicts: () => ok([]),
    useDuplicates: () => ok([]),
    useLifecyclePending: () => ok([]),
    // R-0238: die Gegenüber-Suche der widersprechenden Ablehnung — hier Kulisse, nie befragt.
    useLibrarySearch: () => ok([]),
  };
});
vi.mock("../app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));
vi.mock("../app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u1", role: "experte" } }),
}));
vi.mock("../app/RoleContext", () => ({ useRole: () => ({ role: "experte" }) }));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import i18n from "../i18n";
import { bewertungsumfang } from "../lib/bewertungsumfang";
import { Validation } from "./Validation";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function ko(overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Zu prüfendes Wissen",
    statement: "Eine Aussage.",
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
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-08-12T00:00:00.000Z",
    history: [],
    confidentiality: "intern",
    confidentialityProvenance: "ko",
    ...overrides,
  } as unknown as KnowledgeObject;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(bestand: KnowledgeObject[]): void {
  lage.kos = bestand;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
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
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

const restumfang = () => container.querySelector('[data-testid="pruefen-restumfang"]');
const de = (key: string): string => String(i18n.getResource("de", "translation", key));

describe("N-0078 · Prüfseite: der Restumfang steht unmittelbar neben „Freigeben“", () => {
  it("1 von 3 grün → „Noch 2 positive Bewertungen bis zur Validierung (1 von 3)“", () => {
    mount([ko({ reviewVotes: { up: 1, warn: 0, down: 0 } })]);
    const satz = restumfang();
    expect(satz?.textContent).toBe("Noch 2 positive Bewertungen bis zur Validierung (1 von 3)");
    // UNMITTELBAR daneben: im selben Fußband wie die Entscheidungsknöpfe, direkt nach ihnen.
    const fussband = container.querySelector('[data-testid="pruefen-fussband"]');
    expect(fussband?.contains(satz as Node)).toBe(true);
    const ablehnen = container.querySelector('[data-testid="pruefen-entscheidung-down"]');
    expect(ablehnen?.nextElementSibling).toBe(satz);
  });

  it("Einzahl: noch 1 positive Bewertung", () => {
    mount([ko({ reviewVotes: { up: 2, warn: 0, down: 0 } })]);
    expect(restumfang()?.textContent).toBe(
      "Noch 1 positive Bewertung bis zur Validierung (2 von 3)",
    );
  });

  it("eine rote Bewertung blockiert — das steht da statt einer Restzahl", () => {
    mount([ko({ reviewVotes: { up: 2, warn: 0, down: 1 } })]);
    expect(restumfang()?.getAttribute("data-umfang")).toBe("blockiert");
    expect(restumfang()?.textContent).toBe("1 rote Bewertung blockiert die Validierung");
  });

  it("die Ableitung ist dieselbe Zählung wie die Punkte (grün/rot/nötig)", () => {
    expect(bewertungsumfang({ greenVotes: 0, redVotes: 0, needed: 2 })).toMatchObject({
      art: "offen",
      werte: { count: 2, have: 0, need: 2 },
    });
    expect(bewertungsumfang({ greenVotes: 2, redVotes: 0, needed: 2 }).art).toBe("genug");
    expect(bewertungsumfang({ greenVotes: 5, redVotes: 1, needed: 2 }).art).toBe("blockiert");
  });
});

describe("N-0078 · Wortlaut: „Positiv bewerten“ und „Rückfrage“ — gleich auf beiden Flächen", () => {
  it.each(["de", "en", "nl"])("%s: Bibliothek „Bedingt“ heißt wie die Prüfseite", (sprache) => {
    const text = (key: string) => String(i18n.getResource(sprache, "translation", key));
    expect(text("ko.conditional")).toBe(text("val.actionQuery"));
    expect(text("val.feedback.condTitle").startsWith(text("val.actionQuery"))).toBe(true);
  });

  it("die Bibliotheksaktion validiert nicht mehr dem Wort nach", () => {
    expect(de("ko.validate")).toBe("Positiv bewerten");
    expect(de("ko.conditional")).toBe("Rückfrage");
  });
});
