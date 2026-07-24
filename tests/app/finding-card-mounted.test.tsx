// @vitest-environment jsdom
// SCRUM-486 (nacht24 Paket 3, Mounted): die Kernstruktur der einheitlichen Befund-Darstellung —
// BEIDE Beiträge als klickbare Links (/wissen/:id) mit Validierungs-Status-Badge (StatusPill,
// konsistent zur Validierung), ehrlicher Erkennungsweg als Pill, empfohlene Aktion, kompaktes
// WARUM; Gruppen-Kopfzeile mit verlinktem Beitrag + Zähler; entfernte Beiträge als neutraler
// Hinweis (nie die Roh-UUID).
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { FindingCard, FindingGroupHeader } from "../../apps/web/src/components/FindingCard";
import type { FindingView } from "../../apps/web/src/lib/findingGroups";
import "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(node: JSX.Element): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(MemoryRouter, null, node));
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function ko(id: string, title: string, status: "offen" | "validiert"): KnowledgeObject {
  return { id, title, status, assignments: [], trust: 60 } as unknown as KnowledgeObject;
}

const view: FindingView = {
  id: "f1",
  kind: "duplikat",
  kindLabelKey: "finding.kind.duplikat",
  way: "ki",
  wayLabelKey: "finding.way.ki",
  koA: "ko-a",
  koB: "ko-b",
  whyPercent: 91,
  whyRationale: "Gleicher Inhalt, andere Worte.",
  actionLabelKey: "dup.rec.zusammenfuehren_pruefen",
  open: true,
  createdAt: "2026-07-22T00:00:00.000Z",
};

describe("SCRUM-486: FindingCard (Mounted)", () => {
  it("beide Seiten klickbar (/wissen/:id) mit Status-Badge, ehrlicher Erkennungsweg, Aktion + WARUM", () => {
    mount(
      createElement(FindingCard, {
        view,
        a: ko("ko-a", "Ventil entlasten", "validiert"),
        b: ko("ko-b", "Druck ablassen", "offen"),
        statusLabel: "Offen",
      }),
    );
    const links = [...container.querySelectorAll("a")];
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/wissen/ko-a", "/wissen/ko-b"]);
    expect(links.map((a) => a.textContent)).toEqual(["Ventil entlasten", "Druck ablassen"]);
    // Status-Badges KONSISTENT zur Validierung (StatusPill: status.validiert / status.offen).
    expect(container.textContent).toContain("Validiert");
    expect(container.textContent).toContain("Offen");
    // WAS + Erkennungsweg (ehrlich) als Pills.
    expect(container.textContent).toContain("Duplikat");
    expect(container.textContent).toContain("mit KI");
    // WARUM kompakt (echter Prozent + Begründung) und die empfohlene Aktion.
    expect(container.textContent).toContain("91 %");
    expect(container.textContent).toContain("Gleicher Inhalt, andere Worte.");
    expect(container.textContent?.length).toBeGreaterThan(0);
  });

  it("entfernte Seite: neutraler Hinweis statt Link/UUID; deterministischer Weg ehrlich benannt", () => {
    mount(
      createElement(FindingCard, {
        view: {
          ...view,
          kind: "konflikt",
          kindLabelKey: "finding.kind.konflikt",
          way: "deterministisch",
          wayLabelKey: "finding.way.deterministisch",
        },
        a: ko("ko-a", "Ventil entlasten", "validiert"),
        b: null,
        statusLabel: "Offen",
      }),
    );
    expect([...container.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual([
      "/wissen/ko-a",
    ]);
    expect(container.textContent).toContain("Objekt entfernt");
    expect(container.textContent).not.toContain("ko-b"); // nie die Roh-UUID
    expect(container.textContent).toContain("ohne KI (deterministisch)");
    expect(container.textContent).toContain("Konflikt");
  });

  it("Gruppen-Kopfzeile: Beitrag verlinkt + Status-Badge + Befund-Zähler", () => {
    mount(
      createElement(FindingGroupHeader, {
        ko: ko("ko-a", "Ventil entlasten", "validiert"),
        count: 3,
      }),
    );
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/wissen/ko-a");
    expect(container.textContent).toContain("Ventil entlasten");
    expect(container.textContent).toContain("Beitrag");
    expect(container.textContent).toContain("3");
  });
});
