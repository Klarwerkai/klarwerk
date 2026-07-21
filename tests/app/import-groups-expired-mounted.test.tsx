// @vitest-environment jsdom
// WP-REST18 (bens Fix 2): handlungsfähiger SNAPSHOT_EXPIRED-Weg. Ein 409/SNAPSHOT_EXPIRED mitten
// im Apply-Lauf ist KEIN Transportfehler: der Lauf endet kontrolliert, der komplette
// Gruppierungs-Zustand (inkl. altem snapshotToken) wird zurückgesetzt, es erscheint die klare
// Meldung + der prominente Neu-gruppieren-Knopf — und es gibt KEINEN Wiederholen-Knopf mehr, der
// den abgelaufenen Token erneut schicken könnte. Neu gruppieren startet einen frischen /group.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    admin: {
      import: {
        group: vi.fn(),
        apply: vi.fn(),
      },
    },
  },
}));

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { ApiError } from "../../apps/web/src/api/client";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { ImportGroups } from "../../apps/web/src/components/ImportGroups";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const groupMock = endpoints.admin.import.group as unknown as ReturnType<typeof vi.fn>;
const applyMock = endpoints.admin.import.apply as unknown as ReturnType<typeof vi.fn>;

const GROUP_RESPONSE = {
  groups: [{ title: "Wartung", ids: ["a", "b"] }],
  candidates: [
    { id: "a", title: "Pumpe warten", alreadyImported: false, sourceNewer: false, hints: [] },
    { id: "b", title: "Ventil tauschen", alreadyImported: false, sourceNewer: false, hints: [] },
  ],
  demo: true,
  fallbackReason: "no-model",
  snapshotToken: 7,
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(ImportGroups, { criteria: {} }));
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

describe("WP-REST18 Fix 2: SNAPSHOT_EXPIRED mitten im Apply-Lauf", () => {
  it("Lauf endet kontrolliert: Meldung + Neu-gruppieren-Knopf, KEIN Retry mit altem Token; Neu gruppieren startet /group frisch", async () => {
    groupMock.mockResolvedValue(GROUP_RESPONSE);
    applyMock.mockRejectedValue(
      new ApiError(409, "SNAPSHOT_EXPIRED", "Die Datengrundlage der Gruppierung ist abgelaufen."),
    );
    mount();
    await act(async () => {
      buttonByText("Gruppieren").click();
    });
    expect(groupMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("2 von 2 ausgewählt");

    // Übernehmen → der (einzige) Batch läuft in den 409/SNAPSHOT_EXPIRED.
    await act(async () => {
      buttonByText("Auswahl übernehmen").click();
    });
    expect(applyMock).toHaveBeenCalledTimes(1);
    // Der abgelaufene Token wurde mitgeschickt — genau der Grund für den Reset.
    expect(applyMock.mock.calls[0]?.[0]).toMatchObject({ snapshotToken: 7 });

    // Kontrolliertes Ende: klare Meldung + prominenter Neu-gruppieren-Knopf …
    expect(container.textContent).toContain("Bitte neu gruppieren");
    const regroup = buttonByText("Neu gruppieren");
    // … und KEINE Wege zurück in den alten Token: kein Wiederholen-Knopf, kein Panel, keine Bilanz.
    expect(container.textContent).not.toContain("Rest übernehmen");
    expect(container.textContent).not.toContain("Auswahl übernehmen");
    expect(container.querySelectorAll("input[type=checkbox]").length).toBe(0);

    // Neu gruppieren → FRISCHER /group-Aufruf (neuer Token), der Flow beginnt sauber von vorn.
    groupMock.mockResolvedValue({ ...GROUP_RESPONSE, snapshotToken: 8 });
    await act(async () => {
      regroup.click();
    });
    expect(groupMock).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("2 von 2 ausgewählt");
    expect(container.textContent).not.toContain("Bitte neu gruppieren");
  });
});
