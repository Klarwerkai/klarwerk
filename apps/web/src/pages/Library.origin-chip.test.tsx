// @vitest-environment jsdom
// ================================================================================================
// JOB 679 / D2 (K1.2, Weg A) — DER HERKUNFTS-CHIP „AUS WORD" IN DER BIBLIOTHEK.
// ================================================================================================
//
// Pedis Wortlaut (Board-Eingabe 11.08.2026): „In Bibliothek und KO-Detail einen Herkunfts-Chip fuer
// origin `word_addin` anzeigen (Vorbild: der „Extern · ungeprueft"-Chip)."
//
// GEMESSEN WIRD AN DER GEMOUNTETEN SEITE. Ein Test, der nur Zeichenketten in `i18n.ts` nachschlaegt,
// bewiese, dass ein Satz existiert — nicht, dass ihn jemand sieht. Genau diese Verwechslung ist die
// Fehlerklasse, die in JOB 679 D1 zum `BLOCKIERT` gefuehrt hat: ein Chip, dessen Wirkung im Betrieb
// lautlos ausbleibt, waere gruen testbar gewesen, indem der Test seine eigene Voraussetzung setzt.
// Dass die Herkunft ueberhaupt bis zum Wissensobjekt REICHT, haelt deshalb ein eigener Dienst-Test
// fest (`services/capture/src/origin-durchreiche.test.ts`) — hier geht es nur um die Anzeige.
//
// JEDER FALL PRUEFT BEIDE RICHTUNGEN: der Chip erscheint bei `word_addin` UND er erscheint bei
// keiner anderen Herkunft. Ein Chip, der immer da ist, sagt nichts.
import { afterEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../api/types";

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
    createdAt: "2026-08-12T00:00:00.000Z",
    history: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

// Der Bestand wird je Fall gesetzt — die Seite liest ihn ueber die gemockten Haken.
const lage = vi.hoisted(() => ({ kos: [] as unknown[] }));

vi.mock("../api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useKos: () => ok(lage.kos),
    useLibrarySearch: () => ok(lage.kos),
    useDirectory: () => ok([]),
    useConflicts: () => ok([]),
  };
});
vi.mock("../app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u1", role: "experte" } }),
}));
vi.mock("../app/RoleContext", () => ({ useRole: () => ({ role: "experte" }) }));
vi.mock("../app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import i18n from "../i18n";
import { Library } from "./Library";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Die eine Marke, an der die Anzeige gemessen wird — kein CSS-Klassenraten. */
const CHIP = '[data-testid="ko-origin-word-addin"]';

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
        createElement(MemoryRouter, { initialEntries: ["/bibliothek"] }, createElement(Library)),
      ),
    );
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  lage.kos = [];
});

function chips(): HTMLElement[] {
  return [...container.querySelectorAll(CHIP)] as HTMLElement[];
}

function de(key: string): string {
  return String(i18n.getResource("de", "translation", key));
}

describe("JOB 679 D2 · Bibliothek — der Chip erscheint genau bei der Word-Herkunft", () => {
  it("ein Treffer aus Word traegt den Chip", () => {
    mount([ko({ id: "a", title: "Aus Word erfasst", origin: "word_addin" })]);
    expect(chips()).toHaveLength(1);
  });

  it("der Chip nennt die Herkunft im Klartext und erklaert sie im Titel", () => {
    mount([ko({ id: "a", origin: "word_addin" })]);
    const chip = chips()[0];
    expect(chip?.textContent?.trim()).toBe(de("ko.originWordAddin.label"));
    expect(chip?.getAttribute("title")).toBe(de("ko.originWordAddin.hint"));
  });

  it("ein Treffer ohne Herkunft traegt ihn NICHT — Altbestand ist nicht „aus Word“", () => {
    mount([ko({ id: "a", title: "Altbestand" })]);
    expect(chips()).toHaveLength(0);
  });

  it("ein Treffer aus der Vordertuer traegt ihn NICHT", () => {
    mount([ko({ id: "a", origin: "frontdoor" })]);
    expect(chips()).toHaveLength(0);
  });

  it("bei gemischtem Bestand traegt ihn genau der Word-Treffer", () => {
    mount([
      ko({ id: "a", title: "Aus Word", origin: "word_addin" }),
      ko({ id: "b", title: "Vordertuer", origin: "frontdoor" }),
      ko({ id: "c", title: "Altbestand" }),
    ]);
    expect(chips()).toHaveLength(1);
  });

  it("die uebrigen Herkuenfte loesen ihn ebenfalls nicht aus", () => {
    mount([
      ko({ id: "a", origin: "tell" }),
      ko({ id: "b", origin: "studio" }),
      ko({ id: "c", origin: "expert" }),
    ]);
    expect(chips()).toHaveLength(0);
  });
});
