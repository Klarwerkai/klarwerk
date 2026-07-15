import { describe, expect, it } from "vitest";
import type { Conflict, KnowledgeObject, OverlapEntry } from "../../apps/web/src/api/types";
import {
  BOARD_REMOVED_LABEL_KEY,
  conflictLead,
  duplicateLead,
  participant,
} from "../../apps/web/src/lib/boardCard";

const ko = (id: string, title: string): KnowledgeObject =>
  ({
    id,
    title,
    statement: "",
    conditions: [],
    measures: [],
    type: "technik",
    category: "",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "a",
    author: "a",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-01-01",
    history: [],
  }) as KnowledgeObject;

const conflict = (p: Partial<Conflict> = {}): Conflict =>
  ({
    id: "c1",
    koA: "K1",
    koB: "K2",
    type: "truth",
    description: "Widerspruch",
    status: "offen",
    secondOpinion: null,
    decidedBy: null,
    decision: null,
    createdAt: "2026-01-01",
    ...p,
  }) as Conflict;

const overlap = (p: Partial<OverlapEntry> = {}): OverlapEntry => ({
  id: "d1",
  koA: "K1",
  koB: "K2",
  relation: "teilweise",
  aspects: [],
  eigenanteilA: "",
  eigenanteilB: "",
  recommendation: "verwandt_verlinken",
  status: "offen",
  pairKey: "dup|K1|K2",
  origin: "auto",
  createdAt: "2026-07-04T10:00:00.000Z",
  ...p,
});

// SCRUM-486 (Entdichtung): Führungszeile — WELCHE zwei Beiträge, WAS ist die Empfehlung. NIE eine
// Roh-UUID: fehlt das KO, kommt der neutrale „entfernt"-Schlüssel statt der ID (Move C).
describe("SCRUM-486: boardCard-Führungszeile", () => {
  it("participant: echtes KO → Titel; fehlend → removed (nie die UUID)", () => {
    expect(participant(ko("K1", "Ventil entlüften"))).toEqual({
      removed: false,
      title: "Ventil entlüften",
    });
    expect(participant(null)).toEqual({ removed: true });
    // Der Anzeigename für „entfernt" ist ein i18n-Schlüssel, keine ID.
    expect(BOARD_REMOVED_LABEL_KEY).toBe("board.koRemoved");
  });

  it("conflictLead: beide Titel + empfohlene nächste Handlung als con.next-Schlüssel", () => {
    const kos = [ko("K1", "Aussage A"), ko("K2", "Aussage B")];
    const lead = conflictLead(conflict({ type: "truth", status: "offen" }), kos);
    expect(lead.a).toEqual({ removed: false, title: "Aussage A" });
    expect(lead.b).toEqual({ removed: false, title: "Aussage B" });
    // truth+offen → eskalieren (gleiche Ableitung wie die Aktionsleiste).
    expect(lead.recommendedStepKey).toBe("con.next.escalate");
  });

  it("conflictLead: fehlendes KO wird zu removed (keine ID im Lead)", () => {
    const lead = conflictLead(conflict(), [ko("K1", "Nur A")]); // K2 fehlt
    expect(lead.a).toEqual({ removed: false, title: "Nur A" });
    expect(lead.b).toEqual({ removed: true });
  });

  it("duplicateLead: beide Titel + Empfehlung als dup.rec-Schlüssel", () => {
    const kos = [ko("K1", "Doppelt A"), ko("K2", "Doppelt B")];
    const lead = duplicateLead(overlap({ recommendation: "getrennt_lassen" }), kos);
    expect(lead.a).toEqual({ removed: false, title: "Doppelt A" });
    expect(lead.b).toEqual({ removed: false, title: "Doppelt B" });
    expect(lead.recommendationKey).toBe("dup.rec.getrennt_lassen");
  });
});
