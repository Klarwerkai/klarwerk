// @vitest-environment jsdom
// ================================================================================================
// PRÜFSTATUS-ANZEIGE (R-0216, Ben Nacharbeit 5) · DER REIFEFILTER AUS DER ADRESSE ÜBERLEBT DAS LADEN.
// ================================================================================================
//
// Befund: Zähler und Ergebnisfilter der Bibliothek leiten die Reife konfliktbewusst ab, die Prüfung
// übernommener Adressfilter (`knownFacetValues` in `BibliothekFlaeche.tsx`) tat es nicht. Ein Objekt,
// das nur über die Konfliktliste „In Prüfung" ist (Server ohne Konfliktstatus), fehlte in ihrem
// Bestand — und `?maturity=in-review` wurde beim Öffnen verworfen; die Liste zeigte alles.
//
// Gemessen an der ECHTEN, gemounteten Fläche (`pages/Library`), Bauform wie
// `tests/bibliothek-leer-oder-eingegrenzt/leersatz-sagt-die-wahrheit.test.tsx`:
//   R1 · Konfliktliste lädt NACH dem Bestand: Auswahl bleibt, Treffer = nur das konfliktbetroffene
//        Objekt; die konfliktfreie offene Kontrolle steht nicht in der Liste.
//   R2 · Konfliktabruf gescheitert: die Reife-Auswahl wird nicht aus Unwissen verworfen.
//   R3 · Gegenprobe: ohne jeden Konflikt ist `in-review` wirklich unbekannt und wird wie bisher
//        verworfen — die Prüfung selbst ist nicht abgeschaltet.
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Conflict, KnowledgeObject } from "../../apps/web/src/api/types";

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
    status: "offen",
    version: 1,
    originalAuthor: "u9",
    author: "u9",
    neededValidations: 1,
    assignments: [],
    asset: null,
    createdAt: "2026-07-20T00:00:00.000Z",
    history: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

// Das zurückgesetzte Objekt (R-0231: offen/87), dessen Konflikt der Server NICHT mitliefert.
const KO_KONFLIKT = ko({
  id: "a",
  title: "Alpha Druck ablassen",
  trust: 87,
  confidence: 87,
  anzeigestatus: "offen",
});
// Die konfliktfreie offene Kontrolle.
const KO_KONTROLLE = ko({ id: "k", title: "Kappa Kontrolle", anzeigestatus: "offen" });
const BESTAND = [KO_KONFLIKT, KO_KONTROLLE];

const KONFLIKT = {
  id: "c1",
  koA: "a",
  koB: "x",
  type: "truth",
  status: "offen",
} as unknown as Conflict;

const GELADEN_AM = Date.parse("2026-10-05T09:00:00.000Z");

const geladen = (data: unknown): Record<string, unknown> => ({
  data,
  isLoading: false,
  isError: false,
  isFetching: false,
  isStale: false,
  isPaused: false,
  isRefetchError: false,
  fetchStatus: "idle",
  dataUpdatedAt: GELADEN_AM,
  error: null,
});

const laedt = (): Record<string, unknown> => ({
  data: undefined,
  isLoading: true,
  isError: false,
  isFetching: true,
  isStale: true,
  isPaused: false,
  isRefetchError: false,
  fetchStatus: "fetching",
  dataUpdatedAt: 0,
  error: null,
});

const gescheitert = (): Record<string, unknown> => ({
  ...laedt(),
  isLoading: false,
  isFetching: false,
  isError: true,
  fetchStatus: "idle",
  error: new Error("Konfliktabruf gescheitert"),
});

const lage = vi.hoisted(() => ({
  suche: {} as Record<string, unknown>,
  bestand: {} as Record<string, unknown>,
  konflikte: {} as Record<string, unknown>,
}));

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    koQueryKey: ["kos", undefined],
    useKos: () => lage.bestand,
    useLibrarySearch: () => lage.suche,
    useConflicts: () => lage.konflikte,
    useDirectory: () => ok([]),
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
import "../../apps/web/src/i18n";
import { Library } from "../../apps/web/src/pages/Library";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const ADRESSE = "/bibliothek?maturity=in-review";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;
let zeichnen: (() => void) | null = null;

function mount(): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  const neu = createRoot(container);
  root = neu;
  // EIN Client und EIN Baum für alle Zeichnungen: ein erneutes `render` hält den Zustand der Fläche
  // (Keim, Auswahl) und ruft nur die Hooks neu ab — so kommt die Konfliktliste „später" an.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const baum = createElement(
    QueryClientProvider,
    { client: qc },
    createElement(MemoryRouter, { initialEntries: [ADRESSE] }, createElement(Library)),
  );
  zeichnen = () => {
    act(() => {
      neu.render(baum);
    });
  };
  zeichnen();
}

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  container?.remove();
  root = null;
  zeichnen = null;
});

const zeilen = (): string[] =>
  [...container.querySelectorAll('[data-testid="bib-zeile"]')].map(
    (el) => el.getAttribute("data-bib-id") ?? "?",
  );

describe("R-0216 · ?maturity=in-review in der gemounteten Bibliothek", () => {
  it("R1 · Konflikte kommen nach dem Bestand: Auswahl und Treffer bleiben", () => {
    lage.suche = geladen(BESTAND);
    lage.bestand = geladen(BESTAND);
    lage.konflikte = laedt();
    mount();
    // Während die Konfliktauskunft fehlt, ist der Keim die wirksame Auswahl — nichts verworfen.
    expect(zeilen()).not.toContain("k");

    lage.konflikte = geladen([KONFLIKT]);
    zeichnen?.();
    zeichnen?.();
    expect(zeilen()).toEqual(["a"]);
    // Und es bleibt dabei — auch nach einer weiteren Zeichnung.
    zeichnen?.();
    expect(zeilen()).toEqual(["a"]);
  });

  it("R2 · Konfliktabruf gescheitert: Reife-Auswahl bleibt stehen", () => {
    lage.suche = geladen(BESTAND);
    lage.bestand = geladen(BESTAND);
    lage.konflikte = gescheitert();
    mount();
    zeichnen?.();
    // Ohne Konfliktkenntnis ist hier niemand „In Prüfung" — aber der Filter bleibt stehen, statt
    // stillschweigend die ganze Liste samt Kontrolle zu zeigen.
    expect(zeilen()).not.toContain("k");
  });

  it("R3 · Gegenprobe: ohne Konflikt wird in-review wie bisher verworfen", () => {
    lage.suche = geladen(BESTAND);
    lage.bestand = geladen(BESTAND);
    lage.konflikte = geladen([]);
    mount();
    zeichnen?.();
    expect([...zeilen()].sort()).toEqual(["a", "k"]);
  });
});
