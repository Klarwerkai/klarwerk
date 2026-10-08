// @vitest-environment jsdom
// ================================================================================================
// aufnahme:20260922:gesamt-hilfreich-signal — R-0235 / R-0749: „HAT GEHOLFEN" AM WISSENSOBJEKT.
// ================================================================================================
//
// „Wer eine Antwort oder ein Wissensobjekt erfolgreich angewendet hat, kann das mit einem Klick
// melden." Bis hierher gab es den Klick NUR an einer Antwort (Ask.tsx, QuellenListe.tsx). Wer ein
// Objekt in der Bibliothek gelesen und angewendet hatte, konnte es nicht melden.
//
// Gemessen an der echten Fläche `/bibliothek` (`BibliothekFlaeche` → `BibliothekLesen`): der
// Menüpunkt steht am Eintrag, ruft genau `endpoints.ko.helpful(<id>)` und KEINE Bewertung
// (`act` mit `rate`) — die Meldung ist ausdrücklich keine Prüfstimme. Nach dem Klick sagt der
// Punkt „Danke!" und ist gesperrt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", async () => {
  const { ApiError } = await import("../../apps/web/src/api/client");
  const leer = vi.fn(async () => []);
  return {
    endpoints: {
      ko: {
        get: vi.fn(async (id: string) => {
          const treffer = globalThis.__hilfreichBestand().find((k) => k.id === id);
          if (!treffer) {
            throw new ApiError(404, "not_found", "Eintrag nicht gefunden");
          }
          return treffer;
        }),
        list: vi.fn(async () => globalThis.__hilfreichBestand()),
        versions: leer,
        evidence: leer,
        neighbors: vi.fn(async () => ({ center: "", neighbors: [], excludedTags: [], limit: 8 })),
        act: vi.fn(async () => globalThis.__hilfreichBestand()[0]),
        helpful: vi.fn(async () => undefined),
        remove: vi.fn(async () => undefined),
      },
      library: {
        search: vi.fn(async () => globalThis.__hilfreichBestand()),
        images: vi.fn(async () => ({ items: [] })),
        importCandidates: { list: leer },
      },
      conflicts: { list: leer },
      duplicateSignal: { list: leer },
      audit: { list: leer },
      directory: { list: vi.fn(async () => [{ id: "u1", name: "Eva" }]) },
      lifecycle: { pending: leer, linked: leer },
      external: { policy: vi.fn(async () => ({ stage: "blocked", enabled: false })) },
      uploadLimits: {
        get: vi.fn(async () => ({ maxAttachments: 8, maxAttachmentBytes: 20000000 })),
      },
      reasoner: {
        status: vi.fn(async () => ({ active: false, mode: "off" })),
        config: vi.fn(async () => null),
        assist: vi.fn(async () => ({ text: "" })),
        assistPresets: leer,
        extract: vi.fn(async () => ({ points: [], note: null })),
        describeImage: vi.fn(async () => ({})),
      },
      aiCheck: { coverageSummary: vi.fn(async () => ({ total: 0 })) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement, useRef } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ModalBoundaryProvider } from "../../apps/web/src/app/ModalBoundaryContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { BibliothekFlaeche } from "../../apps/web/src/components/bibliothek/BibliothekFlaeche";
import i18n from "../../apps/web/src/i18n";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";

declare global {
  // eslint-disable-next-line no-var
  var __hilfreichBestand: () => KnowledgeObject[];
}

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};

function ko(id: string, titel: string): KnowledgeObject {
  return {
    id,
    title: titel,
    statement: `Kernaussage von ${titel}.`,
    bodyHtml: `<p>Fliesstext von ${titel}.</p>`,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Instandhaltung",
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
    history: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    comments: [],
    sources: [],
    attachments: [],
  } as KnowledgeObject;
}

globalThis.__hilfreichBestand = () =>
  [ko("ko-1", "Pumpe P3 vor dem Öffnen entlüften")] as unknown as KnowledgeObject[];

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function Huelle({ children }: { children: React.ReactNode }): JSX.Element {
  const mainRef = useRef<HTMLElement | null>(null);
  return createElement(ModalBoundaryProvider, {
    hostRef: mainRef,
    children: [
      createElement("main", { key: "main", ref: mainRef, className: "overflow-y-auto" }, children),
      createElement(ToastViewport, { key: "toasts" }),
    ],
  });
}

async function mount(): Promise<void> {
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
                  { initialEntries: ["/bibliothek"] },
                  createElement(
                    Huelle,
                    null,
                    createElement(
                      Routes,
                      null,
                      createElement(Route, {
                        path: "/bibliothek",
                        element: createElement(BibliothekFlaeche),
                      }),
                    ),
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
  await act(flush);
}

function suche(testId: string): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
}

function knopf(testId: string): HTMLElement {
  const treffer = suche(testId);
  if (!treffer) {
    throw new Error(`„${testId}" ist auf der Fläche nicht da`);
  }
  return treffer;
}

async function klick(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
  await act(flush);
}

beforeEach(async () => {
  vi.mocked(endpoints.ko.helpful).mockClear();
  vi.mocked(endpoints.ko.act).mockClear();
  await i18n.changeLanguage("de");
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  await mount();
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  qc.clear();
});

describe("R-0235 / R-0749 · „Hat geholfen“ am Wissensobjekt in der Bibliothek", () => {
  it("ein Klick meldet genau dieses Objekt — ohne Bewertung, danach „Danke!“ und gesperrt", async () => {
    await klick(knopf("bib-eintrag-menue"));
    const punkt = knopf("bib-menue-hilfreich");
    expect(punkt.textContent?.trim()).toBe(i18n.t("ask.helpful"));
    await klick(punkt);

    expect(vi.mocked(endpoints.ko.helpful).mock.calls).toEqual([["ko-1"]]);
    // Keine Prüfstimme: kein `rate`, überhaupt kein Aufruf des Bewertungswegs.
    expect(vi.mocked(endpoints.ko.act)).not.toHaveBeenCalled();

    await klick(knopf("bib-eintrag-menue"));
    const danach = knopf("bib-menue-hilfreich");
    expect(danach.textContent?.trim()).toBe(i18n.t("ask.thanked"));
    expect(
      (danach as HTMLButtonElement).disabled || danach.getAttribute("aria-disabled") === "true",
    ).toBe(true);
  });
});
