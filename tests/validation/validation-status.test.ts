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

// ================================================================================================
// JOB 557 · D8 — DER ZWEITE VERBRAUCHER KENNT BEIDE NAMEN, UND ER VERWECHSELT SIE NICHT
// ================================================================================================
//
// Die Rückgabe an eine benannte Eigentümerin heisst seit D8 `ko.returned-to-owner`. Für diese
// Datei folgen daraus zwei Dinge, die auseinandergehalten werden müssen:
//
//   · DER STATUS AM OBJEKT (`isReturnedForRework`) gilt für BEIDE Namen. „In Nacharbeit" ist eine
//     Eigenschaft des Wissensobjekts, nicht der Person — und ein Board, das den neuen Namen nicht
//     kennt, schwiege über einen Zustand, den es gibt.
//   · DIE PERSÖNLICHE AUFGABENLISTE (`returnedToAuthor`) gilt es NICHT. Sie beantwortet „was liegt
//     bei MIR", und bei einer Owner-Rückgabe liegt es gerade nicht bei der Autorin. Würde der neue
//     Name hier einfach mitzählen, hätte D8 die Verwechslung nur an eine andere Stelle verschoben.
//
// HISTORISCHE EREIGNISSE BLEIBEN LESBAR: Altbestand trägt ausschliesslich `ko.returned-to-author`,
// und diese Einträge müssen weiterhin denselben Zustand ergeben wie am Tag ihrer Entstehung.
describe("JOB 557 D8: Nacharbeitsstatus und persönliche Aufgabe sind zwei Aussagen", () => {
  it("V4a · der neue Owner-Name führt zum sichtbaren Nacharbeitsstatus", () => {
    const entries = [
      ev(1, "ko.created", "K1"),
      ev(2, "ko.returned-to-owner", "K1", {
        verdict: "down",
        author: "anna",
        responsible: "eva",
        responsibleKind: "owner",
      }),
    ];
    expect(isReturnedForRework(entries, "K1")).toBe(true);
  });

  it("V4b · eine spätere Überarbeitung beendet auch die Owner-Nacharbeit", () => {
    // Ohne diesen Fall wäre der neue Name zwar bekannt, aber nicht abschliessbar — das Board
    // zeigte „Nacharbeit" für immer.
    const entries = [
      ev(1, "ko.returned-to-owner", "K1", { verdict: "warn" }),
      ev(2, "ko.revised", "K1"),
    ];
    expect(isReturnedForRework(entries, "K1")).toBe(false);
  });

  it("V4c · HISTORISCH: Alteinträge bleiben lesbar und ergeben denselben Zustand", () => {
    // Der Altbestand kennt den neuen Namen nicht. Er darf durch diese Änderung nichts verlieren.
    const entries = [ev(1, "ko.returned-to-author", "K1", { verdict: "warn" })];
    expect(isReturnedForRework(entries, "K1")).toBe(true);
    const kos = [ko({ id: "K1", author: "anna" })];
    expect(returnedToAuthor(entries, kos, "anna")).toHaveLength(1);
  });

  it("V4d · eine Owner-Rückgabe erscheint NICHT in der Aufgabenliste der Autorin", () => {
    const kos = [ko({ id: "K1", author: "anna" })];
    const entries = [
      ev(2, "ko.returned-to-owner", "K1", {
        verdict: "down",
        author: "anna",
        responsible: "eva",
        responsibleKind: "owner",
      }),
    ];
    // Das Objekt IST in Nacharbeit …
    expect(isReturnedForRework(entries, "K1")).toBe(true);
    // … aber nicht bei ihr. Sonst wäre der ehrliche Name nur eine andere Verwechslung.
    expect(returnedToAuthor(entries, kos, "anna")).toEqual([]);
  });

  it("V4e · fällt die Rückgabe auf die Autorin zurück, steht sie sehr wohl in ihrer Liste", () => {
    // Die Gegenkontrolle zu V4d: der Fallback bleibt vollständig erhalten. Ohne diesen Fall wäre
    // „erscheint nicht" auch dann grün, wenn die Liste generell leer bliebe.
    const kos = [ko({ id: "K1", author: "anna" })];
    const entries = [
      ev(2, "ko.returned-to-author", "K1", {
        verdict: "warn",
        author: "anna",
        responsible: "anna",
        responsibleKind: "author-fallback",
      }),
    ];
    const mine = returnedToAuthor(entries, kos, "anna");
    expect(mine).toHaveLength(1);
    expect(mine[0]?.verdict).toBe("warn");
  });
});
