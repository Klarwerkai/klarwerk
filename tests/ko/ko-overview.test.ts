import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { koOverview } from "../../apps/web/src/lib/koOverview";

function ko(o: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko-1",
    title: "KO",
    statement: "S",
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
    sources: [],
    attachments: [],
    ...o,
  };
}

describe("SCRUM-251: koOverview", () => {
  it("validiertes KO → ready, nächste Handlung 'use'", () => {
    const o = koOverview(ko({ status: "validiert", trust: 100, version: 2 }));
    expect(o.usability).toBe("ready");
    expect(o.status).toBe("validiert");
    expect(o.trust).toBe(100);
    expect(o.version).toBe(2);
    expect(o.nextAction).toBe("use");
  });

  it("zugewiesenes KO (in Prüfung) → in-review, nächste Handlung 'review'", () => {
    const o = koOverview(ko({ status: "offen", assignments: ["u-2"] }));
    expect(o.status).toBe("pruefung");
    expect(o.usability).toBe("in-review");
    expect(o.nextAction).toBe("review");
  });

  it("offen ohne Belege → needs-work, nächste Handlung 'addSource'", () => {
    const o = koOverview(ko({ status: "offen", sources: [], attachments: [] }));
    expect(o.usability).toBe("needs-work");
    expect(o.hasEvidence).toBe(false);
    expect(o.nextAction).toBe("addSource");
  });

  it("offen MIT Beleg → needs-work, nächste Handlung 'validate'", () => {
    const o = koOverview(
      ko({
        status: "offen",
        sources: [
          {
            id: "s1",
            label: "Q",
            url: null,
            excerpt: null,
            kind: "external",
            peerValidated: false,
            author: "u-1",
            at: "x",
          },
        ],
      }),
    );
    expect(o.hasEvidence).toBe(true);
    expect(o.nextAction).toBe("validate");
  });

  it("zählt Quellen und Anhänge aus den geladenen Feldern", () => {
    const o = koOverview(
      ko({
        sources: [
          {
            id: "s1",
            label: "Q",
            url: null,
            excerpt: null,
            kind: "external",
            peerValidated: false,
            author: "u-1",
            at: "x",
          },
        ],
        attachments: [{ id: "a1", name: "f", mime: "image/png", author: "u-1", at: "x" }],
      }),
    );
    expect(o.sourceCount).toBe(1);
    expect(o.attachmentCount).toBe(1);
    expect(o.hasEvidence).toBe(true);
  });
});
