import { describe, expect, it } from "vitest";
import { EMPTY_LIBRARY_FILTER, buildLibraryQuery } from "../../apps/web/src/lib/libraryQuery";

const f = (p: Partial<typeof EMPTY_LIBRARY_FILTER>) => ({ ...EMPTY_LIBRARY_FILTER, ...p });

describe("SCRUM-134: Library-Query-Builder", () => {
  it("leerer Filter → leere Query (keine Parameter)", () => {
    expect(buildLibraryQuery(EMPTY_LIBRARY_FILTER)).toEqual({});
  });

  it("trimmt Volltext und lässt leeren weg", () => {
    expect(buildLibraryQuery(f({ q: "  Ventil  " }))).toEqual({ q: "Ventil" });
    expect(buildLibraryQuery(f({ q: "   " }))).toEqual({});
  });

  it("übernimmt strukturierte Filter kombiniert", () => {
    expect(
      buildLibraryQuery(
        f({ q: "druck", type: "technik", status: "validiert", category: "Qualität", tag: "Pumpe" }),
      ),
    ).toEqual({
      q: "druck",
      type: "technik",
      status: "validiert",
      category: "Qualität",
      tag: "Pumpe",
    });
  });

  it("lässt nicht gesetzte Felder weg", () => {
    expect(buildLibraryQuery(f({ type: "technik", tag: "Pumpe" }))).toEqual({
      type: "technik",
      tag: "Pumpe",
    });
  });
});
