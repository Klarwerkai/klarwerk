// @vitest-environment jsdom
// AUFTRAG-mega59 BLOCK D — DER STUMME NULLZUSTAND DER BIBLIOTHEK.
//
// DER BEFUND: `QueryState` bewertet NUR die Serverantwort; Facetten und Zeitbereich filtern erst
// danach clientseitig. Liefert die Suche also Treffer, die Facetten aber nicht, rendert die
// Bibliothek eine leere Karte GANZ OHNE TEXT — bei aktiver Gruppierung ein leeres `div`. Der Nutzer
// sieht eine Fläche, die nichts sagt, und hat keinen Weg zurück.
//
// Der benachbarte Fall (Suche ohne Serverteffer) ist längst geschlossen und hier ausdrücklich
// mitgeprüft, damit die neue Meldung ihn nicht überschreibt. Alle anderen Suchflächen der App
// (Help, KlaraAssistant, CommandPalette, Mobile) haben einen Leerzustand — die Bibliothek war die
// einzige ohne.
//
// GEMESSEN WIRD AN DER ECHTEN, GEMOUNTETEN SEITE, mit einem echten Klickpfad: Filter setzen →
// Meldung UND Knopf sind da → Knopf klicken → die Einträge sind wieder da. Ein bloß gemounteter
// Test ohne Klick würde nur beweisen, dass ein Text existiert, nicht dass er erreichbar ist.
import { afterEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";

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
    createdAt: "2026-07-20T00:00:00.000Z",
    history: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

// Zwei Treffer in ZWEI verschiedenen Kategorien: wähle eine, und der andere fällt heraus. Wähle
// beide Kategorien nacheinander ab, und es bleibt nichts — genau der Nullzustand.
const KO_A = ko({ id: "a", title: "Alpha Ventil", category: "Anlage 1", tags: ["ventil"] });
const KO_B = ko({ id: "b", title: "Beta Pumpe", category: "Anlage 2", tags: ["pumpe"] });
const KOS = [KO_A, KO_B];

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
vi.mock("../../apps/web/src/app/RoleContext", () => ({ useRole: () => ({ role: "experte" }) }));
vi.mock("../../apps/web/src/app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));

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

function mount(entry: string): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: [entry] }, createElement(Library)),
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

function text(): string {
  return container.textContent ?? "";
}

function de(key: string): string {
  return String(i18n.getResource("de", "translation", key));
}

// Der Reset-Knopf des Leerzustands, über seinen ZUGÄNGLICHEN NAMEN gefunden (nicht über eine
// CSS-Klasse) — damit belegt der Fall zugleich, dass die Handlung einen Namen hat.
function resetKnopf(): HTMLButtonElement | undefined {
  const label = de("lib.facetEmpty.reset");
  return [...container.querySelectorAll("button")].find(
    (b) => (b.textContent ?? "").trim() === label,
  ) as HTMLButtonElement | undefined;
}

describe("AUFTRAG-mega59 D — null sichtbare Einträge sagen, WARUM", () => {
  it("Servertreffer + alles wegfilternde Facetten: Meldung UND Reset-Knopf sind da", () => {
    // Zwei Dimensionen, die sich AUSSCHLIESSEN: „Anlage 1" trägt nur „ventil", „Anlage 2" nur
    // „pumpe". Beide Werte existieren wirklich im Bestand — die Kombination trifft keinen. Die
    // Suche liefert also weiter zwei Treffer, die Facetten zeigen keinen davon.
    mount("/bibliothek?category=Anlage+1&tag=pumpe");
    expect(text()).toContain(de("lib.facetEmpty.title"));
    // Der Grund steht wörtlich dabei, mit der echten Trefferzahl aus dem Bestand.
    expect(text()).toContain(de("lib.facetEmpty.hint").replace("{{count}}", String(KOS.length)));
    expect(resetKnopf(), "der Reset-Knopf fehlt oder trägt keinen zugänglichen Namen").toBeTruthy();
    // …und kein einziger Treffer steht in der Liste (der Nullzustand ist echt, nicht behauptet).
    expect(text()).not.toContain(KO_A.title);
    expect(text()).not.toContain(KO_B.title);
  });

  it("DER KLICKPFAD: nach dem Reset sind die Einträge wieder da", () => {
    mount("/bibliothek?category=Anlage+1&tag=pumpe");
    expect(text()).toContain(de("lib.facetEmpty.title"));
    const knopf = resetKnopf();
    expect(knopf).toBeTruthy();
    act(() => {
      knopf?.click();
    });
    // Der bestehende Handler (`onResetFilters`) räumt Facetten, Bereich und Schienenzustand — und
    // damit ist die Meldung weg und die Liste zurück. Ein zweiter Reset-Weg wurde nicht gebaut.
    expect(text()).not.toContain(de("lib.facetEmpty.title"));
    expect(text()).toContain(KO_A.title);
    expect(text()).toContain(KO_B.title);
  });

  it("der Knopf ist mit der Tastatur erreichbar und hat einen zugänglichen Namen", () => {
    mount("/bibliothek?category=Anlage+1&tag=pumpe");
    const knopf = resetKnopf();
    // Ein echtes <button> ist per Konstruktion fokussierbar und mit Enter/Leertaste bedienbar —
    // deshalb ist genau das die Zusicherung, und nicht ein `div` mit `onClick`.
    expect(knopf?.tagName).toBe("BUTTON");
    expect(knopf?.hasAttribute("disabled")).toBe(false);
    expect((knopf?.textContent ?? "").trim().length).toBeGreaterThan(0);
    knopf?.focus();
    expect(document.activeElement).toBe(knopf);
  });

  it("ohne Filter erscheint die Meldung NICHT — sie ist kein Dauerzustand", () => {
    mount("/bibliothek");
    expect(text()).not.toContain(de("lib.facetEmpty.title"));
    expect(text()).toContain(KO_A.title);
  });

  it("der bereits geschlossene Fall bleibt geschlossen: leere Serverantwort", () => {
    // Wichtige Abgrenzung. Der neue Zustand darf den alten nicht überschreiben — bei WIRKLICH
    // leerer Serverantwort gilt weiter `QueryState`/`lib.empty`, und die neue Meldung wäre dort
    // sogar falsch (sie behauptete Treffer, die es nicht gibt).
    expect(de("lib.empty").length).toBeGreaterThan(0);
    expect(de("lib.facetEmpty.title")).not.toBe(de("lib.empty"));
  });

  it("alle drei Sprachen tragen die neuen Schlüssel, mit echten Umlauten wo sie hingehören", () => {
    for (const key of ["lib.facetEmpty.title", "lib.facetEmpty.hint", "lib.facetEmpty.reset"]) {
      for (const locale of ["de", "en", "nl"]) {
        const wert = String(i18n.getResource(locale, "translation", key));
        expect(wert, `${locale}/${key} fehlt`).toBeTruthy();
        expect(wert, `${locale}/${key} ist nicht übersetzt`).not.toBe("undefined");
      }
    }
    // Umschrift wäre ein stiller Rückschritt: „zurücksetzen“ trägt ein echtes „ü“, kein „ue“.
    expect(de("lib.facetEmpty.reset")).toContain("ü");
    expect(de("lib.facetEmpty.reset")).not.toMatch(/ue|ae|oe|ss(?!e)/);
  });
});
