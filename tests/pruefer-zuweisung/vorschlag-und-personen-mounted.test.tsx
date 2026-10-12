// @vitest-environment jsdom
// ================================================================================================
// Prüfer-Zuweisung an der Oberfläche, gemountet:
//   · R-0265 — der Prüfer-Vorschlag beim Einreichen nennt Personen mit Grund; ein Klick wählt aus.
//   · R-0756 — offene und erledigte Prüfaufträge je Person (Auswertung; der Adminbereich nutzt
//              dieselbe Ableitung `auftraegeJePerson`).
// ================================================================================================
import { afterEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  vorschlag: vi.fn(async (_q: unknown) => [
    { userId: "u-bert", punkte: 5, gruende: ["autorschaft", "netznaehe"] },
    { userId: "u-fremd", punkte: 4, gruende: ["pruefungen"] },
    { userId: "u-cora", punkte: 2, gruende: ["pruefungen"] },
  ]),
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: { validation: { reviewerSuggestions: d.vorschlag } },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { AuftraegeJePerson } from "../../apps/web/src/components/AuftraegeJePerson";
import {
  REVIEWER_SUGGESTION_DEBOUNCE_MS,
  ReviewerSuggestions,
} from "../../apps/web/src/components/ReviewerSuggestions";
import i18n from "../../apps/web/src/i18n";
import { auftraegeJePerson } from "../../apps/web/src/lib/auftraegeJePerson";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | undefined;
let root: ReturnType<typeof createRoot> | undefined;

const warte = async (ms: number): Promise<void> => {
  await new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(element: ReturnType<typeof createElement>): Promise<HTMLDivElement> {
  const ziel = document.createElement("div");
  document.body.appendChild(ziel);
  container = ziel;
  root = createRoot(ziel);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root?.render(createElement(QueryClientProvider, { client: qc }, element));
    await warte(0);
  });
  return ziel;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = undefined;
  root = undefined;
  d.vorschlag.mockClear();
});

describe("R-0265 · ReviewerSuggestions", () => {
  const choices = [
    { id: "u-bert", name: "Bert" },
    { id: "u-cora", name: "Cora" },
  ];

  it("M1 · nennt nur auswählbare Personen, mit Grund; ein Klick wählt aus", async () => {
    await i18n.changeLanguage("de");
    const onToggle = vi.fn();
    const ziel = await mount(
      createElement(ReviewerSuggestions, {
        category: "Hydraulik",
        tags: ["Ventil"],
        choices,
        selected: [],
        limitReached: false,
        onToggle,
      }),
    );
    await act(async () => {
      await warte(REVIEWER_SUGGESTION_DEBOUNCE_MS + 50);
    });

    expect(d.vorschlag).toHaveBeenCalledWith({ category: "Hydraulik", tags: ["Ventil"] });
    const knoepfe = [...ziel.querySelectorAll("button")].map((b) => b.textContent);
    // `u-fremd` steht nicht in der Auswahl (z. B. der Autor selbst) und erscheint nicht.
    expect(knoepfe).toEqual(["Bert", "Cora"]);
    expect(ziel.textContent).toContain(
      `${i18n.t("prueferzuweisung.grund.autorschaft")} · ${i18n.t("prueferzuweisung.grund.netznaehe")}`,
    );

    await act(async () => {
      ziel.querySelector("button")?.click();
    });
    expect(onToggle).toHaveBeenCalledWith("u-bert");
  });

  it("M2 · ohne Kategorie und Schlagwort wird nicht gefragt und nichts gezeigt", async () => {
    const ziel = await mount(
      createElement(ReviewerSuggestions, {
        category: "  ",
        tags: [],
        choices,
        selected: [],
        limitReached: false,
        onToggle: () => {},
      }),
    );
    await act(async () => {
      await warte(REVIEWER_SUGGESTION_DEBOUNCE_MS + 50);
    });
    expect(d.vorschlag).not.toHaveBeenCalled();
    expect(ziel.querySelector('[data-testid="reviewer-suggestions"]')).toBeNull();
  });

  it("M3 · am Limit ist ein nicht gewählter Vorschlag gesperrt, ein gewählter nicht", async () => {
    const ziel = await mount(
      createElement(ReviewerSuggestions, {
        category: "Hydraulik",
        tags: [],
        choices,
        selected: ["u-cora"],
        limitReached: true,
        onToggle: () => {},
      }),
    );
    await act(async () => {
      await warte(REVIEWER_SUGGESTION_DEBOUNCE_MS + 50);
    });
    const [bert, cora] = [...ziel.querySelectorAll("button")];
    expect(bert?.disabled).toBe(true);
    expect(cora?.disabled).toBe(false);
    expect(cora?.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("R-0756 · Prüfaufträge je Person", () => {
  it("P1 · offene zuerst, Name aus der Personenliste, unbekannte Person benannt", async () => {
    const zeilen = auftraegeJePerson(
      [
        { userId: "u-a", open: 0, done: 4 },
        { userId: "u-b", open: 2, done: 1 },
        { userId: "u-weg", open: 1, done: 0 },
      ],
      [
        { id: "u-a", name: "Anna" },
        { id: "u-b", name: "Bert" },
      ],
    );
    expect(zeilen).toEqual([
      { userId: "u-b", name: "Bert", open: 2, done: 1 },
      { userId: "u-weg", name: null, open: 1, done: 0 },
      { userId: "u-a", name: "Anna", open: 0, done: 4 },
    ]);
  });

  it("P2 · die Auswertung zeigt je Person offen und erledigt", async () => {
    await i18n.changeLanguage("de");
    const ziel = await mount(
      createElement(AuftraegeJePerson, {
        summaries: [
          { userId: "u-a", open: 0, done: 4 },
          { userId: "u-b", open: 2, done: 1 },
        ],
        personen: [
          { id: "u-a", name: "Anna" },
          { id: "u-b", name: "Bert" },
        ],
      }),
    );
    const zeilen = [...ziel.querySelectorAll("tbody tr")].map((tr) =>
      [...tr.querySelectorAll("td")].map((td) => td.textContent),
    );
    expect(zeilen).toEqual([
      ["Bert", "2", "1"],
      ["Anna", "0", "4"],
    ]);
  });

  it("P3 · ohne Zuweisungen sagt die Karte das ausdrücklich", async () => {
    await i18n.changeLanguage("de");
    const ziel = await mount(createElement(AuftraegeJePerson, { summaries: [], personen: [] }));
    expect(ziel.textContent).toContain(i18n.t("prueferzuweisung.person.leer"));
    expect(ziel.querySelector("table")).toBeNull();
  });
});
