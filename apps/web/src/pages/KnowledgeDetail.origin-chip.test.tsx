// @vitest-environment jsdom
// ================================================================================================
// JOB 679 / D2 (K1.2, Weg A) — DER HERKUNFTS-CHIP „AUS WORD" IM KO-DETAIL.
// ================================================================================================
//
// Die Schwester von `Library.origin-chip.test.tsx`, dieselbe Zusage an der zweiten Ansicht aus
// Pedis Wortlaut. Auch hier wird an der GEMOUNTETEN Seite gemessen und in BEIDE Richtungen: der
// Chip erscheint bei `word_addin` und bei keiner anderen Herkunft.
//
// Die Seite haengt an vielen Haken; gemockt wird deshalb der EINE Zugang `../api/hooks` — nicht der
// Renderer und nicht die Chip-Bedingung. Was hier geprueft wird, ist die echte Komponente.
//
// JOB 3063 (H4) — UMGEZOGEN, NICHT ABGESCHWÄCHT. `/wissen/:id` ist seit H4 dieselbe Fläche wie
// `/bibliothek`, mit dem Eintrag der Adresse vorgewaehlt. Der Chip steht auf der Lesefläche hinter
// der Zeile „Mehr" im Abschnitt „Provenienz" (`components/bibliothek/MehrAbschnitte.tsx:688`).
// Dieser Test klappt den Abschnitt IN JEDEM FALL auf — auch in den Verneinungen. Sonst hiesse „kein
// Chip" nur „der Abschnitt ist zu", und die Gegenrichtung bewiese nichts mehr.
import { afterEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../api/types";

function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Ventil X schliesst bei Ueberdruck",
    statement: "Bei Ueberdruck Ventil X manuell schliessen.",
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
    comments: [],
    attachments: [],
    sources: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

const lage = vi.hoisted(() => ({ ko: null as unknown }));

// TEILMOCK und nicht Vollersatz: die Seite zieht ueber Unterkomponenten (ImageDescribeProvider →
// useAiAvailable) weitere Haken, die mit dem Gegenstand nichts zu tun haben. Eine handgepflegte
// Vollliste waere eine zweite, driftende Wahrheit ueber `api/hooks` — sie zerbraeche bei jedem neuen
// Haken. Ueberschrieben wird deshalb NUR, was dieser Test wirklich steuert.
vi.mock("../api/hooks", async (importOriginal) => {
  const echt = await importOriginal<Record<string, unknown>>();
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  const leer = () => ok([]);
  return {
    ...echt,
    useKo: () => ok(lage.ko),
    useKos: leer,
    useAudit: leer,
    useConflicts: leer,
    useDirectory: leer,
    useKoEvidence: leer,
    useKoNeighbors: leer,
    useKoVersions: leer,
    useLifecyclePending: leer,
    useExternalPolicy: () => ok({ stage: "blocked" }),
  };
});
vi.mock("../app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u9", role: "experte" } }),
}));
vi.mock("../app/RoleContext", () => ({ useRole: () => ({ role: "experte" }) }));
vi.mock("../app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import i18n from "../i18n";
import { KnowledgeDetail } from "./KnowledgeDetail";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const CHIP = '[data-testid="ko-origin-word-addin"]';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(objekt: KnowledgeObject): void {
  lage.ko = objekt;
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
          { initialEntries: ["/wissen/ko-1"] },
          createElement(
            Routes,
            null,
            createElement(Route, {
              path: "/wissen/:id",
              element: createElement(KnowledgeDetail),
            }),
          ),
        ),
      ),
    );
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  lage.ko = null;
});

/**
 * Die Zeile „Mehr" aufklappen und den Abschnitt „Provenienz" öffnen. `open = true` allein genügt
 * nicht: der Abschnitt zeichnet seinen Inhalt erst, wenn React das Aufklappen über `onToggle`
 * mitbekommt, und jsdom stellt `toggle` nur in die Warteschlange. Der Test schickt das Ereignis
 * deshalb selbst am Element (es steigt nicht auf).
 */
function provenienzOeffnen(): void {
  const mehr = container.querySelector('[data-testid="bib-mehr"]');
  if (!(mehr instanceof HTMLButtonElement)) {
    throw new Error(`Zeile „Mehr“ fehlt; DOM: ${container.textContent}`);
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

describe("JOB 679 D2 · KO-Detail — der Chip erscheint genau bei der Word-Herkunft", () => {
  it("ein aus Word erfasstes Objekt traegt den Chip", () => {
    mount(ko({ origin: "word_addin" }));
    expect(chips()).toHaveLength(1);
  });

  it("der Chip nennt die Herkunft im Klartext und erklaert sie im Titel", () => {
    mount(ko({ origin: "word_addin" }));
    const chip = chips()[0];
    expect(chip?.textContent?.trim()).toBe(de("ko.originWordAddin.label"));
    expect(chip?.getAttribute("title")).toBe(de("ko.originWordAddin.hint"));
  });

  it("ein Objekt ohne Herkunft traegt ihn NICHT — Altbestand ist nicht „aus Word“", () => {
    mount(ko({}));
    expect(chips()).toHaveLength(0);
  });

  it("ein Objekt aus der Vordertuer traegt ihn NICHT", () => {
    mount(ko({ origin: "frontdoor" }));
    expect(chips()).toHaveLength(0);
  });

  it("die uebrigen Herkuenfte loesen ihn ebenfalls nicht aus", () => {
    for (const herkunft of ["tell", "studio", "expert"] as const) {
      mount(ko({ origin: herkunft }));
      expect(chips(), `Herkunft ${herkunft} zeigt faelschlich den Word-Chip`).toHaveLength(0);
      act(() => {
        root.unmount();
      });
      container.remove();
    }
    // Der abschliessende afterEach braucht einen gemounteten Baum — den letzten wieder aufbauen.
    mount(ko({}));
  });
});

describe("JOB 679 D2 · Sprachparitaet — der Chip spricht alle drei Sprachen", () => {
  // Die Beschriftung ist Teil der Zusage: „Dreisprachig DE/EN/NL (i18n.ts)". Geprueft wird, dass
  // jede Sprache einen EIGENEN Text hat — ein aus dem Englischen stehengebliebener NL-Text waere
  // genau der Mangel, den die dritte Gegenmutation dieses Auftrags rot machen muss.
  const sprachen = ["de", "en", "nl"] as const;

  it.each(["ko.originWordAddin.label", "ko.originWordAddin.hint"])(
    "%s ist in DE, EN und NL gesetzt und nirgends leer",
    (key) => {
      for (const sprache of sprachen) {
        const wert = i18n.getResource(sprache, "translation", key);
        expect(typeof wert, `${key} fehlt in ${sprache}`).toBe("string");
        expect(String(wert).trim().length, `${key} ist in ${sprache} leer`).toBeGreaterThan(0);
      }
    },
  );

  it.each(["ko.originWordAddin.label", "ko.originWordAddin.hint"])(
    "%s ist im Niederlaendischen wirklich uebersetzt, nicht englisch belassen",
    (key) => {
      const en = String(i18n.getResource("en", "translation", key));
      const nl = String(i18n.getResource("nl", "translation", key));
      expect(nl, `${key}: NL ist zeichengleich mit EN — nicht uebersetzt`).not.toBe(en);
    },
  );
});
