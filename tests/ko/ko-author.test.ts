import { describe, expect, it } from "vitest";
import { koAuthorParts } from "../../apps/web/src/lib/koAuthor";

const nameOf = (id: string): string => ({ "u-1": "Anna Berg", "u-2": "Carl Diem" })[id] ?? id;

describe("SCRUM-70 / FR-LIF-04: koAuthorParts", () => {
  it("nur aktueller Autor, wenn kein Transfer (originalAuthor == author)", () => {
    expect(koAuthorParts({ author: "u-1", originalAuthor: "u-1" }, nameOf)).toEqual({
      author: "Anna Berg",
    });
    expect(koAuthorParts({ author: "u-1" }, nameOf)).toEqual({ author: "Anna Berg" });
  });

  it("aktueller + Originalautor bei Transfer (abweichend)", () => {
    expect(koAuthorParts({ author: "u-2", originalAuthor: "u-1" }, nameOf)).toEqual({
      author: "Carl Diem",
      originalAuthor: "Anna Berg",
    });
  });

  it("fällt auf die ID zurück, wenn der Directory-Name fehlt", () => {
    expect(koAuthorParts({ author: "u-9", originalAuthor: "u-1" }, nameOf)).toEqual({
      author: "u-9",
      originalAuthor: "Anna Berg",
    });
    // ganz ohne Resolver: ID bleibt ID
    expect(koAuthorParts({ author: "u-1", originalAuthor: "u-2" })).toEqual({
      author: "u-1",
      originalAuthor: "u-2",
    });
  });
});
