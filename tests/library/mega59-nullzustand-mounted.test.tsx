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
import { eintragText, listenZaehler, menueOeffnen, zeilenTitel } from "./support/bib-flaeche";

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

// ================================================================================================
// JOB 3063 (H4) — DER STUMME NULLZUSTAND BLEIBT GESCHLOSSEN, MIT EINEM SATZ STATT EINER KARTE.
// ================================================================================================
//
// WAS mega59 D GEFUNDEN HAT und was unverändert gilt: Liefert die Suche Treffer, zeigen die aktiven
// Filter aber keinen davon, darf die Fläche nicht STUMM leer bleiben. Bis H4 stand dafür eine Karte
// mit Titel, Grundsatz („Deine Suche hat N Treffer …") und einem eigenen Reset-Knopf.
//
// WAS SICH GEÄNDERT HAT: Pedis Vorgabe vom 04.09. für den Leerzustand lautet EIN Satz plus EIN
// Knopf (Auftrag §9). Die Liste sagt jetzt „Nichts gefunden." (bei Suche) bzw. „Noch keine
// Einträge."; das Zurücksetzen steht dort, wo auch gefiltert wird — im Menü „Filter".
//
// WAS NICHT VERLOREN GEHT, und darum geht es in diesem Fall: Der Zustand ist weiterhin NICHT stumm,
// der Weg zurück ist weiterhin da, und er ist weiterhin DERSELBE Handler (`onResetFilters`) —
// kein zweiter Reset-Weg.

/** Der Reset-Eintrag im Menü „Filter" — der Nachfolger des Reset-Knopfs im Leerzustand. */
function resetEintrag(): HTMLButtonElement | undefined {
  const menue = menueOeffnen(container, "bib-menue-filter");
  const label = de("facet.reset");
  return [...menue.querySelectorAll('[role="menuitem"]')].find((b) => eintragText(b) === label) as
    | HTMLButtonElement
    | undefined;
}

/** Der Satz im leeren Listenbereich — `null`, wenn die Liste Einträge hat. */
function leerSatz(): string | null {
  const el = container.querySelector('[data-testid="bib-leer"] p');
  return el?.textContent?.trim() ?? null;
}

describe("AUFTRAG-mega59 D — null sichtbare Einträge sagen, WARUM", () => {
  it("Servertreffer + alles wegfilternde Facetten: EIN Satz UND der Weg zurück sind da", () => {
    // Zwei Dimensionen, die sich AUSSCHLIESSEN: „Anlage 1" trägt nur „ventil", „Anlage 2" nur
    // „pumpe". Beide Werte existieren wirklich im Bestand — die Kombination trifft keinen. Die
    // Suche liefert also weiter zwei Treffer, die Facetten zeigen keinen davon.
    mount("/bibliothek?category=Anlage+1&tag=pumpe");
    expect(leerSatz()).toBe(de("lib.liste.leer"));
    // Der Zähler sagt ehrlich Null — die Fläche behauptet keine Treffer, die sie nicht zeigt.
    expect(listenZaehler(container)).toBe(0);
    expect(resetEintrag(), "der Weg zurück fehlt im Filter-Menü").toBeTruthy();
    // …und kein einziger Treffer steht in der Liste (der Nullzustand ist echt, nicht behauptet).
    expect(zeilenTitel(container)).toEqual([]);
    expect(text()).not.toContain(KO_A.title);
    expect(text()).not.toContain(KO_B.title);
  });

  it("DER KLICKPFAD: nach dem Reset sind die Einträge wieder da", () => {
    mount("/bibliothek?category=Anlage+1&tag=pumpe");
    expect(zeilenTitel(container)).toEqual([]);
    const knopf = resetEintrag();
    expect(knopf).toBeTruthy();
    act(() => {
      knopf?.click();
    });
    // Der bestehende Handler (`onResetFilters`) räumt Facetten, Bereich, Umschalter und
    // Menüzustand — und damit ist die Liste zurück. Ein zweiter Reset-Weg wurde nicht gebaut.
    expect(leerSatz()).toBeNull();
    expect(zeilenTitel(container).sort()).toEqual([KO_A.title, KO_B.title].sort());
  });

  it("der Weg zurück ist mit der Tastatur erreichbar und hat einen zugänglichen Namen", () => {
    mount("/bibliothek?category=Anlage+1&tag=pumpe");
    const knopf = resetEintrag();
    // Ein echtes <button> ist per Konstruktion fokussierbar und mit Enter/Leertaste bedienbar —
    // deshalb ist genau das die Zusicherung, und nicht ein `div` mit `onClick`.
    expect(knopf?.tagName).toBe("BUTTON");
    expect(knopf?.hasAttribute("disabled")).toBe(false);
    expect(eintragText(knopf as Element).length).toBeGreaterThan(0);
    knopf?.focus();
    expect(document.activeElement).toBe(knopf);
  });

  it("ohne Filter erscheint der Leersatz NICHT — er ist kein Dauerzustand", () => {
    mount("/bibliothek");
    expect(leerSatz()).toBeNull();
    expect(zeilenTitel(container)).toContain(KO_A.title);
  });

  it("die Fläche unterscheidet „nichts gesucht“ von „nichts gefunden“", () => {
    // Wichtige Abgrenzung, die mega59 D geschaffen hat und die bleibt: der leere BESTAND und die
    // leere TREFFERMENGE sagen nicht dasselbe. Sie tun es jetzt in je einem Satz.
    expect(de("lib.liste.leer").length).toBeGreaterThan(0);
    expect(de("lib.liste.leerSuche").length).toBeGreaterThan(0);
    expect(de("lib.liste.leer")).not.toBe(de("lib.liste.leerSuche"));
  });

  it("alle drei Sprachen tragen die Schlüssel des Leerzustands, mit echten Umlauten wo sie hingehören", () => {
    for (const key of [
      "lib.liste.leer",
      "lib.liste.leerSuche",
      "lib.liste.erneut",
      "facet.reset",
    ]) {
      for (const locale of ["de", "en", "nl"]) {
        const wert = String(i18n.getResource(locale, "translation", key));
        expect(wert, `${locale}/${key} fehlt`).toBeTruthy();
        expect(wert, `${locale}/${key} ist nicht übersetzt`).not.toBe("undefined");
      }
    }
    // Umschrift wäre ein stiller Rückschritt: „zurücksetzen“ trägt ein echtes „ü“, kein „ue“.
    expect(de("facet.reset")).toContain("ü");
    expect(de("facet.reset")).not.toMatch(/ue|ae|oe|ss(?!e)/);
    expect(de("lib.liste.leer")).toContain("ä");
  });
});
