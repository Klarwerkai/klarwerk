// @vitest-environment jsdom
// AUFTRAG-mega1 Block D6 (E2E-012/013): eine klickbare Karte, die selbst interaktive Elemente
// enthält, darf NICHT role="button"/tabIndex tragen (kein verschachtelter Button, kein falscher
// Sammel-Accessible-Name). `interactive={false}` entflechtet das; die Standard-Klick-Karte bleibt
// unverändert eine Button-Karte.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { Card } from "../../apps/web/src/components/ui";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(el: unknown): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(el as Parameters<typeof root.render>[0]);
  });
}

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("Block D6: Card entflechtet verschachtelte Buttons", () => {
  it("interactive={false} + onClick → Container ohne role=button, aber Klick funktioniert", () => {
    let clicks = 0;
    mount(
      createElement(Card, {
        interactive: false,
        onClick: () => clicks++,
        children: createElement("button", { type: "button", "data-testid": "inner" }, "Aktion"),
      }),
    );
    const cardDiv = container.querySelector("div");
    expect(cardDiv?.getAttribute("role")).toBeNull();
    expect(cardDiv?.getAttribute("tabindex")).toBeNull();
    // der enthaltene echte Button bleibt vorhanden (nicht in eine Button-Karte verschachtelt).
    expect(container.querySelector("[data-testid=inner]")).not.toBeNull();
    // Maus-Komfortklick auf die Fläche wirkt weiterhin.
    act(() => {
      cardDiv?.dispatchEvent(new Event("click", { bubbles: true }));
    });
    expect(clicks).toBe(1);
  });

  it("Standard-Klick-Karte (interactive default) bleibt role=button", () => {
    mount(createElement(Card, { onClick: () => {}, children: "Klick mich" }));
    const cardDiv = container.querySelector("div");
    expect(cardDiv?.getAttribute("role")).toBe("button");
    expect(cardDiv?.getAttribute("tabindex")).toBe("0");
  });
});
