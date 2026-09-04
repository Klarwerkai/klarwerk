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
//
// JOB 3063 (H4) — UMGEZOGEN, NICHT ABGESCHWÄCHT. Die Bibliothek ist seit H4 Liste plus Lesefläche;
// die Trefferzeile trägt nur noch Punkt, Titel und „Bereich · Status". Der Herkunfts-Chip steht
// jetzt dort, wo das Funktionsinventar (AUFTRAG 5a) ihn hinschickt: auf der Lesefläche, hinter der
// Zeile „Mehr" im Abschnitt „Provenienz" (`components/bibliothek/MehrAbschnitte.tsx:688`). Dieser
// Test öffnet den Abschnitt IN JEDEM FALL — auch in den Verneinungen. Sonst wäre „kein Chip" nur
// die Aussage „der Abschnitt ist zu", und die Gegenrichtung würde nichts mehr beweisen.
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

// TEILMOCK statt Vollersatz: die Lesefläche zieht über ihre Abschnitte weitere Haken, die mit dem
// Gegenstand nichts zu tun haben. Überschrieben wird nur, was dieser Test wirklich steuert.
vi.mock("../api/hooks", async (importOriginal) => {
  const echt = await importOriginal<Record<string, unknown>>();
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  const leer = () => ok([]);
  return {
    ...echt,
    useKos: () => ok(lage.kos),
    useLibrarySearch: () => ok(lage.kos),
    useDirectory: leer,
    useConflicts: leer,
    // Die Lesefläche holt den gewählten Eintrag einzeln — hier aus demselben Bestand.
    useKo: (id: string) =>
      ok((lage.kos as { id: string }[]).find((k) => k.id === id) ?? lage.kos[0] ?? null),
    useAudit: leer,
    useKoEvidence: leer,
    useKoNeighbors: leer,
    useKoVersions: leer,
    useEigeneBefunde: leer,
    useLifecyclePending: leer,
    useExternalPolicy: () => ok({ stage: "blocked" }),
    useReasonerStatus: () => ok({ ready: false }),
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
Element.prototype.scrollIntoView = () => {};

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

/** Einen Eintrag in der linken Liste wählen — der Weg des Menschen, ein Klick auf die Zeile. */
function waehle(id: string): void {
  const zeile = container.querySelector(`[data-testid="bib-zeile"][data-bib-id="${id}"]`);
  if (!(zeile instanceof HTMLElement)) {
    throw new Error(`Listenzeile „${id}" fehlt`);
  }
  act(() => {
    zeile.click();
  });
}

/**
 * Die Zeile „Mehr" der Lesefläche aufklappen und den Abschnitt „Provenienz" öffnen — dort steht der
 * Chip seit JOB 3063. `open = true` allein genügt nicht: der Abschnitt zeichnet seinen Inhalt erst,
 * wenn React das Aufklappen über `onToggle` mitbekommt, und jsdom stellt `toggle` nur in die
 * Warteschlange. Der Test schickt das Ereignis deshalb selbst (es steigt nicht auf).
 */
function provenienzOeffnen(): void {
  const mehr = container.querySelector('[data-testid="bib-mehr"]');
  if (!(mehr instanceof HTMLButtonElement)) {
    throw new Error(`Zeile „Mehr" fehlt; DOM: ${container.textContent}`);
  }
  if (mehr.getAttribute("aria-expanded") !== "true") {
    act(() => {
      mehr.click();
    });
  }
  const abschnitt = container.querySelector('[data-bib-abschnitt="provenienz"]');
  if (!(abschnitt instanceof HTMLDetailsElement)) {
    throw new Error("Abschnitt „Provenienz“ fehlt");
  }
  act(() => {
    abschnitt.open = true;
    abschnitt.dispatchEvent(new Event("toggle"));
  });
}

/** Die Chips am OFFENEN Abschnitt — die Verneinung zählt nur, wenn der Abschnitt aufgeklappt ist. */
function chips(): HTMLElement[] {
  provenienzOeffnen();
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

  it("bei gemischtem Bestand traegt ihn GENAU der Word-Treffer — Zeile fuer Zeile durchgewaehlt", () => {
    mount([
      ko({ id: "a", title: "Aus Word", origin: "word_addin" }),
      ko({ id: "b", title: "Vordertuer", origin: "frontdoor" }),
      ko({ id: "c", title: "Altbestand" }),
    ]);
    // Jede der drei Zeilen wird angeklickt. So misst der Fall die Unterscheidung wirklich — auf der
    // Lesefläche steht immer genau EIN Eintrag, und die Reihenfolge der Liste ist hier gleichgültig.
    waehle("a");
    expect(chips(), "der Word-Treffer traegt ihn").toHaveLength(1);
    waehle("b");
    expect(chips(), "der Vordertuer-Treffer traegt ihn nicht").toHaveLength(0);
    waehle("c");
    expect(chips(), "der Altbestand traegt ihn nicht").toHaveLength(0);
    waehle("a");
    expect(chips(), "zurueck beim Word-Treffer steht er wieder da").toHaveLength(1);
  });

  it("die uebrigen Herkuenfte loesen ihn ebenfalls nicht aus", () => {
    mount([
      ko({ id: "a", origin: "tell" }),
      ko({ id: "b", origin: "studio" }),
      ko({ id: "c", origin: "expert" }),
    ]);
    for (const id of ["a", "b", "c"]) {
      waehle(id);
      expect(chips(), `Herkunft am Eintrag ${id} zeigt faelschlich den Word-Chip`).toHaveLength(0);
    }
  });
});
