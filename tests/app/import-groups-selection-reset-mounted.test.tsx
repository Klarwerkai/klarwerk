// @vitest-environment jsdom
// WP-SHIP9-S2d (F3, bens letzte GELB-Auflage): die sichtbaren Gruppen dürfen NIE von der aktuellen
// Vorschau-Auswahl abweichen. Ändert der Nutzer selectedCandidateIds NACH bereits erfolgter
// Gruppierung, muss der komplette aufgebaute Zustand (Gruppen, Zweit-Auswahl, Bilanz) verworfen
// werden und der ehrliche Start der Gruppierung wieder erscheinen. Umsetzung: die stabil sortierte
// Auswahl steckt zusätzlich im Komponenten-Key von ImportGroups → ein Auswahlwechsel montiert die
// Gruppierung frisch. Getestet über die ECHTE ImportSelect → ImportGroups-Kette (Auswahl wird aus
// den Vorschau-Checkboxen abgeleitet und steuert group + apply) mit gemocktem endpoints-Modul.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    admin: {
      import: {
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
import { ImportSelect } from "../../apps/web/src/components/ImportSelect";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const selectMock = endpoints.admin.import.select as unknown as ReturnType<typeof vi.fn>;
const groupMock = endpoints.admin.import.group as unknown as ReturnType<typeof vi.fn>;
const applyMock = endpoints.admin.import.apply as unknown as ReturnType<typeof vi.fn>;

// Drei wählbare Kandidaten (nichts vorab abgewählt → alle drei starten gewählt).
const SELECT_RESPONSE = {
  matched: 3,
  limited: false,
  truncated: false,
  criteria: { themes: ["Wartung"] },
  preview: [
    { id: "a", title: "Pumpe A", hasImage: false, themes: ["Wartung"] },
    { id: "b", title: "Ventil B", hasImage: false, themes: ["Wartung"] },
    { id: "c", title: "Rohr C", hasImage: false, themes: ["Wartung"] },
  ],
};

function groupResponseFor(ids: string[], token: number): unknown {
  const titles: Record<string, string> = { a: "Pumpe A", b: "Ventil B", c: "Rohr C" };
  return {
    groups: [{ title: "Wartung", ids }],
    candidates: ids.map((id) => ({
      id,
      title: titles[id],
      alreadyImported: false,
      sourceNewer: false,
      hints: [],
    })),
    demo: true,
    fallbackReason: "no-model",
    snapshotToken: token,
  };
}

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
        createElement(ImportSelect, { chip: { themes: ["Wartung"], authors: [], spaces: [] } }),
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

function buttonByText(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf mit Text ${part} nicht gefunden`);
  }
  return btn;
}

function checkboxByLabel(label: string): HTMLInputElement {
  const box = [...container.querySelectorAll("input[type=checkbox]")].find(
    (el) => el.getAttribute("aria-label") === label,
  );
  if (!(box instanceof HTMLInputElement)) {
    throw new Error(`Checkbox mit Label ${label} nicht gefunden`);
  }
  return box;
}

// react-query benachrichtigt gebatcht — nach einem Mutations-Klick den Macrotask-Takt abwarten.
async function clickAndSettle(part: string): Promise<void> {
  await act(async () => {
    buttonByText(part).click();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function lastSelectedIds(mock: ReturnType<typeof vi.fn>): string[] {
  return mock.mock.calls.at(-1)?.[0]?.selectedCandidateIds as string[];
}

describe("WP-SHIP9-S2d (F3): Auswahlwechsel nach dem Gruppieren verwirft die alten Gruppen", () => {
  it("group/apply beruhen IMMER auf genau der sichtbaren Vorschau-Auswahl (bens drei Pins)", async () => {
    selectMock.mockResolvedValue(SELECT_RESPONSE);
    mount();

    // Vorschau öffnen → alle drei Kandidaten starten gewählt.
    await clickAndSettle("Weiter: Eingrenzen");
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(checkboxByLabel("Pumpe A").checked).toBe(true);
    expect(checkboxByLabel("Ventil B").checked).toBe(true);
    expect(checkboxByLabel("Rohr C").checked).toBe(true);

    // Auswahl auf A, C reduzieren (B abwählen).
    await act(async () => {
      checkboxByLabel("Ventil B").click();
    });
    expect(checkboxByLabel("Ventil B").checked).toBe(false);

    // PIN 1: Gruppieren ruft group mit GENAU der Vorschau-Auswahl [a, c] auf.
    groupMock.mockResolvedValue(groupResponseFor(["a", "c"], 11));
    await clickAndSettle("Weiter: Gruppieren & Übernehmen");
    expect(groupMock).toHaveBeenCalledTimes(1);
    expect(lastSelectedIds(groupMock)).toEqual(["a", "c"]);
    // Die Gruppen sind sichtbar (Zweit-Auswahl aus den zwei gelieferten Kandidaten).
    expect(container.textContent).toContain("2 von 2 ausgewählt");
    expect(container.textContent).toContain("Auswahl übernehmen");

    // PIN 2: Auswahlwechsel NACH dem Gruppieren (B wieder wählen → [a, b, c]) verwirft die alten
    // Gruppen. Kein Auto-Neulauf (group weiterhin nur 1×), der Gruppieren-CTA erscheint erneut,
    // der alte Gruppen-/Übernehmen-Stand ist weg (nicht mehr sichtbar/bedienbar).
    await act(async () => {
      checkboxByLabel("Ventil B").click();
    });
    expect(checkboxByLabel("Ventil B").checked).toBe(true);
    expect(groupMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain("2 von 2 ausgewählt");
    expect(container.textContent).not.toContain("Auswahl übernehmen");
    expect(container.textContent).toContain("Weiter: Gruppieren & Übernehmen");

    // PIN 3: Neu gruppieren auf der jetzt sichtbaren Auswahl [a, b, c]; apply beschränkt sich auf
    // GENAU diese Auswahl — deckungsgleich mit der Auswahl, auf der die sichtbaren Gruppen beruhen.
    groupMock.mockResolvedValue(groupResponseFor(["a", "b", "c"], 12));
    applyMock.mockResolvedValue(APPLY_RESPONSE);
    await clickAndSettle("Weiter: Gruppieren & Übernehmen");
    expect(groupMock).toHaveBeenCalledTimes(2);
    expect(lastSelectedIds(groupMock)).toEqual(["a", "b", "c"]);
    expect(container.textContent).toContain("3 von 3 ausgewählt");

    await clickAndSettle("Auswahl übernehmen");
    expect(applyMock).toHaveBeenCalledTimes(1);
    expect(lastSelectedIds(applyMock)).toEqual(["a", "b", "c"]);
    // Die apply-Auswahl ist deckungsgleich mit der group-Auswahl der sichtbaren Gruppen.
    expect(lastSelectedIds(applyMock)).toEqual(lastSelectedIds(groupMock));
  });
});
