// @vitest-environment jsdom
// ================================================================================================
// JOB 528 — DIE BIBLIOTHEK ZEIGT DIE ERSTELLZEIT. GEMESSEN AN DER GEMOUNTETEN SEITE.
// ================================================================================================
//
// DIE OWNERENTSCHEIDUNG (00_CONTROL/ENTSCHEIDUNGEN/JOB-528.md, 13.08.2026) bindet GENAU EINEN Wert:
// `createdAt`. Ausdrücklich verworfen wurden „Änderungszeit (`koChangedMs`)" und „Beide anzeigen".
// Ihre Begründung nennt zugleich die Gefahr, gegen die dieser Test steht:
//
//   „`koChangedMs` kommt in Millisekunden, muss umgerechnet und bei 0 unterdrückt werden,
//    sonst erscheint der 01.01.1970."
//
// Genau dieser 01.01.1970 ist der Fall, den die Fälle 3 bis 5 verbieten — und den die
// Epochen-Gegenmutation nach dem Bau kausal auslöst.
//
// WARUM GEMOUNTET UND NICHT ÜBER DEN QUELLTEXT: Ein Test, der `formatKoTimestamp` in `Library.tsx`
// nachschlägt, bewiese, dass ein Aufruf dasteht — nicht, dass eine Nutzerin eine Zeit sieht. Diese
// Datei mountet die echte Seite und liest den DOM.
//
// WARUM FALL 7 KEIN BEIWERK IST: Ohne Renderkalibrierung wären die Negativfälle 3 bis 5 auch dann
// grün, wenn die Karte überhaupt nicht rendert — „keine Zeitzeile" ist an einer leeren Seite trivial
// wahr. Fall 7 misst deshalb an den Kartentiteln, nicht an einer Marke, die erst ins Produkt
// gedrückt werden müsste.
import { afterEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../api/types";

// JOB 1988: Die Fälle F3, F6 und F7 setzen `createdAt` AUSDRÜCKLICH auf `undefined` — sie prüfen
// den Altbestand ohne Datum, und das Weglassen wäre nicht dasselbe (der Vorgabewert bliebe stehen).
// Unter `exactOptionalPropertyTypes` verlangt genau das ein `| undefined` im Parametertyp;
// `Partial<…>` erlaubt nur das Fehlen. Am Verhalten des Helfers ändert sich nichts.
function ko(
  overrides: { [K in keyof KnowledgeObject]?: KnowledgeObject[K] | undefined },
): KnowledgeObject {
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
    createdAt: "2026-08-12T09:41:00.000Z",
    history: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

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
import { formatKoTimestamp } from "../lib/koDates";
import { Library } from "./Library";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Die eine Marke, an der die Zeitzeile gemessen wird — kein Raten an CSS-Klassen. */
const ZEIT = '[data-testid="ko-zeitstempel"]';

const ISO = "2026-08-12T09:41:00.000Z";

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

function zeitzeilen(): HTMLElement[] {
  return [...container.querySelectorAll(ZEIT)] as HTMLElement[];
}

function de(key: string): string {
  return String(i18n.getResource("de", "translation", key));
}

describe("JOB 528 · Bibliothek — die Erstellzeit steht an der Karte", () => {
  it("F1 · ein Treffer mit createdAt trägt die Zeitangabe", () => {
    mount([ko({ id: "a", title: "Mit Datum", createdAt: ISO })]);
    expect(zeitzeilen()).toHaveLength(1);
  });

  it("F2 · sie ist lokalisiert und beschriftet — verglichen gegen den HELFER, nicht gegen eine abgeschriebene Zeichenkette", () => {
    mount([ko({ id: "a", createdAt: ISO })]);
    // Zuerst die Existenz: sonst meldet der Fall bei fehlender Zeile nur einen Typkonflikt und
    // sagt nicht, WAS fehlt.
    expect(zeitzeilen()).toHaveLength(1);
    const zeile = zeitzeilen()[0];
    // Der erwartete Text entsteht aus derselben Quelle wie die Anzeige. Eine hier fest
    // hineingeschriebene Zeichenkette würde bei jedem Locale-Wechsel der Laufzeit falsch — und
    // wäre damit ein Test über meine Tastatur statt über das Produkt.
    const erwartet = formatKoTimestamp(ISO, i18n.language);
    expect(erwartet).not.toBeNull();
    expect(zeile?.textContent).toContain(String(erwartet));
    // Die Beschriftung kommt aus dem VORHANDENEN dreisprachigen Schlüssel — kein neuer Text.
    expect(zeile?.getAttribute("title")).toBe(de("ko.createdAt"));
    expect(zeile?.textContent).toContain(de("ko.createdAt"));
  });

  it("F3 · Altbestand OHNE createdAt trägt sie NICHT — kein Platzhalterdatum", () => {
    mount([ko({ id: "a", title: "Altbestand", createdAt: undefined })]);
    expect(zeitzeilen()).toHaveLength(0);
  });

  it("F4 · ein unbrauchbarer Wert trägt sie ebenfalls nicht", () => {
    mount([ko({ id: "a", title: "Kaputt", createdAt: "kein-datum" })]);
    expect(zeitzeilen()).toHaveLength(0);
  });

  it("F5 · ein leerer Wert trägt sie nicht — und erzeugt KEINE 1970-Anzeige", () => {
    mount([ko({ id: "a", title: "Leer", createdAt: "" })]);
    expect(zeitzeilen()).toHaveLength(0);
    // Der Fall, vor dem die Ownerentscheidung ausdrücklich warnt: Die Epoche darf nirgends
    // auftauchen — weder in der Zeile noch sonst im gerenderten Text.
    expect(container.textContent).not.toContain("1970");
    expect(container.textContent).not.toContain("01.01.1970");
  });

  it("F6 · bei gemischtem Bestand trägt GENAU der datierte Treffer die Zeile", () => {
    mount([
      ko({ id: "a", title: "Mit Datum", createdAt: ISO }),
      ko({ id: "b", title: "Ohne Datum", createdAt: undefined }),
    ]);
    expect(zeitzeilen()).toHaveLength(1);
    expect(container.textContent).not.toContain("1970");
  });

  it("F7 · KALIBRIERUNG — beide Zielkarten stehen wirklich im DOM", () => {
    // Ohne diesen Fall wären F3 bis F6 auch an einer leeren Seite grün. Gemessen wird an den
    // Kartentiteln: sie stammen aus dem Bestand und nicht aus einer Marke, die dieser Test erst
    // ins Produkt drücken müsste.
    mount([
      ko({ id: "a", title: "Mit Datum", createdAt: ISO }),
      ko({ id: "b", title: "Ohne Datum", createdAt: undefined }),
    ]);
    expect(container.textContent).toContain("Mit Datum");
    expect(container.textContent).toContain("Ohne Datum");
  });
});
