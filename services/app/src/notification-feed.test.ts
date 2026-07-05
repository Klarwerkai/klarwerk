import { describe, expect, it } from "vitest";
import { buildNotifications } from "./notification-feed";

describe("buildNotifications", () => {
  it("aggregiert Konflikte und offene Lücken, neueste zuerst, geschlossene Lücken nicht", () => {
    const items = buildNotifications({
      conflicts: [
        {
          id: "c1",
          koA: "a",
          koB: "b",
          type: "truth",
          description: "Konflikt X",
          status: "eskaliert",
          secondOpinion: null,
          decidedBy: null,
          decision: null,
          createdAt: "2026-06-01T00:00:00Z",
        },
      ],
      gaps: [
        {
          id: "g1",
          question: "Frage?",
          status: "offen",
          assignee: null,
          priority: "mittel",
          createdAt: "2026-06-04T00:00:00Z",
        },
        {
          id: "g2",
          question: "Zu?",
          status: "geschlossen",
          assignee: null,
          priority: "mittel",
          createdAt: "2026-06-05T00:00:00Z",
        },
      ],
    });

    expect(items.map((i) => i.id)).toEqual(["gap-g1", "con-c1"]);
    expect(items.some((i) => i.id === "gap-g2")).toBe(false);
  });

  it("SCRUM-363: persönliche offene Zuweisungen erscheinen als eigene Kategorie (mit koId)", () => {
    const items = buildNotifications({
      conflicts: [],
      gaps: [],
      assignments: [
        { koId: "ko-7", title: "Presse P2 entlüften", at: "2026-06-10T00:00:00Z" },
        { koId: "ko-9", title: "Lager schmieren", at: "2026-06-02T00:00:00Z" },
      ],
    });

    expect(items.map((i) => i.id)).toEqual(["assign-ko-7", "assign-ko-9"]); // neueste zuerst
    expect(items.every((i) => i.kind === "assignment")).toBe(true);
    expect(items[0]).toMatchObject({
      kind: "assignment",
      title: "Presse P2 entlüften",
      koId: "ko-7",
    });
  });

  it("SCRUM-363: Zuweisungen mischen sich zeitlich mit Konflikten/Lücken; ohne assignments unverändert", () => {
    const withAssign = buildNotifications({
      conflicts: [
        {
          id: "c1",
          koA: "a",
          koB: "b",
          type: "truth",
          description: "Konflikt X",
          status: "offen",
          secondOpinion: null,
          decidedBy: null,
          decision: null,
          createdAt: "2026-06-01T00:00:00Z",
        },
      ],
      gaps: [],
      assignments: [{ koId: "ko-7", title: "Review-KO", at: "2026-06-09T00:00:00Z" }],
    });
    expect(withAssign.map((i) => i.id)).toEqual(["assign-ko-7", "con-c1"]);

    // Ohne assignments-Feld bleibt das Verhalten exakt wie zuvor (Rückwärtskompatibilität).
    const noAssign = buildNotifications({ conflicts: [], gaps: [] });
    expect(noAssign).toEqual([]);
  });

  it("Pedi 04.07.: offene Überschneidungen erscheinen als Duplikat-Benachrichtigung (Modell-Begründung als Titel)", () => {
    const items = buildNotifications({
      conflicts: [],
      gaps: [],
      overlaps: [
        {
          id: "o1",
          koA: "a",
          koB: "b",
          relation: "teilweise",
          aspects: [],
          eigenanteilA: "",
          eigenanteilB: "",
          recommendation: "zusammenfuehren_pruefen",
          status: "offen",
          pairKey: "dup|ko:a|ko:b",
          origin: "auto",
          detector: {
            trigger: "validation",
            method: "model",
            lexicalScore: 0.5,
            confidence: 0.88,
            rationale: "Beide beschreiben dieselbe Wartung.",
          },
          createdAt: "2026-06-07T00:00:00Z",
        },
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "dup-o1",
      kind: "duplicate",
      title: "Beide beschreiben dieselbe Wartung.",
    });
  });

  it("deterministischer (textgleicher) Fund ohne Begründung → Fallback-Titel", () => {
    const items = buildNotifications({
      conflicts: [],
      gaps: [],
      overlaps: [
        {
          id: "o2",
          koA: "a",
          koB: "b",
          relation: "identisch",
          aspects: [],
          eigenanteilA: "",
          eigenanteilB: "",
          recommendation: "zusammenfuehren",
          status: "offen",
          pairKey: "dup|ko:a|ko:b",
          origin: "auto",
          detector: { trigger: "validation", method: "deterministic", lexicalScore: 0.92 },
          createdAt: "2026-06-07T00:00:00Z",
        },
      ],
    });
    expect(items[0]?.title).toBe("Zwei Beiträge überschneiden sich stark.");
  });
});
