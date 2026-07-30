// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega68 — DIE FLÄCHE: MITTE, KANTEN MIT WARUM, KLICK = NEUE MITTE, RÜCKWEG.
// ================================================================================================
//
// Am ECHTEN Bauteil (KnowledgeNeighborhood) belegt:
//  · an jeder Kante steht das geteilte Schlagwort; mehrere Schlagwörter werden als „+n" an der
//    Kante erkennbar und stehen VOLLSTÄNDIG in der Liste darunter,
//  · ein Klick macht den Nachbarn zur neuen Mitte — OHNE Navigation (die Auskunft wird für die
//    neue Mitte geholt), und der Rückweg führt zur vorigen Mitte zurück,
//  · der Schlagwort-Filter ist SICHTBAR begründet (excludedTags erscheinen mit Erklärung),
//  · der Deckel wird ehrlich beziffert (»stärkste X von Y«).
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: { neighbors: vi.fn() },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import "../../apps/web/src/i18n";
import { endpoints } from "../../apps/web/src/api/endpoints";
import type { Neighborhood } from "../../apps/web/src/api/types";
import {
  KnowledgeNeighborhood,
  edgeLabel,
} from "../../apps/web/src/components/KnowledgeNeighborhood";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const neighborsMock = endpoints.ko.neighbors as unknown as ReturnType<typeof vi.fn>;

// Kleiner Demobestands-Ausschnitt: Filter in der Mitte, zwei echte Nachbarn; `pilot-demo` ist
// serverseitig als ubiquitär ausgeschlossen und taucht deshalb in `excludedTags` auf.
const NETZ: Record<string, Neighborhood> = {
  filter: {
    center: { id: "filter", title: "Filter F3 prüfen", status: "validiert" },
    neighbors: [
      { id: "pumpe", title: "Pumpe P2 schmieren", status: "offen", via: ["prüfung", "wartung"] },
      { id: "band", title: "Förderband Sichtprüfung", status: "validiert", via: ["wartung"] },
    ],
    total: 2,
    truncated: false,
    excludedTags: ["pilot-demo"],
  },
  pumpe: {
    center: { id: "pumpe", title: "Pumpe P2 schmieren", status: "offen" },
    neighbors: [{ id: "filter", title: "Filter F3 prüfen", status: "validiert", via: ["wartung"] }],
    total: 15,
    truncated: true,
    excludedTags: [],
  },
};

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(
  koId = "filter",
  koTitle = "Filter F3 prüfen",
): Promise<{ container: HTMLElement; unmount: () => void }> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        MemoryRouter,
        null,
        createElement(
          QueryClientProvider,
          { client },
          createElement(KnowledgeNeighborhood, { koId, koTitle }),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("mega68 · edgeLabel — das Warum an der Kante", () => {
  it("ein Schlagwort steht wörtlich, mehrere werden als +n erkennbar", () => {
    expect(edgeLabel(["wartung"])).toBe("wartung");
    expect(edgeLabel(["prüfung", "wartung"])).toBe("prüfung +1");
    expect(edgeLabel([])).toBe("");
  });
});

describe("mega68 · die Fläche", () => {
  it("zeichnet Mitte, Nachbarn und an jeder Kante das geteilte Schlagwort", async () => {
    neighborsMock.mockImplementation((id: string) => Promise.resolve(NETZ[id]));
    const { container, unmount } = await mount();
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    const svgText = svg?.textContent ?? "";
    // Beide Nachbarn und das Warum an den Kanten (erste + „+1" bei zweien).
    expect(svgText).toContain("Pumpe P2 schmieren");
    expect(svgText).toContain("prüfung +1");
    expect(svgText).toContain("wartung");
    // Die Liste darunter nennt ALLE geteilten Schlagwörter.
    expect(container.textContent).toContain("prüfung · wartung");
    // Der Filter ist sichtbar begründet.
    const excluded = container.querySelector("[data-testid=nb-excluded]");
    expect(excluded?.textContent).toContain("pilot-demo");
    // Der Rückweg existiert an der Wurzel NICHT (es gibt nichts zurückzugehen).
    expect(container.querySelector("[data-testid=nb-back]")).toBeNull();
    unmount();
  });

  it("Klick auf den Nachbarn: neue Mitte ohne Navigation, Rückweg führt zurück", async () => {
    neighborsMock.mockImplementation((id: string) => Promise.resolve(NETZ[id]));
    const { container, unmount } = await mount();
    // Klick über den Listen-Zugang (Tastatur-/Mobil-Weg derselben Aktion).
    const button = [...container.querySelectorAll("button")].find((b) =>
      (b.getAttribute("aria-label") ?? "").includes("Pumpe P2 schmieren"),
    );
    expect(button).toBeDefined();
    await act(async () => {
      button?.click();
      await flush();
    });
    await act(flush);
    // Die Auskunft wurde für die NEUE Mitte geholt; die Fläche zeigt sie.
    expect(neighborsMock).toHaveBeenCalledWith("pumpe");
    expect(container.textContent).toContain("15");
    // Deckel ehrlich beziffert (»1 von 15« im Kürzungs-Text).
    const backButton = container.querySelector("[data-testid=nb-back]");
    expect(backButton?.textContent).toContain("Filter F3 prüfen");
    // Der Beitrag der neuen Mitte ist als normaler Link erreichbar.
    const open = container.querySelector("[data-testid=nb-open-center]");
    expect(open?.getAttribute("href")).toBe("/wissen/pumpe");
    // Rückweg: die alte Mitte kehrt zurück, der Rückweg verschwindet.
    await act(async () => {
      (backButton as HTMLButtonElement).click();
      await flush();
    });
    await act(flush);
    expect(container.querySelector("[data-testid=nb-back]")).toBeNull();
    expect(container.textContent).toContain("Förderband Sichtprüfung");
    unmount();
  });

  it("ohne Nachbarn: ehrlicher Leer-Text statt leerer Zeichnung", async () => {
    neighborsMock.mockResolvedValue({
      center: { id: "solo", title: "Einzelstück", status: "offen" },
      neighbors: [],
      total: 0,
      truncated: false,
      excludedTags: ["pilot-demo"],
    } satisfies Neighborhood);
    const { container, unmount } = await mount("solo", "Einzelstück");
    expect(container.querySelector("svg")).toBeNull();
    expect(container.textContent).toContain("Keine Nachbarn");
    // Auch am leeren Netz bleibt der Filter sichtbar begründet.
    expect(container.querySelector("[data-testid=nb-excluded]")?.textContent).toContain(
      "pilot-demo",
    );
    unmount();
  });
});
