// AUFTRAG-uxpol5 · Punkt 1: Die rohe „Status"-Facette ist ein reines Relabeling der „Reife" (beide aus
// demselben deriveStatus(ko) ohne Flags, bijektiv). Die Filterzeile ist entfernt; foldStatusIntoMaturity
// faltet eine (alte, gespeicherte) Status-Auswahl treffermengentreu auf die sichtbare Reife-Dimension,
// damit nichts „versteckt aktiv" filtert. Diese Suite pinnt die Faltung inkl. Schnittmenge/No-Match.
import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import {
  FACET_NO_MATCH_SELECTION,
  applyFacetSelection,
  isFacetNoMatch,
} from "../../apps/web/src/lib/facets";
import { STATUS_TO_MATURITY, foldStatusIntoMaturity } from "../../apps/web/src/lib/libraryFacets";
import { libraryMaturity } from "../../apps/web/src/lib/libraryMaturity";

function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko",
    title: "Ventil entlasten",
    status: "offen",
    assignments: [],
    trust: 0,
    category: "Anlage 1",
    author: "u1",
    createdAt: "2026-07-20T00:00:00.000Z",
    sources: [],
    attachments: [],
    version: 1,
    ...overrides,
  } as unknown as KnowledgeObject;
}

// Reife-Werte je KO für die anschließende Treffermengen-Gegenprobe (dieselbe Ableitung wie die Seite).
function maturityValues(k: KnowledgeObject): { maturity: string[] } {
  return { maturity: [libraryMaturity(k).usability] };
}

describe("uxpol5: STATUS_TO_MATURITY spiegelt die Bijektion aus koOverview.usabilityOf", () => {
  it("die drei erreichbaren Anzeigestatus bilden 1:1 auf die Reifegrade ab", () => {
    expect(STATUS_TO_MATURITY.offen).toBe("needs-work");
    expect(STATUS_TO_MATURITY.pruefung).toBe("in-review");
    expect(STATUS_TO_MATURITY.validiert).toBe("ready");
  });

  it("belegt am echten KO, dass Status und Reife dieselbe Ableitung teilen (kein zweiter Filter)", () => {
    // offen (unzugewiesen) → Status „offen" ↔ Reife „needs-work"
    expect(libraryMaturity(ko({ status: "offen", assignments: [] })).usability).toBe("needs-work");
    // offen + Zuweisung → Status „pruefung" ↔ Reife „in-review"
    expect(libraryMaturity(ko({ status: "offen", assignments: ["u2"] })).usability).toBe(
      "in-review",
    );
    // validiert → Status „validiert" ↔ Reife „ready"
    expect(libraryMaturity(ko({ status: "validiert" })).usability).toBe("ready");
  });
});

describe("uxpol5: foldStatusIntoMaturity — treffermengentreue Faltung Status → Reife", () => {
  it("ohne Status-Schlüssel bleibt die Auswahl unverändert (identische Referenz)", () => {
    const sel = { category: ["Anlage 1"] };
    expect(foldStatusIntoMaturity(sel)).toBe(sel);
  });

  it("reine Status-Auswahl wird zur äquivalenten Reife-Auswahl (Status-Schlüssel entfällt)", () => {
    const folded = foldStatusIntoMaturity({ status: ["offen", "pruefung"] });
    expect(folded.status).toBeUndefined();
    expect(folded.maturity).toEqual(["needs-work", "in-review"]);
  });

  it("dedupliziert, wenn mehrere Status auf denselben Reifegrad fallen", () => {
    const folded = foldStatusIntoMaturity({ status: ["pruefung", "revalidierung"] });
    expect(folded.maturity).toEqual(["in-review"]);
  });

  it("gleichgerichtete Status+Reife-Wahl ⇒ Schnittmenge (unverändert sichtbar)", () => {
    const folded = foldStatusIntoMaturity({ status: ["validiert"], maturity: ["ready"] });
    expect(folded.maturity).toEqual(["ready"]);
    expect(folded.status).toBeUndefined();
  });

  it("widersprüchliche Status+Reife-Wahl ⇒ leere Schnittmenge ⇒ strukturelles No-Match", () => {
    const folded = foldStatusIntoMaturity({ status: ["offen"], maturity: ["ready"] });
    expect(isFacetNoMatch(folded.maturity)).toBe(true);
    expect(folded.maturity).toEqual(FACET_NO_MATCH_SELECTION);
  });

  it("No-Match auf der Status-Seite bleibt No-Match (bedingungslos 0 Treffer)", () => {
    const folded = foldStatusIntoMaturity({ status: FACET_NO_MATCH_SELECTION });
    expect(isFacetNoMatch(folded.maturity)).toBe(true);
    const items = [maturityValues(ko({ status: "validiert" })), maturityValues(ko({}))];
    expect(applyFacetSelection(items, (v) => v, folded)).toEqual([]);
  });

  it("No-Match einer vorhandenen Reife-Wahl überlebt die Faltung", () => {
    const folded = foldStatusIntoMaturity({
      status: ["offen"],
      maturity: FACET_NO_MATCH_SELECTION,
    });
    expect(isFacetNoMatch(folded.maturity)).toBe(true);
  });

  it("GEGENPROBE Treffermenge: gefaltete Status-Sicht zeigt exakt dieselben KOs wie zuvor", () => {
    const validated = ko({ id: "v", status: "validiert" });
    const open = ko({ id: "o", status: "offen", assignments: [] });
    const assigned = ko({ id: "a", status: "offen", assignments: ["u2"] });
    const items = [validated, open, assigned].map(maturityValues);
    // Alte Sicht: Status ∈ {offen, pruefung} (offen + zugewiesen). Nach der Faltung: Reife ∈
    // {needs-work, in-review} → offen + zugewiesen sichtbar, validiert nicht.
    const folded = foldStatusIntoMaturity({ status: ["offen", "pruefung"] });
    const shown = applyFacetSelection(items, (v) => v, folded);
    expect(shown).toEqual([items[1], items[2]]);
  });
});
