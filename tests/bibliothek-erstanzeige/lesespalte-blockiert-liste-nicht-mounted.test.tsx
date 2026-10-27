// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { BibliothekFlaeche } from "../../apps/web/src/components/bibliothek/BibliothekFlaeche";

const lesen = vi.hoisted(() => ({
  starts: 0,
  bereit: Promise.resolve(),
  freigeben: undefined as (() => void) | undefined,
}));
const netz = vi.hoisted(() => ({
  suche: 0,
  antworten: undefined as ((kos: KnowledgeObject[]) => void) | undefined,
}));

// Nur der Modulport des Lesers wird aufgehalten. Liste, Suche, Auswahl und Query bleiben echt.
vi.mock("../../apps/web/src/components/bibliothek/BibliothekLesen", async () => {
  lesen.starts += 1;
  await lesen.bereit;
  const { createElement: h } = await import("../../apps/web/node_modules/react");
  return {
    BibliothekLesen: ({ koId, suchtext }: { koId: string; suchtext: string }) =>
      h(
        "article",
        { "data-testid": "lese-port", "data-ko-id": koId, "data-suche": suchtext },
        koId,
      ),
  };
});
vi.mock("../../apps/web/src/api/endpoints", async (importOriginal) => {
  const echt = await importOriginal<typeof import("../../apps/web/src/api/endpoints")>();
  return {
    ...echt,
    endpoints: {
      ...echt.endpoints,
      library: {
        ...echt.endpoints.library,
        search: () => {
          netz.suche += 1;
          return new Promise<KnowledgeObject[]>((resolve) => {
            netz.antworten = resolve;
          });
        },
      },
    },
  };
});
vi.mock("../../apps/web/src/api/hooks", async (importOriginal) => {
  const echt = await importOriginal<typeof import("../../apps/web/src/api/hooks")>();
  const leer: never[] = [];
  const directory = [{ id: "autor", name: "Eva" }];
  const ok = (data: unknown) => ({
    data,
    isLoading: false,
    isError: false,
    isFetching: false,
    isStale: false,
    dataUpdatedAt: 1,
    error: null,
    refetch: async () => ({ data }),
  });
  return {
    ...echt,
    useKos: () => ok(leer),
    useConflicts: () => ok(leer),
    useDirectory: () => ok(directory),
    useReasonerStatus: () => ok({ active: false, mode: "off" }),
  };
});
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "autor", role: "experte" } }),
}));
vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));
vi.mock("../../apps/web/src/app/ToastContext", () => ({
  useToast: () => ({ push: () => {} }),
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function ko(id: string, title: string): KnowledgeObject {
  return {
    id,
    title,
    statement: "Freigegebene Aussage",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage",
    tags: [],
    confidence: 80,
    trust: 80,
    status: "validiert",
    version: 1,
    originalAuthor: "autor",
    author: "autor",
    neededValidations: 2,
    assignments: [],
    asset: null,
    confidentiality: "intern",
    createdAt: "2026-07-20T00:00:00.000Z",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
  } as KnowledgeObject;
}

let root: ReturnType<typeof createRoot> | undefined;
let host: HTMLDivElement | undefined;
let qc: QueryClient | undefined;
afterEach(async () => {
  lesen.freigeben?.();
  await act(async () => root?.unmount());
  qc?.clear();
  host?.remove();
  localStorage.clear();
  sessionStorage.clear();
});

it("Liste startet vor der Leserladung und öffnet danach die aktuelle Wahl", async () => {
  lesen.bereit = new Promise<void>((resolve) => {
    lesen.freigeben = resolve;
  });
  expect(lesen.starts).toBe(0);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  await act(async () => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client: qc as QueryClient },
        createElement(MemoryRouter, null, createElement(BibliothekFlaeche)),
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(netz.suche).toBe(1);
  expect(lesen.starts).toBe(0);

  await act(async () => {
    netz.antworten?.([ko("ko-1", "Ventil prüfen"), ko("ko-2", "Pumpe entlüften")]);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await vi.waitFor(() => expect(lesen.starts).toBe(1));
  expect(host.querySelectorAll('[data-testid="bib-zeile"]')).toHaveLength(2);
  expect(host.querySelector('[data-testid="lese-port"]')).toBeNull();
  const zeile = host.querySelector<HTMLElement>('[data-testid="bib-zeile"][data-bib-id="ko-2"]');
  expect(zeile).not.toBeNull();
  await act(async () => {
    zeile?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  expect(host.querySelectorAll('[data-testid="bib-zeile"]')).toHaveLength(2);
  expect(netz.suche).toBe(1);

  await act(async () => {
    lesen.freigeben?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await vi.waitFor(() => {
    const id = host?.querySelector('[data-testid="lese-port"]')?.getAttribute("data-ko-id");
    expect(id).toBe("ko-2");
  });
  expect(host.querySelector('[data-testid="lese-port"]')?.getAttribute("data-suche")).toBe("");
  expect(host.querySelectorAll('[data-testid="bib-zeile"]')).toHaveLength(2);
  expect(netz.suche).toBe(1);
});
