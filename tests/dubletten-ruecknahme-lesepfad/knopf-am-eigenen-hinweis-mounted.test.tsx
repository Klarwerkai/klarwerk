// @vitest-environment jsdom
// ================================================================================================
// R-1615 — AM EIGENEN EINTRAG STEHT NEBEN DEM DUBLETTENHINWEIS DER KNOPF „EIGENE SEITE ZURÜCKZIEHEN".
// ================================================================================================
//
// Gemessen an der echten Route `/wissen/:id` (`KnowledgeDetail` → `BibliothekFlaeche` →
// `BibliothekLesen`) mit der echten Modalgrenze der Shell; ersetzt ist nur die HTTP-Grenze
// (Gerüst wie tests/wissensobjekt-loeschen/rueckfrage-im-blick-mounted.test.tsx).
//
// Was hier zugesagt wird:
//   · der Knopf steht IN der Kollisionszeile, nur am eigenen Eintrag und nur bei einer Dublette;
//   · er öffnet dieselbe Rückfrage wie der Menüpunkt, mit dem Satz über Befund und Gegenseite;
//   · bestätigt wird derselbe EINE Aufruf `endpoints.ko.remove` für GENAU dieses Objekt — kein
//     zweiter Löschweg, kein Aufruf, der die Gegenseite nennt;
//   · der Menüpunkt „Wissensobjekt löschen" spricht danach weiter vom Löschen.
// Dass der Server den Befund dabei als `withdrawn_own` schliesst und die Gegenseite nicht anfasst,
// misst rueckzug-und-wiederherstellen.test.ts an der echten App.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  autor: "u1",
  signal: [] as unknown[],
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: "experte" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = vi.fn(async () => []);
  return {
    endpoints: {
      ko: {
        get: vi.fn(async () => globalThis.__rueckzugKo),
        list: vi.fn(async () => [globalThis.__rueckzugKo]),
        versions: leer,
        evidence: leer,
        neighbors: vi.fn(async () => ({
          center: "ko-1",
          neighbors: [],
          excludedTags: [],
          limit: 8,
        })),
        act: vi.fn(async () => globalThis.__rueckzugKo),
        remove: vi.fn(async () => undefined),
      },
      conflicts: { list: leer },
      duplicateSignal: { list: vi.fn(async () => box.signal) },
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
import type { EigenerBefund, KnowledgeObject } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ModalBoundaryProvider } from "../../apps/web/src/app/ModalBoundaryContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";

declare global {
  // eslint-disable-next-line no-var
  var __rueckzugKo: KnowledgeObject;
}

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};

function befund(teil: Partial<EigenerBefund>): EigenerBefund {
  return {
    koId: "ko-1",
    dublette: false,
    konflikt: false,
    deckung: { lage: "kein_lauf", geprueft: null, bestand: null },
    ...teil,
  };
}

function ko(): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Pumpe entlüften",
    statement: "Die Pumpe alle 200 Stunden entlüften.",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Wartung",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    author: box.autor,
    originalAuthor: box.autor,
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

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function Huelle({ children }: { children: React.ReactNode }): JSX.Element {
  const mainRef = useRef<HTMLElement | null>(null);
  return createElement(ModalBoundaryProvider, {
    hostRef: mainRef,
    children: [
      createElement("main", { key: "main", ref: mainRef }, children),
      createElement(ToastViewport, { key: "toasts" }),
    ],
  });
}

async function mount(): Promise<void> {
  globalThis.__rueckzugKo = ko();
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
                    Huelle,
                    null,
                    createElement(
                      Routes,
                      null,
                      createElement(Route, {
                        path: "/wissen/:id",
                        element: createElement(KnowledgeDetail),
                      }),
                      createElement(Route, {
                        path: "/bibliothek",
                        element: createElement("div", { "data-testid": "seite-bibliothek" }),
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

function finde(testId: string): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
}

async function klick(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
  await act(flush);
}

function knopfMitText(text: string): HTMLButtonElement | undefined {
  return [...document.body.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
}

function enthaelt(text: string): boolean {
  return (document.body.textContent ?? "").includes(text);
}

beforeEach(async () => {
  box.autor = "u1";
  box.signal = [];
  vi.mocked(endpoints.ko.remove).mockClear();
  await i18n.changeLanguage("de");
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } } });
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  qc.clear();
});

describe("R-1615: der Knopf am eigenen Dublettenhinweis", () => {
  it("K1 · eigene Dublette: der Knopf steht IN der Kollisionszeile, neben dem Hinweis", async () => {
    box.signal = [befund({ dublette: true })];
    await mount();
    const zeile = finde("job3025-kollision");
    expect(zeile?.textContent).toContain(i18n.t("kollision.detail.dublette"));
    const knopf = finde("bib-kollision-rueckzug");
    expect(knopf, "kein Rückzugsknopf am eigenen Dublettenhinweis").not.toBeNull();
    expect(zeile?.contains(knopf as Node)).toBe(true);
    expect(knopf?.textContent).toBe(i18n.t("rueckzug.knopf"));
  });

  it("K2 · auch neben einem Konflikt, solange eine Dublette da ist", async () => {
    box.signal = [befund({ dublette: true, konflikt: true })];
    await mount();
    expect(finde("bib-kollision-rueckzug")).not.toBeNull();
  });

  it("K3 · nur ein Konflikt, keine Dublette: kein Rückzugsknopf", async () => {
    box.signal = [befund({ konflikt: true })];
    await mount();
    expect(finde("job3025-kollision")).not.toBeNull();
    expect(finde("bib-kollision-rueckzug")).toBeNull();
  });

  it("K4 · fremder Eintrag: kein Rückzugsknopf (und keine Kollisionszeile)", async () => {
    box.autor = "u2";
    box.signal = [befund({ dublette: true })];
    await mount();
    expect(finde("bib-kollision-rueckzug")).toBeNull();
  });

  it("K5 · bestätigen zieht GENAU dieses Objekt zurück, über den einen Löschaufruf", async () => {
    box.signal = [befund({ dublette: true })];
    await mount();
    await klick(finde("bib-kollision-rueckzug") as HTMLElement);

    expect(enthaelt(i18n.t("rueckzug.frage")), "die Rückfrage nennt Befund und Gegenseite").toBe(
      true,
    );
    expect(enthaelt(i18n.t("ko.deleteQ"))).toBe(false);
    const ja = knopfMitText(i18n.t("rueckzug.ja"));
    expect(ja, "der Knopf „Ja, zurückziehen“ fehlt").toBeTruthy();
    await klick(ja as HTMLButtonElement);

    expect(vi.mocked(endpoints.ko.remove).mock.calls).toEqual([["ko-1"]]);
    expect(enthaelt(i18n.t("rueckzug.erledigt"))).toBe(true);
  });

  it("K6 · abbrechen lässt alles, wie es war — und der Menüpunkt spricht danach vom Löschen", async () => {
    box.signal = [befund({ dublette: true })];
    await mount();
    await klick(finde("bib-kollision-rueckzug") as HTMLElement);
    await klick(knopfMitText(i18n.t("ko.deleteKeep")) as HTMLButtonElement);
    expect(enthaelt(i18n.t("rueckzug.frage"))).toBe(false);
    expect(vi.mocked(endpoints.ko.remove)).not.toHaveBeenCalled();

    await klick(finde("bib-eintrag-menue") as HTMLElement);
    await klick(finde("bib-menue-loeschen") as HTMLElement);
    expect(enthaelt(i18n.t("ko.deleteQ"))).toBe(true);
    expect(enthaelt(i18n.t("rueckzug.frage"))).toBe(false);
    expect(knopfMitText(i18n.t("ko.deleteYes"))).toBeTruthy();
  });
});
