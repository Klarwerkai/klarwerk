import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @vitest-environment jsdom
// WP-D10c (Pedis Wunsch): der Dateiformate-Infokasten startet ZUGEKLAPPT — echter React-Mount
// (gleiches Muster wie editor-figure-caption-mounted: react/react-dom relativ aus apps/web/node_modules,
// createElement statt JSX, act aus React 18.3). Gepinnt: (a) initial zugeklappt (aria-expanded=false,
// Volltext NICHT im DOM), (b) Klick klappt auf (aria-expanded=true, Volltext sichtbar), (c) zweiter
// Klick klappt wieder zu. Der Toggle ist ein echtes <button> — kein Browser-Blocker-Dialog.
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { FileFormatInfo } from "../../apps/web/src/components/FileFormatInfo";
// i18n VOR der Komponente importieren: initialisiert react-i18next global (useTranslation ohne Provider).
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(FileFormatInfo));
  });
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function toggle(): HTMLButtonElement {
  const btn = container.querySelector("button");
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error("Aufklapp-Button nicht gerendert");
  }
  return btn;
}

function fullTextDe(): string {
  return String(i18n.getResource("de", "translation", "capture.file.formatHint"));
}

describe("WP-D10c: FileFormatInfo — zugeklappt starten, Klick klappt auf/zu", () => {
  it("(a) startet ZUGEKLAPPT: aria-expanded=false, Volltext NICHT im DOM, Label sichtbar", () => {
    const btn = toggle();
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(btn.getAttribute("type")).toBe("button");
    expect(btn.textContent).toContain(
      String(i18n.getResource("de", "translation", "capture.file.formatTitle")),
    );
    expect(container.textContent).not.toContain("TXT/MD");
    expect(container.textContent).not.toContain(fullTextDe());
  });

  it("(b) Klick klappt auf: aria-expanded=true, Volltext im DOM (inkl. ehrlicher PPTX-Foto-Aussage)", () => {
    act(() => {
      toggle().click();
    });
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).toContain(fullTextDe());
    // WP-D10c Fix 1: der aufgeklappte Text traegt die aktualisierte, ehrliche PPTX-Aussage.
    expect(container.textContent).toContain("Fotos je Folie");
  });

  it("(c) zweiter Klick klappt wieder zu: Volltext verschwindet aus dem DOM", () => {
    act(() => {
      toggle().click();
    });
    act(() => {
      toggle().click();
    });
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).not.toContain("TXT/MD");
  });
});
