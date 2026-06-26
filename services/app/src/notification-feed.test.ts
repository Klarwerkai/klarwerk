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
});
