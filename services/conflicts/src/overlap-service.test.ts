import { beforeEach, describe, expect, it } from "vitest";
import type { DetectSubject } from "./detect";
import type { OverlapVerdict } from "./duplicate-detect";
import { InMemoryOverlapRepo } from "./overlap-repo";
import { OverlapService } from "./overlap-service";

function subject(id: string, title: string, statement: string): DetectSubject {
  return {
    refId: id,
    title,
    statement,
    conditions: [],
    measures: [],
    category: "Wartung",
    tags: [],
    asset: null,
  };
}

const a = subject(
  "ko-a",
  "Pumpe entlüften",
  "Nach dem Anfahren 10 Sekunden warten, dann die Pumpe entlüften.",
);
const bNearIdentical = subject(
  "ko-b",
  "Pumpe entlüften",
  "Nach dem Anfahren 10 Sekunden warten und dann die Pumpe entlüften.",
);
const m1 = subject("ko-m1", "Pumpe entlüften", "Nach dem Anfahren zehn Sekunden warten.");
const m2 = subject(
  "ko-m2",
  "Pumpe entlüften",
  "Vor dem Abschalten das Ventil vollständig schließen und sichern.",
);

const teilweiseVerdict: OverlapVerdict = {
  beziehung: "teilweise",
  aspects: [
    { beschreibung: "Titel deckt sich", zitatA: "Pumpe entlüften", zitatB: "Pumpe entlüften" },
  ],
  nurInA: "nur A: Wartezeit",
  nurInB: "nur B: Ventil",
  empfehlung: "zusammenfuehren_pruefen",
  confidence: 0.9,
  begruendung: "Teilweiser gemeinsamer Kern.",
};
const noJudge = async (): Promise<OverlapVerdict | null> => null;
const teilweiseJudge = async (): Promise<OverlapVerdict | null> => teilweiseVerdict;
const verwandtJudge = async (): Promise<OverlapVerdict | null> => ({
  ...teilweiseVerdict,
  beziehung: "verwandt",
});

describe("Berater-Konzept Duplikate 04.07. (Stufe D3): OverlapService", () => {
  let service: OverlapService;
  beforeEach(() => {
    service = new OverlapService({ repo: new InMemoryOverlapRepo() });
  });

  it("wortgleiches Duplikat → deterministischer Eintrag OHNE Modell (identisch/zusammenfuehren)", async () => {
    const created = await service.detectForSubject(a, [bNearIdentical], noJudge);
    expect(created).toHaveLength(1);
    expect(created[0]?.relation).toBe("identisch");
    expect(created[0]?.recommendation).toBe("zusammenfuehren");
    expect(created[0]?.origin).toBe("auto");
    expect(created[0]?.detector?.method).toBe("deterministic");
    expect(created[0]?.detector?.lexicalScore).toBeGreaterThan(0.85);
    expect(await service.badgeCount()).toBe(1);
  });

  it("Paraphrase-Kandidat → Modell-Profil teilweise, mit Eigenanteilen + Metadaten", async () => {
    const [entry] = await service.detectForSubject(m1, [m2], teilweiseJudge, {
      modelLabel: "anthropic:test",
    });
    expect(entry?.relation).toBe("teilweise");
    expect(entry?.aspects).toHaveLength(1);
    expect(entry?.eigenanteilA).toBe("nur A: Wartezeit");
    expect(entry?.eigenanteilB).toBe("nur B: Ventil");
    expect(entry?.detector?.method).toBe("model");
    expect(entry?.detector?.promptVersion).toBe("dup-v1");
    expect(entry?.detector?.confidence).toBe(0.9);
    expect(entry?.detector?.modelLabel).toBe("anthropic:test");
  });

  it("verwandt → kein automatischer Eintrag", async () => {
    const created = await service.detectForSubject(m1, [m2], verwandtJudge);
    expect(created).toHaveLength(0);
  });

  it("Idempotenz: zweiter Lauf legt keinen zweiten Eintrag an", async () => {
    await service.detectForSubject(a, [bNearIdentical], noJudge);
    const again = await service.detectForSubject(a, [bNearIdentical], noJudge);
    expect(again).toHaveLength(0);
    expect(await service.badgeCount()).toBe(1);
  });

  it("jeder gegen jeden: auch ein fernes Thema wird der KI vorgelegt — Urteil 'verschieden' → kein Eintrag", async () => {
    const fremd = subject("fremd", "Kantinenpreise", "Das Mittagessen kostet 5 Euro.");
    let asked = 0;
    const verschiedenJudge = async (): Promise<OverlapVerdict | null> => {
      asked += 1;
      return { ...teilweiseVerdict, beziehung: "verschieden" };
    };
    const created = await service.detectForSubject(
      a,
      [{ ...fremd, category: "Verpflegung" }],
      verschiedenJudge,
    );
    // Früher hätte die Textnähe-Vorauswahl diesen Kandidaten aussortiert; jetzt entscheidet die KI.
    expect(asked).toBe(1);
    expect(created).toHaveLength(0);
  });

  it("Admin-Schwelle greift: Modell-Wahrscheinlichkeit unter der Schwelle → kein Eintrag", async () => {
    const grenzJudge = async (): Promise<OverlapVerdict | null> => ({
      beziehung: "teilweise",
      aspects: [
        { beschreibung: "Titel deckt sich", zitatA: "Pumpe entlüften", zitatB: "Pumpe entlüften" },
      ],
      nurInA: "",
      nurInB: "",
      empfehlung: "zusammenfuehren_pruefen",
      confidence: 0.55,
      begruendung: "Grenzfall.",
    });
    const strict = await service.detectForSubject(m1, [m2], grenzJudge, { minConfidence: 0.6 });
    expect(strict).toHaveLength(0);

    const svc2 = new OverlapService({ repo: new InMemoryOverlapRepo() });
    const lenient = await svc2.detectForSubject(m1, [m2], grenzJudge, { minConfidence: 0.5 });
    expect(lenient).toHaveLength(1);
  });

  it("menschliche Abschlüsse schließen den Eintrag mit Grund", async () => {
    const [entry] = await service.detectForSubject(a, [bNearIdentical], noJudge);
    const id = entry?.id ?? "";
    const dismissed = await service.dismiss(id, "kurator-1", "Kein echtes Duplikat.");
    expect(dismissed.status).toBe("geschlossen");
    expect(dismissed.resolution?.reason).toBe("dismissed");
    expect(dismissed.resolution?.by).toBe("kurator-1");
    expect(await service.badgeCount()).toBe(0);
  });

  it("getrennt lassen / verwandt verlinken setzen den passenden Grund", async () => {
    const [e1] = await service.detectForSubject(a, [bNearIdentical], noJudge);
    const kept = await service.keepSeparate(e1?.id ?? "", "kurator-1");
    expect(kept.resolution?.reason).toBe("kept_separate");

    const svc2 = new OverlapService({ repo: new InMemoryOverlapRepo() });
    const [e2] = await svc2.detectForSubject(a, [bNearIdentical], noJudge);
    const linked = await svc2.linkRelated(e2?.id ?? "", "kurator-1");
    expect(linked.resolution?.reason).toBe("linked_related");
  });

  it("gelöschter Beitrag schließt seine offenen Überschneidungen (participant_deleted, idempotent)", async () => {
    const [entry] = await service.detectForSubject(a, [bNearIdentical], noJudge);
    expect(await service.badgeCount()).toBe(1);
    const closed = await service.onKoRemoved(entry?.koA ?? "", "admin-1");
    expect(closed).toBe(1);
    expect(await service.badgeCount()).toBe(0);
    const stored = await service.get(entry?.id ?? "");
    expect(stored?.status).toBe("geschlossen");
    expect(stored?.resolution?.reason).toBe("participant_deleted");
    expect(stored?.resolution?.by).toBeNull(); // systemisch, kein Kurator
    // Idempotent: ein zweiter Lauf schließt nichts mehr.
    expect(await service.onKoRemoved(entry?.koA ?? "", "admin-1")).toBe(0);
  });
});
