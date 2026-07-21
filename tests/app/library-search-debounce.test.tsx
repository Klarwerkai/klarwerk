// @vitest-environment jsdom
// WP-BILD-1f (bens P4): die live getippte Bibliotheks-Suche läuft DEBOUNCED (ein Server-Request
// nach der Tipp-Pause statt einer pro Tastendruck). Veraltete Antworten können das Ergebnis nie
// überschreiben: react-query schlüsselt die Suche pro Parameter-Key — die UI liest immer nur den
// AKTUELLEN Key (latest-wins per Konstruktion, dasselbe Prinzip wie der IC-Request-ID-Guard).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  LIBRARY_SEARCH_DEBOUNCE_MS,
  useDebouncedValue,
} from "../../apps/web/src/lib/useDebouncedValue";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let observed = "";
let setInput: ((v: string) => void) | null = null;

function Probe({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  setInput = setValue;
  observed = useDebouncedValue(value, LIBRARY_SEARCH_DEBOUNCE_MS);
  return null;
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
  setInput = null;
});

describe("WP-BILD-1f P4: Debounce der Live-Suche", () => {
  it("waehrend des Tippens bleibt der alte Wert; nach der Pause kommt NUR der letzte Wert an", () => {
    act(() => {
      root.render(createElement(Probe, { initial: "P" }));
    });
    expect(observed).toBe("P");

    // Schnell weitertippen — jeder Zwischenschritt raeumt den vorigen Timer ab.
    act(() => {
      setInput?.("Pu");
    });
    act(() => {
      setInput?.("Pum");
    });
    act(() => {
      vi.advanceTimersByTime(LIBRARY_SEARCH_DEBOUNCE_MS - 50);
    });
    expect(observed).toBe("P"); // noch keine Pause → kein neuer Wert (kein Request pro Tastendruck)

    act(() => {
      setInput?.("Pumpe");
    });
    act(() => {
      vi.advanceTimersByTime(LIBRARY_SEARCH_DEBOUNCE_MS);
    });
    expect(observed).toBe("Pumpe"); // NUR der letzte Stand — Zwischenwerte sind verworfen
  });

  it("PIN: die Bibliothek sucht ueber den debounced Wert; latest-wins haengt am Query-Key", () => {
    const librarySrc = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/Library.tsx"),
      "utf8",
    );
    expect(librarySrc).toContain("useDebouncedValue(filter.q, LIBRARY_SEARCH_DEBOUNCE_MS)");
    expect(librarySrc).toContain("q: debouncedQ");
    // Latest-wins: jede Antwort landet unter IHREM Parameter-Key; die UI liest nur den aktuellen.
    const hooksSrc = readFileSync(resolve(process.cwd(), "apps/web/src/api/hooks.ts"), "utf8");
    expect(hooksSrc).toContain('queryKey: ["library", "search", params]');
  });
});
