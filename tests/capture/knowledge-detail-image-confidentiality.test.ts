import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { draftProvenance } from "../../apps/web/src/lib/reasonerProvenance";

const knowledgeDetailSource = readFileSync(
  resolve(process.cwd(), "apps/web/src/pages/KnowledgeDetail.tsx"),
  "utf8",
);

describe("KnowledgeDetail Bild-Vertraulichkeit", () => {
  it("bindet die Bildbeschreibung an die geladene Dokument-Vertraulichkeit", () => {
    expect(knowledgeDetailSource).toContain(
      "<ImageDescribeProvider provenance={draftProvenance(query.data?.confidentiality, id)}>",
    );
    expect(knowledgeDetailSource).not.toContain(
      "<ImageDescribeProvider provenance={draftProvenance(undefined, id)}>",
    );
  });

  it("lässt nicht vertrauliche Dokumente frei und behält den sicheren Lade-Fallback", () => {
    expect(draftProvenance("intern", "ko-intern")).toEqual({
      source: "draft",
      confidentiality: "intern",
      koId: "ko-intern",
    });
    expect(draftProvenance(undefined, "ko-loading")).toEqual({
      source: "draft",
      confidentiality: "vertraulich",
      koId: "ko-loading",
    });
  });

  it("hält vertrauliche Dokumente weiterhin gesperrt", () => {
    expect(draftProvenance("vertraulich", "ko-secret")).toEqual({
      source: "draft",
      confidentiality: "vertraulich",
      koId: "ko-secret",
    });
  });
});
