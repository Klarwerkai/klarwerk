// Aufräum-Pass 02.07.: Erstbesuchs-Logik der Start-Orientierung (DOM-frei).
import { describe, expect, it } from "vitest";
import {
  START_ORIENTATION_TEXT,
  isStartOrientationFirstRun,
  markStartOrientationSeen,
} from "../../apps/web/src/lib/startOrientation";

function memoryStorage(): Pick<Storage, "getItem" | "setItem"> & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k: string, v: string) => void store.set(k, v),
  };
}

describe("startOrientation", () => {
  it("Erstbesuch aufgeklappt, nach markSeen eingeklappt", () => {
    const s = memoryStorage();
    expect(isStartOrientationFirstRun(s)).toBe(true);
    markStartOrientationSeen(s);
    expect(isStartOrientationFirstRun(s)).toBe(false);
  });

  it("defensiv bei kaputtem Storage (kein Wurf, konservativer Default)", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(isStartOrientationFirstRun(broken)).toBe(false);
    expect(() => markStartOrientationSeen(broken)).not.toThrow();
  });

  it("Copy-Schlüssel im start.orientation-Namensraum", () => {
    for (const k of Object.values(START_ORIENTATION_TEXT)) {
      expect(k.startsWith("start.orientation.")).toBe(true);
    }
  });
});
