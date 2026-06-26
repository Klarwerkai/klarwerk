import { describe, expect, it } from "vitest";
import type { ExternalResult } from "../../apps/web/src/api/types";
import { isAttachable, toSourcePayload } from "../../apps/web/src/lib/externalSearch";

const result = (over: Partial<ExternalResult> = {}): ExternalResult => ({
  title: "Druckbehälter",
  url: "https://de.wikipedia.org/wiki/Druckbeh%C3%A4lter",
  snippet: "Ein Behälter unter Druck.",
  provider: "Wikipedia",
  ...over,
});

describe("SCRUM-118 / FR-EXT-02: externalSearch-Mapping", () => {
  it("mappt ExternalResult auf das add-source-Payload (label/url/excerpt/provider)", () => {
    expect(toSourcePayload(result())).toEqual({
      label: "Druckbehälter",
      url: "https://de.wikipedia.org/wiki/Druckbeh%C3%A4lter",
      excerpt: "Ein Behälter unter Druck.",
      provider: "Wikipedia",
    });
  });

  it("trimmt und begrenzt den Excerpt auf 300 Zeichen", () => {
    const long = "x".repeat(500);
    expect(toSourcePayload(result({ snippet: `  ${long}  ` })).excerpt).toHaveLength(300);
  });

  it("isAttachable: nur mit nicht-leerem Titel", () => {
    expect(isAttachable(result())).toBe(true);
    expect(isAttachable(result({ title: "   " }))).toBe(false);
  });
});
