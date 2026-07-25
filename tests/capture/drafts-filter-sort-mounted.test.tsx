// @vitest-environment jsdom
// AUFTRAG-sortfilter · Punkt 2: gemountete Entwurfsliste am ECHTEN Bauteil (CaptureDraftList, das aus
// der Erfassen-Seite herausgelöste „Entwürfe fortsetzen"). Es trägt die reale Filter-/Sortier-/
// Persistenz-Logik (draftListView + persistente Hooks). Gepinnt:
//  (a) leerer Filter zeigt alle Entwürfe.
//  (b) die Titel-/Volltextsuche filtert die Liste.
//  (c) Sortierung ordnet nach Datum (neu→alt / alt→neu) und Titel korrekt.
//  (d) in der Admin-Ansicht grenzt der Ersteller-Filter auf einen Ersteller ein.
//  (e) die Filter-/Sortier-Wahl überlebt einen frischen Mount (Persistenz).
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { I18nextProvider } from "../../apps/web/node_modules/react-i18next";
import type { Draft } from "../../apps/web/src/api/types";
import { CaptureDraftList } from "../../apps/web/src/components/CaptureDraftList";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function draft(overrides: Partial<Draft> & { id: string }): Draft {
  return {
    payload: {},
    originalAuthor: "u1",
    lastEditor: "u1",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  } as Draft;
}

const D1 = draft({
  id: "d1",
  payload: { title: "Alphabeitrag" },
  originalAuthor: "u1",
  updatedAt: "2026-07-20T00:00:00.000Z",
});
const D2 = draft({
  id: "d2",
  payload: { title: "Zetabeitrag" },
  originalAuthor: "u2",
  updatedAt: "2026-07-24T00:00:00.000Z",
});
const D3 = draft({
  id: "d3",
  payload: { title: "Mittelbeitrag" },
  originalAuthor: "u1",
  updatedAt: "2026-07-22T00:00:00.000Z",
});
const DRAFTS = [D1, D2, D3];
const DIRECTORY = [
  { id: "u1", name: "Anna" },
  { id: "u2", name: "Bob" },
];

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function Harness({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  return createElement(
    I18nextProvider,
    { i18n },
    createElement(CaptureDraftList, {
      drafts: DRAFTS,
      isAdmin,
      directory: DIRECTORY,
      open,
      onToggleOpen: () => setOpen((o) => !o),
      scopeLabel: "Admin",
      highlightId: null,
      editingId: null,
      confirmDiscardId: confirmId,
      onConfirmDiscard: setConfirmId,
      discardPending: false,
      onDiscard: () => {},
      onResume: () => {},
    }),
  );
}

function mount(isAdmin = true): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(Harness, { isAdmin }));
  });
}

function unmount(): void {
  act(() => {
    root.unmount();
  });
  container.remove();
}

function byLabel<T extends Element>(selector: string, label: string): T {
  const el = container.querySelector(`${selector}[aria-label="${label}"]`);
  if (!el) {
    throw new Error(`${selector} „${label}" fehlt; DOM: ${container.textContent}`);
  }
  return el as unknown as T;
}

function setValue(el: HTMLInputElement | HTMLSelectElement, value: string): void {
  // React verfolgt den Wert über einen internen Value-Tracker; der native Prototyp-Setter umgeht ihn.
  const proto =
    el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  act(() => {
    setter?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function pos(title: string): number {
  return (container.textContent ?? "").indexOf(title);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
});

afterEach(() => {
  unmount();
  window.localStorage.clear();
});

describe("AUFTRAG-sortfilter: gemountete Entwurfsliste — Filter + Sortierung (CaptureDraftList)", () => {
  it("(a) leerer Filter zeigt alle Entwürfe", () => {
    mount();
    expect(container.textContent).toContain("Alphabeitrag");
    expect(container.textContent).toContain("Zetabeitrag");
    expect(container.textContent).toContain("Mittelbeitrag");
  });

  it("(b) Titelsuche filtert die Entwurfsliste", () => {
    mount();
    setValue(byLabel<HTMLInputElement>("input", "Entwürfe durchsuchen"), "alpha");
    expect(container.textContent).toContain("Alphabeitrag");
    expect(container.textContent).not.toContain("Zetabeitrag");
    expect(container.textContent).not.toContain("Mittelbeitrag");
  });

  it("(c) Sortierung ordnet nach Datum und Titel korrekt", () => {
    mount();
    const sort = byLabel<HTMLSelectElement>("select", "Sortieren");
    // Default = neu→alt: D2 (24.) vor D3 (22.) vor D1 (20.).
    expect(pos("Zetabeitrag")).toBeGreaterThanOrEqual(0);
    expect(pos("Zetabeitrag")).toBeLessThan(pos("Mittelbeitrag"));
    expect(pos("Mittelbeitrag")).toBeLessThan(pos("Alphabeitrag"));
    // alt→neu kehrt die Ordnung um.
    setValue(sort, "oldest");
    expect(pos("Alphabeitrag")).toBeLessThan(pos("Mittelbeitrag"));
    expect(pos("Mittelbeitrag")).toBeLessThan(pos("Zetabeitrag"));
    // Titel A→Z.
    setValue(sort, "title");
    expect(pos("Alphabeitrag")).toBeLessThan(pos("Mittelbeitrag"));
    expect(pos("Mittelbeitrag")).toBeLessThan(pos("Zetabeitrag"));
  });

  it("(d) Admin-Ansicht: Ersteller-Filter grenzt auf einen Ersteller ein", () => {
    mount(true);
    setValue(byLabel<HTMLSelectElement>("select", "Ersteller"), "u2");
    expect(container.textContent).toContain("Zetabeitrag");
    expect(container.textContent).not.toContain("Alphabeitrag");
    expect(container.textContent).not.toContain("Mittelbeitrag");
  });

  it("(d2) ohne Admin gibt es keinen Ersteller-Filter", () => {
    mount(false);
    expect(container.querySelector('select[aria-label="Ersteller"]')).toBeNull();
  });

  it("(e) die Filter-/Sortier-Wahl überlebt einen frischen Mount (Persistenz)", () => {
    mount();
    setValue(byLabel<HTMLSelectElement>("select", "Sortieren"), "title");
    unmount();
    // „Reload": frischer Mount über denselben localStorage → Wahl bleibt „Titel A→Z".
    mount();
    expect(byLabel<HTMLSelectElement>("select", "Sortieren").value).toBe("title");
    expect(pos("Alphabeitrag")).toBeLessThan(pos("Mittelbeitrag"));
    expect(pos("Mittelbeitrag")).toBeLessThan(pos("Zetabeitrag"));
  });
});
