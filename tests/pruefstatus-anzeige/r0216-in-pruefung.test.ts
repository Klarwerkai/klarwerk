// ================================================================================================
// PRÜFSTATUS-ANZEIGE (R-0216) · OFFENER WIDERSPRUCH → „IN PRÜFUNG", IN BIBLIOTHEK UND ANTWORTEN.
// ================================================================================================
//
// Zielzustand: „Ein Wissensobjekt mit offenem Widerspruch erscheint nicht mehr als uneingeschränkt
// nutzbar, sondern als ‚in Prüfung' — in der Detailansicht, in der Bibliothek und in Antworten
// gleichermaßen."
//
// ZWEI WEGE, AUF DENEN DER KONFLIKT ANKOMMT, und beide müssen dieselbe Wirkung haben:
//   · die Konfliktliste der Fläche (`useConflicts` → `conflictLimitedUsability`, SCRUM-357);
//   · seit R-0212 der Anzeigestatus des Servers (`anzeigestatus: "konflikt"`).
// Diese Datei prüft Bibliothek (Reife/Facette) und Antworten (Quellen-Nutzbarkeit); die montierte
// Detailansicht prüft `r0216-detail.test.tsx`. Die Wortwahl ist überall `use.review.label`.
//
// ABGRENZUNG ZU R-1003: das STATUSWORT bleibt „Konflikt" (einer der sieben Anzeigezustände). „In
// Prüfung" ist die NUTZBARKEIT — die Antwort auf „kann ich das verwenden?". Beides steht da.
import { describe, expect, it } from "vitest";
import type { Conflict, KnowledgeObject } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { conflictAwareSourceRefs } from "../../apps/web/src/lib/askView";
import { koOverview } from "../../apps/web/src/lib/koOverview";
import { libraryMaturity } from "../../apps/web/src/lib/libraryMaturity";
import { useReadiness } from "../../apps/web/src/lib/useReadiness";

function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "k1",
    title: "Ventil X bei Überdruck schließen",
    statement: "Aussage",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 80,
    trust: 80,
    status: "validiert",
    version: 1,
    originalAuthor: "u9",
    author: "u9",
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-07-20T00:00:00.000Z",
    history: [],
    ...overrides,
  } as KnowledgeObject;
}

const OFFENER_KONFLIKT = {
  id: "c1",
  koA: "k1",
  koB: "k9",
  type: "truth",
  status: "offen",
} as unknown as Conflict;

const label = (usability: Parameters<typeof useReadiness>[0]): string =>
  i18n.t(useReadiness(usability).labelKey, { lng: "de" }) as string;

describe("R-0216 · validiert + offener Widerspruch ist nicht mehr „nutzbar“", () => {
  it("Kalibrierung: ohne Konflikt ist ein validiertes Objekt nutzbar", () => {
    expect(libraryMaturity(ko({})).usability).toBe("ready");
    expect(conflictAwareSourceRefs(["k1"], [ko({})], [])[0]?.usability).toBe("ready");
  });

  it("Bibliothek, Konflikt vom SERVER: Reife „In Prüfung“", () => {
    const k = ko({ anzeigestatus: "konflikt" });
    expect(koOverview(k).usability).toBe("in-review");
    expect(libraryMaturity(k).usability).toBe("in-review");
    expect(label(libraryMaturity(k).usability)).toBe("In Prüfung");
  });

  it("Antworten, Konflikt vom SERVER: die Quelle ist „In Prüfung“", () => {
    const [ref] = conflictAwareSourceRefs(["k1"], [ko({ anzeigestatus: "konflikt" })], []);
    expect(ref?.usability).toBe("in-review");
  });

  it("Antworten, Konflikt aus der KONFLIKTLISTE der Fläche: dieselbe Wirkung", () => {
    const [ref] = conflictAwareSourceRefs(["k1"], [ko({})], [OFFENER_KONFLIKT]);
    expect(ref?.usability).toBe("in-review");
    expect(ref?.conflictLimited).toBe(true);
  });

  it("ein OFFENES Objekt mit Konflikt bleibt „zu prüfen“ — es war nie nutzbar", () => {
    const k = ko({ status: "offen", trust: 0, confidence: 0, anzeigestatus: "konflikt" });
    expect(koOverview(k).usability).toBe("needs-work");
    expect(
      conflictAwareSourceRefs(["k1"], [ko({ status: "offen" })], [OFFENER_KONFLIKT])[0]?.usability,
    ).toBe("needs-work");
  });
});
