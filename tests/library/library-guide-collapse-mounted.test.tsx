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
    // JOB 3063 (H4): die Fläche zeigt rechts den gewählten Eintrag. Diese Tests messen die LISTE;
    // die Lesefläche bleibt deshalb bewusst im Ladezustand — sie ist dann eine leere Fläche ohne
    // Text und mischt sich in keine Zusicherung ein.
    useKo: () => ({ data: undefined, isLoading: true, isError: false, error: null }),
    useAudit: () => ok([]),
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
import { eintragText, menueOeffnen } from "./support/bib-flaeche";

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

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
});

afterEach(() => {
  unmount();
  window.localStorage.clear();
});

// ================================================================================================
// JOB 3063 (H4) — DIE ERKLÄRBOX IST WEG, UND DAS IST DER GEGENSTAND DIESES FALLS GEWORDEN.
// ================================================================================================
//
// WAS HIER FRÜHER STAND: drei Fälle über eine einklappbare Onboarding-Karte „Reife der Treffer“ mit
// zwei erklärten Plaketten (uxpol5 Punkt 3, uxpol6 GELB 3.1 zur Disclosure-Semantik).
//
// WARUM SIE NICHT MEHR STEHEN KÖNNEN: Pedi am 04.09. über die heutige Web-App — „Text über Text
// über Text. Die Anwendung selbst macht ungefähr 10 % des Ganzen aus.“ Die Karte war genau das:
// 296 Zeichen Erklärtext über der Trefferliste, bei EINEM Wissensobjekt im Bestand. JOB 3063 hat
// sie ersatzlos entfernt (Auftrag §5, Lieferung 6). Ein Fall, der ihr Verhalten prüft, prüfte ab
// jetzt eine Fläche, die es nicht gibt.
//
// WAS BLEIBT UND HIER GEPRÜFT WIRD: die Reife-VOKABEL selbst ist nicht verschwunden — sie ist eine
// echte Auskunft über den Bestand und steht weiter im Menü „Filter“ als Dimension. Verschwunden ist
// nur ihre Erklärung im Sichtfeld. Genau diese zwei Sätze hält dieser Fall fest.
describe("JOB 3063 · die Reife-Erklärbox ist abgelöst — die Reife selbst nicht", () => {
  it("die Erklärkarte steht nicht mehr auf der Fläche (weder Titel noch Plaketten-Erklärung)", () => {
    mount();
    const text = container.textContent ?? "";
    expect(text).not.toContain(res("kg.library.title"));
    expect(text).not.toContain(res("kg.secured.label"));
    expect(text).not.toContain(res("kg.secured.body"));
  });

  it("die Reife ist als FILTER erreichbar geblieben — mit ihren Werten und Zählern", () => {
    mount();
    const menue = menueOeffnen(container, "bib-menue-filter");
    const reife = [...menue.querySelectorAll("details")].find((d) =>
      (d.querySelector("summary")?.textContent ?? "").includes(res("lib.facet.maturity")),
    );
    expect(reife, `Untermenü „Reife“ fehlt; DOM: ${menue.textContent}`).toBeTruthy();
    const werte = [...(reife?.querySelectorAll("[role=menuitemcheckbox]") ?? [])].map((e) =>
      eintragText(e),
    );
    expect(werte.length).toBeGreaterThan(0);
    // Der Wert des einen offenen Wissensobjekts, mit seinem Kontext-Zähler.
    expect(werte.join(" ")).toContain(" · 1");
  });
});
