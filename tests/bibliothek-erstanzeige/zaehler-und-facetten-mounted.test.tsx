// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => {
  const channel = {
    resolve: (_value: { length: number }) => {},
    reject: (_error: Error) => {},
  };
  return {
    channel,
    board: vi.fn(async () => []),
    count: vi.fn(
      () =>
        new Promise<{ length: number }>((resolve, reject) => {
          channel.resolve = resolve;
          channel.reject = reject;
        }),
    ),
  };
});

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    validation: { board: ports.board, boardCount: ports.count },
    conflicts: { list: async () => [] },
    duplicates: { list: async () => [] },
    gaps: { summary: async () => ({ open: 0 }) },
    lifecycle: { pending: async () => [] },
    me: {
      returnedSummary: async () => ({ open: 0 }),
      authorTransfersSummary: async () => ({ open: 0 }),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { useNavBadges } from "../../apps/web/src/app/useNavBadges";
import * as facetFilter from "../../apps/web/src/lib/facetFilter";
import type { FacetRailUiState } from "../../apps/web/src/lib/facetRail";
import type { FacetSelection, FacetValues } from "../../apps/web/src/lib/facets";
import { useFacetRailGroups } from "../../apps/web/src/lib/useFacetRailGroups";
import { removeDeletedBoardKoFromCaches } from "../../apps/web/src/lib/validationDelete";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const roots: { root: ReturnType<typeof createRoot>; container: HTMLDivElement }[] = [];
const clients: QueryClient[] = [];
const flush = async () => {
  for (let i = 0; i < 10; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};
function platz() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push({ root, container });
  return root;
}
afterEach(async () => {
  await act(async () => {
    for (const { root, container } of roots.splice(0)) {
      root.unmount();
      container.remove();
    }
  });
  for (const client of clients.splice(0)) {
    client.clear();
  }
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

it("Hüllenzähler erhält Fehler, Frische und Lösch-Nachladen", async () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  clients.push(qc);
  let badges: ReturnType<typeof useNavBadges> = {};
  function Sonde() {
    badges = useNavBadges();
    return null;
  }
  await act(async () => {
    platz().render(createElement(QueryClientProvider, { client: qc }, createElement(Sonde)));
    await flush();
  });
  expect(badges.validation?.state).toBe("loading");
  expect(badges.tasks?.state).toBe("loading");
  await act(async () => {
    ports.channel.reject(new Error("Zähler nicht verfügbar"));
    await flush();
  });
  expect(badges.validation?.state).toBe("error");
  await act(async () => {
    badges.validation?.refetch();
    await flush();
    ports.channel.resolve({ length: 3 });
    await flush();
  });
  expect(badges.validation).toMatchObject({ count: 3, state: "loaded", stale: false });
  expect(badges.tasks?.count).toBe(3);
  await act(async () => {
    badges.validation?.refetch();
    await flush();
    ports.channel.reject(new Error("Neuer Abruf fehlgeschlagen"));
    await flush();
  });
  expect(badges.validation).toMatchObject({ count: 3, state: "loaded", stale: true });
  await act(async () => {
    badges.validation?.refetch();
    await flush();
    ports.channel.resolve({ length: 0 });
    await flush();
  });
  expect(badges.validation).toMatchObject({ count: 0, state: "loaded", stale: false });

  async function neuZaehlen(length: number) {
    await act(async () => {
      const fertig = qc.invalidateQueries({ queryKey: ["validation", "board"] });
      await flush();
      ports.channel.resolve({ length });
      await fertig;
      await flush();
    });
  }
  await neuZaehlen(5);
  expect(badges.validation).toMatchObject({ count: 5, state: "loaded", stale: false });
  const fullKey = ["validation", "board", undefined];
  const countKey = ["validation", "board", "count"];
  await act(async () => {
    qc.setQueryData(fullKey, [{ id: "weg" }, { id: "bleibt" }]);
    removeDeletedBoardKoFromCaches<{ id: string }>(qc, "weg");
    await flush();
  });
  expect(qc.getQueryData(fullKey)).toEqual([{ id: "bleibt" }]);
  expect(qc.getQueryData(countKey)).toEqual({ length: 5 });
  expect(qc.getQueryState(countKey)?.dataUpdatedAt).toBe(0);
  expect(badges.validation).toMatchObject({ count: 5, state: "loaded", stale: true });
  await neuZaehlen(4);
  expect(badges.validation).toMatchObject({ count: 4, state: "loaded", stale: false });
  expect(ports.count).toHaveBeenCalled();
  expect(ports.board).not.toHaveBeenCalled();
});

it("Facetten zählen gezielt neu; Labels und Menüsuche bleiben aktuell", async () => {
  const rechne = vi.spyOn(facetFilter, "buildFacetGroups");
  const configs = [
    { key: "author", labelKey: "author" },
    { key: "category", labelKey: "category" },
  ];
  let items: FacetValues[] = [
    { author: ["u1"], category: ["A"] },
    { author: ["u2"], category: ["B"] },
  ];
  let selection: FacetSelection = {};
  let ui: FacetRailUiState = { query: { author: "Anna" }, showAll: {} };
  let namen: Record<string, string> = { u1: "Anna", u2: "Bert" };
  let groups: ReturnType<typeof useFacetRailGroups> = [];
  function Sonde() {
    // Wie useAuthorName: bewusst eine neue Resolverfunktion pro Render.
    groups = useFacetRailGroups(
      items,
      configs,
      selection,
      ui,
      (_key, value) => namen[value] ?? value,
    );
    return null;
  }
  const root = platz();
  async function zeichne() {
    await act(async () => {
      root.render(createElement(Sonde));
      await flush();
    });
  }
  await zeichne();
  expect(rechne).toHaveBeenCalledTimes(1);
  expect(groups[0]?.options.map((option) => option.value)).toEqual(["u1"]);
  await zeichne();
  expect(rechne).toHaveBeenCalledTimes(1);
  namen = { u1: "Anne", u2: "Anna" };
  await zeichne();
  expect(rechne).toHaveBeenCalledTimes(1);
  expect(groups[0]?.options.map((option) => option.value)).toEqual(["u2"]);
  namen = { u1: "Jean", u2: "Bert" };
  ui = { query: { author: "Jean" }, showAll: {} };
  await zeichne();
  expect(rechne).toHaveBeenCalledTimes(1);
  expect(groups[0]?.options.map((option) => option.value)).toEqual(["u1"]);
  selection = { category: ["B"] };
  ui = { query: {}, showAll: {} };
  await zeichne();
  expect(rechne).toHaveBeenCalledTimes(2);
  expect(groups[0]?.options.find((option) => option.value === "u1")).toMatchObject({
    count: 0,
    disabled: true,
  });
  items = [...items, { author: ["u3"], category: ["B"] }];
  await zeichne();
  expect(rechne).toHaveBeenCalledTimes(3);
  expect(groups[0]?.options.find((option) => option.value === "u3")?.count).toBe(1);
});
