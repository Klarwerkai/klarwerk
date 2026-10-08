// ================================================================================================
// R-1657 (ROADMAP 9.3) — LÜCKENERKENNUNG: WISSENS-SPRINTS JE BEREICH.
// ================================================================================================
//
// Quelle: „KLARWERK analysiert regelmäßig, in welchen Themenbereichen wenig Wissen, geringer Trust
// oder hohe Konflikt-Dichte herrscht — und schlägt der Organisation Wissens-Sprints vor: ‚Bereich
// Schweißtechnik: 4 offene Konflikte, 12 Objekte zur Re-Validierung. 2-Tage-Sprint vorschlagen?'"
//
//   S1  das Beispiel der Quelle: 4 Objekte im Konflikt + 12 zur Re-Validierung ⇒ 2-Tage-Sprint;
//       ein gesunder Bereich bekommt keinen Vorschlag
//   S2  geringes Vertrauen und dünner validierter Bestand sind eigene Gründe; Reihenfolge nach
//       Arbeitsumfang; Sprintlänge gedeckelt; ohne Konflikt-Eingang wird kein Konflikt behauptet
//   S3  der echte Datenweg (buildServices, Konfliktdienst, Paar-Regel): ein Konflikt mit einem
//       unsichtbaren Partner zählt nicht, und ein nur unsichtbarer Bereich erscheint gar nicht
import { describe, expect, it } from "vitest";
import { buildServices } from "../../services/app/src/build-app";
import type { KnowledgeObject } from "../../services/knowledge-object";
import { computeSnapshot } from "../../services/management";
import { sprints } from "../../services/management/src/metrics";
import type { MetricsInput } from "../../services/management/src/types";

const NOW = Date.parse("2026-10-01T00:00:00Z");

function ko(p: Partial<KnowledgeObject> & { id: string }): KnowledgeObject {
  return {
    title: p.id,
    statement: "s",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Schweißtechnik",
    tags: [],
    confidence: 0,
    trust: 80,
    status: "validiert",
    version: 1,
    originalAuthor: "a",
    author: "a",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-06-20",
    history: [],
    ...p,
  } as KnowledgeObject;
}

function input(over: Partial<MetricsInput> = {}): MetricsInput {
  return {
    kos: [],
    openGaps: 0,
    openConflicts: 0,
    pendingRevalidation: [],
    busFactor: [],
    now: NOW,
    openConflictKoIds: [],
    ...over,
  };
}

const reihe = (prefix: string, n: number, over: Partial<KnowledgeObject> = {}) =>
  Array.from({ length: n }, (_, i) => ko({ id: `${prefix}${i + 1}`, ...over }));

describe("R-1657 · Wissens-Sprints aus erkannten Lücken und Konflikten", () => {
  it("S1 · das Beispiel der Quelle: 4 Konfliktobjekte, 12 zur Re-Validierung ⇒ 2-Tage-Sprint", () => {
    const konflikt = reihe("K", 4);
    const faellig = reihe("R", 12);
    const gesund = reihe("G", 3, { category: "Montage" });
    const snap = computeSnapshot(
      input({
        kos: [...konflikt, ...faellig, ...gesund],
        openConflicts: 2,
        openConflictKoIds: konflikt.map((k) => k.id),
        pendingRevalidation: faellig.map((k) => k.id),
      }),
    );

    expect(snap.sprints).toEqual([
      {
        category: "Schweißtechnik",
        reasons: [
          { key: "conflicts", count: 4 },
          { key: "revalidation", count: 12 },
        ],
        workItems: 16,
        days: 2,
      },
    ]);
    // Gegenprobe: drei validierte, vertrauenswürdige Objekte ohne Konflikt — kein Vorschlag.
    expect(snap.sprints.some((s) => s.category === "Montage")).toBe(false);
  });

  it("S2 · geringes Vertrauen und dünner Bestand begründen eigene Vorschläge; Rang und Deckel", () => {
    const rows = sprints(
      input({
        kos: [
          // Ein Objekt, mehrere Gründe: es zählt im Arbeitsumfang nur einmal.
          ko({ id: "A1", category: "Hydraulik", trust: 20, status: "offen" }),
          ko({ id: "A2", category: "Hydraulik", trust: 90 }),
          ko({ id: "B1", category: "Elektrik" }),
          ...reihe("V", 60, { category: "Lackierung", trust: 30 }),
        ],
        pendingRevalidation: ["A1"],
        openConflictKoIds: ["A1"],
      }),
    );

    expect(rows.map((r) => r.category)).toEqual(["Lackierung", "Hydraulik", "Elektrik"]);
    const [lack, hydraulik, elektrik] = rows;
    expect(lack?.reasons).toEqual([{ key: "lowTrust", count: 60 }]);
    expect(lack?.workItems).toBe(60);
    expect(lack?.days, "60 Objekte ergäben 8 Tage — gedeckelt auf 5").toBe(5);
    expect(hydraulik?.reasons).toEqual([
      { key: "conflicts", count: 1 },
      { key: "revalidation", count: 1 },
      { key: "lowTrust", count: 1 },
      { key: "thinKnowledge", count: 1 },
    ]);
    expect(hydraulik?.workItems).toBe(1);
    expect(hydraulik?.days).toBe(1);
    // „Wenig Wissen": ein einziges validiertes Objekt im Bereich.
    expect(elektrik?.reasons).toEqual([{ key: "thinKnowledge", count: 1 }]);
    expect(elektrik?.workItems).toBe(0);
    expect(elektrik?.days).toBe(1);

    // Ohne Konflikt-Eingang (null) wird keine Konfliktzahl behauptet.
    const ohne = sprints(
      input({ kos: [ko({ id: "A1", category: "Hydraulik" })], openConflictKoIds: null }),
    );
    expect(ohne[0]?.reasons.map((r) => r.key)).toEqual(["thinKnowledge"]);
    // Leerer Bestand: keine Vorschläge.
    expect(sprints(input())).toEqual([]);
  });

  it("S3 · echter Datenweg: Paar-Regel der Konflikte und kein unsichtbarer Bereich", async () => {
    const services = buildServices();
    const BEREICH = "Sprint R1657";
    const GEHEIM = "Sprint R1657 vertraulich";
    const anlegen = (title: string, category: string) =>
      services.ko.create({
        title,
        statement: `Aussage zu ${title}`,
        type: "best_practice",
        category,
        author: "u-sprint",
      });
    const a = await anlegen("Objekt A", BEREICH);
    const b = await anlegen("Objekt B", BEREICH);
    const c = await anlegen("Objekt C", BEREICH);
    const geheim = await anlegen("Objekt G", GEHEIM);
    const sichtbar = (k: { id: string }) => k.id !== b.id && k.id !== geheim.id;
    const vorschlag = async () => {
      const snap = await services.management.snapshot({ sichtbar });
      expect(snap.sprints.some((s) => s.category === GEHEIM)).toBe(false);
      return snap.sprints.find((s) => s.category === BEREICH);
    };

    await services.conflicts.create({ koA: a.id, koB: b.id, type: "truth", description: "A–B" });
    expect(
      (await vorschlag())?.reasons.find((r) => r.key === "conflicts"),
      "Konflikt mit nur einem sichtbaren Partner",
    ).toBeUndefined();

    await services.conflicts.create({ koA: a.id, koB: c.id, type: "truth", description: "A–C" });
    const s = await vorschlag();
    expect(s?.reasons.find((r) => r.key === "conflicts")?.count).toBe(2);
    // Frisch angelegte Objekte sind ungeprüft: geringes Vertrauen und dünner validierter Bestand.
    expect(s?.reasons.find((r) => r.key === "lowTrust")?.count).toBe(2);
    expect(s?.reasons.find((r) => r.key === "thinKnowledge")?.count).toBe(0);
    expect(s?.workItems).toBe(2);
    expect(s?.days).toBe(1);
  });
});
