// @vitest-environment jsdom
// WP-COCKPIT-LINIE (Mounted): der geführte Fünf-Schritte-Fluss als EINE Linie — die Schritt-Leiste
// zeigt je Zustand korrekt erledigt/aktiv/kommend, und in JEDEM Zustand ist GENAU EIN Primär-Knopf
// sichtbar (der Nutzer muss nie suchen, wo es weitergeht). Getestet über die ECHTEN Bausteine
// (ImportStepperBar + ImportExplore → ImportSelect → ImportGroups) mit gemocktem endpoints-Modul.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    admin: {
      import: {
        explore: vi.fn(),
        select: vi.fn(),
        group: vi.fn(),
        apply: vi.fn(),
      },
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { ImportExplore } from "../../apps/web/src/components/ImportExplore";
import {
  ImportCockpitProvider,
  ImportStepperBar,
} from "../../apps/web/src/components/ImportStepper";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const exploreMock = endpoints.admin.import.explore as unknown as ReturnType<typeof vi.fn>;
const selectMock = endpoints.admin.import.select as unknown as ReturnType<typeof vi.fn>;
const groupMock = endpoints.admin.import.group as unknown as ReturnType<typeof vi.fn>;
const applyMock = endpoints.admin.import.apply as unknown as ReturnType<typeof vi.fn>;

const EXPLORE_RESPONSE = {
  summary: {
    totalCount: 3,
    distinctSources: 1,
    authors: [{ name: "Anna", count: 2 }],
    themes: [{ label: "Wartung", count: 2 }],
    dateRange: { earliest: "2023-01-05T00:00:00Z", latest: "2024-02-01T00:00:00Z" },
    withImagesHint: 1,
  },
  truncated: false,
};

const SELECT_RESPONSE = {
  matched: 2,
  limited: false,
  truncated: false,
  criteria: { themes: ["Wartung"] },
  preview: [
    { title: "Pumpe warten", hasImage: false, themes: ["Wartung"] },
    { title: "Ventil tauschen", hasImage: false, themes: ["Wartung"] },
  ],
};

const GROUP_RESPONSE = {
  groups: [{ title: "Wartung", ids: ["a", "b"] }],
  candidates: [
    { id: "a", title: "Pumpe warten", alreadyImported: false, sourceNewer: false, hints: [] },
    { id: "b", title: "Ventil tauschen", alreadyImported: false, sourceNewer: false, hints: [] },
  ],
  demo: true,
  fallbackReason: "no-model",
  snapshotToken: 1,
};

const APPLY_RESPONSE = { imported: 2, updates: 0, alreadyQueued: 0, failed: [], notFound: [] };

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(): void {
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
          ImportCockpitProvider,
          null,
          createElement(ImportStepperBar),
          createElement(ImportExplore),
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
  vi.clearAllMocks();
});

function stepItems(): HTMLElement[] {
  return [...container.querySelectorAll("ol li")] as HTMLElement[];
}

function activeStepText(): string {
  return container.querySelector('ol li[aria-current="step"]')?.textContent ?? "";
}

// Erledigte Schritte tragen den sr-only-Zusatz „erledigt" (Haken statt Nummer).
function doneStepCount(): number {
  return stepItems().filter((li) => (li.textContent ?? "").includes("erledigt")).length;
}

// Primär-Knöpfe (Button variant="primary" → bg-ink) — Filter-Chips (aria-pressed) zählen nicht.
function primaryButtons(): HTMLButtonElement[] {
  return [...container.querySelectorAll("button")].filter(
    (b): b is HTMLButtonElement =>
      b instanceof HTMLButtonElement &&
      b.className.includes("bg-ink") &&
      !b.hasAttribute("aria-pressed"),
  );
}

// react-query benachrichtigt gebatcht (Timer-Tick) — nach einem Klick auf eine Mutation einmal
// den Macrotask-Takt abwarten, damit der Erfolgs-Zustand im DOM angekommen ist.
async function clickAndSettle(part: string): Promise<void> {
  await act(async () => {
    buttonByText(part).click();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function buttonByText(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf mit Text ${part} nicht gefunden`);
  }
  return btn;
}

describe("WP-COCKPIT-LINIE: geführter Fluss — Schritt-Zustände + genau EIN Primär-CTA je Zustand", () => {
  it("führt in einer Linie von Quelle bis Bilanz; die Leiste läuft mit, der Primär-CTA wandert", async () => {
    exploreMock.mockResolvedValue(EXPLORE_RESPONSE);
    selectMock.mockResolvedValue(SELECT_RESPONSE);
    groupMock.mockResolvedValue(GROUP_RESPONSE);
    applyMock.mockResolvedValue(APPLY_RESPONSE);
    mount();

    // Zustand 1 — vor der Erkundung: Schritt 1 (Quelle) aktiv, nichts erledigt,
    // GENAU EIN Primär-Knopf: „Weiter: Erkunden".
    expect(stepItems().length).toBe(5);
    expect(activeStepText()).toContain("Quelle");
    expect(doneStepCount()).toBe(0);
    expect(primaryButtons().length).toBe(1);
    expect(primaryButtons()[0]?.textContent).toContain("Weiter: Erkunden");

    // Zustand 2 — Landkarte da: Schritte 1+2 erledigt, „Eingrenzen" aktiv; der Erkunden-Knopf
    // tritt zurück („Neu erkunden", outline), der EINE Primär-Knopf ist „Weiter: Eingrenzen".
    await clickAndSettle("Weiter: Erkunden");
    expect(exploreMock).toHaveBeenCalledTimes(1);
    expect(activeStepText()).toContain("Eingrenzen");
    expect(doneStepCount()).toBe(2);
    expect(container.textContent).toContain("Neu erkunden");
    expect(primaryButtons().length).toBe(1);
    expect(primaryButtons()[0]?.textContent).toContain("Weiter: Eingrenzen");

    // Zustand 3 — Vorschau da: Schritt 3 erledigt, „Gruppen freigeben" aktiv; der EINE
    // Primär-Knopf ist der bestehende R7-CTA „Weiter: Gruppieren & Übernehmen".
    await clickAndSettle("Weiter: Eingrenzen");
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(activeStepText()).toContain("Gruppen freigeben");
    expect(doneStepCount()).toBe(3);
    expect(primaryButtons().length).toBe(1);
    expect(primaryButtons()[0]?.textContent).toContain("Weiter: Gruppieren & Übernehmen");

    // Zustand 4 — Gruppen sichtbar: Schritt 4 bleibt aktiv; der EINE Primär-Knopf ist
    // „Auswahl übernehmen (2)".
    await clickAndSettle("Weiter: Gruppieren & Übernehmen");
    expect(groupMock).toHaveBeenCalledTimes(1);
    expect(activeStepText()).toContain("Gruppen freigeben");
    expect(container.textContent).toContain("2 von 2 ausgewählt");
    expect(primaryButtons().length).toBe(1);
    expect(primaryButtons()[0]?.textContent).toContain("Auswahl übernehmen (2)");

    // Zustand 5a — WP-COCKPIT-LINIE-b (bens Punkt 1): WÄHREND der Übernahme (hängende Mutation)
    // ist Schritt 5 „Übernehmen & Bilanz" der AKTIVE Schritt (aria-current auf 5, nicht 4).
    let releaseApply: (value: typeof APPLY_RESPONSE) => void = () => {};
    applyMock.mockImplementation(
      () =>
        new Promise((resolvePromise) => {
          releaseApply = resolvePromise;
        }),
    );
    await clickAndSettle("Auswahl übernehmen");
    expect(applyMock).toHaveBeenCalledTimes(1);
    expect(activeStepText()).toContain("Übernehmen & Bilanz");
    expect(doneStepCount()).toBe(4);

    // Zustand 5b — Bilanz da: alle fünf Schritte erledigt, kein Schritt mehr aktiv, kein
    // Primär-Knopf mehr offen (die Linie ist zu Ende, die Bilanz spricht).
    await act(async () => {
      releaseApply(APPLY_RESPONSE);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(container.textContent).toContain("Ergebnis der Übernahme");
    expect(doneStepCount()).toBe(5);
    expect(container.querySelector('ol li[aria-current="step"]')).toBeNull();
    expect(primaryButtons().length).toBe(0);

    // WP-COCKPIT-LINIE-b (bens Punkt 2, Szenario exakt): NEUE Eingrenzung NACH der Bilanz —
    // ein Filter-Chip der Landkarte startet eine neue Generation. Die Schritte 4+5 verlieren
    // ihre Haken, Schritt 3 („Eingrenzen") ist wieder der aktuelle (die live nachladende
    // Vorschau steckt noch im Debounce — genau der ehrliche Zwischenzustand).
    await act(async () => {
      buttonByText("Wartung").click();
    });
    expect(activeStepText()).toContain("Eingrenzen");
    expect(doneStepCount()).toBe(2);
  });

  it("die Schritt-Leiste bricht schmal sauber um (flex-wrap) und die Einträge tragen min-w-0", () => {
    exploreMock.mockResolvedValue(EXPLORE_RESPONSE);
    mount();
    const list = container.querySelector("ol");
    expect(list?.className).toContain("flex-wrap");
    for (const li of stepItems()) {
      expect(li.className).toContain("min-w-0");
    }
  });
});
