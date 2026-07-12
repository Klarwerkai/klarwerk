import { describe, expect, it } from "vitest";
import {
  ISLAND_MARKER_SELECTOR,
  type IslandMarkerDocument,
  readIslandMarker,
} from "../../apps/web/src/shell/islandMarker";

function docWith(content: string | null): IslandMarkerDocument {
  return {
    head: {
      querySelector: (selector: string) => {
        expect(selector).toBe(ISLAND_MARKER_SELECTOR);
        return content === null ? null : { content };
      },
    },
  };
}

describe("KW-MAC-ISLAND-08: island marker meta reader", () => {
  it("reads the island-only marker from the CSP-safe meta tag", () => {
    expect(readIslandMarker(docWith("KW-MAC-ISLAND-03 - paket - abc12345"))).toBe(
      "KW-MAC-ISLAND-03 - paket - abc12345",
    );
  });

  it("renders nothing when the normal web build has no marker", () => {
    expect(readIslandMarker(docWith(null))).toBeUndefined();
    expect(readIslandMarker(docWith("   "))).toBeUndefined();
  });
});
