// @vitest-environment jsdom
// WP-IC-4 (Teil 2, Mounted): Gruppen-Karten der Freigabe — aufklappbare Kandidatenliste mit
// Hinweis-Badges, Gruppen-Entscheid (Freigeben/Ausschließen) setzt die Kandidaten-Vorgabe,
// Einzel-Override bleibt, der laufende Zähler stimmt. Getestet über den kontrollierten
// Präsentationsteil (GroupApprovalPanel) mit der echten Auswahl-Logik als Host-State.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { GroupApprovalPanel } from "../../apps/web/src/components/ImportGroups";
import {
  type GroupedCandidate,
  type ImportGroup,
  applyGroupToggle,
  initialSelection,
  toggleCandidate,
} from "../../apps/web/src/lib/importGroups";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CANDIDATES: GroupedCandidate[] = [
  { id: "a", title: "Pumpe warten", alreadyImported: false, hints: [] },
  { id: "b", title: "Ventil tauschen", alreadyImported: true, hints: ["already-imported"] },
  { id: "c", title: "Fehlercode E5", alreadyImported: false, hints: ["short"] },
];
const GROUPS: ImportGroup[] = [
  { title: "Wartung", ids: ["a", "b"] },
  { title: "Störungen", ids: ["c"] },
];

function Host() {
  const [selection, setSelection] = useState(() => initialSelection(CANDIDATES));
  return createElement(GroupApprovalPanel, {
    groups: GROUPS,
    candidates: CANDIDATES,
    selection,
    demo: true,
    onToggleGroup: (group: ImportGroup, on: boolean) =>
      setSelection((prev) => applyGroupToggle(prev, group, on)),
    onToggleCandidate: (id: string) => setSelection((prev) => toggleCandidate(prev, id)),
  });
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(Host));
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function checkboxOf(title: string): HTMLInputElement {
  const box = [...container.querySelectorAll('input[type="checkbox"]')].find(
    (el) => el.getAttribute("aria-label") === title,
  );
  if (!(box instanceof HTMLInputElement)) {
    throw new Error(`Checkbox ${title} nicht gefunden`);
  }
  return box;
}

describe("WP-IC-4: Gruppen-Karten (gemountet)", () => {
  it("rendert Gruppen-Karten mit Anzahl, aufklappbarer Kandidatenliste und Hinweis-Badges", () => {
    mount();
    const cards = container.querySelectorAll("details");
    expect(cards.length).toBe(2);
    expect(container.textContent).toContain("Wartung");
    expect(container.textContent).toContain("Störungen");
    // Aufklappen: die Kandidatenliste der Karte wird sichtbar (open-Zustand des details).
    const first = cards[0] as HTMLDetailsElement;
    expect(first.open).toBe(false);
    act(() => {
      first.open = true;
      first.dispatchEvent(new Event("toggle"));
    });
    expect(first.open).toBe(true);
    expect(checkboxOf("Pumpe warten")).toBeTruthy();
    // Hinweis-Badge (deterministischer Qualitätshinweis) am Kandidaten.
    expect(container.textContent).toContain("bereits importiert");
    // Ohne-KI-Kennzeichnung ist ehrlich sichtbar (demo:true).
    expect(container.textContent).toContain("Ohne KI gruppiert");
  });

  it("Vorab-Abwahl + Zähler: bereits Importiertes startet abgewählt (2 von 3)", () => {
    mount();
    expect(container.textContent).toContain("2 von 3 ausgewählt");
    expect(checkboxOf("Pumpe warten").checked).toBe(true);
    expect(checkboxOf("Ventil tauschen").checked).toBe(false);
  });

  it("Gruppen-Entscheid setzt die Kandidaten-Vorgabe; Einzel-Override bleibt; Zähler folgt", () => {
    mount();
    // Ganze Gruppe „Wartung" ausschließen → a und b abgewählt.
    const excludeButtons = [...container.querySelectorAll("button")].filter(
      (b) => b.textContent === "Ausschließen",
    );
    act(() => {
      (excludeButtons[0] as HTMLButtonElement).click();
    });
    expect(checkboxOf("Pumpe warten").checked).toBe(false);
    expect(container.textContent).toContain("1 von 3 ausgewählt");
    // Ganze Gruppe freigeben → auch das bereits Importierte (bewusster Gruppen-Override).
    const approveButtons = [...container.querySelectorAll("button")].filter(
      (b) => b.textContent === "Freigeben",
    );
    act(() => {
      (approveButtons[0] as HTMLButtonElement).click();
    });
    expect(checkboxOf("Ventil tauschen").checked).toBe(true);
    expect(container.textContent).toContain("3 von 3 ausgewählt");
    // Einzel-Override innerhalb der Gruppe.
    act(() => {
      checkboxOf("Pumpe warten").click();
    });
    expect(checkboxOf("Pumpe warten").checked).toBe(false);
    expect(container.textContent).toContain("2 von 3 ausgewählt");
  });
});
