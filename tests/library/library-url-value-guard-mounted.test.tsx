// @vitest-environment jsdom
// AUFTRAG-mega11 Block C (bens SB-3): Fremde URL-Werte dürfen nicht in gespeicherten Sichten landen.
//
// Der reine Vertrag steht in library-url-value-guard.test.ts. HIER läuft die echte Seite: die echte
// Zustandsführung von Library.tsx, der echte Speicherpfad in den localStorage und der echte Reload.
// Genau diese Kette war der Befund — `libraryUrlFilters` prüfte nur Parameter-NAMEN, `Library.tsx`
// übernahm die Auswahl unverändert in `currentViewState`, und „Diese Suche merken" schrieb sie weg.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";

function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko",
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

const KO_A = ko({ id: "k-a", title: "Objekt Anlage Eins", category: "Anlage 1" });
const KO_B = ko({ id: "k-b", title: "Objekt Instandhaltung", category: "Instandhaltung" });
const KOS = [KO_A, KO_B];

// Der eingeschleuste Wert: ein Kategoriename, den es im Bestand NICHT gibt.
const FOREIGN = "erfunden";

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
import { MemoryRouter, useLocation } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { Library } from "../../apps/web/src/pages/Library";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const VIEWS_KEY = "klarwerk.library.views.u1";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function LocationProbe(): JSX.Element {
  const l = useLocation();
  return createElement("span", { "data-testid": "loc" }, `${l.pathname}${l.search}`);
}

function mount(entry = "/bibliothek"): void {
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
          { initialEntries: [entry] },
          createElement(Library),
          createElement(LocationProbe),
        ),
      ),
    );
  });
}

function unmount(): void {
  act(() => root.unmount());
  container.remove();
}

function loc(): string {
  return container.querySelector("[data-testid=loc]")?.textContent ?? "";
}

function res(key: string): string {
  return String(i18n.getResource("de", "translation", key));
}

function buttonWith(text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(text),
  );
}

// Die Sicht über die ECHTE Bedienung speichern: Name tippen, „Diese Suche merken" klicken.
function saveViewAs(name: string): void {
  const input = [...container.querySelectorAll("input")].find(
    (i) => i.placeholder === res("lib.views.namePlaceholder"),
  );
  if (!input) {
    throw new Error("Namensfeld der gespeicherten Sicht fehlt");
  }
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(input, name);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const save = buttonWith(res("lib.views.remember"));
  if (!save) {
    throw new Error("Knopf „Diese Suche merken“ fehlt");
  }
  act(() => save.click());
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
});

afterEach(() => {
  unmount();
  window.localStorage.clear();
});

describe("Block C: ein fremder URL-Wert wird kein echter Facettenwert", () => {
  it("unbekannter Wert bei bekanntem Schlüssel filtert NICHT und steht in keiner Pille", () => {
    mount(`/bibliothek?category=${FOREIGN}`);

    // Vorher filterte er auf null Treffer und stand als echter Wert in der Aktive-Filter-Leiste.
    expect(container.textContent).toContain("Objekt Anlage Eins");
    expect(container.textContent).toContain("Objekt Instandhaltung");
    expect(container.textContent).not.toContain(FOREIGN);
    expect(container.textContent).not.toContain(res("facet.active"));
    // Und er wird ausdrücklich NICHT zum strukturellen No-Match umgedeutet.
    expect(container.textContent).not.toContain(res("facet.noMatch"));
    // Die URL sagt danach die Wahrheit über das, was gezeigt wird.
    expect(loc()).not.toContain(FOREIGN);
  });

  it("gemischt: der bekannte Wert filtert, der unbekannte verschwindet", () => {
    mount(`/bibliothek?category=Anlage+1&category=${FOREIGN}`);

    expect(container.textContent).toContain("Objekt Anlage Eins");
    expect(container.textContent).not.toContain("Objekt Instandhaltung");
    expect(container.textContent).toContain(res("facet.active"));
    expect(container.textContent).not.toContain(FOREIGN);
    expect(loc()).toContain("category=Anlage+1");
    expect(loc()).not.toContain(FOREIGN);
  });

  it("eine GESPEICHERTE SICHT enthält keinen Fremdwert — das war der eigentliche Schaden", () => {
    mount(`/bibliothek?category=Anlage+1&category=${FOREIGN}`);

    saveViewAs("Meine Sicht");

    const raw = window.localStorage.getItem(VIEWS_KEY) ?? "";
    expect(raw).not.toBe("");
    // Der eingeschleuste Wert hat den Browser-Speicher nie erreicht …
    expect(raw).not.toContain(FOREIGN);
    // … die echte Auswahl schon.
    expect(raw).toContain("Anlage 1");
  });

  it("Reload: der bereinigte Zustand bleibt bereinigt, die echte Auswahl bleibt erhalten", () => {
    mount(`/bibliothek?category=Anlage+1&category=${FOREIGN}`);
    const after = loc();
    unmount();

    // Genau die Adresse, die nach der Bereinigung in der Leiste steht — das ist der Reload.
    mount(after);
    expect(container.textContent).toContain("Objekt Anlage Eins");
    expect(container.textContent).not.toContain("Objekt Instandhaltung");
    expect(container.textContent).not.toContain(FOREIGN);
    expect(loc()).toBe(after);
  });

  it("ein gültiger Deep-Link bleibt unverändert gültig (Regelfall aus „Risiko & Lücken“)", () => {
    mount("/bibliothek?category=Instandhaltung");
    expect(container.textContent).toContain("Objekt Instandhaltung");
    expect(container.textContent).not.toContain("Objekt Anlage Eins");
    expect(loc()).toContain("category=Instandhaltung");
  });

  it("`?origin=` behält seinen Sondervertrag: ein Tippfehler zeigt keine leere Liste", () => {
    mount("/bibliothek?origin=quatsch");
    expect(container.textContent).toContain("Objekt Anlage Eins");
    expect(container.textContent).toContain("Objekt Instandhaltung");
    expect(container.textContent).not.toContain(res("facet.active"));
  });
});
