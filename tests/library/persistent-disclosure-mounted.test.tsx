// @vitest-environment jsdom
// AUFTRAG-uxpol6 (bens GELB 2.2): die Speicher-Fehlertoleranz ist VOLLSTÄNDIG — schon der GETTER
// window.localStorage kann wegen Browser-/Origin-Policy werfen (nicht erst getItem/setItem). Gepinnt
// am ECHTEN Hook (usePersistentDisclosure, gemeinsame Grenze für „Weitere Filter“ UND die
// Reife-Erklärbox): werfender Getter → Fallback auf den Default, Toggle bleibt (flüchtig) nutzbar,
// KEIN Crash. Zusätzlich gepinnt: intakter Speicher liest/schreibt weiter normal.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { usePersistentDisclosure } from "../../apps/web/src/lib/usePersistentDisclosure";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const KEY = "test.disclosure.open";

function Probe({ openOnFirstVisit }: { openOnFirstVisit: boolean }) {
  const [open, toggle] = usePersistentDisclosure(KEY, {
    defaultOpen: false,
    openOnFirstVisit,
  });
  return createElement(
    "button",
    { type: "button", "aria-expanded": open, onClick: toggle },
    open ? "offen" : "zu",
  );
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
// Original-Beschreibung von window.localStorage sichern, um den werfenden Getter rückstandsfrei
// wieder zu entfernen (jsdom definiert die Eigenschaft konfigurierbar auf window).
const originalDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");

function mount(openOnFirstVisit: boolean): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(Probe, { openOnFirstVisit }));
  });
}

function unmount(): void {
  act(() => {
    root.unmount();
  });
  container.remove();
}

function pinThrowingLocalStorageGetter(): void {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new Error("Speicherzugriff durch Browser-/Origin-Policy blockiert");
    },
  });
}

function restoreLocalStorage(): void {
  if (originalDescriptor) {
    Object.defineProperty(window, "localStorage", originalDescriptor);
  }
}

function toggleButton(): HTMLButtonElement {
  const btn = container.querySelector("button");
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Toggle fehlt; DOM: ${container.textContent}`);
  }
  return btn;
}

beforeEach(() => {
  restoreLocalStorage();
  window.localStorage.clear();
});

afterEach(() => {
  unmount();
  restoreLocalStorage();
  window.localStorage.clear();
});

describe("uxpol6: usePersistentDisclosure — werfender window.localStorage-GETTER (gemountet)", () => {
  it("werfender Getter → Fallback auf Default, kein Crash, Toggle bleibt (flüchtig) nutzbar", () => {
    pinThrowingLocalStorageGetter();
    // Mount crasht nicht; ohne lesbaren Speicher gilt der Erstbesuchs-Default (hier: offen).
    expect(() => mount(true)).not.toThrow();
    expect(toggleButton().getAttribute("aria-expanded")).toBe("true");
    // Toggle crasht ebenfalls nicht (Schreiben ist ein stilles No-op) — der Zustand lebt die Sitzung.
    act(() => {
      toggleButton().click();
    });
    expect(toggleButton().getAttribute("aria-expanded")).toBe("false");
    act(() => {
      toggleButton().click();
    });
    expect(toggleButton().getAttribute("aria-expanded")).toBe("true");
  });

  it("werfender Getter ohne Erstbesuchs-Öffnung → Default „zu“, kein Crash", () => {
    pinThrowingLocalStorageGetter();
    expect(() => mount(false)).not.toThrow();
    expect(toggleButton().getAttribute("aria-expanded")).toBe("false");
  });

  it("Gegenprobe intakter Speicher: gespeichertes „offen“ wird weiterhin geladen", () => {
    window.localStorage.setItem(KEY, "1");
    mount(false);
    expect(toggleButton().getAttribute("aria-expanded")).toBe("true");
  });
});
