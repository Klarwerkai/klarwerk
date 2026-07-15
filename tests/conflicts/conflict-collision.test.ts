import { describe, expect, it } from "vitest";
import type { Conflict, ConflictDetector, KnowledgeObject } from "../../apps/web/src/api/types";
import {
  conflictDisplayMode,
  hasStreitpunkt,
  resolveCollision,
} from "../../apps/web/src/lib/conflictCollision";

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

const conflict = (detector?: ConflictDetector, p: Partial<Conflict> = {}): Conflict =>
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
    origin: detector ? "auto" : "manual",
    ...(detector ? { detector } : {}),
    createdAt: "2026-01-01",
    ...p,
  }) as Conflict;

const kollisionDetector = (streitpunkt = "Pflichtfarbe"): ConflictDetector => ({
  trigger: "validation",
  method: "model",
  quotes: { a: "Die Markierung muss blau sein.", b: "Die Markierung muss rot sein." },
  kollision: {
    streitpunkt,
    seiteA: { kernaussage: "Markierung blau", streitwert: "blau", streitwertWoertlich: true },
    seiteB: { kernaussage: "Markierung rot", streitwert: "rot", streitwertWoertlich: false },
  },
});

const kos = [ko("K1", "Anweisung Halle A"), ko("K2", "Anweisung Halle B")];

// SCRUM-492: Die Darstellung folgt einer Fallback-Kaskade — strukturierte Kacheln, sonst die zwei
// wörtlichen Zitate, sonst der Beschreibungstext. Alt-/Manuell-Konflikte brechen nie.
describe("SCRUM-492: conflictDisplayMode (Fallback-Kaskade)", () => {
  it("detector.kollision vorhanden → Kacheln", () => {
    expect(conflictDisplayMode(conflict(kollisionDetector()))).toBe("kollision");
  });

  it("nur detector.quotes (Alt-Auto-Konflikt) → Zitate", () => {
    const d: ConflictDetector = {
      trigger: "validation",
      method: "model",
      quotes: { a: "x", b: "y" },
    };
    expect(conflictDisplayMode(conflict(d))).toBe("quotes");
  });

  it("kein detector (manuell/Alt) → Text", () => {
    expect(conflictDisplayMode(conflict())).toBe("text");
  });
});

describe("SCRUM-492: resolveCollision (Titel-Auflösung + Streitwert-Beleg)", () => {
  it("löst Titel aus dem KO-Paar und übernimmt Kernaussage/Streitwert/Beleg-Flag", () => {
    const res = resolveCollision(conflict(kollisionDetector()), kos);
    expect(res?.a.title).toEqual({ removed: false, title: "Anweisung Halle A" });
    expect(res?.b.title).toEqual({ removed: false, title: "Anweisung Halle B" });
    expect(res?.a.streitwert).toBe("blau");
    expect(res?.a.streitwertWoertlich).toBe(true);
    expect(res?.b.streitwertWoertlich).toBe(false);
    expect(res?.streitpunkt).toBe("Pflichtfarbe");
  });

  it("fehlendes KO → Titel als entfernt markiert (nie die UUID)", () => {
    const res = resolveCollision(conflict(kollisionDetector()), [ko("K1", "Nur A")]); // K2 fehlt
    expect(res?.a.title).toEqual({ removed: false, title: "Nur A" });
    expect(res?.b.title).toEqual({ removed: true });
  });

  it("ohne kollision → null (Komponente fällt auf Zitate/Text zurück)", () => {
    expect(resolveCollision(conflict(), kos)).toBeNull();
  });

  it("hasStreitpunkt: leerer Streitpunkt blendet die Streitpunkt-Zeile aus", () => {
    const gefuellt = resolveCollision(conflict(kollisionDetector("Pflichtfarbe")), kos)!;
    const leer = resolveCollision(conflict(kollisionDetector("   ")), kos)!;
    expect(hasStreitpunkt(gefuellt)).toBe(true);
    expect(hasStreitpunkt(leer)).toBe(false);
  });
});
