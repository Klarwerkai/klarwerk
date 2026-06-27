import { describe, expect, it } from "vitest";
import type { OutputSource } from "../../apps/web/src/api/types";
import {
  buildCompositionPreview,
  moveInOrder,
  sanitizeOrder,
} from "../../apps/web/src/lib/outputComposition";

function src(overrides: Partial<OutputSource>): OutputSource {
  return {
    id: "K1",
    title: "KO Eins",
    status: "validiert",
    trust: 80,
    version: 1,
    category: "Anlage 1",
    type: "best_practice",
    ...overrides,
  };
}

describe("SCRUM-226: outputComposition", () => {
  it("sanitizeOrder behält die NUTZER-Reihenfolge und verwirft Unbekanntes/Dubletten", () => {
    expect(sanitizeOrder(["K3", "K1", "K1", "X"], ["K1", "K2", "K3"])).toEqual(["K3", "K1"]);
  });

  it("moveInOrder schiebt nach oben/unten und bleibt an den Rändern stabil", () => {
    expect(moveInOrder(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(moveInOrder(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveInOrder(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]); // oberster: no-op
    expect(moveInOrder(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]); // unterster: no-op
  });

  it("buildCompositionPreview erhält die Reihenfolge und zählt Quellen", () => {
    const preview = buildCompositionPreview({
      kind: "instruction",
      orderedIds: ["K2", "K1"],
      sources: [src({ id: "K1" }), src({ id: "K2", title: "KO Zwei" })],
    });
    expect(preview.kind).toBe("instruction");
    expect(preview.items.map((i) => i.id)).toEqual(["K2", "K1"]);
    expect(preview.sourceCount).toBe(2);
  });

  it("markiert Bausteine mit Trust < 60 als unsicher und zählt sie", () => {
    const preview = buildCompositionPreview({
      kind: "checklist",
      orderedIds: ["K1", "K2"],
      sources: [src({ id: "K1", trust: 55 }), src({ id: "K2", trust: 60 })],
    });
    expect(preview.items[0]?.uncertain).toBe(true);
    expect(preview.items[1]?.uncertain).toBe(false);
    expect(preview.uncertainCount).toBe(1);
  });

  it("ignoriert IDs ohne passende Quelle", () => {
    const preview = buildCompositionPreview({
      kind: "training",
      orderedIds: ["K1", "ghost"],
      sources: [src({ id: "K1" })],
    });
    expect(preview.items.map((i) => i.id)).toEqual(["K1"]);
    expect(preview.sourceCount).toBe(1);
  });
});
