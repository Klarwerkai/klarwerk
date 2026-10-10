// @vitest-environment jsdom
// ================================================================================================
// R-1631 (aufnahme:20260922:gesamt-anlagenzugang · Ben Nacharbeit 1) — BAUTEIL, MATERIAL UND
// GELTUNGSKONTEXT AN DER GEMOUNTETEN BIBLIOTHEK.
// ================================================================================================
// Gemessen an der gemounteten `BibliothekFlaeche` (nur der Datenabruf ist ersetzt). Vier Objekte an
// derselben Anlage gelten unterschiedlich: allgemein, nur Werk Nord, nur Werk Süd, nur Nachtschicht,
// nur Anlagenversion Rev A. Dazu ein Objekt an einem Bauteil, eines an einem Material.
//   B1  `?bauteil=…` und `?material=…` öffnen genau das gekoppelte Wissen.
//   B2  Der QR-Pfad mit Kontext (Standort, Schicht, Version) zeigt das allgemeine und das dafür
//       geltende Wissen — nicht das Wissen anderer Standorte, Schichten oder Versionen.
//   B3  Die Kontextleiste ändert die Auswahl über die Adresse; „Alle …" hebt sie wieder auf.
//   B4  Ohne Anlagenzugang (kein Bezug, kein Kontext) steht keine Kontextleiste auf der Fläche.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnlagenKontext, KnowledgeObject } from "../../apps/web/src/api/types";

function ko(
  id: string,
  title: string,
  asset: string | null,
  anlagenkontext?: AnlagenKontext,
): KnowledgeObject {
  return {
    id,
    title,
    statement: "Wartung",
    type: "best_practice",
    category: "Instandhaltung",
    tags: ["Wartung"],
    status: "validiert",
    author: "u2",
    originalAuthor: "u2",
    assignments: [],
    neededValidations: 2,
    asset,
    ...(anlagenkontext ? { anlagenkontext } : {}),
    trust: 50,
    confidence: 0,
    version: 1,
    conditions: [],
    measures: [],
    createdAt: "2026-08-20T00:00:00.000Z",
    history: [{ version: 1, author: "u2", at: "2026-08-20T00:00:00.000Z", note: "erstellt" }],
  } as unknown as KnowledgeObject;
}

const PRESSE = "Presse P-9";
const KOS = [
  ko("k1", "Not-Aus prüfen", PRESSE),
  ko("k2", "Hydraulik Werk Nord", PRESSE, { standorte: ["Werk Nord"] }),
  ko("k3", "Hydraulik Werk Süd", PRESSE, { standorte: ["Werk Süd"] }),
  ko("k4", "Nachtreinigung", PRESSE, { schichten: ["Nacht"] }),
  ko("k5", "Steuerung Rev A", PRESSE, { versionen: ["Rev A"] }),
  ko("k6", "Lager wechseln", "Fräse 7", { bauteile: ["BT-4711"] }),
  ko("k7", "Schweißnaht prüfen", null, { materialien: ["1.4301"] }),
];

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({
    data,
    isLoading: false,
    isError: false,
    isRefetchError: false,
    isFetching: false,
    isStale: false,
    fetchStatus: "idle",
    dataUpdatedAt: 100,
    refetch: async () => ({}),
  });
  return {
    useKos: () => ok(KOS),
    useLibrarySearch: () => ok(KOS),
    useConflicts: () => ok([]),
    useDirectory: () => ok([]),
    useKo: () => ({ ...ok(undefined), isLoading: true }),
    useEigeneBefunde: () => ok([]),
    useAudit: () => ok([]),
    koQueryKey: (id: string) => ["ko", id],
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
import { BibliothekFlaeche } from "../../apps/web/src/components/bibliothek/BibliothekFlaeche";
import i18n from "../../apps/web/src/i18n";
import { anlagenPfad } from "../../apps/web/src/lib/anlagenzugang";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

function mount(entry = "/bibliothek"): void {
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
        createElement(MemoryRouter, { initialEntries: [entry] }, createElement(BibliothekFlaeche)),
      ),
    );
  });
}

function abbauen(): void {
  if (root) {
    const alt = root;
    act(() => alt.unmount());
    root = null;
  }
  container?.remove();
}

const sortiert = (): (string | null)[] =>
  [...container.querySelectorAll('[data-testid="bib-zeile"]')]
    .map((z) => z.getAttribute("data-bib-id"))
    .sort();

function waehle(testId: string, wert: string): void {
  const feld = container.querySelector(`[data-testid="${testId}"]`);
  if (!(feld instanceof HTMLSelectElement)) {
    throw new Error(`Auswahl „${testId}" fehlt; DOM: ${container.textContent}`);
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set as (
    v: string,
  ) => void;
  act(() => {
    setter.call(feld, wert);
    feld.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
});
afterEach(() => {
  abbauen();
});

describe("R-1631 · Bauteil, Material und Geltungskontext in der Bibliothek", () => {
  it("B1 · Bauteil-Nummer und Material-Code öffnen genau das gekoppelte Wissen", () => {
    mount(anlagenPfad("BT-4711", "bauteil"));
    expect(sortiert()).toEqual(["k6"]);
    abbauen();
    mount(anlagenPfad("1.4301", "material"));
    expect(sortiert()).toEqual(["k7"]);
  });

  it("B2 · QR-Pfad mit Kontext: allgemeines und dafür geltendes Wissen, sonst nichts", () => {
    mount(anlagenPfad(PRESSE, "asset", { standort: "Werk Nord", schicht: "Früh" }));
    expect(sortiert()).toEqual(["k1", "k2", "k5"]);
    abbauen();
    mount(anlagenPfad(PRESSE, "asset", { standort: "Werk Süd", schicht: "Nacht" }));
    expect(sortiert()).toEqual(["k1", "k3", "k4", "k5"]);
    abbauen();
    mount(anlagenPfad(PRESSE, "asset", { anlagenversion: "Rev B" }));
    expect(sortiert()).toEqual(["k1", "k2", "k3", "k4"]);
  });

  it("B3 · die Kontextleiste ändert die Auswahl; „Alle …“ hebt sie auf", () => {
    mount(anlagenPfad(PRESSE));
    expect(sortiert()).toEqual(["k1", "k2", "k3", "k4", "k5"]);
    const leiste = container.querySelector('[data-testid="bib-kontext"]');
    expect(leiste, "keine Kontextleiste im Anlagenzugang").not.toBeNull();
    expect(leiste?.textContent).toContain("Werk Nord");

    waehle("bib-kontext-standort", "Werk Süd");
    expect(sortiert()).toEqual(["k1", "k3", "k4", "k5"]);
    waehle("bib-kontext-schicht", "Nacht");
    expect(sortiert()).toEqual(["k1", "k3", "k4", "k5"]);
    waehle("bib-kontext-anlagenversion", "Rev A");
    expect(sortiert()).toEqual(["k1", "k3", "k4", "k5"]);
    waehle("bib-kontext-standort", "");
    expect(sortiert()).toEqual(["k1", "k2", "k3", "k4", "k5"]);
  });

  it("B4 · ohne Anlagenzugang keine Kontextleiste", () => {
    mount();
    expect(sortiert()).toEqual(["k1", "k2", "k3", "k4", "k5", "k6", "k7"]);
    expect(container.querySelector('[data-testid="bib-kontext"]')).toBeNull();
  });
});
