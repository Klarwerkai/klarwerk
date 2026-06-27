import { describe, expect, it } from "vitest";
import {
  evidenceFreshnessLabelKey,
  evidenceFreshnessTone,
} from "../../apps/web/src/lib/evidenceFreshnessView";

describe("SCRUM-175: evidenceFreshnessView", () => {
  it("current → pos-Ton", () => {
    expect(evidenceFreshnessTone("current")).toBe("pos");
  });

  it("outdated → warn-Ton", () => {
    expect(evidenceFreshnessTone("outdated")).toBe("warn");
  });

  it("missing → warn-Ton", () => {
    expect(evidenceFreshnessTone("missing")).toBe("warn");
  });

  it("neutral → neutral-Ton", () => {
    expect(evidenceFreshnessTone("neutral")).toBe("neutral");
  });

  it("Label-Key folgt ko.evFresh.<status>", () => {
    expect(evidenceFreshnessLabelKey("current")).toBe("ko.evFresh.current");
    expect(evidenceFreshnessLabelKey("outdated")).toBe("ko.evFresh.outdated");
    expect(evidenceFreshnessLabelKey("missing")).toBe("ko.evFresh.missing");
    expect(evidenceFreshnessLabelKey("neutral")).toBe("ko.evFresh.neutral");
  });
});
