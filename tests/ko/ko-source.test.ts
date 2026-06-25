import { describe, expect, it } from "vitest";
import type { KoSource } from "../../apps/web/src/api/types";
import {
  EMPTY_SOURCE_FORM,
  isSourceFormValid,
  sourceBadgeKey,
  toSourcePayload,
} from "../../apps/web/src/lib/koSource";

describe("SCRUM-129 / FE-KO-07: externe Quelle (FE-Helper)", () => {
  it("verlangt ein Label (Pflicht)", () => {
    expect(isSourceFormValid(EMPTY_SOURCE_FORM)).toBe(false);
    expect(isSourceFormValid({ label: "  ", url: "", excerpt: "" })).toBe(false);
    expect(isSourceFormValid({ label: "DIN 1234", url: "", excerpt: "" })).toBe(true);
  });

  it("baut Payload und lässt leere Optionalfelder weg", () => {
    expect(toSourcePayload({ label: "  Norm  ", url: "  ", excerpt: "  " })).toEqual({
      label: "Norm",
    });
    expect(toSourcePayload({ label: "Norm", url: "https://x", excerpt: "Kap 1" })).toEqual({
      label: "Norm",
      url: "https://x",
      excerpt: "Kap 1",
    });
  });

  it("markiert externe Quellen als nicht peer-validiert", () => {
    const external: KoSource = {
      id: "s1",
      label: "x",
      url: null,
      excerpt: null,
      kind: "external",
      peerValidated: false,
      author: "a",
      at: "2026-01-01",
    };
    expect(sourceBadgeKey(external)).toBe("ko.sourceUnvalidated");
    expect(sourceBadgeKey({ peerValidated: true })).toBe("ko.sourceValidated");
  });
});
