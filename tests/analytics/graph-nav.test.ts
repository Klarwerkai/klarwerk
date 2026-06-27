import { describe, expect, it } from "vitest";
import { isNavigableNode, koDetailPath } from "../../apps/web/src/lib/graphNav";

describe("SCRUM-228: graphNav", () => {
  it("koDetailPath baut die /wissen/:id-Route und kodiert die ID", () => {
    expect(koDetailPath("ko-1")).toBe("/wissen/ko-1");
    expect(koDetailPath("a/b?x")).toBe("/wissen/a%2Fb%3Fx");
  });

  it("isNavigableNode nur bei bekanntem KO im Bestand", () => {
    const known = new Set(["ko-1", "ko-2"]);
    expect(isNavigableNode("ko-1", known)).toBe(true);
    expect(isNavigableNode("ghost", known)).toBe(false);
  });

  it("leerer Bestand → kein Knoten navigierbar (sicher deaktiviert)", () => {
    expect(isNavigableNode("ko-1", new Set())).toBe(false);
  });
});
