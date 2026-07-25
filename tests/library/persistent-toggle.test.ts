// AUFTRAG-uxpol5 · Punkt 2/3: der DOM-freie localStorage-Helfer für persistente Auf-/Zu-Zustände.
// Gepinnt: fehlender Schlüssel (null) ist vom Wert „zu" (false) unterscheidbar (Erststart-Erkennung),
// Schreiben/Lesen ist fehlertolerant (kaputter/verweigerter Speicher → Fallback bzw. stilles No-op).
import { describe, expect, it } from "vitest";
import {
  readStoredBool,
  safeLocalStorage,
  writeStoredBool,
} from "../../apps/web/src/lib/persistentToggle";

function fakeStorage(): Pick<Storage, "getItem" | "setItem"> & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  return {
    raw,
    getItem: (k) => raw.get(k) ?? null,
    setItem: (k, v) => {
      raw.set(k, v);
    },
  };
}

describe("uxpol5: persistentToggle — persistente Auf-/Zu-Zustände (pro Browser)", () => {
  it("fehlender Schlüssel → null (Erststart), nicht false", () => {
    const s = fakeStorage();
    expect(readStoredBool(s, "k")).toBeNull();
  });

  it("schreibt/liest true und false round-trip", () => {
    const s = fakeStorage();
    writeStoredBool(s, "k", true);
    expect(readStoredBool(s, "k")).toBe(true);
    writeStoredBool(s, "k", false);
    expect(readStoredBool(s, "k")).toBe(false);
  });

  it("kein Speicher (undefined) → Lesen null, Schreiben ist ein stilles No-op", () => {
    expect(readStoredBool(undefined, "k")).toBeNull();
    expect(() => writeStoredBool(undefined, "k", true)).not.toThrow();
  });

  it("verweigerter Speicher (getItem/setItem werfen) → Fallback bzw. still, kein Crash", () => {
    const throwing: Pick<Storage, "getItem" | "setItem"> = {
      getItem: () => {
        throw new Error("blockiert");
      },
      setItem: () => {
        throw new Error("voll");
      },
    };
    expect(readStoredBool(throwing, "k")).toBeNull();
    expect(() => writeStoredBool(throwing, "k", true)).not.toThrow();
  });

  // AUFTRAG-uxpol6 (bens GELB 2.2): schon das ERMITTELN von localStorage ist eine fehlerfähige
  // Grenze — ein werfender GETTER (Browser-/Origin-Policy) liefert „kein Speicher", keinen Crash.
  it("safeLocalStorage: werfender localStorage-GETTER → undefined (kein Crash)", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("Speicherzugriff durch Policy blockiert");
      },
    });
    try {
      expect(safeLocalStorage()).toBeUndefined();
    } finally {
      if (original) {
        Object.defineProperty(globalThis, "localStorage", original);
      } else {
        Reflect.deleteProperty(globalThis, "localStorage");
      }
    }
  });
});
