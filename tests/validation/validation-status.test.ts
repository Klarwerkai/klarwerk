import { describe, expect, it } from "vitest";
import type { AuditEntry, KnowledgeObject } from "../../apps/web/src/api/types";
import {
  deriveDisplayStatus,
  isReturnedForRework,
  returnedToAuthor,
} from "../../apps/web/src/lib/validationStatus";

const ko = (p: Partial<KnowledgeObject> & { id: string }): KnowledgeObject =>
  ({
    title: p.id,
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
    originalAuthor: "anna",
    author: "anna",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-01-01",
    history: [],
    ...p,
  }) as KnowledgeObject;

const ev = (
  seq: number,
  action: string,
  target: string,
  payload: Record<string, unknown> = {},
): AuditEntry =>
  ({
    seq,
    at: `t${seq}`,
    actor: "x",
    action,
    target,
    payload,
    prevHash: "",
    hash: "",
  }) as AuditEntry;

describe("SCRUM-125: konsistente Display-Ableitung", () => {
  it("offen ohne Zuweisung → offen; mit Zuweisung → pruefung", () => {
    expect(deriveDisplayStatus(ko({ id: "K1" }))).toBe("offen");
    expect(deriveDisplayStatus(ko({ id: "K1", assignments: ["u1"] }))).toBe("pruefung");
  });

  it("validiert → validiert; mit Revalidierungs-Flag → revalidierung", () => {
    expect(deriveDisplayStatus(ko({ id: "K1", status: "validiert" }))).toBe("validiert");
    expect(deriveDisplayStatus(ko({ id: "K1", status: "validiert" }), { revalidation: true })).toBe(
      "revalidierung",
    );
  });

  it("Flags Konflikt/abgelehnt haben Vorrang", () => {
    expect(deriveDisplayStatus(ko({ id: "K1", status: "validiert" }), { conflict: true })).toBe(
      "konflikt",
    );
    expect(deriveDisplayStatus(ko({ id: "K1" }), { rejected: true })).toBe("abgelehnt");
  });
});

describe("SCRUM-124: Rückgabe/Nacharbeit aus Audit", () => {
  it("letztes Ereignis = Rückgabe → in Nacharbeit", () => {
    const entries = [
      ev(1, "ko.created", "K1"),
      ev(2, "ko.returned-to-author", "K1", { verdict: "down" }),
    ];
    expect(isReturnedForRework(entries, "K1")).toBe(true);
  });

  it("spätere Überarbeitung beendet die Nacharbeit", () => {
    const entries = [
      ev(1, "ko.returned-to-author", "K1", { verdict: "warn" }),
      ev(2, "ko.revised", "K1"),
    ];
    expect(isReturnedForRework(entries, "K1")).toBe(false);
  });

  it("returnedToAuthor liefert nur eigene, aktuell zurückgegebene KOs", () => {
    const kos = [ko({ id: "K1", author: "anna" }), ko({ id: "K2", author: "bob" })];
    const entries = [
      ev(1, "ko.returned-to-author", "K1", { verdict: "down" }),
      ev(2, "ko.returned-to-author", "K2", { verdict: "warn" }),
    ];
    const mine = returnedToAuthor(entries, kos, "anna");
    expect(mine).toHaveLength(1);
    expect(mine[0]?.koId).toBe("K1");
    expect(mine[0]?.verdict).toBe("down");
  });
});
