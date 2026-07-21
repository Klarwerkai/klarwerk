// @vitest-environment jsdom
// Teil B (Pedis Befund): die Bildergalerie ist schon im ENTWURF sichtbar — dieselbe
// BodyImageGallery, gespeist aus dem AKTUELLEN Editor-bodyHtml, debounced (300 ms). Getestet:
// Galerie erscheint bei ≥1 Bild, aktualisiert nach Caption-Edit (nach der Debounce-Pause),
// verschwindet bei 0 Bildern.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { DraftBodyGallery } from "../../apps/web/src/components/DraftBodyGallery";
import { LIBRARY_SEARCH_DEBOUNCE_MS } from "../../apps/web/src/lib/useDebouncedValue";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FIGURE = (caption: string): string =>
  `<figure><img data-image-id="kw-img-t1-1" src="data:image/png;base64,QQ=="><figcaption data-image-id="kw-img-t1-1">${caption}</figcaption></figure>`;

let setHtml: ((next: string) => void) | null = null;

function Host({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  setHtml = setValue;
  return createElement(DraftBodyGallery, { bodyHtml: value });
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.useRealTimers();
  setHtml = null;
});

function mount(initial: string): void {
  act(() => {
    root.render(createElement(Host, { initial }));
  });
}

function advanceDebounce(): void {
  act(() => {
    vi.advanceTimersByTime(LIBRARY_SEARCH_DEBOUNCE_MS + 10);
  });
}

describe("Teil B: Galerie im Entwurf (DraftBodyGallery, gemountet)", () => {
  it("erscheint bei mindestens einem verankerten Bild — direkt beim Mount", () => {
    mount(`<p>Text</p>${FIGURE("Verschraubung")}`);
    const thumb = container.querySelector("button img");
    expect(thumb).not.toBeNull();
    expect(thumb?.getAttribute("alt")).toBe("Verschraubung");
  });

  it("aktualisiert nach einem Caption-Edit im Editor (nach der Debounce-Pause)", () => {
    mount(`<p>Text</p>${FIGURE("Alte Beschreibung")}`);
    act(() => {
      setHtml?.(`<p>Text</p>${FIGURE("Neue Beschreibung")}`);
    });
    // VOR der Pause noch der alte Stand (debounced — kein Re-Render pro Tastendruck) …
    expect(container.querySelector("button img")?.getAttribute("alt")).toBe("Alte Beschreibung");
    advanceDebounce();
    // … NACH der Pause die aktuelle Fußnote.
    expect(container.querySelector("button img")?.getAttribute("alt")).toBe("Neue Beschreibung");
  });

  it("verschwindet, wenn das letzte Bild aus dem Entwurf entfernt wird", () => {
    mount(`<p>Text</p>${FIGURE("Bild")}`);
    expect(container.querySelector("button img")).not.toBeNull();
    act(() => {
      setHtml?.("<p>Nur noch Text</p>");
    });
    advanceDebounce();
    expect(container.querySelector("button img")).toBeNull();
    expect(container.textContent).toBe(""); // kein leerer Galerie-Abschnitt
  });

  it("PIN: beide Entwurfs-Ansichten rendern die Galerie unter dem Editor (kein Duplikat)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    for (const file of [
      "apps/web/src/pages/Capture.tsx",
      "apps/web/src/pages/CaptureFrontDoor.tsx",
    ]) {
      const src = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(src).toContain("<DraftBodyGallery bodyHtml={bodyHtml} />");
    }
    // Die Entwurfs-Galerie ist NUR ein debounzter Wrapper um die abgenommene BodyImageGallery.
    const wrapper = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/DraftBodyGallery.tsx"),
      "utf8",
    );
    expect(wrapper).toContain("useDebouncedValue(bodyHtml, LIBRARY_SEARCH_DEBOUNCE_MS)");
    expect(wrapper).toContain("<BodyImageGallery bodyHtml={debounced} />");
  });
});
