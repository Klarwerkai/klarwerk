import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { participant } from "../../apps/web/src/lib/boardCard";

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

// SCRUM-486 (Entdichtung): Führungszeile — WELCHE zwei Beiträge. NIE eine Roh-UUID: fehlt das KO,
// kommt der neutrale „entfernt"-Hinweis statt der ID (Move C).
//
// R-1349 (Aufnahme gesamt-aufruferwaechter): Die Fälle zu `conflictLead`, `duplicateLead` und
// `BOARD_REMOVED_LABEL_KEY` sind mit diesen Bausteinen entfallen — keiner hatte einen Produktleser
// (die Boards bauen ihre Führungszeile selbst, R-0991 Nr. 8/9). `participant` liest die
// Kollisionsansicht und bleibt hier gemessen.
describe("SCRUM-486: boardCard-Führungszeile", () => {
  it("participant: echtes KO → Titel; fehlend → removed (nie die UUID)", () => {
    expect(participant(ko("K1", "Ventil entlüften"))).toEqual({
      removed: false,
      title: "Ventil entlüften",
    });
    expect(participant(null)).toEqual({ removed: true });
  });
});
