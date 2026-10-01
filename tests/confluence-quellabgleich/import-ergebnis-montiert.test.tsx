// @vitest-environment jsdom
// ================================================================================================
// R-0142 · LAUF 5 · BENS B7 — DAS IMPORTERGEBNIS AUF DER WISSENSSEITE, MONTIERT, DE/EN/NL.
// ================================================================================================
//
// Derselbe Aufbau wie `quellhinweise-montiert.test.tsx` (echte `KnowledgeDetail`, „Mehr" öffnen,
// Abschnitt „Quellen und Belege" aufklappen). Geprüft wird, dass die Fläche GENAU zeigt, was der
// Server liefert:
//   I1  Revision, Lauf, Ausgang und der ehrliche Lückenhinweis — in jeder Sprache aus dem Katalog.
//   I2  BOUND und eine vorhandene Lückenbeziehung (AVAILABLE) werden als solche genannt.
//   I3  Ohne festgehaltene Revision (Altimport): der Block sagt es, statt Lauf/Ausgang zu erfinden.
//   I4  Ein Objekt ohne Import-Anker fragt gar nicht erst an; ein 404 zeigt nichts.
import { describe, expect, it, vi } from "vitest";

const QUELLEN = "quellen";
const SEITE = "https://acme.atlassian.net/wiki/spaces/K/pages/P-1";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = async () => [];
  return {
    endpoints: {
      ko: {
        get: async () => globalThis.__r0162Ko,
        list: async () => [globalThis.__r0162Ko],
        evidence: leer,
        versions: leer,
        neighbors: async () => ({ center: "ko-1", neighbors: [], excludedTags: [], limit: 8 }),
        act: async () => globalThis.__r0162Ko,
      },
      library: { search: async () => [globalThis.__r0162Ko] },
      conflicts: { list: leer },
      duplicateSignal: { list: leer },
      audit: { list: leer },
      directory: { list: async () => [{ id: "u1", name: "Eva" }] },
      lifecycle: { pending: leer, linked: leer, couplingsFor: leer },
      external: { policy: async () => ({ stage: "blocked", enabled: false }) },
      uploadLimits: { get: async () => ({ maxAttachments: 8, maxAttachmentBytes: 20000000 }) },
      reasoner: {
        status: async () => ({ active: false, mode: "off" }),
        config: async () => ({}),
        assist: async () => ({ text: "" }),
        assistPresets: leer,
        extract: async () => ({ points: [], note: null }),
        describeImage: async () => ({}),
      },
      aiCheck: { coverageSummary: async () => ({ total: 0 }) },
      admin: {
        import: {
          knowledgeResult: async (koId: string) => {
            globalThis.__r0142Abrufe.push(koId);
            if (!globalThis.__r0142Ergebnis) {
              throw Object.assign(new Error("Nicht gefunden."), { status: 404 });
            }
            return globalThis.__r0142Ergebnis;
          },
        },
      },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import type {
  ImportKnowledgeResult,
  KnowledgeObject,
  KoSource,
} from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";

declare global {
  // Der Bestand reist über den globalen Namensraum: `vi.mock` wird hochgezogen und darf nichts aus
  // dem Modulrumpf schliessen (dieselbe Bauform wie JOB 3430).
  // eslint-disable-next-line no-var
  var __r0162Ko: KnowledgeObject;
  // eslint-disable-next-line no-var
  var __r0142Ergebnis: ImportKnowledgeResult | null;
  // eslint-disable-next-line no-var
  var __r0142Abrufe: string[];
}

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

/** Die drei Sprachen, die das Haus pflegt — und in denen die Beschriftung stehen muss. */
const SPRACHEN = ["de", "en", "nl"] as const;

function quelle(overrides: Partial<KoSource> = {}): KoSource {
  return {
    id: "q-1",
    label: "Wartungsplan",
    url: SEITE,
    excerpt: null,
    kind: "external",
    peerValidated: false,
    provider: "Confluence",
    author: "u1",
    at: "2026-09-12T09:20:00.000Z",
    ...overrides,
  } as KoSource;
}

function ko(sources: KoSource[]): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Wartungsplan",
    statement: "Die Abfüllanlage wird nach jeder Schicht gewartet.",
    bodyHtml: "<p>Zeile eins aus der Datei.</p>",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Produktion",
    tags: [],
    confidence: 80,
    trust: 80,
    status: "offen",
    version: 1,
    author: "u1",
    originalAuthor: "u1",
    neededValidations: 2,
    assignments: [],
    asset: null,
    confidentiality: "intern",
    history: [],
    createdAt: "2026-09-12T09:20:00.000Z",
    comments: [],
    sources,
    attachments: [],
  } as KnowledgeObject;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Die Fläche aufbauen, „Mehr" öffnen, den Quellenabschnitt aufklappen — der Weg eines Menschen. */
async function flaeche(sources: KoSource[], sprache = "de"): Promise<void> {
  await i18n.changeLanguage(sprache);
  globalThis.__r0162Ko = ko(sources);
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: Number.POSITIVE_INFINITY,
        refetchOnWindowFocus: false,
      },
    },
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
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
                NavGuardProvider,
                null,
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
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  const mehr = container.querySelector<HTMLElement>('[data-testid="bib-mehr"]');
  if (!mehr) {
    throw new Error("R-0162: die Lesefläche bietet kein „Mehr“ an — der Aufbau steht nicht.");
  }
  await act(async () => {
    mehr.click();
    await flush();
  });
  const abschnitt = container.querySelector<HTMLDetailsElement>(
    `[data-bib-abschnitt="${QUELLEN}"]`,
  );
  if (!abschnitt) {
    throw new Error("R-0162: der Abschnitt „Quellen und Belege“ fehlt auf der Lesefläche.");
  }
  await act(async () => {
    abschnitt.open = true;
    // jsdom stellt `toggle` in die Warteschlange, statt es sofort zu liefern; es steigt nicht auf.
    abschnitt.dispatchEvent(new Event("toggle"));
    await flush();
  });
  await act(flush);
}

function abbauen(): void {
  act(() => root.unmount());
  container.remove();
}

function abschnitt(): Element | null {
  return container.querySelector(`[data-bib-abschnitt="${QUELLEN}"]`);
}
const text = (e: Element | null | undefined): string =>
  (e?.textContent ?? "").replace(/\s+/g, " ").trim();

const SEITE_ANKER = { sourceVersion: 3 } as Partial<KoSource>;

function ergebnis(over: Partial<ImportKnowledgeResult> = {}): ImportKnowledgeResult {
  return {
    knowledgeObjectId: "ko-1",
    source: {
      sourceRecordId: "rev-1",
      sourceSystem: "Confluence",
      externalId: "P-1",
      sourceVersion: 3,
      url: SEITE,
      title: "Wartungsplan",
      contentReferenceState: "NOT_CAPTURED",
      importedAt: "2026-09-12T09:20:00.000Z",
    },
    run: {
      importId: "lauf-1",
      sourceSystem: "confluence",
      externalId: null,
      sourceScope: "K",
      requestedSourceVersion: null,
      status: "COMPLETED",
      sourceRecordId: null,
      startedAt: "2026-09-12T09:00:00.000Z",
      completedAt: "2026-09-12T09:01:00.000Z",
      failureCode: null,
      failureReason: null,
      counters: { itemsTotal: 1, itemsCreated: 1, itemsBound: 0, itemsSkipped: 0, itemsFailed: 0 },
    },
    item: { ordinal: 0, candidateItemId: "k-1", knowledgeObjectId: "ko-1", itemOutcome: "CREATED" },
    knowledgeGapRelationState: "RELATION_NOT_AVAILABLE",
    knowledgeGapIds: null,
    ...over,
  } as ImportKnowledgeResult;
}

const block = (): Element | null =>
  abschnitt()?.querySelector('[data-testid="bib-import-ergebnis"]') ?? null;
const feld = (id: string): string => text(abschnitt()?.querySelector(`[data-testid="${id}"]`));

describe("R-0142 · das Importergebnis auf der Wissensseite", () => {
  for (const sprache of SPRACHEN) {
    it(`I1 [${sprache}]: Fassung, Lauf, Ausgang und ehrlicher Lückenhinweis aus dem Katalog`, async () => {
      globalThis.__r0142Abrufe = [];
      globalThis.__r0142Ergebnis = ergebnis();
      await flaeche([quelle(SEITE_ANKER)], sprache);
      try {
        const tt = i18n.getFixedT(sprache);
        expect(block(), "der Block fehlt").not.toBeNull();
        expect(text(block())).toContain(tt("w2.result.heading"));
        const [vorn = ""] = tt("ko.importResult.revision", { version: 3, zeit: "§" }).split("§");
        expect(feld("bib-import-revision").startsWith(vorn.trim())).toBe(true);
        expect(feld("bib-import-lauf")).toBe(
          tt("ko.importResult.run", { status: tt("w2.run.status.COMPLETED") }),
        );
        expect(feld("bib-import-ausgang")).toBe(tt("ko.importResult.outcome.CREATED"));
        expect(feld("bib-import-luecken")).toBe(tt("ko.importResult.gapsNotAvailable"));
        expect(text(block())).toContain(tt("ko.importResult.contentNotCaptured"));
        // Jede Sprache hat ihren eigenen Text (kein Rückfall auf Deutsch).
        if (sprache !== "de") {
          expect(feld("bib-import-ausgang")).not.toBe(
            i18n.getFixedT("de")("ko.importResult.outcome.CREATED"),
          );
        }
        expect(globalThis.__r0142Abrufe).toEqual(["ko-1"]);
      } finally {
        abbauen();
      }
    });
  }

  it("I2: BOUND und eine gelieferte Lückenbeziehung werden genannt, wie sie kommen", async () => {
    globalThis.__r0142Abrufe = [];
    globalThis.__r0142Ergebnis = ergebnis({
      item: { ordinal: 2, candidateItemId: "k-2", knowledgeObjectId: "ko-1", itemOutcome: "BOUND" },
      knowledgeGapRelationState: "AVAILABLE",
      knowledgeGapIds: ["g-1", "g-2"],
    });
    await flaeche([quelle(SEITE_ANKER)]);
    try {
      const tt = i18n.getFixedT("de");
      expect(feld("bib-import-ausgang")).toBe(tt("ko.importResult.outcome.BOUND"));
      expect(feld("bib-import-luecken")).toBe(tt("ko.importResult.gaps", { anzahl: 2 }));
    } finally {
      abbauen();
    }
  });

  it("I3: ohne festgehaltene Fassung nennt der Block das — kein Lauf, kein Ausgang erfunden", async () => {
    globalThis.__r0142Abrufe = [];
    globalThis.__r0142Ergebnis = ergebnis({ source: null, run: null, item: null });
    await flaeche([quelle(SEITE_ANKER)]);
    try {
      const tt = i18n.getFixedT("de");
      expect(feld("bib-import-revision")).toBe(tt("ko.importResult.noRevision"));
      expect(abschnitt()?.querySelector('[data-testid="bib-import-lauf"]')).toBeNull();
      expect(abschnitt()?.querySelector('[data-testid="bib-import-ausgang"]')).toBeNull();
    } finally {
      abbauen();
    }
  });

  it("I4: ohne Import-Anker keine Anfrage; ein 404 zeigt nichts", async () => {
    globalThis.__r0142Abrufe = [];
    globalThis.__r0142Ergebnis = ergebnis();
    await flaeche([quelle()]);
    try {
      expect(globalThis.__r0142Abrufe).toEqual([]);
      expect(block()).toBeNull();
    } finally {
      abbauen();
    }
    globalThis.__r0142Ergebnis = null;
    await flaeche([quelle(SEITE_ANKER)]);
    try {
      expect(globalThis.__r0142Abrufe).toEqual(["ko-1"]);
      expect(block()).toBeNull();
    } finally {
      abbauen();
    }
  });
});
