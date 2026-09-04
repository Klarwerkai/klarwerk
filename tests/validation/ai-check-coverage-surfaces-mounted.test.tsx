// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega29 BLOCK C (bens M28-3) — DIE FLÄCHEN, DIE DIE EINSCHRÄNKUNG BISHER NICHT ERREICHTE.
// ================================================================================================
//
// Gemountet, an den ECHTEN Seiten und über die ECHTEN Lese-Hooks. Belegt wird je Fläche BEIDES:
// dass die Einschränkung ankommt, wenn es etwas einzuschränken gibt — UND dass sie schweigt, wenn
// nicht. Ohne die zweite Hälfte belegte dieser Test nur, dass irgendwo ein Satz steht.
//
//   C1 — KO-Detail: die Ansicht, in der jemand EIN Objekt beurteilt. Das geladene Objekt trug
//        `aiCheck.coverage` seit mega28; die Seite hat es nie benutzt.
//   C2 — die LEEREN Konflikt- und Duplikat-Boards. „Keine offenen Konflikte" ist wörtlich richtig
//        und liest sich ohne Fußnote als „der Bestand ist geprüft und frei".
import { afterEach, describe, expect, it, vi } from "vitest";

const data = vi.hoisted(() => ({
  summary: { total: 12479, incomplete: 12470, unchecked: 5 },
  ko: null as unknown,
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    aiCheck: { coverageSummary: vi.fn(async () => data.summary) },
    conflicts: { list: vi.fn(async () => []) },
    duplicates: { list: vi.fn(async () => []) },
    // JOB 3061 · H2: der gemeinsame Reiterkopf zaehlt alle vier Reiter aus echten Abrufen.
    validation: { board: vi.fn(async () => []), overview: vi.fn(async () => []) },
    ko: {
      list: vi.fn(async () => []),
      get: vi.fn(async () => data.ko),
      versions: vi.fn(async () => []),
      evidence: vi.fn(async () => []),
    },
    audit: { list: vi.fn(async () => []) },
    lifecycle: {
      pending: vi.fn(async () => []),
      couplingsFor: vi.fn(async () => []),
    },
    directory: { list: vi.fn(async () => []) },
    external: { policy: vi.fn(async () => ({ stage: "blocked" })) },
    uploadLimits: {
      get: vi.fn(async () => ({
        maxImageBytes: 1_000_000,
        maxDocumentBytes: 1_000_000,
        maxRawBytes: 1_000_000,
        maxBodyBytes: 1_000_000,
      })),
    },
    reasoner: {
      status: vi.fn(async () => ({
        active: false,
        mode: "off",
        reachable: "unknown",
        tasks: {},
      })),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import type { AiCheckCoverage, KnowledgeObject } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Conflicts } from "../../apps/web/src/pages/Conflicts";
import { Duplicates } from "../../apps/web/src/pages/Duplicates";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

const pageText = (): string => (container.textContent ?? "").replace(/\s+/g, " ");

/**
 * JOB 3063 (H4): `/wissen/:id` ist die Leseflaeche der Bibliothek. Der Abschnitt „Konflikt" liegt
 * hinter der Zeile „Mehr" und ist zugeklappt die Vorgabe. `open = true` allein genuegt nicht:
 * React zeichnet den Inhalt erst mit dem `toggle`-Ereignis, und jsdom stellt es nur in die
 * Warteschlange — der Test schickt es deshalb selbst.
 */
function konfliktAbschnittOeffnen(): void {
  const mehr = container.querySelector('[data-testid="bib-mehr"]');
  if (mehr instanceof HTMLButtonElement && mehr.getAttribute("aria-expanded") !== "true") {
    act(() => {
      mehr.click();
    });
  }
  const abschnitt = container.querySelector('[data-bib-abschnitt="konflikt"]');
  if (!(abschnitt instanceof HTMLDetailsElement)) {
    throw new Error(`Abschnitt „Konflikt" fehlt; DOM: ${container.textContent}`);
  }
  if (!abschnitt.open) {
    act(() => {
      abschnitt.open = true;
      abschnitt.dispatchEvent(new Event("toggle"));
    });
  }
}

async function mount(
  element: JSX.Element,
  opts: { path?: string; route?: string } = {},
): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          { initialEntries: [opts.path ?? "/"] },
          createElement(
            AuthProvider,
            null,
            createElement(
              RoleProvider,
              null,
              createElement(
                ToastProvider,
                null,
                createElement(
                  Routes,
                  null,
                  createElement(Route, { path: opts.route ?? "/", element }),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  // Zwei weitere Runden: react-query löst die Abfragen erst nach der ersten Runde auf, und das
  // Nachrendern mit den Daten braucht eine eigene act-Runde (sonst liest der Test den Ladezustand).
  await act(flush);
  await act(flush);
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  data.summary = { total: 12479, incomplete: 12470, unchecked: 5 };
});

const CAPPED: AiCheckCoverage = {
  available: 12479,
  selected: 20,
  alreadyOpen: 0,
  attempted: 20,
  completed: 20,
  skipped: 0,
  capped: true,
  aborted: false,
};

function makeKo(coverage: AiCheckCoverage | undefined): KnowledgeObject {
  return {
    id: "k1",
    title: "Pumpe P2 Druckverlust",
    statement: "Bei Pumpe P2 faellt der Druck an Ventil V4.",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Betrieb",
    tags: [],
    confidence: 0.8,
    trust: 70,
    status: "validiert",
    version: 1,
    originalAuthor: "u1",
    author: "u1",
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-07-01T10:00:00.000Z",
    history: [],
    ...(coverage
      ? {
          aiCheck: {
            status: "done" as const,
            requestedAt: "2026-07-26T06:00:00.000Z",
            finishedAt: "2026-07-26T06:01:00.000Z",
            coverage,
          },
        }
      : {}),
  };
}

// JOB 3061 · H2 — DER VORBEHALT IST GEBLIEBEN, SEIN ORT HAT SICH GEÄNDERT.
//
// Der Auftrag verlangt für den Leerzustand EINEN Satz auf der Fläche („Keine offenen Konflikte.")
// und verlagert jeden Erklärtext ins „?"-Menü der Seite (§5.4, §8.5). Der Deckel-Vorbehalt steht
// dort — WÖRTLICH derselbe Satz aus derselben Komponente (`AiCheckBoardCaveat`), mit denselben
// Zahlen aus demselben Abruf. Die Zusicherung von mega29 C2 bleibt damit unverändert wahr; sie
// wird hier nur nach einem echten Klick gemessen statt ohne. Die KALIBRIERUNG unten ist die
// Gegenprobe, die sie trägt: ein vollständig geprüfter Bestand bekommt auch im geöffneten Menü
// KEINEN Warnsatz.
/** Das „?"-Menü der Prüffläche öffnen — dort wohnt alles Erklärende.
 *  Zwei zusätzliche Runden, weil `AiCheckBoardCaveat` seinen Abruf ERST beim Öffnen startet: ein
 *  geschlossenes Menü rendert seinen Inhalt gar nicht, und damit läuft auch kein Hook. */
async function oeffneHilfe(): Promise<void> {
  await act(async () => {
    (container.querySelector('[data-testid="pruefen-menue-hilfe"]') as HTMLElement | null)?.click();
    await flush();
  });
  await act(flush);
  await act(flush);
}

describe("mega29 C2 · das LEERE Board sagt, was sein leeres Ergebnis nicht heißt", () => {
  it("Konflikt-Board: die Fußnote nennt die Zahlen des Bestands", async () => {
    await mount(createElement(Conflicts));
    expect(pageText()).toContain(i18n.t("con.empty"));
    // Vor mega29 endete die Seite hier — und „keine offenen Konflikte" war alles, was ein Mensch las.
    await oeffneHilfe();
    expect(pageText()).toContain("12470");
    expect(pageText()).toContain("12479");
    expect(pageText()).toContain("begrenzte Kandidatenmenge");
  });

  it("Duplikat-Board: dieselbe Fußnote (dort gab es bisher gar keinen Zusatz)", async () => {
    await mount(createElement(Duplicates));
    expect(pageText()).toContain(i18n.t("dup.empty"));
    await oeffneHilfe();
    expect(pageText()).toContain("12470");
    expect(pageText()).toContain("begrenzte Kandidatenmenge");
  });

  it("KALIBRIERUNG: ein durchweg vollständig geprüfter Bestand bekommt KEINEN Warnsatz", async () => {
    data.summary = { total: 12, incomplete: 0, unchecked: 0 };
    await mount(createElement(Conflicts));
    expect(pageText()).toContain(i18n.t("con.empty"));
    await oeffneHilfe();
    expect(pageText()).not.toContain("begrenzte Kandidatenmenge");
  });
});

describe("mega29 C1 · das KO-Detail zeigt die Abdeckung des Laufs, der über dieses Objekt urteilte", () => {
  it("gedeckelter Lauf → die Einschränkung steht an der Ansicht", async () => {
    data.ko = makeKo(CAPPED);
    await mount(createElement(KnowledgeDetail), { path: "/wissen/k1", route: "/wissen/:id" });
    expect(pageText()).toContain("Pumpe P2 Druckverlust");
    // JOB 3063 (H4): die Deckungsnotiz steht weiterhin DIREKT bei der Konfliktaussage, die sie
    // einschränkt — und die liegt seit dem Umbau im Abschnitt „Konflikt" hinter der Zeile „Mehr"
    // (`components/bibliothek/MehrAbschnitte.tsx:428`). Aufgeklappt wird hier, gemessen wie bisher.
    konfliktAbschnittOeffnen();
    // mega29 B3: die Zahl ist eine konservative Mindestabdeckung und heißt auch so.
    expect(pageText()).toContain("mindestens");
    expect(pageText()).toContain("12479");
    expect(pageText()).toContain("Konflikten und Duplikaten");
  });

  it("KALIBRIERUNG: vollständiger Lauf → die Ansicht schweigt (kein Dauerrauschen)", async () => {
    data.ko = makeKo({
      available: 12,
      selected: 12,
      alreadyOpen: 0,
      attempted: 12,
      completed: 12,
      skipped: 0,
      capped: false,
      aborted: false,
    });
    await mount(createElement(KnowledgeDetail), { path: "/wissen/k1", route: "/wissen/:id" });
    expect(pageText()).toContain("Pumpe P2 Druckverlust");
    // Auch die Verneinung wird am OFFENEN Abschnitt gemessen — sonst hiesse „schweigt" nur
    // „der Abschnitt ist zu", und die Kalibrierung bewiese nichts.
    konfliktAbschnittOeffnen();
    expect(pageText()).not.toContain("Konflikten und Duplikaten");
  });

  it("KALIBRIERUNG: Altbestand ohne Protokoll → nichts behauptet, in keine Richtung", async () => {
    data.ko = makeKo(undefined);
    await mount(createElement(KnowledgeDetail), { path: "/wissen/k1", route: "/wissen/:id" });
    expect(pageText()).toContain("Pumpe P2 Druckverlust");
    // Auch die Verneinung wird am OFFENEN Abschnitt gemessen — sonst hiesse „schweigt" nur
    // „der Abschnitt ist zu", und die Kalibrierung bewiese nichts.
    konfliktAbschnittOeffnen();
    expect(pageText()).not.toContain("Konflikten und Duplikaten");
  });
});
