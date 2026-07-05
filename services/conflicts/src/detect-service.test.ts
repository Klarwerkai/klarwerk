import { beforeEach, describe, expect, it } from "vitest";
import type { ConflictVerdict, DetectSubject } from "./detect";
import { InMemoryConflictRepo } from "./repo";
import { ConflictService } from "./service";

function subject(id: string, statement: string): DetectSubject {
  return {
    refId: id,
    title: "Dienstwagen-Farbe",
    statement,
    conditions: [],
    measures: [],
    category: "Allgemein",
    tags: [],
    asset: null,
  };
}

const blau = subject("ko-blau", "Wir bestellen alle Dienstwagen in der Farbe blau.");
const rot = subject("ko-rot", "Wir bestellen alle Dienstwagen in der Farbe rot.");

// Fake-„Modell": urteilt Widerspruch mit wörtlich vorhandenen Zitaten (G-2 erfüllt).
const conflictJudge = async (a: string, b: string): Promise<ConflictVerdict | null> => ({
  relation: "widerspruch",
  older: null,
  confidence: 0.95,
  begruendung: "A und B legen eine andere verbindliche Farbe fest.",
  zitat_a: a.includes("blau") ? "Farbe blau" : "Farbe rot",
  zitat_b: b.includes("rot") ? "Farbe rot" : "Farbe blau",
});
// Fake-„kein Modell": liefert kein Urteil (wie der deterministische Modus).
const noModelJudge = async (): Promise<ConflictVerdict | null> => null;

describe("Berater-Konzept 04.07. (Stufe 3): detectForSubject", () => {
  let service: ConflictService;
  beforeEach(() => {
    service = new ConflictService({ repo: new InMemoryConflictRepo() });
  });

  it("Firmenwagen-Fall (Abnahme 9.1): rot gegen blau → genau ein truth-Konflikt", async () => {
    const created = await service.detectForSubject(rot, [blau], conflictJudge);
    expect(created).toHaveLength(1);
    expect(created[0]?.type).toBe("truth");
    expect(created[0]?.koA).toBe("ko-rot");
    expect(created[0]?.koB).toBe("ko-blau");
    expect(created[0]?.description).toContain("Automatisch erkannt");
    expect(await service.badgeCount()).toBe(1);
  });

  it("Stufe 4: automatisch erkannter Konflikt trägt Herkunft + Erkennungs-Metadaten", async () => {
    const [conflict] = await service.detectForSubject(rot, [blau], conflictJudge, {
      modelLabel: "anthropic:test",
    });
    expect(conflict?.origin).toBe("auto");
    expect(conflict?.detector?.method).toBe("model");
    expect(conflict?.detector?.promptVersion).toBe("kon-v1");
    expect(conflict?.detector?.confidence).toBe(0.95);
    expect(conflict?.detector?.rationale).toBeTruthy();
    expect(conflict?.detector?.quotes?.a).toBe("Farbe rot");
    expect(conflict?.detector?.modelLabel).toBe("anthropic:test");
  });

  it("Stufe 4: Fehlalarm schließt den Konflikt als dismissed (kein Wiederauftauchen im Badge)", async () => {
    const [conflict] = await service.detectForSubject(rot, [blau], conflictJudge);
    const dismissed = await service.dismiss(
      conflict?.id ?? "",
      "controller-1",
      "Anderer Standort.",
    );
    expect(dismissed.status).toBe("geloest");
    expect(dismissed.resolutionReason).toBe("dismissed");
    expect(dismissed.decidedBy).toBe("controller-1");
    expect(await service.badgeCount()).toBe(0);
  });

  it("Idempotenz: ein zweiter Lauf legt keinen zweiten Konflikt an", async () => {
    await service.detectForSubject(rot, [blau], conflictJudge);
    const again = await service.detectForSubject(rot, [blau], conflictJudge);
    expect(again).toHaveLength(0);
    expect(await service.badgeCount()).toBe(1);
  });

  it("ohne Modell (judge liefert null) → kein Konflikt (kein Fake)", async () => {
    const created = await service.detectForSubject(rot, [blau], noModelJudge);
    expect(created).toHaveLength(0);
    expect(await service.badgeCount()).toBe(0);
  });

  it("kein fachlich naher Kandidat → keine Prüfung, kein Konflikt", async () => {
    const fremd: DetectSubject = {
      refId: "fremd",
      title: "Kantine",
      statement: "Das Mittagessen kostet 5 Euro.",
      conditions: [],
      measures: [],
      category: "Verpflegung",
      tags: [],
      asset: null,
    };
    const created = await service.detectForSubject(rot, [fremd], conflictJudge);
    expect(created).toHaveLength(0);
  });
});
