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
// wahr. Fall 7 misst deshalb an den Listentiteln, nicht an einer Marke, die erst ins Produkt
// gedrückt werden müsste.
//
// JOB 3063 (H4) — UMGEZOGEN. Die Bibliothek ist seit H4 Liste plus Lesefläche. Die Erstellzeit steht
// nicht mehr an einer Trefferkarte mit eigener Marke `ko-zeitstempel`, sondern als DRITTES GLIED der
// Meta-Zeile der Lesefläche („Stufe · Bereich · Autor · Datum",
// `components/bibliothek/BibliothekLesen.tsx:394,416`) — genau die Zeile, die das Mockup vorgibt.
// Gemessen wird deshalb an `[data-testid="bib-meta"]`.
//
// WAS DABEI WEGGEFALLEN IST, ehrlich benannt: die Beschriftung „Erstellt am" (`ko.createdAt`) als
// sichtbarer Text und als `title`. Das Mockup gibt für diese Zeile drei Werte ohne Beschriftungen
// vor; ein Erklärwort dort wäre genau der Textzuwachs, den JOB 3063 abschafft. Die OWNERENTSCHEIDUNG
// von JOB 528 bindet den WERT `createdAt` — und der steht weiter da. Fall F2 vergleicht ihn deshalb
// weiter gegen den HELFER `formatKoTimestamp`, nur ohne die Beschriftungszusage.
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

// TEILMOCK: die Lesefläche zieht über ihre Abschnitte weitere Haken, die mit der Zeitangabe nichts
// zu tun haben. Überschrieben wird nur, was dieser Test wirklich steuert.
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
import { formatKoTimestamp } from "../lib/koDates";
import { Library } from "./Library";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

/** Die eine Marke, an der die Zeitangabe gemessen wird — kein Raten an CSS-Klassen. */
const META = '[data-testid="bib-meta"]';

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

/** Die Meta-Zeile der Lesefläche, als Text. Fehlt sie, ist das ein Fehler und keine „0 Treffer". */
function metaZeile(): string {
  const el = container.querySelector(META);
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Meta-Zeile fehlt; DOM: ${container.textContent}`);
  }
  return (el.textContent ?? "").trim();
}

/** Einen Eintrag in der linken Liste wählen — der Weg des Menschen. */
function waehle(id: string): void {
  const zeile = container.querySelector(`[data-testid="bib-zeile"][data-bib-id="${id}"]`);
  if (!(zeile instanceof HTMLElement)) {
    throw new Error(`Listenzeile „${id}“ fehlt`);
  }
  act(() => {
    zeile.click();
  });
}

describe("JOB 528 · Bibliothek — die Erstellzeit steht in der Meta-Zeile der Lesefläche", () => {
  it("F1 · ein Eintrag mit createdAt trägt die Zeitangabe", () => {
    mount([ko({ id: "a", title: "Mit Datum", createdAt: ISO })]);
    expect(metaZeile()).toContain(String(formatKoTimestamp(ISO, i18n.language)));
  });

  it("F2 · sie ist lokalisiert — verglichen gegen den HELFER, nicht gegen eine abgeschriebene Zeichenkette", () => {
    mount([ko({ id: "a", createdAt: ISO })]);
    // Der erwartete Text entsteht aus derselben Quelle wie die Anzeige. Eine hier fest
    // hineingeschriebene Zeichenkette würde bei jedem Locale-Wechsel der Laufzeit falsch — und
    // wäre damit ein Test über meine Tastatur statt über das Produkt.
    const erwartet = formatKoTimestamp(ISO, i18n.language);
    expect(erwartet).not.toBeNull();
    // Das Datum ist das LETZTE Glied der Zeile („Stufe · Bereich · Autor · Datum"). Das prüft
    // zugleich, dass es nicht irgendwo mitten im Text auftaucht.
    expect(metaZeile().endsWith(` · ${String(erwartet)}`)).toBe(true);
  });

  it("F3 · Altbestand OHNE createdAt trägt sie NICHT — kein Platzhalterdatum", () => {
    mount([ko({ id: "a", title: "Altbestand", createdAt: undefined })]);
    const zeile = metaZeile();
    expect(zeile).not.toContain(String(formatKoTimestamp(ISO, i18n.language)));
    // Kein leerhängendes Trennzeichen am Ende — die Zeile darf nicht „… · " lauten.
    expect(zeile.endsWith("·")).toBe(false);
  });

  it("F4 · ein unbrauchbarer Wert trägt sie ebenfalls nicht", () => {
    mount([ko({ id: "a", title: "Kaputt", createdAt: "kein-datum" })]);
    expect(metaZeile()).not.toContain("kein-datum");
    expect(metaZeile().endsWith("·")).toBe(false);
  });

  it("F5 · ein leerer Wert trägt sie nicht — und erzeugt KEINE 1970-Anzeige", () => {
    mount([ko({ id: "a", title: "Leer", createdAt: "" })]);
    expect(metaZeile().endsWith("·")).toBe(false);
    // Der Fall, vor dem die Ownerentscheidung ausdrücklich warnt: Die Epoche darf nirgends
    // auftauchen — weder in der Zeile noch sonst im gerenderten Text.
    expect(container.textContent).not.toContain("1970");
    expect(container.textContent).not.toContain("01.01.1970");
  });

  it("F6 · bei gemischtem Bestand trägt GENAU der datierte Eintrag die Zeitangabe", () => {
    mount([
      ko({ id: "a", title: "Mit Datum", createdAt: ISO }),
      ko({ id: "b", title: "Ohne Datum", createdAt: undefined }),
    ]);
    const datiert = metaZeile();
    const erwartet = String(formatKoTimestamp(ISO, i18n.language));
    expect(datiert).toContain(erwartet);
    waehle("b");
    const undatiert = metaZeile();
    expect(undatiert).not.toContain(erwartet);
    // Der Unterschied zwischen beiden Zeilen ist GENAU das Datum — nicht mehr und nicht weniger.
    expect(`${undatiert} · ${erwartet}`).toBe(datiert);
    expect(container.textContent).not.toContain("1970");
  });

  it("F7 · KALIBRIERUNG — beide Einträge stehen wirklich in der Liste", () => {
    // Ohne diesen Fall wären F3 bis F6 auch an einer leeren Seite grün. Gemessen wird an den
    // Listentiteln: sie stammen aus dem Bestand und nicht aus einer Marke, die dieser Test erst
    // ins Produkt drücken müsste.
    mount([
      ko({ id: "a", title: "Mit Datum", createdAt: ISO }),
      ko({ id: "b", title: "Ohne Datum", createdAt: undefined }),
    ]);
    const titel = [...container.querySelectorAll('[data-bib-text="zeile-titel"]')].map((e) =>
      (e.textContent ?? "").trim(),
    );
    expect(titel).toEqual(["Mit Datum", "Ohne Datum"]);
  });
});
