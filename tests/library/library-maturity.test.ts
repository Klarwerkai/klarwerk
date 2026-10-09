import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { libraryMaturity } from "../../apps/web/src/lib/libraryMaturity";

function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Titel",
    statement: "Aussage",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 50,
    trust: 50,
    status: "offen",
    version: 1,
    originalAuthor: "u-1",
    author: "u-1",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-06-26T10:00:00.000Z",
    history: [],
    ...overrides,
  };
}

// SCRUM-262: Reife/Nutzbarkeit je Treffer ehrlich aus dem KO ableiten.
describe("SCRUM-262: libraryMaturity", () => {
  // SCRUM-293: Labels kommen jetzt aus der geteilten Use-Readiness-Sprache (use.*), identisch zu KO-Detail.
  it("validiertes KO → nutzbar (pos)", () => {
    const m = libraryMaturity(ko({ status: "validiert", trust: 100 }));
    expect(m.usability).toBe("ready");
    expect(m.labelKey).toBe("use.ready.label");
    expect(m.tone).toBe("pos");
  });

  it("zugewiesenes offenes KO → in Prüfung (warn)", () => {
    const m = libraryMaturity(ko({ status: "offen", assignments: ["u-2"] }));
    expect(m.usability).toBe("in-review");
    expect(m.labelKey).toBe("use.review.label");
    expect(m.tone).toBe("warn");
  });

  it("offenes KO → zu prüfen (neutral) und NIE nutzbar", () => {
    const m = libraryMaturity(ko({ status: "offen", assignments: [] }));
    expect(m.usability).toBe("needs-work");
    expect(m.labelKey).toBe("use.open.label");
    expect(m.labelKey).not.toBe("use.ready.label");
  });
});

// R-1349 (Aufnahme gesamt-aufruferwaechter): Der Block zum SCRUM-267-Reifefilter
// (`MATURITY_FILTERS`, `filterByMaturity`, `countByMaturity`, `maturityFilterLabelKey`) ist mit den
// Bausteinen entfallen — keiner hatte einen Produktleser. Die Reife filtert die Bibliothek als
// Facette (`lib/libraryFacets.ts`); gemessen in `tests/library/library-facets.test.ts`.

// ================================================================================================
// SCRUM-288 IST ABGELÖST (JOB 3063 · H4, Runde 5) — HIER STAND DER ALTE FRAGEN-VERTRAG.
// ================================================================================================
//
// An dieser Stelle prüften drei Fälle `libraryUseCta`: „nur validiertes Wissen führt in den
// Ask-Weg; offen und in Prüfung führen unter der Beschriftung ‚Prüfen‘ nach /validierung."
//
// PEDIS VORGABE VOM 04.09. (Auftrag §5.3/§5a) kehrt das um: auf der Lesefläche trägt JEDER gewählte
// Eintrag dieselbe verbindliche Aktion „Fragen", und sie führt nach `/fragen` MIT dem Bezug auf
// genau diesen Eintrag (`ko=<id>`). Wer prüfen will, findet „Validieren" im Menü „…" am Eintrag.
// Die drei Fälle wurden deshalb nicht umgeschrieben, sondern GESTRICHEN: sie pinnten eine Zusage,
// die das Produkt nicht mehr gibt.
//
// WO DER HEUTIGE VERTRAG GEMESSEN WIRD: `tests/library/h4-fragen-vertrag-mounted.test.tsx` (alle
// drei Anzeigezustände an der gemounteten Fläche) und F13 in
// `tests/design/h4-funktionsinventar.test.ts` (die zwei über die echte Schnittstelle erreichbaren
// Zustände, in Chromium am gebauten Stand).
//
// `libraryUseCta` lag danach ohne Produktaufrufer in `apps/web/src/lib/libraryMaturity.ts` und stand
// im Register `ERSETZT_JOB3063` des Aufrufer-Wächters; mit R-1349 ist sie entfernt.
