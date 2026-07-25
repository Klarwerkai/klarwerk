import { describe, expect, it } from "vitest";
import {
  type HasData,
  groupLoadPhase,
  isGroupError,
  isGroupLoaded,
  isGroupLoading,
  isGroupStale,
} from "../../apps/web/src/lib/loadingState";

// AUFTRAG-mega3 Block B (bens D9): der gemeinsame Ladevertrag kennt die dritte Phase „error" und den
// Stale-Sonderfall. DOM-frei, im Node-Gate. Modelliert die react-query-Signale (v5):
//   initialer Fehler → status "error", data undefined (isError true, keine Daten)
//   Refetch-Fehler   → status "error", data BLEIBT erhalten (isError true, Daten vorhanden) ⇒ stale
const pending: HasData = { data: undefined };
const ready = (v: unknown): HasData => ({ data: v });
const initialError: HasData = { data: undefined, isError: true };
const refetchError = (v: unknown): HasData => ({ data: v, isError: true });

describe("Block B: loadingState — loading | loaded | error + stale", () => {
  it("alle Quellen mit Daten ⇒ loaded", () => {
    expect(groupLoadPhase([ready([]), ready(0)])).toBe("loaded");
    expect(isGroupLoaded([ready([]), ready(0)])).toBe(true);
  });

  it("noch keine Daten, kein Fehler ⇒ loading (nicht error)", () => {
    expect(groupLoadPhase([ready([]), pending])).toBe("loading");
    expect(isGroupLoading([ready([]), pending])).toBe(true);
    expect(isGroupError([ready([]), pending])).toBe(false);
  });

  it("eine gescheiterte Quelle OHNE Daten ⇒ error (kein endloses loading)", () => {
    expect(groupLoadPhase([ready([]), initialError])).toBe("error");
    expect(isGroupError([ready([]), initialError])).toBe(true);
    // NICHT mehr als loading dargestellt.
    expect(isGroupLoading([ready([]), initialError])).toBe(false);
  });

  it("Stale: alle Daten da, aber ein Refetch scheiterte ⇒ loaded UND stale (kein Sturz in error)", () => {
    const sources = [ready([1]), refetchError([2])];
    expect(groupLoadPhase(sources)).toBe("loaded");
    expect(isGroupError(sources)).toBe(false);
    expect(isGroupStale(sources)).toBe(true);
  });

  it("kein Refetch-Fehler ⇒ nicht stale", () => {
    expect(isGroupStale([ready([1]), ready([2])])).toBe(false);
  });
});
