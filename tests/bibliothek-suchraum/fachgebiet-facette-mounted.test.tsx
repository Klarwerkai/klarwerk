// @vitest-environment jsdom
// ================================================================================================
// R-0431 / R-1728 / FR-LIB-01 (K2, K20, K28 · BEN NACHARBEIT 9) — FACHGEBIET ALS EIGENE FACETTE.
// ================================================================================================
// Gemessen an der gemounteten `BibliothekFlaeche` (nur der Datenabruf ist ersetzt): drei Objekte
// derselben Kategorie, zwei mit verschiedenem Fachgebiet, eines ohne. Die Facette grenzt also
// UNABHÄNGIG von der Kategorie ein.
//   D1  Auswahl im echten Menü „Filter" → „Fachgebiet": genau die Treffer, Zähler stimmt;
//       zwei Werte gemeinsam ergeben die Vereinigung; ohne Fachgebiet nie dabei.
//   D2  Die Adresse trägt die Auswahl (`?domain=…`) — ein Aufruf mit Parameter grenzt sofort ein.
//   D3  Eine gemerkte Sicht trägt die Auswahl und stellt sie nach neuem Aufbau wieder her.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";

function ko(id: string, title: string, domain?: string): KnowledgeObject {
  return {
    id,
    title,
    statement: "Wartung",
    type: "best_practice",
    category: "Anlage A",
    ...(domain ? { domain } : {}),
    tags: ["Wartung"],
    status: "validiert",
    author: "u2",
    originalAuthor: "u2",
    assignments: [],
    neededValidations: 2,
    asset: null,
    trust: 50,
    confidence: 0,
    version: 1,
    conditions: [],
    measures: [],
    createdAt: "2026-08-20T00:00:00.000Z",
    history: [{ version: 1, author: "u2", at: "2026-08-20T00:00:00.000Z", note: "erstellt" }],
  } as unknown as KnowledgeObject;
}

const KOS = [
  ko("k1", "Ventil eins", "Instandhaltung"),
  ko("k2", "Ventil zwei", "Qualität"),
  ko("k3", "Ventil drei"),
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
import {
  listenZaehler,
  menueEintrag,
  menueOeffnen,
  tippe,
  waehleImMenue,
} from "../library/support/bib-flaeche";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const SICHTEN = "klarwerk.library.views.u1";

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
// Der Menüeintrag lautet „<Wert> · <Zahl>"; mit dem Trenner ist der Anfang eindeutig.
const fachgebiet = (wert: string): void =>
  waehleImMenue(container, "bib-menue-filter", `${wert} · `);

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
});
afterEach(() => {
  abbauen();
});

describe("K2 · Fachgebiet als eigene Facette der Bibliothek", () => {
  it("D1 · Auswahl im Menü grenzt unabhängig von der Kategorie ein; zwei Werte = Vereinigung", () => {
    mount();
    expect(sortiert()).toEqual(["k1", "k2", "k3"]);
    const filter = menueOeffnen(container, "bib-menue-filter");
    expect(filter.textContent).toContain(String(i18n.t("lib.facet.domain")));

    fachgebiet("Instandhaltung");
    expect(sortiert()).toEqual(["k1"]);
    expect(listenZaehler(container)).toBe(1);

    fachgebiet("Qualität");
    expect(sortiert()).toEqual(["k1", "k2"]);
    expect(listenZaehler(container)).toBe(2);
  });

  it("D2 · die Adresse trägt die Auswahl", () => {
    mount("/bibliothek?domain=Qualit%C3%A4t");
    expect(sortiert()).toEqual(["k2"]);
  });

  it("D3 · eine gemerkte Sicht trägt das Fachgebiet und stellt es wieder her", () => {
    mount();
    fachgebiet("Instandhaltung");
    menueOeffnen(container, "bib-liste-menue");
    const feld = container.querySelector<HTMLInputElement>("#bib-sichtname");
    if (!feld) {
      throw new Error("Feld für den Sichtnamen fehlt");
    }
    tippe(feld, "Nur Instandhaltung");
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="bib-sicht-speichern"]')?.click();
    });
    const gespeichert = JSON.parse(window.localStorage.getItem(SICHTEN) ?? "[]") as Array<{
      state?: { facetSel?: Record<string, unknown> };
    }>;
    expect(gespeichert[0]?.state?.facetSel?.domain).toEqual(["Instandhaltung"]);

    abbauen();
    mount();
    expect(sortiert(), "neuer Aufbau ohne Auswahl").toEqual(["k1", "k2", "k3"]);
    const eintrag = menueEintrag(menueOeffnen(container, "bib-liste-menue"), "Nur Instandhaltung");
    act(() => {
      eintrag.click();
    });
    expect(sortiert()).toEqual(["k1"]);
  });
});
