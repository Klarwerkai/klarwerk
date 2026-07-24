import { describe, expect, it } from "vitest";
import { redactGapForViewer, summarizeGaps } from "./gap-visibility";
import type { Gap } from "./types";

// FUNKE-FIX2 P0 (bens Blocker Gap-Freitext): adressatengerechte Freitext-Sichtbarkeit + rein
// aggregierte Zähler.
function gap(over: Partial<Gap> = {}): Gap {
  return {
    id: "g1",
    question: "Wie kalibriere ich Aggregat ZZZ?",
    status: "offen",
    assignee: null,
    priority: "mittel",
    createdAt: "2026-07-24T10:00:00.000Z",
    ...over,
  };
}

describe("redactGapForViewer", () => {
  it("Detail-Rolle (maySeeDetail) → Volltext, kein createdBy im Output", () => {
    const view = redactGapForViewer(gap({ createdBy: "anna" }), {
      viewerId: "controller-x",
      maySeeDetail: true,
    });
    expect(view.question).toBe("Wie kalibriere ich Aggregat ZZZ?");
    expect(view.redacted).toBeUndefined();
    expect("createdBy" in view).toBe(false);
  });

  it("Ersteller/Owner → Volltext", () => {
    const view = redactGapForViewer(gap({ createdBy: "vera" }), {
      viewerId: "vera",
      maySeeDetail: false,
    });
    expect(view.question).toBe("Wie kalibriere ich Aggregat ZZZ?");
    expect(view.redacted).toBeUndefined();
  });

  it("Assignee → Volltext", () => {
    const view = redactGapForViewer(gap({ assignee: "tom" }), {
      viewerId: "tom",
      maySeeDetail: false,
    });
    expect(view.question).toBe("Wie kalibriere ich Aggregat ZZZ?");
  });

  it("Unberechtigter → redigiert (kein Fragetext, redacted-Marker, kein createdBy)", () => {
    const view = redactGapForViewer(gap({ createdBy: "vera", assignee: "tom" }), {
      viewerId: "fremd",
      maySeeDetail: false,
    });
    expect(view.question).toBe("");
    expect(view.redacted).toBe(true);
    expect("createdBy" in view).toBe(false);
    // Neutrale Metadaten bleiben (Priorität/Status/Zeit/Assignee) — nur der Freitext ist weg.
    expect(view.priority).toBe("mittel");
    expect(view.status).toBe("offen");
    expect(view.assignee).toBe("tom");
  });

  it("fail-closed: ohne createdBy/assignee und ohne Detail-Rolle → redigiert", () => {
    const view = redactGapForViewer(gap(), { viewerId: "irgendwer", maySeeDetail: false });
    expect(view.redacted).toBe(true);
    expect(view.question).toBe("");
  });
});

describe("summarizeGaps", () => {
  it("zählt nur offene Lücken, gruppiert nach Priorität, ohne Fragetext", () => {
    const summary = summarizeGaps([
      gap({ id: "a", status: "offen", priority: "hoch" }),
      gap({ id: "b", status: "offen", priority: "hoch" }),
      gap({ id: "c", status: "offen", priority: "niedrig" }),
      gap({ id: "d", status: "geschlossen", priority: "hoch" }),
    ]);
    expect(summary).toEqual({ open: 3, byPriority: { hoch: 2, mittel: 0, niedrig: 1 } });
    // Der Summary-Typ trägt strukturell keinen Fragetext.
    expect(JSON.stringify(summary)).not.toContain("kalibriere");
  });
});
