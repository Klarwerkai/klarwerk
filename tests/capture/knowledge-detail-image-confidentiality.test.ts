import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { draftProvenance } from "../../apps/web/src/lib/reasonerProvenance";

const knowledgeDetailSource = readFileSync(
  // JOB 3063 (H4): die Leseansicht des Wissensobjekts ist die Lesefläche der Bibliothek geworden.
  resolve(process.cwd(), "apps/web/src/components/bibliothek/BibliothekLesen.tsx"),
  "utf8",
);

describe("KnowledgeDetail Bild-Vertraulichkeit", () => {
  it("bindet die Bildbeschreibung an die geladene Dokument-Vertraulichkeit", () => {
    // JOB 3063 (H4): die Fläche rendert die Leseansicht erst, WENN das Wissensobjekt da ist
    // (`if (!ko) return …` darüber) — die Stufe kommt deshalb direkt vom geladenen Objekt statt
    // über `query.data?.…`. Der fail-safe Lade-Fallback bleibt: bis dahin steht überhaupt kein
    // Provider und damit auch kein Bildbeschreibungs-Weg.
    expect(knowledgeDetailSource).toContain(
      "<ImageDescribeProvider provenance={draftProvenance(ko.confidentiality, koId)}>",
    );
    expect(knowledgeDetailSource).not.toContain(
      "<ImageDescribeProvider provenance={draftProvenance(undefined,",
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
