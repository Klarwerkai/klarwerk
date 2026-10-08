// ================================================================================================
// R-1632 / R-1633 — „KOLLISIONEN WERDEN ALS KONTEXT-KONFLIKT SAUBER DARGESTELLT".
// ================================================================================================
//
// Ein von der Konfliktprüfung erkannter Widerspruch zweier Punkte mit VERSCHIEDENER Geltung ist
// kein Wahrheitskonflikt mit Eskalationspflicht, sondern ein Kontext- (anderer Ort) bzw.
// Rollenkonflikt (gleicher Ort, andere Rolle); die Beschreibung nennt beide Geltungen.
//
//   D1–D3  Konfliktdienst (`detectForSubject`) mit der Regel aus knowledge-object.
//   D4     Kalibrierung: ohne Regel bleibt es beim Wahrheitskonflikt (Bestandsverhalten).
//   W1–W2  App-Wurzel (`detectConflictsForKo`) über den ECHTEN Wissensobjekt-Dienst — die an
//          `setGeltung` gespeicherte Geltung kommt in der Erkennung an. Eingesetzt ist nur das
//          Modellurteil (es gibt im Test kein Modell).
import { describe, expect, it } from "vitest";
import { buildServices } from "../../services/app/src/build-app";
import { detectConflictsForKo } from "../../services/app/src/conflict-detection";
import {
  ConflictService,
  type ConflictVerdict,
  type DetectSubject,
  InMemoryConflictRepo,
} from "../../services/conflicts";
import { type KoGeltung, geltungsKollision } from "../../services/knowledge-object";
import type { Reasoner } from "../../services/reasoner";

const URTEIL: ConflictVerdict = {
  relation: "widerspruch",
  older: null,
  confidence: 0.95,
  begruendung: "Zwei verschiedene Vorwärmtemperaturen.",
  zitat_a: "60 Grad",
  zitat_b: "80 Grad",
};

function paar(a?: KoGeltung, b?: KoGeltung): { a: DetectSubject; b: DetectSubject } {
  const basis: DetectSubject = {
    refId: "A",
    title: "Presse anfahren",
    statement: "Das Werkzeug wird auf 60 Grad vorgewärmt.",
    conditions: [],
    measures: [],
    category: "Presswerk",
    tags: [],
  };
  return {
    a: { ...basis, ...(a ? { geltung: a } : {}) },
    b: {
      ...basis,
      refId: "B",
      statement: "Das Werkzeug wird auf 80 Grad vorgewärmt.",
      ...(b ? { geltung: b } : {}),
    },
  };
}

async function erkenne(a?: KoGeltung, b?: KoGeltung, mitRegel = true) {
  const service = new ConflictService({ repo: new InMemoryConflictRepo() });
  const p = paar(a, b);
  const [c] = await service.detectForSubject(
    p.a,
    [p.a, p.b],
    async () => URTEIL,
    mitRegel ? { geltungsKollision } : {},
  );
  return c;
}

describe("R-1632 · Erkennung im Konfliktdienst", () => {
  it("D1 · Werks-Praxis gegen Konzern-Standard: Kontextkonflikt, beide Geltungen in der Beschreibung", async () => {
    const c = await erkenne({ ebene: "werk", werk: "Werk Nord" }, { ebene: "konzern" });
    expect(c?.type).toBe("context");
    expect(c?.status).toBe("offen");
    expect(c?.description).toContain("Automatisch erkannt: Zwei verschiedene Vorwärmtemperaturen.");
    expect(c?.description).toContain("Werks-Praxis (Werk Nord)");
    expect(c?.description).toContain("Konzern-Standard");
  });

  it("D2 · Frühschicht gegen Nachtschicht im selben Werk: Kontextkonflikt", async () => {
    const c = await erkenne(
      { ebene: "schicht", werk: "Werk Nord", schicht: "Frühschicht" },
      { ebene: "schicht", werk: "Werk Nord", schicht: "Nachtschicht" },
    );
    expect(c?.type).toBe("context");
  });

  it("D3 · R-1633 „Rollen-Konflikt-Typ produktiv“: gleicher Ort, andere Rolle → Rollenkonflikt", async () => {
    const c = await erkenne(
      { ebene: "werk", werk: "Werk Nord", rolle: "Instandhaltung" },
      { ebene: "werk", werk: "Werk Nord", rolle: "Bedienung" },
    );
    expect(c?.type).toBe("role");
  });

  it("D4 · gleiche Geltung, fehlende Geltung oder keine Regel: es bleibt der Wahrheitskonflikt", async () => {
    const nord: KoGeltung = { ebene: "werk", werk: "Werk Nord" };
    expect((await erkenne(nord, nord))?.type).toBe("truth");
    expect((await erkenne(nord, undefined))?.type).toBe("truth");
    expect((await erkenne(nord, { ebene: "konzern" }, false))?.type).toBe("truth");
    expect((await erkenne(nord, nord))?.description).not.toContain("Geltung:");
  });
});

describe("R-1632 · Verdrahtung in der App-Wurzel", () => {
  async function bestand(gA?: unknown, gB?: unknown) {
    const services = buildServices();
    const anlegen = (statement: string) =>
      services.ko.create({
        title: "Presse anfahren",
        statement,
        type: "best_practice",
        category: "Presswerk",
        author: "u-test",
      });
    const a = await anlegen("Das Werkzeug wird auf 60 Grad vorgewärmt.");
    const b = await anlegen("Das Werkzeug wird auf 80 Grad vorgewärmt.");
    if (gA !== undefined) {
      await services.ko.setGeltung(a.id, gA, "u-test");
    }
    if (gB !== undefined) {
      await services.ko.setGeltung(b.id, gB, "u-test");
    }
    const reasoner = {
      judgeConflictOutcome: async () => ({ verdict: URTEIL }),
    } as unknown as Reasoner;
    await detectConflictsForKo(a.id, { ko: services.ko, conflicts: services.conflicts, reasoner });
    const offen = (await services.conflicts.unresolved()).filter(
      (c) => [c.koA, c.koB].includes(a.id) && [c.koA, c.koB].includes(b.id),
    );
    return offen;
  }

  it("W1 · gespeicherte Geltungen machen den erkannten Widerspruch zum Kontextkonflikt", async () => {
    const offen = await bestand(
      { ebene: "schicht", werk: "Werk Nord", schicht: "Frühschicht" },
      { ebene: "werk", werk: "Werk Süd" },
    );
    expect(offen).toHaveLength(1);
    expect(offen[0]?.type).toBe("context");
    expect(offen[0]?.description).toContain("Schicht-spezifisch (Werk Nord · Frühschicht)");
    expect(offen[0]?.description).toContain("Werks-Praxis (Werk Süd)");
  });

  it("W2 · KALIBRIERUNG: ohne Geltung entsteht derselbe Befund als Wahrheitskonflikt", async () => {
    const offen = await bestand();
    expect(offen).toHaveLength(1);
    expect(offen[0]?.type).toBe("truth");
  });
});
