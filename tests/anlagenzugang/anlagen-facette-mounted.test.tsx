// @vitest-environment jsdom
// ================================================================================================
// R-1631 / R-1647 / R-2174 (aufnahme:20260922:gesamt-anlagenzugang) — DIE ADRESSE DES QR-CODES
// ÖFFNET DAS WISSEN DIESER ANLAGE, UND DIE KONTEXTFILTER GRENZEN WEITER EIN.
// ================================================================================================
// Gemessen an der gemounteten `BibliothekFlaeche` (nur der Datenabruf ist ersetzt): vier Objekte,
// zwei an derselben Anlage (verschiedene Fachgebiete), eines an einer anderen, eines ohne Anlage.
//   A1  Der Pfad, den der QR-Code trägt (`anlagenPfad`), zeigt genau das Wissen dieser Anlage —
//       auch bei einer Kennung mit Leerzeichen und Schrägstrich.
//   A2  Kontextfilter wirken zusätzlich: Anlage UND Fachgebiet ergibt die Schnittmenge.
//   A3  Im Menü „Filter" steht die Achse „Anlage"; ihre Auswahl grenzt ein, ohne Anlage nie dabei.
//   A4  Die Kennung wird wie am Server verglichen: abweichender Leerraum am Objekt trifft dieselbe
//       Anlage (Normalform aus `services/knowledge-object/src/asset.ts`).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";

function ko(id: string, title: string, asset: string | null, domain?: string): KnowledgeObject {
  return {
    id,
    title,
    statement: "Wartung",
    type: "best_practice",
    category: "Instandhaltung",
    ...(domain ? { domain } : {}),
    tags: ["Wartung"],
    status: "validiert",
    author: "u2",
    originalAuthor: "u2",
    assignments: [],
    neededValidations: 2,
    asset,
    trust: 50,
    confidence: 0,
    version: 1,
    conditions: [],
    measures: [],
    createdAt: "2026-08-20T00:00:00.000Z",
    history: [{ version: 1, author: "u2", at: "2026-08-20T00:00:00.000Z", note: "erstellt" }],
  } as unknown as KnowledgeObject;
}

const DP4 = "Linie L4 / Dosierstation DP-4";
const KOS = [
  ko("k1", "Dosierpumpe entlüften", DP4, "Instandhaltung"),
  ko("k2", "Dosiermenge prüfen", "Linie  L4 / Dosierstation DP-4", "Qualität"),
  ko("k3", "Spindel schmieren", "Fräse 7", "Instandhaltung"),
  ko("k4", "Allgemeine Sicherheitsunterweisung", null, "Instandhaltung"),
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
import { menueOeffnen, waehleImMenue } from "../library/support/bib-flaeche";

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

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
});
afterEach(() => {
  abbauen();
});

describe("Anlagenzugang · die QR-Adresse öffnet das Wissen der Anlage", () => {
  it("A1 · der Pfad des QR-Codes zeigt genau das Wissen dieser Anlage", () => {
    // Integration nacharbeit-26: EINE Anlagenachse mit mains Schlüssel `asset` (R-0477/R-0082).
    expect(anlagenPfad(DP4)).toMatch(/^\/bibliothek\?asset=/);
    mount(anlagenPfad(DP4));
    expect(sortiert()).toEqual(["k1", "k2"]);

    abbauen();
    mount(anlagenPfad("Fräse 7"));
    expect(sortiert()).toEqual(["k3"]);
  });

  it("A2 · Kontextfilter grenzen zusätzlich ein (Anlage UND Fachgebiet)", () => {
    mount(`${anlagenPfad(DP4)}&domain=Qualit%C3%A4t`);
    expect(sortiert()).toEqual(["k2"]);
  });

  it("A3 · die Achse „Anlage“ steht im Menü „Filter“ und grenzt ein", () => {
    mount();
    expect(sortiert()).toEqual(["k1", "k2", "k3", "k4"]);
    const filter = menueOeffnen(container, "bib-menue-filter");
    expect(filter.textContent).toContain(String(i18n.t("wissensmetadaten.anlage.facette")));

    waehleImMenue(container, "bib-menue-filter", "Fräse 7 · ");
    expect(sortiert()).toEqual(["k3"]);
    waehleImMenue(container, "bib-menue-filter", `${DP4} · `);
    expect(sortiert()).toEqual(["k1", "k2", "k3"]);
  });

  it("A4 · abweichender Leerraum am Objekt ist dieselbe Anlage (eine Menüzeile, Zähler 2)", () => {
    mount();
    const filter = menueOeffnen(container, "bib-menue-filter");
    const zeilen = [...filter.querySelectorAll('[role="menuitemcheckbox"]')].filter((e) =>
      (e.textContent ?? "").includes("Dosierstation DP-4"),
    );
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0]?.textContent).toContain(`${DP4} · 2`);
  });
});
